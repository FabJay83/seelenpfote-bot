// index.js — Seelenpfote Bot (Telegram + CLI)
// Zustandsmaschine + Fall-Logik: Pfote entzündet, Durchfall, Erbrochenes, Humpeln
// Deutsch Standard, Auto-DE/EN, Foto-Handling, Anti-Wiederholung.

require('dotenv').config();

const BOT_NAME = process.env.BOT_NAME || 'Seelenpfote';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

let Telegraf;
try { ({ Telegraf } = require('telegraf')); } catch { /* optional für CLI */ }

const USE_TELEGRAM = !!TOKEN;

/* ------------------ Sprach-Erkennung (leicht) ------------------ */
function detectLang(raw) {
  const text = (raw || '').toLowerCase();
  if (!text.trim()) return 'de';
  if (/[äöüß]/.test(text)) return 'de';
  const de = [
    /\b(und|oder|nicht|auch|ein(e|en|er)?|der|die|das|mit|ohne|bitte|danke|hilfe|warum|wieso|wie|was|wann|wo|welch\w*|mein|dein|sein|ihr|zum|zur|im|am|vom|beim)\b/,
    /(ung|keit|chen|lich|isch)\b/
  ].some(r => r.test(text));
  if (de) return 'de';
  const en = [
    /\b(the|and|or|not|with|without|please|thanks|help|why|how|what|when|where|which|who|i|you|he|she|we|they|my|your|his|her|their)\b/,
    /(ing|ed|ly)\b/
  ].some(r => r.test(text));
  if (en) return 'en';
  const asciiRatio = (text.replace(/[^\x00-\x7F]/g, '').length) / text.length;
  return asciiRatio > 0.9 ? 'en' : 'de';
}

/* ------------------ Utils & Sessions ------------------ */
const now = () => Date.now();
const norm = s => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const rotate = (arr, ref) => arr[(ref.value++ % arr.length + arr.length) % arr.length];

const sessions = new Map();
function getSession(id = 'cli') {
  if (!sessions.has(id)) {
    sessions.set(id, {
      lang: 'de',               // Startsprache Deutsch
      lastUser: '',
      lastUserAt: 0,
      lastBot: '',
      idx: { value: 0 },
      state: { name: null, step: 0, data: {} } // Zustandsmaschine pro Chat
    });
  }
  return sessions.get(id);
}

/* ------------------ Texte ------------------ */
const TXT = {
  de: {
    hello: (n) =>
`👋 Willkommen bei ${n}!
Erzähl mir kurz, was los ist: z. B. „Durchfall“, „Hund erbricht“, „entzündete Pfote“, „humpelt“. Ich gebe dir eine liebevolle Ersteinschätzung. (/help)`,
    help:
`Befehle:
/start – Begrüßung
/help – Hilfe
/reset – Verlauf zurücksetzen
/langde – Deutsch erzwingen
/langen – Englisch erzwingen
/langauto – automatische Sprache`,
    askPhoto:
`Ja, bitte schick ein **klares Foto** (Pfote von oben, seitlich und zwischen den Ballen). Danach schreibe: "Foto gesendet".`,
    photoReceived:
`Foto erhalten, danke! Ich schaue nach auffälligen Punkten. Wenn ich etwas übersehe, beschreibe es bitte kurz in Worten.`,
    acks: ["Alles klar.", "Verstanden.", "Okay."],
    tails: ["Wie kann ich dir weiter helfen?", "Magst du 1–2 Details hinzufügen?", "Sag mir kurz die wichtigsten Punkte."],
    dup: ["Das habe ich gerade beantwortet.", "Gleiche Eingabe erkannt.", "Wir hatten das eben schon."],
    reset: "Verlauf gelöscht. Erzähl mir, was los ist.",
    bye: "Bis bald!"
  },
  en: {
    hello: (n) =>
`👋 Welcome to ${n}!
Tell me briefly what's going on: “diarrhea”, “vomiting”, “inflamed paw”, “limping”. I’ll give a kind first assessment. (/help)`,
    help:
`Commands:
/start – greeting
/help – help
/reset – clear session
/langde – force German
/langen – force English
/langauto – auto language`,
    askPhoto: `Yes, please send a **clear photo** (top, side, between pads). Then type "photo sent".`,
    photoReceived: `Photo received, thanks! I’ll note key signs. Add text if something is unclear.`,
    acks: ["Got it.", "Understood.", "Okay."],
    tails: ["How can I help further?", "Add 1–2 details.", "Tell me the key points."],
    dup: ["I just answered that.", "Same input detected.", "We just covered that."],
    reset: "Session cleared. Tell me what's happening.",
    bye: "See you!"
  }
};

