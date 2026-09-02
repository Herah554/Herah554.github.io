# Kjør bridge.py som Windows-tjeneste (NSSM)

Mål: broen starter automatisk når PC-en slås på, kjører uten at noen er innlogget,
og starter seg selv på nytt hvis den krasjer. I dag stopper tellingen hvis
bro-vinduet lukkes eller PC-en rebooter — dette fikser det.

NSSM = «Non-Sucking Service Manager», et lite gratisverktøy som gjør et hvilket
som helst program om til en Windows-tjeneste.

---

## VIKTIGST FØRST — hvilken bruker tjenesten kjører som

Python ligger i **Teknisk-Felles** sin egen mappe:
`C:\Users\Teknisk-Felles\AppData\Local\Python\pythoncore-3.14-64\python.exe`

Og `bridge_pw.txt` (innloggingen) ligger i `C:\Users\Teknisk-Felles\Documents\Bridge\`.

En Windows-tjeneste kjører normalt som kontoen **LocalSystem**, som **ikke** ser
inn i Teknisk-Felles sin brukermappe. Gjør du ingenting med dette, finner ikke
tjenesten verken Python eller passordfila, og den starter aldri.

**Løsning:** tjenesten må kjøre som brukeren **Teknisk-Felles** (steg 6 under).
Det er det ene steget folk glemmer, så vi tar det eksplisitt.

---

## Steg 1 — finn den nøyaktige Python-stien

Åpne PowerShell og kjør:

    py -c "import sys; print(sys.executable)"

Kopier stien den skriver ut. Sannsynligvis:
`C:\Users\Teknisk-Felles\AppData\Local\Python\pythoncore-3.14-64\python.exe`

Vi kaller den `PYTHON_STI` under. Ikke bruk `py` i tjenesten — den launcheren
oppfører seg upålitelig uten innlogget bruker. Pek på python.exe direkte.

## Steg 2 — last ned NSSM

1. Gå til <https://nssm.cc/download> → last ned siste stabile (nssm 2.24).
2. Pakk ut zip-en. Inni ligger `win64\nssm.exe`.
3. Kopier `nssm.exe` til `C:\Users\Teknisk-Felles\Documents\Bridge\` — da har du alt på ett sted.

## Steg 3 — åpne installasjonsvinduet

I en **administrator**-PowerShell:

    cd C:\Users\Teknisk-Felles\Documents\Bridge
    .\nssm.exe install DiplomIsBridge

Et vindu åpnes. Fyll ut fanene slik:

## Steg 4 — fanen «Application»

| Felt | Verdi |
|------|-------|
| Path | `PYTHON_STI` fra steg 1 |
| Startup directory | `C:\Users\Teknisk-Felles\Documents\Bridge` |
| Arguments | `bridge.py` |

Startup directory **må** være Bridge-mappa — broen leser `bridge_pw.txt` og
skriver `bridge.log` relativt til der den startes.

## Steg 5 — fanen «I/O» (valgfritt, men greit)

Broen logger allerede til `bridge.log`. Vil du i tillegg fange alt tjenesten
skriver ut (inkludert oppstartsfeil før logging er i gang):

| Felt | Verdi |
|------|-------|
| Output (stdout) | `C:\Users\Teknisk-Felles\Documents\Bridge\service-out.log` |
| Error (stderr)  | `C:\Users\Teknisk-Felles\Documents\Bridge\service-out.log` |

## Steg 6 — fanen «Log on»  ← IKKE HOPP OVER

Velg **This account** og fyll inn Teknisk-Felles-kontoen:

- This account: `.\Teknisk-Felles`  (punktum-backslash betyr «denne maskinen»)
- Password: passordet til Windows-brukeren Teknisk-Felles

Uten dette kjører tjenesten som LocalSystem og finner verken Python eller
passordfila. Dette er grunnen til at tjenesten «ikke starter» hvis man glemmer det.

## Steg 7 — fanen «Exit actions»

Standard er som regel riktig, men bekreft:

- Restart Application
- Delay before restart: `5000` ms

Da kommer broen tilbake av seg selv etter en krasj eller et nettbrudd.

## Steg 8 — installer og start

Trykk **Install service**. Så, i samme admin-PowerShell:

    .\nssm.exe start DiplomIsBridge

Sjekk at den lever:

    Get-Service DiplomIsBridge

Status skal være **Running**.

## Steg 9 — bekreft at den faktisk teller

1. Åpne `bridge.log` i Bridge-mappa. Nederst skal det stå ferske linjer med
   `innlogging: bridge_auth` og `[Glacier] Dagens dpack: ...`.
2. Åpne dashbordet. Tellingen skal øke som før.
3. **Den ekte testen:** reboot fabrikk-PC-en. Ikke logg inn. Vent to minutter,
   sjekk dashbordet fra en annen maskin/telefon — tellingen skal fortsatt gå.
   Da vet du at den overlever oppstart uten innlogget bruker.

---

## Dagligdags bruk etterpå

| Oppgave | Kommando (admin-PowerShell, i Bridge-mappa) |
|---------|---------------------------------------------|
| Se status | `Get-Service DiplomIsBridge` |
| Stoppe    | `.\nssm.exe stop DiplomIsBridge` |
| Starte    | `.\nssm.exe start DiplomIsBridge` |
| Restarte  | `.\nssm.exe restart DiplomIsBridge` |
| Endre oppsett | `.\nssm.exe edit DiplomIsBridge` |
| Fjerne helt | `.\nssm.exe remove DiplomIsBridge confirm` |

**Når du oppdaterer bridge.py:** legg den nye fila på plass, så
`.\nssm.exe restart DiplomIsBridge`. Ikke bare lukk et vindu — det finnes ikke
noe vindu lenger, tjenesten kjører usynlig i bakgrunnen.

## Hvis den ikke starter

- **Starter og stopper straks:** feil Python-sti (steg 1) eller feil Log on-konto
  (steg 6). Se `service-out.log`.
- **`No module named 'opcua'`:** pakken ble installert for en annen Python enn den
  tjenesten peker på. Kjør `PYTHON_STI -m pip install opcua` med full sti.
- **`bridge_pw.txt` ikke funnet / faller til API-nøkkel:** startup directory er feil
  (steg 4), eller tjenesten kjører som feil konto (steg 6).
- **Telling står stille etter at reglene ble publisert:** broen logger ikke inn —
  sjekk at `bridge_pw.txt` finnes og at loggen sier `innlogging: bridge_auth`.
