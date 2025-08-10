// index.js — Seelenpfote Telegram Helfer (nur Text, empathisch, ohne Bildanalyse)
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
    console.error('❌ Telegram-Token ungültig:', err?.message || err);
    process.exit(1);
  });

// Empathie-Wrapper
function careReply(userText, aiAnswer) {
  return (
    `💛 ${aiAnswer}\n\n` +
    `Ich verstehe, dass das eine belastende Situation sein kann. ` +
    `Du bist nicht allein – wir gehen das Schritt für Schritt gemeinsam durch. 🐾\n\n` +
    `Kannst du mir bitte noch sagen:\n` +
    `• Wo genau ist die Stelle? (Pfote, Auge, Bauch …)\n` +
    `• Seit wann besteht das?\n` +
    `• Wird es besser oder schlimmer?`
  );
}

// /start Befehl
bot.onText(/^\/start\b/i, async (msg) => {
  const chatId = msg.chat.id;
  const hello =
    'Willkommen 💛\n' +
    'Erzähl mir, was bei deinem Tier los ist – ich höre zu und helfe dir Schritt für Schritt.\n' +
    'Beschreibe bitte so genau wie möglich, was du beobachtest. 🐕🐈';
  await bot.sendMessage(chatId, hello);
});

// Text-Nachrichten
bot.on('text', async (msg) => {
  if (/^\/start\b/i.test(msg.text)) return; // Start-Befehl ignorieren
  const chatId = msg.chat.id;
  const userMsg = msg.text;

  try {
    await bot.sendChatAction(chatId, 'typing');

    // GPT-Textanalyse
    const res = await openai.responses.create({
      model: 'gpt-4o-mini',
      input: [
        { role: 'system', content: [{ type: 'input_text', text: 'Du bist eine einfühlsame tiermedizinische Assistenz. Antworte warmherzig, verständlich und ohne Fachjargon.' }] },
        { role: 'user', content: [{ type: 'input_text', text: userMsg }] }
      ],
    });

    const aiText = res.output_text || 'Ich bin mir nicht sicher, aber wir finden es gemeinsam heraus.';
    const finalReply = careReply(userMsg, aiText);

    await bot.sendMessage(chatId, finalReply);
  } catch (err) {
    console.error('❌ Fehler bei Textverarbeitung:', err?.message || err);
    await bot.sendMessage(chatId, '⚠️ Etwas ist schiefgelaufen – versuch es bitte nochmal.');
  }
});

console.log('✅ Bot läuft – nur Textmodus, empathisch');



















