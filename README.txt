DIGIHITS V4.84 – TURBUGG FIXAD

EXAKT FEL
Online-matchen använde två olika turidentiteter:
- renderOnlineGame använde online_matches.current_user_id
- updateOnlineGameSubtitle använde gamla current_player_id

online_matches för kontobaserade matcher använder current_user_id. current_player_id hör till
det äldre lokala matchsystemet. Det kunde därför visa att båda spelarna väntade.

FIX
- En enda funktion, onlineIsMyTurn(), avgör nu tur överallt.
- All online-turlogik använder current_user_id + online_players.user_id.
- Namnet på den spelare man väntar på hämtas via display_name.
- Strängsäker UUID-jämförelse används.
- Befintliga aktiva matcher med tom/ogiltig current_user_id repareras automatiskt:
  första aktiva spelaren i turn_order sätts deterministiskt till aktuell spelare.
- Join-flödet har fallback så current_user_id alltid får en faktisk spelare.

JavaScript syntax: PASS.
Alla onclick-funktioner: PASS.
Dubbla HTML-ID:n: 0.
Obsolet current_player_id i online-systemet: 0.
Ingen SQL krävs.
