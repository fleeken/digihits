DIGIHITS V4.44

RESULTAT / FORTSÄTT-FLÖDE:
- "Gissningen är sparad." tas bort direkt och ligger inte kvar när spelaren fortsätter.
- Dubbel visning av Byta-låt-kort under Fel/Rätt låtnamn är borttagen.
- Byta-låt-kort visas fortfarande under Spelare.
- Om spelaren faktiskt får ett Byta-låt-kort visas bara bonusmeddelandet att ett kort erhölls.

TIDSLINJE EFTER RÄTT PLACERING:
- Tidslinjen visas automatiskt direkt under resultatet.
- Ingen VISA/DÖLJ TIDSLINJE-knapp längre.
- Låsta och olåsta kort visas direkt.
- Olåsta kort ligger fortsatt högre än låsta kort.

SCROLLFIX:
- Placeringstidslinjens horisontella scrollposition sparas.
- Realtime/polling får inte längre kasta tidslinjen tillbaka åt vänster.
- Resultattidslinjens scrollposition sparas också.
- Resultatvyn byggs inte om vid varje poll om inget faktiskt har förändrats.

Ingen ny SQL krävs.
