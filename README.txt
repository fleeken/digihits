DIGIHITS V4.34 – ETT SPELLÄGE + SNABB REALTIME

STARTSIDAN:
- Spela lokalt är borttaget.
- Digihits har nu ett enda matchsystem:
  SKAPA MATCH
  GÅ MED
  MINA MATCHER
- Samma match kan spelas direkt bredvid varandra eller fortsätta timmar/dagar senare.

SNABB TURVÄXLING:
- Supabase Realtime är nu primär synk för online_matches.
- Supabase Realtime är nu primär synk för online_players.
- När någon trycker LÅS IN skickas databasändringen direkt till motspelarens webbläsare via websocket.
- Matchvyn hämtar nytt state direkt när realtime-eventet kommer.
- Mina matcher uppdateras direkt när realtime-eventet kommer.
- 700 ms matchpolling finns kvar endast som reserv.
- 2,5 s Mina matcher-polling finns kvar endast som reserv.
- Den egna mobilen uppdateras omedelbart efter LÅS IN utan att invänta nästa poll.

TEKNISKT:
- Supabase JS v2 laddas från jsDelivr för realtime-websocket.
- Befintlig REST-klient används fortfarande för databasoperationer.
- Ingen ny SQL krävs om ONLINE_V4_30.sql redan är körd.
- Tabellen är redan tillagd i supabase_realtime av ONLINE_V4_30.sql.

Alla onlineregler/funktioner från V4.33 finns kvar.
