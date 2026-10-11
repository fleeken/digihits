# Musikquiz

Ett separat familjespel i Digihits-repot, utan kontoinloggning. Varje spelare använder sin egen mobil. Värden delar matchkod, länk eller QR, spelar upp frågorna med telefonens svenska syntetröst och startar omgångarna.

- 141 frågor från olika årtionden och genrer; tio slumpade frågor per match.
- Fyra svar, 20 sekunders svarstid och ett poäng för varje rätt svar.
- Låsta namn och avatarer. Namn är unika i matchen utan skillnad på versaler/gemener.
- Grön ”Redo” och röd ”Ej redo” i lobbyn. Alla gäster måste vara redo före start.
- Fem sekunders nedräkning vid matchstart; tre sekunder före varje fråga. Nedräkningen täcker hela skärmen.
- Svaren visas först när värdens uppläsning har avslutats. Om telefonens röst inte fungerar kan värden läsa högt och bekräfta att frågan är uppläst.
- Topplista efter varje fråga; spelarna animeras till sina nya placeringar.

## Aktivera själv i Supabase

Agenten installerar inte databasen. Du gör nedanstående själv.

1. Öppna [SQL Editor i ditt befintliga gratisprojekt](https://supabase.com/dashboard/project/zttkujhoyuxerdewofkb/sql/new).
2. Öppna [setup.sql](./setup.sql) i GitHub och tryck **Raw**, så att du får hela filen som ren text. Kopiera hela innehållet.
3. Klistra in det i en ny SQL-fråga i Supabase. Skriptet skapar fyra tabeller i det nya schemat `musikquiz`, en skyddad funktion och 141 frågor. Det ändrar inga befintliga Digihits-tabeller, konton, nivåer eller poäng.
4. Tryck **Run**. Skriptet körs i en transaktion: ett fel avbryter hela installationen. Kör det en gång. Förväntat besked är **Success. No rows returned**.
5. Öppna [Authentication → Sign In / Providers](https://supabase.com/dashboard/project/zttkujhoyuxerdewofkb/auth/providers). Kontrollera att **Allow anonymous sign-ins** är aktiverat. Detta ger gäster en anonym session utan e-post, lösenord eller inloggningsruta. Om inställningen redan är på behöver du inte ändra den.
6. Öppna [Musikquiz](https://fleeken.github.io/digihits/musikquiz/) på två telefoner. Skapa en match på den ena och anslut med koden på den andra. Markera gästen redo och starta.

Ingen betald AI-tjänst, Edge Function, ny domän eller uppgradering används. GitHub Pages och den befintliga Supabase-gratisplanen används. Gratisplanen har användningsgränser; lösningen aktiverar inte en betald plan. Rösten är telefonens inbyggda syntetröst och kan skilja sig mellan enheter. Automatisk uppläsning kan kräva ett tryck på ”Läs upp frågan igen” på vissa telefoner.

Om du får ett fel när du kör SQL: kopiera feltexten. Kör inga slumpmässiga reparationsskript. Ett fel om att schemat redan finns kan betyda att installationen redan är genomförd.

## Teknik och verifiering

Statisk HTML/CSS/JavaScript. Klienten använder bara Supabase publishable key och en anonym sessions token. Varje databasåtgärd kontrollerar medlemskap och värdbehörighet. Direkt åtkomst till tabeller är spärrad, RLS är aktiverat och facit skickas först efter avslutad fråga. Matchstatus hämtas var 900 ms; nedräkningen använder servertid. Matcher gäller i 24 timmar.

`backend.sql` är schemaspecifikationen. `questions.sql` är frågorna. `setup.sql` kombinerar båda för manuell installation. `questions.json` och `build-questions.py` används för att underhålla frågebanken och laddas inte av spelet.

QR-biblioteket är vendrat från `qrcode-generator` version 1.4.4, Copyright Kazuhiko Arase, MIT License. Ingen QR-tjänst får dina matchlänkar.

Lokala tester körs med `npm --prefix musikquiz/tests ci` följt av `npm --prefix musikquiz/tests test`. Testerna använder en separat PostgreSQL-motor i minnet och två DOM-klienter. De kontaktar inte ditt Supabase-projekt. De verifierar databasbehörighet, namnkollisioner, låsta identiteter, redo-status, nedräkningar, uppläsningsgrinden, svar, poäng och topplistans omordning. Fysisk iPhone-uppläsning behöver provas på telefonen eftersom röster och automatisk uppspelning varierar mellan enheter.

## Uppdatera en redan installerad app till v1.2

Öppna [update-v1.2.sql](./update-v1.2.sql), kopiera hela filen via **Raw** och kör den själv i samma Supabase-projekts SQL Editor. Kör inte `setup.sql` igen. Uppdateringen gör att gäster kan lämna i lobbyn och mellan frågorna. Skriptet ersätter bara Musikquiz-funktionen och raderar inga befintliga matcher eller poäng. När en gäst därefter väljer att lämna tas gästens deltagande bort från den matchen.

Värden har en röd **Avsluta match**-knapp längst ner och gästerna en röd **Lämna match**-knapp. Båda visar **Är du säker?** med **Ja** och **Nej** innan någon åtgärd utförs. Värdens avslutning fungerar även före databasuppdateringen; gäster behöver uppdateringen för att kunna lämna mellan frågorna.