/* ------------------ Intent-Erkennung ------------------ */
function detectIntentDE(t) {
  const s = t.toLowerCase();
  if (/(pfote|ballen|kralle)/.test(s) && /(entzünd|rot|schwell|wund|eiter|schnitt|riss)/.test(s))
    return 'paw';
  if (/(durchfall|dünn|wässrig|breiig|blut im stuhl)/.test(s))
    return 'diarrhea';
  if (/(erbroch|kotz|brechen|übelkeit|galle|schaum)/.test(s))
    return 'vomit';
  if (/(humpel|lahm|zieht bein|belastet nicht|lahmt)/.test(s))
    return 'limp';
  if (/(foto|bild)\??$/.test(s))
    return 'photo_ask';
  return null;
}
function detectIntentEN(t) {
  const s = t.toLowerCase();
  if (/(paw|pad|nail)/.test(s) && /(inflam|red|swoll|wound|pus|cut|crack)/.test(s))
    return 'paw';
  if (/(diarrhea|loose stool|watery stool|bloody stool)/.test(s))
    return 'diarrhea';
  if (/(vomit|throwing up|nausea|bile|foam)/.test(s))
    return 'vomit';
  if (/(limp|lameness|not weight-bearing|favoring leg)/.test(s))
    return 'limp';
  if (/(photo|picture)\??$/.test(s))
    return 'photo_ask';
  return null;
}
function detectIntent(text, lang) {
  return (lang === 'en') ? detectIntentEN(text) : detectIntentDE(text);
}

/* ------------------ Anti-Wiederholung ------------------ */
function antiRepeat(out, s) {
  const outNorm = norm(out);
  if (outNorm === s.lastBot) {
    const extra = (s.lang === 'en') ? "Anything else?" : "Noch etwas?";
    if (norm(out + "\n" + extra) !== s.lastBot) return out + "\n" + extra;
    return out + " …";
  }
  return out;
}

/* ------------------ Zustands-Handler pro Fall ------------------ */
// 1) Entzündete Pfote
function handlePaw(msg, s) {
  const L = TXT[s.lang];
  const st = s.state;
  if (st.step === 0) {
    st.step = 1;
    return (
`Entzündete Pfote – Erste Schritte:
• Mit lauwarmem Wasser oder Salzlösung spülen, sanft trocken tupfen.
• Lecken verhindern (Socken/Schuh/Halskragen).
• 10–15 Min. kühlen (Tuch, kein Eis direkt).

Kurze Fragen:
1) Seit wann? (Stunden/Tage)
2) Lahmt er stark oder nur leicht?
3) Siehst du einen Schnitt/Fremdkörper zwischen den Ballen? (ja/nein)
Du kannst auch ein *Foto* schicken.`.trim()
    );
  }
  // Auswertung der Antworten (sehr simpel heuristisch)
  st.data.text = (st.data.text || '') + ' ' + msg;
  const sinceWeek = /\b(woche|tage|seit (einer|1) woche)\b/i.test(st.data.text);
  const strongLimp = /(gar nicht|stark|kaum belastet|nicht belastet)/i.test(st.data.text);
  const foreignNo = /\bnein\b/i.test(st.data.text);

  if (st.step === 1) {
    st.step = 2;
    return (
`Danke! Hier ist meine Einschätzung:
• Besteht es ${sinceWeek ? 'seit mehreren Tagen' : 'erst seit kurzer Zeit'}${strongLimp ? ' und er lahmt deutlich' : ''}.
• ${
  foreignNo ? 'Kein sichtbarer Fremdkörper.' : 'Achte auf Schnitte/Fremdkörper zwischen den Ballen.'
}

Nächste Schritte:
1) Pfote 2–3×/Tag spülen, trocken tupfen; Lecken verhindern.
2) 10–15 Min. kühlen, 2–3×/Tag.
3) Schonung/kurze Spaziergänge auf sauberem Untergrund.
4) ${
  sinceWeek || strongLimp ? 'Bitte Tierarzttermin innerhalb von 24 h vereinbaren.' : 'Wenn es nach 24–48 h nicht besser wird, bitte Tierarzt.'
}

Du kannst mir ein *Foto* senden, wenn du möchtest.`.trim()
    );
  }
  return rotate(L.tails, s.idx);
}

