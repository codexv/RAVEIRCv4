# mIRC Scripting Command Reference

A precise reference of mIRC `/commands` for cloning mIRC's behavior in an IRC client.
Sourced from the official mIRC help (mirc.com/help), WikiChip (en.wikichip.org/wiki/mirc),
and mIRC-Scripters knowledge base.

Notation:
- `<x>` = required argument, `[x]` = optional argument, `|` = alternatives.
- `[N]` after a switch (e.g. `-e[N]`) means an optional numeric suffix attached to the switch letter.
- Channels begin with `#`. Many channel commands default to the active channel if `#channel` is omitted.

---

## Evaluation & Quoting Rules (read first)

mIRC commands are parsed and **evaluated** before execution. Cloning these rules correctly is essential.

1. **Identifiers / variables are evaluated.** `$me`, `%var`, `$nick`, `$1-`, etc. are replaced with
   their values before the command runs. Evaluation happens once per pass unless `[ ... ]` forces re-evaluation.
2. **`$+`** concatenates tokens with no space: `echo -a a $+ b` -> `ab`.
3. **Brackets `[ ]`** force an extra evaluation pass on their contents (used for dynamic identifier/variable
   names), e.g. `%var [ $+ [ %i ] ]`.
4. **Curly braces `{ }`** group multiple commands into a block (used by `if`, `while`, aliases, events).
   `|` separates commands on a single line.
5. **`$chr(32)`** is a literal space; mIRC strips leading/trailing spaces from most arguments, so
   `$chr(32)` (or the `-p` switch on `/set`/`/var`) is used to preserve them.
6. **`%` semicolon comments**: a line beginning with `;` (in a script file) is a comment.
7. **`$show`** / the `.` prefix: prefixing a command with a period (`.msg`, `.timer`) suppresses its
   default echo/output where supported (sets `$show` to `$false`).
8. **The final/last parameter** of message-type commands (`/msg`, `/notice`, `/me`, etc.) is treated as
   free-form text and is **not** split on spaces.
9. **`$&`** at end of a line continues the command on the next line (line continuation in script files).

---

## Action & Message Commands

