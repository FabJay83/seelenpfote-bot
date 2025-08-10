// index.js — Seelenpfote Bot (State Machine: entzündete Pfote)
// Deutsch als Standard, Auto DE/EN, Telegram + CLI, ohne Versionsspam.

require('dotenv').config();

const BOT_NAME = process.env.BOT_NAME || 'Seelenpfote';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

let Telegraf;
try { ({ Telegraf } = require('telegraf')); } catch { /* optional for CLI */ }
const USE_TELEGRAM = !!TOKEN;

/* --------------- Language detection (lightweight) --------------- */
function detectLang(raw) {
  const text = (raw || '').toLowerCase();
  if (!text.trim()) return 'de';
  if (/[äöüß]/.test(text)) return 'de';
  const deHits = [
    /\b(und|oder|nicht|auch|ein(e|en|er)?|der|die|das|mit|ohne|bitte|danke|hilfe|warum|wieso|wie|was|wann|wo|welch\w*|mein|dein|sein|ihr|zum|zur|im|am|vom|beim)\b/,
    /(ung|keit|chen|lich|isch)\b/
  ].some(r => r.test(text));
  if (deHits) return 'de';
  const enHits = [
    /\b(the|and|or|not|with|without|please|thanks|help|why|how|what|when|where|which|who|i|you|he|she|we|they|my|your|his|her|their)\b/,
    /(ing|ed|ly)\b/
  ].some(r => r.test(text));
  if (enHits) return 'en';
  const asciiRatio = (text.replace(/[^\x00-\x7F]/g, '').length) / text.length;
  return asciiRatio > 0.9 ? 'en' : 'de';
}

/* --------------- Utils --------------- */
const now = () => Date.now();
const norm = s => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();

/* --------------- Sessions (mit Fallzustand) --------------- */
const sessions = new Map();
function getSession(id = 'cli') {
  if (!sessions.has(id)) {
    sessions.set(id, {
      lang: 'de',           // Standard: Deutsch
      lastUser: '',
      lastUserAt: 0,
      lastBot: '',
      // State machine:
      state: 'idle',        // 'idle' | 'paw_inflamed'
      case: null            // { intent, asked:{q1,q2,q3}, data:{durationDays, lame:'none|mild|severe', foreignBody:boolean|null, redflags:Set<string>} }
    });
  }
  return sessions.get(id);
}

/* --------------- Texte --------------- */
const TXT = {
  de: {
    hello: (n) =>
`👋 Willkommen bei ${n}!
Erzähl kurz, was los ist – z. B. „Mein Hund humpelt“ oder „Katze frisst nicht“. Ich gebe dir eine liebevolle Ersteinschätzung. (/help)`,
    help:
`Befehle:
/start – Begrüßung
/help – Hilfe
/sos – Erste Hilfe kurz
/langde – Deutsch
/langen – Englisch
/langauto – automatische Sprache
/reset – Fall zurücksetzen`,
    sos:
`Erste Hilfe (kurz):
1) Ruhe bewahren, Tier sichern.
2) Blutung: sanften Druck mit Kompresse.
3) Atmung/Kreislauf prüfen; ggf. Notfalltierarzt anrufen.
4) Keine menschlichen Medikamente geben.
5) Warm halten.`,
    pawIntro:
`Entzündete Pfote – erste Schritte:
• Pfote mit lauwarmem Wasser oder isotoner Kochsalzlösung spülen.
• Sanft trocken tupfen; kein Alkohol/Peroxid.
• Lecken verhindern (Söckchen/Schuh oder Halskragen).
• 10–15 Min. kühlen (Tuch, kein Eis direkt).

Ich stelle dir 3 kurze Fragen, damit ich genauer helfen kann.`,
    q1: `1) Seit wann besteht das Problem? (z. B. „seit 2 Tagen“, „seit einer Woche“)`,
    q2: `2) Lahmt er stark, nur leicht, oder gar nicht?`,
    q3: `3) Siehst du einen Schnitt/Fremdkörper zwischen den Ballen? (ja/nein)`,
    thanks: `Danke! Hier ist meine Einschätzung:`,
    planHeader: `Nächste Schritte:`,
    finish: `Wenn etwas unklar ist, frag nach. Du kannst mit /reset jederzeit neu starten.`,
    genericAck: ["Alles klar.", "Verstanden.", "Okay."],
    askMore: ["Magst du 1–2 Details ergänzen?", "Gib mir noch kurz ein Detail, dann werde ich konkret."]
  },
  en: {
    hello: (n) =>
`👋 Welcome to ${n}!
Tell me briefly what's happening – e.g., “My dog is limping”. I’ll give you a kind first assessment. (/help)`,
    help:
`Commands:
/start – greeting
/help – help
/sos – first aid
/langde – German
/langen – English
/langauto – auto
/reset – reset case`,
    sos:
`First aid (quick):
1) Stay calm, secure the pet.
2) Bleeding: gentle pressure with gauze.
3) Check breathing/circulation; call an emergency vet if needed.
4) No human meds.
5) Keep warm.`,
    pawIntro:
`Inflamed paw – first steps:
• Rinse with lukewarm water or saline.
• Pat dry gently; no alcohol/peroxide.
• Prevent licking (bootie/e-collar).
• Cool 10–15 min (cloth, no direct ice).

I’ll ask 3 short questions to be precise.`,
    q1: `1) Since when? (e.g., “2 days”, “one week”)`,
    q2: `2) Is the limping severe, mild, or not noticeable?`,
    q3: `3) Do you see a cut/foreign body between pads? (yes/no)`,
    thanks: `Thanks! Here’s my assessment:`,
    planHeader: `Next steps:`,
    finish: `If anything is unclear, ask me. Use /reset to start over.`,
    genericAck: ["Got it.", "Understood.", "Okay."],
    askMore: ["Give me one more detail?", "Add 1–2 details and I’ll be concrete."]
  }
};

