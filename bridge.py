"""
Diplom-is — OPC-UA til Firebase-bro
====================================
Kjøres:        py bridge.py
Installasjon:  py -m pip install opcua
Innlogging:    py bridge_auth.py --oppsett   (én gang — se bridge_auth.py)

Leser esketelling og linjestatus fra PLS-en hvert sekund og skriver til
Firebase. Nedetid registreres når linja STARTER igjen, ikke når den
stopper, og bare hvis stoppet varte minst MIN_DOWNTIME_MIN.

NULLPUNKTET LAGRES I FIREBASE
-----------------------------
PLS-telleren (antall_esker) er kumulativ. Dagens produksjon er
"telleren nå" minus "telleren ved døgnstart". Det nullpunktet lagres i
production/{dato}/{linje}/_base, slik at broen finner det igjen etter en
omstart. Eskene som ble talt mens broen var nede kommer da med, siden
PLS-en fortsatte å telle. Tidligere lå nullpunktet bare i minnet, og
hver omstart skrev dagens telling til 0.

Sist sette PLS-verdi lagres også (_pls). Går telleren bakover — live
eller mens broen var nede — er PLS-en nullstilt, og siden den starter
på 0 er alt den viser etterpå nye esker. Det er det eneste sikre
signalet; å sammenligne mot nullpunktet feiler så snart nullpunktet er
blitt negativt etter første nullstilling.

FLERE LINJER
------------
Legg til en oppføring i LINJER. Broen leser alle hver runde. Nøkkelen i
Firebase er linjenavnet med mellomrom byttet til understrek, og den
prosentkodes i stiene — "Løp 1" blir "L%C3%B8p_1". Uten det feiler alle
linjer med æ/ø/å.
"""
import time, json, datetime, logging, os, urllib.request, urllib.parse
from logging.handlers import RotatingFileHandler
from opcua import Client

HER = os.path.dirname(os.path.abspath(__file__))

