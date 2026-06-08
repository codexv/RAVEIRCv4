# mIRC Identifiers Reference

A reference for cloning mIRC `$identifier` behavior. Sources: official mIRC help file (`/help`), WikiChip (en.wikichip.org/wiki/mirc), mircscripts.org.

Conventions:
- `$ident` = no-parameter identifier.
- `$ident(...)` = parametered identifier; many also support `.property` suffixes.
- "Returns $true/$false" = boolean identifier. Otherwise returns a string/number.
- `$null` = empty value (empty string); evaluating an unset/empty identifier yields `$null`.

---

## Local user / connection context

| Identifier | Syntax | Returns | Note |
|---|---|---|---|
| `$me` | `$me` | string | Your current nickname on the active connection. |
| `$nick` | `$nick` | string | The nickname relevant to the current event (e.g. the nick who triggered an on TEXT/JOIN/etc.). |
| `$chan` | `$chan` | string | The channel relevant to the current event. In an event with no channel, `$null`. |
| `$chan(N/#)` | `$chan(N\|#).property` | string | Channel by position N or by name #. Properties: `.mode`, `.topic`, `.key`, `.limit`, `.ial`, `.logfile`, `.idle`, etc. |
| `$target` | `$target` | string | The target of the current message/command (channel or nick) — where output of a reply would go. |
| `$active` | `$active` | string | Name of the currently active (focused) window. |
| `$server` | `$server` | string | The address of the server you are connected to (current connection). `$null` if not connected. |
| `$server(N)` | `$server(N).property` | string | Server from the server list by position. Properties: `.port`, `.group`, `.desc`, etc. |
| `$network` | `$network` | string | The network name reported by the current server. |
| `$address` | `$address` | string | The full address (`nick!user@host`) of `$nick` for the current event, if known. |
| `$address(nick,type)` | `$address(nick,N)` | string | Address of `nick` from the IAL formatted as mask type N (0–11). `$null` if not in IAL. |

---

## Command parameters / tokens of an alias or event

| Identifier | Syntax | Returns | Note |
|---|---|---|---|
| `$0` | `$0` | number | Number of parameters passed to the alias/popup/event. |
| `$1` | `$1` ... `$N` | string | The Nth space-delimited parameter; `$null` if absent. |
| `$1-` | `$N-` | string | Parameters from N to the end, space-joined. |
| `$1-3` | `$N-M` | string | Parameters N through M, space-joined. |
| `$2-3` | `$2-3` | string | Example: parameters 2 through 3. |
| `$$1` | `$$N` | string | Like `$N` but **halts** the script/command if that parameter is empty. |
| `$*1` | `$*N` | string | Like `$N` but matches wildcard/regex against parameters (advanced; rarely used). |

---

## Strings: text and tokens

| Identifier | Syntax | Returns | Note |
|---|---|---|---|
| `$+` | `a $+ b` | string | Concatenation operator — joins adjacent text with no space (e.g. `$me $+ !`). |
| `$len` | `$len(text)` | number | Length of text in characters. |
| `$left` | `$left(text,N)` | string | Leftmost N chars. Negative N = all but last \|N\| chars. `$left(text,-0)` and letter variants supported in newer mIRC. |
| `$right` | `$right(text,N)` | string | Rightmost N chars. Negative N = all but first \|N\| chars. |
| `$mid` | `$mid(text,S,N)` | string | N chars starting at position S (1-based). Omit N to return to end. Property: `$mid(text,S,N).PROP` not used; instead negative S counts from end. |
| `$pos` | `$pos(text,substr,N)` | number | Position of the Nth occurrence of substr in text (1-based); `$null`/`0` if not found. |
| `$count` | `$count(text,substr,...)` | number | Number of (non-overlapping) occurrences of substr in text. Multiple substrings sum. |
| `$replace` | `$replace(text,old1,new1,old2,new2,...)` | string | Replace all occurrences; non-overlapping, left to right, pairwise. |
| `$replacex` | `$replacex(text,old1,new1,...)` | string | Like `$replace` but each char position replaced at most once (no re-scanning of substitutions). |
| `$remove` | `$remove(text,substr1,substr2,...)` | string | Remove all occurrences of given substring(s). |
| `$upper` | `$upper(text)` | string | Uppercase. |
| `$lower` | `$lower(text)` | string | Lowercase. |
| `$strip` | `$strip(text,burcmo)` | string | Remove mIRC control codes; flags select which: `b`old `u`nderline `r`everse `c`olor `o`rdinal `m`onospace. Default strips all. |
| `$str` | `$str(text,N)` | string | text repeated N times. |
| `$reverse` | `$reverse(text)` | string | Reverse character order of text. |
| `$chr` | `$chr(N)` | string | Character with ASCII/decimal code N (e.g. `$chr(32)` = space, `$chr(44)` = comma). |
| `$asc` | `$asc(char)` | number | ASCII/decimal code of the first character. |