/* --------------- Intent-Erkennung --------------- */
function detectIntent(text) {
  const t = text.toLowerCase();
  // entzündete/verletzte Pfote
  if ((/(pfote|pfoten|ballen)/.test(t) && /(entzünd|rot|warm|schwell|wund|verletz|schnitt|eiter)/.test(t)) ||
      (/(paw|pad)/.test(t) && /(inflam|red|warm|swoll|wound|cut|pus)/.test(t))) {
    return 'paw_inflamed';
  }
  return 'generic';
}

/* --------------- Parser für Antworten (DE/EN) --------------- */
function parseInfo(text, lang) {
  const t = text.toLowerCase();
  const data = {};

  // Dauer
  let m;
  if (lang === 'de') {
    if ((m = t.match(/seit\s+(\d+)\s*(tag|tagen)\b/))) data.durationDays = parseInt(m[1], 10);
    else if (t.includes('seit einer woche') || t.includes('seit 1 woche')) data.durationDays = 7;
    else if ((m = t.match(/seit\s+(\d+)\s*(woche|wochen)\b/))) data.durationDays = parseInt(m[1], 10) * 7;
  } else {
    if ((m = t.match(/for\s+(\d+)\s*(day|days)\b/))) data.durationDays = parseInt(m[1], 10);
    else if (t.includes('for a week') || t.includes('one week')) data.durationDays = 7;
    else if ((m = t.match(/for\s+(\d+)\s*(week|weeks)\b/))) data.durationDays = parseInt(m[1], 10) * 7;
  }

  // Lahmheit
  if (/(stark|stärker|heftig|kaum belastet|gar nicht belastet)/.test(t)) data.lame = 'severe';
  else if (/(leicht|ein wenig|wenig|etwas|mild)/.test(t)) data.lame = 'mild';
  else if (/(nicht|kein)\s*lahm/.test(t)) data.lame = 'none';

  if (/(severe|hardly putting weight|cannot put weight)/.test(t)) data.lame = 'severe';
  else if (/(mild|a bit|slight)/.test(t)) data.lame = 'mild';
  else if (/(no limp|not limping)/.test(t)) data.lame = 'none';

  // Fremdkörper/Schnitt
  if (/(kein|keine)\s*(fremd(körper)?|schnitt)/.test(t)) data.foreignBody = false;
  else if (/(fremd(körper)?|schnitt|splitter|dorn)/.test(t)) data.foreignBody = true;

  if (/(no\s+(foreign|cut)|nothing\s+between\s+the\s+pads)/.test(t)) data.foreignBody = false;
  else if (/(foreign|cut|thorn|splinter)/.test(t)) data.foreignBody = true;

  // Red flags (Stichworte)
  data.redflags = new Set();
  if (/(eiter|fieber|sehr warm|stark geschwollen)/.test(t)) data.redflags.add('infection');
  if (/(blut|blutung)/.test(t)) data.redflags.add('bleeding');

  if (/(pus|fever|very warm|strongly swollen)/.test(t)) data.redflags.add('infection');
  if (/(blood|bleeding)/.test(t)) data.redflags.add('bleeding');

  return data;
}

