// index.js — Seelenpfote Bot v1.3.0 (Telegram + CLI)
// DE als Standard, Auto-DE/EN, Anti-Repetition, sauberes Session-Handling.

require('dotenv').config();

const BOT_NAME = process.env.BOT_NAME || 'Seelenpfote';
const VERSION = '1.3.0';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

let Telegraf;
try { ({ Telegraf } = require('telegraf')); } catch { /* optional für CLI */ }

const USE_TELEGRAM = !!TOKEN;

// ---------- Sprach-Erkennung (ohne externe Lib) ----------
function detectLang(raw) {
  const text = (raw || '').toLowerCase();
  if (!text.trim()) return 'de';                   // Standard: Deutsch
  if (/[äöüß]/.test(text)) return 'de';           // starke DE-Signale
  const deHits = [
    /\b(und|oder|nicht|auch|ein(e|en|er)?|der|die|das|mit|ohne|bitte|danke|hilfe|warum|wieso|wie|was|wann|wo|welch\w*|mein|dein|sein|ihr|zum|zur|im|am|vom|beim)\b/,
    /(ung|keit|chen|lich|isch)\b/
  ].some((r) => r.test(text));
  if (deHits) return 'de';
  const enHits = [
    /\b(the|and|or|not|with|without|please|thanks|help|why|how|what|when|where|which|who|i|you|he|she|we|they|my|your|his|her|their)\b/,
    /(ing|ed|ly)\b/
  ].some((r) => r.test(text));
  if (enHits) return 'en';
  const asciiRatio = (text.replace(/[^\x00-\x7F]/g, '').length) / text.length;
  return asciiRatio > 0.9 ? 'en' : 'de';
}

// ---------- Utils ----------
const now = () => Date.now();
const norm = (s) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const rotate = (arr, idx) => arr[(idx.value++ % arr.length + arr.length) % arr.length];

// ---------- Sessions ----------
const sessions = new Map();
function getSession(id = 'cli') {
  if (!sessions.has(id)) {
    sessions.set(id, {
      lang: null,            // 'de'|'en'|null (auto)
      lastUser: '',          // normalisierter letzter Usertext
      lastUserAt: 0,
      lastBot: '',           // letzter gesendeter Bottext (normalisiert)
      lastIntent: '',        // Schlüssel der letzten Intent-Antwort
      lastIntentAt: 0,
      idx: { value: 0 }
    });
  }
  return sessions.get(id);
}

// ---------- Textblöcke ----------
const TXT = {
  de: {
    hello: (n) => `Hallo! Ich bin ${n}. Schreib mir eine Nachricht oder /help.`,
    help:
`Befehle:
/start – Begrüßung
/help – Hilfe anzeigen
/sos – Erste Hilfe kurz
/langde – Deutsch erzwingen
/langen – Englisch erzwingen
/langauto – automatische Spracherkennung
/reset – Verlauf löschen`,
    sos:
`Erste Hilfe (kurz):
1) Ruhe bewahren, Tier sichern.
2) Blutung: sanften Druck mit Kompresse.
3) Atmung/Kreislauf prüfen; ggf. Notfalltierarzt anrufen.
4) Keine menschlichen Medikamente geben.
5) Warm halten.`,
    acks: [
      (v)=>`Alles klar. (${BOT_NAME} v${v})`,
      (v)=>`Verstanden. (${BOT_NAME} v${v})`,
      (v)=>`Okay! (${BOT_NAME} v${v})`
    ],
    tail: [
      "Wie kann ich helfen?",
      "Womit kann ich dir helfen?",
      "Was brauchst du genau?"
    ],
    dupUser: [
      "Das habe ich gerade beantwortet.",
      "Gleiche Eingabe erkannt.",
      "Wir hatten das eben schon."
    ],
    cooldown: [
      "Schon erledigt 👍",
      "Alles klar, weiter geht’s.",
      "Hab dich gehört."
    ],
    switchedDe: "Alles klar, ich antworte auf Deutsch.",
    switchedEn: "Alles klar, ich antworte auf Englisch.",
    switchedAuto: "Automatische Spracherkennung ist wieder aktiv.",
    bye: "Bis bald!",
    reset: "Verlauf gelöscht."
  },
  en: {
    hello: (n) => `Hi! I'm ${n}. Send me a message or /help.`,
    help:
`Commands:
/start – greeting
/help – show help
/sos – quick first aid
/langde – force German
/langen – force English
/langauto – auto language
/reset – clear history`,
    sos:
`First aid (quick):
1) Stay calm, secure the pet.
2) Bleeding: gentle pressure with gauze.
3) Check breathing/circulation; call an emergency vet.
4) No human meds.
5) Keep warm.`,
    acks: [
      (v)=>`Got it. (${BOT_NAME} v${v})`,
      (v)=>`Understood. (${BOT_NAME} v${v})`,
      (v)=>`Okay! (${BOT_NAME} v${v})`
    ],
    tail: [
      "How can I help?",
      "What do you need exactly?",
      "What can I do for you?"
    ],
    dupUser: [
      "I just answered that.",
      "Same input detected.",
      "We just covered that."
    ],
    cooldown: [
      "Already done 👍",
      "All right, moving on.",
      "Heard you."
    ],
    switchedDe: "Got it, I’ll reply in German.",
    switchedEn: "Got it, I’ll reply in English.",
    switchedAuto: "Auto language is active again.",
    bye: "See you!",
    reset: "History cleared."
  }
};

