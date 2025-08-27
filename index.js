// Seelenpfote: Telegraf + OpenAI mit Webhook (Railway-ready, Fallback Polling)

const { Telegraf } = require("telegraf");
const OpenAI = require("openai");
const http = require("http");
const express = require("express");

const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PUBLIC_URL = process.env.PUBLIC_URL;         // z.B. https://deinprojekt.up.railway.app
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) { console.error("Fehler: BOT_TOKEN fehlt"); process.exit(1); }
if (!OPENAI_API_KEY) { console.error("Fehler: OPENAI_API_KEY fehlt"); process.exit(1); }

const bot = new Telegraf(BOT_TOKEN);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// === dein Chat-Handler (gekürzt; nimm hier deinen empathischen Code) ===
bot.on("text", async (ctx) => {
  const userMessage = (ctx.message?.text || "").trim();
  if (!userMessage) return;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Du bist Seelenpfote, empathisch & fürsorglich..." },
        { role: "user", content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 600
    });
    const reply = completion.choices?.[0]?.message?.content?.trim() || "Ich bin gerade sprachlos 🐾";
    await ctx.reply(reply, { parse_mode: "Markdown" });
  } catch (e) {
    console.error("OpenAI Fehler:", e?.response?.data || e);
    await ctx.reply("Ups, da ist etwas schiefgelaufen. Bitte nochmal versuchen.");
  }
});

// === Start-Logik: Webhook bevorzugt, sonst Polling ===
(async () => {
  try {
    if (PUBLIC_URL) {
      // Eindeutiger Pfad (verhindert Kollisionen)
      const path = `/telegram/${BOT_TOKEN.slice(-12)}`;

      // Zuerst sicherstellen: alter Webhook weg, dann neuen setzen
      await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {});
      await bot.telegram.setWebhook(`${PUBLIC_URL}${path}`);

      const app = express();
      app.use(express.json());
      app.use(bot.webhookCallback(path));

      // Healthcheck
      app.get("/", (_req, res) => res.status(200).send("OK"));

      const server = http.createServer(app);
      server.listen(PORT, () => {
        console.log(`✅ Webhook aktiv: ${PUBLIC_URL}${path} (Port ${PORT})`);
      });
    } else {
      // Fallback: Polling (nur 1 Instanz!)
      await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {});
      await bot.launch();
      console.log("✅ Polling aktiv (kein PUBLIC_URL gesetzt).");
    }
  } catch (err) {
    console.error("Startfehler:", err);
    process.exit(1);
  }
})();

// Clean shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e));





