### Token identifiers (C = single-char ASCII code used as delimiter)

| Identifier | Syntax | Returns | Note |
|---|---|---|---|
| `$gettok` | `$gettok(text,N,C)` | string | The Nth token (delimited by `$chr(C)`). N may be a range `N-M`, or negative to count from end. |
| `$numtok` | `$numtok(text,C)` | number | Number of tokens. |
| `$addtok` | `$addtok(text,token,C)` | string | Append token unless already present (case-insensitive). |
| `$instok` | `$instok(text,token,N,C)` | string | Insert token at position N (always, even if duplicate). |
| `$puttok` | `$puttok(text,token,N,C)` | string | Replace the token at position N with token. |
| `$deltok` | `$deltok(text,N,C)` | string | Delete token N (or range `N-M`). |
| `$remtok` / `$removetok` | `$remtok(text,token,N,C)` | string | Remove the Nth matching occurrence of token (N=1 first match; use `$gettok`-style). `$removetok` is a documented synonym variant — see note. |
| `$findtok` | `$findtok(text,token,N,C)` | number | Position of the Nth occurrence of token; `$null`/`0` if not found. |
| `$matchtok` | `$matchtok(text,string,N,C)` | string | Tokens that *contain* string (substring match), returning from the Nth match onward. |
| `$wildtok` | `$wildtok(text,wildmask,N,C)` | string | Tokens matching wildcard mask; N=0 returns count, N≥1 returns Nth match. |
| `$sorttok` | `$sorttok(text,C,sort)` | string | Sort tokens. Sort flags: `a` alphanumeric (default), `n` numeric, `c` case-sensitive, `r` reverse, `m` mixed/natural. |
| `$istok` | `$istok(text,token,C)` | $true/$false | `$true` if token is in text (case-insensitive). |

> Note: mIRC's documented identifier is **`$remtok`** (remove a token). `$removetok` is commonly seen in third-party docs/scripts as the same concept; clone behavior should treat removal by token value with an occurrence index N.

---

## Numbers / math

| Identifier | Syntax | Returns | Note |
|---|---|---|---|
| `$calc` | `$calc(expression)` | number | Evaluate math expression (+ - * / % ^ , and functions like sqrt, sin, cos, abs, etc.). |
| `$abs` | `$abs(N)` | number | Absolute value. |
| `$int` | `$int(N)` | number | Integer part (truncates toward zero). |
| `$round` | `$round(N,D)` | number | Round N to D decimal places. |
| `$floor` | `$floor(N)` | number | Largest integer ≤ N. |
| `$ceil` | `$ceil(N)` | number | Smallest integer ≥ N. |
| `$min` | `$min(a,b)` | number | Smaller of two values. |
| `$max` | `$max(a,b)` | number | Larger of two values. |
| `$rand` | `$rand(a,b)` | number/char | Random integer between a and b inclusive; if a,b are letters returns a random char in that range. |
| `$r` | `$r(a,b)` | number/char | Short alias for `$rand`. |
| `$base` | `$base(N,inbase,outbase,zeropad,precision)` | string | Convert number N from inbase to outbase (2–36). Optional zero-pad length and float precision. |

---

## Logic / boolean / control

| Identifier | Syntax | Returns | Note |
|---|---|---|---|
| `$true` | `$true` | $true | Boolean true (numeric value 1). |
| `$false` | `$false` | $false | Boolean false (numeric value 0). |
| `$null` | `$null` | $null | The empty value (empty string). |
| `$iif` | `$iif(condition,iftrue,iffalse)` | value | Inline if: returns iftrue if condition is true, else iffalse. Add `$true` 4th-arg variant via nesting. |
| `$ifmatch` | `$ifmatch` | string | Inside an `if`/`elseif` comparison context, refers to the matched value (legacy; rarely used). |

