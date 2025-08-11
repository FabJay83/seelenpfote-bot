const TelegramBot = require('node-telegram-bot-api');
const cases = require('./cases');

// Bot-Token aus Umgebungsvariablen
const token = process.env.TELEGRAM_TOKEN;
if (!token) {
  console.error("❌ Fehler: TELEGRAM_TOKEN nicht gesetzt.");
  process.exit(1);
}

// Bot im Long Polling starten
const bot = new TelegramBot(token, { polling: true });

// Begrüßung nur einmal pro Chat
const greetedUsers = new Set();

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();

  // Begrüßung
  if (!greetedUsers.has(chatId)) {
    bot.sendMessage(chatId, `💛 Hallo ${msg.from.first_name || 'Freund'}, ich bin für dich da, um deinem Tier zu helfen.  
Erzähl mir bitte, was los ist – und ich gebe dir sofort Tipps.`);
    greetedUsers.add(chatId);
  }

  // Passenden Case suchen
  const found = cases.find(c => c.match(text));
  if (found) {
    bot.sendMessage(chatId, found.start(), { parse_mode: 'Markdown' });
  } else {
    bot.sendMessage(chatId, `Ich verstehe dich 💛, aber dazu habe ich gerade keinen festen Ratgeber.  
Kannst du mir genauer beschreiben, was passiert ist?`);
  }
});























