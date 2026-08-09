DIGIHITS V4.46

IPHONE/SAFARI – TIDSLINJE UNDER SPELARE:
- Den synliga Safari-scrollbaren är dold.
- Swipe höger/vänster fungerar fortfarande.
- Spelarlistan/tidslinjerna byggs inte längre om vid varje realtime/polling-tick.
- DOM uppdateras bara om speldata, tur, kort eller öppet/stängt läge faktiskt ändras.
- Scrollposition sparas per spelare.
- Öppna tidslinjer ligger visuellt stabila under synkning.
- GPU/compositing-stabilisering används för att minska Safari-flimmer.
- Parent-layout hålls stabil med contain.

Ingen ny SQL krävs.
