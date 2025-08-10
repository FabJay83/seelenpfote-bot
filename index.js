// optional ganz oben neben den Helfern
const getCaseById = id => (CASES || []).find(c => c.id === id);

function replyFor(text, s) {
  if (s.lang === null) s.lang = detectLang(text);
  const L = TXT[s.lang || 'de'];
  const n = norm(text);
  const tNow = now();

  // --- Befehle ---
  if (n === '/start') { s.state = { name: null, step: 0, data: {} }; return L.hello(BOT_NAME); }
  if (n === '/help') return L.help;
  if (n === '/reset') { s.state = { name: null, step: 0, data: {} }; s.lastUser=''; s.lastBot=''; return L.reset; }
  if (n === '/langde')  { s.lang = 'de'; return "Alles klar, ich antworte auf Deutsch."; }
  if (n === '/langen')  { s.lang = 'en'; return "Got it, I’ll reply in English."; }
  if (n === '/langauto'){ s.lang = null;  return (detectLang(text)==='en' ? "Auto language enabled." : "Automatische Sprache aktiviert."); }

  // --- Anti-Duplikat (10 s) ---
  if (n && n === s.lastUser && (tNow - s.lastUserAt < 10000)) {
    return rotate(TXT[s.lang || 'de'].dup, s.idx);
  }

  // Vorab checken, ob irgendwas (v. a. Notfall) gematcht wird
  const detected = findCase(text, s.lang || 'de');

  // 1) NOTFÄLLE haben IMMER Vorrang → sofortige Antwort + kein aktiver State
  if (detected && detected.emergency) {
    s.state = { name: null, step: 0, data: {} };
    return detected.start(text, s, L);
  }

  // 2) Läuft bereits ein Fall? → immer zuerst WEITERFÜHREN
  if (s.state.name) {
    const active = getCaseById(s.state.name);
    if (active) {
      // Wenn der User das gleiche Thema nochmal erwähnt, NICHT neu starten, sondern als Schritt werten
      return active.step(text, s, L);
    }
    // falls Case nicht gefunden: State zurücksetzen
    s.state = { name: null, step: 0, data: {} };
  }

  // 3) Kein aktiver Fall → neuen Fall starten, falls erkannt
  if (detected) {
    s.state = { name: detected.id, step: 0, data: {} };
    return detected.start(text, s, L);
  }

  // 4) Fallback
  return `${rotate(L.acks, s.idx)} ${rotate(L.tails, s.idx)}`;
}





