// Seelenpfote – Dogs & Cats only 🐶🐱 + Notdienst-Button am Wochenende/Feiertag (standortbasiert)
const { Telegraf } = require('telegraf');
const OpenAI = require('openai');

const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!BOT_TOKEN) { console.error('Fehlt: BOT_TOKEN'); process.exit(1); }
if (!OPENAI_API_KEY) { console.error('Fehlt: OPENAI_API_KEY'); process.exit(1); }

const bot = new Telegraf(BOT_TOKEN);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ========= Gesprächsspeicher =========
const sessions = new Map();
function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, [
      {
        role: 'system',
        content:
          "Du bist 'Seelenpfote', ein einfühlsamer Begleiter ausschließlich für Hunde 🐶 und Katzen 🐱. " +
          "Beantworte nur Fragen zu Hunden oder Katzen; bei anderen Tieren erkläre freundlich die Einschränkung. " +
          "Sprich warm, beruhigend und menschlich. Nutze passende Emojis (❤️ 🐾 😊 ⚠️ 📸) sparsam. " +
          "Gib bei Bedarf einfache, sichere Erste-Hilfe-Hinweise für Zuhause. " +
          "Bei ernsten Anzeichen: sanft auf tierärztliche Abklärung hinweisen – ohne Angst zu machen. " +
          "Passe die Sprache an die der Nutzerin/des Nutzers an. Vermeide Wiederholungen."
      }
    ]);
  }
  return sessions.get(userId);
}

async function askOpenAI(userId, userContent, temperature = 0.5) {
  const history = getSession(userId);
  history.push({ role: 'user', content: userContent });

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature,
    messages: history
  });

  const answer = resp.choices?.[0]?.message?.content?.trim()
    || 'Entschuldige, magst du das bitte kurz genauer beschreiben?';
  history.push({ role: 'assistant', content: answer });
  return answer;
}

// ========= Weekend/Feiertag-Check (bundesweite DE-Feiertage 2025) =========
function isGermanHoliday2025(d) {
  const y = d.getFullYear();
  if (y !== 2025) return false; // (Einfachheit: nur 2025 – bei Bedarf erweitern)
  const pad = (n) => String(n).padStart(2, '0');
  const key = `${y}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const holidays = new Set([
    '2025-01-01', // Neujahr
    '2025-04-18', // Karfreitag
    '2025-04-21', // Ostermontag
    '2025-05-01', // Tag der Arbeit
    '2025-05-29', // Christi Himmelfahrt
    '2025-06-09', // Pfingstmontag
    '2025-10-03', // Tag der Deutschen Einheit
    '2025-12-25', // 1. Weihnachtstag
    '2025-12-26'  // 2. Weihnachtstag
  ]);
  return holidays.has(key);
}
function isWeekend(date) {
  const day = date.getDay(); // 0=So, 6=Sa
  return day === 0 || day === 6;
}
function isWeekendOrHoliday(date = new Date()) {
  return isWeekend(date) || isGermanHoliday2025(date);
}

// ========= Notdienst-Flow =========
async function sendNotdienstPrompt(ctx) {
  return ctx.reply(
    '🚑 Wenn es dringend wirkt: Ich helfe dir, schnell jemanden zu finden. ' +
    'Magst du mir dafür kurz deinen Standort senden? Dann zeige ich dir den nächsten tierärztlichen Notdienst.',
    {
      reply_markup: {
        keyboard: [[{ text: '📍 Standort senden', request_location: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    }
  );
}

function mapsButtonsFor(lat, lon) {
  const zoom = 14;
  const enc = encodeURIComponent;
  const base = (q) => `https://www.google.com/maps/search/${enc(q)}/@${lat},${lon},${zoom}z`;
  return [
    [{ text: '🚑 Tierärztlicher Notdienst', url: base('Tierärztlicher Notdienst') }],
    [{ text: '⏰ Tierarzt 24h',            url: base('Tierarzt 24h') }],
    [{ text: '🏥 Tierklinik',              url: base('Tierklinik') }]
  ];
}

async function replyWithEmergencyCheck(ctx, answer) {
  const triggers = ["⚠️","tierarzt","notfall","sofort","dringend","klinik","24h","akut","blutet","atemnot","starke schmerzen"];
  const isEmergency = triggers.some(t => answer.toLowerCase().includes(t));
  if (isEmergency) {
    await ctx.reply(answer, {
      reply_markup: {
        inline_keyboard: [[{ text: "🚑 Tierärztin/Tierarzt in deiner Nähe", url: "https://www.google.com/maps/search/Tierarzt+in+meiner+Nähe/" }]]
      }
    });
  } else {
    await ctx.reply(answer);
  }
}

// ========= Fehler-Logging =========
bot.catch((err, ctx) => {
  console.error('Bot-Fehler bei Update', ctx.update?.update_id, err);
});

