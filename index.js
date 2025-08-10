// index.js — Seelenpfote (Telegram) • Fotoanalyse zuerst, dann empathische Antwort
// Läuft mit Railway-Variablen: TELEGRAM_BOT_TOKEN, OPENAI_API_KEY

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');

// --- ENV (mit Trim gegen unsichtbare Leerzeichen) ---
const TELEGRAM_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const OPENAI_KEY     = (process.env.OPENAI_API_KEY || '').trim();

if (!TELEGRAM_TOKEN || !OPENAI_KEY) {
  console.error('❌ Fehlt: TELEGRAM_BOT_TOKEN oder OPENAI_API_KEY (Railway → Variables setzen)');
  process.exit(1);
}

// --- Clients ---
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
// Webhook wegräumen, damit kein 409/Conflict stört (z. B. nach früherem Hosting)
bot.deleteWebHook({ drop_pending_updates: true }).catch(() => {});

const openai = new OpenAI({ apiKey: OPENAI_KEY });

// --- Sofortiger Token-Check: bricht sauber ab, wenn Token ungültig ist ---
bot.getMe()
  .then(me => console.log('🤖 Eingeloggt als @' + me.username))
  .catch(err => {
    const msg = (err && err.response && err.response.body) ? JSON.stringify(err.response.body) : (err?.message || String(err));
    console.error('❌ Telegram-Token ungültig oder nicht akzeptiert:', msg);
    process.exit(1);
  });

// ---------- Helpers ----------
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
    'Beschreibe knapp, was auf dem Foto zu sehen ist. Wenn möglich: Verletzungen/Schwellungen, Blutungen, Sekret, Haltung, Umgebung. ' +
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

  return (res.output_text || 'Keine Analyse möglich.').trim();
}

// ---------- Bot-Flows ----------

// /start
bot.onText(/^\/start\b/i, async (msg) => {
  const chatId = msg.chat.id;
  const hello =
    'Hey 👋 ich bin dein Seelenpfote‑Bot.\n' +
    'Schick mir ein Foto (z. B. Wunde, Haut, Pfote, Auge, Kot …).\n' +
    'Ich mache zuerst eine kurze Fotoanalyse 🔎 und sende dir danach eine ruhige, empathische Anleitung 🐾💛';
  await bot.sendMessage(chatId, hello);
});

// Eingehende Nachrichten: Wenn Foto → Foto-Flow
bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const hasPhoto = Array.isArray(msg.photo) && msg.photo.length > 0;
    if (!hasPhoto) return; // Text wird im separaten Text-Handler betreut

    await bot.sendChatAction(chatId, 'typing');

    // größte Variante nehmen
    const best = msg.photo[msg.photo.length - 1];
    const fileUrl = await getTelegramFileUrl(best.file_id);

    // 1) Fotoanalyse
    const analysis = await analyzeImageUrl(fileUrl, 'Kontext: Tierfoto von Besitzer:in gesendet.');
    await bot.sendMessage(chatId, `🔎 *Fotoanalyse*\n${analysis}`, { parse_mode: 'Markdown' });

    // 2) Empathische Antwort im schönen Stil
    const reply = careReply({
      intro: 'Ich weiß, das kann belastend sein – ich bin bei dir 🐾❤️\nDamit ich dir gezielt helfen kann, schreib mir bitte kurz:',
      bullets: [
        '🐶 Wo ist die Stelle genau? (Pfote, Bein, Auge, Bauch …)',
        '📏 Ungefähr wie groß? Wirkt sie rot, geschwollen oder feucht?',
        '🧭 Seit wann? Wird es besser oder schlimmer?',
        '⚠️ Leckt/kratzt dein Tier daran? Gibt es Geruch oder Sekret?',
      ],
      outro: 'Schick mir 1–2 Punkte – ich leite dich Schritt für Schritt an. Du machst das super 💪\nIch bleibe hier, bis wir es geschafft haben.',
    });

    await bot.sendMessage(chatId, reply);
  } catch (err) {
    console.error('❌ Foto-Flow Fehler:', err?.message || err);
  }
});

// Reine Textnachrichten (ohne Foto)
bot.on('text', async (msg) => {
  if (/^\/start\b/i.test(msg.text)) return; // /start schon oben behandelt
  if (msg.photo && msg.photo.length) return; // Falls Telegram es doch doppelt triggert

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