// 2) Durchfall
function handleDiarrhea(msg, s) {
  const L = TXT[s.lang];
  const st = s.state;
  if (st.step === 0) {
    st.step = 1;
    return (
`Durchfall – kurze Fragen:
1) Seit wann? (Stunden/Tage)
2) Appetit/Trinken normal? (ja/nein)
3) Blut/Schleim im Kot? (ja/nein)
4) Allgemeinzustand? (munter/müde)
Du kannst auch ein *Foto vom Kot* schicken (falls sinnvoll).`.trim()
    );
  }
  st.data.text = (st.data.text || '') + ' ' + msg;
  const >48h = /(48|zwei tage|2 tage|seit.*tagen)/i.test(st.data.text); // eslint ignore (we'll avoid invalid var name)
  const bloody = /\b(blut|blutig|schleim)\b/i.test(st.data.text);
  const lethargic = /\b(müde|apathisch|schwach|kraftlos)\b/i.test(st.data.text);
  const drinkingNo = /\b(trinkt nicht|trinkt kaum|kein wasser)\b/i.test(st.data.text);

  if (st.step === 1) {
    st.step = 2;
    const alarm = bloody || lethargic || drinkingNo || >48h;
    return (
`Einschätzung:
• ${
  alarm ? 'Es liegen Warnzeichen vor.' : 'Es klingt nach leichtem bis mäßigem Durchfall.'
}

Nächste Schritte:
1) 6–12 h Schonkostpause (Wasser anbieten).
2) Dann leichte Kost in kleinen Portionen: gekochter Reis + Hühnchen (ohne Haut/Knochen) oder Morosuppe.
3) Elektrolytlösung anbieten (Tierbedarf).
4) ${
  alarm ? 'Bitte heute noch Tierarzt kontaktieren.' : 'Wenn keine Besserung innerhalb 24–36 h: Tierarzt.'
}
⚠️ Welpen, Senioren oder Vorerkrankungen → lieber früher abklären.

Wenn du Details hast, schreib sie mir oder sende ein *Foto* (falls sinnvoll).`.trim()
    );
  }
  return rotate(L.tails, s.idx);
}

