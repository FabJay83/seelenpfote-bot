require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');

// ==== Keys laden ====
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!TELEGRAM_TOKEN || !OPENAI_KEY) {
    console.error("❌ Bitte TELEGRAM_BOT_TOKEN und OPENAI_API_KEY in .env eintragen!");
    process.exit(1);
}

// ==== Bot & OpenAI starten ====
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const openai = new OpenAI({ apiKey: OPENAI_KEY });

// ==== Cases laden ====
let cases = {};
try {
    cases = require('./cases');
} catch {
    console.warn("⚠️ Keine cases.js gefunden – Notfall-Logik deaktiviert.");
}

// ==== Empathie-Layer ====
function careWrap(text) {
    return `🐾❤️ ${text}\n\nDu machst das super 💪 – ich bleibe hier bei dir, bis wir es geschafft haben.`;
}

// ==== Textnachrichten ====
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    // Nur Text, kein Foto
    if (msg.text && !msg.photo) {
        const userMessage = msg.text.toLowerCase();

        // Falls ein Case erkannt wird
        for (let key in cases) {
            if (userMessage.includes(key)) {
                bot.sendMessage(chatId, careWrap(cases[key]));
                return;
            }
        }

        // Standard-Antwort
        bot.sendMessage(chatId, careWrap("Kannst du mir bitte ein Foto oder eine genauere Beschreibung schicken? 📸"));
    }
});

// ==== Foto-Analyse ====
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const photoArray = msg.photo;
    const fileId = photoArray[photoArray.length - 1].file_id;

    try {
        // Telegram-Datei-URL holen
        const fileLink = await bot.getFileLink(fileId);

        console.log(`📂 Foto-URL: ${fileLink}`);

        // 1️⃣ Fotoanalyse mit GPT-4o-mini Vision (korrekte API-Nutzung)
        const analysis = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "Du bist ein Tierarztassistent. Beschreibe ein Foto sachlich und knapp."
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Beschreibe, was du auf diesem Tierfoto siehst." },
                        { type: "image_url", image_url: { url: fileLink } }
                    ]
                }
            ],
            max_tokens: 150
        });

        const analysisText = analysis.choices[0]?.message?.content || "Keine Analyse verfügbar.";

        // Analyse senden
        await bot.sendMessage(chatId, `📸 *Fotoanalyse*:\n${analysisText}`, { parse_mode: "Markdown" });

        // 2️⃣ Empathische Folge-Nachricht
        const empathyMsg = `Oh nein… das sieht wirklich traurig aus 😔\n` +
            `Danke für das Foto, ich bin gerade bei dir 🐾❤️\n\n` +
            `Damit ich dir am besten helfen kann:\n` +
            `🐦 Wo genau ist die Stelle? (Pfote, Bein, Auge, Bauch …)\n` +
            `📏 Wie groß ungefähr? Ist sie rot, geschwollen oder feucht?\n\n` +
            `Erzähl mir kurz 1–2 Punkte, dann leite ich dich Schritt für Schritt an.`;

        await bot.sendMessage(chatId, empathyMsg);

    } catch (error) {
        console.error("❌ Fehler bei der Fotoanalyse:", error);
        bot.sendMessage(chatId, careWrap("Da ist etwas schiefgelaufen bei der Fotoanalyse 😔 Bitte versuche es nochmal."));
    }
});

console.log("✅ Telegram-Bot läuft…");









