// index.js — Seelenpfote Bot (Telegraf) mit Zustandslogik (kein Wiederholen)

const { Telegraf, session, Markup } = require('telegraf');

// --- BOT_TOKEN prüfen ---
const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN || TOKEN.trim().length < 30) {
  console.error('❌ BOT_TOKEN fehlt/ungültig. In Railway unter Variables setzen.');
  process.exit(1);
}
const bot = new Telegraf(TOKEN.trim());

// --- Fehler nie App crashen lassen ---
bot.catch((err) => console.error('⚠️ Bot-Fehler:', err));

// --- Session & Absicherung ---
bot.use((ctx, next) => { if (!ctx.session) ctx.session = {}; return next(); });
bot.use(session());

function profile(ctx) {
  if (!ctx.session) ctx.session = {};
  if (!ctx.session.profile) {
    ctx.session.profile = {
      id: ctx.from?.id,
      name: ctx.from?.first_name || 'Freund',
      pet: null,              // 'Hund' | 'Katze'
      lastIssue: null,
      lastPhotoTs: null,
      state: 'idle',          // 'idle' | 'await_details' | 'await_profile'
      details: {},            // sammelt Antworten
    };
  }
  return ctx.session.profile;
}

// --- UI ---
const mainKb = Markup.keyboard([
  ['🆘 /notfall', 'ℹ️ /hilfe'],
  ['📨 /kontakt', '🔒 /datenschutz']
]).resize();

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
  p.state = 'idle';
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
  const p = profile(ctx);
  p.state = 'idle';
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
  ctx.reply('🔒 Kurzfassung: Ich speichere nur, was nötig ist. Details: https://www.seelenpfote.app/#Datenschutz')
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

// --- Foto → Details erfragen, dann Status setzen ---
bot.on('photo', async (ctx) => {
  const p = profile(ctx);
  p.lastPhotoTs = Date.now();
  p.state = 'await_details';
  p.details = {};
  await ctx.reply(
    `Danke fürs Bild, ${p.name}. Bitte beschreibe kurz:\n` +
    `• Seit wann?\n• Schmerzen (ja/nein)?\n• Fieber/Erbrechen?\n• Verhalten verändert?\n` +
    `${p.pet ? `(Tier: ${p.pet})` : ''}`
  );
});

// --- Helfer: einfache Extraktion ---
function extractNumbers(text) {
  const num = (text.match(/(\d+(?:[.,]\d+)?)/) || [])[1];
  return num ? parseFloat(num.replace(',', '.')) : undefined;
}
function containsYes(text){ return /\b(ja|yes|yep|stimmt)\b/i.test(text); }
function containsNo(text){ return /\b(nein|no|nope|nicht)\b/i.test(text); }
function containsDuration(text){
  const m = text.match(/(\d+)\s*(tag|tage|woche|wochen|monat|monate)/i);
  if (!m) return undefined;
  return m[1] + ' ' + m[2];
}