// 3) Erbrechen
function handleVomit(msg, s) {
  const L = TXT[s.lang];
  const st = s.state;
  if (st.step === 0) {
    st.step = 1;
    return (
`Erbrechen – kurze Fragen:
1) Wie oft in den letzten 12 h?
2) Nur Futter/Galle/Schaum? Blut?
3) Trinkt und hält Wasser? (ja/nein)
4) Allgemeinzustand? (munter/müde)

Du kannst auch *Foto* vom Erbrochenen schicken (falls sinnvoll).`.trim()
    );
  }
  st.data.text = (st.data.text || '') + ' ' + msg;
  const many = /(3|drei|mehrfach|oft|häufig)/i.test(st.data.text);
  const blood = /\b(blut|rötlich)\b/i.test(st.data.text);
  const noWater = /(hält.*nicht|erbricht wasser|trinkt nicht)/i.test(st.data.text);
  const lethargic = /\b(müde|apathisch|schwach)\b/i.test(st.data.text);

  if (st.step === 1) {
    st.step = 2;
    const alarm = many || blood || noWater || lethargic;
    return (
`Einschätzung:
• ${
  alarm ? 'Warnzeichen vorhanden.' : 'Klingt nach leichter/mäßiger Magenreizung.'
}

Nächste Schritte:
1) 6–12 h Futterpause (Wasser in kleinen Mengen, häufig anbieten).
2) Danach kleine Portionen Schonkost (Huhn/Reis) oder Morosuppe.
3) Beobachten: Bauchschmerzen, Aufgeblähtsein, Fremdkörperverdacht?
4) ${
  alarm ? 'Bitte heute noch Tierarzt kontaktieren.' : 'Keine Besserung in 24 h → Tierarzt.'
}

Du kannst mir *Foto* schicken, wenn du unsicher bist.`.trim()
    );
  }
  return rotate(L.tails, s.idx);
}

// 4) Humpeln / Lahmheit
function handleLimp(msg, s) {
  const L = TXT[s.lang];
  const st = s.state;
  if (st.step === 0) {
    st.step = 1;
    return (
`Humpeln – kurze Fragen:
1) Seit wann? (Stunden/Tage)
2) Belastet er das Bein gar nicht oder nur wenig?
3) Sichtbare Verletzung/Schwellung? (ja/nein)
4) Unfall/Sturz passiert? (ja/nein)
Du kannst ein *Foto/kurzes Video* schicken.`.trim()
    );
  }
  st.data.text = (st.data.text || '') + ' ' + msg;
  const sinceDays = /(tage|seit.*tag(en)?|woche)/i.test(st.data.text);
  const noWeight = /(gar nicht|nicht belastet|trägt nicht)/i.test(st.data.text);
  const swelling = /(schwell|dick|heiß|warm)/i.test(st.data.text);
  const accident = /(unfall|sturz|umgeknickt|zerrung)/i.test(st.data.text);

  if (st.step === 1) {
    st.step = 2;
    const alarm = noWeight || swelling || accident || sinceDays;
    return (
`Einschätzung:
• ${
  noWeight ? 'Nicht-Belasten ist ein Warnzeichen.' :
  sinceDays ? 'Länger als 24–48 h bestehend.' :
  'Leichte Lahmheit möglich.'
}

Nächste Schritte:
1) Schonung, keine wilden Spiele/Treppen.
2) Kühlen 10–15 Min., 2–3×/Tag (Tuch, kein Eis direkt).
3) Kurze, ruhige Gassi-Runden auf ebenem Untergrund.
4) ${
  alarm ? 'Tierarzttermin innerhalb von 24 h sinnvoll.' : 'Wenn es nicht besser wird: Tierarzt.'
}

Wenn du willst, sende ein *Foto/Video*; danach schreibe „Foto gesendet“.`.trim()
    );
  }
  return rotate(L.tails, s.idx);
}

/* ------------------ Router für Zustandsmaschine ------------------ */
function routeState(text, s) {
  switch (s.state.name) {
    case 'paw':       return handlePaw(text, s);
    case 'diarrhea':  return handleDiarrhea(text, s);
    case 'vomit':     return handleVomit(text, s);
    case 'limp':      return handleLimp(text, s);
    default:          return null;
  }
}

