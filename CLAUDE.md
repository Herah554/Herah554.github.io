# Diplom-is MES — Produksjonssystem

Webbasert MES/OEE-system for Diplom-is iskremfabrikk. Bygget og vedlikeholdt av David (MasterDavid).
**All kommunikasjon på norsk.**

## Arkitektur

```
Siemens S7-1500 PLS → bridge.py (OPC-UA, fabrikk-PC) → Firebase RTDB → GitHub Pages (denne repoen)
```

- **Frontend:** Ren HTML/CSS/JS — ingen rammeverk, ingen build-steg. Hostes på GitHub Pages (herah554.github.io).
- **Backend:** Firebase Realtime Database + Firebase Auth (e-post/passord).
- **PLS-bro:** `bridge.py` kjøres manuelt på fabrikk-PC (`C:\Users\Teknisk-Felles\Documents\bridge.py`, startes med `py bridge.py`). Leser OPC-UA hvert sekund.

## Firebase

- Prosjekt: `messystem-f14dd`
- Database: `https://messystem-f14dd-default-rtdb.firebaseio.com`
- apiKey: `AIzaSyCL4x1KNwgeDxqTFeP32BndJgH4B5MworQ` (ligger i alle HTML-filer — normalt for Firebase)
- **VIKTIG:** Reglene er pt. helt åpne (`.read/.write: true`). Planlagt fiks: egen Firebase Auth-bruker for bridge.py, deretter rollebaserte regler. Ikke stram reglene før bridge.py har ekte auth — da stopper natt-drift.
- bridge.py bruker `?auth=API_KEY` i REST-kall — dette er IKKE gyldig auth, fungerer kun fordi reglene er åpne.

### Databasestruktur
- `events/` — nedetidshendelser `{line, machine, cause, duration(min), severity, comment, ts, wholeLine, source:"opc"|undefined, unhandled:bool, handledAt, handledBy}`
- `settings/` — `{globalGoal, oeeGoal, defaultDayHours, resetTime:"HH:MM", lineGoals{}, oeeGoals{}, prodPlan{lk:{weekHours}}, machines{lk:[navn]}, causes{lk__mk:[årsak]}, generalCauses[], plannedStops[], products{lk:[{name,eskerPerDpack}]}, dashboards{dash_id:{name,sections{kpi|oversikt|nedetid|registrer|logg:{on,order}}}}}`
- `users/{uid}` — `{name, email, role:"master"|"leder"|"linjeoperator", lines[], dashboardId, shiftAccess:bool, createdAt}`
- `shiftReports/{YYYY-MM-DD}/{lk}` — `{line, date, skift, produkt, aoNr, hastighet, antallBestilt, antallProdusert, planlagteTimer, forsteFylling, sisteFylling, bemanning, grisematKg, reworkKg, ravaresvinn, svinn, kommentar, signatur, savedBy, savedAt}`
- `production/{YYYY-MM-DD}/{lk}/count` — esketelling per dag
- `productHourly/{date}/{lineKey}/{HH}` — esker per time (logges fra åpent dashboard hvert 3. min)
- `active_product/{lk}` — `{product, setAt}`
- `opc_status/` — `{connected, last_seen, url}`

### Nøkkelfunksjon
`lk(line)` = linjenavn med mellomrom/skråstrek → `_` (f.eks. "Løp 1" → "Løp_1"). Maskinnøkkel: `lk(line)+'__'+lk(machine)`.

## Filer i repoet

