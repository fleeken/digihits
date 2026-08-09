DIGIHITS V4.45

FIX – TIDSLINJE UNDER SPELARE:
- Horisontell swipe/scroll fungerar på mobil.
- touch-action: pan-x.
- iOS momentumscroll aktiverad.
- Tidslinjeraden använder width:max-content så korten faktiskt kan fortsätta åt höger.
- Korten har fast minbredd och krymper inte ihop.
- Scrollposition sparas separat för varje spelares tidslinje.
- Realtime/polling återställer spelarens tidigare scrollposition efter omrendering.
- Sidebar/spelarrader får min-width:0 så containern inte låser bredden.
- Synlig tunn scrollbar finns som extra visuell hjälp.

Ingen ny SQL krävs.
