// index.js — Seelenpfote Bot (Telegraf) — Final

const { Telegraf, session, Markup } = require('telegraf');

// --- BOT_TOKEN prüfen ---
const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN || TOKEN.trim().length < 30) {
  console.error('❌ BOT_TOKEN fehlt/ungültig. In Railway unter Variables setzen.');
  process.exit(1);
}
const bot = new Telegraf(TOKEN.trim());

// ----------------- Safety & Sessions -----------------
bot.catch((err, ctx) => console.error('⚠️ Bot-Fehler:', err));
bot.use((ctx, next) => { if (!ctx.session) ctx.session = {}; return next(); });
bot.use(session());

function ensureProfile(ctx) {
  if (!ctx.session) ctx.session = {};
  if (!ctx.session.profile) {
    ctx.session.profile = {
      id: ctx.from?.id,
      name: ctx.from?.first_name || 'Freund',
      pet: null,              // 'Hund' | 'Katze'
      lastIssue: null,        // 'Wunde/Humpeln' | 'Durchfall' | ...
      lastPhotoTs: null,
      state: 'idle',          // 'idle' | 'await_details' | 'await_profile'
      details: {},            // since, pain, feverVomiting, behavior, age, weight
    };
  }
  return ctx.session.profile;
}
function setState(p, next) {
  if (p.state !== next) {
    console.log(`🔄 STATE: ${p.state} -> ${next}`);
    p.state = next;
  }
}

// ----------------- UI -----------------
const mainKb = Markup.keyboard([
  ['🆘 /notfall', 'ℹ️ /hilfe'],
  ['📨 /kontakt', '🔒 /datenschutz']
]).resize();

async function welcome(ctx) {
  const p = ensureProfile(ctx);
  await ctx.reply(
    `🐾 Hallo ${p.name}! Ich bin *Seelenpfote*.\n` +
    `Erzähl mir kurz, was los ist – du kannst mir auch ein *Foto* schicken.`,
    { parse_mode: 'Markdown', ...mainKb }
  );
  if (!p.pet) {
    await ctx.reply('Hast du einen *Hund* oder eine *Katze*? Antworte einfach mit „Hund“ oder „Katze“.',{ parse_mode:'Markdown' });
  }
}

// ----------------- Commands -----------------
bot.start((ctx)=>welcome(ctx));

bot.command('hilfe', async (ctx) => {
  const p = ensureProfile(ctx); setState(p,'idle');
  await ctx.reply(
    `So nutzt du Seelenpfote, ${p.name}:\n` +
    `1) Beschreibe kurz das Problem.\n` +
    `2) Sende Foto/Video, wenn sinnvoll.\n` +
    `3) Ich gebe dir eine *ruhige Ersteinschätzung* & nächste Schritte.\n\n` +
    `⚠️ Ich *ersetze keinen Tierarzt*. Bei Atemnot, starken Schmerzen, Krampfanfällen sofort Notdienst.`,
    { parse_mode:'Markdown' }
  );
});

bot.command('notfall', async (ctx) => {
  const p = ensureProfile(ctx); setState(p,'idle');
  await ctx.reply(
    `Erste Schritte (allgemein):\n` +
    `• Blutung: sanfter Druck mit sauberem Tuch\n` +
    `• Vergiftung: *kein* Erbrechen auslösen, Verpackung merken\n` +
    `• Hitzschlag: Schatten, Pfoten/Brust kühlen (nicht eiskalt)\n` +
    `• Atemnot/Kollaps: *sofort* Tierarzt-Notdienst\n\n` +
    `Schreib mir kurz Situation + seit wann – ich begleite dich.`,
    { parse_mode:'Markdown' }
  );
});

bot.command('kontakt', (ctx)=>
  ctx.reply('📨 E-Mail: info@seelenpfote.app\n📸 Instagram: @seelenpfote.app')
);

bot.command('datenschutz', (ctx)=>
  ctx.reply('🔒 Kurzfassung: Ich speichere nur, was nötig ist. Details: https://www.seelenpfote.app/#Datenschutz')
);

// ----------------- Begrüßungen ohne /start -----------------
const greet = /^(hi|hallo|hey|servus|moin|guten\s*tag|guten\s*abend|guten\s*morgen)\b/i;
bot.hears(greet, (ctx)=>welcome(ctx));