- `index.html` — hoveddashboard (KPI, OEE/Produksjon-faner, nedetidsanalyse, registrering, hendelseslogg, ubehandlet-banner + behandlingsmodal, dashboard-maler via `applyDashboard()`)
- `innstillinger.html` — mål, resetTime, planlagte stopp, årsaker, per linje: prodplan/maskiner/årsaker/produkter, dashboard-maler (kun master)
- `brukere.html` — brukeradmin (kun master): opprett/rediger bruker, rolle, linjer, dashboard-mal, `shiftAccess`-avkryssing
- `rapporter.html` — år/måned/uke-oversikter, sammenlign år, hastighet per produkt (master/leder)
- `skiftrapport.html` — skiftrapport per linje/dato (ny/rediger + historikk), skriver til `shiftReports/`. Tilgang: master, leder, eller bruker med `shiftAccess:true`. Operatør ser kun sine egne linjer i historikken.
- `logg.html` — «Logg & data» (**kun master**): rediger dagstall i `production/`, full hendelseslogg med retting/sletting, systemstatus fra `opc_status/`
- `login.html` — innlogging

Referert, men ikke i repoet:
- `bridge.py` — OPC-UA→Firebase. Kjører kun på fabrikk-PC (`C:\Users\Teknisk-Felles\Documents\bridge.py`); ingen kopi er sjekket inn her.
- `import.html` — CSV-import av produksjonsplaner/grunndata. Finnes ikke i repoet pt.

## Linjer
Løp 1, Løp 2, Løp 3, Rollo, Koba, Glacier, Krokan. Kun **Glacier** er koblet til OPC-UA pt.

## PLS / TIA Portal (S7-1500, CPU 1511-1 PN, IP 192.168.0.1:4840)

Global DB `"Produksjon"` (DB3): `antall_esker` (Int), `linje_kjorer` (Bool, flankeminne), `linje_aktiv` (Bool, nedetidssignal). Alle med "Accessible from HMI/OPC UA".
Sensor: I0.0, tag `"Glacier conuter"` (NPN, 24V=True ved eske).

Main OB1 (SCL) — fungerende kode:
```pascal
IF "Glacier conuter" AND NOT "Produksjon".linje_kjorer THEN
    "Produksjon".antall_esker := "Produksjon".antall_esker + 1;
END_IF;
"Produksjon".linje_kjorer := "Glacier conuter";
"TON_DB".IN := "Glacier conuter";
"TON_DB".PT := T#30S;
"Produksjon".linje_aktiv := "TON_DB".Q OR "Glacier conuter";
```
`TON_DB` = Data block av type IEC_TIMER under Program blocks (IKKE System blocks). `"DB"()`-callsyntaks og CTU fungerer ikke i SCL i OB1 — bruk direkte tilordning. Variabelnavn kan ikke ha æ/ø/å.

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
6. Nedetid registreres når linjen STARTER igjen, ikke når den stopper. Min. varighet: `MIN_DOWNTIME_MIN = 1`.

## Arbeidsflyt og preferanser

- David foretrekker **komplette, fungerende filer** — ved patching: verifiser anker-strenger først, sjekk brace/paren-balanse etterpå.
- Endringer pushes til GitHub Pages (denne repoen) — test alltid i inkognito.
- OPC-hendelser får `unhandled: true` → gult banner → behandlingsmodal (velg maskin → årsaker aktiveres → kommentar → lagre). Linjeoperatør har ingen "Hopp over"-knapp.
- OEE = (PlanMin − Nedetid) / PlanMin × 100. "Alle linjer" = gjennomsnitt. PlanMin per linje fra `prodPlan[lk].weekHours/5`, ellers `defaultDayHours`.
- Dagsgrense styres av `settings/resetTime` (HH:MM) — før resetTime tilhører telling gårsdagen.

## Pågående / neste oppgaver

1. **Firebase-sikkerhet (VIKTIGST):** Firebase Auth-bruker for bridge.py → skriv om bridge.py til ekte auth → rollebaserte regler. Må gjøres på fabrikk-PC.
2. bridge.py som Windows-tjeneste (NSSM) med reconnect, buffering, logging.
3. Grunndata for 12xxx-produktserien mangler (har t.o.m. art.nr 11934).
4. Flere linjer på OPC-UA.
5. Ev. M3/Infor ION-integrasjon (fremtid).
