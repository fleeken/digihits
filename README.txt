DIGIHITS V4.50 – CHATTFIX

VIKTIGT:
Kör ONLINE_V4_50_CHAT_FIX.sql i Supabase SQL Editor.
Kör hela filen. Den är gjord för att kunna köras även om V4.47-chat-SQL redan körts.

Fixar:
- explicita SELECT/INSERT-rättigheter för anon + authenticated
- sequence-rättighet för chat-ID
- separata RLS-policyer för läsning och skickning
- Realtime-publication verifieras
- replica identity full
- 30 tecken verifieras i databasen
- Realtime använder samma Supabase-klient som resten av spelet
- 700 ms reservsynk ligger kvar
- efter SKICKA verifieras meddelandet direkt mot databasen
- chatten visar nu synk-/felstatus så fel inte döljs

Ingen annan SQL behöver köras.