### /me
```
/me <action text>
```
Sends a CTCP ACTION to the active channel or query window. Displayed as `* yournick action text`.
Only valid in a channel or query window (uses the active window's target). No switches.

### /describe
```
/describe <#channel|nick> <action text>
```
Like `/me` but lets you specify the target explicitly, so it can be used from any window. Sends a
CTCP ACTION to the given channel or nick.

### /msg
```
/msg [-cdimnstABCD] <nick|#channel|=dccnick> <message>
```
Sends a private message to a nick or channel **without** opening/focusing a query window.
Switches (control how the sent message is *echoed* locally / handled):
- `-c` color the message
- `-d` echo to the single message window
- `-i` echo only if a query/channel window for the target already exists
- `-m` indicate it's a user message (highlights switchbar/treebar button with message color)
- `-n` do not change the switchbar/treebar button color
- `-s` echo to the status window
- `-t` apply timestamp
Note: `=dccnick` form sends over a DCC chat connection. `.msg` (period prefix) suppresses local echo.

### /amsg
```
/amsg [-s] <message>
```
Sends `<message>` to **all** open channel windows. `-s` also echoes a copy to the status window.
(Use with care; many networks rate-limit.)

### /ame
```
/ame [-s] <action text>
```
Sends an action (`/me`) to **all** open channel windows. `-s` also echoes to the status window.

### /notice
```
/notice [-cdimnst] <nick|#channel> <message>
```
Sends an IRC NOTICE to the target. Same echo/handling switches as `/msg`
(`-c -d -i -m -n -s -t`). NOTICEs do not open query windows by convention.

### /onotice
```
/onotice [#channel] <message>
```
Sends a NOTICE to all channel operators (ops) on the channel (uses the `@#channel` op-prefix target).
Defaults to the active channel if `#channel` omitted. You must be on the channel.

### /omsg
```
/omsg [#channel] <message>
```
Sends a PRIVMSG to all channel operators on the channel (`@#channel` target). Defaults to active channel.

### /say
```
/say <message>
```
Sends `<message>` as a normal message to the active channel or query window (equivalent to typing the
text directly in the editbox, but usable from inside scripts/aliases). No switches.

### /ctcp
```
/ctcp <nick|#channel> <ctcp-command> [parameters]
```
Sends a CTCP request to a nick or channel, e.g. `/ctcp nick PING`, `/ctcp nick VERSION`,
`/ctcp nick TIME`, `/ctcp nick ACTION text`. Wrapped in `\x01...\x01`.

### /ctcpreply
```
/ctcpreply <nick> <ctcp-command> [message]
```
Sends a CTCP **reply** (delivered as a NOTICE, wrapped in `\x01`) to a nick. Used when answering an
incoming CTCP, e.g. `/ctcpreply $nick VERSION RAVE client`.

---

## Local Output Command

### /echo
```
/echo [color] [-aceglimnrstbfdhi(N)qtz] <#channel|nick|@window|status> <text>
```
Prints `<text>` **locally only** (nothing is sent to the server) to a target window.
The first non-switch token is normally the target window; with `-c` the first following token is a
color name. Switches:
- `-a` print to the **active** window
- `-s` print to the **status** window
- `-d` print to the **single message** window
- `-t` add a **timestamp** (only if timestamping is enabled for that window)
- `-e` enclose text with a pair of **line separators** (above and below)
- `-c <colorname>` use the named color (`-c` flags that the first following param is the color name)
- `-g` do not log this line even if the window has logging on
- `-i[N]` indent wrapped lines by N characters (default mIRC indent if N omitted)
- `-l` apply the **highlight** settings to the text
- `-m` treat line as a user **message** (colors switchbar/treebar button with the Message color)
- `-n` do **not** change the switchbar/treebar button color
- `-r` apply the **strip** settings (strip control codes per Options) to the text
- `-h` apply a **hard-wrap** so the wrap point doesn't change when the window is resized
- `-b` apply window **beep** settings
- `-f` apply window **flash** settings
- `-q` honor `$show` (display nothing if the alias was called with the `.` prefix)
- `-z` buffer-related (`-z[0|1]`) controls keeping the line in the buffer when scrollback is involved
Color value: an integer mIRC color index (0-15+) may precede the target instead of `-c name`.

---

## Script Control Flow Commands

### /halt
```
/halt
```
Stops the current script **and** prevents mIRC's default processing of the event/command that
triggered it (e.g. in an `on TEXT` event, `/halt` suppresses the default display of the line).

### /haltdef
```
/haltdef
```
Halts only mIRC's **default** processing of the event but lets the rest of your script continue.
(`/halt` stops both; `/haltdef` stops only the default behavior.)

### /return
```
/return [value]
```
Stops the current alias/script and optionally returns `[value]` to the caller, available via `$result`
in the calling scope. With no value it simply exits the current routine.

---

## Variables Commands

### /set
```
/set [-aglsuNzNiekpn] <%var> [value]
```
Creates or changes a **global** variable (persists, saved to vars.ini unless local/temporary).
Switches:
- `-l` create a **local** variable (scope of current alias/event) instead of global
- `-g` operate on the **global** variable (when same-named local exists)
- `-s` **show**/debug: echo the set operation to the active window
- `-u[N]` **unset** the variable after N seconds
- `-z[N]` countdown variable: decremented by 1 each second until it reaches 0, then unset (value must be numeric)
- `-i` only set **if** the variable does not already exist (initialize)
- `-e` unset the variable when mIRC **exits**
- `-k` **keep** the existing `-u` unset timer from a previous set (don't reset the countdown)
- `-p` **permit** quoting: allow value to be two literal double-quotes and preserve a single trailing space
- `-n` force the value to be treated as a literal **number/text** (do not evaluate as an identifier)
- `-a` add/append form used with numeric ops in some versions (treat as arithmetic add)

### /unset
```
/unset [-s] <%var> [%var2 ...]
```
Removes one or more variables. Wildcards allowed (e.g. `/unset %foo.*` unsets all matching).
`-s` shows/debug-echoes the operation. `-g`/`-l` may target global vs local explicitly.

### /inc
```
/inc [-cuNsglz] <%var> [value]
```
Increases a numeric variable by `[value]` (default 1). If the variable doesn't exist it's created.
Shares the variable switches: `-u[N]` unset after N secs, `-s` show, `-g` global, `-l` local,
`-c` continuous, `-z` countdown.

### /dec
```
/dec [-cuNsglz] <%var> [value]
```
Decreases a numeric variable by `[value]` (default 1). Same switches as `/inc`.

### /var
```
/var [-glspun(N)] <%var> [= value] [, %var2 [= value2] ...]
```
Declares one or more **local** variables in the current alias/event (preferred over `/set -l`).
Multiple declarations are comma-separated; each may take an optional `= value`. Switches mirror
`/set`: `-g` global, `-l` local (default), `-s` show, `-p` permit literal quotes/trailing space,
`-u[N]` unset after N seconds, `-n` treat value literally.

---

## Hash Table Commands

### /hmake
```
/hmake [-s] <name> [slots]
```
Creates a hash table `<name>` with an optional number of `[slots]` (buckets; default 100 in mIRC).
`-s` shows confirmation. Required before `/hadd`.

### /hfree
```
/hfree [-sw] <name>
```
Frees (deletes) a hash table from memory. `-w` allows a wildcard `<name>` to free multiple tables.
`-s` shows confirmation.

### /hadd
```
/hadd [-msuNzNbcN] <name> <item> [value]
```
Adds or updates an `<item>` -> `[value]` pair in hash table `<name>`.
Switches:
- `-m[N]` create the table first if it doesn't exist (with optional N slots)
- `-u[N]` remove this item after N seconds
- `-z[N]` countdown: decrement value by 1 each second until 0 then remove item (numeric value)
- `-s` show confirmation
- `-b` / `-cN` binary-data handling forms (store/handle a `&binvar`, with length N)

### /hdel
```
/hdel [-sw] <name> <item>
```
Removes `<item>` from hash table `<name>`. `-w` treats `<item>` as a wildcard (remove all matches).
`-s` shows confirmation.

### /hsave
```
/hsave [-abinosu] <name> <filename> [section]
```
Saves a hash table to a file. Switches:
- `-a` append to the file instead of overwriting
- `-b` save in binary mode
- `-i` save in INI-file format (use `[section]`)
- `-n` save items that contain binary/data as plain text where possible
- `-o` overwrite (default for ini section)
- `-s` show confirmation
- `-u` save unset/all items

### /hload
```
/hload [-abinsm(N)] <name> <filename> [section]
```
Loads data from a file into hash table `<name>`. Switches parallel `/hsave`:
- `-a` append (don't clear existing items first)
- `-b` binary mode
- `-i` read from INI format (`[section]`)
- `-n` treat as plain text
- `-m[N]` make the table first if it doesn't exist (N slots)
- `-s` show confirmation

---

## Timer Commands

### /timer
```
/timer[N|name] [-cdeghimopr] [time] <repetitions> <interval> <command>
```
Activates a timer that runs `<command>` after `<interval>` units, repeated `<repetitions>` times.
- `[N|name]` — optional identifier. `/timer5 ...` or `/timerMyName ...`. If omitted, mIRC assigns the
  lowest unused number. Reusing an existing id replaces that timer.
- `<repetitions>` — how many times to fire; **`0` = repeat forever**.
- `<interval>` — delay between fires. Seconds by default (milliseconds with `-m`).
- `[time]` — used with `-t`/at-a-clock-time forms to fire at a specific time of day (`HH:MM:SS`).

Management forms:
- `/timer[N|name] off` — turn off a specific timer.
- `/timers off` — turn off **all** timers.
- `/timers` — list active timers.

Switches:
- `-m` interval is in **milliseconds** instead of seconds
- `-h` use a **high-resolution** multimedia timer (more accurate sub-second timing; heavy on resources)
- `-o` **offline** timer: runs whether or not you are connected to a server
- `-e` **execute** now: immediately run the command of the named (or wildcard) timer
- `-c` use the **catch-up** behavior (compensate if intervals were missed)
- `-d` allow the timer to keep running even if its triggering window/connection closes (detached)
- `-i` ignore-related / internal flag (run even when mIRC is idle-suspending timers)
- `-p` pause the timer
- `-r` resume the timer
- `-g` only trigger while the relevant connection is active
Related identifier: `$timer(N|name)` and its properties (`.secs`, `.reps`, `.com`, `.type`, etc.).

---

## Window / Line Manipulation Commands

### /window
```
/window [-abcdDeEfghiklmnoprstuvwxz(N)] <@name|#channel> [x y w h] [font [size]]
```
Creates a custom `@window` (or picture window) or manipulates an existing custom/channel window.
Key switches (full set varies by mIRC version):
- `-a` make/activate as the active window
- `-b` enable the listbox display columns / sort buttons
- `-c` close the window
- `-d` create as a separate **desktop** window (own taskbar button) instead of an MDI window
- `-D` enable the system-menu toggle between MDI/desktop without closing
- `-e[N]` enable an **editbox**: `0`=none/single, `1`=multi, `2`=auto, `3`=default
- `-f` interpret `w h` as the **text display area** size rather than the whole window
- `-g[N]` set/unset button **highlight**: `0`=none, `1`=message color, `2`=highlight color, `3`=event color
- `-h` **hide** from switchbar/treebar (still in Window menu)
- `-i` flash/iconify related
- `-k[N]` enable a side **listbox** (nicklist-style) `0/1`
- `-l[N]` create a **listbox** window (vs text); related sort/control flags
- `-m` minimize
- `-n` minimize/no-activate (create minimized)
- `-o` set window to be "on top"
- `-p` create a **picture** window (for drawing with `/drawdot` etc.)
- `-r` restore
- `-s[N]` sort the listbox (with sort flags)
- `-t <file>` apply a text file's contents
- `-v` make visible / max
- `-w[N]` show/hide in bars: `0`=hide both, `1`=switchbar, `2`=treebar, `3`=both
- `-x` maximize
- `-z[N]` place the button at the **end** of the switchbar (`0`=restore original, `1`=move to end)

### /aline
```
/aline [-hipsN] [color] <@window|#channel> <text>
```
**Adds a line** of `<text>` to the end of a window's display/listbox. `[color]` is a mIRC color index.
Switches: `-p` pad/parse, `-i` insert, `-h` highlight, `-s` select the added line, `-N` (number) line ops.

### /rline
```
/rline [-hipsN] [color] <@window|#channel> <N> <text>
```
**Replaces line** number `<N>` in the window with `<text>`. Same color/switch behavior as `/aline`.

### /dline
```
/dline [-hi] <@window|#channel> <N[,N2,...]>
```
**Deletes line(s)** number `<N>` (or a comma-separated list) from the window.

### /clear
```
/clear [-sghlc] [@window|#channel|nick]
```
Clears the buffer of the current (or specified) window.
- `-s` clear the status window's buffer
- `-g` clear the logical (scrollback) buffer
- `-h` clear the line buffer history
- `-l` clear the side **listbox** contents
- `-c` clear the editbox/command line
With no argument, clears the active window.

### /linesep
```
/linesep [-sa | @window|#channel]
```
Prints a horizontal **line separator** in the window. `-a` = active window, `-s` = status window;
otherwise the named window.

---

## Channel Commands

### /join
```
/join [-inmxd(N)] <#channel[,#channel2,...]> [key[,key2,...]]
```
Joins one or more channels (optionally with channel keys/passwords).
- `-i` join the channel you were last **invited** to (ignores `#channel` arg)
- `-n` do not bring the channel window to the foreground (join minimized/background)
- `-m` minimize the channel window
- `-x` maximize the channel window
- `-d[N]` make the new channel window a **desktop** window

### /part
```
/part [#channel[,#channel2,...]] [part message]
```
Leaves (PART) the given channel(s). Defaults to the active channel if omitted. Optional part message.

### /hop
```
/hop [-cn(N)] [#channel] [message]
```
Parts the current channel and rejoins it (a quick "hop"); with a `#channel` argument it parts the
current channel and joins the given one. `-c` cycle/close, `-n` do not focus the rejoined window.

### /cycle
```
/cycle [-c] [#channel] [message]
```
Equivalent behavior to `/hop`: parts and rejoins the channel. (`/cycle` is the documented alias of
`/hop` for the same effect; optional `message` is used as the part message.)

### /mode
```
/mode <#channel|nick> [[+|-]modes] [parameters]
```
Sets/removes channel or user modes. Examples:
`/mode #chan +o nick`, `/mode #chan +b nick!*@*`, `/mode #chan +mnt`, `/mode #chan -k key`,
`/mode #chan +l 50`, `/mode yournick +i`. With only a target, queries current modes.

### /ban
```
/ban [-kruNbeIq] [#channel] <nick|address> [type]
```
Bans a user from a channel (sets `+b` with an address mask).
- `[type]` = a number 0-9 selecting the wildcard mask format derived from the user's address
  (e.g. `*!*@host`, `*!user@host`, `nick!*@*`, etc.)
- `-k` also **kick** the user (ban+kick)
- `-r` remove the ban (unban) instead of adding
- `-u[N]` auto-remove the ban after N seconds
- `-b` ban list (`+b`), `-e` ban exception list (`+e`), `-I` invite list (`+I`), `-q` quiet list (`+q`)
Defaults to the active channel if `#channel` omitted.

### /unban
```
/unban [-aN] [#channel] <nick|address>
```
Removes a ban (`-b`) matching the nick/address from the channel's ban list. `[N]` / `-a` selects the
address mask type or "all matching" behavior. Defaults to active channel.

### /kick
```
/kick [-r] <#channel> <nick> [reason]
```
Kicks `<nick>` from `<#channel>` with an optional reason. `-r` (where supported) removes/quiets too.
You must have op privileges.

### /invite
```
/invite <nick> <#channel>
```
Invites `<nick>` to `<#channel>` (sends INVITE). Useful for `+i` (invite-only) channels.

### /topic
```
/topic <#channel> <new topic text>
```
Sets the topic of `<#channel>`. With only `<#channel>` and no text on some setups it requests the
current topic. Requires appropriate privileges if `+t` is set.

---

## Connection / User Commands

### /nick
```
/nick <new nickname>
```
Changes your nickname on the current connection.

### /quit
```
/quit [quit message]
```
Disconnects from the server with an optional quit/signoff message (sends QUIT). Does not close mIRC.

### /server
```
/server [-46ezlocaldmntpfocuk] [server|group|N] [port] [password]
```
Connects (or reconnects) to an IRC server, server group, or the Nth server in the list.
Switches (commonly used set):
- `-4` / `-6` force IPv4 / IPv6
- `-e` use SSL/TLS encrypted connection
- `-z` connect to a marked/listed server form
- `-m` open a **new** connection (multi-server) instead of using the current status window
- `-n` create a new connection but do not connect yet
- `-d` use the listed server directly
- `-l` connect using the last server
- `-t` certificate-related (TLS)
- `-p` specify port form
- `-f` force connect / skip locking
- `-o` connect to the server in the active status window
- `-c` close/continue form
- `-u` keep existing user details
- `-k` ... (version-specific TLS/key option)
Examples: `/server irc.example.net 6697`, `/server -e irc.example.net +6697`, `/server -m`.

### /disconnect
```
/disconnect
```
Forcibly closes the current server connection **without** sending a QUIT message (immediate socket
close). Contrast with `/quit` which sends a proper QUIT.

### /whois
```
/whois <nick> [server]
```
Sends a WHOIS query for `<nick>` (optionally directed at a specific `[server]` for idle/signon info).

### /who
```
/who <#channel | nick | mask>
```
Sends a WHO query, returning a list of users matching the channel or mask.

### /names
```
/names <#channel>
```
Requests the list of nicknames currently on `<#channel>` (NAMES).

### /raw  (alias: /quote)
```
/raw [-q] <raw IRC command/text>
/quote [-q] <raw IRC command/text>
```
Sends the text **directly** to the server with no mIRC processing (raw IRC protocol line).
`/quote` is an alias of `/raw`. `-q` suppresses the local echo of the raw line to the status window.
Example: `/raw PRIVMSG #chan :hello`, `/raw CAP LS 302`.

---

## Ignore / User List Commands

### /ignore
```
/ignore [-cdeiklnprtuwxN] <on|off|nick|address> [type]
```
Adds/removes an address from the ignore list, or toggles ignoring globally.
- `on` / `off` toggles the ignore system globally
- `-r` removes the entry (un-ignore)
- `-u[N]` ignore for N seconds then auto-remove
- `-w` wildcard, `-p` private msgs, `-c` channel msgs, `-n` notices, `-t` ctcps,
  `-i` invites, `-d` dcc, `-x` ... (each flag selects which message categories to ignore)
- `[type]` 0-9 chooses the address mask format (like `/ban`)
With no flags, `/ignore <nick>` ignores all message types from that user.

### /auser
```
/auser [-a] <level> <nick|address> [info]
```
**Adds a user** to mIRC's internal user list with the given access `<level>` (used by `on` events
with level matching, the User section / `$ulist`). `-a` adds the level rather than replacing.

### /ruser
```
/ruser [-rN] <level|nick|address> [type]
```
**Removes a user** (or a specific level from a user) from the user list. `[type]` 0-9 selects the
mask format; `-r` regex/related; numeric form targets a specific level.

### /guser
```
/guser [-a] <level> <nick> [type]
```
**Gets** a user's address (via internal lookup/WHOIS) and **adds** them to the user list at `<level>`
using mask `[type]` (0-9). `-a` adds the level instead of replacing.

---

## File / INI Commands

### /writeini
```
/writeini [-nz] <inifile> <section> <item> <value>
```
Writes `<item>=<value>` under `[section]` in the INI-format `<inifile>` (created if needed).
- `-n` do not evaluate the value (write literally)
- `-z` ... (zero/encoding-related write flag)

### /remini
```
/remini <inifile> <section> [item]
```
Deletes a whole `[section]` (if `[item]` omitted) or a single `<item>` within a section from an INI file.

### /flushini
```
/flushini <inifile>
```
Forces mIRC's cached writes for `<inifile>` to be flushed to disk immediately (mIRC buffers INI
writes for performance; this commits them).

### /write
```
/write [-cidl(N)a(N)s(N)w(N)r(N)m(N)bt] <filename> [text]
```
Writes/edits lines in a plain text file. With no switches, appends `[text]` as a new last line.
Switches:
- `-c` create the file (clear it first if it exists)
- `-i` insert text at line N (with `-lN`) / insert mode
- `-d[N]` delete line N (or all lines if N omitted on some forms)
- `-l[N]` operate on line number N (used with insert/replace/delete)
- `-a[N]` ... append/at-line N
- `-s[N]` ... line-count related
- `-w[N]` find a line matching wildcard and replace it
- `-r[N]` find a line matching wildcard and **delete** it
- `-m[N]` ensure the file has at least N lines (pad with blanks)
- `-b` binary write
- `-t` text/term handling
Example: `/write -c log.txt`, `/write -dl5 log.txt`, `/write log.txt new line text`.

### /remove
```
/remove [-b] <filename>
```
Deletes the specified file from disk. `-b` (where supported) deletes in a way that bypasses certain
protections / handles binary path. Returns no confirmation by default.

### /splay
```
/splay [-cwmpq(N)] <filename | $sound>
```
Plays a sound file (WAV/MP3/MIDI) or queued sound.
- `-w` wait until the current sound finishes before playing
- `-m` play in a loop / multiple
- `-p` pause / stop currently playing sound
- `-c` ... continue/cancel form
- `-q` queue the sound
`/splay stop` stops playback.

### /run
```
/run [-anpdhmx(N)] <filename | program> [parameters]
```
Launches an external program or opens a file/URL with its associated application.
- `-a` pass as a single argument / associate
- `-n` run minimized
- `-p` use the given working directory / path form
- `-h` run hidden
- `-m` maximized
- `-x` ... (no-window/elevated variant)
- `-d` use ShellExecute default verb
Example: `/run notepad.exe c:\file.txt`, `/run https://example.com`.

### /timestamp
```
/timestamp [-fgsea | @window|#channel] [on|off|default]
```
Turns timestamping of displayed events on/off (globally or per window) or sets it to the default.
- `-a` active window, `-s` status window, `-e` all event windows, `-g`/`-f` global/format scopes
- `on` / `off` / `default` set the state.

---

## Control Flow Statements (/if /elseif /else /while /goto)

mIRC control flow uses `{ }` blocks and `|` command separators. Conditions go in `( )`.

### /if ... /elseif ... /else
```
if (<condition>) { <commands> }
elseif (<condition>) { <commands> }
else { <commands> }
```
- Evaluates `<condition>`; if true, runs its `{ block }`.
- If false, falls through to the next `elseif` (if any), evaluating its condition, then finally `else`.
- Single-command, single-line forms are allowed: `if (%x == 1) echo -a yes`.
- The opening `{` is conventionally placed on the **same line** as `if`/`elseif`/`else`; the matching
  `else`/`elseif` must follow the closing `}` (on the same line or, in script files, the next line).

### /while
```
while (<condition>) { <commands> }
```
- Repeats the `{ block }` as long as `<condition>` is **true**.
- `/break` exits the loop early; `/continue` skips to the next iteration.
- Beware infinite loops; mIRC will eventually warn/abort runaway loops.

### /goto and labels
```
:labelname
...
goto labelname
```
- A label is a line of the form `:name`. `goto name` jumps execution to the line **after** the label.
- Works within an alias/event; can emulate loops or conditional jumps. `goto` can jump backward or forward.

### Conditional Operators

Comparison / numeric:
- `==` equal to (string/number)
- `===` equal to **case-sensitive** (string)
- `!=` not equal to
- `<` `>` `<=` `>=` numeric comparisons
- `//` is `a` divisible by `b` (modulo-zero test)
- `%` ... (modulo in expressions via `$calc`, not a direct comparator)

Type / string operators (used as `if (X isXXX Y)`):
- `isnum` — operand is a number (optionally `isnum a-b` checks it's a number within range a-b)
- `isletter` — operand is a letter (optionally within a set)
- `isalnum` — alphanumeric
- `isin` — left string is contained **in** right string
- `iswm` — left **wildcard mask** matches right string (e.g. `*!*@host`)
- `isincs` / `iswmcs` — case-sensitive variants of `isin` / `iswm`
- `ison` — nick is on the given channel (`if ($nick ison #chan)`)
- `isop` `ishop` `isvoice` (`isvo`) `isadmin` `isowner` — nick has that status on a channel
- `isreg` — nick is a regular (no status) on a channel
- `ischan` — you are on the given channel / it's a valid channel window
- `isfile` — path is an existing file; `isdir` — path is an existing directory

Logical combination:
- `&&` logical AND, `||` logical OR, `!` negation: `if (%a == 1 && %b == 2) { ... }`
- Parentheses group sub-conditions: `if ((%a == 1) || (%b > 3)) { ... }`

Notes:
- `==` on two numeric strings compares numerically in mIRC; for strict text use `===`.
- Operands and identifiers inside `( )` are evaluated before the comparison.
- Use `$null`/empty checks like `if (%x == $null)` or `if (!%x)` to test for unset/empty.

---

## Period (.) Prefix and `$show`

Prefixing most commands with `.` (e.g. `.msg`, `.notice`, `.echo -aq`, `.timer`) suppresses their
default local output by setting `$show` to `$false`. Honor this in a clone: a leading `.` on a command
means "execute silently."

---

## Sources

- mIRC official help: https://www.mirc.com/help/html/mirc_commands.html (and per-command pages)
- WikiChip mIRC command reference: https://en.wikichip.org/wiki/mirc/commands
- mIRC-Scripters Knowledge Base: https://docs.mircscripting.org/ and
  https://github.com/mIRC-Scripters/mirckb
- Conditional statements: https://en.wikichip.org/wiki/mirc/conditional_statements
