require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const cases = require('./cases.js');

const TELEGRAM_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();

if (!TELEGRAM_TOKEN) {
  console.error('❌ Fehlt: TELEGRAM_BOT_TOKEN (Railway → Variables setzen)');
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

bot.getMe()
  .then(me => console.log('🤖 Eingeloggt als @' + me.username))
  .catch(err => {
    console.error('❌ Telegram-Token ungültig:', err?.message || String(err));
    process.exit(1);
  });

// Hilfsfunktion: Passenden Fall finden
function findCase(text, lang = 'de') {
  return cases.find(c => typeof c.match === 'function' && c.match(text, lang));
}

// /start-Handler
bot.onText(/^\/start\b/i, async (msg) => {
  const chatId = msg.chat.id;
  const hello =
    'Willkommen bei Seelenpfote! 🐾\n' +
    'Beschreibe kurz das Problem deines Tieres (z.B. "Durchfall", "humpelt", "Wunde", "hechelt stark" ...).\n' +
    'Ich gebe dir sofort empathische Erste-Hilfe-Schritte.';
  await bot.sendMessage(chatId, hello);
});

// Text-Handler
bot.on('text', async (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  if (/^\/start\b/i.test(text)) return;

  // Sprache erkennen (hier: nur Deutsch/Englisch, Standard: Deutsch)
  const lang = /[a-zA-Z]/.test(text) && !/[äöüß]/i.test(text) ? 'en' : 'de';

  const found = findCase(text, lang);

  if (found) {
    await bot.sendMessage(chatId, found.start(), { parse_mode: 'Markdown' });
  } else {
    await bot.sendMessage(chatId,
      'Ich konnte das Problem nicht eindeutig zuordnen. Bitte beschreibe kurz:\n' +
      '• Was ist passiert? (z.B. "humpelt", "Durchfall", "Wunde", ...)\n' +
      '• Seit wann?\n' +
      '• Welche Auffälligkeiten siehst du?'
    );
  }
});

console.log('✅ Seelenpfote-Bot läuft…');

