# ── LOGG: konsoll + fil, så natta ikke er borte når vinduet lukkes ────────
log = logging.getLogger("bridge")
log.setLevel(logging.INFO)
_fmt = logging.Formatter("%(asctime)s %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
_kon = logging.StreamHandler()
_kon.setFormatter(_fmt)
log.addHandler(_kon)
_fil = RotatingFileHandler(os.path.join(HER, "bridge.log"),
                           maxBytes=2 * 1024 * 1024, backupCount=5, encoding="utf-8")
_fil.setFormatter(_fmt)
log.addHandler(_fil)

# ── KONFIGURASJON ─────────────────────────────────────────────────────────
OPC_URL = "opc.tcp://192.168.0.1:4840"
FB_URL  = "https://messystem-f14dd-default-rtdb.firebaseio.com"
FB_KEY  = "AIzaSyCL4x1KNwgeDxqTFeP32BndJgH4B5MworQ"   # brukes bare hvis innlogging mangler

# Én oppføring per linje med sensor. "aktiv" er nedetidssignalet
# (linje_aktiv), "teller" er den kumulative esketelleren.
LINJER = [
    {
        "navn":   "Glacier",
        "maskin": "Glacier-maskin",
        "teller": 'ns=3;s="Produksjon"."antall_esker"',
        # Nedetidssignalet leses rett fra inngangstaggen (I0.1), ikke via DB3.
        # Da trenger ikke OB1 endres — og TON-linjene der er uansett uten virkning.
        "aktiv":  'ns=3;s="Glacier_nedetid"',
    },
    # {
    #     "navn":   "Løp 1",
    #     "maskin": "Løp 1-maskin",
    #     "teller": 'ns=3;s="Produksjon"."lop1_antall_esker"',
    #     "aktiv":  'ns=3;s="Produksjon"."lop1_linje_aktiv"',
    # },
]

MIN_DOWNTIME_MIN = 4      # stopp kortere enn dette ignoreres (debounce for sensoren)
POLL_SEC         = 1      # hvor ofte PLS-en leses
STATUS_SEC       = 5      # hvor ofte last_seen skrives
INNSTILLING_SEC  = 300    # hvor ofte resetTime hentes fra Firebase

# ── INNLOGGING ────────────────────────────────────────────────────────────
# Ekte innlogging via bridge_auth.py. Mangler den, faller vi tilbake til
# API-nøkkelen — som bare virker så lenge databasereglene står åpne.
_auth = None
_auth_advart = 0.0
try:
    from bridge_auth import FirebaseAuth
    _auth = FirebaseAuth()
except Exception as e:
    log.warning("bridge_auth.py ikke tilgjengelig (%s) — bruker API-nokkel", e)


def _token():
    global _auth_advart
    if _auth is None:
        return FB_KEY
    try:
        return _auth.token()
    except Exception as e:
        # Ikke spam loggen hvert sekund om det samme
        if time.time() - _auth_advart > 300:
            log.warning("Innlogging feilet (%s) — bruker API-nokkel. "
                        "Kjor 'py bridge_auth.py --oppsett'.", e)
            _auth_advart = time.time()
        return FB_KEY


# ── FIREBASE ──────────────────────────────────────────────────────────────
FB_FEIL = object()   # skilles fra "noden finnes ikke" (None)


def fb_req(path, method, data=None):
    url = "%s/%s.json?auth=%s" % (FB_URL, path, _token())
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 401 and _auth is not None:
            _auth.invalidate()
        log.error("Firebase %s %s: HTTP %s", method, path, e.code)
        return FB_FEIL
    except Exception as e:
        log.error("Firebase %s %s: %s", method, path, e)
        return FB_FEIL


def fb_set(path, data):   return fb_req(path, "PUT", data)
def fb_patch(path, data): return fb_req(path, "PATCH", data)
def fb_push(path, data): return fb_req(path, "POST", data)
def fb_get(path):        return fb_req(path, "GET")


def fb_get_vent(path):
    """GET som venter til Firebase svarer. Brukes der vi ikke kan gjette."""
    forsok = 0
    while True:
        r = fb_get(path)
        if r is not FB_FEIL:
            return r
        forsok += 1
        vent = min(30, 5 * forsok)
        log.warning("Firebase svarer ikke — venter %ss for a lese %s", vent, path)
        time.sleep(vent)


# ── HJELPERE ──────────────────────────────────────────────────────────────
def lk(navn):
    return navn.replace(" ", "_").replace("/", "_")


def lk_url(navn):
    return urllib.parse.quote(lk(navn), safe="")


_reset = (0, 0)
_reset_hentet = 0.0


def reset_tid():
    """resetTime fra settings, cachet — den endres nesten aldri."""
    global _reset, _reset_hentet
    if time.time() - _reset_hentet > INNSTILLING_SEC:
        r = fb_get("settings/resetTime")
        if isinstance(r, str) and ":" in r:
            h, m = r.split(":")
            _reset = (int(h), int(m))
        _reset_hentet = time.time()
    return _reset


def dagsnokkel():
    h, m = reset_tid()
    now = datetime.datetime.now()
    reset = now.replace(hour=h, minute=m, second=0, microsecond=0)
    if now < reset:
        return (now - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    return now.strftime("%Y-%m-%d")


# ── TILSTAND PER LINJE ────────────────────────────────────────────────────
class Linje:
    def __init__(self, cfg):
        self.navn   = cfg["navn"]
        self.maskin = cfg["maskin"]
        self.n_teller = cfg["teller"]
        self.n_aktiv  = cfg["aktiv"]
        self.ukey   = lk_url(self.navn)
        self.node_teller = None
        self.node_aktiv  = None
        # nedetid
        self.running    = True
        self.stop_start = None
        # produksjon
        self.dato     = None
        self.base     = None     # PLS-verdi ved døgnstart
        self.skrevet  = None     # sist skrevne dagsverdi
        self.hbase    = {}       # PLS-verdi ved timestart, per HH
        self.hskrevet = {}       # sist skrevne timesverdi, per HH
        self.sist_pls = None     # sist sette råverdi fra PLS — går den bakover, er PLS-en nullstilt
        self.aktiv_skrevet = None

    def sti(self, dato, rest=""):
        return "production/%s/%s%s" % (dato, self.ukey, rest)

    # ── nullpunkt ──
    def last_dag(self, dato, count):
        """Hent nullpunktet for dagen fra Firebase, eller lag det.
        Venter til Firebase svarer — uten nullpunkt kan vi ikke telle."""
        data = fb_get_vent(self.sti(dato)) or {}
        base    = data.get("_base")
        pls     = data.get("_pls")
        skrevet = data.get("count")
        skrevet = skrevet if isinstance(skrevet, int) else None

        if isinstance(pls, int) and count < pls:
            # PLS-en er nullstilt mens broen var nede. Telleren startet på 0,
            # så alt den viser nå er esker talt etter nullstillingen.
            self.base = -(skrevet or 0)
            log.info("[%s] PLS nullstilt mens broen var nede (%d -> %d) — fortsetter fra %d",
                     self.navn, pls, count, skrevet or 0)
        elif isinstance(base, int):
            # Broen var nede, PLS-en telte videre: differansen kommer med
            self.base = base
            log.info("[%s] Fant nullpunkt for %s: %d (dagens telling blir %d)",
                     self.navn, dato, base, count - base)
        else:
            # Ingen _base (ny dag, eller dag skrevet av gammel bro): bygg
            # videre på det som allerede står, slik at ingenting går tapt
            self.base = count - (skrevet or 0)
            log.info("[%s] Nytt nullpunkt for %s: %d", self.navn, dato, self.base)

        if self.base != base:
            fb_set(self.sti(dato, "/_base"), self.base)
        self.skrevet  = skrevet
        self.sist_pls = count
        hb = data.get("_hbase") or {}
        self.hbase    = {h: v for h, v in hb.items() if isinstance(v, int)}
        hs = data.get("hourly") or {}
        self.hskrevet = {h: v for h, v in hs.items() if isinstance(v, int)}
        self.dato = dato

    def ny_dag(self, dato, count):
        log.info("[%s] Ny dag (%s) — nullstiller dagsteller", self.navn, dato)
        self.base = count
        self.skrevet = None
        self.hbase = {}
        self.hskrevet = {}
        self.sist_pls = count
        self.dato = dato
        fb_patch(self.sti(dato), {"_base": self.base, "_pls": count, "count": 0})

    # ── én runde ──
    def oppdater(self, count, aktiv, now, dato):
        if self.dato is None:
            self.last_dag(dato, count)
        elif dato != self.dato:
            self.ny_dag(dato, count)

        # Nedetid: registreres når linja starter igjen
        if self.running and not aktiv:
            self.stop_start = now
            self.running = False
            log.info("[%s] STOPP detektert", self.navn)
        elif not self.running and aktiv:
            if self.stop_start:
                dur = round((now - self.stop_start) / 60)
                if dur >= MIN_DOWNTIME_MIN:
                    ev = {
                        "line":      self.navn,
                        "machine":   self.maskin,
                        "cause":     "Automatisk — OPC-UA",
                        "duration":  dur,
                        "severity":  "high" if dur >= 30 else "medium",
                        "comment":   "Stoppet %s, varighet %d min." % (
                            datetime.datetime.fromtimestamp(self.stop_start).strftime("%H:%M"), dur),
                        "ts":        int(self.stop_start * 1000),
                        "wholeLine": False,
                        "source":    "opc",
                        "unhandled": True,
                    }
                    if fb_push("events", ev) is not FB_FEIL:
                        log.info("[%s] Nedetid sendt: %d min", self.navn, dur)
                    else:
                        log.error("[%s] Kunne ikke sende nedetid (%d min)", self.navn, dur)
                else:
                    log.info("[%s] Kort stopp ignorert (%d min < %d)", self.navn, dur, MIN_DOWNTIME_MIN)
            self.running = True
            self.stop_start = None
            log.info("[%s] KJORER igjen", self.navn)

        # Sensorstatus til dashbordet, bare ved endring
        if aktiv != self.aktiv_skrevet:
            if fb_set("opc_status/lines/%s/aktiv" % self.ukey, bool(aktiv)) is not FB_FEIL:
                self.aktiv_skrevet = aktiv

        hh = datetime.datetime.now().strftime("%H")
        if hh not in self.hbase:
            self.hbase[hh] = count - self.hskrevet.get(hh, 0)
            fb_set(self.sti(dato, "/_hbase/" + hh), self.hbase[hh])

        # PLS nullstilt under drift: en kumulativ teller går aldri bakover
        # ellers. Den startet på 0, så det den viser nå er nye esker.
        if self.sist_pls is not None and count < self.sist_pls:
            self.base = -(self.skrevet or 0)
            self.hbase[hh] = -self.hskrevet.get(hh, 0)
            fb_set(self.sti(dato, "/_base"), self.base)
            fb_set(self.sti(dato, "/_hbase/" + hh), self.hbase[hh])
            log.info("[%s] PLS-teller nullstilt (%d -> %d) — fortsetter fra %d",
                     self.navn, self.sist_pls, count, self.skrevet or 0)
        self.sist_pls = count

        # Dagens produksjon = delta siden nullpunktet. _pls lagres sammen med
        # tellingen, så en nullstilling mens broen er nede kan oppdages.
        dagens = count - self.base
        if dagens != self.skrevet:
            if fb_patch(self.sti(dato), {"count": dagens, "_pls": count}) is not FB_FEIL:
                self.skrevet = dagens
                log.info("[%s] Dagens dpack: %d", self.navn, dagens)

        # Per time
        timens = max(0, count - self.hbase[hh])
        if timens != self.hskrevet.get(hh):
            if fb_set(self.sti(dato, "/hourly/" + hh), timens) is not FB_FEIL:
                self.hskrevet[hh] = timens


# ── OPPSTART ──────────────────────────────────────────────────────────────
linjer = [Linje(c) for c in LINJER]
client = None
errors = 0
sist_status = 0.0

log.info("=== Diplom-is OPC-UA Bridge ===")
log.info("PLS: %s", OPC_URL)
for l in linjer:
    log.info("Linje %-10s teller=%s  aktiv=%s", l.navn, l.n_teller, l.n_aktiv)
log.info("Min nedetid: %d min | poll %ds | innlogging: %s",
         MIN_DOWNTIME_MIN, POLL_SEC, "bridge_auth" if _auth else "API-nokkel")

# ── HOVEDLOKKE ────────────────────────────────────────────────────────────
while True:
    try:
        if client is None:
            log.info("Kobler til %s ...", OPC_URL)
            client = Client(OPC_URL)
            client.connect()
            for l in linjer:
                l.node_teller = client.get_node(l.n_teller)
                l.node_aktiv  = client.get_node(l.n_aktiv)
            log.info("Tilkoblet")
            fb_set("opc_status/connected", True)
            fb_set("opc_status/url", OPC_URL)
            errors = 0

        now  = time.time()
        dato = dagsnokkel()

        for l in linjer:
            count = int(l.node_teller.get_value())
            aktiv = bool(l.node_aktiv.get_value())
            l.oppdater(count, aktiv, now, dato)

        if now - sist_status >= STATUS_SEC:
            fb_set("opc_status/last_seen", int(now * 1000))
            sist_status = now

        time.sleep(POLL_SEC)

    except KeyboardInterrupt:
        log.info("Avslutter ...")
        break
    except Exception as e:
        errors += 1
        log.error("Feil #%d: %s", errors, e)
        if client:
            try: client.disconnect()
            except Exception: pass
            client = None
        fb_set("opc_status/connected", False)
        vent = min(60, errors * 5)
        log.info("Prover igjen om %ds ...", vent)
        time.sleep(vent)

if client:
    try: client.disconnect()
    except Exception: pass
fb_set("opc_status/connected", False)
log.info("Bridge avsluttet.")