// ---------- Kernlogik ----------
function chooseLang(session, text) {
  return session.lang || detectLang(text);
}

// Anti-Repetition Regeln:
// - Gleiches User-Input < 10s → dupUser-Variante
// - Gleicher Intent < 8s → kurze cooldown-Variante statt erneutem großen Text
// - Nie zweimal exakt denselben Bottext hintereinander
function replyFor(text, s) {
  const lang = chooseLang(s, text);
  const L = TXT[lang];
  const n = norm(text);

  // Befehle / Intents
  const nowMs = now();
  const replyIntent = (key, makeTextFn) => {
    const withinCooldown = (s.lastIntent === key) && (nowMs - s.lastIntentAt < 8000);
    s.lastIntent = key;
    s.lastIntentAt = nowMs;
    if (withinCooldown) return rotate(L.cooldown, s.idx);
    return makeTextFn();
  };

  if (n === '/start') return replyIntent('start', () => L.hello(BOT_NAME));
  if (n === '/help')  return replyIntent('help',  () => L.help);
  if (n === '/sos')   return replyIntent('sos',   () => L.sos);
  if (n === '/langde'){ s.lang='de';  return L.switchedDe; }
  if (n === '/langen'){ s.lang='en';  return L.switchedEn; }
  if (n === '/langauto'){ s.lang=null; return L.switchedAuto; }
  if (n === '/reset'){ s.lastUser=''; s.lastBot=''; s.lastIntent=''; return L.reset; }

  // Duplikateingabe des Users?
  if (n && n === s.lastUser && nowMs - s.lastUserAt < 10000) {
    s.lastIntent = 'dup';
    s.lastIntentAt = nowMs;
    return rotate(L.dupUser, s.idx);
  }

  // Kleine Notfall-Stichworte (Hund nicht gut) -> hilfreiche Kurzantwort
  if (/\bhund\b/i.test(text) && /\b(nicht gut|schlecht|hilfe|arzt|krank|verletz|blut|erbr(ech|icht)|durchfall)\b/i.test(text)) {
    s.lastIntent = 'pet_sos';
    s.lastIntentAt = nowMs;
    return L.sos;
  }

  // Standard-Antwort (wechselnde Varianten)
  const ack = rotate(L.acks, s.idx)(VERSION);
  const tail = rotate(L.tail, s.idx);
  s.lastIntent = 'ack';
  s.lastIntentAt = nowMs;
  return `${ack}\n${tail}`;
}

function postProcessNoRepeat(out, s) {
  const outNorm = norm(out);
  if (outNorm === s.lastBot) {
    // hänge eine kleine, sprachspezifische Variation an
    const extra = (s.lang === 'en') ? "Anything else?" : "Noch etwas?";
    if (norm(out + "\n" + extra) !== s.lastBot) return out + "\n" + extra;
    return out + `\n#${Math.floor(Math.random()*1000)}`; // absolute Notbremse
  }
  return out;
}

// ---------- Telegram ----------
async function startTelegram() {
  if (!Telegraf) throw new Error('telegraf not installed');
  const bot = new Telegraf(TOKEN);

  bot.on('text', (ctx) => {
    const id = String(ctx.chat.id);
    const s = getSession(id);
    const msg = ctx.message.text || '';

    const out = replyFor(msg, s);
    const final = postProcessNoRepeat(out, s);

    s.lastUser   = norm(msg);
    s.lastUserAt = now();
    s.lastBot    = norm(final);

    ctx.reply(final).catch(err => console.error('[TELEGRAM send error]', err));
  });

  await bot.launch();
  console.log(`[${BOT_NAME}] Telegram-Bot v${VERSION} läuft. CTRL+C zum Beenden.`);
  process.once('SIGINT', () => { bot.stop('SIGINT'); process.exit(0); });
  process.once('SIGTERM', () => { bot.stop('SIGTERM'); process.exit(0); });
}

// ---------- CLI (Fallback) ----------
function startCLI() {
  const id = 'cli';
  const s = getSession(id);
  const rl = require('readline').createInterface({
    input: process.stdin, output: process.stdout, prompt: `${BOT_NAME}> `
  });

  console.log(`${BOT_NAME} v${VERSION} – CLI-Modus. Tippe /help.`);
  rl.prompt();

  rl.on('line', (line) => {
    const msg = line || '';
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

// ---------- Start ----------
(async () => {
  try {
    if (USE_TELEGRAM) await startTelegram();
    else              startCLI();
  } catch (e) {
    console.error('[FATAL]', e);
    process.exit(1);
  }
})();


















