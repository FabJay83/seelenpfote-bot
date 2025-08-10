// index.js — Seelenpfote (Telegram) • robuste Fehlerausgabe
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');

const TELEGRAM_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const OPENAI_KEY     = (process.env.OPENAI_API_KEY || '').trim();

if (!TELEGRAM_TOKEN || !OPENAI_KEY) {
  console.error('❌ Fehlt: TELEGRAM_BOT_TOKEN oder OPENAI_API_KEY');
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
bot.deleteWebHook({ drop_pending_updates: true }).catch(()=>{});

const openai = new OpenAI({ apiKey: OPENAI_KEY });

// Token Selbsttest
bot.getMe()
  .then(me => console.log('🤖 Eingeloggt als @' + me.username))
  .catch(err => {
    console.error('❌ Telegram-Token ungültig:', err?.response?.body || err?.message || err);
    process.exit(1);
  });

// Helpers
function careReply({ intro, bullets = [], outro }) {
  let msg = '';
  if (intro) msg += `${intro}\n\n`;
  if (bullets.length) msg += bullets.map(b => `• ${b}`).join('\n') + '\n\n';
  if (outro) msg += outro;
  return msg;
}

async function getTelegramFileUrl(fileId) {
  const f = await bot.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${f.file_path}`;
  return url;
}

async function analyzeImageUrl(imageUrl, extraPrompt = '') {
  const systemNote =
    'Du bist eine tiermedizinische Assistenz. Liefere eine kurze, sachliche Bildbeschreibung mit möglichen Auffälligkeiten. ' +
    'Keine Diagnose/Medikamente. Klare, neutrale Sprache.';

  const userPrompt =
    (extraPrompt?.trim() ? extraPrompt.trim() + '\n\n' : '') +
    'Beschreibe knapp, was auf dem Foto zu sehen ist (Verletzungen/Schwellungen, Blutungen, Sekret, Haltung, Umgebung). ' +
    'Maximal 5 kurze Sätze.';

  const res = await openai.responses.create({
    model: 'gpt-4o-mini',
    input: [
      { role: 'system', content: [{ type: 'input_text', text: systemNote }] },
      {
        role: 'user',
        content: [
          { type: 'input_text', text: userPrompt },
          { type: 'input_image', image_url: imageUrl },
        ],
      },
    ],
  });

  return (res.output_text || '').trim();
}

// /start
bot.onText(/^\/start\b/i, async (msg) => {
  const chatId = msg.chat.id;
  const hello =
    'Hey 👋 ich bin dein Seelenpfote‑Bot.\n' +
    'Schick mir ein Foto (z. B. Wunde, Haut, Pfote, Auge, Kot …).\n' +
    'Ich mache zuerst eine kurze Fotoanalyse 🔎 und sende dir danach eine ruhige, empathische Anleitung 🐾💛';
  await bot.sendMessage(chatId, hello);
});

// Foto‑Flow
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const hasPhoto = Array.isArray(msg.photo) && msg.photo.length > 0;
  if (!hasPhoto) return;

  try {
    await bot.sendChatAction(chatId, 'typing');

    const best = msg.photo[msg.photo.length - 1];
    const fileUrl = await getTelegramFileUrl(best.file_id);
    console.log('📸 Telegram file URL:', fileUrl);

    // 1) Analyse
    let analysisText = '';
    try {
      analysisText = await analyzeImageUrl(fileUrl, 'Kontext: Tierfoto von Besitzer:in gesendet.');
      if (!analysisText) throw new Error('Leere Analyseantwort von OpenAI.');
      await bot.sendMessage(chatId, `🔎 *Fotoanalyse*\n${analysisText}`, { parse_mode: 'Markdown' });
    } catch (aiErr) {
      console.error('❌ OpenAI-Analysefehler:', aiErr?.response?.data || aiErr?.message || aiErr);
      await bot.sendMessage(
        chatId,
        '⚠️ Ich konnte das Foto gerade nicht auswerten (Serverantwort fehlte oder war ungültig). ' +
        'Bitte schick das Bild noch einmal oder ein zweites Foto aus etwas anderem Winkel.'
      );
      return; // empathische Antwort nur senden, wenn Analyse geklappt hat
    }

    // 2) Empathie
    const friendly = careReply({
      intro: 'Ich weiß, das kann belastend sein – ich bin bei dir 🐾❤️\nDamit ich dir gezielt helfen kann, schreib mir bitte kurz:',
      bullets: [
        '🐶 Wo ist die Stelle genau? (Pfote, Bein, Auge, Bauch …)',
        '📏 Ungefähr wie groß? Wirkt sie rot, geschwollen oder feucht?',
        '🧭 Seit wann? Wird es besser oder schlimmer?',
        '⚠️ Leckt/kratzt dein Tier daran? Gibt es Geruch oder Sekret?',
      ],
      outro: 'Schick mir 1–2 Punkte – ich leite dich Schritt für Schritt an. Du machst das super 💪\nIch bleibe hier, bis wir es geschafft haben.',
    });
    await bot.sendMessage(chatId, friendly);
  } catch (err) {
    console.error('❌ Foto-Flow Fehler (außen):', err?.message || err);
    await bot.sendMessage(chatId, '⚠️ Uff, da ist gerade etwas schiefgelaufen. Versuch es bitte kurz nochmal – ich bleibe hier.');
  }
});

// Text‑Fallback
bot.on('text', async (msg) => {
  if (/^\/start\b/i.test(msg.text)) return;
  if (msg.photo && msg.photo.length) return;

  const chatId = msg.chat.id;
  const askForPhoto = careReply({
    intro: 'Danke für deine Nachricht 🙏\nWenn möglich, schick mir bitte ein *Foto* oder beschreibe die Stelle kurz.',
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

console.log('✅ Bot läuft…');















