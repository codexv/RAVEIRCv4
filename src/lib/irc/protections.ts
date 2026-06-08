// Channel protection decision logic (RAVE-02/03), as pure/testable units.
//
// State (flood/repeat timing) lives in small tracker classes the store owns;
// the matching logic is pure. The store decides whether to ACT (needs op, not a
// friend) and turns an Action into kick/ban command lines.

import type {
  AntiSpamConfig,
  BadwordConfig,
  CapsConfig,
  CloneConfig,
  LengthConfig,
} from "./rave";
import { stripMirc } from "./mirc";

export interface Action {
  /** Whether to ban (set +b on the mask) before kicking. */
  ban: boolean;
  reason: string;
}

/** Convert an IRC-style wildcard mask (`*`, `?`) to a RegExp. */
export function maskToRegex(mask: string): RegExp {
  const escaped = mask.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const pattern = "^" + escaped.replace(/\*/g, ".*").replace(/\?/g, ".") + "$";
  return new RegExp(pattern, "i");
}

/**
 * Is this user exempt from protections? A friend entry is either a bare nick
 * (case-insensitive exact match) or a wildcard mask matched against the full
 * `nick!user@host` address.
 */
export function isExempt(nick: string, address: string | undefined, friends: string[]): boolean {
  const n = nick.toLowerCase();
  for (const f of friends) {
    if (!f) continue;
    if (!f.includes("!") && !f.includes("@") && !f.includes("*") && !f.includes("?")) {
      if (f.toLowerCase() === n) return true;
    } else if (address && maskToRegex(f).test(address)) {
      return true;
    } else if (maskToRegex(f).test(nick)) {
      return true;
    }
  }
  return false;
}

/** Return the matched bad word in `text`, or null. Whole-word, case-insensitive. */
export function badwordHit(text: string, cfg: BadwordConfig): string | null {
  if (!cfg.enabled || cfg.words.length === 0) return null;
  const clean = stripMirc(text).toLowerCase();
  const tokens = clean.split(/[^a-z0-9]+/i).filter(Boolean);
  const set = new Set(tokens);
  for (const w of cfg.words) {
    const word = w.trim().toLowerCase();
    if (!word) continue;
    // exact token match, or substring for multi-word / explicit phrases
    if (set.has(word) || (word.includes(" ") && clean.includes(word))) return w;
  }
  return null;
}

/** Does a message look like an advert/spam (URL or channel/server invite)? */
export function advertHit(text: string, cfg: AntiSpamConfig): boolean {
  if (!cfg.enabled || !cfg.blockAdverts) return false;
  const t = stripMirc(text);
  return (
    /\bhttps?:\/\//i.test(t) ||
    /\bwww\.[a-z0-9-]+\.[a-z]{2,}/i.test(t) ||
    /\birc:\/\//i.test(t) ||
    /\b[a-z0-9-]+\.[a-z]{2,}\/\S+/i.test(t) ||
    /\bjoin\s+#\S+/i.test(t)
  );
}

/** Clone violation: more than `limit` connections from one host. */
export function isCloneViolation(sameHostCount: number, cfg: CloneConfig): boolean {
  return cfg.enabled && sameHostCount > cfg.limit;
}

/** Excessive-capitals: % of letters uppercase >= threshold (over min length). */
export function capsHit(text: string, cfg: CapsConfig): boolean {
  if (!cfg.enabled) return false;
  const t = stripMirc(text);
  const letters = t.replace(/[^a-zA-Z]/g, "");
  if (letters.length < cfg.minLength) return false;
  const upper = (t.match(/[A-Z]/g) || []).length;
  return (upper / letters.length) * 100 >= cfg.percent;
}

/** Over-long line. */
export function lengthHit(text: string, cfg: LengthConfig): boolean {
  return cfg.enabled && stripMirc(text).length > cfg.max;
}

/**
 * Anti-trick: detect mIRC crash/exploit payloads and decode-worms. These can't
 * harm our client, but kicking the sender protects other (mIRC) users present.
 */
export function trickHit(text: string): boolean {
  // mIRC identifier/variable injection rarely appears in normal chat
  if (/\$(decode|chr|read|eval|regsub|mid|midi|com|dll|findfile)\s*\(/i.test(text)) return true;
  // $decode-style base64 worm payloads
  if (/\bdecode\b/i.test(text) && /[A-Za-z0-9+/]{40,}={0,2}/.test(text)) return true;
  // control-character / ASCII bomb: high ratio of non-format control bytes
  let ctrl = 0;
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (c < 32 && c !== 9 && c !== 10 && c !== 13) ctrl++;
  }
  if (text.length > 20 && ctrl / text.length > 0.3) return true;
  return false;
}

/** Sliding-window flood detector keyed by an arbitrary string. */
export class FloodTracker {
  private hits = new Map<string, number[]>();

  /** Record an event at `now` (ms); return true if it exceeds limit in window. */
  record(key: string, now: number, limit: number, windowSec: number): boolean {
    const windowMs = windowSec * 1000;
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    arr.push(now);
    this.hits.set(key, arr);
    return arr.length >= limit;
  }

  reset(key: string) {
    this.hits.delete(key);
  }
}

/** Repeated-identical-message detector keyed by an arbitrary string. */
export class RepeatTracker {
  private last = new Map<string, { text: string; count: number }>();

  /** Record a message; return true once the same text repeats >= limit times. */
  record(key: string, text: string, limit: number): boolean {
    const prev = this.last.get(key);
    if (prev && prev.text === text) {
      prev.count++;
      return prev.count >= limit;
    }
    this.last.set(key, { text, count: 1 });
    return false;
  }

  reset(key: string) {
    this.last.delete(key);
  }
}
