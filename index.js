// Seelenpfote – kompletter Bot: 100% OpenAI-gestützt (Text + Bilder) mit empathischem Emoji-Stil
// CommonJS, Telegraf + OpenAI (Vision). Long Polling (Webhook deaktiviert).

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

// ===== Gesprächsspeicher pro Nutzer =====
// Struktur: Map<userId, OpenAIMessage[]>
const sessions = new Map();

function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, [
      {
        role: 'system',
        content:
          "Du bist 'Seelenpfote', ein einfühlsamer Tier-Begleiter. Sprich warm, beruhigend und menschlich. " +
          "Benutze passende Emojis, um Gefühle sanft zu unterstreichen (z. B. ❤️ Mitgefühl, 🐾 Tiere, 😊 Ermutigung, ⚠️ Warnhinweis, 📸 für Fotos). " +
          "Halte Antworten klar und natürlich, ohne unnötigen Fachjargon. " +
          "Gib bei Bedarf einfache, sichere Erste-Hilfe-Hinweise für Zuhause (niedrigschwellig). " +
          "Zeige bei ernsthaften Anzeichen respektvoll auf, dass eine tierärztliche Abklärung sinnvoll ist, ohne Angst zu machen. " +
          "Passe die Sprache an die Nutzerin/den Nutzer an (antworte in der Sprache der letzten Nachricht). " +
          "Wenn Name oder Tiername genannt wurden, sprich die Person bzw. die Fellnase gelegentlich persönlich an – dezent, nicht in jedem Satz. " +
          "Vermeide Wiederholungen – bestätige einmal, dann werde natürlich."
      }
    ]);
  }
  return sessions.get(userId);
}

async function askOpenAI(userId, userContent) {
  const history = getSession(userId);
  history.push({ role: 'user', content: userContent });

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',          // Vision-fähig, günstig & schnell
    temperature: 0.5,
    messages: history
  });

  const answer = resp.choices?.[0]?.message?.content?.trim() || 'Entschuldige, mir fehlen gerade Informationen. Magst du es kurz erneut versuchen?';
  history.push({ role: 'assistant', content: answer });
  return answer;
}

// ===== Fehler-Logging =====
bot.catch((err, ctx) => {
  console.error('Bot-Fehler bei Update', ctx.update?.update_id, err);
});

// ===== Start (Begrüßung über OpenAI generieren) =====
bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id;
    const intro = "Der Nutzer hat den Chat gestartet. Bitte begrüße warm, kurz und freundlich. Lade ein, etwas über die Fellnase zu erzählen oder ein Foto zu senden. Verwende passende Emojis, aber nicht übertrieben.";
    const answer = await askOpenAI(userId, intro);
    await ctx.reply(answer);
  } catch (e) {
    console.error(e);
    await ctx.reply('Willkommen bei Seelenpfote 🐾 – ich bin gleich für dich da.');
  }
});

// ===== Textnachrichten =====
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const text = (ctx.message.text || '').trim();

  // An OpenAI geben – komplette Unterhaltung im Kontext
  try {
    const answer = await askOpenAI(userId, text);
    await ctx.reply(answer);
  } catch (e) {
    console.error(e);
    await ctx.reply('Entschuldige, da ist etwas schiefgelaufen. Versuch es bitte nochmal 🙏');
  }
});

// ===== Fotos (Vision) =====
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
        { type: 'text', text: "Hier ist ein Foto meiner Fellnase. Bitte beurteile empathisch, was du siehst (z. B. Wunde, Rötung, Schwellung) und gib mir liebevolle, klare Hinweise. Nutze passende Emojis." },
        { type: 'image_url', image_url: { url: fileUrl } }
      ]
    });

    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: history
    });

    const answer = resp.choices?.[0]?.message?.content?.trim() || 'Ich konnte das Bild gerade nicht sinnvoll beurteilen. Magst du kurz beschreiben, was dir Sorgen macht?';
    history.push({ role: 'assistant', content: answer });
    await ctx.reply(answer);
  } catch (e) {
    console.error(e);
    await ctx.reply('Das Bild konnte ich gerade nicht auswerten. Magst du es nochmal senden oder kurz beschreiben, was du siehst? 📸');
  }
});

// ===== Dokumente (z. B. Bild als Datei) =====
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
        { type: 'text', text: "Hier ist eine Datei (vermutlich ein Bild). Bitte beurteile empathisch, was du siehst, und gib klare, sanfte Hinweise. Nutze passende Emojis." },
        { type: 'image_url', image_url: { url: fileUrl } }
      ]
    });

    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: history
    });

    const answer = resp.choices?.[0]?.message?.content?.trim() || 'Ich konnte die Datei nicht sinnvoll beurteilen. Magst du kurz beschreiben, was dir Sorgen macht?';
    history.push({ role: 'assistant', content: answer });
    await ctx.reply(answer);
  } catch (e) {
    console.error(e);
    await ctx.reply('Die Datei konnte ich nicht auswerten. Magst du es mit einem Foto versuchen oder kurz beschreiben, was los ist? 📎');
  }
});

// ===== Starten (Webhook aus -> Polling) =====
(async () => {
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await bot.launch({ dropPendingUpdates: true });
    console.log('Seelenpfote läuft (100% OpenAI, Vision, Polling) 🐶🐾');
  } catch (e) {
    console.error('Startfehler:', e);
    process.exit(1);
  }
})();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));




