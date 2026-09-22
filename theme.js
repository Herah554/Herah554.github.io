/* theme.js — lys/mørk modus for hele MES-systemet
   ================================================
   Leser valget fra localStorage, setter data-theme på <html> FØR sida
   tegnes (så det ikke blinker lyst først), og legger en liten bryter
   inn i navigasjonen på alle sider som har en. Valget følger nettleseren,
   ikke brukeren — det er en skjerminnstilling, ikke en profilinnstilling. */
(function () {
  var KEY = 'diplomis.theme';

  function stored() {
    try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; }
    catch (e) { return 'light'; }
  }
  function apply(t) {
    document.documentElement.setAttribute('data-theme', t);
    // Chart.js leser fargene sine én gang per graf; tekstfargen settes globalt
    if (window.Chart && Chart.defaults) {
      Chart.defaults.color = (t === 'dark') ? '#7d8898' : '#8a95a8';
    }
  }
  function label(t) { return t === 'dark' ? '☀ Lys' : '☾ Mørk'; }

  apply(stored());

  function inject() {
    var ml = document.querySelector('nav .ml');
    if (!ml || document.getElementById('theme-btn')) return;
    var b = document.createElement('button');
    b.id = 'theme-btn'; b.className = 'theme-btn'; b.type = 'button';
    b.textContent = label(stored());
    b.title = 'Bytt mellom lyst og mørkt tema';
    b.addEventListener('click', function () {
      var n = stored() === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, n); } catch (e) {}
      apply(n);
      b.textContent = label(n);
    });
    ml.insertBefore(b, ml.firstChild);
    apply(stored()); // Chart er lastet nå — sett tekstfargen på nytt
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
