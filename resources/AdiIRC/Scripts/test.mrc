dialog example2 {
  title "Memo System"
  icon img/log.ico, 0
  size -1 -1 412 248
  list 3, 5 20 100 141 size
  edit "", 4, 130 20 276 121, left, multi, vsbar
  text "From:", 6, 6 5 60 13, left
  text "Message:", 7, 130 5 100 13, left
  button "&Reply", 8, 111 168 55 22, default
  button "&Forward", 9, 169 168 55 22
  button "&Block", 10, 227 168 55 22
  button "&Delete", 11, 285 168 55 22
  button "&Decode", 12, 343 168 55 22
  box "Selected Memo Control ", 14, 104 150 302 50
  box "Compose", 22, 5 150 90 50
  button "&New", 23, 22 168 55 22, default
  button "&Settings", 18, 193 215 90 20
  button "&OK", 17, 341 215 65 20, ok
  box "", 19, 5 200 180 40, hide
  text "", 20, 8 216 160 20, center, hide
  button "&Help", 21, 290 215 45 20
}
alias example2 {
  .timerexsel -m 1 1 did -c example2 3 $1
   did -o example2 3 $1 clicked!
   did -i example2 4 1 first 
   did -i example2 4 2 second
   did -i example2 4 3 third
   did -i example2 4 4 fourth
}
alias examp {
  dialog -m example2 example2
}
on 1:dialog:example2:*:*:{ 
    if ($devent = init) { did -a example2 3 default | did -a example2 3 default2 }
    if ($devent = sclick) { 
      if ($did == 3) { example2 $did(example2,3).sel }
    }
}