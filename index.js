// index.js
// Seelenpfote Bot – Node.js (Telegram + CLI), DE/EN Auto, Anti-Repetition

require('dotenv').config();

let Telegraf;
try { ({ Telegraf } = require('telegraf')); } catch { /* CLI fallback */ }

const BOT_NAME = process.env.BOT_NAME || 'Seelenpfote';
const VERSION = '1.1.1';
const USE_TELEGRAM = !!process.env.TELEGRAM_BOT_TOKEN;

// -------- Sprach-Erkennung ohne externe Lib ---------------------------------
const detectLang = (raw) => {
  const text = (raw || '').toLowerCase();
  if (!text.trim()) return 'de';
  if (/[äöüß]/.test(text)) return 'de';
  const deHits = [
    /\b(und|oder|nicht|auch|ein(e|en|er)?|der|die|das|mit|ohne|bitte|danke|hilfe)\b/,
    /\b(warum|wieso|wie|was|wann|wo|welch\w*)\b/,
    /\b(ich|du|er|sie|wir|ihr|mein|dein|sein|ihr)\b/,
    /\b(zum|zur|im|am|vom|beim)\b/,
    /(ung|keit|chen|lich|isch)\b/
  ].some((re) => re.test(text));
  if (deHits) return 'de';
  const enHits = [
    /\b(the|and|or|not|also|with|without|please|thanks|help)\b/,
    /\b(why|how|what|when|where|which|who)\b/,
    /\b(i|you|he|she|we|they|my|your|his|her|their)\b/,
    /(ing|ed|ly)\b/
  ].some((re) => re.test(text));
  if (enHits) return 'en';
  const asciiRatio = (text.replace(/[^\x00-\x7F]/g, '').length) / text.length;
  return asciiRatio > 0.9 ? 'en' : 'de';
};

// -------- Hilfsfunktionen ---------------------------------------------------
const now = () => Date.now();
const norm = (s) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const rotatePick = (arr, idxRef) => arr[(idxRef.value++ % arr.length + arr.length) % arr.length];

// -------- Session Store -----------------------------------------------------
const sessions = new Map();
function getSession(id = 'cli') {
  if (!sessions.has(id)) {
    sessions.set(id, {
      lang: null,
      lastBot: '',
      lastUser: '',
      lastUserAt: 0,
      variantIndex: { value: 0 }
    });
  }
  return sessions.get(id);
}

// -------- Texte --------------------------------------------------------------
const TXT = {
  de: {
    hello: (name) => `Hallo! Ich bin ${name}. Sende mir eine Nachricht oder /help.`,
    help:
`Befehle:
/start – Begrüßung
/help – Hilfe anzeigen
/sos – Erste-Hilfe Tipps
/langde – Deutsch erzwingen
/langen – Englisch erzwingen
/reset – Verlauf löschen`,
    sos:
`Erste Hilfe:
1) Ruhe bewahren, Tier sichern.
2) Blutung: sanften Druck mit Kompresse.
3) Atmung/Kreislauf prüfen; ggf. Notfalltierarzt anrufen.
4) Keine menschlichen Medikamente geben.
5) Warm halten.`,
    dupUser: [
      "Das habe ich gerade beantwortet.",
      "Gleiche Eingabe erkannt.",
      "Das hatten wir gerade."
    ],
    ack: [
      (v) => `Alles klar. (${BOT_NAME} v${v})`,
      (v) => `Verstanden. (${BOT_NAME} v${v})`,
      (v) => `Okay! (${BOT_NAME} v${v})`
    ],
    switchedDe: "Alles klar, ab jetzt Deutsch.",
    switchedEn: "Alles klar, ab jetzt Englisch.",
    bye: "Bis bald!",
    reset: "Verlauf gelöscht."
  },
  en: {
    hello: (name) => `Hi! I'm ${name}. Send me a message or /help.`,
    help:
`Commands:
/start – greeting
/help – show help
/sos – first aid
/langde – force German
/langen – force English
/reset – clear history`,
    sos:
`First aid:
1) Stay calm, secure pet.
2) Bleeding: gentle pressure with gauze.
3) Check breathing/circulation; call emergency vet.
4) No human meds.
5) Keep warm.`,
    dupUser: [
      "I just answered that.",
      "Same input detected.",
      "We just covered that."
    ],
    ack: [
      (v) => `Got it. (${BOT_NAME} v${v})`,
      (v) => `Understood. (${BOT_NAME} v${v})`,
      (v) => `Okay! (${BOT_NAME} v${v})`
    ],
    switchedDe: "Got it, German from now on.",
    switchedEn: "Got it, English from now on.",
    bye: "See you!",
    reset: "History cleared."
  }
};

