// index.js — Seelenpfote Bot (Telegraf) — FSM stabil gegen Wiederholungen

const { Telegraf, session, Markup } = require('telegraf');

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN || TOKEN.trim().length < 30) {
  console.error('❌ BOT_TOKEN fehlt/ungültig.');
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
      pet: null,
      lastIssue: null,
      lastPhotoTs: null,
      state: 'idle',              // 'idle' | 'await_details' | 'await_profile'
      details: {},
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
    `🐾 Hallo ${p.name}! Ich bin *Seelenpfote*.\nErzähl mir kurz, was los ist – du kannst mir auch ein *Foto* schicken.`,
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
    `So nutzt du Seelenpfote, ${p.name}:\n1) Problem kurz beschreiben.\n2) Foto/Video senden (falls sinnvoll).\n3) Ich gebe dir eine *ruhige Ersteinschätzung* & nächste Schritte.\n\n⚠️ Ich *ersetze keinen Tierarzt*.`,
    { parse_mode:'Markdown' }
  );
});
bot.command('notfall', async (ctx) => {
  const p = ensureProfile(ctx); setState(p,'idle');
  await ctx.reply(
    `Erste Schritte:\n• Blutung: sanfter Druck\n• Vergiftung: *kein* Erbrechen auslösen\n• Hitzschlag: Schatten, Pfoten/Brust kühlen (nicht eiskalt)\n• Atemnot/Kollaps: *sofort* Notdienst\n\nSchreib mir kurz Situation + seit wann.`,
    { parse_mode:'Markdown' }
  );
});
bot.command('kontakt', (ctx)=>ctx.reply('📨 info@seelenpfote.app\n📸 @seelenpfote.app'));
bot.command('datenschutz', (ctx)=>ctx.reply('🔒 Details: https://www.seelenpfote.app/#Datenschutz'));

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
    `Danke fürs Bild, ${p.name}. Bitte beschreibe kurz:\n• Seit wann?\n• Schmerzen (ja/nein)?\n• Fieber/Erbrechen?\n• Verhalten verändert?\n${p.pet ? `(Tier: ${p.pet})` : ''}`
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
  // weitere einfache Muster
  const m2 = t.match(/(\d+)\s*(tag|tage|woche|wochen|monat|monate)/i);
  if (m2) return `${m2[1]} ${m2[2]}`;
  return undefined;
}
function hasYes(t){ return /\b(ja|yes|yep|stimmt)\b/i.test(t); }
function hasNo(t){  return /\b(nein|no|nope|nicht)\b/i.test(t); }

// ----------------- Text-Flow (FSM) -----------------
bot.on('text', async (ctx) => {
  const p = ensureProfile(ctx);
  const t = (ctx.message.text || '').trim();
  console.log('📥', p.state, '-', ctx.from?.username || ctx.from?.id, ':', t);

  // Symptome → direkt Profil abfragen
  if (p.state === 'idle') {
    if (/durchfall|diarrh/i.test(t)) {
      p.lastIssue='Durchfall'; setState(p,'await_profile');
      await ctx.reply(`Verstanden – *Durchfall*. Bitte nenne mir *Alter, Gewicht und seit wann* (z. B. „6 Jahre, 9.5 kg, seit 1 Woche“).`,{parse_mode:'Markdown'});
      return;
    }
    if (/wunde|verletz|schnitt|humpel|lahm/i.test(t)) {
      p.lastIssue='Wunde/Humpeln'; setState(p,'await_profile');
      await ctx.reply(`Okay. Bitte *Alter, Gewicht und seit wann* (z. B. „6 Jahre, 9.5 kg, seit 1 Woche“).`,{parse_mode:'Markdown'});
      return;
    }
  }

  // Antworten auf Detailfragen nach Foto
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
    // weiter zur Profilabfrage
    setState(p,'await_profile');
    await ctx.reply(`Danke. Jetzt bitte *Alter, Gewicht und seit wann* (z. B. „6 Jahre, 9.5 kg, seit 1 Woche“).`);
    return;
  }

  // Alter/Gewicht/Seit-wann erkennen — auch wenn state aus Versehen idle ist
  if (p.state === 'await_profile' || p.state === 'idle') {
    const age = parseAge(t);
    const weight = parseWeight(t);
    const since = parseSince(t);

    if (age || weight || since) {
      p.details.age    = p.details.age    ?? age;
      p.details.weight = p.details.weight ?? weight;
      p.details.since  = p.details.since  ?? since;

      // Wenn mindestens 2 Infos vorhanden → Zusammenfassung & Abschluss
      const infoCount = [p.details.age, p.details.weight, p.details.since].filter(Boolean).length;
      if (infoCount >= 1) { // schon ab 1 Info zusammenfassen, um nicht zu loopen
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
          `\n➡️ Möchtest du *konkrete nächste Schritte* sehen (Beobachtung/Erste Hilfe) oder lieber *Tierarzt-Finder*?`
        );
        return;
      }
      // Noch zu wenig erkannt → einmalig freundlich nachhaken
      setState(p,'await_profile');
      await ctx.reply(`Fast geschafft 😊 Bitte *Alter, Gewicht und seit wann* in einem Satz (z. B. „6 Jahre, 9.5 kg, seit 1 Woche“).`);
      return;
    }
  }

  // letzter Fallback (kein Loop)
  await ctx.reply(`Danke, ${ensureProfile(ctx).name}. Wenn du magst, sag mir *Alter, Gewicht und seit wann* das Problem besteht – dann kann ich gezielter helfen.`);
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







