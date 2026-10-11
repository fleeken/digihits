# Radioboll · v1.0

Ett separat arkadspel i `radioboll/`. Musikquiz och Digihits huvudapp ändras inte.

## Spela

2–8 spelare använder varsin telefon. Värden skapar match och delar sexsiffrig kod, länk eller QR. Varje spelare väljer namn och en av sex radiobilar. Alla bilar har identisk acceleration, fart, styrning, massa och kollisionsstorlek. Bilvalet är kosmetiskt.

Lagen är turkos och korall. Spelarna fördelas mellan lagen vid anslutning och kan byta lag i lobbyn. Gästerna markerar sig redo; båda lagen behöver minst en spelare. Värden kan starta när alla telefoner har en fungerande spelanslutning.

Vrid mobilen till liggande läge. Hela planen visas utan att beskäras. Sväng med fingret på vänster kontroll och håll **GASA** till höger. Det finns inga andra körkontroller. På dator: W / pil upp gasar och A/D / vänster/höger svänger. Bilen rullar långsammare när gasen släpps och kan svänga på plats.

Varje omgång är tre minuter eller först till fem mål. Vid lika resultat efter tre minuter avgör nästa mål (golden goal). Första laget till två omgångssegrar vinner matchen. Avspark och återställning efter mål sker automatiskt. Värdens Spela igen tar samma grupp tillbaka till lobbyn med samma namn, bilar och lag, nollställt matchläge och en ny matchidentitet. Till startsidan påverkar bara den egna telefonen.

**Provkör** på startsidan fungerar utan databasen, mot en datorbil, med samma regler och fysik.

## Aktivera manuellt

1. Öppna `setup.sql`, kopiera hela filen och kör den i SQL Editor i det befintliga Supabase-projektet.
2. Anonyma inloggningar behöver vara aktiverade (som för Musikquiz).
3. Öppna `https://fleeken.github.io/digihits/radioboll/` på minst två telefoner, gärna på samma wifi. Skapa match på den ena, anslut på den andra och vänta tills anslutningen är klar. Markera gästen redo.

SQL använder det egna schemat `radioboll` och den medlemskontrollerade funktionen `public.radioboll`. Inga befintliga matcher, profiler, frågebanker eller konton ändras. Inga betalda tjänster, Realtime-policyer eller Edge Functions installeras.

## Nätverk och gränser

WebRTC DataChannels transporterar kontroller och matchläge direkt mellan värdens mobil och gästerna. Supabase används för lobby, medlemskontroll, anslutningsmeddelanden och periodisk sparning av matchläget. Värden simulerar fysik i 60 steg/sekund och skickar matchläge 20 gånger/sekund. Gästerna får interpolerade bilder och skickar endast gas och styrning. Ingen kamera eller mikrofon begärs.

Värden behöver hålla spelet öppet i liggande läge. Vid paus stannar simulationen. Gamla kontrollpaket slutar gasa efter 500 ms. Efter en omladdning återupptar värden det senaste sparade läget (upp till cirka två sekunder kan gå förlorade). En frånkopplad gästs bil stannar och börjar lyssna på kontroller igen när anslutningen är tillbaka. Spelare kan inte byta lag eller gå med i en pågående match.

Den första versionen har STUN via Google och Cloudflare, men ingen TURN-relätjänst. Samma wifi är det rekommenderade läget. Vissa mobilnät, gästnät och brandväggar hindrar direktanslutning; då stannar startknappen tills alla är anslutna. En TURN-tjänst behöver konfigureras separat för garanterad anslutning mellan olika nät. Anslutningsdata delas endast med matchens värd och den berörda gästen.

Värden är auktoritet för resultatet: detta är ett familjespel utan tävlingsrankning eller skydd mot en värd som manipulerar sin egen klient. Gäster kan inte rapportera mål eller ändra andra spelares kontroller via appens protokoll. Tabeller har RLS och saknar direkt klientåtkomst; alla databasåtgärder kontrollerar medlemskap och värdbehörighet.

## Tester

`node radioboll/tests/physics-test.cjs` verifierar likvärdiga bilar, kollisioner, mål, avspark, tidsgräns, golden goal, bäst av tre och matchlägesvalidering. `node radioboll/tests/network-test.cjs` verifierar ordning, avsändare och indata i spelprotokollet.

`tests/database-test.sql` är ett transaktionstest efter installation. Det skapar tillfälliga matcher och kontrollerar medlemskap, låsta namn/bilar, redo, lag, signalering och återspelning. Transaktionen avslutas med rollback och lämnar inga testmatcher kvar.
