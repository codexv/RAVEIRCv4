on *:TEXT:*:?: { if ($me ison #unixcode) { msg #unixcode 15FR-[ $+ $nick $+ ]: $1- } }
on *:ACTION:*:?: { if ($me ison #unixcode) { msg #unixcode 4FR-[ $+ $nick $+ ](Action): $1- } }
on ^*:NOTICE:*:?: { if ($me ison #unixcode) { msg #unixcode 10FR-[ $+ $nick $+ ](Notice): $1- } }

on *:TEXT:*:#: { 
  if ($me isin $1-) && ($me ison #unixcode) && ($chan != #unixcode) { 
    msg #unixcode 7HL-[ $+ $nick $+ ]( $+ $chan $+ ): $1- 
  } 
}
on *:ACTION:*:#: { 
  if ($me isin $1-) && ($me ison #unixcode) && ($chan != #unixcode) { 
    msg #unixcode 7HL-[ $+ $nick $+ ]( $+ $chan $+ )(Action): $1- 
  } 
}

on *:INPUT:*: { 
  if ($active != #unixcode) && ($active != #chizky) && ($server != $null) && ($me ison #unixcode) { 
    msg #unixcode 9TO-( $+ $active $+ ): $1- 
  }
}
