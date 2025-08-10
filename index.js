// index.js — Seelenpfote (Telegram)
// Ton: beruhigend & unterstützend – erst Fotoanalyse, dann einfühlsame Anleitung
// Railway Vars: TELEGRAM_BOT_TOKEN, OPENAI_API_KEY

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');

// ---- ENV (mit trim gegen unsichtbare Leerzeichen) ----
const TELEGRAM_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const OPENAI_KEY     = (process.env.OPENAI_API_KEY || '').trim();

if (!TELEGRAM_TOKEN || !OPENAI_KEY) {
  console.error('❌ Fehlt: TELEGRAM_BOT_TOKEN oder OPENAI_API_KEY');
  process.exit(1);
}

// ---- Clients ----
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
// alten Webhook wegräumen (verhindert 409/Conflict)
bot.deleteWebHook({ drop_pending_updates: true }).catch(() => {});

const openai = new OpenAI({ apiKey: OPENAI_KEY });

// sofortiger Token-Check (klare Fehlermeldung statt stiller 404-Schleife)
bot.getMe()
  .then(me => console.log('🤖 Eingeloggt als @' + me.username))
  .catch(err => {
    const msg = err?.response?.body ? JSON.stringify(err.response.body) : (err?.message || String(err));
    console.error('❌ Telegram-Token ungültig:', msg);
    process.exit(1);
  });

// ---- Texte (Variante 2: beruhigend & unterstützend) ----
const START_TEXT =
  'Ich bin für dich da, wenn du dir Sorgen um dein Tier machst 🐕🐈\n' +
  'Schick mir einfach ein Foto der Stelle – ich mache zuerst eine kurze Fotoanalyse 🔎\n' +
  'und gebe dir danach eine ruhige, einfühlsame Einschätzung. 💛';

function careReply({ intro, bullets = [], outro }) {
  let msg = '';
  if (intro) msg += `${intro}\n\n`;
  if (bullets.length) msg += bullets.map(b => `• ${b}`).join('\n') + '\n\n';
  if (outro) msg += outro;
  return msg;
}

// ---- Helper: Telegram-Datei-URL ----
async function getTelegramFileUrl(fileId) {
  const f = await bot.getFile(fileId);
  return `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${f.file_path}`;
}

// ---- Helper: OpenAI Vision Analyse ----
async function analyzeImageUrl(imageUrl, extraPrompt = '') {
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
            { type: 'input_image', image_url: imageUrl },
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

// ---- /start (ohne „Ich bin der Bot…“) ----
bot.onText(/^\/start\b/i, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, START_TEXT).catch(err =>
    console.error('❌ Send /start:', err?.message || err)
  );
});

// ---- Foto-Flow: erst Analyse, dann einfühlsame Antwort ----
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const hasPhoto = Array.isArray(msg.photo) && msg.photo.length > 0;
  if (!hasPhoto) return;

  try {
    await bot.sendChatAction(chatId, 'typing');

    const best = msg.photo[msg.photo.length - 1];
    const fileUrl = await getTelegramFileUrl(best.file_id);

    // 1) Analyse (ohne Markdown, um Sonderzeichen-Probleme zu vermeiden)
    const analysis = await analyzeImageUrl(fileUrl, 'Kontext: Tierfoto von Besitzer:in gesendet.');
    await bot.sendMessage(chatId, `🔎 Fotoanalyse\n${analysis}`)
      .catch(err => console.error('❌ Send analysis:', err?.response?.body || err?.message || err));

    // 2) Einfühlsame Nachfrage / Struktur
    const reply = careReply({
      intro:
        'Danke dir fürs Foto. Ich weiß, solche Momente sind nicht leicht – wir gehen das gemeinsam ruhig an 💛\n' +
        'Damit ich dir gezielt helfen kann, schreib mir bitte kurz:',
      bullets: [
        '🐾 Wo genau ist die Stelle? (Pfote, Bein, Auge, Bauch …)',
        '📏 Ungefähr wie groß? Wirkt sie rot, geschwollen oder feucht?',
        '⏱️ Seit wann? Wird es besser oder schlimmer?',
        '⚠️ Leckt/kratzt dein Tier daran? Gibt es Geruch oder Sekret?',
      ],
      outro:
        'Schick mir 1–2 Punkte – ich leite dich Schritt für Schritt an. Du machst das gut, ich bleibe hier bei dir. 🐾',
    });

    await bot.sendMessage(chatId, reply)
      .catch(err => console.error('❌ Send reply:', err?.response?.body || err?.message || err));
  } catch (err) {
    console.error('❌ Foto-Flow Fehler:', err?.message || err);
    await bot.sendMessage(chatId, '⚠️ Da ist gerade etwas schiefgelaufen bei der Fotoanalyse. Bitte versuch es gleich nochmal.')
      .catch(e => console.error('❌ Send fallback:', e?.message || e));
  }
});

// ---- Text-Flow (wenn kein Foto) ----
bot.on('text', async (msg) => {
  if (/^\/start\b/i.test(msg.text)) return;
  if (msg.photo && msg.photo.length) return;

  const chatId = msg.chat.id;
  const askForPhoto = careReply({
    intro:
      'Danke für deine Nachricht 🙏\n' +
      'Wenn möglich, schick mir bitte ein *Foto* der Stelle – das hilft mir, dir schnell und einfühlsam zu antworten.',
    bullets: [
      '🐾 Körperstelle (Pfote, Bein, Auge …)',
      '📏 Größe ungefähr',
      '⏱️ Seit wann?',
      '⚠️ Auffälligkeiten (rot, geschwollen, feucht, Geruch …)',
    ],
    outro:
      'Mit einem Foto kann ich zuerst eine kurze Analyse machen und dir danach konkrete, ruhige Schritte geben. 💛',
  });

  await bot.sendMessage(chatId, askForPhoto, { parse_mode: 'Markdown' })
    .catch(err => console.error('❌ Send askForPhoto:', err?.response?.body || err?.message || err));
});

console.log('✅ Bot läuft…');
















