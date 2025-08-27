// Seelenpfote – Hunde & Katzen only 🐶🐱
// 100% OpenAI-gestützt (Text + Bilder, Vision), empathischer Stil mit passenden Emojis.
// CommonJS, Telegraf + OpenAI. Long Polling (Webhook wird deaktiviert).

const { Telegraf } = require('telegraf');
const OpenAI = require('openai');

const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!BOT_TOKEN) {
  console.error('Fehlt: BOT_TOKEN (Telegram BotFather Token)');
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.error('Fehlt: OPENAI_API_KEY (OpenAI API Key)');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ========= Gesprächsspeicher pro Nutzer =========
// Struktur: Map<userId, OpenAIMessage[]>
const sessions = new Map();

function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, [
      {
        role: 'system',
        content:
          "Du bist 'Seelenpfote', ein einfühlsamer Begleiter ausschließlich für Hunde 🐶 und Katzen 🐱. " +
          "Beantworte nur Fragen zu Hunden oder Katzen. Wenn es um andere Tiere geht, erkläre freundlich, " +
          "dass du dafür leider nicht zuständig bist und fokussiere auf Hund/Katze. " +
          "Sprich warm, beruhigend und menschlich. Benutze passende Emojis (❤️ Mitgefühl, 🐾 Tierbezug, 😊 Ermutigung, ⚠️ Warnhinweis, 📸 Foto), " +
          "ohne zu übertreiben. Halte Antworten klar und natürlich – vermeide unnötigen Fachjargon. " +
          "Gib bei Bedarf einfache, sichere Erste-Hilfe-Hinweise für Zuhause. Weisen ernsthafte Anzeichen darauf hin, " +
          "dass eine tierärztliche Abklärung sinnvoll ist, formuliere respektvoll und ohne Angst zu machen. " +
          "Passe die Sprache an die der Nutzerin/des Nutzers an. Wenn Name oder Tiername genannt werden, " +
          "kannst du sie gelegentlich persönlich ansprechen – dezent, nicht in jedem Satz. Vermeide Wiederholungen."
      }
    ]);
  }
  return sessions.get(userId);
}

async function askOpenAI(userId, userContent, temperature = 0.5) {
  const history = getSession(userId);
  history.push({ role: 'user', content: userContent });

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',  // Vision-fähig, schnell & kosteneffizient
    temperature,
    messages: history
  });

  const answer = resp.choices?.[0]?.message?.content?.trim()
    || 'Entschuldige, mir fehlen gerade Details. Magst du es kurz ergänzen?';
  history.push({ role: 'assistant', content: answer });
  return answer;
}

// ========= Fehler-Logging =========
bot.catch((err, ctx) => {
  console.error('Bot-Fehler bei Update', ctx.update?.update_id, err);
});

// ========= Start: Begrüßung aus OpenAI =========
bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id;
    const intro =
      "Der Nutzer hat den Chat gestartet. Begrüße warm, sanft und kurz. " +
      "Lade ein, etwas über seinen Hund oder seine Katze zu erzählen oder ein Foto zu senden. " +
      "Nutze passende Emojis, aber nicht zu viele.";
    const answer = await askOpenAI(userId, intro, 0.4);
    await ctx.reply(answer);
  } catch (e) {
    console.error(e);
    await ctx.reply('Willkommen bei Seelenpfote 🐾 – erzähl mir gern von deinem Hund oder deiner Katze.');
  }
});

// ========= Textnachrichten =========
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const text = (ctx.message.text || '').trim();

  try {
    const answer = await askOpenAI(userId, text);
    await ctx.reply(answer);
  } catch (e) {
    console.error(e);
    await ctx.reply('Entschuldige, da ist etwas schiefgelaufen. Versuch es bitte nochmal 🙏');
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
          "Hier ist ein Foto. Beurteile empathisch und nur im Kontext von Hund oder Katze, " +
          "was zu sehen sein könnte (z. B. Rötung, Schwellung, Wunde, Haut/Zehen/Ohren/Augen). " +
          "Gib sanfte, sichere Hinweise für zuhause und formuliere ruhig. Nutze passende Emojis." },
        { type: 'image_url', image_url: { url: fileUrl } }
      ]
    });

    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: history
    });

    const answer = resp.choices?.[0]?.message?.content?.trim()
      || 'Ich konnte das Foto gerade nicht sinnvoll beurteilen. Magst du kurz beschreiben, was dir Sorgen macht?';
    history.push({ role: 'assistant', content: answer });
    await ctx.reply(answer);
  } catch (e) {
    console.error(e);
    await ctx.reply('Das Foto konnte ich nicht auswerten. Magst du es nochmal senden oder kurz beschreiben, was los ist? 📸');
  }
});

// ========= Dokumente (z. B. Bild als Datei) =========
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
          "Hier ist eine Datei (vermutlich ein Bild). Beurteile empathisch und ausschließlich für Hund/Katze, " +
          "was sichtbar sein könnte und gib ruhige, klare Hinweise. Nutze passende Emojis." },
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
    await ctx.reply(answer);
  } catch (e) {
    console.error(e);
    await ctx.reply('Die Datei konnte ich nicht auswerten. Magst du es mit einem Foto versuchen oder beschreiben, was los ist? 📎');
  }
});

// ========= Starten (Webhook aus → Long Polling) =========
(async () => {
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await bot.launch({ dropPendingUpdates: true });
    console.log('Seelenpfote läuft (Dogs & Cats only, Vision, Polling) 🐶🐱🐾');
  } catch (e) {
    console.error('Startfehler:', e);
    process.exit(1);
  }
})();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));





