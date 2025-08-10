// index.js — Seelenpfote Bot mit Fotoanalyse & Empathie für Railway
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!TELEGRAM_TOKEN || !OPENAI_KEY) {
  console.error('❌ Fehlender TELEGRAM_BOT_TOKEN oder OPENAI_API_KEY');
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// ✅ Webhook löschen, um „409 Conflict“-Fehler zu vermeiden
bot.deleteWebHook({ drop_pending_updates: true }).catch(() => {});

const openai = new OpenAI({ apiKey: OPENAI_KEY });

// -------- Hilfsfunktionen --------
function careReply({ intro, bullets = [], outro }) {
  let msg = '';
  if (intro) msg += `${intro}\n\n`;
  if (bullets.length) msg += bullets.map(b => `• ${b}`).join('\n') + '\n\n';
  if (outro) msg += outro;
  return msg;
}

async function getTelegramFileUrl(fileId) {
  const f = await bot.getFile(fileId);
  return `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${f.file_path}`;
}

async function analyzeImageUrl(imageUrl, extraPrompt = '') {
  const systemNote =
    'Du bist eine tiermedizinische Assistenz. Liefere eine kurze, sachliche Bildbeschreibung mit möglichen Auffälligkeiten. ' +
    'Keine Diagnose, keine Medikamente, kein Tierarzt-Ersatz. Klare, neutrale Sprache.';

  const userPrompt =
    (extraPrompt?.trim() ? extraPrompt.trim() + '\n\n' : '') +
    'Bitte beschreibe knapp, was du auf dem Foto erkennst. ' +
    'Falls möglich, erwähne sichtbare Verletzungen/Schwellungen, Blutungen, Sekret, Haltung, Umgebung. ' +
    'Maximal 5 Sätze.';

  const res = await openai.responses.create({
    model: 'gpt-4o-mini',
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: systemNote }],
      },
      {
        role: 'user',
        content: [
          { type: 'input_text', text: userPrompt },
          { type: 'input_image', image_url: imageUrl },
        ],
      },
    ],
  });

  return res.output_text?.trim() || 'Keine Analyse möglich.';
}

// -------- Bot-Logik --------

// /start
bot.onText(/^\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const hello =
    'Hey 👋 ich bin dein Seelenpfote-Bot.\n' +
    'Schick mir ein Foto (Wunde, Haut, Pfote, Auge, Kot etc.).\n' +
    'Ich mache zuerst eine kurze Fotoanalyse 🔎 und danach bekommst du eine ruhige, empathische Anleitung 🐾💛';
  await bot.sendMessage(chatId, hello);
});

// Foto-Handler
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const hasPhoto = Array.isArray(msg.photo) && msg.photo.length > 0;
  if (!hasPhoto) return;

  try {
    await bot.sendChatAction(chatId, 'typing');

    const best = msg.photo[msg.photo.length - 1];
    const fileUrl = await getTelegramFileUrl(best.file_id);

    // 1) Fotoanalyse
    const analysis = await analyzeImageUrl(fileUrl, 'Kontext: Tierfoto vom Besitzer gesendet.');
    await bot.sendMessage(chatId, `🔎 *Fotoanalyse*\n${analysis}`, { parse_mode: 'Markdown' });

    // 2) Empathische Antwort
    const friendly = careReply({
      intro: 'Das klingt belastend – ich bin bei dir 🐾❤️\nSchreib mir bitte kurz:',
      bullets: [
        '🐶 Wo ist die Stelle genau? (Pfote, Bein, Auge, Bauch …)',
        '📏 Ungefähr wie groß? Rot, geschwollen, feucht?',
        '🧭 Seit wann? Wird es besser oder schlimmer?',
        '⚠️ Leckt/kratzt dein Tier daran? Gibt es Geruch oder Sekret?'
      ],
      outro: 'Schreib mir 1–2 Punkte – ich leite dich Schritt für Schritt an. Du machst das gut 💪\nIch bleibe hier, bis wir es geschafft haben.',
    });

    await bot.sendMessage(chatId, friendly);
  } catch (err) {
    console.error('Fotoanalyse-Fehler:', err);
    await bot.sendMessage(chatId, '⚠️ Fehler bei der Fotoanalyse. Bitte versuche es erneut.');
  }
});

// Text-Handler (ohne Foto)
bot.on('text', async (msg) => {
  const chatId = msg.chat.id;
  if (/^\/start/.test(msg.text)) return;

  const askForPhoto = careReply({
    intro: 'Danke für deine Nachricht 🙏\nWenn du kannst, schick mir bitte ein *Foto* oder beschreibe die Stelle kurz.',
    bullets: [
      '🐾 Körperstelle (Pfote, Bein, Auge …)',
      '📏 Größe ungefähr',
      '⏱️ Seit wann?',
      '⚠️ Auffälligkeiten (rot, geschwollen, feucht, Geruch …)',
    ],
    outro: 'Mit einem Foto kann ich zuerst eine kurze Analyse machen und dir danach konkrete Schritte geben 💛',
  });

  await bot.sendMessage(chatId, askForPhoto, { parse_mode: 'Markdown' });
});

console.log('✅ Bot läuft… Drücke Strg+C zum Stoppen');












