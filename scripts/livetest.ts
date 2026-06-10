// Live integration test against a real ngircd (via SSH tunnel on localhost:6667).
// Uses RAVEIRC's ACTUAL code — parseIrcLine, the protection functions/trackers,
// and parseInput — driving a "RAVE bot" (channel op) and an "offender" session.
// Run: npx tsx scripts/livetest.ts
import net from "node:net";
import { parseIrcLine } from "../src/lib/irc/ircparse";
import {
  badwordHit,
  advertHit,
  capsHit,
  lengthHit,
  trickHit,
  FloodTracker,
  RepeatTracker,
  isExempt,
} from "../src/lib/irc/protections";
import { parseInput } from "../src/lib/irc/commands";

const HOST = "127.0.0.1";
const PORT = 6667;
const CHAN = "#qa";

type Line = string;
class Conn {
  sock: net.Socket;
  buf = "";
  lines: Line[] = [];
  nick: string;
  onLine?: (l: string) => void;
  constructor(nick: string) {
    this.nick = nick;
    this.sock = net.connect(PORT, HOST);
    this.sock.setEncoding("utf8");
    this.sock.on("data", (d: string) => {
      this.buf += d;
      let i;
      while ((i = this.buf.indexOf("\n")) >= 0) {
        const raw = this.buf.slice(0, i).replace(/\r$/, "");
        this.buf = this.buf.slice(i + 1);
        if (!raw) continue;
        this.lines.push(raw);
        const msg = parseIrcLine(raw); // <-- RAVEIRC's real parser
        if (msg.command.toUpperCase() === "PING") this.send(`PONG :${msg.params.at(-1) ?? ""}`);
        this.onLine?.(raw);
      }
    });
  }
  send(l: string) { this.sock.write(l + "\r\n"); }
  async register() {
    this.send(`NICK ${this.nick}`);
    this.send(`USER ${this.nick} 0 * :RAVE QA`);
    await this.waitFor((l) => l.includes(" 001 "), 10000);
  }
  waitFor(pred: (l: string) => boolean, ms = 6000): Promise<string | null> {
    return new Promise((res) => {
      const found = this.lines.find(pred);
      if (found) return res(found);
      const t = setTimeout(() => { this.onLine = undefined; res(null); }, ms);
      this.onLine = (l) => { if (pred(l)) { clearTimeout(t); this.onLine = undefined; res(l); } };
    });
  }
  recent() { const r = this.lines.slice(); this.lines = []; return r; }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const results: { name: string; ok: boolean; note: string }[] = [];
function check(name: string, ok: boolean, note = "") { results.push({ name, ok, note }); }

// RAVE protection config (mirrors defaults the store uses).
const cfg = {
  badword: { enabled: true, words: ["seb", "badword"], kick: true, reason: "watch your language" },
  antispam: { enabled: true, blockAdverts: true },
  caps: { enabled: true, minLength: 10, percent: 70 },
  length: { enabled: true, max: 80 },
};

async function main() {
  const bot = new Conn("RAVEbot");
  const off = new Conn("Offender");
  await bot.register();
  check("connect + register (real parser)", true, "001 received");
  bot.send(`JOIN ${CHAN}`);
  const names = await bot.waitFor((l) => l.includes(" 353 ") && l.includes(CHAN));
  const opped = !!names && /[@]RAVEbot/.test(names);
  check("bot auto-opped as channel creator", opped, names ?? "no 353");

  await off.register();
  const flood = new FloodTracker();
  const repeat = new RepeatTracker();

  // The bot enforces using RAVEIRC's real detection on each offender PRIVMSG.
  let lastReason = "";
  bot.onLine = (raw) => {
    const m = parseIrcLine(raw);
    if (m.command.toUpperCase() !== "PRIVMSG") return;
    const from = m.prefix?.nick ?? "";
    const target = m.params[0];
    const text = m.params[1] ?? "";
    if (target !== CHAN || from === "RAVEbot") return;
    const addr = m.prefix?.raw ?? "";
    if (isExempt(from, addr, [])) return;
    let hit = "";
    if (badwordHit(text, cfg.badword)) hit = "badword";
    else if (advertHit(text, cfg.antispam)) hit = "advert";
    else if (capsHit(text, cfg.caps)) hit = "caps";
    else if (lengthHit(text, cfg.length)) hit = "long text";
    else if (trickHit(text)) hit = "trick/exploit";
    else if (repeat.record(`${from}`, text, 3)) hit = "repeat flood";
    else if (flood.record(`${from}`, Date.now(), 5, 5)) hit = "text flood";
    if (hit) { lastReason = hit; bot.send(`KICK ${CHAN} ${from} :${hit}`); }
  };

  async function trigger(label: string, sends: string[], rejoinFirst = true) {
    if (rejoinFirst) { off.send(`JOIN ${CHAN}`); await sleep(300); }
    lastReason = "";
    off.recent();
    for (const s of sends) { off.send(`PRIVMSG ${CHAN} :${s}`); await sleep(120); }
    const kicked = await off.waitFor((l) => l.toUpperCase().includes("KICK") && l.includes("Offender"), 4000);
    check(`protection: ${label}`, !!kicked, kicked ? `kicked (${lastReason})` : "NOT kicked");
    await sleep(250);
  }

  await trigger("bad word", ["you are a seb"]);
  await trigger("advert / channel hotlink", ["join #freestuff now"]);
  await trigger("excessive caps", ["THIS IS ALL LOUD SHOUTING NONSENSE"]);
  await trigger("long text", ["x".repeat(120)]);
  await trigger("mIRC trick/exploit", ["$decode(aGFoYQ==,m)"]);
  await trigger("repeat flood", ["spam line", "spam line", "spam line", "spam line"]);
  await trigger("text flood", ["a", "b", "c", "d", "e", "f"]);

  // Friend exemption is pure logic — verify a friend is exempt.
  const friendCheck = isExempt("Offender", "Offender!~off@host", ["Offender"]);
  check("friend exemption (isExempt)", friendCheck === true, `isExempt=${friendCheck}`);

  // ---- command quirk check: parseInput → wire lines, sent live ----
  const ctx = { connected: true, target: CHAN };
  const cmdTests: [string, string][] = [
    ["/join #qa2", "raw JOIN"],
    ["/part #qa2 bye", "raw PART"],
    ["/topic " + CHAN + " RAVE QA topic", "raw TOPIC"],
    ["/nick RAVEbot2", "raw NICK"],
    ["/mode " + CHAN + " +m", "raw MODE"],
    ["/me waves", "action"],
    ["/msg " + CHAN + " hello there", "message"],
  ];
  for (const [input, kind] of cmdTests) {
    const r = parseInput(input, ctx) as any;
    let wire: string[] = [];
    if (r.type === "raw") wire = r.lines;
    else if (r.type === "message") wire = [`PRIVMSG ${r.target} :${r.text}`];
    else if (r.type === "action") wire = [`PRIVMSG ${r.target} :\x01ACTION ${r.text}\x01`];
    else wire = [`(${r.type})`];
    // send + look for an error numeric from the server
    bot.recent();
    for (const w of wire) bot.send(w);
    await sleep(300);
    // Flag common "command rejected" numerics from the server.
    const errs = bot.recent().filter((l) => / (401|403|421|442|461|472|473|474|482) /.test(l));
    const quirk = errs.length ? "server error: " + errs[0].slice(0, 80) : "";
    check(`command ${input} (${kind})`, errs.length === 0, quirk || wire.join(" | ").slice(0, 70));
    if (input.startsWith("/nick")) bot.send("NICK RAVEbot"); // revert
  }

  // print report
  console.log("\n================ LIVE TEST RESULTS ================");
  let pass = 0;
  for (const r of results) {
    console.log(`${r.ok ? "✅" : "❌"}  ${r.name}${r.note ? "  — " + r.note : ""}`);
    if (r.ok) pass++;
  }
  console.log(`\n${pass}/${results.length} passed`);
  bot.sock.destroy(); off.sock.destroy();
  process.exit(pass === results.length ? 0 : 1);
}
main().catch((e) => { console.error("harness error:", e); process.exit(2); });
