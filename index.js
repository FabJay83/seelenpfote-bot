// index.js — Seelenpfote (Telegram) • stabile Fotoanalyse (Base64 + korrekter MIME) → empathische Antwort
// Railway Vars: TELEGRAM_BOT_TOKEN, OPENAI_API_KEY

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
bot.deleteWebHook({ drop_pending_updates: true }).catch(() => {});
const openai = new OpenAI({ apiKey: OPENAI_KEY });

bot.getMe()
  .then(me => console.log('🤖 Eingeloggt als @' + me.username))
  .catch(err => {
    const msg = err?.response?.body ? JSON.stringify(err.response.body) : (err?.message || String(err));
    console.error('❌ Telegram-Token ungültig:', msg);
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

// Dateiendung → Bild-MIME
function detectImageMimeFromUrl(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
    if (pathname.endsWith('.png')) return 'image/png';
    if (pathname.endsWith('.webp')) return 'image/webp';
    if (pathname.endsWith('.gif')) return 'image/gif';
    // HEIC ist meist problematisch bei Vision-Modellen – wir fallen auf JPEG zurück
    return 'image/jpeg';
  } catch {
    return 'image/jpeg';
  }
}

// Holt Bild, baut immer eine gültige Data-URL mit **korrektem** MIME
async function loadImageAsDataUrl(fileUrl) {
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Bild-Download fehlgeschlagen: HTTP ${res.status}`);
  const guessedMime = detectImageMimeFromUrl(fileUrl);
  const arrayBuf = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuf).toString('base64');
  return `data:${guessedMime};base64,${base64}`;
}

async function analyzeImageDataUrl(dataUrl, extraPrompt = '') {
  const systemNote =
    'Du bist eine tiermedizinische Assistenz. Kurze, sachliche Bildbeschreibung mit möglichen Auffälligkeiten. ' +
    'Keine Diagnose, keine Medikamente, kein Tierarzt-Ersatz. Klare, neutrale Sprache.';

  const userPrompt =
    (extraPrompt?.trim() ? extraPrompt.trim() + '\n\n' : '') +
    'Beschreibe knapp, was auf dem Foto zu sehen ist. Falls möglich: Verletzungen/Schwellungen, Blutungen, Sekret, Haltung, Umgebung. ' +
    'Maximal 5 kurze Sätze.';

  try {
    const res = await openai.responses.create({
      model: 'gpt-4o-mini',
      input: [
        { role: 'system', content: [{ type: 'input_text', text: systemNote }] },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: userPrompt },
            { type: 'input_image', image_url: dataUrl },
          ],
        },
      ],
    });
    return (res.output_text || 'Keine Analyse möglich.').trim();
  } catch (e) {
    const detail = e?.response?.data?.error?.message || e?.message || String(e);
    console.error('❌ OpenAI-Fehler:', detail);
    throw new Error('Analyse fehlgeschlagen: ' + detail);
  }
}

// ---------- Bot-Flows ----------

// Sanfter /start‑Text (ohne „Bot“-Vorstellung)
bot.onText(/^\/start\b/i, async (msg) => {
  const chatId = msg.chat.id;
  const hello =
    'Ich bin für dich da, wenn du dir Sorgen um dein Tier machst 🐕🐈\n' +
    'Schick mir ein Foto der Stelle – ich mache zuerst eine kurze Fotoanalyse 🔎\n' +
    'und gebe dir danach eine ruhige, einfühlsame Einschätzung. 💛';
  await bot.sendMessage(chatId, hello).catch(err => console.error('❌ Send /start:', err?.message || err));
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

    // Bild laden → Base64 mit sauberen MIME
    const dataUrl = await loadImageAsDataUrl(fileUrl);

    // 1) Analyse (ohne Markdown senden)
    const analysis = await analyzeImageDataUrl(dataUrl, 'Kontext: Tierfoto von Besitzer:in gesendet.');
    await bot.sendMessage(chatId, `🔎 Fotoanalyse\n${analysis}`)
      .catch(err => console.error('❌ Send analysis:', err?.response?.body || err?.message || err));

    // 2) Empathische Antwort
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

    await bot.sendMessage(chatId, reply).catch(err => console.error('❌ Send reply:', err?.response?.body || err?.message || err));
  } catch (err) {
    console.error('❌ Foto‑Flow Fehler:', err?.message || err);
    await bot.sendMessage(chatId, '⚠️ Da ist gerade etwas schiefgelaufen bei der Fotoanalyse. Bitte versuch es gleich nochmal.')
      .catch(e => console.error('❌ Send fallback:', e?.message || e));
  }
});

// Text‑Flow (ohne Foto)
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

  await bot.sendMessage(chatId, askForPhoto, { parse_mode: 'Markdown' })
    .catch(err => console.error('❌ Send askForPhoto:', err?.response?.body || err?.message || err));
});

console.log('✅ Bot läuft…');


















