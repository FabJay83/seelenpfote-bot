// index.js – Seelenpfote Bot (Debug Build)
// CLI/Telegram, DE/EN Auto, Anti-Repetition, FORCE_CLI support, lautes Logging

require('dotenv').config();

const BOT_NAME = process.env.BOT_NAME || 'Seelenpfote';
const VERSION = '1.1.2';

// --- Telegram optional laden
let Telegraf;
try { ({ Telegraf } = require('telegraf')); } catch { /* ok for CLI */ }

// --- Runtime-Flags
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const FORCE_CLI = process.env.FORCE_CLI === '1';
const USE_TELEGRAM = !FORCE_CLI && !!TOKEN;

// --- lautes Boot-Logging
console.log(`[BOOT] ${BOT_NAME} v${VERSION}`);
console.log(`[BOOT] FORCE_CLI=${FORCE_CLI}`);
console.log(`[BOOT] USE_TELEGRAM=${USE_TELEGRAM}`);
console.log(`[BOOT] TOKEN_LEN=${TOKEN ? TOKEN.length : 0}`);
console.log(`[BOOT] stdin.isTTY=${!!process.stdin.isTTY}`);

// --- einfache DE/EN-Erkennung (ohne externes ESM)
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

// --- Utils & Session
const now = () => Date.now();
const norm = (s) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const rotatePick = (arr, idxRef) => arr[(idxRef.value++ % arr.length + arr.length) % arr.length];

const sessions = new Map();
function getSession(id = 'cli') {
  if (!sessions.has(id)) {
    sessions.set(id, { lang: null, lastBot: '', lastUser: '', lastUserAt: 0, variantIndex: { value: 0 } });
  }
  return sessions.get(id);
}

// --- Texte
const TXT = {
  de: {
    hello: (n) => `Hallo! Ich bin ${n}. Sende mir eine Nachricht oder /help.`,
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
    dupUser: ["Das habe ich gerade beantwortet.", "Gleiche Eingabe erkannt.", "Das hatten wir gerade."],
    ack: [(v)=>`Alles klar. (${BOT_NAME} v${v})`, (v)=>`Verstanden. (${BOT_NAME} v${v})`, (v)=>`Okay! (${BOT_NAME} v${v})`],
    switchedDe: "Alles klar, ab jetzt Deutsch.",
    switchedEn: "Alles klar, ab jetzt Englisch.",
    bye: "Bis bald!",
    reset: "Verlauf gelöscht."
  },
  en: {
    hello: (n) => `Hi! I'm ${n}. Send me a message or /help.`,
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
    dupUser: ["I just answered that.", "Same input detected.", "We just covered that."],
    ack: [(v)=>`Got it. (${BOT_NAME} v${v})`, (v)=>`Understood. (${BOT_NAME} v${v})`, (v)=>`Okay! (${BOT_NAME} v${v})`],
    switchedDe: "Got it, German from now on.",
    switchedEn: "Got it, English from now on.",
    bye: "See you!",
    reset: "History cleared."
  }
};

// --- Logik
function replyFor(text, session) {
  const forced = session.lang;
  const lang = forced || detectLang(text);
  const L = TXT[lang];
  const low = norm(text);

  if (low === '/start') return L.hello(BOT_NAME);
  if (low === '/help')  return L.help;
  if (low === '/sos')   return L.sos;
  if (low === '/langde'){ session.lang='de'; return TXT.de.switchedDe; }
  if (low === '/langen'){ session.lang='en'; return TXT.en.switchedEn; }
  if (low === '/reset'){ session.lastBot=''; session.lastUser=''; return L.reset; }

  if (low && low === session.lastUser && now() - session.lastUserAt < 10000) {
    return rotatePick(L.dupUser, session.variantIndex);
  }
  const ack = rotatePick(L.ack, session.variantIndex)(VERSION);
  const tail = (lang === 'de') ? "Wie kann ich helfen?" : "How can I help?";
  return `${ack}\n${tail}`;
}

function postProcessNoRepeat(out, session) {
  if (norm(out) === norm(session.lastBot)) {
    const addon = (session.lang === 'en') ? "Anything else?" : "Noch etwas?";
    return out + "\n" + addon;
  }
  return out;
}

// --- Telegram
async function startTelegram() {
  if (!Telegraf) throw new Error('telegraf not installed');
  const bot = new Telegraf(TOKEN);

  bot.on('text', (ctx) => {
    const id = String(ctx.chat.id);
    const s = getSession(id);
    const msg = ctx.message.text || '';

    const out = replyFor(msg, s);
    const final = postProcessNoRepeat(out, s);

    s.lastUser = norm(msg);
    s.lastUserAt = now();
    s.lastBot = final;

    ctx.reply(final).catch(err => console.error('[TELEGRAM send error]', err));
  });

  await bot.launch();
  console.log('[TELEGRAM] bot launched. Waiting for messages.');
  process.once('SIGINT', () => { bot.stop('SIGINT'); process.exit(0); });
  process.once('SIGTERM', () => { bot.stop('SIGTERM'); process.exit(0); });
}

// --- CLI
function startCLI() {
  const id = 'cli';
  const s = getSession(id);
  const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${BOT_NAME}> `
  });

  console.log('[CLI] started.');
  if (process.stdin.isTTY) rl.prompt();

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

  // Support: non‑TTY piping -> exit when stdin ends
  if (!process.stdin.isTTY) {
    process.stdin.on('end', () => {
      setTimeout(() => process.exit(0), 50);
    });
  }
}

// --- Start
(async () => {
  try {
    if (USE_TELEGRAM) {
      console.log('[START] Telegram mode…');
      await startTelegram();
    } else {
      console.log('[START] CLI mode…');
      startCLI();
    }
  } catch (err) {
    console.error('[FATAL STARTUP ERROR]', err && err.stack || err);
    console.log('[RECOVERY] Falling back to CLI.');
    try { startCLI(); } catch (e) { console.error('[CLI FAIL]', e); process.exit(1); }
  }
})();
