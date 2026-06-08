dialog mmp.dialog {
  title "mIRC Media Player"
  icon "img\wmp.ico"
  size -1 -1 295 235
  box "play", 1, -12 -17 335 269
  menu "File", 2
  item "Open...", 4, 2
  item "Open URL...", 5, 2
  item break, 6, 2
  item "Exit", 7, 2, ok
  menu "Help", 8
  item "About", 9, 8
  button "", 10, 0 0 0 0
}
on *:dialog:mmp.dialog:*:*: { 
  if ($devent == init) { 
    dll $mmp.dll(mdx) SetMircVersion $version
    dll $mmp.dll(mdx) MarkDialog $dname
    dll $mmp.dll(mdx) SetControlMDX $dname 10 Positioner size minbox maxbox > $mmp.dll(dialog) 
  }
  if ($devent == menu) { 
    if ($did == 4) { mmp.open }
    if ($did == 5) { mmp.openurl }
    if ($did == 9) { run http://rave.coders-team.org/ } 
  }
  if ($devent == sclick) { 
    dll $mmp.dll(mdx) MoveControl $dname 1 * * $calc($dialog($dname).cw + 40) $calc($dialog($dname).ch + 34) 
  } 
}
alias mmp.open { 
  write -c " $+ $scriptdirmmp.html $+ "
  if (!$isdir(%mmp.playdir)) { set %mmp.playdir C:\ }
  set %mmp.media $sfile( $+ %mmp.playdir $+ ,Select A Media File To Play,Play)
  if (%mmp.media) { 
    write " $+ $scriptdirmmp.html $+ " <embed width="100%" height="100%" src=" $+ %mmp.media $+ ">
    dll $mmp.dll(html) attach $dll($mmp.dll(html),find,play)
    dll $mmp.dll(html) navigate $scriptdirmmp.html
    set %mmp.playdir $nofile(%mmp.media)
    dialog -t mmp.dialog $nopath(%mmp.media) - mIRC Media Player 
  } 
}
alias mmp.openurl { 
  write -c " $+ $scriptdirmmp.html $+ "
  set %mmp.mediaurl $$?"URL To Media File:"
  if (%mmp.mediaurl) { 
    write " $+ $scriptdirmmp.html $+ " <embed width="100%" height="100%" src=" $+ %mmp.mediaurl $+ ">
    dll $mmp.dll(html) attach $dll($mmp.dll(html),find,play)
    dll $mmp.dll(html) navigate $scriptdirmmp.html
    dialog -t mmp.dialog $nopath(%mmp.mediaurl) - mIRC Media Player
  } 
}
alias mmp.dll { 
  if ($$1 == mdx) { return " $+ $scriptdirMDX.dll $+ " }
  if ($$1 == dialog) { return $scriptdirDialog.mdx }
  if ($$1 == html) { return " $+ $scriptdirnHTMLn_2.92.dll $+ " } 
}
alias mmp { dialog -m $+ $1 mmp.dialog mmp.dialog }
