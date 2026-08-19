"""
bridge_auth.py — Firebase-innlogging for bridge.py
==================================================

Erstatter dagens `?auth=API_KEY`, som ikke er ekte autentisering og bare
fungerer så lenge databasereglene står åpne.

Bruker kun standardbiblioteket. Ingenting må installeres.

Fila har to bruksmåter:

  1) OPPSETT — kjøres én gang på fabrikk-PC-en:

         py bridge_auth.py --oppsett

     Den spør etter passordet til bridge@diplom-is.no, logger inn,
     finner UID-en selv, oppretter users/<UID> med role="bridge",
     og lagrer passordet lokalt i bridge_pw.txt.

  2) MODUL — importeres av bridge.py:

         from bridge_auth import FirebaseAuth
         fb = FirebaseAuth()

         # Før:  url = DB + "/production/%s/%s.json?auth=%s" % (dag, linje, API_KEY)
         # Nå:   url = DB + "/production/%s/%s.json?auth=%s" % (dag, linje, fb.token())

     token() er billig å kalle. Den returnerer et token fra minnet og
     fornyer seg selv først når det nærmer seg utløp.


VIKTIG OM REKKEFØLGE
--------------------
Kjør --oppsett FØR du publiserer database.rules.json i Firebase Console.
Oppsettet må skrive users/<UID>, og etter at reglene er publisert er den
skrivingen forbeholdt master.


OM PASSORDET
------------
Passordet lagres i bridge_pw.txt ved siden av denne fila, og leses
derfra ved oppstart. Den fila skal ikke sendes på e-post, ikke legges i
GitHub, og ikke deles. Alternativt kan du sette miljøvariabelen
BRIDGE_PW, som har forrang.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

# ── Oppsett for Diplom-is ────────────────────────────────────────────
API_KEY = "AIzaSyCL4x1KNwgeDxqTFeP32BndJgH4B5MworQ"
DB = "https://messystem-f14dd-default-rtdb.firebaseio.com"
BRIDGE_EMAIL = "bridge@diplom-is.no"

PW_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bridge_pw.txt")

SIGNIN_URL = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={}"
REFRESH_URL = "https://securetoken.googleapis.com/v1/token?key={}"


def _post(url, payload):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.loads(res.read().decode("utf-8"))


def _les_passord():
    """Miljøvariabel har forrang, ellers bridge_pw.txt."""
    pw = os.environ.get("BRIDGE_PW")
    if pw:
        return pw.strip()
    if os.path.exists(PW_FILE):
        with open(PW_FILE, "r", encoding="utf-8") as f:
            return f.read().strip()
    raise RuntimeError(
        "Fant ikke passordet. Kjør 'py bridge_auth.py --oppsett' først, "
        "eller sett miljøvariabelen BRIDGE_PW."
    )


class FirebaseAuth:
    """Holder et gyldig ID-token og fornyer det automatisk.

    ID-tokens fra Firebase varer i én time. Vi fornyer to minutter før
    utløp, slik at en natt-økt aldri står med et dødt token.
    """

    def __init__(self, email=None, password=None, api_key=None, margin_sec=120):
        self.api_key = api_key or API_KEY
        self.email = email or BRIDGE_EMAIL
        self._password = password
        self.margin = margin_sec
        self._id_token = None
        self._refresh_token = None
        self._uid = None
        self._expires_at = 0

    # ── offentlig ────────────────────────────────────────────────
    def token(self):
        """Returnerer et gyldig ID-token, og logger inn på nytt ved behov."""
        naa = time.time()
        if self._id_token and naa < self._expires_at - self.margin:
            return self._id_token
        if self._refresh_token:
            try:
                self._forny()
                return self._id_token
            except Exception as e:
                print("[auth] Fornying feilet (%s), logger inn på nytt" % e)
        self._logg_inn()
        return self._id_token

    @property
    def uid(self):
        if not self._uid:
            self.token()
        return self._uid

    def invalidate(self):
        """Kall denne hvis databasen svarer 401 — tvinger ny innlogging."""
        self._id_token = None
        self._expires_at = 0

    # ── internt ──────────────────────────────────────────────────
    def _logg_inn(self):
        if self._password is None:
            self._password = _les_passord()
        siste = None
        for forsok in range(3):
            try:
                ut = _post(
                    SIGNIN_URL.format(self.api_key),
                    {
                        "email": self.email,
                        "password": self._password,
                        "returnSecureToken": True,
                    },
                )
                self._id_token = ut["idToken"]
                self._refresh_token = ut["refreshToken"]
                self._uid = ut["localId"]
                self._expires_at = time.time() + int(ut.get("expiresIn", 3600))
                print("[auth] Innlogget som %s" % self.email)
                return
            except urllib.error.HTTPError as e:
                kropp = e.read().decode("utf-8", "replace")
                if "INVALID" in kropp or "EMAIL_NOT_FOUND" in kropp:
                    raise RuntimeError("Feil e-post eller passord for %s" % self.email)
                siste = "%s %s" % (e.code, kropp[:120])
                time.sleep(2 * (forsok + 1))
            except Exception as e:
                # Nettet på fabrikken kan blinke — prøv igjen før vi gir opp
                siste = e
                time.sleep(2 * (forsok + 1))
        raise RuntimeError("Klarte ikke logge inn mot Firebase: %s" % siste)

    def _forny(self):
        ut = _post(
            REFRESH_URL.format(self.api_key),
            {"grant_type": "refresh_token", "refresh_token": self._refresh_token},
        )
        self._id_token = ut["id_token"]
        self._refresh_token = ut["refresh_token"]
        self._uid = ut.get("user_id", self._uid)
        self._expires_at = time.time() + int(ut.get("expires_in", 3600))


# ── Oppsett ──────────────────────────────────────────────────────────
def oppsett():
    import getpass

    print("Oppsett av OPC-broens Firebase-innlogging")
    print("=" * 46)
    print("Bruker: %s\n" % BRIDGE_EMAIL)

    if os.path.exists(PW_FILE):
        svar = input("bridge_pw.txt finnes allerede. Skrive over? (j/n): ")
        if svar.strip().lower() not in ("j", "ja"):
            print("Avbrutt.")
            return 1

    pw = getpass.getpass("Passord for %s: " % BRIDGE_EMAIL)
    if not pw:
        print("Tomt passord. Avbrutt.")
        return 1

    print("\n[1/4] Logger inn ...")
    fb = FirebaseAuth(password=pw)
    try:
        tok = fb.token()
    except RuntimeError as e:
        print("     FEIL: %s" % e)
        return 1
    print("     OK. UID: %s" % fb.uid)

    print("[2/4] Oppretter users/%s med role='bridge' ..." % fb.uid)
    profil = {"name": "OPC-bro", "email": BRIDGE_EMAIL, "role": "bridge"}
    url = "%s/users/%s.json?auth=%s" % (DB, fb.uid, tok)
    req = urllib.request.Request(
        url,
        data=json.dumps(profil).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="PUT",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            res.read()
        print("     OK.")
    except urllib.error.HTTPError as e:
        print("     FEIL %s. Er reglene allerede publisert?" % e.code)
        print("     Oppsettet må kjøres FØR reglene tas i bruk.")
        return 1

    print("[3/4] Leser opc_status for å bekrefte tilgang ...")
    try:
        with urllib.request.urlopen(
            "%s/opc_status.json?auth=%s" % (DB, tok), timeout=20
        ) as res:
            print("     OK: %s" % res.read().decode("utf-8")[:100])
    except urllib.error.HTTPError as e:
        print("     FEIL %s ved lesing." % e.code)
        return 1

    print("[4/4] Lagrer passordet i %s ..." % PW_FILE)
    with open(PW_FILE, "w", encoding="utf-8") as f:
        f.write(pw)
    try:
        os.chmod(PW_FILE, 0o600)
    except Exception:
        pass
    print("     OK.\n")

    print("Ferdig. Neste steg:")
    print("  1. Åpne bridge.py og legg til øverst:")
    print("         from bridge_auth import FirebaseAuth")
    print("         fb = FirebaseAuth()")
    print("  2. Bytt alle '?auth=' + API_KEY  til  '?auth=' + fb.token()")
    print("  3. Start broen og se at tellingen kommer inn på dashbordet.")
    print("  4. FØRST DA: publiser database.rules.json i Firebase Console.")
    print("\n  bridge_pw.txt skal ikke deles eller legges i GitHub.")
    return 0


def selvtest():
    print("Selvtest — leser opc_status med innlogget token")
    fb = FirebaseAuth()
    tok = fb.token()
    print("UID: %s" % fb.uid)
    try:
        with urllib.request.urlopen(
            "%s/opc_status.json?auth=%s" % (DB, tok), timeout=20
        ) as res:
            print("OK: %s" % res.read().decode("utf-8")[:150])
    except urllib.error.HTTPError as e:
        print("FEIL %s — mangler users/%s med role='bridge'?" % (e.code, fb.uid))
        return 1
    print("Innloggingen fungerer.")
    return 0


if __name__ == "__main__":
    if "--oppsett" in sys.argv:
        sys.exit(oppsett())
    sys.exit(selvtest())