/* ------------------ Hauptantwort-Logik ------------------ */
function replyFor(text, s) {
  // Sprache initialisieren / beibehalten
  if (s.lang === null) s.lang = detectLang(text);
  const L = TXT[s.lang || 'de'];
  const n = norm(text);
  const tNow = now();

  // Kommandos
  if (n === '/start') {
    s.state = { name: null, step: 0, data: {} };
    return L.hello(BOT_NAME);
  }
  if (n === '/help') return L.help;
  if (n === '/reset') { s.state = { name: null, step: 0, data: {} }; s.lastUser=''; s.lastBot=''; return L.reset; }
  if (n === '/langde')  { s.lang = 'de';  return "Alles klar, ich antworte auf Deutsch."; }
  if (n === '/langen')  { s.lang = 'en';  return "Got it, I’ll reply in English."; }
  if (n === '/langauto'){ s.lang = null;  return (detectLang(text)==='en' ? "Auto language enabled." : "Automatische Sprache aktiviert."); }

  // Anti-Duplikat (gleiches User-Input < 10s)
  if (n && n === s.lastUser && (tNow - s.lastUserAt < 10000)) {
    return rotate(L.dup, s.idx);
  }

  // Wenn im Fall-Dialog → dort weiter
  const follow = routeState(text, s);
  if (follow) return follow;

  // Intent neu starten (wenn er frei ist)
  const intent = detectIntent(text, s.lang || 'de');
  if (intent === 'photo_ask') return L.askPhoto;
  if (intent) {
    s.state = { name: intent, step: 0, data: {} };
    return routeState(text, s);
  }

  // Standard: kurze Bestätigung + Frage weiter
  return `${rotate(L.acks, s.idx)} ${rotate(L.tails, s.idx)}`;
}

/* ------------------ Foto-Handling ------------------ */
function onPhoto(s) {
  const L = TXT[s.lang || 'de'];
  // Foto zählt als Info für aktuellen Fall
  s.state.data.hasPhoto = true;
  return L.photoReceived;
}

/* ------------------ Telegram ------------------ */
async function startTelegram() {
  if (!Telegraf) throw new Error('telegraf not installed');
  const bot = new Telegraf(TOKEN);

  bot.on('text', (ctx) => {
    const id = String(ctx.chat.id);
    const s = getSession(id);
    const msg = ctx.message.text || '';

    if (s.lang === null) s.lang = detectLang(msg);

    let out = replyFor(msg, s);
    out = antiRepeat(out, s);

    s.lastUser   = norm(msg);
    s.lastUserAt = now();
    s.lastBot    = norm(out);

    ctx.reply(out).catch(err => console.error('[TELEGRAM send error]', err));
  });

  bot.on('photo', (ctx) => {
    const id = String(ctx.chat.id);
    const s = getSession(id);
    const out = onPhoto(s);
    s.lastBot = norm(out);
    ctx.reply(out).catch(err => console.error('[TELEGRAM send error]', err));
  });

  await bot.launch();
  console.log(`[${BOT_NAME}] Telegram-Bot läuft.`);
  process.once('SIGINT', () => { bot.stop('SIGINT'); process.exit(0); });
  process.once('SIGTERM', () => { bot.stop('SIGTERM'); process.exit(0); });
}

/* ------------------ CLI (Fallback) ------------------ */
function startCLI() {
  const id = 'cli';
  const s = getSession(id);
  const rl = require('readline').createInterface({
    input: process.stdin, output: process.stdout, prompt: `${BOT_NAME}> `
  });

  console.log(`${BOT_NAME} – CLI. Tippe /help.`);
  rl.prompt();

  rl.on('line', (line) => {
    const msg = line || '';
    if (s.lang === null) s.lang = detectLang(msg);
    let out = replyFor(msg, s);
    out = antiRepeat(out, s);
    s.lastUser = norm(msg);
    s.lastUserAt = now();
    s.lastBot = norm(out);
    console.log(out);
    rl.prompt();
  });

  rl.on('close', () => {
    console.log((s.lang === 'en') ? TXT.en.bye : TXT.de.bye);
    process.exit(0);
  });
}

/* ------------------ Start ------------------ */
(async () => {
  try {
    if (USE_TELEGRAM) await startTelegram();
    else startCLI();
  } catch (e) {
    console.error('[FATAL]', e);
    process.exit(1);
  }
})();

