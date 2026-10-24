# Game Design Document: Willie's Wild River

Konsept: Et taktisk, stumfilm-inspirert pokerspill (3 felleskort) i nettleseren. Du spiller mot kjente karakterer fra det fri (public domain) for å overleve 48 måneders stormfull statsøkonomi.
Aestetikk: Svart-hvit 1928-tegnefilm (høy kontrast, kornete filter, stumfilm-plakater for tekst).

🖥️ Skjermstruktur (Screens)

Spillet trenger totalt 3 unike skjermer/visninger:

1. Intro & Splash-skjerm

• Visuelt: Tittel over en tegnestift-animasjon av en elvebåt. En stor «START DUEL»-knapp.
• Stats-tavle: Viser din nåværende «High Score» (Hvor mange måneder du har overlevd av de 48).
• Historie-knapp: Kort forklaring av konseptet: «Styr opinionen. Unngå konkurs. Dump rælet ditt på Donald.»

2. Spilleskjermen (The Table)

Dette er det tredelte oppsettet vi spikret:
• Øverst (Motstander): Viser portrettet av rundenes fiende (f.eks. en aggressiv Donald eller en tenkende Sherlock). Her vises også motstanderens 5 håndkort, helt åpne.
• Midten (Elva): Viser 3 felleskort-slots + 1 «Ræl-Joker»-slot. Dette er krisen det kjempes om denne måneden.
• Nederst (Spiller): Ditt område. Viser dine 5 håndkort (åpne) og dine to dedikerte «Spilte kort»-slots. Det er her du drar/klikker kortene dine på plass.
• Sidepanel: En stor, rystende måler for Opinionen (0–100 %) og en teller for Måned (1 til 48).

3. Resultatskjerm (Round End)

Dette er pustebakken mellom slagene. Den dukker opp etter hver Showdown og fungerer som en stumfilm-tekstplakat:
• Overskrift: «SEIER!» 🎉 eller «KATASTROFE!» 💥
• Regnskap:
	• Viser vinnerhånden (f.eks. «Du slo Svarte-Petter med To Par!»).
	• Endring i poeng: «Opinion +15%» eller «Opinion -10%».
	• Joker-status: «Du dumpet Egg-krisen!» eller «Du måtte svelge Damp-lekkasjen!».
• Knapper: «Neste måned (Neste runde)» eller «Gå til hovedmeny (Pause)».

⚙️ Core Gameplay & Spilleregler


Seier og Tap

• Målet: Overleve 48 måneder (runder). Klarer du måned 48 med Opinion > 0%, vinner du spillet og får et «Hederlig ettermæle».
• Game Over: Hvis Opinions-måleren treffer 0%, blir du avsatt ved mytteri. Game over umiddelbart.

Spillrunden (De 3 Fasene)

Hver måned trekkes en tilfeldig motstander og en tilfeldig Ræl-Joker til elva. Begge spillere får utdelt 5 åpne kort på hånden.
1. The Flop: Det 1. felleskortet legges i elva. Begge spillere må legge ut sitt 1. kort på bordet (åpent).
2. The Bend: Det 2. felleskortet legges i elva. Begge spillere må legge sitt 2. kort på bordet (åpent).
3. The River: Det 3. felleskortet legges i elva. Begge spillere får nå velge å bytte ut ett av sine to spilte kort med et kort fra hånden sin.

Showdown & Joker-fordeling

• Spillet regner ut den beste 3-korts pokerhånden (2 spilte kort + 3 felleskort).
• Vinneren: Får sin poengsum lagt til på Opinions-måleren sin.
• Taperen: Får ingenting i poeng, OG må ta imot rundens Ræl-Joker.
• Joker-effekten: Hver Joker du eier gir en passiv minus-effekt på Opinionen din i slutten av hver eneste påfølgende runde helt til du klarer å vinne en runde der jokeren er i elva.

👥 Motstander-galleriet (AI Personligheter)

• Svarte-Petter: Den forutsigbare bøllen. Går alltid for de høyeste enkeltkortene (Ess/Konger), uansett om det passer med felleskortene eller ikke. Easy å finte ut med en Straight.
• Donald Duck (1934): Kaos-anden. Bygger hender helt tilfeldig. Kan plutselig snu hele spillet i fase 3 (The River) ved å bytte til et helt ulogisk kort som gir ham en Flush.
• Sherlock Holmes (https://www.google.com/search?kgmid=%2Fm%2F06rkl&q=Sherlock+Holmes): Perfeksjonisten. Regner ut din maksimale poengsum. Hvis han ser at han taper i fase 3, bytter han til et kort som minimerer skaden, eller akkurat sniker seg forbi deg.

📦 Nedlastbar Markdown-fil for Mac-en din

For at du skal slippe å kopiere teksten manuelt, har jeg lagret nøyaktig dette dokumentet i en fil du kan importere rett inn i Xcode, VS Code eller Obsidian.
Trykk her for å laste ned spilldesigndokumentet:
GDD_Willies_Wild_River.md
(Jeg har brukt et internt script til å generere og lagre filen på systemet ditt med navnet GDD_Willies_Wild_River.md).
Nå har du alt klart på papiret! Når du setter deg ned på Mac-en, vil du at jeg skal skrive et ferdig HTML/CSS-oppsett med det svart-hvite stumfilm-filteret for å gi deg et forsprang på det visuelle, eller er du klar for å dundre løs på egen hånd?