/* --------------- Fallsteuerung: entzündete Pfote --------------- */
function ensureCase(s, intent) {
  if (!s.case || s.case.intent !== intent) {
    s.state = 'paw_inflamed';
    s.case = {
      intent,
      asked: { q1: false, q2: false, q3: false },
      data: { durationDays: null, lame: null, foreignBody: null, redflags: new Set() }
    };
  }
}

function nextQuestionDe(s) {
  if (!s.case.asked.q1) { s.case.asked.q1 = true; return TXT.de.q1; }
  if (!s.case.asked.q2) { s.case.asked.q2 = true; return TXT.de.q2; }
  if (!s.case.asked.q3) { s.case.asked.q3 = true; return TXT.de.q3; }
  return null;
}
function nextQuestionEn(s) {
  if (!s.case.asked.q1) { s.case.asked.q1 = true; return TXT.en.q1; }
  if (!s.case.asked.q2) { s.case.asked.q2 = true; return TXT.en.q2; }
  if (!s.case.asked.q3) { s.case.asked.q3 = true; return TXT.en.q3; }
  return null;
}

function makeAssessment(lang, data) {
  const L = TXT[lang];
  const lines = [];
  const plan = [];

  // Einschätzung
  if (data.durationDays != null) {
    if (data.durationDays >= 7) {
      lines.push(lang === 'de'
        ? "Die Entzündung besteht schon seit mehreren Tagen – das spricht für einen Tierarzt‑Check."
        : "It’s been several days already — a vet check is advisable.");
    } else if (data.durationDays <= 2) {
      lines.push(lang === 'de'
        ? "Kurzfristig — oft reagieren Pfoten auf kleine Reizungen; wir beobachten eng."
        : "Short duration — often due to minor irritation; close observation.");
    }
  }

  if (data.lame === 'severe') {
    lines.push(lang === 'de'
      ? "Starke Lahmheit → bitte zeitnah Tierarzt."
      : "Severe limping → please see a vet soon.");
  } else if (data.lame === 'mild') {
    lines.push(lang === 'de'
      ? "Leichte Lahmheit — schone die Pfote und beobachte."
      : "Mild limping — rest the paw and monitor.");
  }

  if (data.foreignBody === true) {
    lines.push(lang === 'de'
      ? "Fremdkörper/Schnitt möglich — vorsichtig spülen, nicht tief manipulieren → Tierarzt."
      : "Possible foreign body/cut — rinse gently, don’t dig → vet visit.");
  } else if (data.foreignBody === false) {
    lines.push(lang === 'de'
      ? "Kein Fremdkörper sichtbar."
      : "No foreign body visible.");
  }

  if (data.redflags.has('infection')) {
    lines.push(lang === 'de'
      ? "Zeichen einer Infektion (Eiter/Fieber/starke Wärme/Schwellung) → bitte Tierarzt."
      : "Signs of infection (pus/fever/very warm/swollen) → see a vet.");
  }
  if (data.redflags.has('bleeding')) {
    lines.push(lang === 'de'
      ? "Blutung vorhanden → sanften Druck, sauberes Tuch, ggf. Notdienst anrufen."
      : "Bleeding present → gentle pressure, clean cloth, consider emergency call.");
  }

  // Plan
  plan.push(
    lang === 'de'
      ? "1) Pfote 2–3×/Tag lauwarm/Salzlösung spülen, trocken tupfen; Lecken verhindern."
      : "1) Rinse 2–3×/day (lukewarm/saline), pat dry; prevent licking."
  );
  plan.push(
    lang === 'de'
      ? "2) 10–15 Min. kühlen (Tuch), 2–3×/Tag."
      : "2) Cool 10–15 min (cloth), 2–3×/day."
  );
  plan.push(
    lang === 'de'
      ? "3) Schonung/kurze Spaziergänge auf sauberem Untergrund."
      : "3) Rest/short walks on clean surfaces."
  );
  if (data.durationDays >= 3 || data.lame === 'severe' || data.foreignBody === true || data.redflags.size) {
    plan.push(
      lang === 'de'
        ? "4) Bitte Tierarzttermin innerhalb von 24 h vereinbaren."
        : "4) Please arrange a vet visit within 24h."
    );
  } else {
    plan.push(
      lang === 'de'
        ? "4) Wenn es in 24–48 h nicht klar besser wird → Tierarzt."
        : "4) If no clear improvement in 24–48h → vet."
    );
  }

  return `${L.thanks}\n\n${lines.join('\n')}\n\n${L.planHeader}\n${plan.join('\n')}\n\n${L.finish}`;
}

