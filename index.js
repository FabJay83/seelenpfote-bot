// index.js
// Seelenpfote Bot – Node.js Edition (Telegram + CLI Fallback)
// Features: DE/EN Auto-Detection, /start, /help, simple SOS-Hilfe, sauberes Shutdown

require('dotenv').config();

const USE_TELEGRAM = !!process.env.TELEGRAM_BOT_TOKEN;
const BOT_NAME = process.env.BOT_NAME || "Seelenpfote";
const VERSION = "1.0.0";

const { francMin } = require('franc-min'); // Sprache erkennen
const iso6393to1 = (iso3) => ({ deu: 'de', eng: 'en' }[iso3] || 'en');

function detectLang(text) {
  // franc gibt ISO-639-3 zurück (z.B. 'deu', 'eng')
  try {
    const code3 = francMin(text || '');
    return iso6393to1(code3);
  } catch {
    return 'en';
  }
}

// --- Antworten in DE/EN ------------------------------------------------------
function t(lang, key) {
  const de = {
    hello: `Hallo! Ich bin ${BOT_NAME}. Sende mir eine Nachricht oder /help.`,
    help: `Befehle:
/start – Begrüßung
/help – Hilfe anzeigen
/sos – Erste Hilfe Tipps (Hund/Katze, allgemein)
/langde – erzwungen Deutsch
/langen – erzwungen Englisch`,
    sos: `Erste Hilfe (allgemein, kurz):
1) Ruhe bewahren, Tier sichern.
2) Sichtbare Blutung: sanften Druck mit sauberer Kompresse.
3) Atem-/Kreislauf prüfen; bei Ausfall Tierarzt-Notdienst anrufen.
4) Keine menschlichen Medikamente geben.
5) Auf dem Weg zum Tierarzt warm halten.`,
    switched: `Alles klar, ich antworte ab jetzt auf Deutsch.`,
    bye: `Bis bald!`
  };

  const en = {
    hello: `Hi! I’m ${BOT_NAME}. Send me a message or /help.`,
    help: `Commands:
/start – greeting
/help – show help
/sos – first-aid tips (pet, general)
/langde – force German
/langen – force English`,
    sos: `First aid (quick):
1) Stay calm, secure the pet.
2) Visible bleeding: gentle pressure with a clean gauze.
3) Check breathing/circulation; call emergency vet if needed.
4) Do not give human meds.
5) Keep warm on the way to the vet.`,
    switched: `Got it, I’ll reply in English from now on.`,
    bye: `See you!`
  };

  const dict = lang === 'de' ? de : en;
  return dict[key];
}

// --- Kernlogik: eine Nachricht -> Antwort -----------------------------------
function buildReply(msg, forcedLang) {
  const lang = forcedLang || detectLang(msg);
  const text = msg.trim();

  // einfache Intents
  const lower = text.toLowerCase();
  if (lower === '/start') return t(lang, 'hello');
  if (lower === '/help') return t(lang, 'help');
  if (lower === '/sos') return t(lang, 'sos');
  if (lower === '/langde') { session.lang = 'de'; return t('de', 'switched'); }
  if (lower === '/langen') { session.lang = 'en'; return t('en', 'switched'); }

  // Standard: freundliche Antwort + Echo
  if (lang === 'de') {
    return `Verstanden. (${BOT_NAME} v${VERSION})\nDu hast gesagt: “${text}”`;
  } else {
    return `Got it. (${BOT_NAME} v${VERSION})\nYou said: “${text}”`;
  }
}

// --- Session (nur Sprachpräferenz) ------------------------------------------
const session = { lang: null };

// --- Telegram-Modus ----------------------------------------------------------
async function startTelegram() {
  const { Telegraf } = require('telegraf');
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

  bot.start((ctx) => ctx.reply(t(session.lang || detectLang('hi'), 'hello')));
  bot.help((ctx) => ctx.reply(t(session.lang || detectLang('help'), 'help')));

  bot.on('text', (ctx) => {
    const message = ctx.message.text || '';
    const reply = buildReply(message, session.lang);
    ctx.reply(reply);
  });

  bot.launch().then(() => {
    console.log(`[${BOT_NAME}] Telegram-Bot läuft. Drücke CTRL+C zum Beenden.`);
  });

  // Graceful shutdown
  process.once('SIGINT', () => { bot.stop('SIGINT'); process.exit(0); });
  process.once('SIGTERM', () => { bot.stop('SIGTERM'); process.exit(0); });
}

// --- CLI-Fallback ------------------------------------------------------------
function startCLI() {
  const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${BOT_NAME}> `
  });

  console.log(`${BOT_NAME} (CLI) gestartet. Tippe /help für Hilfe, CTRL+C zum Beenden.`);
  rl.prompt();

  rl.on('line', (line) => {
    const text = line.trim();
    if (text === '/quit' || text === '/exit') {
      console.log(t(session.lang || 'de', 'bye'));
      rl.close();
      return;
    }
    const reply = buildReply(text, session.lang);
    console.log(reply);
    rl.prompt();
  });

  rl.on('close', () => process.exit(0));
}

// --- Bootstrap ---------------------------------------------------------------
(async () => {
  console.log(`${BOT_NAME} v${VERSION} – Node.js`);
  if (USE_TELEGRAM) {
    await startTelegram();
  } else {
    console.log("Kein TELEGRAM_BOT_TOKEN gefunden – starte CLI-Fallback.");
    startCLI();
  }
})();















