// index.js — Seelenpfote Bot (Telegraf) — Vollversion mit Webhook-Reset & Polling

const { Telegraf, session, Markup } = require('telegraf');

// --- BOT_TOKEN prüfen ---
const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN || TOKEN.trim().length < 30) {
  console.error('❌ BOT_TOKEN fehlt/ungültig. In Railway unter Variables setzen.');
  process.exit(1);
}
const bot = new Telegraf(TOKEN.trim());

// --- Session: kleine Merkliste pro Nutzer ---
bot.use(session());
function profile(ctx) {
  if (!ctx.session.profile) {
    ctx.session.profile = {
      id: ctx.from?.id,
      name: ctx.from?.first_name || 'Freund',
      pet: null,          // 'Hund' | 'Katze'
      lastIssue: null,
      lastPhotoTs: null
    };
  }
  return ctx.session.profile;
}

// --- Komfort-Tastatur ---
const mainKb = Markup.keyboard([
  ['🆘 /notfall', 'ℹ️ /hilfe'],
  ['📨 /kontakt', '🔒 /datenschutz']
]).resize();

// --- Hilfsfunktion: Begrüßung ---
async function welcome(ctx) {
  const p = profile(ctx);
  await ctx.reply(
    `🐾 Hallo ${p.name}! Ich bin *Seelenpfote*.\n` +
    `Erzähl mir kurz, was los ist – du kannst mir auch ein *Foto* schicken.`,
    { parse_mode: 'Markdown', ...mainKb }
  );
  if (!p.pet) {
    await ctx.reply('Hast du einen *Hund* oder eine *Katze*? Antworte einfach mit „Hund“ oder „Katze“.', { parse_mode: 'Markdown' });
  }
}

// --- Commands ---
bot.start(async (ctx) => welcome(ctx));

bot.command('hilfe', async (ctx) => {
  const p = profile(ctx);
  await ctx.reply(
    `So nutzt du Seelenpfote, ${p.name}:\n` +
    `1) Beschreibe kurz das Problem.\n` +
    `2) Sende Foto/Video, wenn sinnvoll.\n` +
    `3) Ich gebe dir eine *ruhige Ersteinschätzung* & nächste Schritte.\n\n` +
    `⚠️ Ich *ersetze keinen Tierarzt*. Bei Atemnot, starken Schmerzen, Krampfanfällen sofort Notdienst.`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('notfall', async (ctx) => {
  await ctx.reply(
    `Erste Schritte (allgemein):\n` +
    `• Blutung: sanfter Druck mit sauberem Tuch\n` +
    `• Vergiftung: *kein* Erbrechen auslösen, Verpackung merken\n` +
    `• Hitzschlag: Schatten, Pfoten/Brust kühlen (nicht eiskalt)\n` +
    `• Atemnot/Kollaps: *sofort* Tierarzt-Notdienst\n\n` +
    `Schreib mir kurz Situation + seit wann – ich begleite dich.`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('kontakt', (ctx) =>
  ctx.reply('📨 E-Mail: info@seelenpfote.app\n📸 Instagram: @seelenpfote.app')
);

bot.command('datenschutz', (ctx) =>
  ctx.reply('🔒 Kurzfassung: Ich speichere nur, was für die Antwort nötig ist. Details: https://www.seelenpfote.app/#Datenschutz')
);

// --- Begrüßungen ohne /start ---
const greetRegex = /^(hi|hallo|hey|servus|moin|guten\s*tag|guten\s*abend|guten\s*morgen)\b/i;
bot.hears(greetRegex, async (ctx) => welcome(ctx));

// --- Tierart merken ---
bot.hears(/^hund$/i, async (ctx) => {
  const p = profile(ctx); p.pet = 'Hund';
  await ctx.reply('Alles klar, ich merke mir: 🐶 *Hund*.', { parse_mode: 'Markdown' });
});
bot.hears(/^katze$/i, async (ctx) => {
  const p = profile(ctx); p.pet = 'Katze';
  await ctx.reply('Alles klar, ich merke mir: 🐱 *Katze*.', { parse_mode: 'Markdown' });
});

// --- Foto erkannt → gezielte Rückfragen ---
bot.on('photo', async (ctx) => {
  const p = profile(ctx);
  p.lastPhotoTs = Date.now();
  await ctx.reply(
    `Danke fürs Bild, ${p.name}. Bitte beschreibe kurz:\n` +
    `• Seit wann?\n• Schmerzen (ja/nein)?\n• Fieber/Erbrechen?\n• Verhalten verändert?\n` +
    `${p.pet ? `(Tier: ${p.pet})` : ''}`
  );
});

// --- Text: einfache Symptom-Erkennung + persönlicher Fallback ---
bot.on('text', async (ctx, next) => {
  // Logging jeder eingehenden Text-Nachricht (hilft beim Debuggen)
  console.log('📥 Text von', ctx.from?.username || ctx.from?.id, ':', ctx.message.text);

  const p = profile(ctx);
  const t = (ctx.message.text || '').trim();

  if (/durchfall|diarrh/i.test(t)) {
    p.lastIssue = 'Durchfall';
    await ctx.reply(
      `Verstanden – *Durchfall*.\n` +
      `• Flüssigkeit & leicht verdauliches Futter\n` +
      `• Wenn blutig, apathisch oder >24–48h → Tierarzt\n` +
      `• Welpen/Senioren schneller abklären`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  if (/wunde|verletz|schnitt/i.test(t)) {
    p.lastIssue = 'Wunde';
    await ctx.reply(
      `Okay – *Wunde*.\n` +
      `• Sanft reinigen (lauwarmes Wasser), Druck bei Blutung\n` +
      `• Nicht lecken lassen (Kragen/Body)\n` +
      `• Tiefe/verschmutzte Wunden zeitnah zum Tierarzt`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  await ctx.reply(
    `Danke, ${p.name}. Magst du Alter, Gewicht und seit wann das Problem besteht sagen?` +
    `${p.pet ? ` (Tier: ${p.pet})` : ''}`
  );
  return next && next();
});

// --- Start mit Webhook-Reset + Polling + Logging ---
(async () => {
  try {
    // Wichtig: vorhandenen Webhook entfernen, damit Polling Nachrichten bekommt
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });

    const me = await bot.telegram.getMe();
    console.log('✅ Verbunden als @' + me.username);

    await bot.launch({ polling: true });
    console.log('🚀 Seelenpfote Bot läuft (Polling aktiv)');
  } catch (e) {
    console.error('❌ Startfehler:', e);
    process.exit(1);
  }
})();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));