/* --------------- Haupt-Reply --------------- */
function replyFor(text, s) {
  const lang = s.lang || detectLang(text);
  const L = TXT[lang];
  const low = norm(text);

  // Commands
  if (low === '/start')   { s.state='idle'; s.case=null; return L.hello(BOT_NAME); }
  if (low === '/help')    return L.help;
  if (low === '/sos')     return L.sos;
  if (low === '/langde')  { s.lang='de';  return 'Alles klar, ich antworte auf Deutsch.'; }
  if (low === '/langen')  { s.lang='en';  return 'Got it, I’ll reply in English.'; }
  if (low === '/langauto'){ s.lang=null;  return lang === 'de' ? 'Automatische Sprache ist aktiv.' : 'Auto language is active.'; }
  if (low === '/reset')   { s.state='idle'; s.case=null; s.lastUser=''; s.lastBot=''; return lang === 'de' ? 'Verlauf gelöscht.' : 'History cleared.'; }

  // Wenn wir mitten in einem Fall sind → im State bleiben
  if (s.state === 'paw_inflamed' && s.case) {
    // Antworten parsen und übernehmen
    const parsed = parseInfo(text, lang);
    Object.assign(s.case.data, parsed);
    // Wenn noch Fragen offen sind → nächste Frage
    const q = (lang === 'de') ? nextQuestionDe(s) : nextQuestionEn(s);
    if (q) return q;
    // Sonst: Einschätzung erzeugen und Fall zurück in idle (damit es nicht hängt)
    const out = makeAssessment(lang, s.case.data);
    s.state = 'idle'; s.case = null;
    return out;
  }

  // Neuer Intent?
  const intent = detectIntent(text);
  if (intent === 'paw_inflamed') {
    ensureCase(s, 'paw_inflamed');
    // Intro + erste Frage (einmalig)
    const q = (lang === 'de') ? nextQuestionDe(s) : nextQuestionEn(s);
    const intro = (lang === 'de') ? TXT.de.pawIntro : TXT.en.pawIntro;
    return `${intro}\n\n${q}`;
  }

  // Generische Antwort (ohne Wiederholungen, sehr kurz)
  return (lang === 'de')
    ? `${TXT.de.genericAck[0]}\n${TXT.de.askMore[0]}`
    : `${TXT.en.genericAck[0]}\n${TXT.en.askMore[0]}`;
}

/* Anti-Doppel-Ausgabe: nie denselben Bottext 2× hintereinander */
function postProcessNoRepeat(out, s) {
  const outNorm = norm(out);
  if (outNorm === s.lastBot) {
    const extra = (s.lang === 'en') ? "Anything else?" : "Noch etwas?";
    if (norm(out + "\n" + extra) !== s.lastBot) return out + "\n" + extra;
    return out + "\n…";
  }
  return out;
}

/* --------------- Telegram --------------- */
async function startTelegram() {
  if (!Telegraf) throw new Error('telegraf not installed');
  const bot = new Telegraf(TOKEN);

  bot.on('text', (ctx) => {
    const id = String(ctx.chat.id);
    const s = getSession(id);
    const msg = ctx.message.text || '';

    if (!s.lang) s.lang = detectLang(msg);

    const out = replyFor(msg, s);
    const final = postProcessNoRepeat(out, s);

    s.lastUser   = norm(msg);
    s.lastUserAt = now();
    s.lastBot    = norm(final);

    ctx.reply(final).catch(err => console.error('[TELEGRAM send error]', err));
  });

  await bot.launch();
  console.log(`[${BOT_NAME}] Telegram-Bot läuft.`);
  process.once('SIGINT', () => { bot.stop('SIGINT'); process.exit(0); });
  process.once('SIGTERM', () => { bot.stop('SIGTERM'); process.exit(0); });
}

/* --------------- CLI (Fallback) --------------- */
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
    if (!s.lang) s.lang = detectLang(msg);
    const out = replyFor(msg, s);
    const final = postProcessNoRepeat(out, s);

    s.lastUser   = norm(msg);
    s.lastUserAt = now();
    s.lastBot    = norm(final);

    console.log(final);
    rl.prompt();
  });

  rl.on('close', () => {
    console.log(s.lang === 'en' ? 'See you!' : 'Bis bald!');
    process.exit(0);
  });
}

/* --------------- Start --------------- */
(async () => {
  try {
    if (USE_TELEGRAM) await startTelegram();
    else              startCLI();
  } catch (e) {
    console.error('[FATAL]', e);
    process.exit(1);
  }
})();

