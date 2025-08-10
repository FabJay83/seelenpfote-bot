// index.js – Telegram Bot mit Fotoanalyse + empathischer Antwort
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');
const path = require('path');

// Lade Tokens aus .env
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// Bot initialisieren
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// OpenAI Client initialisieren
const openai = new OpenAI({
  apiKey: OPENAI_KEY
});

// 📌 Hilfsfunktion für empathische Antwort
function empathicReply(userName) {
  return `Oh nein ${userName ? userName : ''}… das klingt wirklich belastend 😔\n\n` +
         `Danke, dass du mir das geschickt hast 🐾❤️\n\n` +
         `Damit ich dir am besten helfen kann:\n` +
         `🐶 / 🐱 Wo genau ist die Stelle? (Pfote, Bein, Auge, Bauch …)\n` +
         `📏 Wie groß ungefähr? Ist sie rot, geschwollen oder feucht?\n\n` +
         `Erzähl mir kurz 1–2 Punkte, dann leite ich dich Schritt für Schritt an.\n\n` +
         `Du machst das super 💪 – ich bleibe hier bei dir, bis wir es geschafft haben.`;
}

// 📸 Foto-Handler
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const photoId = msg.photo[msg.photo.length - 1].file_id;

  try {
    // Telegram-Fotolink holen
    const file = await bot.getFile(photoId);
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;

    // Zuerst: Fotoanalyse mit OpenAI Vision
    const analysis = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Du bist ein Tiergesundheits-Assistent. Beschreibe sachlich, was auf dem Foto zu sehen ist, ohne Diagnose zu stellen." },
        { role: "user", content: [
            { type: "text", text: "Bitte analysiere dieses Foto:" },
            { type: "image_url", image_url: fileUrl }
        ]}
      ],
      max_tokens: 200
    });

    const analysisText = analysis.choices[0].message.content;

    // 1️⃣ Analyse schicken
    await bot.sendMessage(chatId, `📷 **Fotoanalyse:**\n${analysisText}`, { parse_mode: 'Markdown' });

    // 2️⃣ Empathische Antwort schicken
    const firstName = msg.chat.first_name || '';
    await bot.sendMessage(chatId, empathicReply(firstName));

  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "❌ Fehler bei der Fotoanalyse. Bitte versuche es später noch einmal.");
  }
});

// 📝 Text-Handler
bot.on('message', async (msg) => {
  if (!msg.photo) {
    bot.sendMessage(msg.chat.id, "Schick mir gern ein Foto 📸 oder beschreibe den Fall.");
  }
});

console.log("🤖 Seelenpfote-Bot läuft und wartet auf Nachrichten...");










