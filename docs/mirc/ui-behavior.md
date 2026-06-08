# mIRC UI Behavior & Conventions Reference

A precise reference for cloning mIRC's look and feel in a desktop IRC client.
Sourced from official mIRC help (mirc.com/help), mirc.com/colors.html, the
modern.ircdocs formatting spec (which mirrors mIRC's extended palette), and
WikiChip/mIRC forum documentation. mIRC is the de-facto reference for these
conventions; where the IRC formatting spec standardized mIRC behavior, it is
noted.

---

## 1. Editbox Behavior

The editbox is the single-line (or optional multi-line) input field at the
bottom of every window. It doubles as a **command line** (lines starting with
`/` are commands) and a **message line** (everything else is sent as a PRIVMSG
to the active window's target).

### 1.1 Command / text history (Up / Down arrows)

- **Cursor Up / Cursor Down**: browse the command-line history in a single-line
  editbox. Up goes to older entries, Down to newer.
- **Ctrl+Cursor Up / Ctrl+Cursor Down**: browse history in a *multi-line*
  editbox (the plain arrows there move between text lines).
- History is per-editbox/per-window and is shared across the command history
  buffer. `/clear -h` clears the command history for a window.
- Each window remembers what was typed; switching windows restores that
  window's in-progress editbox content.
- After recalling a line you can edit it before pressing Enter.

### 1.2 Commands vs. text

- A leading `/` makes the line a **command** (e.g. `/join #chan`, `/me waves`).
- To send literal text that begins with `/`, press **Ctrl+Enter** (sends the
  line as plain text instead of interpreting it as a command). Alternatively a
  double slash `//` is treated as a command-evaluation prefix in scripting, but
  for the editbox the Ctrl+Enter rule is the user-facing one.
- Everything else is sent as a message to the active target (channel or query).

### 1.3 Tab nick-completion

- **Tab** with text before the cursor: completes a **nickname**, **channel
  name**, **variable**, or **identifier** matching the partial word at the
  cursor.
- **Tab** in an *empty* editbox: inserts `/msg <nick> ` for the last person who
  messaged you (quick-reply). (Suppressed if the "Tab key changes editbox
  focus" option is on.)
- **Cycling**: pressing Tab repeatedly cycles through all matching nicks (in the
  order mIRC tracks them — most-recently-active / nicklist order). Prefix
  matching also works: `@<Tab>` cycles through ops, `+<Tab>` through voiced, etc.
- **Suffix**: when the completed nick is at the **start of the line**, mIRC
  appends a separator suffix so the result reads like an address, e.g.
  `Nick: ` (colon + space) — historically `Nick, ` (comma+space) in older
  versions; modern mIRC uses the colon+space convention. When the nick is
  **mid-line** (not the first word), only the nick is inserted with a trailing
  space, no colon. There is no built-in option to change the suffix character
  without scripting the `on TABCOMP` event.
- **Ctrl+D**: removes the currently-shown nickname from the Tab completion list.
- **Shift+Tab**: in a channel window, moves focus between the editbox and the
  nickname listbox (does not complete).
- **on TABCOMP** event: scripts can intercept Tab and override default
  completion; halting the event suppresses the built-in behavior.

### 1.4 Ctrl formatting keys (inline control codes)

Pressing these in the editbox inserts the corresponding control byte at the
cursor; the typed text afterward is formatted until a toggle-off or reset.

| Key      | Effect       | Inserted byte        |
|----------|--------------|----------------------|
| Ctrl+B   | Bold         | `0x02`               |
| Ctrl+U   | Underline    | `0x1F`               |
| Ctrl+I   | Italic       | `0x1D`               |
| Ctrl+R   | Reverse      | `0x16` (also bound to Reverse; older docs call it "highlight in black") |
| Ctrl+K   | Color        | `0x03` + color picker / digits |
| Ctrl+O   | Plain/Reset  | `0x0F`               |
| Ctrl+E   | Strikethrough| `0x1E`               |

Mnemonic in mIRC docs: **Ctrl+BURKO** (Bold, Underline, Reverse, K=color, O=off).

- **Bold / Underline / Italic / Reverse / Strikethrough** are toggles: insert
  once to turn on, again to turn off.
- **Ctrl+O** turns off ALL active formatting in one keystroke.

#### Ctrl+K color behavior

- Pressing **Ctrl+K** inserts a `0x03` and pops up a small **color picker**
  (a grid of the 16 base colors). Clicking a foreground color, then optionally a
  background color, inserts the numeric code.
- **Ctrl+K then typing numbers** bypasses the picker: e.g. `Ctrl+K` `4` = red
  foreground; `Ctrl+K` `4,1` = red on black. The wire form is
  `\x03<fg>[,<bg>]` where fg/bg are 0–15 (or 16–98 extended, 99 = default).
- A bare `\x03` (Ctrl+K with no number) **resets** color back to default.
- **Two-digit ambiguity**: if the text immediately following the color code
  begins with a digit, the color number must be written as two digits
  (e.g. `\x03044` = color 04 then literal "4"), otherwise clients mis-parse.

### 1.5 Multiline paste warning

- Pasting text containing multiple lines into the editbox triggers a
  **confirmation dialog** ("You are about to paste N lines into this window…")
  to prevent accidental flooding. The user can choose to send each line,
  paste into a temporary editor, or cancel. The threshold and behavior are
  configurable in Options. Long single lines that exceed IRC's ~512-byte limit
  are split/warned about as well.

### 1.6 Other editbox keys

- **Alt+Enter**: insert a newline in a multi-line editbox.
- **Alt+Q**: show/hide the second (multi-line) editbox.
- **Ctrl+Home / Ctrl+End**: move cursor to start/end of editbox (or scrollback).

---

## 2. Color Codes & Control Codes

### 2.1 Control code bytes

| Function       | Hex   | Dec | Notes                                   |
|----------------|-------|-----|-----------------------------------------|
| Bold           | `0x02`| 2   | toggle                                  |
| Color          | `0x03`| 3   | `\x03fg[,bg]`, digits 0–15/16–98/99     |
| Hex Color      | `0x04`| 4   | `\x04RRGGBB[,RRGGBB]` (24-bit, modern)  |
| Reset / Plain  | `0x0F`| 15  | clears all formatting (Ctrl+O)          |
| Monospace      | `0x11`| 17  | toggle (modern spec)                    |
| Reverse        | `0x16`| 22  | swap fg/bg                              |
| Italic         | `0x1D`| 29  | toggle                                  |
| Strikethrough  | `0x1E`| 30  | toggle (modern spec)                    |
| Underline      | `0x1F`| 31  | toggle                                  |

- A lone `\x03` with no following digits cancels color (returns to default).
- Color codes can specify foreground only (`\x034`) or fg + bg (`\x034,1`).

### 2.2 Standard palette (0–15) — exact RGB / hex

Per mirc.com/colors.html (RGB → hex):

| # | Name        | RGB            | Hex      |
|---|-------------|----------------|----------|
| 0 | White       | (255,255,255)  | `FFFFFF` |
| 1 | Black       | (0,0,0)        | `000000` |
| 2 | Blue (navy) | (0,0,127)      | `00007F` |
| 3 | Green       | (0,147,0)      | `009300` |
| 4 | Red         | (255,0,0)      | `FF0000` |
| 5 | Brown/Maroon| (127,0,0)      | `7F0000` |
| 6 | Purple      | (156,0,156)    | `9C009C` |
| 7 | Orange/Olive| (252,127,0)    | `FC7F00` |
| 8 | Yellow      | (255,255,0)    | `FFFF00` |
| 9 | Light Green | (0,252,0)      | `00FC00` |
| 10| Cyan/Teal   | (0,147,147)    | `009393` |
| 11| Light Cyan  | (0,255,255)    | `00FFFF` |
| 12| Light Blue  | (0,0,252)      | `0000FC` |
| 13| Pink/Magenta| (255,0,255)    | `FF00FF` |
| 14| Grey        | (127,127,127)  | `7F7F7F` |
| 15| Light Grey  | (210,210,210)  | `D2D2D2` |

Note: colors 0–15 are nominally user-customizable in mIRC's Colors dialog; the
above are the defaults. Codes 16–98 are *fixed* (same for all clients).

### 2.3 Extended palette (16–98) — hex

(Standardized; identical in mIRC and the modern IRC formatting spec.)

| #  | Hex    | #  | Hex    | #  | Hex    | #  | Hex    |
|----|--------|----|--------|----|--------|----|--------|
| 16 | 470000 | 37 | 4B0074 | 58 | 00FFFF | 79 | E2FF9C |
| 17 | 472100 | 38 | 740074 | 59 | 008CFF | 80 | 9CFF9C |
| 18 | 474700 | 39 | 740045 | 60 | 0000FF | 81 | 9CFFDB |
| 19 | 324700 | 40 | B50000 | 61 | A500FF | 82 | 9CFFFF |
| 20 | 004700 | 41 | B56300 | 62 | FF00FF | 83 | 9CD3FF |
| 21 | 00472C | 42 | B5B500 | 63 | FF0098 | 84 | 9C9CFF |
| 22 | 004747 | 43 | 7DB500 | 64 | FF5959 | 85 | DC9CFF |
| 23 | 002747 | 44 | 00B500 | 65 | FFB459 | 86 | FF9CFF |
| 24 | 000047 | 45 | 00B571 | 66 | FFFF71 | 87 | FF94D3 |
| 25 | 2E0047 | 46 | 00B5B5 | 67 | CFFF60 | 88 | 000000 |
| 26 | 470047 | 47 | 0063B5 | 68 | 6FFF6F | 89 | 131313 |
| 27 | 47002A | 48 | 0000B5 | 69 | 65FFC9 | 90 | 282828 |
| 28 | 740000 | 49 | 7500B5 | 70 | 6DFFFF | 91 | 363636 |
| 29 | 743A00 | 50 | B500B5 | 71 | 59B4FF | 92 | 4D4D4D |
| 30 | 747400 | 51 | B5006B | 72 | 5959FF | 93 | 656565 |
| 31 | 517400 | 52 | FF0000 | 73 | C459FF | 94 | 818181 |
| 32 | 007400 | 53 | FF8C00 | 74 | FF66FF | 95 | 9F9F9F |
| 33 | 007449 | 54 | FFFF00 | 75 | FF59BC | 96 | BCBCBC |
| 34 | 007474 | 55 | B2FF00 | 76 | FF9C9C | 97 | E2E2E2 |
| 35 | 004074 | 56 | 00FF00 | 77 | FFD39C | 98 | FFFFFF |
| 36 | 000074 | 57 | 00FFA0 | 78 | FFFF9C |    |        |

- **99** = "default" (transparent / theme default foreground or background).

---

## 3. Window Management

mIRC is an MDI app: a main application window contains child windows (status,
channels, queries, etc.). Navigation aids: the **switchbar** and **treebar**.

### 3.1 Switchbar

- A bar of buttons (one per open window), default docked at the bottom (can be
  top/left/right). Each button shows the window name + an icon by type.
- Click a button to activate that window. Buttons **flash / change color** when
  the window has new activity (new message, highlight, etc.).
- Switchbar mouse modifiers:
  - **Alt+LeftClick**: show/hide the status window's buttons (group toggle).
  - **Shift+LeftClick**: close the window.
  - **Ctrl+LeftClick**: minimize the window.
  - **RightClick**: context popup for that window.

### 3.2 Treebar

- A tree (sidebar, default left) grouping windows hierarchically: each server
  connection is a parent node with its status window, channels, and queries as
  children. Good for multi-network use.
- Click a node to activate; activity nodes highlight.
- **Ctrl+T**: toggle keyboard focus between the treebar and the active window.

### 3.3 Window switching keys

- **Alt+1 … Alt+9**: jump to the Nth window listed in the Window menu.
- **Alt+0**: jump to / focus the main mIRC window.
- **Ctrl+Tab**: cycle forward through all windows.
- **Ctrl+Shift+Tab**: cycle backward through all windows. (Ctrl+Tab order
  follows window-open order; documented behavior.)
- **Ctrl+N**: cycle through channel windows only.
- **Ctrl+Q**: cycle through query windows only.
- **Alt+X**: toggle maximize of the active window.
- **Alt+Z**: close the active window.
- **Esc**: minimize the active window.

### 3.4 Window types

- **Status window**: the per-connection root window. Shows raw server
  numerics, connection progress, MOTD, notices, errors, and untargeted text.
  Each network has its own status window. The editbox there sends commands /
  raw lines.
- **Channel window ("channel central")**: split layout —
  - top: **topic bar** showing the channel topic (editable by ops via the
    Topic field / the title or a dedicated bar).
  - a **modes** display (e.g. `+nt`) usually near the topic or in the title.
  - center-left: the **message/scrollback pane**.
  - right: the **nicklist** (see below).
  - bottom: the **editbox**.
- **Query window**: a private 1-to-1 conversation window (PRIVMSG). No
  nicklist; topic/mode bar absent. Opened by double-clicking a nick or `/query`.
- **Custom / @windows**: scripted windows.

### 3.5 Nicklist

- Listed on the right of channel windows, sorted by **status prefix then
  alphabetically**: owners (`~`/`!`), admins (`&`/`*`), ops (`@`), halfops
  (`%`), voiced (`+`), then regular nicks. Prefix symbols shown before the nick.
- **Single click**: selects a nick (multi-select with Ctrl/Shift).
- **Double click**: performs the **default action** — by default opens a
  **query** window with that nick (configurable; can be set to whois, etc.).
- **Right click**: opens the **nicklist popup menu** (the user-editable
  Popups; default entries include Whois, Query, Ping, Op/Deop, Voice, Kick,
  Ban, Ignore, DCC Send/Chat, etc.).
- **Hover**: tooltip with address/info if enabled.

### 3.6 Topic & mode bar

- The topic bar appears at the top of channel central; shows the current topic.
  Ops can edit it inline. Channel modes (e.g. `[+ntr]`) are displayed alongside
  or in the title bar. User limit / key reflected in modes.

---

## 4. Timestamps, Logging, Highlight, Away, Title Bar

### 4.1 Timestamps

- Controlled by **Options → IRC → Messages → "Timestamp events"** and by the
  `/timestamp` command (`-f` sets the on-screen format, `-g` sets the log
  format).
- **Default format**: `[HH:nn]` style — i.e. `[HH:mm]` 24-hour hours:minutes in
  square brackets followed by a space (e.g. `[14:05] <Nick> hi`). The
  `$timestamp` identifier returns the current time in the configured event
  timestamp format.
- Format tokens (mIRC time/date): `H/HH` = 24-hour hour, `h/hh` = 12-hour,
  `nn` = minutes, `ss` = seconds, `tt` = AM/PM, `mmm`/`mmmm` = month,
  `yyyy` = year, `dd`/`ddd`/`dddd` = day. (Note mIRC uses `nn` for minutes, not
  `mm` which is month.)
- Timestamps can be toggled per-window with `/timestamp on|off` and globally.

### 4.2 Logging

- **Options → IRC → Logging**. Can auto-log channels and/or queries (and
  status). Logs are plain text, one file per window, stored in the **logs**
  folder, named by window + network.
- Options: timestamp log lines (separate log timestamp format), strip control
  codes from logs, reload last N lines of the log into the window on rejoin
  ("Reload logs"), date headers, lock logs.
- `/log on|off` toggles logging for the active window.

### 4.3 Highlight / beep / flash

- **Options → IRC → Highlight**: list of words/nicks that trigger a highlight.
  On match mIRC can: change the line color, play a **sound/beep**, **flash the
  window** (taskbar flash) and/or flash the switchbar button, and pop a balloon.
- mIRC always highlights your own nick by default and flashes/beeps on private
  messages and DCC requests (configurable).
- The switchbar/treebar entry for a window with unread activity is colored;
  with a highlight it uses a distinct (stronger) color.

### 4.4 Away handling

- `/away [message]` sets you away (sends AWAY to server, you appear away in
  WHOIS); `/away` with no message removes away status.
- mIRC tracks away time and can auto-respond / prefix the title, and the
  toolbar Away button toggles state. `$away` returns away state, `$awaytime`
  the duration. Optionally announces away to channels.

### 4.5 Title bar contents

- The **main window title bar** shows the mIRC version and the active window's
  context, typically: `mIRC: <nick> on <server/network>` or
  `<channel> [<modes>]: <topic>` when a channel is active. It reflects the
  active child window. Channel windows' (maximized) titles show the channel
  name, current modes, and topic.

---

## 5. Default Keyboard Shortcuts (full list)

### Editbox / input
- **Cursor Up / Down** — command-line history (single-line editbox)
- **Ctrl+Cursor Up / Down** — command-line history (multi-line editbox)
- **Alt+Enter** — newline in multi-line editbox
- **Ctrl+Enter** — send a `/`-leading line as plain text (not a command)
- **Ctrl+B / U / I / R / K / O / E** — bold / underline / italic / reverse /
  color / plain(off) / strikethrough
- **Tab** — complete nick/channel/var/identifier (cycles); empty box = `/msg`
  last messager
- **Ctrl+D** — remove current nick from Tab list
- **Shift+Tab** — toggle focus editbox ↔ nicklist
- **Alt+Q** — show/hide second editbox

### Scrollback / cursor
- **Page Up / Down** — scrollback by page
- **Ctrl+Page Up / Down** — scrollback by line
- **Ctrl+Home / End** — cursor to start/end of editbox, or scrollback top/bottom
- **Ctrl+L** — scroll back to the line marker

### Search & help
- **Ctrl+F** — find text in current window
- **F1** — context help
- **Shift+F1** — help keyword search

### Window navigation
- **Alt+1 … Alt+9** — Nth window from Window menu
- **Alt+0** — main mIRC window
- **Ctrl+Tab / Ctrl+Shift+Tab** — cycle all windows fwd/back
- **Ctrl+N** — cycle channel windows
- **Ctrl+Q** — cycle query windows
- **Alt+X** — toggle maximize active window
- **Alt+Z** — close active window
- **Esc** — minimize active window
- **Ctrl+T** — toggle treebar ↔ window focus
- **Ctrl+Minimize** — minimize mIRC with password lock
- **Shift+Minimize** — minimize opposite to tray setting
- **Shift+RightClick** (titlebar) — roll/unroll window

### Switchbar (mouse)
- **Alt+LeftClick** — show/hide status window buttons
- **Shift+LeftClick** — close window
- **Ctrl+LeftClick** — minimize window

### Channels list
- **Shift+DoubleClick** — join channel minimized

### Copy
- **Ctrl+Copy** — copy text including control codes
- **Shift+Copy** — copy with line-breaks as displayed

### Toolbar / connect
- **Ctrl+Connect** — use next server in list
- **Shift+Connect** — connect to current server, same port

### Dialog hotkeys (from main window)
- **Alt+A** Favorites · **Alt+B** Address Book · **Alt+C** Chat ·
  **Alt+D** Aliases · **Alt+E** Connect · **Alt+I** Timer · **Alt+K** Colors ·
  **Alt+L** List Channels · **Alt+N** Notify · **Alt+O** Options ·
  **Alt+P** Popups · **Alt+R** Remote · **Alt+S** Send · **Alt+U** URLs List ·
  **Ctrl+Shift+Delete** History

---

## 6. Options Dialog Structure (high level)

The Options dialog (Alt+O) is a tree of categories on the left, settings panel
on the right. Top-level categories and their notable sub-pages:

- **Connect**
  - **Servers** — server list / network selection
  - **Options** — reconnect, retry, etc.
  - **IRC** (see below sits under here in some versions)
  - **Local Info** — user/email/host
  - **Identd** — ident server
  - **Firewall** — proxy/SOCKS
- **IRC**
  - **Messages** — timestamping, strip codes, message routing
  - **Highlight** — highlight words, sound/flash on match
  - **Catcher** — URL/file catcher
  - **Flood** — flood protection
  - **Control** — auto-op/voice, ban/ignore handling
  - **Logging** — auto-log, log format, reload logs
  - **Perform** — on-connect commands per network
- **DCC**
  - Options, Folders, Ignore, Server, Chat, etc.
- **Display**
  - **Windows** — window behavior, switchbar/treebar visibility & position,
    toolbar
  - **Tray** — system tray behavior
- **Messages** (display of events / event text formatting; in some versions
  nested under Display/IRC)
- **Sounds** — sound events, requests, beep/flash settings
- **Mouse** — single/double-click actions, nicklist actions, link handling
- **Menubar / Toolbar** — UI element toggles
- **Other** — confirmations (incl. paste warning), lock, misc.

(Category names and nesting vary slightly across mIRC versions; the groups
above are stable. The Colors dialog — Alt+K — is separate from Options and
edits the 0–15 palette and per-element window colors.)

---

## Sources

- mIRC Help — Key Combinations: https://www.mirc.com/help/html/key_combinations.html
- mIRC Help — Control Codes: https://www.mirc.com/help/html/control_codes.html
- mIRC Help — on TABCOMP: https://www.mirc.com/help/html/on_tabcomp.html
- mIRC Help — IRC Options: https://www.mirc.com/help/html/irc_options.html
- mIRC Colors: https://www.mirc.com/colors.html
- Modern IRC Formatting spec (mirrors mIRC palette/codes): https://modern.ircdocs.horse/formatting.html
- WikiChip — $timestamp / /timestamp: https://en.wikichip.org/wiki/mirc/identifiers/$timestamp
- defkey — mIRC shortcuts: https://defkey.com/mirc-shortcuts