// ----------------- Tierart -----------------
bot.hears(/^hund$/i, async (ctx)=>{ const p=ensureProfile(ctx); p.pet='Hund'; await ctx.reply('Alles klar, ich merke mir: 🐶 *Hund*.',{parse_mode:'Markdown'});});
bot.hears(/^katze$/i, async (ctx)=>{ const p=ensureProfile(ctx); p.pet='Katze'; await ctx.reply('Alles klar, ich merke mir: 🐱 *Katze*.',{parse_mode:'Markdown'});});

// ----------------- Foto → Details -----------------
bot.on('photo', async (ctx) => {
  const p = ensureProfile(ctx);
  p.lastPhotoTs = Date.now();
  p.details = {};
  setState(p,'await_details');
  await ctx.reply(
    `Danke fürs Bild, ${p.name}. Bitte beschreibe kurz:\n` +
    `• Seit wann?\n• Schmerzen (ja/nein)?\n• Fieber/Erbrechen?\n• Verhalten verändert?\n` +
    `${p.pet ? `(Tier: ${p.pet})` : ''}`
  );
});

// ----------------- Extraction-Helper -----------------
const weightRe = /(\d+[.,]?\d*)\s*(kg|kilo|kilogramm)\b/i;
const ageRe    = /(\d+[.,]?\d*)\s*(jahr|jahre|j|yo|yr|yrs)\b/i;
const sinceRe  = /seit\s+([^\n,.!]+)/i;

function parseWeight(t){
  const m = t.match(weightRe);
  if (!m) return undefined;
  return parseFloat(m[1].replace(',','.'));
}
function parseAge(t){
  const m = t.match(ageRe);
  if (m) return parseFloat(m[1].replace(',','.'));
  // fallback: erste Zahl (häufig Alter), wenn <= 25
  const m2 = t.match(/(\d+[.,]?\d*)/);
  if (m2) {
    const v = parseFloat(m2[1].replace(',','.'));
    if (v <= 25) return v;
  }
  return undefined;
}
function parseSince(t){
  const m = t.match(sinceRe);
  if (m) return 'seit ' + m[1].trim();
  const m2 = t.match(/(\d+)\s*(tag|tage|woche|wochen|monat|monate)/i);
  if (m2) return `${m2[1]} ${m2[2]}`;
  return undefined;
}
const hasYes = (t) => /\b(ja|yes|yep|stimmt)\b/i.test(t);
const hasNo  = (t) => /\b(nein|no|nope|nicht)\b/i.test(t);