// -------- Kernlogik ---------------------------------------------------------
function replyFor(text, session) {
  const forced = session.lang;
  const lang = forced || detectLang(text);
  const L = TXT[lang];
  const low = norm(text);

  if (low === '/start') return L.hello(BOT_NAME);
  if (low === '/help') return L.help;
  if (low === '/sos') return L.sos;
  if (low === '/langde') { session.lang = 'de'; return TXT.de.switchedDe; }
  if (low === '/langen') { session.lang = 'en'; return TXT.en.switchedEn; }
  if (low === '/reset') { session.lastBot = ''; session.lastUser = ''; return L.reset; }

  if (low && low === session.lastUser && now() - session.lastUserAt < 10000) {
    return rotatePick(L.dupUser, session.variantIndex);
  }

  const ack = rotatePick(L.ack, session.variantIndex)(VERSION);
  const tail = (lang === 'de') ? "Wie kann ich helfen?" : "How can I help?";
  return `${ack}\n${tail}`;
}

function postProcessNoRepeat(out, session) {
  if (norm(out) === norm(session.lastBot)) {
    const addon = (session.lang === 'de') ? "Noch etwas?" : "Anything else?";
    return out + "\n" + addon;
  }
  return out;
}

// -------- Telegram -----------------------------------------------------------
async function startTelegram() {
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

  bot.on('text', (ctx) => {
    const id = String(ctx.chat.id);
    const s = getSession(id);
    const msg = ctx.message.text || '';

    const out = replyFor(msg, s);
    const final = postProcessNoRepeat(out, s);

    s.lastUser = norm(msg);
    s.lastUserAt = now();
    s.lastBot = final;

    ctx.reply(final);
  });

  await bot.launch();
  console.log(`[${BOT_NAME}] Telegram-Bot läuft.`);
  process.once('SIGINT', () => { bot.stop('SIGINT'); process.exit(0); });
  process.once('SIGTERM', () => { bot.stop('SIGTERM'); process.exit(0); });
}

// -------- CLI ---------------------------------------------------------------
function startCLI() {
  const id = 'cli';
  const s = getSession(id);
  const rl = require('readline').createInterface({
    input: process.stdin, output: process.stdout, prompt: `${BOT_NAME}> `
  });

  console.log(`${BOT_NAME} v${VERSION} – CLI-Modus.`);
  rl.prompt();

  rl.on('line', (line) => {
    const msg = line || '';
    const out = replyFor(msg, s);
    const final = postProcessNoRepeat(out, s);

    s.lastUser = norm(msg);
    s.lastUserAt = now();
    s.lastBot = final;

    console.log(final);
    rl.prompt();
  });

  rl.on('close', () => {
    console.log((s.lang === 'en') ? TXT.en.bye : TXT.de.bye);
    process.exit(0);
  });
}

// -------- Start -------------------------------------------------------------
(async () => {
  console.log(`${BOT_NAME} v${VERSION} gestartet`);
  if (USE_TELEGRAM) await startTelegram();
  else { console.log("Kein Telegram-Token, starte CLI."); startCLI(); }
})();
















