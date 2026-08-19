"""
Firebase-innlogging for bridge.py
=================================

Erstatter dagens `?auth=API_KEY`, som ikke er ekte autentisering og bare
fungerer så lenge databasereglene står åpne.

Bruker kun standardbiblioteket — ingenting må installeres på fabrikk-PC-en.

OPPSETT (gjøres én gang)
------------------------
1. Firebase Console → Authentication → Users → Add user
       E-post:  bridge@diplom-is.no
       Passord: <lag et langt, tilfeldig passord>
   Kopier UID-en som dukker opp i lista.

2. Firebase Console → Realtime Database → legg til under `users`:
       users/<UID>/  {  "name": "OPC-bro",
                        "email": "bridge@diplom-is.no",
                        "role": "bridge"  }
   Uten denne noden vil reglene avvise broen.

3. Lim inn passordet i BRIDGE_PASSWORD under.

BRUK I bridge.py
----------------
    from bridge_auth import FirebaseAuth

    fb = FirebaseAuth(API_KEY, BRIDGE_EMAIL, BRIDGE_PASSWORD)

    # Før:  url = f"{DB}/production/{dag}/{linje}.json?auth={API_KEY}"
    # Nå:   url = f"{DB}/production/{dag}/{linje}.json?auth={fb.token()}"

`token()` er billig å kalle — den returnerer et token fra minnet og
fornyer seg selv først når det nærmer seg utløp.
"""

import json
import time
import urllib.request
import urllib.error

SIGNIN_URL = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={}"
REFRESH_URL = "https://securetoken.googleapis.com/v1/token?key={}"


class FirebaseAuth:
    """Holder et gyldig ID-token og fornyer det automatisk.

    ID-tokens fra Firebase varer i én time. Vi fornyer to minutter før
    utløp, slik at en langvarig natt-økt aldri står med et dødt token.
    """

    def __init__(self, api_key, email, password, margin_sec=120):
        self.api_key = api_key
        self.email = email
        self.password = password
        self.margin = margin_sec
        self._id_token = None
        self._refresh_token = None
        self._expires_at = 0

    # ── offentlig ────────────────────────────────────────────────
    def token(self):
        """Returnerer et gyldig ID-token, og logger inn på nytt ved behov."""
        now = time.time()
        if self._id_token and now < self._expires_at - self.margin:
            return self._id_token
        if self._refresh_token:
            try:
                self._do_refresh()
                return self._id_token
            except Exception as e:
                print("[auth] Fornying feilet ({}), logger inn på nytt".format(e))
        self._do_signin()
        return self._id_token

    def invalidate(self):
        """Kall denne hvis databasen svarer 401 — tvinger ny innlogging."""
        self._id_token = None
        self._expires_at = 0

    # ── internt ──────────────────────────────────────────────────
    def _post(self, url, payload):
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url, data=data, headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=20) as res:
            return json.loads(res.read().decode("utf-8"))

    def _do_signin(self):
        last = None
        for forsok in range(3):
            try:
                out = self._post(
                    SIGNIN_URL.format(self.api_key),
                    {
                        "email": self.email,
                        "password": self.password,
                        "returnSecureToken": True,
                    },
                )
                self._id_token = out["idToken"]
                self._refresh_token = out["refreshToken"]
                self._expires_at = time.time() + int(out.get("expiresIn", 3600))
                print("[auth] Innlogget som {}".format(self.email))
                return
            except Exception as e:
                last = e
                # Nettet på fabrikken kan blinke — prøv igjen før vi gir opp
                time.sleep(2 * (forsok + 1))
        raise RuntimeError("Klarte ikke logge inn mot Firebase: {}".format(last))

    def _do_refresh(self):
        out = self._post(
            REFRESH_URL.format(self.api_key),
            {"grant_type": "refresh_token", "refresh_token": self._refresh_token},
        )
        self._id_token = out["id_token"]
        self._refresh_token = out["refresh_token"]
        self._expires_at = time.time() + int(out.get("expires_in", 3600))


# ── Selvtest: kjør `py bridge_auth.py` for å sjekke oppsettet ────
if __name__ == "__main__":
    API_KEY = "AIzaSyCL4x1KNwgeDxqTFeP32BndJgH4B5MworQ"
    BRIDGE_EMAIL = "bridge@diplom-is.no"
    BRIDGE_PASSWORD = "SETT_INN_PASSORDET_HER"
    DB = "https://messystem-f14dd-default-rtdb.firebaseio.com"

    if BRIDGE_PASSWORD == "SETT_INN_PASSORDET_HER":
        raise SystemExit("Sett BRIDGE_PASSWORD først (se toppen av fila).")

    fb = FirebaseAuth(API_KEY, BRIDGE_EMAIL, BRIDGE_PASSWORD)
    tok = fb.token()
    print("Token hentet, {} tegn".format(len(tok)))

    url = "{}/opc_status.json?auth={}".format(DB, tok)
    try:
        with urllib.request.urlopen(url, timeout=20) as res:
            print("Lesing OK:", res.read().decode("utf-8")[:120])
    except urllib.error.HTTPError as e:
        raise SystemExit(
            "Lesing avvist ({}). Mangler users/<UID> med role='bridge'?".format(e.code)
        )
    print("Oppsettet fungerer.")