// --- Textlogik mit Zuständen ---
bot.on('text', async (ctx) => {
  const p = profile(ctx);
  const t = (ctx.message.text || '').trim();

  // Globale einfache Symptome
  if (p.state === 'idle') {
    if (/durchfall|diarrh/i.test(t)) {
      p.lastIssue = 'Durchfall';
      p.state = 'await_profile';
      await ctx.reply(
        `Verstanden – *Durchfall*.\n` +
        `• Flüssigkeit & leicht verdauliches Futter\n` +
        `• Wenn blutig, apathisch oder >24–48h → Tierarzt\n` +
        `• Welpen/Senioren schneller abklären\n\n` +
        `Magst du mir *Alter, Gewicht und seit wann* sagen?`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    if (/wunde|verletz|schnitt|humpel/i.test(t)) {
      p.lastIssue = 'Wunde/Humpeln';
      p.state = 'await_profile';
      await ctx.reply(
        `Okay – verstanden. Ich brauche noch *Alter, Gewicht und seit wann* das Problem besteht.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
  }

  // Zustand: wartet auf Detailantworten nach Foto
  if (p.state === 'await_details') {
    p.details.since = p.details.since || containsDuration(t) || (/seit/i.test(t) ? t : undefined);
    if (containsYes(t)) p.details.pain = true;
    if (containsNo(t) && p.details.pain === undefined) p.details.pain = false;
    if (/fieber|temperatur|erbrechen|brechen|vomit/i.test(t)) {
      p.details.feverVomiting = /kein|keine|ohne/i.test(t) ? false : true;
    }
    if (/ruhig|apath|anders|verhält|humpel|lahm|frisst|trinkt/i.test(t)) {
      p.details.behavior = t;
    }

    // Wenn wir zumindest etwas haben, gehe zum nächsten Schritt
    if (p.details.since || p.details.pain !== undefined || p.details.feverVomiting !== undefined || p.details.behavior) {
      p.state = 'await_profile';
      await ctx.reply(`Danke. Jetzt noch *Alter, Gewicht und seit wann* in kurz (z. B. „6 Jahre, 9.5 kg, seit 1 Woche“).`);
      return;
    }
    // Wenn nichts erkannt wurde, einmalig nachhaken (ohne Wiederholungspam)
    await ctx.reply(`Magst du kurz *seit wann*, *Schmerzen (ja/nein)*, *Fieber/Erbrechen* und *Verhalten* beschreiben?`);
    return;
  }

  // Zustand: wartet auf Alter/Gewicht/Dauer
  if (p.state === 'await_profile') {
    const age = extractNumbers(t);              // erste Zahl ~ Alter (Heuristik)
    const weight = (t.match(/(\d+[.,]?\d*)\s*(kg|kilogramm)/i) || [])[1]
      ? parseFloat((t.match(/(\d+[.,]?\d*)\s*(kg|kilogramm)/i) || [])[1].replace(',', '.'))
      : undefined;
    const since = containsDuration(t) || (/(seit)/i.test(t) ? t : undefined);

    if (age || weight || since) {
      p.state = 'idle';
      p.details.age = p.details.age ?? age;
      p.details.weight = p.details.weight ?? weight;
      p.details.since = p.details.since ?? since;

      // Kurze, nicht-medizinische Einschätzung + nächstes To-do
      await ctx.reply(
        `Danke, ${p.name}. Zusammenfassung:\n` +
        `${p.pet ? `• Tier: ${p.pet}\n` : ''}` +
        `${p.lastIssue ? `• Thema: ${p.lastIssue}\n` : ''}` +
        `${p.details.since ? `• Seit: ${p.details.since}\n` : ''}` +
        `${p.details.pain !== undefined ? `• Schmerzen: ${p.details.pain ? 'ja' : 'nein'}\n` : ''}` +
        `${p.details.feverVomiting !== undefined ? `• Fieber/Erbrechen: ${p.details.feverVomiting ? 'ja' : 'nein'}\n` : ''}` +
        `${p.details.weight ? `• Gewicht: ${p.details.weight} kg\n` : ''}` +
        `${p.details.age ? `• Alter (ca.): ${p.details.age}\n` : ''}` +
        `\n➡️ Wenn du möchtest, kann ich dir nun *konkrete nächste Schritte* vorschlagen (hausmittel/Beobachtung), oder wir klären, ob ein Tierarzt heute sinnvoll ist.`
      );
      return;
    }

    // Noch nicht erkannt → einmalige, klare Nachfrage
    await ctx.reply(`Bitte nenn mir *Alter, Gewicht und seit wann* in einem Satz (z. B. „6 Jahre, 9.5 kg, seit 1 Woche“).`);
    return;
  }

  // Fallback wenn kein spezieller Zustand
  await ctx.reply(`Danke, ${p.name}. Magst du Alter, Gewicht und seit wann das Problem besteht sagen?${p.pet ? ` (Tier: ${p.pet})` : ''}`);
});

// --- Start: Webhook-Reset + Polling ---
(async () => {
  try {
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






