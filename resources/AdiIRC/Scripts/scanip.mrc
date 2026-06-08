;•••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
;============ Trademark ™ 2002  [ MEGA ]  Logos and Scripting. All Rights Reserved ==================
;====== Reproduction or distribution of this material in part or in full without prior consent is forbidden. =======
;========= Script author: siLverbLade on DALnet. Report errors to siLverbLade@rescueteam.com ==========
;•••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
;========================= Script Programming (Do not edit)  ================================
;•••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
raw *:*: { if (($istok(352.315,$numeric,46)) && ($istok(%scanip.who,$2,32))) { if ($numeric == 315) { unset %scanip.who | echo -a 5 • IAL for  $+ $2 $+  is updated •  } | halt } }
alias -l chkver {
  if ($version < 5.7) { secho ScanIP v1.0b works the best with mIRC v5.7 and above, please update your mIRC (www.mirc.co.uk). | secho Unloading $nopath($script) $+ .. | .unload -rs $script }
  else { secho ScanIP v1.0b is loaded. | secho Usage: /scanip [#channel] <searchstring> }
}
alias -l secho { echo -ai2 0,1 • 5 $1- }
alias scanip {
  if ($1) {
    var %i = 1, %o = $iif($1 ischan,$1,$active), %u = $iif($1 !ischan,$1,$2)
    if (%o !ischan) { secho Usage: /scanip [#channel] <searchstring> | return }
    if ($chan(%o).ial != $true) {
      linesep | secho 5 • IAL for  $+ %o $+  is not fully updated. Updating..
      set %scanip.who %o | who %o
      return
    }
    linesep | secho 1Scanning  $+ %o $+ : %u | var %scanip.ticks = $ticks
    if ($ialchan(%u,%o,0) == 0) { echo -a 0,1 •  1No match! }
    while (%i <= $ialchan(%u,%o,0)) {
      var %a = $ialchan(%u,%o,%i)
      secho 4 $+ $gettok(%a,1,33) 5( $+ $gettok(%a,2-,33) $+ ) - $cc($gettok(%a,$numtok(%a,46),46))
      inc %i
    }
    secho 1End of Scan, $calc(%i - 1) match(es) found in $calc(($ticks - %scanip.ticks) / 1000) sec(s) | linesep
  }
  else { echo -a 2,0* Usage: /scanip [#channel] <searchstring> }
}
on 1:JOIN:#: {
  if ($nick == $me) {
    echo -n @intel 5***11 You Have Joined # 5***
    if ($chan(#).ial != $true) {
      set %scanip.who # | who #
      return
    }
  }
}
alias cc {
  if ($1 == AD) { return Andorra } | if ($1 == AE) { return United Arab Emirates } | if ($1 == AF) { return Afghanistan } | if ($1 == AG) { return Antigua and Barbuda } | if ($1 == AI) { return Anguilla } | if ($1 == AL) { return Albania } | if ($1 == AM) { return Armenia } | if ($1 == AN) { return Netherlands Antilles } | if ($1 == AO) { return Angola } | if ($1 == AQ) { return Antarctica } | if ($1 == AR) { return Argentina } | if ($1 == AS) { return American Samoa }
  if ($1 == AT) { return Austria } | if ($1 == AU) { return Australia } | if ($1 == AW) { return Aruba } | if ($1 == AZ) { return Azerbaijan } | if ($1 == BA) { return Bosnia and Herzegovina } | if ($1 == BB) { return Barbados } | if ($1 == BD) { return Bangladesh } | if ($1 == BE) { return Belgium } | if ($1 == BF) { return Burkina Faso } | if ($1 == BG) { return Bulgaria } | if ($1 == BH) { return Bahrain } | if ($1 == BI) { return Burundi } | if ($1 == BJ) { return Benin } | if ($1 == BM) { return Bermuda }
  if ($1 == BN) { return Brunei Darussalam } | if ($1 == BO) { return Bolivia } | if ($1 == BR) { return Brazil } | if ($1 == BS) { return Bahamas } | if ($1 == BT) { return Bhutan } | if ($1 == BV) { return Bouvet Island } | if ($1 == BW) { return Botswana } | if ($1 == BY) { return Belarus } | if ($1 == BZ) { return Belize } | if ($1 == CA) { return Canada } | if ($1 == CC) { return Cocos (Keeling) Islands } | if ($1 == CF) { return Central African Republic } | if ($1 == CG) { return Congo } | if ($1 == CH) { return Switzerland }
  if ($1 == CI) { return Cote D'Ivoire (Ivory Coast) } | if ($1 == CK) { return Cook Islands } | if ($1 == CL) { return Chile } | if ($1 == CM) { return Cameroon } | if ($1 == CN) { return China } | if ($1 == CO) { return Colombia } | if ($1 == CR) { return Costa Rica } | if ($1 == CS) { return Czechoslovakia (former) } | if ($1 == CU) { return Cuba } | if ($1 == CV) { return Cape Verde } | if ($1 == CX) { return Christmas Island } | if ($1 == CY) { return Cyprus } | if ($1 == CZ) { return Czech Republic } | if ($1 == DE) { return Germany }
  if ($1 == DJ) { return Djibouti } | if ($1 == DK) { return Denmark } | if ($1 == DM) { return Dominica } | if ($1 == DO) { return Dominican Republic } | if ($1 == DZ) { return Algeria } | if ($1 == EC) { return Ecuador } | if ($1 == EE) { return Estonia } | if ($1 == EG) { return Egypt } | if ($1 == EH) { return Western Sahara } | if ($1 == ER) { return Eritrea } | if ($1 == ES) { return Spain } | if ($1 == ET) { return Ethiopia } | if ($1 == FI) { return Finland } | if ($1 == FJ) { return Fiji } | if ($1 == FK) { return Falkland Islands (Malvinas) } | if ($1 == FM) { return Micronesia }
  if ($1 == FO) { return Faroe Islands } | if ($1 == FR) { return France } | if ($1 == FX) { return France, Metropolitan } | if ($1 == GA) { return Gabon } | if ($1 == GB) { return Great Britain (UK) } | if ($1 == GD) { return Grenada } | if ($1 == GE) { return Georgia } | if ($1 == GF) { return French Guiana } | if ($1 == GH) { return Ghana } | if ($1 == GI) { return Gibraltar } | if ($1 == GL) { return Greenland } | if ($1 == GM) { return Gambia } | if ($1 == GN) { return Guinea } | if ($1 == GP) { return Guadeloupe } | if ($1 == GQ) { return Equatorial Guinea } | if ($1 == GR) { return Greece }
  if ($1 == GS) { return S. Georgia and S. Sandwich Isls. } | if ($1 == GT) { return Guatemala } | if ($1 == GU) { return Guam } | if ($1 == GW) { return Guinea-Bissau } | if ($1 == GY) { return Guyana } | if ($1 == HK) { return Hong Kong } | if ($1 == HM) { return Heard and McDonald Islands } | if ($1 == HN) { return Honduras } | if ($1 == HR) { return Croatia (Hrvatska) } | if ($1 == HT) { return Haiti } | if ($1 == HU) { return Hungary } | if ($1 == ID) { return Indonesia } | if ($1 == IE) { return Ireland } | if ($1 == IL) { return Israel } | if ($1 == IN) { return India }
  if ($1 == IO) { return British Indian Ocean Territory } | if ($1 == IQ) { return Iraq } | if ($1 == IR) { return Iran } | if ($1 == IS) { return Iceland } | if ($1 == IT) { return Italy } | if ($1 == JM) { return Jamaica } | if ($1 == JO) { return Jordan } | if ($1 == JP) { return Japan } | if ($1 == KE) { return Kenya } | if ($1 == KG) { return Kyrgyzstan } | if ($1 == KH) { return Cambodia } | if ($1 == KI) { return Kiribati } | if ($1 == KM) { return Comoros } | if ($1 == KN) { return Saint Kitts and Nevis } | if ($1 == KP) { return Korea (North) } | if ($1 == KR) { return Korea (South) }
  if ($1 == KW) { return Kuwait } | if ($1 == KY) { return Cayman Islands } | if ($1 == KZ) { return Kazakhstan } | if ($1 == LA) { return Laos } | if ($1 == LB) { return Lebanon } | if ($1 == LC) { return Saint Lucia } | if ($1 == LI) { return Liechtenstein } | if ($1 == LK) { return Sri Lanka } | if ($1 == LR) { return Liberia } | if ($1 == LS) { return Lesotho } | if ($1 == LT) { return Lithuania } | if ($1 == LU) { return Luxembourg } | if ($1 == LV) { return Latvia } | if ($1 == LY) { return Libya } | if ($1 == MA) { return Morocco } | if ($1 == MC) { return Monaco } | if ($1 == MD) { return Moldova }
  if ($1 == MG) { return Madagascar } | if ($1 == MH) { return Marshall Islands } | if ($1 == MK) { return Macedonia } | if ($1 == ML) { return Mali } | if ($1 == MM) { return Myanmar } | if ($1 == MN) { return Mongolia } | if ($1 == MO) { return Macau } | if ($1 == MP) { return Northern Mariana Islands } | if ($1 == MQ) { return Martinique } | if ($1 == MR) { return Mauritania } | if ($1 == MS) { return Montserrat } | if ($1 == MT) { return Malta } | if ($1 == MU) { return Mauritius } | if ($1 == MV) { return Maldives } | if ($1 == MW) { return Malawi } | if ($1 == MX) { return Mexico }
  if ($1 == MY) { return Malaysia } | if ($1 == MZ) { return Mozambique } | if ($1 == NA) { return Namibia } | if ($1 == NC) { return New Caledonia } | if ($1 == NE) { return Niger } | if ($1 == NF) { return Norfolk Island } | if ($1 == NG) { return Nigeria } | if ($1 == NI) { return Nicaragua } | if ($1 == NL) { return Netherlands } | if ($1 == NO) { return Norway } | if ($1 == NP) { return Nepal } | if ($1 == NR) { return Nauru } | if ($1 == NT) { return Neutral Zone } | if ($1 == NU) { return Niue } | if ($1 == NZ) { return New Zealand (Aotearoa) } | if ($1 == OM) { return Oman }
  if ($1 == PA) { return Panama } | if ($1 == PE) { return Peru } | if ($1 == PF) { return French Polynesia } | if ($1 == PG) { return Papua New Guinea } | if ($1 == PH) { return Philippines } | if ($1 == PK) { return Pakistan } | if ($1 == PL) { return Poland } | if ($1 == PM) { return St. Pierre and Miquelon } | if ($1 == PN) { return Pitcairn } | if ($1 == PR) { return Puerto Rico } | if ($1 == PT) { return Portugal } | if ($1 == PW) { return Palau } | if ($1 == PY) { return Paraguay } | if ($1 == QA) { return Qatar } | if ($1 == RE) { return Reunion } | if ($1 == RO) { return Romania } | if ($1 == RU) { return Russian Federation }
  if ($1 == RW) { return Rwanda } | if ($1 == SA) { return Saudi Arabia } | if ($1 == SB) { return Solomon Islands } | if ($1 == SC) { return Seychelles } | if ($1 == SD) { return Sudan } | if ($1 == SE) { return Sweden } | if ($1 == SG) { return Singapore } | if ($1 == SH) { return St. Helena } | if ($1 == SI) { return Slovenia } | if ($1 == SJ) { return Svalbard and Jan Mayen Islands } | if ($1 == SK) { return Slovak Republic } | if ($1 == SL) { return Sierra Leone } | if ($1 == SM) { return San Marino } | if ($1 == SN) { return Senegal } | if ($1 == SO) { return Somalia } | if ($1 == SR) { return Suriname } | if ($1 == ST) { return Sao Tome and Principe }
  if ($1 == SU) { return USSR (former) } | if ($1 == SV) { return El Salvador } | if ($1 == SY) { return Syria } | if ($1 == SZ) { return Swaziland } | if ($1 == TC) { return Turks and Caicos Islands } | if ($1 == TD) { return Chad } | if ($1 == TF) { return French Southern Territories } | if ($1 == TG) { return Togo } | if ($1 == TH) { return Thailand } | if ($1 == TJ) { return Tajikistan } | if ($1 == TK) { return Tokelau } | if ($1 == TM) { return Turkmenistan } | if ($1 == TN) { return Tunisia } | if ($1 == TO) { return Tonga } | if ($1 == TP) { return East Timor } | if ($1 == TR) { return Turkey } | if ($1 == TT) { return Trinidad and Tobago }
  if ($1 == TV) { return Tuvalu } | if ($1 == TW) { return Taiwan } | if ($1 == TZ) { return Tanzania } | if ($1 == UA) { return Ukraine } | if ($1 == UG) { return Uganda } | if ($1 == UK) { return United Kingdom } | if ($1 == UM) { return US Minor Outlying Islands } | if ($1 == US) { return United States } | if ($1 == UY) { return Uruguay } | if ($1 == UZ) { return Uzbekistan } | if ($1 == VA) { return Vatican City State (Holy See) } | if ($1 == VC) { return Saint Vincent and the Grenadines } | if ($1 == VE) { return Venezuela } | if ($1 == VG) { return Virgin Islands (British) } | if ($1 == VI) { return Virgin Islands (U.S.) }
  if ($1 == VN) { return Viet Nam } | if ($1 == VU) { return Vanuatu } | if ($1 == WF) { return Wallis and Futuna Islands } | if ($1 == WS) { return Samoa } | if ($1 == YE) { return Yemen } | if ($1 == YT) { return Mayotte } | if ($1 == YU) { return Yugoslavia } | if ($1 == ZA) { return South Africa } | if ($1 == ZM) { return Zambia } | if ($1 == ZR) { return Zaire } | if ($1 == ZW) { return Zimbabwe } | if ($1 == COM) { return US Commercial } | if ($1 == EDU) { return US Educational } | if ($1 == GOV) { return US Government } | if ($1 == INT) { return International } | if ($1 == MIL) { return US Military } | if ($1 == NET) { return Network } | if ($1 == ORG) { return Non-Profit Organization }
  if ($1 == ARPA) { return Old style Arpanet } | if ($1 == NATO) { return Nato field }
  else { return unknown }
}

alias SF8 { scanip # $$?="Enter Searchstring: (nick!id@isp)" }

#opthanx on
on 1:OP:#:{
  if ($opnick == $me) {
    echo -a 5*** 4OPS 5on4 $chan 5by8 %spc $+ $nick 5:: %version 5::
  }
}
on 1:voice:#:{
  if ($vnick == $me) {
    echo -a 5*** You were 4Voiced 5at4 $chan 5by8 %spc $+ $nick %version
  }
}
on 1:devoice:#:{
  if ($vnick == $me) {
    echo -a 4*** You were 5DeVoiced 4at5 $chan 4by8 %spc $+ $nick %version
  }
}
#opthanx end

menu channel,menubar,status {
  -
  Ban Enforcer ( %bforce )
  .ON:set %bforce ON | /echo -a * Ban Enforcer is now ON! %logo
  .OFF:set %bforce OFF | /echo -a * Ban Enforcer is now OFF! %logo
}

on 1:ban:#: {
  if ($banmask iswm $address($me,5)) { 
    cs unban $chan
    set -u30 %chbfrom $chan
    set -u30 %chbalert 1
    halt
  }
  if ($me isop $chan) {
    if (%bforce == ON) {
      set %bfno $ialchan($banmask,#,0)
      var %i = 1
      :bfloop
      if ((%bfno > 0) && (%bfno >= %i)) {   
        kick $chan $gettok($ialchan($banmask,#,%i),1,33) 5ø 1Banned by 4[5 $nick 4] 5ø %kicklogo 5ø
        inc %i
        goto bfloop
      }
      :bfend
    } 
  }
}

on 1:notice:*have been cleared*:?: {
  if (%chbalert == 1) {
    join %chbfrom
    unset %chbfrom
    unset %chbalert
  }
}

;•••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
;=========================== Secure Query for MEGA v1.01  ================================
;•••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
on *:load:{ 
  if ($version < 5.91) echo -a  $+ $colour(info2) $+ *** This addon will not work properly with mIRC $version $+ , you need latest mirc in order to use this addon. | beep 
  echo -a  4Team Nexgen's Secure Query v2.17 | echo -a  4Please type: /secure.query in channel to begin dialog.
}
;[read write data/setting.ini]
alias _vr {
  if ($exists(data\setting.ini) == $false) { mkdir data | write -c data\setting.ini }
  return $readini data\setting.ini $$1 $$2 
}
alias _vw {
  if ($exists(data\setting.ini) == $false) { mkdir data | write -c data\setting.ini }
  writeini data\setting.ini $$1 $$2 $$3-
}
alias _vrem {
  if ($exists(data\setting.ini) == $false) { mkdir data | write -c data\setting.ini }
  remini data\setting.ini $$1 $$2 
}
menu query,menubar {
  Secure Query ( %mega.squery )
  .Setup:secure.query
  .Add Access:.auser -a securequery $address($1,3) | .msg $1 • You have free access to message me • (Automated Msg) • | $ae •12• user added » (12 $address($1,3) ) | if ($dialog(querycon) != $null) { did -r querycon 45 | s.levels } 
  .-
  .ON $sqo: _vw querycon switch on | set %mega.squery ON | echo -a 10*** Secure Query is now [[ ACTIVATED ]
  .OFF $sqf: _vw querycon switch off | set %mega.squery OFF | echo -a 10*** Secure Query is now [[ DISABLED ]
  -
}
menu status {
  Secure Query ( %mega.squery )
  .Setup:secure.query
  .-
  .ON $sqo: _vw querycon switch on | set %mega.squery ON | echo -a 10*** Secure Query is now [[ ACTIVATED ]
  .OFF $sqf: _vw querycon switch off | set %mega.squery OFF | echo -a 10*** Secure Query is now [[ DISABLED ]
  -
}

alias -l sqo { 
  if ($_vr(querycon,switch) == on) { return [x] }
  else { return  }
}
alias -l sqf { 
  if ($_vr(querycon,switch) == off) { return [x] }
  else { return }
}
alias secure.query {
  if ($version < 5.91) { echo -a 4This addon will not work properly with mIRC $version $+ , please upgrade to latest mIRC www.mirc.com | beep | halt }
  if ($dialog(querycon) == $null) { dialog -m querycon querycon } 
}
alias secure.query.nick {
  if ($version < 5.91) { echo -a 4This addon will not work properly with mIRC $version $+ , please upgrade to latest mIRC www.mirc.com | beep | halt }
  dialog -m $_vr(querycon,query.nick) querycon1
  _vrem querycon lastmsg
}
dialog querycon1 {
  title "Secure Query"
  size -1 -1 160 81
  option dbu
  box "", 33, 7 14 146 42
  button "Accept", 28, 9 62 25 10, disable default ok
  button "Ignore", 26, 36 62 25 10, disable
  button "Decline", 27, 63 62 25 10, disable
  edit "", 1, 32 21 119 10, read autohs
  edit "", 30, 32 31 119 10, read autohs
  edit "", 29, 32 41 119 10, read autohs
  check "enable secure query", 31, 10 6 70 7
  button "Setup", 2, 92 63 21 8
  button "Add Access", 3, 114 63 37 8, disable
  box "", 4, 7 57 146 18
  text "nick", 5, 9 22 10 8
  text "address", 6, 9 32 19 8
  text "message", 7, 9 42 21 8
  text "", 8, 130 5 27 8, right
  text "", 9, 76 5 53 8, right
}
dialog querycon {
  title "Secure Query v2.17"
  size -1 -1 167 119
  option dbu
  button "OK", 12, 70 104 25 10, default ok
  tab "Config", 2, 2 1 163 115
  edit "", 3, 4 43 159 10, tab 2 autohs
  text "Standby Message", 13, 4 35 44 7, tab 2
  edit "", 4, 4 60 159 10, tab 2 autohs
  check "Enable", 15, 11 83 32 10, tab 2
  button "Select Sound", 16, 45 83 37 10, tab 2
  box "Audible Alert On Query Request", 17, 8 75 80 22, tab 2
  edit "", 208, 107 79 17 9, tab 2
  button "-", 206, 99 81 6 6, tab 2
  text "seconds", 210, 135 80 20 7, tab 2
  box "auto-close dialog", 209, 95 71 63 30, tab 2
  button "+", 207, 126 81 6 6, tab 2
  text "Decline Message", 14, 4 53 44 7, tab 2
  check "Enable Secure Query", 33, 11 20 66 10, tab 2
  check "Notify user has access", 49, 92 20 66 10, tab 2
  check "Enable auto-close", 50, 99 89 58 10, tab 2
  box "", 51, 7 15 154 18, tab 2
  tab "Log", 11
  list 34, 7 20 42 50, tab 11 sort size hsbar
  button "Remove", 35, 7 73 29 8, tab 11
  button "Copy", 39, 131 72 29 8, tab 11
  check "Log query requests", 43, 7 95 58 10, tab 11
  edit "", 52, 86 84 74 10, tab 11 autohs
  button "Add access", 53, 48 85 37 8, tab 11
  edit "", 64, 54 21 106 50, tab 11 read multi vsbar
  button "Remove all", 65, 7 83 29 8, tab 11
  tab "Protection", 32
  radio "Universal mask *!*@*", 211, 15 42 62 12, tab 32
  radio "Host mask ignore", 212, 15 56 62 9, tab 32
  box "Query flood ignore type", 213, 11 34 70 34, tab 32
  edit "", 214, 87 54 10 10, tab 32
  check "Enable", 219, 89 42 40 10, tab 32
  box "Query Flood Protection", 216, 85 34 70 34, tab 32
  edit "", 217, 125 54 15 10, tab 32
  text "queries in", 215, 99 56 24 7, tab 32
  text "secs", 218, 141 55 17 7, tab 32
  tab "Access", 40
  list 41, 11 42 146 50, tab 40 sort size hsbar
  button "Remove", 42, 12 96 37 8, disable tab 40
  text "User Access", 44, 12 34 29 8, tab 40
  edit "", 45, 26 19 106 10, tab 40 autohs
  button "Add", 46, 134 20 29 8, disable tab 40
  text "Address", 47, 6 20 19 8, tab 40
  tab "About", 54
  box "", 55, 30 23 106 70, tab 54
  text "Author:", 56, 60 31 17 8, tab 54
  text "Version", 58, 60 42 17 8, tab 54
  link "www.team-nexgen.com", 59, 56 80 59 8, tab 54
  text "sneakers", 60, 84 31 22 8, tab 54
  text "v3.01", 61, 84 42 14 8, tab 54
  text "It is important to keep your Team Nexgen addon's updated. You will find them on our web site.", 63, 34 55 97 20, tab 54
}
on *:dialog:*:init:*:{ 
  if ($dialog(querycon) == $dname) {
    if ($_vr(querycon,switch) == on) { did -c querycon 33 } 
    elseif ($_vr(querycon,switch) == $null) { _vw querycon switch on | did -c querycon 33 }
    if ($_vr(querycon,ignore.host) == $null) { _vw querycon ignore.host on | _vw querycon ignore.uni off }
    if ($_vr(querycon,decline) == $null) { _vw querycon decline Sorry, I have declined your query, please try a more convient time. }
    if ($_vr(querycon,ignore.uni) == on) && ($_vr(querycon,ignore.host) == off) { did -c querycon 211 1 }
    else  did -c querycon 212 1
    did -o querycon 3 1 $_vr(querycon,standby)
    did -o querycon 4 1 $_vr(querycon,decline)
    if ($_vr(querycon,soundswitch) == on) { did -c querycon 15 }
    if ($_vr(querycon,timer) == $null) { _vw querycon timer 240 }
    did -o querycon 208 1 $_vr(querycon,timer) 
    if ($_vr(querycon,max.query) == $null) { _vw querycon max.query 5 | did -o querycon 214 1 $_vr(querycon,max.query) }
    else  did -o querycon 214 1 $_vr(querycon,max.query) 
    if ($_vr(querycon,max.query.sec) == $null) {  _vw querycon max.query.sec 20 | did -o querycon 217 1 $_vr(querycon,max.query.sec) }
    else did -o querycon 217 1 $_vr(querycon,max.query.sec) 
    if ($_vr(querycon,netflood) == on) did -c querycon 219
    else did -b querycon 211,217,212,214
    if ($_vr(querycon,log) == on) { did -c querycon 43 }
    elseif ($_vr(querycon,log) == $null) { _vw querycon log on | did -c querycon 43 }
    if ($_vr(querycon,notifyaccess) == on) { did -c querycon 49 }
    elseif ($_vr(querycon,notifyaccess) == $null) { _vw querycon notifyaccess on | did -c querycon 49 }
    if ($_vr(querycon,auto-close) == on) { did -c querycon 50 }
    did -b querycon 46,42 
    nick.list 
    s.levels
    did -z querycon 34
  }
  if ($dialog($dname) == $_vr(querycon,query.nick)) { 
    if ($_vr(querycon,auto-close) == on) { %qs.nick = $_vr(querycon,query.nick) | .timer 1 $sq_t close.qw }
  }
}
on *:dialog:querycon:edit:*:{ 
  if ($did == 3) { 
    if ($did(querycon,3).text != $null) {    
      _vw querycon standby $did(querycon,3).text 
    }
  }
  if ($did == 4) { 
    if ($did(querycon,4).text != $null) {    
      _vw querycon decline $did(querycon,4).text 
    }
  }
  if ($did == 45) { 
    if ($did(querycon,45).text != $null) { did -e querycon 46 }
    elseif ($did(querycon,45).text == $null) { did -b querycon 46 }
  }
  if ($did == 208) { 
    if ($did(querycon,208).text != $null) {    
      _vw querycon timer $did(querycon,208).text 
    }
  }
  if ($did == 214) { 
    if ($did(querycon,214).text != $null) {  
      _vw querycon max.query $did(querycon,214).text 
    }  
  }
  if ($did == 217) { 
    if ($did(querycon,217).text != $null) {  
      _vw querycon max.query.sec $did(querycon,217).text 
    }
  }
}

on *:dialog:*:sclick:*:{ 
  if (Query request $dname == $dialog($dname).title) { 
    if ($did == 2) { secure.query }   
    if ($did == 3) {
      auser -a securequery $address($did(1,$did(1)),3) $did(1,$did(1)) | did -b $did(1,$did(1)) 3 
      if ($_vr(querycon,notifyaccess) == on) { if ($server != $null) { .msg $did(1,$did(1)) • You have free access to message me • (Automated Msg) • } }
    }   
    if ($did == 27) { .ignore -pu180 $did(30,$did(30)) | .msg $did(1,$did(1)) • $_vr(querycon,decline) • (Automated Msg) • |  dialog -x $did(1,$did(1)) }
    if ($did == 28) {  
      .ignore -r $address($did(1,$did(1)),2) | query $did(1,$did(1)) | .timer -m 1 1 echo $did(1,$did(1)) < $+ $did(1,$did(1)) $+ > $did(29,$did(29)) |  _vrem querycon lastmsg 
      if ($server != $null) { .msg $did(1,$did(1)) • Query Request Accepted • (Automated Msg) • }
      dialog -x $did(1,$did(1))
    }
    if ($did == 26) { .ignore -p $address($did(1,$did(1)),3) | dialog -x $did(1,$did(1)) }
    if ($did == 31) {
      if ($_vr(querycon,switch) != on) { _vw querycon switch on }
      else { _vw querycon switch off  }
    }
  }
  if ($dialog(querycon) ==  $dname) { 
    if ($did == 15) { 
      if ($_vr(querycon,soundswitch) != on) {  _vw querycon soundswitch on | did -c querycon 15 }
      else { _vw querycon soundswitch off | did -u querycon 15 }
    }
    if ($did == 16) { setquerysound }
    if ($did == 206) { if (%timer > 0) { dec %timer 1 | did -o querycon 208 1 %timer | _vw querycon timer %timer } }
    if ($did == 207) { inc %timer 1 | did -o querycon 208 1 %timer | _vw querycon timer %timer }

    if ($did == 39) { clipboard < $+ $did(34,$did(34).sel) $+ > $sr($did(34,$did(34).sel),msg) }
    if ($did == 34) { did -r querycon 64 | did -a querycon 64 $chr(91) $+ $sr($did(34,$did(34).sel),date) $+ $chr(93) | did -a querycon 64 $crlf $sr($did(34,$did(34).sel),msg) | did -o querycon 52 1 $_vr(securequery,$did(34,$did(34).sel))) }
    if ($did == 33) {
      if ($_vr(querycon,switch) != on) { _vw querycon switch on }
      else { _vw querycon switch off }
    }
    if ($did == 35) { write -ds $+ $did(34,$did(34).sel) securequery\names.txt | _vrem securequery $did(34,$did(34).sel)) | .timer -m 1 1 nick.list }
    if ($did == 41) { did -e querycon 42,46 | did -o querycon 45 1 $did(41,$did(41).sel)) }
    if ($did == 42) { ruser $did(41,$did(41).sel) | s.levels }
    if ($did == 43) { 
      if ($_vr(querycon,log) != on) { _vw querycon log on | did -c querycon 43 }
      else { _vw querycon log off }
    }  
    if ($did == 50) { 
      if ($_vr(querycon,auto-close) != on) { _vw querycon auto-close on | did -c querycon 50 }
      else { _vw querycon auto-close off }
    }
    if ($did == 53) { 
      if ($did(querycon,52).text != $null) {    
        .auser -a  securequery $did(querycon,52).text | did -r querycon 52 
      }
    }
    if ($did == 49) { 
      if ($_vr(querycon,notifyaccess) != on) { _vw querycon notifyaccess on | did -c querycon 49 }
      else { _vw querycon notifyaccess off }
    }
    if ($did == 46) { 
      if ($did(querycon,45).text != $null) {    
        .auser -a  securequery $did(querycon,45).text | did -r querycon 45 | s.levels
      }
    }
    if ($did == 65) { .remove securequery\names.txt | .remove securequery\logs.ini | did -r querycon 64,34,52 }    
    if ($did == 211) {
      if ($_vr(querycon,ignore.uni) == off) { _vw querycon ignore.uni on | _vw querycon ignore.host off | did -c querycon 211 | did -u querycon 212 }
      else { _vw querycon ignore.uni off | _vw querycon ignore.host on | did -u querycon 211 | did -c querycon 212 }
    }
    if ($did == 212) {
      if ($_vr(querycon,ignore.host) == off) { _vw querycon ignore.host on | _vw querycon ignore.uni off | did -c querycon 212 | did -u querycon 211 }
      else { _vw querycon ignore.host off | _vw querycon ignore.uni on | did -u querycon 212 | did -c querycon 211 }
    }
    if ($did == 219) {
      if ($_vr(querycon,netflood) == off) { _vw querycon netflood on | did -c querycon 219 | did -e querycon 211,217,212,214 }
      else { _vw querycon netflood off | did -u querycon 219 | did -b querycon 211,217,212,214 }
    }
  }
}
alias -l sr {
  if ($exists(securequery\logs.ini) == $false) { mkdir securequery | write -c securequery\logs.ini }
  return $readini securequery\logs.ini $$1 $$2 
}
alias -l sw {
  if ($exists(securequery\logs.ini) == $false) { mkdir securequery | write -c securequery\logs.ini }
  if (%wormmsg isin $$3-) {
    if ((150 isin $level($nick)) && (%friend.auto.kick == ON)) { echo @intel (×) 2Infected Client From 3FRIEND2:4 $nick 1("$decode")  | goto end }
    if (%mega.all.autokicks == Off) { set %secho01 AutoKicks are OFF | goto silentecho }
    if (($nick !isop #makati) && ($me isop #makati)) {
      .kick #makati $nick %wormkickmsg
      .ban -u500 #makati $nick 1
      .echo @intel (×) 2Infected Client From:4 $nick 1("$decode")  
      .echo -a 4(×) 10Query Blocked! 4(×)
      .halt
    }
    :silentecho
    .echo -a 4(×) 10Query Blocked! 4(×)
    .echo @intel (×) 2Infected Client From:4 $nick 1("$decode") 2[ %secho01 ]
    .set %secho01 You are Not Opped on #makati
    .halt
  }
  if (%chaninvmsg isin $$3-) {
    if ((150 isin $level($nick)) && (%friend.auto.kick == ON)) { goto end }
    .msg $nick %version Invite spam detected! Your Query has been CLOSED! ( Automated Message )
    if (($nick !isop #makati) && ($me isop #makati)) {
      if (%mega.all.autokicks == Off) { set %secho02 AutoKicks are OFF | goto ignore }
      .kick #makati $nick %privadskickmsg 
      .ban #makati $nick 2
      .echo @intel (×) 2Invite Spam Detected From:4 $nick 1("#")
      .echo -a 4(×) 10Query Blocked! 4(×)
      .set %echotype @intel
      .whois $nick
      .halt
    }
    :ignore
    .echo @intel (×) 2Invite Spam Detected From:4 $nick 1("#") 2[ %secho02 ] 
    .echo -a 4(×) 10Query Blocked! 4(×)
    .set %echotype @intel
    .set %secho02 You are Not Opped on #makati
    .whois $nick
    .halt 
  }
  if ((%webinvmsg1 isin $$3-) || (%webinvmsg2 isin $$3-) || (%serverinvmsg isin $$3-)) {
    if ((150 isin $level($nick)) && (%friend.auto.kick == ON)) { goto end }
    .msg $nick %version Invite spam detected! Your Query has been CLOSED! ( Automated Message )
    if (($nick !isop #makati) && ($me isop #makati)) {
      if (%mega.all.autokicks == Off) { set %secho03 AutoKicks are OFF | goto wignore }
      .kick #makati $nick %webkickmsg
      .ban #makati $nick 2
      .echo @intel (×) 2Invite Spam Detected From:4 $nick 1("Web/Server Ads")
      .echo -a 4(×) 10Query Blocked! 4(×)
      .set %echotype @intel
      .whois $nick
      .halt
    }
    :wignore
    .echo @intel (×) 2Invite Spam Detected From:4 $nick 1("Web/Server Ads") 2[ %secho03 ] 
    .echo -a 4(×) 10Query Blocked! 4(×)
    .set %echotype @intel
    .set %secho03 You are Not Opped on #makati
    .whois $nick
    .halt
  }
  if ($3 == slm) {
    if ((150 isin $level($nick)) && (%friend.auto.kick == ON)) { goto end }
    .msg $nick %version Invite spam detected! Your Query has been CLOSED! ( Automated Message )
    if (($nick !isop #makati) && ($me isop #makati)) {
      if (%mega.all.autokicks == Off) { set %secho02 AutoKicks are OFF | goto slmignore }
      .kick #makati $nick 5ø 4Banned 5ø 1Message Spam Detected! 5ø4 MEGA v1.01 5ø 
      .ban #makati $nick 2
      .echo @intel (×) 2Message Spam Detected From:4 $nick 1("slm")
      .echo -a 4(×) 10Query Blocked! 4(×)
      .set %echotype @intel
      .whois $nick
      .halt
    }
    :slmignore
    .echo @intel (×) 2Invite Spam Detected From:4 $nick 1("slm") 2[ %secho02 ] 
    .echo -a 4(×) 10Query Blocked! 4(×)
    .set %echotype @intel
    .set %secho02 You are Not Opped on #makati
    .whois $nick
    .halt 
  }
  :end
  writeini securequery\logs.ini $$1 $$2 $$3-
}
alias -l srem {
  if ($exists(securequery\logs.ini) == $false) { mkdir securequery | write -c  securequery\logs.ini }
  remini securequery\logs.ini $$1 $$2 
}
on ^*:open:?: {
  if ($_vr(querycon,switch) == $null) { _vw querycon switch on }
  if ($finddir($mircdir\,securequery*,1) == $null) { mkdir securequery }
  if ($_vr(querycon,netflood) != on) {
    inc %upflood15 1  
    if (%upflood15 > $_vr(querycon,max.query)) { 
      if ($_vr(querycon,ignore.uni) == on) { .ignore -pu $+ $_vr(querycon,max.query.sec) *!*@* }
      else { .ignore -pu $+ $_vr(querycon,max.query.sec) $wildsite }
      echo -a 4[ ALERT ] $nick is Query Flooding. User ( $+ $wildsite $+ ) now ignored for $_vr(querycon,max.query.sec) secs.
    } 
    .timer 1 60 unset %upflood15     
  }
  if ($_vr(querycon,standby) == $null) { _vw querycon standby Please standby for acknowledgement. I am using a secure query event. You will be notified if accepted. Until then your msgs will be ignored. }
  if ($level($address($nick,3)) == securequery) { goto end }
  if ($network == WonderNet) && ($nick == Global) { goto end } 
  if ($network == WonderNet) && ($nick == Nickserv) { goto end } 
  if ($network == WonderNet) && ($nick == Chanserv) { goto end } 
  if ($network == WonderNet) && ($nick == Memoserv) { goto end } 
  if ($_vr(querycon,switch) == on) {
    if ($_vr(querycon,soundswitch) == on) { if ($_vr(querycon,sound) != $null) { splay $_vr(querycon,sound) } }
    echo -a  $+ $colour(notice) $+ Query with $nick 
    echo -a  $+ $colour(notice) $+ Waiting for acknowledgement...
    if ($_vr(querycon,log) == on) { 
      if ($read(securequery\names.txt, w, $nick) == $nick) { write -ds $+ $nick securequery\names.txt }
      sw $nick date $asctime(h:nn:sstt m/d) | sw $nick msg $strip($1-,burc) | write securequery/names.txt $nick | _vw securequery $nick $wildsite | nick.list
    }
    .msg $nick • $_vr(querycon,standby) • (Automated Msg) •
    _vw  querycon query.nick $nick
    if ($dialog($nick) == $null) { secure.query.nick }
    dialog -t $_vr(querycon,query.nick) Query request $nick
    did -o $nick 1 1 $_vr(querycon,query.nick)
    .ignore -pu120 $wildsite    
    whosqial $nick  
    did -o $nick 9 1 ( $+ $network $+ )  
    did -o $nick 30 1 updating... 
    did -o $nick 29 1 $strip($1-,burc)
    did -o $nick 8 1 $asctime(hh:nntt)

    if ($_vr(querycon,switch) == on) { did -c $nick 31 }
    haltdef
    :end 
  }  
}
#sqialud off
raw 352:*: {
  if ($dialog($6) != $null) { did -o $6 30 1 *!* $+ $3 $+ @ $+ $4  | did -e $6 26,28,3,27 | .timer 1 5 .disable #sqialud | haltdef }
  else { if ($dialog($6) != $null) { did -e $6 26,28,3,27 | .timer 1 5 .disable #sqialud | halt } }
  halt
}
raw 315:*: {
  halt
} 
#sqialud end
alias -l whosqial { .enable #sqialud | .who $$1 } 
alias -l secure.dir {
  mkdir  " $+ $mircdirsecurequery $+ \ $+ " 
  return securequery $+ \ 
}
alias -l sq_t { 
  return $_vr(querycon,timer) 
}

alias -l nick.list {
  if ($dialog(querycon) != $null) { 
    did -r querycon 64,34,52 
    var %fst = $lines(securequery\names.txt)   
    var %f = 1
    while (%f <= %fst) { did -a querycon 34 $read(securequery\names.txt,%f) | inc %f 1 }
  }
}
alias -l s.levels {
  did -r querycon 41
  var %s.l = $ulist(*,securequery,0)
  if (%s.l == 0) { did -b querycon 42 | return }
  else  did -e querycon 42
  var %s.w = 0
  :loop
  inc %s.w
  if (%s.w <= %s.l) { did -a querycon 41  $ulist(*,securequery,%s.w) | goto loop }
  else return
}
alias -l close.qw { if ($dialog(%qs.nick) != $null) dialog -x %qs.nick }
alias -l setquerysound {
  _vw querycon sound $$dir="Choose a wav:" $mircdir*.wav;*mp3;*.mid 
}

;•••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
;========================== Trademark ™ 2002  « scryptor »  ===============================
;•••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