---

## Regular expressions

| Identifier | Syntax | Returns | Note |
|---|---|---|---|
| `$regex` | `$regex([name],text,re)` | number | Number of matches found (0 = none). Optional `name` stores results for `$regml`. Modifiers via trailing `/flags` in the regex. |
| `$regsub` | `$regsub([name],text,re,subtext,%var)` | number | Performs substitution; returns number of substitutions; result stored in `%var` (or named bvar). |
| `$regml` | `$regml([name],N)` | string | The Nth captured back-reference group from the last `$regex`/named match. `.pos` property = match position. |
| `$regml(name).N` | `$regml(name,N).pos` | number | Position of the Nth captured group. |

---

## Time and date

| Identifier | Syntax | Returns | Note |
|---|---|---|---|
| `$time` | `$time` or `$time(format)` | string | Current local time `HH:mm:ss`; with format string returns custom-formatted time. |
| `$date` | `$date` or `$date(format)` | string | Current date `dd/mm/yyyy` (locale-dependent format). |
| `$fulldate` | `$fulldate` | string | Full date+time string, `ddd mmm dd HH:nn:ss yyyy` (asctime-like). |
| `$asctime` | `$asctime(ctime,format)` | string | Format a ctime value into a date/time string per format codes. |
| `$ctime` | `$ctime` or `$ctime(datetime)` | number | Current Unix time (seconds since 1970-01-01 UTC); parses a date/time string to ctime if given. |
| `$duration` | `$duration(seconds,format)` | string | Convert seconds to a `1wk2days3hrs...` duration string; reverse-parses a duration string to seconds. Optional format flags (`2` = short, `3` = full units). |
| `$timestamp` | `$timestamp` | string | Current time formatted as the timestamp prefix (per timestamp settings). |
| `$ticks` | `$ticks` | number | Milliseconds since the OS/system started (monotonic; for timing). |

> Format codes for `$time`/`$date`/`$asctime`: `H`/`HH` 24h hour, `h`/`hh` 12h, `n`/`nn` minutes, `s`/`ss` seconds, `d`/`dd`/`ddd`/`dddd` day, `m`/`mm`/`mmm`/`mmmm` month, `yy`/`yyyy` year, `tt`/`TT` am/pm, `z` timezone, `o` ordinal.

---

## Channel / nick lists, IAL, access levels

| Identifier | Syntax | Returns | Note |
|---|---|---|---|
| `$nick(#,N,flags)` | `$nick(#,N,aohvr)` | string | Nick at position N in channel # nicklist; flags filter by `a`ll/`o`p/`h`alfop/`v`oice/`r`egular. `$nick(#,0,...)` returns count. |
| `$nick(#,nick).pnick` | `$nick(#,nick)` | string | Lookup form returns the nick with its prefix; `.pnick` gives prefixed nick. |
| `$snick(#,N)` / `$snicks` | `$snicks` | string | `$snicks` = space-separated list of currently *selected* nicks in channel. `$snick(#,N)` = Nth selected nick (N=0 count). |
| `$opnick` | `$opnick(#,N)` | string | Nth op in channel # (N=0 returns count). Convenience for op-filtered nicklist. |
| `$vnick` | `$vnick(#,N)` | string | Nth voiced nick in channel # (N=0 returns count). |
| `$hnick` | `$hnick(#,N)` | string | Nth halfop nick (N=0 count). |
| `$comchan` | `$comchan(nick,N)` | string | The Nth common channel you share with nick; N=0 returns count. |
| `$ial` | `$ial(mask,N)` | string | Nth IAL entry matching address mask; `.nick`, `.user`, `.host`, `.addr` properties. N=0 = count. |
| `$ialchan` | `$ialchan(mask,#,N)` | string | Like `$ial` but restricted to channel #. Properties same as `$ial`. N=0 = count. |
| `$level` | `$level(address)` | string | The user access level(s) assigned to address in the user list. |
| `$mask` | `$mask(nick!user@host,type)` | string | Build an address mask of given type (0–11) from an address. |
| `$wildsite` | `$wildsite` | string | A wildcard host mask (`*!*@host`) for `$nick` of the current event. |