// ========= Start =========
bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id;
    const intro =
      "Der Nutzer hat den Chat gestartet. Begrüße warm und lade ein, " +
      "etwas über seinen Hund 🐶 oder seine Katze 🐱 zu erzählen oder ein Foto zu senden.";
    const answer = await askOpenAI(userId, intro, 0.4);
    await ctx.reply(answer);

    // Am Wochenende / Feiertag direkt Notdienst-Flow anbieten
    if (isWeekendOrHoliday(new Date())) {
      await sendNotdienstPrompt(ctx);
    }
  } catch (e) {
    console.error(e);
    await ctx.reply('Willkommen bei Seelenpfote 🐾 – erzähl mir gern von deinem Hund oder deiner Katze.');
    if (isWeekendOrHoliday(new Date())) await sendNotdienstPrompt(ctx);
  }
});

// ========= Texte (mit manueller Notdienst-Auslösung) =========
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const text = (ctx.message.text || '').trim();

  // Nutzer kann den Notdienst jederzeit per Text triggern
  if (/notdienst|notfall|wochenende|feiertag|dringend/i.test(text)) {
    await sendNotdienstPrompt(ctx);
    return;
  }

  try {
    const answer = await askOpenAI(userId, text);
    await replyWithEmergencyCheck(ctx, answer);
  } catch (e) {
    console.error(e);
    await ctx.reply('Entschuldige, da ist etwas schiefgelaufen. Versuch es bitte nochmal 🙏');
  }
});

// ========= Standort-Empfang: zeige nächste Notdienste per Maps-Links =========
bot.on('location', async (ctx) => {
  try {
    const { latitude, longitude } = ctx.message.location;
    await ctx.reply(
      'Hier sind Optionen in deiner Nähe – wähle, was am besten passt:',
      {
        reply_markup: {
          inline_keyboard: mapsButtonsFor(latitude, longitude)
        }
      }
    );
  } catch (e) {
    console.error(e);
    await ctx.reply('Konnte deinen Standort leider nicht verarbeiten. Magst du ihn erneut senden?');
  }
});

// ========= Fotos (Vision) =========
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  try {
    const sizes = ctx.message.photo;
    const best = sizes[sizes.length - 1].file_id;
    const file = await ctx.telegram.getFile(best);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

    const history = getSession(userId);
    history.push({
      role: 'user',
      content: [
        { type: 'text', text:
          "Hier ist ein Foto meiner Fellnase (Hund/Katze). Beurteile empathisch, " +
          "was sichtbar sein könnte (z. B. Rötung, Schwellung, Wunde) und gib sanfte, sichere Hinweise. Nutze passende Emojis." },
        { type: 'image_url', image_url: { url: fileUrl } }
      ]
    });

    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: history
    });

    const answer = resp.choices?.[0]?.message?.content?.trim()
      || 'Ich konnte das Foto nicht gut beurteilen. Magst du kurz beschreiben, was dir Sorgen macht?';
    history.push({ role: 'assistant', content: answer });

    await replyWithEmergencyCheck(ctx, answer);
    // Tipp: Am Wochenende/Feiertag zusätzlich proaktiv Standort anbieten
    if (isWeekendOrHoliday(new Date())) {
      await sendNotdienstPrompt(ctx);
    }
  } catch (e) {
    console.error(e);
    await ctx.reply('Das Foto konnte ich nicht auswerten. Magst du es nochmal senden oder beschreiben, was los ist? 📸');
  }
});

// ========= Dokumente (Bild als Datei) =========
bot.on('document', async (ctx) => {
  const userId = ctx.from.id;
  try {
    const fileId = ctx.message.document.file_id;
    const file = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

    const history = getSession(userId);
    history.push({
      role: 'user',
      content: [
        { type: 'text', text:
          "Hier ist eine Datei (wahrscheinlich ein Bild). Bitte beurteile empathisch (Hund/Katze) und gib sanfte Hinweise." },
        { type: 'image_url', image_url: { url: fileUrl } }
      ]
    });

    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: history
    });

    const answer = resp.choices?.[0]?.message?.content?.trim()
      || 'Ich konnte die Datei nicht sinnvoll beurteilen. Magst du kurz beschreiben, was dir Sorgen macht?';
    history.push({ role: 'assistant', content: answer });

    await replyWithEmergencyCheck(ctx, answer);
    if (isWeekendOrHoliday(new Date())) {
      await sendNotdienstPrompt(ctx);
    }
  } catch (e) {
    console.error(e);
    await ctx.reply('Die Datei konnte ich nicht auswerten. Magst du es mit einem Foto versuchen oder kurz beschreiben, was los ist? 📎');
  }
});

// ========= Starten (Webhook aus → Polling) =========
(async () => {
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await bot.launch({ dropPendingUpdates: true });
    console.log('Seelenpfote läuft (Dogs & Cats + Notdienst Location) 🐶🐱🚑');
  } catch (e) {
    console.error('Startfehler:', e);
    process.exit(1);
  }
})();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));







