const { Telegraf } = require('telegraf');
const OpenAI = require('openai');

const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!BOT_TOKEN || !OPENAI_KEY) {
  console.error("Fehlende Tokens. Bitte BOT_TOKEN und OPENAI_API_KEY setzen.");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const openai = new OpenAI({ apiKey: OPENAI_KEY });

// Speicher pro User
const users = new Map();

// Hilfsfunktion: hole History oder lege neu an
function getHistory(userId) {
  if (!users.has(userId)) {
    users.set(userId, [
      { role: "system", content: "Du bist Seelenpfote, ein empathischer Tier-Begleiter. Sprich warm, beruhigend und einfühlsam. \
Hilf Tierbesitzer:innen dabei, ihre Sorgen einzuordnen. Erkläre einfach, ohne Fachjargon. \
Wenn nötig, gib sanfte Erste-Hilfe-Schritte und erinnere daran, bei ernsthaften Symptomen eine Tierärztin oder einen Tierarzt aufzusuchen." }
    ]);
  }
  return users.get(userId);
}

// Anfrage an OpenAI
async function askOpenAI(userId, newMessage) {
  const history = getHistory(userId);
  history.push({ role: "user", content: newMessage });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini", // Vision-fähig
    messages: history,
    temperature: 0.5
  });

  const answer = response.choices[0].message.content;
  history.push({ role: "assistant", content: answer });
  return answer;
}

// Textnachrichten
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;

  try {
    const answer = await askOpenAI(userId, text);
    await ctx.reply(answer);
  } catch (e) {
    console.error(e);
    await ctx.reply("Entschuldige, da ist gerade etwas schiefgelaufen. Versuche es bitte nochmal 🙏");
  }
});

// Fotos
bot.on("photo", async (ctx) => {
  const userId = ctx.from.id;
  try {
    const fileId = ctx.message.photo.pop().file_id;
    const file = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

    const history = getHistory(userId);
    history.push({
      role: "user",
      content: [
        { type: "text", text: "Bitte beurteile dieses Foto meines Tieres und gib mir eine empathische Rückmeldung." },
        { type: "image_url", image_url: { url: fileUrl } }
      ]
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: history,
      temperature: 0.5
    });

    const answer = response.choices[0].message.content;
    history.push({ role: "assistant", content: answer });

    await ctx.reply(answer);
  } catch (e) {
    console.error(e);
    await ctx.reply("Das Foto konnte ich gerade nicht auswerten 🙏");
  }
});

// Start
bot.start((ctx) => ctx.reply("🌷 Willkommen bei Seelenpfote 🐾\nIch bin für dich da – erzähl mir von deiner Fellnase oder schicke mir ein Foto 💛"));

// Starten
(async () => {
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await bot.launch();
    console.log("Seelenpfote läuft komplett über OpenAI 🐶🐾");
  } catch (e) {
    console.error("Startfehler:", e);
    process.exit(1);
  }
})();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));



