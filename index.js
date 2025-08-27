// Telegraf x OpenAI ohne dotenv (Railway-ready)

const { Telegraf } = require("telegraf");
const OpenAI = require("openai");

// === Env-Checks ===
// Railway -> Variables: BOT_TOKEN, OPENAI_API_KEY setzen
const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!BOT_TOKEN) {
  console.error("Fehler: BOT_TOKEN ist nicht gesetzt (Railway Variables)!");
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.error("Fehler: OPENAI_API_KEY ist nicht gesetzt (Railway Variables)!");
  process.exit(1);
}

// === Init ===
const bot = new Telegraf(BOT_TOKEN);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Falls vorher Webhook genutzt wurde: auf Polling umstellen
(async () => {
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
  } catch (_) {}
})();

// Nachrichtenverarbeitung
bot.on("text", async (ctx) => {
  const userMessage = (ctx.message?.text || "").trim();
  if (!userMessage) return;

  try {
    const completion = await openai.chat.completions.create({
      // gpt-3.5-turbo ist EOL/veraltet – nimm ein aktuelles, günstiges Modell:
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Du bist ein freundlicher und kompetenter Tierarzt-Chatbot. Antworte hilfreich und verständlich auf Fragen zu Haustieren.",
        },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Entschuldigung, ich konnte gerade keine Antwort generieren.";
    await ctx.reply(reply);
  } catch (error) {
    console.error("OpenAI API Fehler:", error?.response?.data || error);
    await ctx.reply(
      "Entschuldigung, es gab ein Problem beim Abrufen der Antwort von OpenAI."
    );
  }
});

// Bot starten
bot
  .launch()
  .then(() => console.log("Bot läuft mit OpenAI!"))
  .catch((err) => {
    console.error("Fehler beim Starten des Bots:", err);
    process.exit(1);
  });

// Sauberes Beenden
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

// Extra: Crash-Schutz
process.on("unhandledRejection", (e) =>
  console.error("unhandledRejection:", e)
);
process.on("uncaughtException", (e) =>
  console.error("uncaughtException:", e)
);



























