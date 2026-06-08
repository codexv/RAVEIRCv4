# Network Services Reference (verified 2026)

Drives `src/lib/irc/network.ts`. Researched from official docs (docs.dal.net,
undernet.org/cservice, atheme.dev + libera.chat).

## DALnet — ChanServ/NickServ/MemoServ @services.dal.net
- Named access lists (NOT numeric levels): **VOP < HOP < AOP < SOP < MANAGER < FOUNDER**.
- Ops: `ChanServ OP|DEOP|VOICE|DEVOICE|HALFOP|DEHALFOP #chan nick`
- Self: `ChanServ INVITE #chan`, `ChanServ UNBAN #chan [nick|*|mask]`
- Anti-takeover: `ChanServ MDEOP #chan`, `ChanServ MKICK #chan`
- Access list (each): `ChanServ {VOP|HOP|AOP|SOP|MANAGER} #chan add|del|list|wipe [nick] [reason]`
- AKICK: `ChanServ AKICK #chan add|del|list|wipe [mask] [reason]`
- SET: `ChanServ SET #chan {mlock <modes>|topiclock founder|sop|manager|off|keeptopic on|off|opguard on|off|restrict on|off|...}`
- Info: `ChanServ INFO #chan`, `ChanServ WHY #chan nick`, `ChanServ ACCESS #chan [nick]`, `LISTOPS`, `COUNT`
- NickServ: `IDENTIFY [nick] pass` · `REGISTER pass email` (email now required) · `GHOST nick [pass]` · `RECOVER nick [pass]` · `RELEASE nick [pass]` · `INFO nick`
- MemoServ: `SEND nick msg` · `LIST` · `READ n|NEW` · `DEL n|all`
- Notes: no GROUP/LINK; no numeric LEVELS; SET ENFORCE removed (always on).

## Undernet — X bot @channels.undernet.org (NO NickServ)
- Auth is to a **CService web username**, not a nick. One LOGIN loads access for all channels.
- Login: `X LOGIN <user> <pass> [TOTP]`. Auto = Login-on-Connect via server PASS field: `+x! <user> <pass> [TOTP]`.
- Ops: `X OP|DEOP|VOICE|DEVOICE #chan [nick...]` · `X INVITE #chan` · `X TOPIC #chan <text>` · `X MODE #chan <modes>`
- Access (numeric 1–500): `X ACCESS #chan [*|=nick|user]` · `X ADDUSER #chan <user> <level>` · `X REMUSER #chan <user>` · `X MODINFO #chan access|automode <user> <val>`
- Bans (persistent): `X BAN #chan <nick|*!*user@host> [hours] [level] [reason]` · `X UNBAN #chan <mask>` · `X BANLIST #chan`
- Levels: 500 owner · 450 admin/SET · 400 userlist admin · 100 op · 50 halfop/topic · 25 voice · 1 user.
- Info: `X INFO <user>` · `X CHANINFO #chan`

## Libera.Chat — atheme ChanServ/NickServ/MemoServ
- **Only op (+o) and voice (+v) exist** (PREFIX=(ov)@+). No halfop/protect/owner.
- Ops: `ChanServ OP|DEOP|VOICE|DEVOICE #chan [nick]`
- Access = **FLAGS model**: `ChanServ FLAGS #chan [target] [+/-flags|template]`. Flags: `+o/+O` op, `+v/+V` voice, `+t` topic, `+r` kick/ban, `+f` edit flags, `+F` founder, `+b` autokickban, `+e` exempt, `+*` all-but-ban/founder.
- Role wrapper: `ChanServ ACCESS #chan ADD|DEL|SET|LIST|INFO <user> [role]`; templates via `ChanServ TEMPLATE #chan [name] [+/-flags]`.
- AKICK: `ChanServ AKICK #chan ADD|DEL|LIST <mask> [!P|!T <mins>] [reason]`
- SET: `ChanServ SET #chan {GUARD|KEEPTOPIC|TOPICLOCK|SECURE|RESTRICTED|MLOCK <modes>|...} <val>`
- Other: `ChanServ INVITE|UNBAN|RECOVER|INFO|WHY #chan`
- NickServ: `IDENTIFY [acct] pass` · `REGISTER pass email` · `GHOST nick [pass]` · `RELEASE nick [pass]` · `REGAIN nick [pass]` · `GROUP` · `CERT ADD|DEL|LIST` (CertFP/SASL EXTERNAL)
- MemoServ: `SEND nick|#chan msg` · `LIST` · `READ n` · `DEL n|ALL`

## Client guidance
Gate which status commands you expose on the live `PREFIX=`/`CHANMODES=` ISUPPORT
tokens, and prefer `/msg <Service> HELP` to confirm per-network specifics.
