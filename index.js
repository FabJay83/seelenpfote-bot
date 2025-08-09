// index.js — Seelenpfote Bot (Telegraf) — Große Erste-Hilfe-Version

const { Telegraf, session, Markup } = require('telegraf');

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN || TOKEN.trim().length < 30) {
  console.error('❌ BOT_TOKEN fehlt/ungültig.');
  process.exit(1);
}
const bot = new Telegraf(TOKEN.trim());

// -------- Safety & Sessions --------
bot.catch((err) => console.error('⚠️ Bot-Fehler:', err));
bot.use((ctx, next) => { if (!ctx.session) ctx.session = {}; return next(); });
bot.use(session());

function ensureProfile(ctx) {
  if (!ctx.session) ctx.session = {};
  if (!ctx.session.profile) {
    ctx.session.profile = {
      id: ctx.from?.id,
      name: ctx.from?.first_name || 'Freund',
      pet: null,              // 'Hund'|'Katze'
      lastIssue: null,        // Thema-Schlüssel
      lastPhotoTs: null,
      state: 'idle',          // 'idle'|'await_details'|'await_profile'
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

// -------- UI --------
const mainKb = Markup.keyboard([
  ['🆘 /notfall', 'ℹ️ /hilfe'],
  ['📨 /kontakt', '🔒 /datenschutz']
]).resize();

async function welcome(ctx) {
  const p = ensureProfile(ctx);
  await ctx.reply(
    `🐾 Hallo ${p.name}! Ich bin *Seelenpfote*.\n` +
    `Schreib mir, was los ist – oder schick ein *Foto*. Ich gebe dir eine ruhige Ersteinschätzung.`,
    { parse_mode: 'Markdown', ...mainKb }
  );
  if (!p.pet) {
    await ctx.reply('Hast du einen *Hund* oder eine *Katze*? Antworte mit „Hund“ oder „Katze“.',{ parse_mode:'Markdown' });
  }
}

// -------- Commands --------
bot.start((ctx)=>welcome(ctx));

bot.command('hilfe', async (ctx) => {
  const p = ensureProfile(ctx); setState(p,'idle');
  await ctx.reply(
    `So nutzt du Seelenpfote, ${p.name}:\n` +
    `1) Problem kurz beschreiben (z. B. „humpelt“, „Durchfall“, „hat etwas Giftiges gefressen“).\n` +
    `2) Foto/Video senden (falls sinnvoll).\n` +
    `3) Ich gebe dir *Erste Schritte* & *nächste Optionen*.\n\n` +
    `⚠️ Ich *ersetze keinen Tierarzt*. Bei Atemnot, starken Schmerzen, Krämpfen, Kollaps sofort Notdienst.`,
    { parse_mode:'Markdown' }
  );
});

bot.command('notfall', async (ctx) => {
  const p = ensureProfile(ctx); setState(p,'idle');
  await ctx.reply(
    `Allgemein bei Notfällen:\n` +
    `• Ruhig bleiben, Tier sichern, warm halten (nicht überhitzen)\n` +
    `• Starke Blutung: *sanfter Druck* mit sauberem Tuch\n` +
    `• Atemnot/Kollaps/Krampf: *sofort* Tierarzt-Notdienst\n` +
    `• Vergiftung: *kein* Erbrechen auslösen, Verpackung sichern\n` +
    `• Hitzschlag: Schatten, Lüften, Pfoten/Brust *lauwarm* kühlen\n\n` +
    `Schreib mir das *Hauptproblem*, ich gebe dir gezielte Schritte.`,
    { parse_mode:'Markdown' }
  );
});

bot.command('kontakt', (ctx)=>
  ctx.reply('📨 E-Mail: info@seelenpfote.app\n📸 Instagram: @seelenpfote.app')
);

bot.command('datenschutz', (ctx)=>
  ctx.reply('🔒 Kurzfassung: Ich speichere nur, was nötig ist. Details: https://www.seelenpfote.app/#Datenschutz')
);

// -------- Begrüßungen ohne /start --------
const greet = /^(hi|hallo|hey|servus|moin|guten\s*tag|guten\s*abend|guten\s*morgen)\b/i;
bot.hears(greet, (ctx)=>welcome(ctx));

// -------- Tierart --------
bot.hears(/^hund$/i, async (ctx)=>{ const p=ensureProfile(ctx); p.pet='Hund'; await ctx.reply('Alles klar, ich merke mir: 🐶 *Hund*.',{parse_mode:'Markdown'});});
bot.hears(/^katze$/i, async (ctx)=>{ const p=ensureProfile(ctx); p.pet='Katze'; await ctx.reply('Alles klar, ich merke mir: 🐱 *Katze*.',{parse_mode:'Markdown'});});

// -------- Foto → Details --------
bot.on('photo', async (ctx) => {
  const p = ensureProfile(ctx);
  p.lastPhotoTs = Date.now();
  p.details = {};
  setState(p,'await_details');
  await ctx.reply(
    `Danke fürs Bild, ${p.name}. Bitte kurz:\n` +
    `• Seit wann?\n• Schmerzen (ja/nein)?\n• Fieber/Erbrechen?\n• Verhalten verändert?\n` +
    `${p.pet ? `(Tier: ${p.pet})` : ''}`
  );
});

// -------- Helpers --------
const weightRe = /(\d+[.,]?\d*)\s*(kg|kilo|kilogramm)\b/i;
const ageRe    = /(\d+[.,]?\d*)\s*(jahr|jahre|j|yo|yr|yrs)\b/i;
const sinceRe  = /seit\s+([^\n,.!]+)/i;

const parseWeight = (t)=>{ const m=t.match(weightRe); return m?parseFloat(m[1].replace(',','.')):undefined; };
const parseAge    = (t)=>{ const m=t.match(ageRe); if(m) return parseFloat(m[1].replace(',','.')); const m2=t.match(/(\d+[.,]?\d*)/); if(m2){const v=parseFloat(m2[1].replace(',','.')); if(v<=25) return v;} return undefined; };
const parseSince  = (t)=>{ const m=t.match(sinceRe); if(m) return 'seit '+m[1].trim(); const m2=t.match(/(\d+)\s*(tag|tage|woche|wochen|monat|monate)/i); return m2?`${m2[1]} ${m2[2]}`:undefined; };
const hasYes      = (t)=>/\b(ja|yes|yep|stimmt)\b/i.test(t);
const hasNo       = (t)=>/\b(nein|no|nope|nicht)\b/i.test(t);

// -------- GROßER ERSTE-HILFE-KATALOG --------
const INTENTS = [
  {
    key: 'heatstroke',
    regex: /(hitzschlag|überhitzt|zu\s*heiß|hechel.*extrem)/i,
    text: `🥵 *Hitzschlag / Überhitzung*\n• Sofort in *Schatten/kühle Umgebung* bringen, Luftzufuhr\n• Pfoten/Brust *lauwarm* befeuchten (nicht eiskalt, kein Schock)\n• Trinkwasser anbieten, aber *nicht* zwangsweise einflößen\n• Körpertemp. wenn möglich messen – >40°C ist kritisch\n• *Sofort Tierarzt*, v. a. bei Apathie, Kollaps, Erbrechen, Krämpfen\n`,
  },
  {
    key: 'poison',
    regex: /(vergift|giftig|köder|rattengift|schokolade|xylit|frostschutz|pflanzenschutz|medikament.*gefressen)/i,
    text: `☠️ *Vergiftungsverdacht*\n• *Kein* Erbrechen auslösen\n• *Verpackung/Name* des Stoffes notieren\n• Maulreste nur vorsichtig entfernen\n• Aktivkohle nur nach tierärztlicher Rücksprache\n• *Sofort Tierarzt/Notdienst* – Zeitfenster ist wichtig\n`,
  },
  {
    key: 'vomiting',
    regex: /(erbrechen|brechen|kotzen|vomit)/i,
    text: `🤢 *Erbrechen*\n• 6–12 h Futterpause (Wasser anbieten), dann kleine leicht verdauliche Portionen\n• Bei *häufigem Erbrechen, Blut, Apathie, Fremdkörperverdacht, Welpen/Senioren* → *Tierarzt*\n• Nicht-schaumiges, einmaliges Erbrechen + gutes Allgemeinbefinden: beobachten\n`,
  },
  {
    key: 'diarrhea',
    regex: /(durchfall|diarrh)/i,
    text: `🥣 *Durchfall*\n• Wasser bereitstellen, leicht verdauliches Futter 12–24 h in kleinen Portionen\n• Kein Fett, keine Leckerlis\n• *Blutig, apathisch, Fieber, Erbrechen* oder >24–48 h → *Tierarzt*\n`,
  },
  {
    key: 'wound_limp',
    regex: /(wunde|schnitt|platzwunde|humpel|lahm|pfote\s*auf|pfote\s*verletzt)/i,
    text: `🩹 *Wunde / Humpeln*\n• Sanft reinigen (lauwarmes Wasser), *Druck* bei Blutung\n• Lecken verhindern (Body/Kragen), Ruhigstellen\n• Sichtbarer Fremdkörper? *Nicht tiefe* selbst entfernen; tiefe/verschmutzte Wunden → *Tierarzt*\n• Deutliche Lahmheit/Schwellung >24–48 h → *Tierarzt*\n`,
  },
  {
    key: 'choking',
    regex: /(erstick|steckt\s*fest|verschluckt|würg|atemnot|keuchen)/i,
    text: `🫁 *Erstickungsverdacht/Fremdkörper*\n• Ruhig, Maul vorsichtig öffnen, sichtbar *lockeren* Gegenstand entfernen (kein Stechen)\n• *Keine* blinden Eingriffe tief im Hals\n• Kleine Hunde: 5x ruckartige Rücken-Schläge zwischen Schultern, abwechseln mit vorsichtigen Brustkompressionen\n• *Sofort Tierarzt*, wenn Atemnot anhält\n`,
  },
  {
    key: 'seizure',
    regex: /(krampf|krampfanfall|epileps)/i,
    text: `⚡ *Krampfanfall*\n• Umgebung sichern, Licht dämpfen, *nicht* festhalten, *nichts* ins Maul\n• Zeit messen (>3–5 min kritisch) / Cluster?\n• Nach dem Anfall ruhig sprechen, warm halten\n• *Sofort Tierarzt* bei erstem Anfall, Anfall >3–5 min oder mehreren Anfällen\n`,
  },
  {
    key: 'bloat_gdv',
    regex: /(aufgebläht|bl[aä]hbauch|bauch\s*(groß|hart)|magendrehung|gdv)/i,
    text: `🚨 *Magendrehung (Hund) Verdacht*\n• Symptome: aufgeblähter harter Bauch, erfolgloses Würgen, Unruhe, Speicheln\n• *Nicht* füttern/tränken, *sofort* Tierarzt/Notdienst — *zeitkritisch*\n`,
  },
  {
    key: 'urinary_block',
    regex: /(kater.*kann.*nicht.*urin|harnstau|harnverhalt|katze.*pressen.*klo)/i,
    text: `🚨 *Harnröhrenverschluss (v. a. Kater)*\n• Häufiges Pressen ohne Urin, Schmerz, Lautäußerung, Lethargie\n• *Sofort* Tierarzt/Notdienst — *lebensbedrohlich* (Stunden zählen)\n`,
  },
  {
    key: 'allergy_anaphylaxis',
    regex: /(allerg|schwellung|gesicht\s*geschwollen|quaddeln|stich.*reaktion)/i,
    text: `🤧 *Allergische Reaktion*\n• Mäßige Schwellung/Juckreiz: kühlende Umschläge\n• Anschwellen von Gesicht/Lippen, Atemprobleme, Kollaps → *sofort Notdienst*\n• Keine humanen Antihistaminika ohne tierärztliche Rücksprache\n`,
  },
  {
    key: 'eye_injury',
    regex: /(auge.*verletz|augenverletzung|auge.*rot|auge.*eiter|hornhaut)/i,
    text: `👁️ *Augenverletzung/Entzündung*\n• Nicht reiben lassen, Kragen wenn nötig\n• Kein Hausmittel/Salben ohne Tierarzt (falsche Mittel schaden)\n• Licht meiden\n• *Zeitnah Tierarzt*, bei Schmerz, Eiter, Trübung, Fremdkörper\n`,
  },
  {
    key: 'ear_infection',
    regex: /(ohr.*entzündung|ohrenentzündung|ohr.*schütteln|kopfschütteln|othämatom|blutblase)/i,
    text: `👂 *Ohrenproblem*\n• Häufig Schütteln/Jucken, übler Geruch\n• Nicht tief reinigen, nichts einträufeln ohne Diagnose\n• Blutblase (Othämatom) = tierärztlich abklären\n`,
  },
  {
    key: 'tick_foxtail',
    regex: /(zecke|grassamen|grasfahne|foxtail|fremdkörper\s*pfote|nasenloch)/i,
    text: `🪲 *Zecke/Fremdkörper Grasfahne*\n• Zecke nahe der Haut mit Zeckenkarte/Zange *gerade* herausziehen (nicht drehen/quetschen)\n• Grasfahne in Nase/Ohr/Pfote → *Tierarzt*, nicht selbst stochern\n`,
  },
  {
    key: 'burns_chemical',
    regex: /(verbrennung|verbrannt|verätzt|chemie|s[aä]ure|laugen)/i,
    text: `🔥 *Verbrennung/Verätzung*\n• Hitzequelle entfernen; 10–15 min *lauwarm* kühlen (nicht eiskalt)\n• Chemikalien: *lange* mit Wasser spülen, Handschutz\n• Keine Salben/Öle, steril abdecken\n• *Tierarzt*, je nach Ausmaß sofort\n`,
  },
  {
    key: 'hypothermia_frost',
    regex: /(unterk[üu]hlung|frost|erfroren|kalt\s*zitter)/i,
    text: `🧊 *Unterkühlung/Frost*\n• Langsam aufwärmen (Decke, körpernahe Wärme), trocknen\n• Kein heißes Wasser, keine direkte Hitze\n• *Tierarzt*, v. a. bei Apathie/steifer Gang/weißen Ohren/Schwanzspitze\n`,
  },
  {
    key: 'hypoglycemia',
    regex: /(unterzucker|zuckerspiegel\s*niedrig|welpe.*schwach|zittert\s*welpe)/i,
    text: `🍬 *Unterzucker (v. a. Welpe/Minirasse)*\n• Wenn bei Bewusstsein: etwas zuckerhaltiges *am Zahnfleisch* verreiben (Honig/Glukose)—nicht erzwingen\n• Warm halten, *Tierarzt* zur Ursache\n`,
  },
  {
    key: 'insect_snake',
    regex: /(insektenstich|wespe|biene|hornisse|schlangenbiss)/i,
    text: `🪰 *Insektenstich / Schlangenbiss*\n• Stich: Stachel vorsichtig seitlich ausstreichen, kühlen\n• Gesicht/Kehlkopf-Schwellung, Atemprobleme → *sofort Notdienst*\n• Schlangenbiss: ruhig halten, betroffene Gliedmaße *tief lagern*, *sofort* Tierarzt — *kein* Aussaugen/Abbinden\n`,
  },
];

// Antworten, wenn Nutzer „erste hilfe / nächste schritte / beobachtung“ schreibt
function firstAidFor(key) {
  const item = INTENTS.find(i => i.key === key);
  return item ? item.text : null;
}

// -------- Text-Flow (FSM + Intents) --------
bot.on('text', async (ctx) => {
  const p = ensureProfile(ctx);
  const t = (ctx.message.text || '').trim();
  console.log('📥', p.state, '-', ctx.from?.username || ctx.from?.id, ':', t);

  // 1) Intent-Erkennung (großer Katalog)
  for (const it of INTENTS) {
    if (it.regex.test(t)) {
      p.lastIssue = it.key;
      setState(p, 'await_profile'); // wir wollen Basisdaten einsammeln
      await ctx.reply(
        it.text +
        `\nWenn möglich, nenn mir bitte noch *Alter, Gewicht und seit wann* – dann passe ich die nächsten Schritte besser an.`
      );
      return;
    }
  }

  // 2) Intent „erste hilfe / nächste schritte / beobachtung“
  if (/(erste\s*hilfe|n[aä]chste\s*schritte|beobachtung|was\s*kann\s*ich\s*tun|hilfe\s*geben)/i.test(t)) {
    const txt = firstAidFor(p.lastIssue);
    if (txt) {
      await ctx.reply(txt, { parse_mode: 'Markdown' });
      return;
    }
    await ctx.reply(`Gern! Schreib mir kurz, *worum* es geht (z. B. „humpelt“, „Durchfall“, „vergiftung“, „hitzschlag“) – dann bekommst du passende Schritte.`);
    return;
  }

  // 3) Detail-Antworten nach Foto
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

  // 4) Alter/Gewicht/Seit-wann — auch falls state irrtümlich idle
  if (p.state === 'await_profile' || p.state === 'idle') {
    const age = parseAge(t);
    const weight = parseWeight(t);
    const since = parseSince(t);

    if (age || weight || since) {
      p.details.age    = p.details.age    ?? age;
      p.details.weight = p.details.weight ?? weight;
      p.details.since  = p.details.since  ?? since;

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
        `\n➡️ Tippe *„erste hilfe“* oder *„nächste schritte“* für konkrete Hinweise.`
      );
      return;
    }
  }

  // 5) Fallback
  await ctx.reply(`Danke, ${p.name}. Wenn du magst, sag mir *Alter, Gewicht und seit wann* – dann kann ich gezielter helfen. Oder beschreibe das *Hauptproblem* (z. B. „vergiftung“, „hitzschlag“, „humpelt“, „durchfall“).`);
});

// -------- Start: Webhook löschen + Polling --------
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








