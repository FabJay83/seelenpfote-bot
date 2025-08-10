// index.js

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// ==== Keys laden ====
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!TELEGRAM_TOKEN || !OPENAI_KEY) {
    console.error("❌ Bitte trage TELEGRAM_BOT_TOKEN und OPENAI_API_KEY in der .env-Datei ein!");
    process.exit(1);
}

// ==== Bot & OpenAI starten ====
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const openai = new OpenAI({ apiKey: OPENAI_KEY });

// ==== Cases laden (Notfall-Logik) ====
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

    // Wenn Text-Nachricht
    if (msg.text) {
        const userMessage = msg.text.toLowerCase();

        // Falls ein Case erkannt wird
        for (let key in cases) {
            if (userMessage.includes(key)) {
                bot.sendMessage(chatId, careWrap(cases[key]));
                return;
            }
        }

        // Standard-Antwort
        bot.sendMessage(chatId, careWrap("Kannst du mir bitte ein Foto oder genauere Beschreibung schicken? 📸"));
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

        // 1️⃣ Fotoanalyse mit GPT-4o-mini Vision
        const analysis = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "Du bist ein Tierarztassistent, der Fotos analysiert und kurz, klar beschreibt." },
                { role: "user", content: [
                    { type: "text", text: "Beschreibe, was du auf diesem Tierfoto siehst, sachlich und knapp." },
                    { type: "image_url", image_url: fileLink }
                ]}
            ],
            max_tokens: 150
        });

        const analysisText = analysis.choices[0].message.content;

        // Analyse senden
        await bot.sendMessage(chatId, `📸 **Fotoanalyse**:\n${analysisText}`, { parse_mode: "Markdown" });

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








