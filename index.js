require('dotenv').config();
const { Telegraf } = require('telegraf');
const { OpenAI } = require('openai');

// Prüfen, ob die notwendigen Umgebungsvariablen gesetzt sind
if (!process.env.BOT_TOKEN || !process.env.OPENAI_API_KEY) {
  console.error('Fehler: BOT_TOKEN oder OPENAI_API_KEY ist nicht gesetzt!');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Nachrichtenverarbeitung
bot.on('text', async (ctx) => {
  const userMessage = ctx.message.text;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // oder "gpt-4", falls du Zugriff hast
      messages: [
        { role: "system", content: "Du bist ein freundlicher und kompetenter Tierarzt-Chatbot. Antworte hilfreich und verständlich auf Fragen zu Haustieren." },
        { role: "user", content: userMessage }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const reply = completion.choices[0].message.content.trim();
    ctx.reply(reply);

  } catch (error) {
    console.error('OpenAI API Fehler:', error);
    ctx.reply('Entschuldigung, es gab ein Problem beim Abrufen der Antwort von OpenAI.');
  }
});

// Bot starten
bot.launch()
  .then(() => console.log('Bot läuft mit OpenAI!'))
  .catch(err => {
    console.error('Fehler beim Starten des Bots:', err);
    process.exit(1);
  });

// Sauberes Beenden
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

























