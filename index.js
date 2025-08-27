// Seelenpfote – Dogs & Cats only 🐶🐱 + Notdienst-Flow (Location robust, Apple/Google Maps, Fallbacks)
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
const state = new Map(); // userId -> { awaitingLocation?: boolean, awaitingUntil?: number }

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
  if (y !== 2025) return false;
  const pad = (n) => String(n).padStart(2, '0');
  const key = `${y}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const holidays = new Set([
    '2025-01-01','2025-04-18','2025-04-21','2025-05-01','2025-05-29','2025-06-09','2025-10-03','2025-12-25','2025-12-26'
  ]);
  return holidays.has(key);
}
function isWeekend(date) { const d = date.getDay(); return d === 0 || d === 6; }
function isWeekendOrHoliday(date = new Date()) { return isWeekend(date) || isGermanHoliday2025(date); }

// ========= Notdienst-UI =========
function mapsInlineKeyboardFor(lat, lon) {
  const enc = encodeURIComponent;
  const g = (q) => `https://www.google.com/maps/search/${enc(q)}/@${lat},${lon},14z`;
  const a = (q) => `https://maps.apple.com/?q=${enc(q)}&ll=${lat},${lon}&z=14`;
  return {
    inline_keyboard: [
      [{ text: '🚑 Notdienst (Google Maps)', url: g('Tierärztlicher Notdienst') }],
      [{ text: '⏰ Tierarzt 24h (Google Maps)', url: g('Tierarzt 24h') }],
      [{ text: '🏥 Tierklinik (Google Maps)', url: g('Tierklinik') }],
      [{ text: '🚑 Notdienst (Apple Maps)', url: a('Tierärztlicher Notdienst') }]
    ]
  };
}
function mapsInlineKeyboardForQuery(place) {
  const enc = encodeURIComponent;
  const g = (q) => `https://www.google.com/maps/search/${enc(q + ' ' + place)}`;
  const a = (q) => `https://maps.apple.com/?q=${enc(q + ' ' + place)}`;
  return {
    inline_keyboard: [
      [{ text: '🚑 Notdienst (Google Maps)', url: g('Tierärztlicher Notdienst') }],
      [{ text: '⏰ Tierarzt 24h (Google Maps)', url: g('Tierarzt 24h') }],
      [{ text: '🏥 Tierklinik (Google Maps)', url: g('Tierklinik') }],
      [{ text: '🚑 Notdienst (Apple Maps)', url: a('Tierärztlicher Notdienst') }]
    ]
  };
}
async function sendNotdienstPrompt(ctx) {
  const uid = ctx.from.id;
  const until = Date.now() + 5 * 60 * 1000; // 5 Minuten
  state.set(uid, { awaitingLocation: true, awaitingUntil: until });
  return ctx.reply(
    '🚑 Ich helfe dir sofort jemanden zu finden.\n' +
    'Tippe unten auf „📍 Standort senden“. Wenn du das nicht möchtest, schreib mir einfach kurz deinen Ort/PLZ (z. B. „54290 Trier“).',
    {
      reply_markup: {
        keyboard: [[{ text: '📍 Standort senden', request_location: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    }
  );
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
    if (isWeekendOrHoliday(new Date())) await sendNotdienstPrompt(ctx);
  } catch (e) {
    console.error(e);
    await ctx.reply('Willkommen bei Seelenpfote 🐾 – erzähl mir gern von deinem Hund oder deiner Katze.');
    if (isWeekendOrHoliday(new Date())) await sendNotdienstPrompt(ctx);
  }
});

// ========= Texte (inkl. manuellem Notdienst-Trigger & Ortsname-Fallback) =========
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const text = (ctx.message.text || '').trim();

  // Manuell triggern
  if (/notdienst|notfall|wochenende|feiertag|dringend/i.test(text)) {
    await sendNotdienstPrompt(ctx);
    return;
  }

  // Wenn wir gerade auf Standort warten, akzeptieren wir auch eine Orts-/PLZ-Eingabe
  const st = state.get(userId);
  if (st?.awaitingLocation && Date.now() < (st.awaitingUntil || 0)) {
    // sehr simple Heuristik: Zahl oder Wort als Ort/PLZ
    if (/^\d{4,5}\b/.test(text) || /[a-zäöüß\-]{3,}/i.test(text)) {
      state.delete(userId);
      await ctx.reply('Danke! Ich schaue direkt nach passenden Notdiensten …');
      return ctx.reply('Hier sind Optionen – wähle, was am besten passt:', {
        reply_markup: mapsInlineKeyboardForQuery(text)
      });
    }
  }

  try {
    const answer = await askOpenAI(userId, text);
    await replyWithEmergencyCheck(ctx, answer);
  } catch (e) {
    console.error(e);
    await ctx.reply('Entschuldige, da ist etwas schiefgelaufen. Versuch es bitte nochmal 🙏');
  }
});

// ========= Standort-Empfang: statisch & Live-Standort =========
bot.on('location', async (ctx) => {
  try {
    const { latitude, longitude, live_period } = ctx.message.location || {};
    console.log('Location empfangen:', latitude, longitude, live_period ? '(live)' : '(statisch)');

    // Tastatur einklappen
    await ctx.reply('Danke! Ich suche sofort in deiner Nähe …', {
      reply_markup: { remove_keyboard: true }
    });

    // State zurücksetzen
    state.delete(ctx.from.id);

    // Buttons mit Apple/Google-Maps
    await ctx.reply('Hier sind Optionen – wähle, was am besten passt:', {
      reply_markup: mapsInlineKeyboardFor(latitude, longitude)
    });
  } catch (e) {
    console.error('Fehler im Location-Handler:', e);
    await ctx.reply('Konnte deinen Standort leider nicht verarbeiten. Magst du ihn erneut senden oder mir deinen Ort/PLZ schreiben?');
  }
});

// ========= Fotos =========
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
          "was sichtbar sein könnte (Rötung, Schwellung, Wunde). Gib sanfte, sichere Hinweise. Nutze passende Emojis." },
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
    // Optional bei Weekend/Holiday direkt Standort anbieten
    if (isWeekendOrHoliday(new Date())) await sendNotdienstPrompt(ctx);
  } catch (e) {
    console.error(e);
    await ctx.reply('Das Foto konnte ich nicht auswerten. Magst du es nochmal senden oder beschreiben, was los ist? 📸');
  }
});

// ========= Dokumente =========
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
          "Hier ist eine Datei (vermutlich ein Bild). Bitte beurteile empathisch (Hund/Katze) und gib sanfte Hinweise." },
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
    if (isWeekendOrHoliday(new Date())) await sendNotdienstPrompt(ctx);
  } catch (e) {
    console.error(e);
    await ctx.reply('Die Datei konnte ich nicht auswerten. Magst du es mit einem Foto versuchen oder beschreiben, was los ist? 📎');
  }
});

// ========= Starten (Webhook aus → Polling) =========
(async () => {
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await bot.launch({ dropPendingUpdates: true });
    console.log('Seelenpfote läuft (Dogs & Cats + robustes Notdienst-Location) 🐶🐱🚑');
  } catch (e) {
    console.error('Startfehler:', e);
    process.exit(1);
  }
})();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));