// ----------------- Text-Flow (FSM + Intents) -----------------
bot.on('text', async (ctx) => {
  const p = ensureProfile(ctx);
  const t = (ctx.message.text || '').trim();
  console.log('📥', p.state, '-', ctx.from?.username || ctx.from?.id, ':', t);

  // --- Intent: Erste Hilfe / Nächste Schritte / Beobachtung ---
  if (/(erste\s*hilfe|n[aä]chste\s*schritte|beobachtung|was\s*kann\s*ich\s*tun|hilfe\s*geben)/i.test(t)) {
    if (p.lastIssue === 'Wunde/Humpeln') {
      await ctx.reply(
        `🩹 *Erste Hilfe bei Humpeln/Wunde*\n` +
        `• Ruhig halten, kurze Leinenrunden – kein Springen/Spielen\n` +
        `• Pfote/Gelenk inspizieren: Fremdkörper, Riss, Zecke, Dorn?\n` +
        `• Kleine Oberflächenwunde: lauwarm spülen, trocken tupfen, nicht lecken lassen (Body/Kragen)\n` +
        `• Deutliche Schmerzen, Schwellung, Lahmheit >24–48h, offene/tiefe Wunde → *Tierarzt*\n\n` +
        `👀 *Beobachten*: Fressen/Trinken normal? Belastung besser/schlechter? Schwellt es an?\n` +
        `⚠️ *Sofort Notdienst*, wenn: tiefe Verletzung, starke Schwellung, sichtbare Fehlstellung, Apathie.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    if (p.lastIssue === 'Durchfall') {
      await ctx.reply(
        `🥣 *Erste Hilfe bei Durchfall*\n` +
        `• Wasser anbieten, leicht verdauliches Futter (z. B. Hühnchen/Reis o. Diätfutter)\n` +
        `• Kleine Portionen 12–24h, kein Fett/Leckerlis\n` +
        `• Elektrolyte (tiergerecht) bei Bedarf\n` +
        `• Blutig, Fieber, Apathie, starkes Erbrechen oder >24–48h → *Tierarzt*\n\n` +
        `👀 *Beobachten*: Häufigkeit, Konsistenz, Trinken, Allgemeinverhalten.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    // kein Thema gesetzt
    await ctx.reply(
      `Gern! Schreib mir kurz, *worum* es geht (z. B. „humpelt“, „Wunde“, „Durchfall“), dann gebe ich dir passende erste Schritte.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // --- Symptome -> Profilabfrage ---
  if (p.state === 'idle') {
    if (/durchfall|diarrh/i.test(t)) {
      p.lastIssue='Durchfall'; setState(p,'await_profile');
      await ctx.reply(`Verstanden – *Durchfall*. Bitte nenne *Alter, Gewicht und seit wann* (z. B. „6 Jahre, 9.5 kg, seit 1 Woche“).`,{parse_mode:'Markdown'});
      return;
    }
    if (/wunde|verletz|schnitt|humpel|lahm/i.test(t)) {
      p.lastIssue='Wunde/Humpeln'; setState(p,'await_profile');
      await ctx.reply(`Okay. Bitte *Alter, Gewicht und seit wann* (z. B. „6 Jahre, 9.5 kg, seit 1 Woche“).`,{parse_mode:'Markdown'});
      return;
    }
  }

  // --- Antworten auf Detailfragen nach Foto ---
  if (p.state === 'await_details') {
    p.details.since = p.details.since || parseSince(t);
    if (p.details.pain === undefined) {
      if (hasYes(t)) p.details.pain = true;
      else if (hasNo(t)) p.details.pain = false;
    }
    if (/fieber|temperatur|erbrechen|brechen|vomit/i.test(t)) {
      p.details.feverVomiting = /kein|keine|ohne/i.test(t) ? false : true;
    }
    if (/ruhig|apath|anders|verhält|humpel|lahm|frisst|trinkt/i.test(t)) {
      p.details.behavior = t;
    }
    setState(p,'await_profile');
    await ctx.reply(`Danke. Jetzt bitte *Alter, Gewicht und seit wann* (z. B. „6 Jahre, 9.5 kg, seit 1 Woche“).`);
    return;
  }

  // --- Alter/Gewicht/Seit-wann erkennen — auch wenn state irrtümlich idle ---
  if (p.state === 'await_profile' || p.state === 'idle') {
    const age = parseAge(t);
    const weight = parseWeight(t);
    const since = parseSince(t);

    if (age || weight || since) {
      p.details.age    = p.details.age    ?? age;
      p.details.weight = p.details.weight ?? weight;
      p.details.since  = p.details.since  ?? since;

      // Sobald mindestens 1 Info da ist, zusammenfassen & zurück zu idle (kein Loop)
      setState(p,'idle');
      await ctx.reply(
        `Danke, ${p.name}. Zusammenfassung:\n` +
        `${p.pet ? `• Tier: ${p.pet}\n` : ''}` +
        `${p.lastIssue ? `• Thema: ${p.lastIssue}\n` : ''}` +
        `${p.details.since ? `• Seit: ${p.details.since}\n` : ''}` +
        `${p.details.pain !== undefined ? `• Schmerzen: ${p.details.pain ? 'ja' : 'nein'}\n` : ''}` +
        `${p.details.feverVomiting !== undefined ? `• Fieber/Erbrechen: ${p.details.feverVomiting ? 'ja' : 'nein'}\n` : ''}` +
        `${p.details.weight ? `• Gewicht: ${p.details.weight} kg\n` : ''}` +
        `${p.details.age ? `• Alter (ca.): ${p.details.age}\n` : ''}` +
        `\n➡️ Schreibe *„erste hilfe“* oder *„nächste schritte“*, dann bekommst du konkrete Hinweise.`
      );
      return;
    }
  }

  // --- letzter Fallback (ohne Endlosschleife) ---
  await ctx.reply(`Danke, ${p.name}. Wenn du magst, sag mir *Alter, Gewicht und seit wann* das Problem besteht – dann kann ich gezielter helfen.`);
});

// ----------------- Start: Webhook löschen + Polling -----------------
(async () => {
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    const me = await bot.telegram.getMe();
    console.log('✅ Verbunden als @'+me.username);
    await bot.launch({ polling:true });
    console.log('🚀 Seelenpfote Bot läuft (Polling aktiv)');
  } catch (e) {
    console.error('❌ Startfehler:', e);
    process.exit(1);
  }
})();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));







