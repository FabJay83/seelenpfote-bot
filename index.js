// Telegram-Bot laden
const TelegramBot = require('node-telegram-bot-api');
const cases = require('./cases');

// Bot-Token aus Umgebungsvariablen
const token = process.env.TELEGRAM_TOKEN;
if (!token) {
  console.error("❌ Fehler: TELEGRAM_TOKEN nicht gesetzt.");
  process.exit(1);
}

// Bot starten
const bot = new TelegramBot(token, { polling: true });
const greetedUsers = new Set();

console.log("🤖 Bot gestartet – nur Textmodus, empathisch");

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const name = msg.from?.first_name || "Freund";

  // Persönliche Begrüßung (nur beim ersten Mal im Chat)
  if (!greetedUsers.has(chatId)) {
    bot.sendMessage(
      chatId,
      `💛 Hallo ${name}, ich bin hier, um dir und deinem Tier zu helfen.  
Schreib mir bitte, was passiert ist – dann schauen wir gemeinsam nach der besten Unterstützung für euch.`
    );
    greetedUsers.add(chatId);
    return;
  }

  // passenden Fall suchen
  const found = cases.find(c => c.match(text, 'de') || c.match(text, 'en'));
  
  if (found) {
    bot.sendMessage(chatId, found.start(), { parse_mode: 'Markdown' });
  } else {
    bot.sendMessage(
      chatId,
      `Ich höre dir zu 💛 – magst du mir bitte etwas genauer erzählen, was passiert ist?  
So kann ich dir die besten Erste-Hilfe-Schritte geben.`
    );
  }
});
