> `$nick`/`$ial`/`$comchan` etc. with index `0` conventionally return the **count** of matches.

---

## Hash tables

| Identifier | Syntax | Returns | Note |
|---|---|---|---|
| `$hget` | `$hget(table,item)` | string | Value of item in hash table; `$hget(table,N).item`/`.data` to iterate by position; `$hget(table)` tests existence/returns table name. |
| `$hget(...).PROP` | `$hget(table,N).item` | string | `.item` = item name at slot N, `.data` = its value, `.unset` test, etc. |
| `$hfind` | `$hfind(table,string,N,flags)` | string | Find Nth item (or data) matching string; flags: `w` wildcard, `W` wildcard-on-data, `r` regex, `R` regex-on-data, `n` plain. N=0 = count. |

---

## Files / disk / config

| Identifier | Syntax | Returns | Note |
|---|---|---|---|
| `$read` | `$read(file,[flags],[match],[N])` | string | Read a line from a text file. Flags: `n` (no eval), `s` (search match string), `w` (wildcard search), `r` (regex search), `t` (skip first line = line count). With N reads line N. Without N, reads a random line. |
| `$read(...).PROP` | `$read(file,...).N` | — | Search forms return matching line; can return line number when used with appropriate flags. |
| `$readini` | `$readini(file,[n],section,item)` | string | Read item under section from an INI file (`n` = no eval). |
| `$ini` | `$ini(file,section,item)` | string/number | Enumerate INI: `$ini(file,0)` = number of sections; `$ini(file,N)` = Nth section name; `$ini(file,section,0)` = item count; `$ini(file,section,N)` = Nth item name. |
| `$lines` | `$lines(file)` | number | Number of lines in a text file. |
| `$file` | `$file(filename)` | string | File info object; properties: `.size`, `.ctime`, `.mtime`, `.atime`, `.attr`, `.shortfn`, `.longfn`. Returns `$null` if file doesn't exist. |
| `$exists` | `$exists(path)` | $true/$false | `$true` if file or directory exists. |
| `$isfile` | `$isfile(path)` | $true/$false | `$true` if path exists and is a file. |
| `$isdir` | `$isdir(path)` | $true/$false | `$true` if path exists and is a directory. |
| `$nopath` | `$nopath(filename)` | string | Filename with directory path removed (basename). |
| `$nofile` | `$nofile(filename)` | string | Path with the filename removed (directory portion, trailing `\`). |
| `$noqt` | `$noqt(text)` | string | Remove surrounding quotes. |
| `$qt` | `$qt(text)` | string | Add surrounding quotes if needed. |

---

## Property reference for common identifiers

- `$chr(N)` — N is a decimal code point; no properties. Common: `9` tab, `32` space, `44` comma, `46` period, `124` pipe.
- `$mid(text,start,length)` — `start` may be negative to count from the end; omit `length` to take the rest of the string.
- `$chan(#).PROP` — `.mode` (current modes), `.topic`, `.key`, `.limit`, `.idle`, `.ial` (IAL-on flag), `.logfile`, `.status`.
- `$server(N).PROP` — `.port`, `.group`, `.desc`, `.pass`, `.ssl`.
- `$file(name).PROP` — `.size`, `.ctime`/`.mtime`/`.atime` (ctime values), `.shortfn`, `.longfn`, `.attr`.
- `$read(...)` flags combine, e.g. `$read(file,nw,*hello*)` = no-eval wildcard search.

---

## Boolean ($true/$false) identifiers summary

These return `$true` or `$false` (not a value): `$istok`, `$exists`, `$isfile`, `$isdir`. Plus the literals `$true` and `$false`. `$iif` evaluates a condition that itself uses comparison operators (`==`, `!=`, `isin`, `iswm`, `>` etc.) rather than returning a boolean by itself.

## Identifiers returning $null when empty/not found

`$nick`, `$chan`, `$address`, `$server`, `$network`, `$gettok` (out of range), `$ial`/`$ialchan` (no match), `$comchan`, `$read` (no match), `$file` (missing), parameter identifiers `$1..$N` past `$0`.
