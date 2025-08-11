// index.js – Telegram-Bot nur mit lokalen Cases (ohne OpenAI)

import TelegramBot from 'node-telegram-bot-api';
import cases from './cases.js';

// ========= KONFIG =========
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
if (!TELEGRAM_TOKEN) {
  console.error('❌ Fehler: TELEGRAM_TOKEN nicht gesetzt.');
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
console.log('🤖 Bot gestartet – nur Textmodus, empathisch');

// ========= Empathie-Wrapper =========
function careWrap(text) {
  return `💛 ${text}\n\n🐾 Du bist nicht allein – wir sind für dich da.`;
}

// ========= Sprach-Erkennung =========
function detectLang(message) {
  const lang = /[a-z]/i.test(message) && !/[äöüß]/i.test(message) ? 'en' : 'de';
  return lang;
}

// ========= Nachricht-Verarbeitung =========
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  if (!text) {
    bot.sendMessage(chatId, "❓ Bitte beschreibe dein Anliegen in Worten.");
    return;
  }

  const lang = detectLang(text);
  let matchedCase = null;

  for (const c of cases) {
    try {
      if (c.match(text, lang)) {
        matchedCase = c;
        break;
      }
    } catch (err) {
      console.error(`Fehler in Case ${c.id}:`, err);
    }
  }

  if (!matchedCase) {
    bot.sendMessage(chatId, careWrap(
      lang === 'en'
        ? "I'm not sure what you mean. Could you describe your pet's situation in a bit more detail? 🐶🐱"
        : "Ich bin mir nicht ganz sicher, was du meinst. Magst du die Situation deines Tieres etwas genauer beschreiben? 🐶🐱"
    ));
    return;
  }

  // Antwort senden
  const response = matchedCase.start(text);
  bot.sendMessage(chatId, careWrap(response), { parse_mode: 'Markdown' });
});

// ========= Fehler-Logging =========
bot.on('polling_error', (err) => console.error('Polling-Fehler:', err.message));





















