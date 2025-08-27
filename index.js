// Minimaler Telegram x OpenAI Bot ohne dotenv (für Railway)

const TelegramBot = require("node-telegram-bot-api");
const OpenAI = require("openai");

// 1) Railway: trage die Variablen im Dashboard ein (PROJECT → Variables)
//    TELEGRAM_TOKEN, OPENAI_API_KEY
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "TELEGRAM_TOKEN_HIER";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "OPENAI_API_KEY_HIER";

// Basic Guard, damit der Prozess nicht „still“ crasht
if (!TELEGRAM_TOKEN || TELEGRAM_TOKEN.includes("HIER")) {
  console.error("Fehlt: TELEGRAM_TOKEN (Railway Variables setzen)!");
  process.exit(1);
}
if (!OPENAI_API_KEY || OPENAI_API_KEY.includes("HIER")) {
  console.error("Fehlt: OPENAI_API_KEY (Railway Variables setzen)!");
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Falls der Bot vorher per Webhook lief, Webhook sicher entfernen:
bot.deleteWebHook({ drop_pending_updates: true }).catch(() => {});

// einfache /start Hilfe
bot.onText(/^\/start$/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Hi! Schick mir eine Nachricht und ich antworte mit KI. ✨"
  );
});

// Hauptroute: jede Textnachricht -> OpenAI
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();
  if (!text || text.startsWith("/")) return;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // leicht & günstig; bei Bedarf anderes Modell eintragen
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: text },
      ],
      temperature: 0.7,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Hm, ich habe gerade keine Antwort erhalten.";
    await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("OpenAI error:", err?.response?.data || err.message || err);
    await bot.sendMessage(
      chatId,
      "Es gab einen Fehler bei der KI-Antwort. Bitte prüfe die Logs in Railway."
    );
  }
});

// Crash-Schutz: logge Fehler statt einfach zu sterben
process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e));


























