require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const photoId = msg.photo[msg.photo.length - 1].file_id;

  try {
    const file = await bot.getFile(photoId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

    // Fotoanalyse
    const analysis = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Beschreibe knapp, was auf dem Foto zu sehen ist. Keine Diagnose." },
        { role: "user", content: [
            { type: "text", text: "Analysiere dieses Foto:" },
            { type: "image_url", image_url: fileUrl }
        ]}
      ]
    });

    const analysisText = analysis.choices[0].message.content;

    // 1. Analyse schicken
    await bot.sendMessage(chatId, `📷 Fotoanalyse:\n${analysisText}`);

    // 2. Empathische Antwort
    await bot.sendMessage(chatId,
      `Oh nein… das klingt belastend 😔\n\n` +
      `🐾 Wo genau ist die Stelle? (Pfote, Bein, Auge, Bauch …)\n` +
      `📏 Wie groß? Rot, geschwollen, feucht?\n\n` +
      `Du machst das super 💪 – ich bleibe bei dir.`
    );

  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "❌ Fehler bei der Fotoanalyse.");
  }
});

bot.on('message', (msg) => {
  if (!msg.photo) {
    bot.sendMessage(msg.chat.id, "Schick mir ein Foto 📸 oder beschreibe den Fall.");
  }
});

console.log("🤖 Bot läuft…");











