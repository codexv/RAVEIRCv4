# mIRC Scripting Reference (for cloning mIRC behavior)

Compiled from the official mIRC help (mirc.com/help), WikiChip mIRC pages, and the
mIRC Knowledge Base. This documents the *exact* semantics RAVE must reproduce.

General notes that apply everywhere:

- Scripts live in the **Remote** section (Alt+R). Events are defined with `on`.
- The whole header is colon-delimited. Whitespace is significant only inside braces.
- `{ }` braces enclose the command block; a single command may follow the last colon
  without braces (`on 1:TEXT:hi:/msg $chan hi`), but braces are the normal form.
- Events are matched **top to bottom**; multiple matching events all fire (unless
  `halt`/`return` stops the current event — it does not stop *other* events; only
  `haltdef` changes mIRC's own default processing).
- Identifiers (`$x`) and variables (`%x`) are **evaluated** before the command runs
  (see Section 3). Inside an event, `$nick`, `$chan`, etc. are filled by mIRC for the
  duration of that event.
- `halt` stops the current script *and* prevents mIRC's default action for the event.
  `haltdef` only prevents mIRC's default action (script keeps running). `return`
  stops the current script only.

---

## 1. The `on` events

### 1.1 The level / prefix field

Every `on` event begins with a **level** field. General form:

```
on <prefix><level>:EVENT: ... :{ commands }
```

The level controls *which users* trigger the event, based on the **user list**
(Addressbook / `/auser`, `/guser`, etc.) and on channel status.

**Numeric levels**

- `on 1:` — triggers for users whose access level is `1`. Levels are integers you
  assign to users (an "internal access level" system). A user matches an event if the
  event's level is **<= the user's level** for the relevant section (text levels,
  ctcp levels, etc., toggled in Options).
- A user can have multiple levels (`/auser 1,5,10 nick`). The event fires if any of
  the user's levels matches.
- Negative level `on -5:` means: do NOT trigger for users at level 5 (an exclusion).

**`*` — any user**

- `on *:` matches *every* user regardless of level (the most common form). Equivalent
  to "level 0 / everyone".

**`@` — only when you are opped**

- `on @1:` or `on @*:` — the event only triggers if **you (mIRC) are a channel
  operator** in the channel where the event happens. Used so protection scripts only
  act when they have the power to. `@` is placed *before* the level.

**`me:` — only your own actions**

- `on me:*:EVENT:` — triggers only when **you** are the one performing the action
  (e.g. `on me:*:JOIN:#` fires when *you* join). Without `me:`, the event fires for
  other users (and sometimes also you, depending on the event).

**`!` — exclude yourself**

- `on !*:TEXT:...` — fires for everyone **except yourself**. (`!` = "not me".)

**`=` — even / exact** and **`&` (regex group)**

- `=` requires an exact level match rather than `<=`.
- A leading `$` in the level enables **regex matchtext** (`on $*:TEXT:/regex/:...`) —
  see matchtext below.

Prefixes can combine, e.g. `on @!*:TEXT:...` = "I'm opped, and not me, any user".

### 1.2 The matchtext field (TEXT/ACTION/NOTICE/CTCP/RAW)

For text-bearing events the second field after the event name is **matchtext**, a
wildcard pattern matched against the message:

- `*` matches any text (any number of characters, including none).
- `text` matches only if the message **equals** `text` (whole-line, case-insensitive).
- `text*` matches lines **starting with** `text`.
- `*text` matches lines **ending with** `text`.
- `*text*` matches `text` **anywhere** in the line.
- `&` matches any single **word** (whitespace-delimited token), e.g. `hi &` matches
  "hi bob". `&` is positional.
- `$*` prefix on the level enables a **regular expression** matchtext, written between
  slashes: `on $*:TEXT:/^!cmd/iS:#:{ }` (modifiers like `i` case-insensitive).
- Matching is **case-insensitive** by default. Use the `cs` comparison family or regex
  flags for case sensitivity.

### 1.3 The channel / target field

The last field before the command block restricts *where* the event applies:

- `#` — any channel.
- `#chan` or `#chan1,#chan2` — only those channels.
- `?` — only private (query) messages.
- `*` — anywhere (channel or private).

### 1.4 Standard event identifiers

- `$nick` — nickname of the user who caused the event.
- `$address` / `$fulladdress` — the user's `nick!user@host`.
- `$chan` — the channel the event occurred on (empty in pure private events).
- `$target` — the destination of the message: the channel for channel msgs, your own
  nick (or the sender) for private msgs. Useful when an event can be channel OR query.
- `$1`, `$2`, `$1-`, `$2-` — the message split into tokens. `$1-` is the **entire
  message text**; `$2-` is everything from word 2 on; `$N` is the Nth word.
- `$me` — your own current nickname.

### 1.5 Event-by-event reference

Below, only the distinctive header and the special identifiers are listed; the
standard ones from 1.4 apply throughout.

**on TEXT** — channel or private message received.
```
on <level>:TEXT:<matchtext>:<#|?|*|#chan>:{ commands }
```
`$nick` = sender, `$chan` = channel (if any), `$target` = channel or your nick,
`$1-` = the message. Does **not** trigger on your own messages (use `on INPUT` for that).

**on ACTION** — `/me`-style action message (CTCP ACTION).
```
on <level>:ACTION:<matchtext>:<#|?|*>:{ commands }
```
Same identifiers as TEXT; `$1-` is the action text.

**on NOTICE** — a NOTICE received.
```
on <level>:NOTICE:<matchtext>:<#|?|*>:{ commands }
```
`$nick` = sender, `$target` = where it was sent, `$1-` = notice text. Server notices
without a nick arrive via `on SNOTICE`.

**on JOIN** — a user joins a channel you're on.
```
on <level>:JOIN:<#[,#]>:{ commands }
```
`$nick` = the joiner, `$chan` = channel. Use `on me:*:JOIN:#` for your own joins.

**on PART** — a user leaves a channel.
```
on <level>:PART:<#[,#]>:{ commands }
```
`$nick` = the leaver, `$chan` = channel, `$1-` = part message (if any).

**on QUIT** — a user (sharing a channel with you) quits IRC.
```
on <level>:QUIT:{ commands }
```
No channel field — quits are global. `$nick` = quitter, `$1-` = quit message.
Use `$comchan($nick,0)` to find shared channels.

**on NICK** — a user (you can see) changes nick.
```
on <level>:NICK:{ commands }
```
No channel field. `$nick` = old nick, `$newnick` = new nick.

**on KICK** — a user is kicked from a channel.
```
on <level>:KICK:<#[,#]>:{ commands }
```
`$nick` = the kicker, `$knick` = the kicked user, `$chan` = channel,
`$1-` = kick reason. Use `on me:*:KICK:#` to detect being kicked yourself; many
scripts test `if ($knick == $me)`.

**on MODE** — a **user** changes a **channel** mode (the generic catch-all).
```
on <level>:MODE:<#[,#]>:{ commands }
```
`$nick` = who set the mode, `$chan` = channel, `$1-` = the raw mode change
(e.g. `+o-v nick1 nick2`). Triggers only for channel modes, and only for changes
not already handled by the dedicated op/voice/ban events combination — practically,
MODE fires for *every* user-set channel mode change in one event.

**on OP** — a user is given operator status (`+o`).
```
on <level>:OP:<#[,#]>:{ commands }
```
`$nick` = the user who **set** `+o`, `$opnick` = the user who **got** opped,
`$chan` = channel. Common: `if ($opnick == $me) ...`.

**on DEOP** — operator status removed (`-o`).
```
on <level>:DEOP:<#[,#]>:{ commands }
```
`$nick` = who set `-o`, `$opnick` = who was deopped, `$chan` = channel.

**on VOICE** — voice given (`+v`).
```
on <level>:VOICE:<#[,#]>:{ commands }
```
`$nick` = who set `+v`, `$vnick` = who got voiced, `$chan` = channel.

**on DEVOICE** — voice removed (`-v`).
```
on <level>:DEVOICE:<#[,#]>:{ commands }
```
`$nick` = who set `-v`, `$vnick` = who was devoiced, `$chan` = channel.

**on SERVERMODE** — a **server** (not a user) changes a channel mode.
```
on <level>:SERVERMODE:<#[,#]>:{ commands }
```
`$nick` = the server name, `$chan` = channel, `$1-` = the mode string. Use this to
distinguish server-initiated mode changes from user ones (which fire `on MODE`). The
op/deop/voice/ban events fire for **both** user and server changes; SERVERMODE/MODE
split the generic mode notification by source.

**on BAN** — a ban is set (`+b`).
```
on <level>:BAN:<#[,#]>:{ commands }
```
`$nick` = who set the ban, `$banmask` = the ban mask (a wildcard address string),
`$bnick` = a matching nick if mIRC can resolve one (NOT always filled — many masks
don't map to a present nick), `$chan` = channel. Common protection test:
`if ($banmask iswm $address($me,5)) ...`.

**on UNBAN** — a ban is removed (`-b`).
```
on <level>:UNBAN:<#[,#]>:{ commands }
```
`$nick` = who removed it, `$banmask` = the removed mask, `$bnick` if resolvable,
`$chan` = channel.

**on TOPIC** — channel topic changed.
```
on <level>:TOPIC:<#[,#]>:{ commands }
```
`$nick` = who changed it, `$chan` = channel, `$1-` = the new topic text.

**on INVITE** — you are invited to a channel.
```
on <level>:INVITE:<#[,#]>:{ commands }
```
`$nick` = inviter, `$chan` = the channel you were invited to.

**on CONNECT** — fires after you connect AND complete server login (registration),
i.e. once you can send commands.
```
on <level>:CONNECT:{ commands }
```
No special identifiers; `$network`, `$server`, `$me` are valid. Use for auto-join,
identifying to services, etc.

**on DISCONNECT** — fires when a server connection is lost/closed.
```
on <level>:DISCONNECT:{ commands }
```
(`on CONNECTFAIL` exists for failed connection attempts.)

**on START** — fires once when mIRC itself starts up (before scripts run events).
```
on <level>:START:{ commands }
```
Use for global init. (`on EXIT` runs at shutdown.)

**on LOAD** — fires **once**, the moment a script file is first loaded into Remote.
```
on <level>:LOAD:{ commands }
```
Use for one-time setup (creating variables/hash tables). Does not run on subsequent
mIRC restarts — only on the initial load of the file.

**on UNLOAD** — fires when the script file is unloaded/removed.
```
on <level>:UNLOAD:{ commands }
```
Use for cleanup (freeing hash tables, deleting timers).

**on INPUT** — fires when **you type a line** into the editbox of a window (before it
is sent).
```
on <level>:INPUT:<#|?|*|@window>:{ commands }
```
`$1-` = the text you typed, `$target`/`$chan` = the active window's target,
`$active` = active window name. `halt` cancels sending; commands (lines starting `/`)
do **not** trigger INPUT unless they fail to be recognized — plain text and unknown
commands do.

**on OPEN** — fires when a new query/channel/custom window or fileserver/DCC etc. is
about to open.
```
on <level>:OPEN:<?|@|=|!|*>:<matchtext>:{ commands }
```
The third field selects window type: `?` = query, `@` = custom window, `=` = DCC chat,
`!` = a query opened by **you**. `$nick` = the other party, `$1-` = first message (for
queries). `halt` prevents the window opening.

**on CLOSE** — fires when such a window is closed.
```
on <level>:CLOSE:<?|@|=|!|*>:<matchtext>:{ commands }
```
Same window-type field as OPEN. `$target`/`$nick` identify what closed.

**on ACTIVE** — fires when a window becomes the **active** window.
```
on <level>:ACTIVE:<#|?|*|@window>:{ commands }
```
`$active` = the newly active window name; `$chan`/`$target` for channel/query windows.

**on SNOTICE** — a **server notice** (a NOTICE from the server, no user nick).
```
on <level>:SNOTICE:<matchtext>:{ commands }
```
`$1-` = the notice text. (No channel/target field — these are connection-wide.)

**on WALLOPS** — a WALLOPS message received.
```
on <level>:WALLOPS:<matchtext>:{ commands }
```
`$nick` = sender, `$1-` = the wallops text.

**on RAWMODE** — like `on MODE` but exposes **every individual mode change** without
mIRC interpreting it, letting a script parse modes directly.
```
on <level>:RAWMODE:<#[,#]>:{ commands }
```
`$nick` = setter, `$chan` = channel, `$1-` = the full raw mode string
(e.g. `+ovb nick1 nick2 *!*@host`). Use this to intercept/parse modes yourself and
suppress mIRC's own op/ban/etc. echoes (`haltdef`).

**on USERMODE** — fires when **your own user modes** change (e.g. `+i`, `+x`).
```
on <level>:USERMODE:{ commands }
```
`$1-` = the user-mode change string. Distinct from channel MODE/RAWMODE.

**on ERROR** — fires when the server sends an `ERROR` message (often right before a
disconnect).
```
on <level>:ERROR:<matchtext>:{ commands }
```
`$1-` = the error text.

**on PING** — fires when the server PINGs you. mIRC auto-replies with PONG; use this
only to observe.
```
on <level>:PING:{ commands }
```
(There is also `on PONG`.)

**on NICKLIST** — fires when you double-click / select an entry in the channel
**nicklist** (a UI event, not a network event).
```
on <level>:NICKLIST:{ commands }
```
`$nick` = the nick you selected, `$chan` = the channel, `$snick($chan,N)` enumerates
the currently selected nicks.

---

## 2. `raw` and `ctcp` events

### 2.1 raw numeric / token events

```
raw <numeric|token>:<matchtext>:{ commands }
```

- Triggers on **raw server messages**. `<numeric>` is a server reply code
  (e.g. `001`, `322`, `353`, `366`, `433`) or a wildcard like `*`, or a named token
  (e.g. `raw PROP:...` for non-numeric server commands).
- `<matchtext>` is a wildcard matched against the message text after the numeric.
- `$numeric` = the numeric code that fired. `$1-` = the message parameters (the part
  the server sent after the numeric and your nick). For numerics, `$2` is typically the
  first real parameter since `$1` is often your own nick.
- A level field is allowed: `raw 1:...` / `raw *:...` (use `*` normally).
- Use **`halt`** to stop mIRC from printing/processing its **default** output for that
  numeric (e.g. suppress the default WHOIS or NAMES display while you handle it
  yourself). Because servers send many raws, keep `raw *:*` handlers cheap.
- Debug pattern: `raw *:*:{ echo -s $numeric $1- }` echoes every raw to Status.

Examples of common numerics: `001` welcome (connection registered), `353` NAMES list,
`366` end of NAMES, `322`/`323` LIST, `332` topic, `433` nick in use, `352`/`315` WHO.

### 2.2 ctcp events

```
ctcp <level>:<matchtext>:<*|#|?>:{ commands }
```

- Triggers when a **CTCP** request is received (PING, VERSION, TIME, FINGER, USERINFO,
  CLIENTINFO, or custom). `<matchtext>` matches the CTCP command + args
  (e.g. `PING`, `VERSION`, `SOUND *`).
- `<*|#|?>` is the target filter: `*` any, `#` channel CTCP, `?` private CTCP.
- `$nick` = sender, `$target` = where it was sent, `$1` = the CTCP type
  (e.g. `VERSION`), `$1-` = full CTCP text, `$2-` = arguments.
- Reply with `/ctcpreply $nick TYPE text`.
- Default handling: mIRC auto-answers many CTCPs. You **cannot** suppress the standard
  **VERSION** reply, but you can `halt` to override others (e.g. custom PING/TIME).
- ACTION (`/me`) is technically a CTCP but is surfaced via `on ACTION`, not `ctcp`.

---

## 3. Evaluation rules

mIRC evaluates a command line **left to right, one space-delimited token at a time**,
substituting identifiers and variables **once** as it goes, then runs the resulting
command. Understanding this single-pass model is essential.

### 3.1 Identifiers and variables

- `$identifier` and `$identifier(params)` are replaced by their value.
- `%var` global variables and local variables (see 3.5) are replaced by their value.
- Substitution happens **before** the command executes; the command never sees the
  literal `$x`/`%x`, only the result.
- Identifiers can nest as parameters: `$left($nick,3)` — inner ones evaluate first when
  used as parameters.

### 3.2 The `$+` operator (concatenation)

mIRC inserts a space between tokens. `$+` joins adjacent tokens with **no space**:

```
//echo -a chan $+ nel        ->  channel
//echo -a # $+ key           ->  #key  (e.g. #mirc $+ stuff)
//msg $chan Hi $+ $nick      ->  HiBob
```

`$+` evaluates the tokens on each side and glues the results together. It is the
canonical way to build strings/identifiers dynamically.

### 3.3 `[ ]` evaluation brackets

Brackets force an **extra evaluation pass** on their contents and can reorder
evaluation. Normally a line is evaluated once; bracketed content is evaluated again:

- `[ %var ]` is equivalent to `$eval(%var,1)` — one extra evaluation.
- `[ [ %var ] ]` is equivalent to `$eval(%var,2)` — two extra evaluations
  (evaluate, then evaluate the result again).
- This lets you treat the *contents* of a variable as code/identifiers.

Example — `%x` holds the string `$nick`:
```
//set %x $nick                  ; %x literally contains the text "$nick"
//echo -a %x                    ; -> Bob   (normal single pass already resolves it once here)
```
The brackets matter when you need a value to be re-interpreted after the first pass.

### 3.4 `$+` inside brackets and dynamic variables

A `$+` at the **start** of an evaluation bracket group makes the *zero-eval / join*
behavior propagate to the other tokens in that group. The classic idiom builds a
variable name from another value and then reads it:

```
%score. [ $+ [ $nick ] ]
```

Step by step: `$nick` evaluates to e.g. `Bob`; the inner `[ ]` and `$+` glue it to the
prefix giving the variable name `%score.Bob`; the outer `[ ]` then evaluates *that
name* to its stored value. So `%score. [ $+ [ $nick ] ]` reads the variable
`%score.Bob`. To write it:

```
/set %score. [ $+ [ $nick ] ] 100      ; sets %score.Bob = 100
/inc %score. [ $+ [ $nick ] ]          ; increments %score.Bob
```

This is mIRC's idiom for associative/per-user storage in plain variables (hash tables,
Section 5, are the cleaner alternative).

### 3.5 `%var` global vs `/var` local scope

- `/set %name value` and `/var -g %name value` create/modify a **global** variable
  (persists, optionally saved to `mirc.ini` / `vars.ini`).
- `/var %name value` creates a **local** variable, scoped to the **current
  alias/event invocation** only; it vanishes when the routine returns. `/var` may
  declare several: `/var %a = 1, %b = 2`.
- `/set` supports timed unset: `/set -u10 %x 1` unsets after 10 seconds; `/inc`/`/dec`
  do arithmetic; `/unset %x` removes it.
- Reading is the same syntax (`%name`) regardless of scope; local shadows global within
  the routine.

### 3.6 `$eval`

`$eval(string,N)` evaluates `string` `N` additional times:

- `$eval(%x,0)` — return `%x` *without* evaluating (treat as literal text).
- `$eval(%x,1)` — evaluate once (equivalent to `[ %x ]`).
- `$eval(%x,2)` — evaluate twice (equivalent to `[ [ %x ] ]`).

`$eval(...,0)` is the safe way to pass identifier text around without premature
substitution (e.g. when storing code in a variable).

### 3.7 `/cmd` vs `//cmd` in the editbox

This distinction applies **only to lines typed into / sent through the editbox** (and
`on INPUT`):

- A single `/` (`/command ...`) runs the command **without** evaluating
  identifiers/variables in it. Typing `/echo -a $me` prints the literal `$me`.
- A double `//` (`//command ...`) tells mIRC to **evaluate** the line first, then run
  it. `//echo -a $me` prints your nick.

Inside aliases and remote scripts, lines are *always* evaluated, so you use a single
`/` there (and the `//` form is an editbox-only convenience). This is why tutorials say
"use `//` to test identifiers from the editbox".

---

## 4. Control flow

All of the following are valid inside `{ }` blocks in aliases and events. Statements
are separated by newlines or by `|`.

### 4.1 if / elseif / else

```
if (<condition>) { commands }
elseif (<condition>) { commands }
else { commands }
```
- Parentheses around the condition are required. Braces may be omitted for a single
  command but are recommended.
- Conditions use comparison operators (4.5) and `&&` / `||` (4.6).
- `$iif(<cond>,<true>,<false>)` is the inline (identifier) form.

### 4.2 while

```
while (<condition>) { commands }
```
Loops while the condition is true. Combine with a counter variable and `/inc` to
iterate. `break` exits; `continue` jumps to the next iteration.

### 4.3 goto / labels

```
:label
... 
goto label
```
Labels are lines beginning with `:`. `goto <name>` jumps to `:name`. Often used with a
counter and a `:start` / `:end` pattern (legacy style; `while` is preferred).
`$gettok`/`while` loops have largely replaced `goto`.

### 4.4 break / continue / return / halt

- `break` — exit the nearest `while` loop immediately.
- `continue` — skip to the next iteration of the nearest `while` loop.
- `return [value]` — stop the current alias/event; in an alias, sets `$result` /
  the identifier's return value.
- `halt` — stop the script **and** suppress mIRC's default action for the event.
- `haltdef` — suppress only mIRC's default action; the script continues.

### 4.5 Comparison operators

Used inside `if (...)`:

- `==` equal (case-insensitive for text), `!=` not equal.
- `<` `>` `<=` `>=` numeric comparison.
- `// ` and `\\` test divisibility: `if (4 // 2)` true if first is divisible by second;
  `\\` true if NOT divisible.
- `isin` — left string is contained in right string (`if (foo isin foobar)`).
- `iswm` — left **wildcard** pattern matches right string (`if (*foo* iswm myfoobar)`).
- Case-sensitive variants: `isincs`, `iswmcs`.
- `isnum` — operand is a number; `isnum N1-N2` checks it is a number in range.
- `isletter` — operand consists of letters; `isletter abc def` checks each char of the
  first operand is in the set given by the second.
- `ison` — `if ($nick ison #chan)` true if nick is on that channel.
- `isop` / `ishop` / `isvoice` / `isreg` — `if ($nick isop #chan)` tests channel
  status (op / half-op / voice / regular).
- `isban` — `if (mask isban #chan)` tests the channel ban list.
- Negate any of these with `!`: `if (foo !isin bar)`.

### 4.6 `&&` and `||`

- `&&` logical AND, `||` logical OR, evaluated left to right.
- `if (%a == 1 && %b == 2) { }`
- `if ($nick == bob || $nick == joe) { }`
- Group with parentheses: `if ((%a || %b) && %c) { }`.

---

## 5. Hash tables and timers

### 5.1 Hash tables

Hash tables are fast in-memory key→value stores (optionally with a numeric "data"
field per item). Items are addressed by name; lookups are O(1)-ish.

- `/hmake <name> [N]` — create a hash table with N buckets (default 100). Bucket count
  is a hint, not a size limit.
- `/hadd [-mubcz...] <name> <item> [value]` — add/replace an item.
  - `-m` create the table if it doesn't exist (with default buckets).
  - `-u<N>` unset this item after N seconds.
  - `-b` binary, `-z` decrement value each second, etc.
- `/hdel <name> <item>` — remove an item (`-w` for wildcard item match).
- `/hfree [-sw] <name>` — destroy the whole table (`-w` wildcard table name,
  `-s` show action).
- `$hget(<name>,<item>)` — return the value for `item`.
- `$hget(<name>,<N>).item` / `.data` — return the Nth item's name / value
  (iteration). `$hget(<name>,0).item` (or just `$hget(name,0)`) returns the **count**.
- `$hget(<name>)` — true/table reference if the table exists.
- `/hinc` / `/hdec` — arithmetic on an item's value (create with `-m`).
- `/hsave [-o...] <name> <file>` and `/hload <name> <file>` — persist to / load from
  disk (hash tables are otherwise **memory-only** and lost on exit). Create tables in
  `on START` / `on LOAD` and `/hload` them; `/hsave` in `on EXIT` / `on UNLOAD`.

Hash tables are the recommended replacement for the dynamic-variable idiom in 3.4.

### 5.2 Timers

```
/timer[name] [-options] <repetitions> <interval> <command>
```

- `<repetitions>` — how many times to fire; `0` = repeat **forever**.
- `<interval>` — delay in **seconds** between fires (use `-m` for milliseconds).
- `<command>` — the command run each time; identifiers in it are evaluated **when the
  timer fires** unless you protect them (use `$eval(...,0)` / `$!identifier` to defer,
  or `$+` to force immediate evaluation at creation time — `$!nick` defers, `$nick`
  with brackets resolves now).
- Naming: `/timer1`, `/timerFlood`, etc. Reusing a name **replaces** that timer. An
  unnamed `/timer` gets the next free numeric id.
- `/timername off` — cancel that timer. `/timers off` — cancel all. `/timers` lists.
- Options: `-m` ms interval, `-o` make it survive disconnect, `-h`/`-s` hi-res, `-i`
  run only if connected, `-e` run even when offline, `-c` catch-up.
- The timer command runs in a fresh context — local `/var`s from the creating routine
  are **not** available; pass values via `$+`/`$eval` at creation, or via globals/hash
  tables.

Example:
```
/timerGreet 1 5 msg $chan Hello!        ; once, after 5s, "$chan" resolved at fire time
/timerGreet 1 5 msg $!chan Hello!       ; $!chan defers; resolved when timer fires
/timerNag 0 60 notice $me still here    ; every 60s forever
/timerGreet off                         ; cancel
```
