# Diplom-is MES — Produksjonssystem

Webbasert MES/OEE-system for Diplom-is iskremfabrikk. Bygget og vedlikeholdt av David (MasterDavid).
**All kommunikasjon på norsk.**

## Arkitektur

```
Siemens S7-1500 PLS → bridge.py (OPC-UA, fabrikk-PC) → Firebase RTDB → GitHub Pages (denne repoen)
```

- **Frontend:** Ren HTML/CSS/JS — ingen rammeverk, ingen build-steg. Hostes på GitHub Pages (herah554.github.io).
- **Backend:** Firebase Realtime Database + Firebase Auth (e-post/passord).
- **PLS-bro:** `bridge.py` (i repoet) kjøres manuelt på fabrikk-PC (`C:\Users\Teknisk-Felles\Documents\`, startes med `py bridge.py`). Leser OPC-UA hvert sekund. Linjene er en konfigtabell (`LINJER`); nullpunktet for dagstellingen lagres i Firebase så en omstart ikke nullstiller dagen (se Databasestruktur).

## Firebase

- Prosjekt: `messystem-f14dd`
- Database: `https://messystem-f14dd-default-rtdb.firebaseio.com`
- apiKey: `AIzaSyCL4x1KNwgeDxqTFeP32BndJgH4B5MworQ` (ligger i alle HTML-filer — normalt for Firebase)
- **Sikkerhet PÅ (publisert 02.09.2026):** `database.rules.json` er live. Alt krever innlogging, skriving er rollestyrt. Verifisert: uinnlogget `curl` mot basen gir HTTP 401. Broen skriver som `bridge@diplom-is.no` (uid 7SzoHTYmZrg8QCT5jOXTRUCa6Ax2, role=bridge) via `bridge_auth.py`. Endrer du reglene, test i Rules playground først — en for streng regel stopper natt-drift.
- bridge.py logger inn via `bridge_auth.py` (ID-token) når den finnes, ellers `?auth=API_KEY` med varsel. Sistnevnte er IKKE gyldig auth og virker kun fordi reglene er åpne.

### Databasestruktur
- `events/` — nedetidshendelser `{line, machine, cause, duration(min), severity, comment, ts, wholeLine, source:"opc"|undefined, unhandled:bool, handledAt, handledBy}`
- `settings/` — `{globalGoal, oeeGoal, defaultDayHours, resetTime:"HH:MM", lineGoals{}, oeeGoals{}, prodPlan{lk:{weekHours}}, machines{lk:[navn]}, causes{lk__mk:[årsak]}, generalCauses[], plannedStops[], products{lk:[{name,eskerPerDpack}]}, dashboards{id:{name,widgets{...}}} (se egen seksjon)}`
- `users/{uid}` — `{name, email, role:"master"|"leder"|"linjeoperator", lines[], dashboardId, shiftAccess:bool, createdAt}`
- `shiftReports/{YYYY-MM-DD}/{lk}` — `{line, date, skift, produkt, aoNr, hastighet, antallBestilt, antallProdusert, planlagteTimer, forsteFylling, sisteFylling, bemanning, grisematKg, reworkKg, ravaresvinn, svinn, kommentar, signatur, savedBy, savedAt}`
- `production/{YYYY-MM-DD}/{lk}/` — `{count, hourly{HH}, _base, _pls, _hbase{HH}}`. `count` = dagens esker. `_base` = PLS-tellerens verdi ved døgnstart, `_pls` = sist sette råverdi, `_hbase` = det samme per time. Skrives av bridge.py og gjør at broen finner nullpunktet igjen etter omstart; går `_pls` bakover er PLS-en nullstilt. Dashbordet leser bare `count` og `hourly`.
- `productHourly/{date}/{lineKey}/{HH}` — esker per time (logges fra åpent dashboard hvert 3. min)
- `active_product/{lk}` — `{product, setAt}`
- `opc_status/` — `{connected, last_seen, url}`
- `plan/production/{YYYY-MM-DD}/{lk}` — array av `{product, antall, timer, importedAt, importedBy}` (fra import.html; brukes av «Plan mot faktisk» i index.html)
- `plan/shift/{YYYY-MM-DD}/{lk}` — `{skift, bemanning, product, importedAt, importedBy}`
- `calibrationReviews/{lk}/{pushId}` — logg over kapasitetskalibrering: `{ts, by, byName, line, product, dateKey, hour, dpk, impliedRateDpk, impliedCap, currentCap, pct, decision:"accept"|"reject", newCap, comment}`
- `pwResets/` — **fjernet.** Lagret passord i klartekst; erstattet av Firebase sin e-postflyt og stengt i reglene.
- `settings/dashboards/{id}` — **delte** dashboard-maler (master): `{name, widgets{key:{on,order,w}}, createdAt, createdBy, updatedAt, updatedBy}`
- `userDashboards/{uid}/{id}` — brukerens **egne** maler, samme form
- `settings/shiftTemplates/{id}` — skiftmaler: `{name, start, end, bemanning, color}`
- `shiftPlan/{YYYY-MM-DD}/{lk}/{pushId}` — skiftbobler: `{tplId, name, start, end, bemanning, color, addedAt}`

### Widgets og dashboard-maler
Dashboardet er 21 widgets i et 12-kolonners rutenett (`#wgrid`). Widgetene lager **ikke** ny
markup — `buildWidgets()` adopterer elementer som allerede finnes og flytter dem inn i
rutenettet, så alle id-er, lyttere og Chart.js-instanser overlever. `els`-syntaksen er `#id`
eller `#id^.klasse` (nærmeste forelder). Fanebarene `#main-tabs` og `#nd-tabs` skjules fordi
hver fane er blitt egen widget, og `renderAll` tegner derfor både OEE og Produksjon i stedet
for én av gangen. Dra bruker pointer events (ikke HTML5 drag-and-drop) så det virker med mus
og finger på fabrikkens eldre Chrome.

Registeret (`WIDGETS`, `GRID_COLS`, `MIN_H`, `stdWidgets`, `normWidgets`) ligger i
**`dashboard-widgets.js`** fordi to sider bruker det — legges en widget til der, dukker den
opp begge steder. Layoutmodellen er `widgets:{key:{on,order,w,h}}` der `w` er kolonner 1–12
og `h` er høyde i piksler, eller 0 for innholdsstyrt. Med satt høyde strekkes kortet og
grafen; bare `.card`, `.cp` og `.prod-view` vokser — fanelinjer må beholde naturlig høyde,
ellers stables knappene loddrett.

Oppsett gjøres **bare** i dashbord.html, på et lerret av plassholdere — det er upraktisk å
dra på levende Chart.js-flater. index.html har ingen redigering igjen, bare en bytter
(⚙ Dashbord) og en lenke videre. Det var tre steder å redigere det samme; nå er det ett.

`users/{uid}.dashboardId` er "std" (innebygd standard, kan ikke slettes), "sh:<id>" (delt mal)
eller "me:<id>" (egen mal). **Linjeoperatører kan ikke bytte mal** — de følger den de er
tildelt. Det håndheves tre steder: bytteren skjules, dashbord.html avviser dem, og reglene
tillater bare ikke-operatører å skrive eget `dashboardId` eller egne `userDashboards`.
Ellers kunne en operatør skru av «Registrer hendelse» og miste evnen til å melde stopp.

Slettes en mal, settes alle som har den tildelt tilbake til Standard i samme operasjon.
Uten det ville `dashboardId` pekt på noe som ikke finnes.

`index.html?dash=<id>` viser en mal midlertidig uten å lagre valget — brukes av
«Forhåndsvis» i dashbord.html.

### Skiftkalender
Maler settes opp i innstillinger.html og legges inn per linje og dato som bobler.
**Bobler overstyrer ukesplanen** (`settings/schedule`) for den linjen den datoen — det er hele
poenget: helligdager og ekstraskift kan ikke uttrykkes i en evig ukesplan, så OEE ble regnet mot
plantid som ikke stemte. Integrasjonen er ett punkt: `dayWindows(line,dateObj)` gir bobler hvis
de finnes, ellers ukesplanen. `prodIntervalsForDate`, `plannedMinForDate` og `plannedMinFullDay`
bygger alle på den, så nedetid og OEE kan ikke komme i utakt. Pauser er en egenskap ved linja og
trekkes fra i begge tilfeller (`_subBreaks`). Bobler over midnatt klippes ved døgnskillet —
natt-timene må legges inn på neste dag også. index.html laster bare et tre måneders vindu av
`shiftPlan` (`orderByKey/startAt/endAt`), ellers ville noden vokse uten grense i minnet.

Kalenderen viser ISO-ukenummer og norske helligdager. `easterSunday()` (anonym gregoriansk
algoritme, verifisert 2024–2030) driver de bevegelige. Røde dager = lovfestede helligdager +
søndager; julaften og nyttårsaften merkes gult siden de i praksis er halve dager, men ikke er
røde. Kopiering finnes på tre nivåer: utklippstavle for enkeltdager (`DAY_CLIP`), «→ Neste dag»,
og ⧉ per ukerad som kopierer uka sju dager fram. Innliming **erstatter** måldagen for den linjen
— tomme kildedager tømmer målet, ellers ville rester bli stående. Derfor laster
innstillinger.html en måned pluss buffer (−7/+14 dager), så ukekopiering ser dagene den skriver.

### Chatbot
Lokal databot i index.html — ingen API-nøkkel, ingen server. `botLocal()` tolker norske
spørsmål (nedetid, OEE, produksjon, verste maskin/årsak, status, ubehandlede) og regner svarene
med de **samme** funksjonene som dashboardet (`downtimeForDates`, `oeeOutput`, `eskerFor`), så
tallene stemmer alltid med skjermen. `botAsk()` er eneste inngang: sett `BOT.backend='api'` og
`BOT.endpoint` til en proxy-URL for å bytte til Claude API senere. **Nøkkelen skal aldri i denne
repoen** — siden er offentlig. `botContext()` sender et kompakt sammendrag, aldri hele databasen.

### Nøkkelfunksjon
`lk(line)` = linjenavn med mellomrom/skråstrek → `_` (f.eks. "Løp 1" → "Løp_1"). Maskinnøkkel: `lk(line)+'__'+lk(machine)`.

## Filer i repoet

- `index.html` — hoveddashboard (KPI, OEE/Produksjon-faner, nedetidsanalyse, registrering, hendelseslogg, ubehandlet-banner + behandlingsmodal, dashboard-maler via `applyDashboard()`)
- `innstillinger.html` — mål, resetTime, planlagte stopp, årsaker, per linje: prodplan/maskiner/årsaker/produkter, dashboard-maler (kun master)
- `brukere.html` — brukeradmin (kun master): opprett/rediger bruker, rolle, linjer, dashboard-mal, `shiftAccess`-avkryssing
- `rapporter.html` — år/måned/uke-oversikter, sammenlign år, hastighet per produkt (master/leder)
- `skiftrapport.html` — skiftrapport per linje/dato (ny/rediger + historikk), skriver til `shiftReports/`. Tilgang: master, leder, eller bruker med `shiftAccess:true`. Operatør ser kun sine egne linjer i historikken.
- `logg.html` — «Logg & data» (**kun master**): rediger dagstall i `production/`, full hendelseslogg med retting/sletting, systemstatus fra `opc_status/`
- `import.html` — CSV-import (master/leder): plandata til `plan/production` og `plan/shift`, samt fletting av produkter inn i `settings/products`
- `dashbord.html` — dashbord-oppsett: bygg maler på et abstrakt lerret (uten levende grafer), og tildel delte maler til brukere. Alle kan lage egne; master ser delte + tildelingstabell
- `dashboard-widgets.js` — **delt** widget-register brukt av både index.html og dashbord.html. Legges en widget til her, dukker den opp begge steder
- `login.html` — innlogging

- `bridge.py` — OPC-UA→Firebase-bro. Kjører på fabrikk-PC, men vedlikeholdes her. Trenger `bridge_auth.py` ved siden av seg og `py -m pip install opcua`.
- `bridge_auth.py` — innlogging for broen (se sikkerhetsnotatet).

## Linjer
Løp 1, Løp 2, Løp 3, Rollo, Koba, Glacier, Krokan. Kun **Glacier** er koblet til OPC-UA pt.

## PLS / TIA Portal (S7-1500, CPU 1511-1 PN, IP 192.168.0.1:4840)

Global DB `"Produksjon"` (DB3): `antall_esker` (Int), `linje_kjorer` (Bool, flankeminne), `linje_aktiv` (Bool, nedetidssignal). Alle med "Accessible from HMI/OPC UA".
Sensor: I0.0, tag `"Glacier conuter"` (NPN, 24V=True ved eske).

Main OB1 (SCL):
```pascal
// Tell esker på stigende flanke (I0.0 = dpack-teller)
IF "Glacier conuter" AND NOT "Produksjon".linje_kjorer THEN
    "Produksjon".antall_esker := "Produksjon".antall_esker + 1;
END_IF;
"Produksjon".linje_kjorer := "Glacier conuter";

// Nedetid styres av is-sensoren (I0.1). Inaktiv sensor = linja står.
"Produksjon".linje_aktiv := "Glacier is";
```
Is-sensoren er tag `"Glacier_nedetid"` på `%I0.1` (Bool). **bridge.py leser den direkte**
(`ns=3;s="Glacier_nedetid"`), så OB1-endringen over er valgfri — `linje_aktiv` i DB3 brukes ikke
lenger av broen. Esker og nedetid er to uavhengige signaler: linja kan stå (I0.1 inaktiv) mens
esker fortsatt kommer ut på I0.0 en time senere, og nedetiden telles fra I0.1.

**Ingen timer i PLS-en.** Den gamle koden skrev til `"TON_DB".IN/.PT` og leste `.Q`, men å tilordne
felter på en `IEC_TIMER` starter ingen timer — `Q` ble aldri satt, så `linje_aktiv` var i praksis
rå sensorverdi hele tiden. Debouncingen skjer i bridge.py: stopp kortere enn `MIN_DOWNTIME_MIN`
(4 min) ignoreres. Er mellomrommene mellom is-produkter lengre enn det, må verdien opp.
Vil man ha hold-tid i PLS-en likevel, er det TOF (av-forsinkelse) som er riktig instruksjon, kalt
på instansen: `"TON_DB".TOF(IN := "Glacier is", PT := T#10S)` og deretter `"TON_DB".Q` — ikke testet.

**Retain:** `antall_esker` bør ha Retain avkrysset så telleren overlever PLS-omstart. `linje_kjorer`
trenger det ikke (bare flankeminne). I dag er det motsatt. Broen tåler nullstilling uansett.
Variabelnavn kan ikke ha æ/ø/å.

Node-IDer:
- `ns=3;s="Produksjon"."antall_esker"`
- `ns=3;s="Produksjon"."linje_aktiv"` (STATUS_NODE i bridge.py)
- `ns=3;s="Glacier conuter"`

## Kritiske lærdommer — IKKE gjenta disse feilene

1. **Firebase-lyttere UTENFOR `onAuthStateChanged`** — ellers dupliseres de ved re-auth. Bruk navngitte handlers (`handleEvents`, `handleSettings`) med `.off()` før `.on()`, 50ms debounce på `renderAll`.
2. **Ingen `:has()` CSS-selektor i JS** — krasjer Chrome-versjonen på fabrikken. Bruk `getElementById`.
3. **Unngå inline `onclick` med dynamiske strenger som inneholder anførselstegn** — historisk kilde til syntaksfeil. Bruk `addEventListener` eller enkle ID-strenger uten spesialtegn.
4. **Ved cache-problemer:** no-cache meta-tags finnes; test i inkognito. Bump versjonskommentar øverst i filen ved behov.
5. `linje_kjorer` er True i kun én PLS-syklus — ubrukelig for polling. Bruk `linje_aktiv` (30s holdetid) for nedetidsdeteksjon.
6. Nedetid registreres når linjen STARTER igjen, ikke når den stopper. Min. varighet: `MIN_DOWNTIME_MIN = 4` (er debouncingen for sensoren — se PLS-seksjonen).
7. **Dagstellingen må ha lagret nullpunkt.** Den gamle broen satte nullpunktet til PLS-verdien ved oppstart, så hver omstart skrev dagens telling til 0. Nullstilling av PLS oppdages ved at telleren går *bakover* (`_pls`), ikke ved sammenligning mot nullpunktet — det feiler så snart nullpunktet er negativt etter første nullstilling. Verifisert i simulering mot 8 scenarier.
8. Linjenøkler må prosentkodes i REST-stier (`urllib.parse.quote`). Glacier er ASCII så det har aldri vært testet; Løp-linjene har ø.

## Arbeidsflyt og preferanser

- David foretrekker **komplette, fungerende filer** — ved patching: verifiser anker-strenger først, sjekk brace/paren-balanse etterpå.
- Endringer pushes til GitHub Pages (denne repoen) — test alltid i inkognito.
- OPC-hendelser får `unhandled: true` → gult banner → behandlingsmodal (velg maskin → årsaker aktiveres → kommentar → lagre). Linjeoperatør har ingen "Hopp over"-knapp.
- OEE = (PlanMin − Nedetid) / PlanMin × 100. "Alle linjer" = gjennomsnitt. PlanMin per linje fra `prodPlan[lk].weekHours/5`, ellers `defaultDayHours`.
- Dagsgrense styres av `settings/resetTime` (HH:MM) — før resetTime tilhører telling gårsdagen.

## Pågående / neste oppgaver

1. ~~Firebase-sikkerhet~~ **FERDIG 02.09.2026.** Reglene er publisert (se Firebase-seksjonen).
   Basen krever nå innlogging på alt; skriving er rollestyrt; operatører kan opprette/oppdatere
   hendelser men ikke slette. `bridge_auth.py` kjørt med `--oppsett` på fabrikk-PC-en, bro-bruker
   opprettet, broen logger inn som `bridge@diplom-is.no`. Verifisert: uinnlogget `curl` gir 401,
   broen skriver telling. `bridge_pw.txt` ligger i `Documents\Bridge\` (ikke i git).
   Neste steg innen sikkerhet: vurder å rotere API-nøkkelen i Google Cloud Console (den lå
   offentlig i månedsvis), og evt. slette den offentlige `pwResets`-historikken hvis den finnes.
2. bridge.py som Windows-tjeneste (NSSM), så den starter ved boot og overlever utlogging.
   Reconnect og fillogg (`bridge.log`, roterende) er på plass; buffering av skriv ved nettbrudd mangler fortsatt.
3. Grunndata for 12xxx-produktserien mangler (har t.o.m. art.nr 11934).
4. Flere linjer på OPC-UA — er nå en konfigoppføring i `LINJER` i bridge.py pluss egne DB-tagger i PLS-en (mønster: `lop1_antall_esker`, `lop1_linje_aktiv`).
5. Ev. M3/Infor ION-integrasjon (fremtid).
