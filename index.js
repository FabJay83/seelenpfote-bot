// index.js – Seelenpfote Bot (Nur Textmodus, empathisch, ohne OpenAI)
// Importiere benötigte Module
import TelegramBot from 'node-telegram-bot-api';
import cases from './cases.js';

// Prüfe Umgebungsvariablen
if (!process.env.TELEGRAM_TOKEN) {
  console.error('❌ Fehler: TELEGRAM_TOKEN nicht gesetzt.');
  process.exit(1);
}

// Bot starten (Polling-Modus)
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
console.log('🤖 Bot gestartet – nur Textmodus, empathisch');

// Einfache "careWrap"-Funktion für einfühlsame Antworten
function careWrap(text) {
  const emojis = ['💙', '🐾', '🌿', '💖', '🕊️'];
  const ending = emojis[Math.floor(Math.random() * emojis.length)];
  return `Ich bin für dich da. ${text} ${ending}`;
}

// Nachricht verarbeiten
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();

  if (!text) {
    bot.sendMessage(chatId, careWrap('Ich habe dich leider nicht verstanden. Kannst du es bitte nochmal in eigenen Worten beschreiben?'));
    return;
  }

  // Sprache grob erkennen
  const lang = /[a-z]/i.test(text) ? 'en' : 'de';

  // Passenden Case suchen
  const found = cases.find(c => {
    try {
      return c.match && c.match(text, lang);
    } catch {
      return false;
    }
  });

  if (found) {
    bot.sendMessage(chatId, careWrap(found.start()));
  } else {
    bot.sendMessage(chatId, careWrap('Das klingt wichtig. Erzähl mir bitte ein bisschen genauer, was passiert ist, damit ich dir gezielt helfen kann.'));
  }
});






















