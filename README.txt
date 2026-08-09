DIGIHITS V4.31 – ONLINE STATE/BUG AUDIT

HUVUDBUGG FIXAD:
V4.30 pollade servern och renderOnlineGame återställde spelarens delvy varje synkning.
Därför försvann Gissa artist/låtnamn-fälten efter cirka en sekund.
Samma fel kunde påverka Placera kort.

V4.31:
- Gissa-vyn ligger kvar under hela samma låt.
- Placera-vyn ligger kvar under hela samma låt.
- Serverpolling uppdaterar data utan att kasta spelaren till annan skärm.
- Ny låt återställer korrekt till huvudvalet och tömmer artist/låtnamn.
- Fel placerings-resultat ligger kvar tills spelaren själv trycker TILL MINA MATCHER.
- Beslutstidslinjen ligger kvar öppen/stängd som spelaren valt.
- Playback-polling startar inte nya parallella timers varje serverrender.
- Online 'Vill du gissa först?' använder samma tydliga tvåknapps-modal som lokalläget.
- Drag/drop och tryckplacering bevaras.
- Fortsätt/Lås in/Byt låt/Spotify-flöde bevaras.
- JavaScript syntaxkontrollerad.
- Dubblettkontroll av onlinefunktioner utförd.

SQL:
Om ONLINE_V4_30.sql redan är körd behöver du INTE köra den igen.
