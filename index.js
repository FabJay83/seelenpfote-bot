// index.js — Seelenpfote Bot v1.4.0 (Telegram + CLI)
// Deutsch als Standard, Auto-DE/EN, Anti-Repetition, kurze Erste-Hilfe-Intents.
// Keine Versionsanzeige in Antworten.

require('dotenv').config();

const BOT_NAME = process.env.BOT_NAME || 'Seelenpfote';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

let Telegraf;
try { ({ Telegraf } = require('telegraf')); } catch { /* optional für CLI */ }

const USE_TELEGRAM = !!TOKEN;

/* ---------- Sprach-Erkennung (leichtgewichtig) ---------- */
function detectLang(raw) {
  const text = (raw || '').toLowerCase();
  if (!text.trim()) return 'de';                        // Standard: Deutsch
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

/* ---------- Utils ---------- */
const now = () => Date.now();
const norm = s => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const rotate = (arr, ref) => arr[(ref.value++ % arr.length + arr.length) % arr.length];

/* ---------- Sessions ---------- */
const sessions = new Map();
function getSession(id = 'cli') {
  if (!sessions.has(id)) {
    sessions.set(id, {
      lang: 'de',           // Deutsch als Startsprache
      lastUser: '',
      lastUserAt: 0,
      lastBot: '',
      lastIntent: '',
      lastIntentAt: 0,
      idx: { value: 0 }
    });
  }
  return sessions.get(id);
}

/* ---------- Texte ---------- */
const TXT = {
  de: {
    hello: (n) =>
`👋 Willkommen bei ${n}!
Schreib mir einfach, was los ist – z. B. „Mein Hund humpelt“ oder „Katze frisst nicht“. Ich gebe dir eine liebevolle Ersteinschätzung. (/help für Befehle)`,
    help:
`Befehle:
/start – Begrüßung
/help – Hilfe
/sos – Erste Hilfe kurz
/langde – Deutsch erzwingen
/langen – Englisch erzwingen
/langauto – automatische Sprache
/reset – Verlauf löschen`,
    sos:
`Erste Hilfe (kurz):
1) Ruhe bewahren, Tier sichern.
2) Blutung: sanften Druck mit Kompresse.
3) Atmung/Kreislauf prüfen; ggf. Notfalltierarzt anrufen.
4) Keine menschlichen Medikamente geben.
5) Warm halten.`,
    pawInflamed:
`Entzündete Pfote – Erste Einschätzung:
• Pfote mit lauwarmem Wasser oder isotoner Kochsalzlösung spülen.
• Sanft trocken tupfen, nicht reiben. Kein Alkohol/Peroxid.
• Lecken verhindern (z. B. Socken/Schuh oder Halskragen).
• 10–15 Min. kühlen (Tuch, kein Eis direkt).
• Beobachten: starke Schwellung, Eiter, starker Schmerz, Fieber, Lahmheit >24 h → bitte Tierarzt.

Fragen an dich:
1) Seit wann besteht das Problem?
2) Lahmt er stark / belastet er gar nicht?
3) Siehst du einen Schnitt/Fremdkörper zwischen den Ballen?`,
    acks: ["Alles klar.", "Verstanden.", "Okay."],
    tails: ["Wie genau kann ich helfen?", "Magst du kurz beschreiben, seit wann es so ist?", "Gib mir 1–2 Details, dann werde ich konkret."],
    dupUser: ["Das habe ich gerade beantwortet.", "Gleiche Eingabe erkannt.", "Wir hatten das eben schon."],
    cooldown: ["Schon erledigt 👍", "Alles klar.", "Weiter geht’s."],
    switchedDe: "Alles klar, ich antworte auf Deutsch.",
    switchedEn: "Alles klar, ich antworte auf Englisch.",
    switchedAuto: "Automatische Spracherkennung ist wieder aktiv.",
    bye: "Bis bald!",
    reset: "Verlauf gelöscht."
  },
  en: {
    hello: (n) =>
`👋 Welcome to ${n}!
Tell me what's happening – e.g., “My dog is limping”. I’ll give you a kind first assessment. (/help for commands)`,
    help:
`Commands:
/start – greeting
/help – help
/sos – quick first aid
/langde – force German
/langen – force English
/langauto – auto language
/reset – clear history`,
    sos:
`First aid (quick):
1) Stay calm, secure the pet.
2) Bleeding: gentle pressure with gauze.
3) Check breathing/circulation; call an emergency vet if needed.
4) No human meds.
5) Keep warm.`,
    pawInflamed:
`Inflamed paw – first steps:
• Rinse with lukewarm water or saline.
• Pat dry gently; no alcohol/peroxide.
• Prevent licking (bootie/e-collar).
• Cool 10–15 min (cloth, not ice directly).
• Vet if strong swelling, pus, severe pain, fever, or limping >24h.

Quick questions:
1) Since when?
2) Severe limping?
3) Cut/foreign body between pads?`,
    acks: ["Got it.", "Understood.", "Okay."],
    tails: ["How can I help exactly?", "Give me 1–2 details.", "Tell me since when it started."],
    dupUser: ["I just answered that.", "Same input detected.", "We just covered that."],
    cooldown: ["Already done 👍", "All right.", "Moving on."],
    switchedDe: "Got it, I’ll reply in German.",
    switchedEn: "Got it, I’ll reply in English.",
    switchedAuto: "Auto language is active again.",
    bye: "See you!",
    reset: "History cleared."
  }
};

/* ---------- Intent-Erkennung ---------- */
function inferIntent(text) {
  const t = text.toLowerCase();

  // entzündete / verletzte Pfote
  if (/(pfote|pfoten|ballen)/.test(t) && /(entzünd|rot|schwell|wund|verletz|schnitt|eiter)/.test(t)) {
    return 'paw_inflamed';
  }
  if (/(paw|pad)/.test(t) && /(inflam|swoll|red|wound|cut|pus|sore)/.test(t)) {
    return 'paw_inflamed';
  }

  return 'generic';
}

/* ---------- Antwortlogik mit Anti-Repeat ---------- */
function replyFor(text, s) {
  // Sprache: erzwungen oder automatisch
  if (!s.lang) s.lang = detectLang(text); // falls /langauto aktiv – initialisieren
  const L = TXT[s.lang || 'de'];
  const n = norm(text);
  const tNow = now();

  const respondIntent = (key, make) => {
    const cooldown = (s.lastIntent === key) && (tNow - s.lastIntentAt < 8000);
    s.lastIntent = key;
    s.lastIntentAt = tNow;
    return cooldown ? rotate(L.cooldown, s.idx) : make();
  };

  // Befehle
  if (n === '/start')   return respondIntent('start', () => L.hello(BOT_NAME));
  if (n === '/help')    return respondIntent('help',  () => L.help);
  if (n === '/sos')     return respondIntent('sos',   () => L.sos);
  if (n === '/langde')  { s.lang = 'de';  return L.switchedDe; }
  if (n === '/langen')  { s.lang = 'en';  return L.switchedEn; }
  if (n === '/langauto'){ s.lang = null;  return L.switchedAuto; }
  if (n === '/reset')   { s.lastUser=''; s.lastBot=''; s.lastIntent=''; return L.reset; }

  // Anti-Duplikat (gleicher Usertext <10s)
  if (n && n === s.lastUser && (tNow - s.lastUserAt < 10000)) {
    s.lastIntent = 'dup';
    s.lastIntentAt = tNow;
    return rotate(L.dupUser, s.idx);
  }

  // Intents
  const intent = inferIntent(text);
  if (intent === 'paw_inflamed') {
    return respondIntent('paw_inflamed', () => L.pawInflamed);
  }

  // Standard: kurze Bestätigung + wechselndes Nachfragen (ohne Version!)
  return `${rotate(L.acks, s.idx)}\n${rotate(L.tails, s.idx)}`;
}

function postProcessNoRepeat(out, s) {
  const outNorm = norm(out);
  if (outNorm === s.lastBot) {
    const extra = (s.lang === 'en') ? "Anything else?" : "Noch etwas?";
    if (norm(out + "\n" + extra) !== s.lastBot) return out + "\n" + extra;
    return out + "\n…"; // kleine Variation
  }
  return out;
}

/* ---------- Telegram ---------- */
async function startTelegram() {
  if (!Telegraf) throw new Error('telegraf not installed');
  const bot = new Telegraf(TOKEN);

  bot.on('text', (ctx) => {
    const id = String(ctx.chat.id);
    const s = getSession(id);
    const msg = ctx.message.text || '';

    // Bei Auto-Sprache ohne Vorgabe: an erkannte Sprache anpassen
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

/* ---------- CLI (Fallback) ---------- */
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
    console.log((s.lang === 'en') ? TXT.en.bye : TXT.de.bye);
    process.exit(0);
  });
}

/* ---------- Start ---------- */
(async () => {
  try {
    if (USE_TELEGRAM) await startTelegram();
    else              startCLI();
  } catch (e) {
    console.error('[FATAL]', e);
    process.exit(1);
  }
})();



















