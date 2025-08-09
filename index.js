// index.js — Seelenpfote Bot (Telegraf) — MaxPack v2 (persönlich, ohne Buttons)

const { Telegraf, session } = require('telegraf');

// --- BOT_TOKEN prüfen ---
const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN || TOKEN.trim().length < 30) {
  console.error('❌ BOT_TOKEN fehlt/ungültig.');
  process.exit(1);
}
const bot = new Telegraf(TOKEN.trim());

// ----------------- Safety & Sessions -----------------
bot.catch((err) => console.error('⚠️ Bot-Fehler:', err));
bot.use((ctx, next) => { if (!ctx.session) ctx.session = {}; return next(); });
bot.use(session());

function ensureProfile(ctx) {
  if (!ctx.session) ctx.session = {};
  if (!ctx.session.profile) {
    ctx.session.profile = {
      id: ctx.from?.id,
      name: ctx.from?.first_name || 'Freund',
      pet: null,              // 'Hund' | 'Katze'
      lastIssue: null,        // Themen-Schlüssel
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

// ----------------- Begrüßung -----------------
async function welcome(ctx) {
  const p = ensureProfile(ctx);
  await ctx.reply(
    `🐾 Hallo ${p.name}! Schön, dass du da bist. Ich bin *Seelenpfote* – ruhig, herzlich und an deiner Seite.\n` +
    `Erzähl mir einfach, was los ist. Wenn’s hilft, schick mir gern ein *Foto*.`,
    { parse_mode: 'Markdown' }
  );
  if (!p.pet) {
    await ctx.reply('Hast du einen *Hund* oder eine *Katze*? Antworte mit „Hund“ oder „Katze“.',{ parse_mode:'Markdown' });
  }
}

// ----------------- Commands -----------------
bot.start((ctx)=>welcome(ctx));

bot.command('hilfe', async (ctx) => {
  const p = ensureProfile(ctx); setState(p,'idle');
  await ctx.reply(
    `So laufen wir zusammen, ${p.name}:\n` +
    `1) Du beschreibst kurz das Thema (z. B. „humpelt“, „Durchfall“, „hat etwas Giftiges gefressen“).\n` +
    `2) Foto/Video gern dazu.\n` +
    `3) Ich gebe dir *Erste Schritte* und *ruhige Orientierung*.\n\n` +
    `⚠️ Ich *ersetze keinen Tierarzt*. Bei Atemnot, starken Schmerzen, Krämpfen oder Kollaps bitte sofort Notdienst.`,
    { parse_mode:'Markdown' }
  );
});
bot.command('notfall', async (ctx) => {
  const p = ensureProfile(ctx); setState(p,'idle');
  await ctx.reply(
    `Wenn es dringend wirkt: ruhig atmen, Tier sichern, warm halten (nicht überhitzen).\n` +
    `• Starke Blutung: *sanfter Druck* mit sauberem Tuch\n` +
    `• Vergiftung: *kein* Erbrechen auslösen, Verpackung sichern\n` +
    `• Hitzschlag: Schatten, Pfoten/Brust *lauwarm* kühlen\n` +
    `• Atemnot/Kollaps/Krampf: *sofort* Notdienst\n\n` +
    `Schreib mir das *Hauptproblem*, ich helfe dir direkt.`,
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
    `Danke fürs Bild, ${p.name}. Magst du mir kurz sagen:\n` +
    `• Seit wann?\n• Schmerzen (ja/nein)?\n• Fieber/Erbrechen?\n• Verhalten verändert?\n` +
    `${p.pet ? `(Tier: ${p.pet})` : ''}`
  );
});

// ----------------- Helper -----------------
const weightRe = /(\d+[.,]?\d*)\s*(kg|kilo|kilogramm)\b/i;
const ageRe    = /(\d+[.,]?\d*)\s*(jahr|jahre|j|yo|yr|yrs)\b/i;
const sinceRe  = /seit\s+([^\n,.!]+)/i;

const parseWeight = (t)=>{ const m=t.match(weightRe); return m?parseFloat(m[1].replace(',','.')):undefined; };
const parseAge    = (t)=>{ const m=t.match(ageRe); if(m) return parseFloat(m[1].replace(',','.')); const m2=t.match(/(\d+[.,]?\d*)/); if(m2){const v=parseFloat(m2[1].replace(',','.')); if(v<=25) return v;} return undefined; };
const parseSince  = (t)=>{ const m=t.match(sinceRe); if(m) return 'seit '+m[1].trim(); const m2=t.match(/(\d+)\s*(tag|tage|woche|wochen|monat|monate)/i); return m2?`${m2[1]} ${m2[2]}`:undefined; };
const hasYes      = (t)=>/\b(ja|yes|yep|stimmt)\b/i.test(t);
const hasNo       = (t)=>/\b(nein|no|nope|nicht)\b/i.test(t);

// ----------------- Erste-Hilfe-Katalog (MaxPack v2) -----------------
const INTENTS = [
  // Hitze / Kälte / Energie
  { key:'heatstroke', regex:/(hitzschlag|überhitzt|ueberhitzt|zu\s*heiß|hechel.*extrem)/i,
    text:`🥵 *Hitzschlag/Überhitzung*\n• Sofort Schatten/kühl, Lüften\n• Pfoten/Brust *lauwarm* befeuchten (nicht eiskalt)\n• Wasser anbieten, nicht erzwingen\n• >40°C kritisch → *sofort Tierarzt*`},
  { key:'hypothermia_frost', regex:/(unterk[üu]hlung|frost|erfroren|kalt\s*zitter)/i,
    text:`🧊 *Unterkühlung/Frost*\n• Langsam aufwärmen (Decke/Körperwärme), gut trocknen\n• Keine direkte Hitze/kein heißes Wasser\n• Bei Apathie/steifem Gang/weißen Ohr-/Schwanzspitzen → *Tierarzt*`},
  { key:'hypoglycemia', regex:/(unterzucker|zuckerspiegel\s*niedrig|welpe.*schwach|zittert\s*welpe)/i,
    text:`🍬 *Unterzucker (v. a. Welpe/Minirasse)*\n• Bei Bewusstsein: etwas Honig/Glukose am Zahnfleisch (nicht erzwingen)\n• Warm halten → *Tierarzt*`},

  // Vergiftung / Fremdkörper / GI
  { key:'poison', regex:/(vergift|giftig|köder|koeder|rattengift|schokolade|xylit|trauben|rosinen|frostschutz|pflanzenschutz|nikotin|medikament.*gefressen)/i,
    text:`☠️ *Vergiftungsverdacht*\n• *Kein* Erbrechen auslösen\n• Stoff/Verpackung sichern\n• Aktivkohle nur nach Rücksprache\n• *Sofort Tierarzt/Notdienst*`},
  { key:'foreign_body', regex:/(fremdkörper.*(gefressen|verschluckt)|socke|stein|knochen\s*verschluckt|spielzeug.*gefressen)/i,
    text:`🧵 *Fremdkörper verschluckt*\n• Nicht füttern/tränken\n• Kein Erbrechen provozieren\n• Faden/Leine *nie* ziehen!\n• *Zeitnah Tierarzt* (Röntgen/US nötig)`},
  { key:'vomiting', regex:/(erbrechen|brechen|kotzen|vomit)/i,
    text:`🤢 *Erbrechen*\n• 6–12 h Futterpause, Wasser anbieten\n• Dann kleine leicht verdauliche Portionen\n• Häufig/blutig/Fieber/Apathie/Welpe/Senior → *Tierarzt*`},
  { key:'diarrhea', regex:/(durchfall|diarrh)/i,
    text:`🥣 *Durchfall*\n• Wasser bereitstellen, Schonkost in Miniportionen 12–24 h\n• Kein Fett/Leckerlis\n• Blutig/Fieber/Apathie/Erbrechen oder >24–48 h → *Tierarzt*`},
  { key:'constipation', regex:/(verstopfung|hart\s*stuhl|koten\s*schwer|pressen\s*ohne\s*erfolg(?!.*urin))/i,
    text:`🚽 *Verstopfung*\n• Kein hartes Drücken provozieren, keine Hausmittel\n• Wasser anbieten, sanfte Bewegung\n• Schmerz, Lethargie, Erbrechen oder >24–48 h → *Tierarzt*`},
  { key:'pancreatitis', regex:/(pankreatitis|bauchschmerz.*(nach|seit)\s*fettem|geburtstag.*reste.*gefressen|fettiges\s*futter.*seit)/i,
    text:`🔥 *Pankreatitis-Verdacht*\n• Symptome: Bauchschmerz, Erbrechen, Mattigkeit nach *fettem Futter*\n• Schonkost wenig, Wasser\n• *Tierarzt* (Schmerz/Infusion möglich)`},
  { key:'bloat_gdv', regex:/(aufgebläht|aufgeblaeht|bl[aä]hbauch|bauch\s*(groß|hart)|magendrehung|gdv)/i,
    text:`🚨 *Magendrehung (Hund) – Verdacht*\n• Aufgeblähter harter Bauch, erfolgloses Würgen, Unruhe\n• Nicht füttern/tränken → *sofort* Notdienst (zeitkritisch)`},
  { key:'dehydration', regex:/(dehydriert|ausgetrocknet|hautfaltentest|trinkt\s*kaum)/i,
    text:`💧 *Dehydrierung*\n• Häufig kleine Wassermengen anbieten\n• Lethargie, trockene Schleimhäute, stehende Hautfalte → *Tierarzt* (Infusion)`},

  // Trauma / Wunden / Zähne
  { key:'wound_limp', regex:/(wunde|schnitt|platzwunde|humpel|lahm|pfote\s*auf|pfote\s*verletzt)/i,
    text:`🩹 *Wunde/Humpeln*\n• Lauwarm spülen, *Druck* bei Blutung\n• Lecken verhindern (Body/Kragen), ruhig halten\n• Tiefe/verschmutzte Wunden → *Tierarzt*\n• Lahmheit/Schwellung >24–48 h → *Tierarzt*`},
  { key:'bite_wound', regex:/(biss|gebissen|beißerei|beisserei)/i,
    text:`🦷 *Bissverletzung*\n• Auch kleine Löcher = tiefe Taschen möglich → Infektionsrisiko\n• Spülen (lauwarm), sauber abdecken, ruhig halten\n• *Tierarzt* (Reinigung, ggf. AB/Drainage)`},
  { key:'dental_fracture', regex:/(zahn.*abgebrochen|zahnbruch|zahn\s*gebrochen|ecke\s*zahn)/i,
    text:`🦷 *Zahn abgebrochen*\n• Schmerz möglich; Speicheln/Blut\n• Kein hartes Futter/Kauartikel\n• *Zeitnah Tier(zahn)arzt* (Pulpa offen? Entzündungsgefahr)`},

  // Atemwege / Kreislauf / Krampf
  { key:'choking', regex:/(erstick|steckt\s*fest|verschluckt|würg|wuerg|atemnot|keuchen)/i,
    text:`🫁 *Erstickungsverdacht/Fremdkörper*\n• Sichtbar lockeres vorsichtig entfernen (nicht stechen)\n• Keine blinden Tiefgriffe\n• Kleine Hunde: 5x Rückenschläge zw. Schultern, abwechselnd mit Brustkompressionen\n• *Sofort Tierarzt* bei Atemnot`},
  { key:'seizure', regex:/(krampf|krampfanfall|epileps)/i,
    text:`⚡ *Krampfanfall*\n• Nicht festhalten, nix ins Maul, Umgebung sichern\n• Zeit messen (>3–5 min/Cluster = kritisch)\n• Danach ruhig, warm halten\n• *Sofort Tierarzt* bei erstem Anfall/ >3–5 min/mehreren Anfällen`},
  { key:'near_drowning', regex:/(beinahe.*ertrunken|wasser\s*eingeatmet|unter\s*wasser\s*gewesen)/i,
    text:`🌊 *Beinahe-Ertrinken*\n• Ruhig, wärmen\n• Kopf/Brust leicht tiefer, wenn Wasser aus Mund/Nase läuft\n• Anhaltende Atemnot/Husten/Blaufärbung → *sofort Tierarzt*`},
  { key:'electric_shock', regex:/(stromschlag|kabel\s*gebissen|elektrisch.*schlag)/i,
    text:`⚡ *Stromschlag*\n• Stromquelle trennen, erst dann anfassen\n• Maulverbrennungen möglich → ruhig beobachten\n• Atemnot, Apathie, Krampf → *sofort Tierarzt*`},

  // Urogenital / Geburt
  { key:'urinary_block', regex:/(kater.*kann.*nicht.*urin|harnstau|harnverhalt|katze.*pressen.*klo)/i,
    text:`🚨 *Harnröhrenverschluss (v. a. Kater)*\n• Häufiges Pressen ohne Urin, Schmerz, Lautäußerung\n• *Sofort* Notdienst – lebensbedrohlich`},
  { key:'pyometra', regex:/(eitergebärmutter|pyometra|gebärmutterentzündung|gebarmutter)/i,
    text:`🚨 *Gebärmuttervereiterung (Hündin/Katze)*\n• Matt, Fieber, Durst, ggf. eitriger Ausfluss\n• *Sofort Tierarzt* (OP/Intensiv kann nötig sein)`},
  { key:'whelping', regex:/(geburt|welpen.*kommen|wehen|presswehen)/i,
    text:`👶 *Geburt/Wehen*\n• Normale Pausen zwischen Welpen bis ~2 h\n• Pressen >20–30 min ohne Welpe, stinkender Ausfluss, sichtbarer Welpe steckt → *sofort Notdienst*\n• Warm, ruhig, saubere Tücher bereithalten`},

  // Allergie / Haut / Ohren / Augen / Zecke
  { key:'allergy_anaphylaxis', regex:/(allerg|schwellung|gesicht\s*geschwollen|quaddeln|stich.*reaktion)/i,
    text:`🤧 *Allergische Reaktion*\n• Leicht: kühlen\n• Gesicht/Kehlkopf-Schwellung, Atemnot → *sofort Notdienst*\n• Keine Human-Antihistaminika ohne Rücksprache`},
  { key:'eye_injury', regex:/(auge.*verletz|augenverletzung|auge.*rot|auge.*eiter|hornhaut|ulkus|ulcus)/i,
    text:`👁️ *Augenproblem*\n• Nicht reiben lassen (Kragen), Licht meiden\n• Keine Salben ohne Diagnose\n• Schmerz, Eiter, Trübung, Fremdkörper → *zeitnah Tierarzt*`},
  { key:'ear_infection', regex:/(ohr.*entzündung|ohrenentzündung|ohr.*schütteln|kopfschütteln|othaemat|othämatom|blutblase)/i,
    text:`👂 *Ohrproblem*\n• Schütteln/Juckreiz, evtl. Geruch\n• Nicht tief reinigen, nichts einträufeln\n• Blutblase (Othämatom) → *Tierarzt*`},
  { key:'tick_foxtail', regex:/(zecke|grassamen|grasfahne|foxtail|fremdkörper\s*pfote|nasenloch)/i,
    text:`🪲 *Zecke/Fremdkörper*\n• Zecke hautnah mit Karte/Zange *gerade* ziehen (nicht quetschen)\n• Grasfahne in Nase/Ohr/Pfote → *Tierarzt* (nicht stochern)`},

  // Verbrennung / Chemie / Trauma innen
  { key:'burns_chemical', regex:/(verbrennung|verbrannt|verätzt|veraetzt|chemie|s[aä]ure|laugen)/i,
    text:`🔥 *Verbrennung/Verätzung*\n• Hitzequelle weg; 10–15 min *lauwarm* kühlen (nicht eiskalt)\n• Chemikalie: *lange* spülen, Handschutz\n• Keine Salben/Öle; steril abdecken\n• Je nach Ausmaß *Tierarzt*`},
  { key:'blunt_trauma', regex:/(angefahren|gefallen|sturz|kollision|tritt|autounfall)/i,
    text:`🩺 *Stumpfes Trauma*\n• Ruhe, warm halten, Blutungen stillen\n• Versteckter Innenschaden möglich (Milz, Lunge)\n• Apathie, blasse Schleimhäute, schneller Puls, Bauchschmerz → *sofort Tierarzt*`},
];

const ISSUE_LABELS = {
  heatstroke:'Hitzschlag/Überhitzung',
  hypothermia_frost:'Unterkühlung/Frost',
  hypoglycemia:'Unterzucker',
  poison:'Vergiftung',
  foreign_body:'Fremdkörper verschluckt',
  vomiting:'Erbrechen',
  diarrhea:'Durchfall',
  constipation:'Verstopfung',
  pancreatitis:'Pankreatitis-Verdacht',
  bloat_gdv:'Magendrehung (Hund)',
  dehydration:'Dehydrierung',
  wound_limp:'Wunde/Humpeln',
  bite_wound:'Bissverletzung',
  dental_fracture:'Zahn abgebrochen',
  choking:'Erstickungsverdacht',
  seizure:'Krampfanfall',
  near_drowning:'Beinahe-Ertrinken',
  electric_shock:'Stromschlag',
  urinary_block:'Harnröhrenverschluss (Kater)',
  pyometra:'Gebärmuttervereiterung',
  whelping:'Geburt/Wehen',
  allergy_anaphylaxis:'Allergische Reaktion',
  eye_injury:'Augenproblem',
  ear_infection:'Ohrenproblem',
  tick_foxtail:'Zecke/Grasfahne',
  burns_chemical:'Verbrennung/Verätzung',
  blunt_trauma:'Stumpfes Trauma',
};

// Erste Hilfe-Text aus Katalog
function firstAidFor(key) {
  const item = INTENTS.find(i => i.key === key);
  return item ? item.text : null;
}

// ----------------- Text-Flow (FSM + Intents) -----------------
bot.on('text', async (ctx) => {
  const p = ensureProfile(ctx);
  const t = (ctx.message.text || '').trim();
  console.log('📥', p.state, '-', ctx.from?.username || ctx.from?.id, ':', t);

  // 1) Große Themen-Erkennung → sofort Erstinfo + Profil abfragen
  for (const it of INTENTS) {
    if (it.regex.test(t)) {
      p.lastIssue = it.key;
      setState(p, 'await_profile');
      await ctx.reply(
        it.text + `\nWenn du magst, nenn mir noch *Alter, Gewicht und seit wann* – dann kann ich gezielter helfen.`,
        { parse_mode:'Markdown' }
      );
      return;
    }
  }

  // 2) Intent „erste hilfe / nächsten schritte / weiter / tipps / beobachtung“
  if (/(erste\s*hilfe|n[aä]chst\w*\s*schritt\w*|weiter(gehen|e|)\b|was\s*(jetzt|tun)|tipps?|anleitung|beobachtung)/i.test(t)) {
    const txt = firstAidFor(p.lastIssue);
    if (txt) {
      await ctx.reply(txt, { parse_mode:'Markdown' });
    } else {
      await ctx.reply(`Gern, ${p.name}. Sag mir kurz, *worum* es geht (z. B. „humpelt“, „Durchfall“, „vergiftung“, „hitzschlag“).`);
    }
    return;
  }

  // 3) Antworten auf Detailfragen nach Foto
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
    await ctx.reply(`Danke dir. Jetzt bitte *Alter, Gewicht und seit wann* (z. B. „6 Jahre, 9.5 kg, seit 1 Woche“).`);
    return;
  }

  // 4) Alter/Gewicht/Seit-wann erkennen — auch wenn state irrtümlich idle
  if (p.state === 'await_profile' || p.state === 'idle') {
    const age = parseAge(t);
    const weight = parseWeight(t);
    const since = parseSince(t);

    if (age || weight || since) {
      p.details.age    = p.details.age    ?? age;
      p.details.weight = p.details.weight ?? weight;
      p.details.since  = p.details.since  ?? since;

      setState(p,'idle');
      const label = ISSUE_LABELS[p.lastIssue] || p.lastIssue || '—';
      await ctx.reply(
        `Danke, ${p.name}. Ich habe verstanden:\n` +
        `${p.pet ? `• Tier: ${p.pet}\n` : ''}` +
        `${p.lastIssue ? `• Thema: ${label}\n` : ''}` +
        `${p.details.since ? `• Seit: ${p.details.since}\n` : ''}` +
        `${p.details.pain !== undefined ? `• Schmerzen: ${p.details.pain ? 'ja' : 'nein'}\n` : ''}` +
        `${p.details.feverVomiting !== undefined ? `• Fieber/Erbrechen: ${p.details.feverVomiting ? 'ja' : 'nein'}\n` : ''}` +
        `${p.details.weight ? `• Gewicht: ${p.details.weight} kg\n` : ''}` +
        `${p.details.age ? `• Alter (ca.): ${p.details.age}\n` : ''}` +
        `\nWenn du bereit bist, schreib einfach *„erste hilfe“*, *„nächsten schritte“* oder *„was tun“* – ich führe dich liebevoll hindurch.`,
        { parse_mode:'Markdown' }
      );
      return;
    }
  }

  // 5) Letzter Fallback (ohne Loop)
  await ctx.reply(`Danke, ${p.name}. Wenn du magst, sag mir *Alter, Gewicht und seit wann* – oder beschreibe das *Hauptproblem* (z. B. „vergiftung“, „hitzschlag“, „humpelt“, „durchfall“).`);
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










