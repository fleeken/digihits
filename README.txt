DIGIHITS V4.51 – CHATTFIX

FELET FRÅN V4.50:
db.from(...).select(...).eq(...).order(...).limit is not a function

ORSAK:
Digihits använder en egen REST-wrapper för Supabase.
Den hade stöd för order() men saknade limit().
Dessutom använde chat-Realtime fel klient.

FIX:
- RestQuery har nu korrekt limit().
- Chatthämtning med order(...).limit(200) fungerar.
- Realtime använder getRealtimeClient(), samma websocket-klient som match-Realtime.
- Reservsynk körs direkt och därefter var 800 ms.
- Oläst-räknaren fungerar även om Realtime missar ett event.
- Chatstatus visar om Realtime tappas och reservsynk används.
- Max 30 tecken kvar.

SQL:
Om ONLINE_V4_50_CHAT_FIX.sql redan är körd behövs ingen ny SQL.
Om den INTE är körd: kör ONLINE_V4_50_CHAT_FIX.sql en gång.
