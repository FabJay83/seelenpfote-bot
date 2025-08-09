// index.js — Seelenpfote Bot (Telegraf) — MaxPack v3 (DE/EN auto-detect, no buttons)

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

// ----------------- Language utils -----------------
function detectLangFromText(txt) {
  if (!txt) return null;
  const t = txt.toLowerCase();
  const enHits = /(hello|hi|hey|dog|cat|vomit|diarrh|help|first aid|next steps|poison|heatstroke|bleeding)/i.test(t);
  const deHits = /(hallo|moin|hund|katze|erbrechen|durchfall|hilfe|erste hilfe|nächste schritte|vergift|hitzschlag|blutung)/i.test(t);
  if (enHits && !deHits) return 'en';
  if (deHits && !enHits) return 'de';
  return null;
}
function normalizeLang(langCode) {
  if (!langCode) return 'de';
  const lc = String(langCode).toLowerCase();
  if (lc.startsWith('de')) return 'de';
  if (lc.startsWith('en')) return 'en';
  return 'de';
}
function ensureProfile(ctx) {
  if (!ctx.session) ctx.session = {};
  if (!ctx.session.profile) {
    ctx.session.profile = {
      id: ctx.from?.id,
      name: ctx.from?.first_name || 'Freund',
      lang: normalizeLang(ctx.from?.language_code),
      pet: null,              // 'Hund' | 'Katze' | 'Dog' | 'Cat' (nur Anzeige)
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
function setLangByContext(ctx, p, maybeText) {
  // Priorität: explizit gesetzte Sprache via /language > Text-Erkennung > Telegram language_code
  const auto = detectLangFromText(maybeText);
  if (auto && auto !== p.lang) p.lang = auto;
}

// ----------------- Texte DE/EN -----------------
const TXT = {
  welcome: {
    de: (name)=>`🐾 Hallo ${name}! Schön, dass du da bist. Ich bin *Seelenpfote* – ruhig, herzlich und an deiner Seite.\nErzähl mir einfach, was los ist. Wenn’s hilft, schick mir gern ein *Foto*.`,
    en: (name)=>`🐾 Hi ${name}! I’m *Seelenpfote* – calm, caring, and here for you.\nTell me what’s going on. You can also send a *photo* if helpful.`
  },
  askPet: {
    de: `Hast du einen *Hund* oder eine *Katze*? Antworte mit „Hund“ oder „Katze“.`,
    en: `Do you have a *dog* or a *cat*? Reply with “dog” or “cat”.`
  },
  helpCmd: {
    de: (name)=>`So laufen wir zusammen, ${name}:\n1) Du beschreibst kurz das Thema (z. B. „humpelt“, „Durchfall“, „etwas Giftiges gefressen“).\n2) Gern Foto/Video dazu.\n3) Ich gebe dir *Erste Schritte* & *ruhige Orientierung*.\n\n⚠️ Ich *ersetze keinen Tierarzt*. Bei Atemnot, starken Schmerzen, Krämpfen oder Kollaps bitte sofort Notdienst.`,
    en: (name)=>`Here’s how we work, ${name}:\n1) Briefly describe the issue (e.g., “limping”, “diarrhea”, “ate something toxic”).\n2) Add a photo/video if you can.\n3) I’ll give you *first aid steps* and *calm guidance*.\n\n⚠️ I do *not* replace a vet. If breathing trouble, severe pain, seizures, or collapse: emergency vet NOW.`
  },
  sosCmd: {
    de: `Wenn es dringend wirkt: ruhig atmen, Tier sichern, warm halten (nicht überhitzen).\n• Starke Blutung: *sanfter Druck* mit sauberem Tuch\n• Vergiftung: *kein* Erbrechen auslösen, Verpackung sichern\n• Hitzschlag: Schatten, Pfoten/Brust *lauwarm* kühlen\n• Atemnot/Kollaps/Krampf: *sofort* Notdienst\n\nSchreib mir das *Hauptproblem*, ich helfe dir direkt.`,
    en: `If it feels urgent: stay calm, secure your pet, keep warm (not overheated).\n• Heavy bleeding: *gentle pressure* with clean cloth\n• Poisoning: *do not* induce vomiting, keep packaging\n• Heatstroke: shade, *lukewarm* cooling of paws/chest\n• Breathing trouble/collapse/seizure: emergency vet NOW\n\nTell me the *main problem* and I’ll guide you.`
  },
  contact: {
    de: `📨 E-Mail: info@seelenpfote.app\n📸 Instagram: @seelenpfote.app`,
    en: `📨 Email: info@seelenpfote.app\n📸 Instagram: @seelenpfote.app`
  },
  privacy: {
    de: `🔒 Kurzfassung: Ich speichere nur, was nötig ist. Details: https://www.seelenpfote.app/#Datenschutz`,
    en: `🔒 Short version: I only store what’s necessary. Details: https://www.seelenpfote.app/#Datenschutz`
  },
  photoQs: {
    de: (name,pet)=>`Danke fürs Bild, ${name}. Magst du mir kurz sagen:\n• Seit wann?\n• Schmerzen (ja/nein)?\n• Fieber/Erbrechen?\n• Verhalten verändert?\n${pet ? `(Tier: ${pet})` : ''}`,
    en: (name,pet)=>`Thanks for the photo, ${name}. Could you tell me:\n• Since when?\n• Pain (yes/no)?\n• Fever/vomiting?\n• Behavior changed?\n${pet ? `(Pet: ${pet})` : ''}`
  },
  askProfile: {
    de: `Danke dir. Jetzt bitte *Alter, Gewicht und seit wann* (z. B. „6 Jahre, 9.5 kg, seit 1 Woche“).`,
    en: `Thank you. Now please share *age, weight, and since when* (e.g., “6 years, 9.5 kg, since 1 week”).`
  },
  summaryLead: {
    de: (name)=>`Danke, ${name}. Ich habe verstanden:`,
    en: (name)=>`Thanks, ${name}. Here’s what I understood:`
  },
  summaryBullets: {
    de: { pet:'• Tier: ', issue:'• Thema: ', since:'• Seit: ', pain:'• Schmerzen: ', fever:'• Fieber/Erbrechen: ', weight:'• Gewicht: ', age:'• Alter (ca.): ' },
    en: { pet:'• Pet: ', issue:'• Issue: ', since:'• Since: ', pain:'• Pain: ', fever:'• Fever/Vomiting: ', weight:'• Weight: ', age:'• Age (approx): ' }
  },
  summaryTail: {
    de: `\nWenn du bereit bist, schreib einfach *„erste hilfe“*, *„nächsten schritte“* oder *„was tun“* – ich führe dich liebevoll hindurch.`,
    en: `\nWhen ready, just type *“first aid”*, *“next steps”* or *“what to do”* — I’ll guide you gently.`
  },
  fallback: {
    de: (name)=>`Danke, ${name}. Wenn du magst, sag mir *Alter, Gewicht und seit wann* – oder beschreibe das *Hauptproblem* (z. B. „vergiftung“, „hitzschlag“, „humpelt“, „durchfall“).`,
    en: (name)=>`Thanks, ${name}. If you like, share *age, weight, and since when* — or describe the *main problem* (e.g., “poisoning”, “heatstroke”, “limping”, “diarrhea”).`
  }
};

// ----------------- Helper (parsing) -----------------
const weightRe = /(\d+[.,]?\d*)\s*(kg|kilo|kilogramm|kilograms?|lbs?)\b/i;
const ageRe    = /(\d+[.,]?\d*)\s*(jahr|jahre|years?|yr|yrs|yo|j)\b/i;
const sinceRe  = /(?:seit|since)\s+([^\n,.!]+)/i;

const parseWeight = (t)=>{ const m=t.match(weightRe); return m?parseFloat(m[1].replace(',','.')):undefined; };
const parseAge    = (t)=>{ const m=t.match(ageRe); if(m) return parseFloat(m[1].replace(',','.')); const m2=t.match(/(\d+[.,]?\d*)/); if(m2){const v=parseFloat(m2[1].replace(',','.')); if(v<=25) return v;} return undefined; };
const parseSince  = (t)=>{ const m=t.match(sinceRe); if(m) return (t.toLowerCase().includes('since')?'since ':'seit ') + m[1].trim(); const m2=t.match(/(\d+)\s*(tag|tage|woche|wochen|monat|monate|day|days|week|weeks|month|months)/i); return m2?`${m2[1]} ${m2[2]}`:undefined; };
const hasYes      = (t)=>/\b(ja|yes|yep|stimmt)\b/i.test(t);
const hasNo       = (t)=>/\b(nein|no|nope|nicht)\b/i.test(t);

// ----------------- Erste-Hilfe-Katalog (DE+EN) -----------------
const INTENTS = [
  // Heat / Cold / Energy
  { key:'heatstroke',
    regex:/(hitzschlag|ueberhitzt|überhitzt|too\s*hot|overheat|heatstroke|pant.*extreme)/i,
    text:{ de:`🥵 *Hitzschlag/Überhitzung*\n• Sofort Schatten/kühl, Lüften\n• Pfoten/Brust *lauwarm* befeuchten (nicht eiskalt)\n• Wasser anbieten, nicht erzwingen\n• >40°C kritisch → *sofort Tierarzt*`,
           en:`🥵 *Heatstroke/Overheating*\n• Move to shade/cool air\n• Wet paws/chest with *lukewarm* water (not ice-cold)\n• Offer water, don’t force\n• >104°F/40°C is critical → *vet immediately*`}},
  { key:'hypothermia_frost',
    regex:/(unterk[üu]hlung|frost|very\s*cold|hypotherm|shiver)/i,
    text:{ de:`🧊 *Unterkühlung/Frost*\n• Langsam aufwärmen (Decke/Körperwärme), gut trocknen\n• Keine direkte Hitze/kein heißes Wasser\n• Apathie/steifer Gang/weiße Ohr-/Schwanzspitzen → *Tierarzt*`,
           en:`🧊 *Hypothermia/Frost*\n• Warm up slowly (blanket/body heat), dry well\n• No direct heat or hot water\n• Lethargy, stiff gait, pale tips → *see a vet*`}},
  { key:'hypoglycemia',
    regex:/(unterzucker|low\s*blood\s*sugar|hypoglyc|puppy.*weak|toy\s*breed.*weak)/i,
    text:{ de:`🍬 *Unterzucker (v. a. Welpe/Minirasse)*\n• Bei Bewusstsein: etwas Honig/Glukose am Zahnfleisch (nicht erzwingen)\n• Warm halten → *Tierarzt*`,
           en:`🍬 *Hypoglycemia (esp. puppies/toy breeds)*\n• If conscious: rub a bit of honey/glucose on gums (don’t force)\n• Keep warm → *see a vet*`}},
  // Poison / Foreign body / GI
  { key:'poison',
    regex:/(vergift|giftig|köder|koeder|rattengift|schokolade|xylit|xylitol|grapes?|raisins?|antifreeze|pesticide|nikotin|nicotine|poison|toxic|ate\s*medicine|medikament.*gefressen)/i,
    text:{ de:`☠️ *Vergiftungsverdacht*\n• *Kein* Erbrechen auslösen\n• Stoff/Verpackung sichern\n• Aktivkohle nur nach Rücksprache\n• *Sofort Tierarzt/Notdienst*`,
           en:`☠️ *Suspected poisoning*\n• *Do not* induce vomiting\n• Keep product/packaging\n• Activated charcoal only after vet advice\n• *Emergency vet immediately*`}},
  { key:'foreign_body',
    regex:/(fremdkörper.*(gefressen|verschluckt)|socke|sock|stein|stone|bone\s*swallowed|toy\s*(swallowed|ingested))/i,
    text:{ de:`🧵 *Fremdkörper verschluckt*\n• Nicht füttern/tränken\n• Kein Erbrechen provozieren\n• Faden/Leine *nie* ziehen!\n• *Zeitnah Tierarzt* (Röntgen/US nötig)`,
           en:`🧵 *Foreign body swallowed*\n• No food/water\n• Do not induce vomiting\n• Never pull strings/threads!\n• *See a vet soon* (X-ray/ultrasound)`}},
  { key:'vomiting',
    regex:/(erbrechen|brechen|vomit|throwing\s*up)/i,
    text:{ de:`🤢 *Erbrechen*\n• 6–12 h Futterpause, Wasser anbieten\n• Dann kleine leicht verdauliche Portionen\n• Häufig/blutig/Fieber/Apathie/Welpe/Senior → *Tierarzt*`,
           en:`🤢 *Vomiting*\n• Withhold food 6–12 h, offer water\n• Then small bland meals\n• Frequent/bloody/fever/lethargy/puppy/senior → *vet*`}},
  { key:'diarrhea',
    regex:/(durchfall|diarrh(ea)?)/i,
    text:{ de:`🥣 *Durchfall*\n• Wasser bereitstellen, Schonkost in Miniportionen 12–24 h\n• Kein Fett/Leckerlis\n• Blutig/Fieber/Apathie/Erbrechen oder >24–48 h → *Tierarzt*`,
           en:`🥣 *Diarrhea*\n• Provide water, bland diet in small portions 12–24 h\n• No fatty food/treats\n• Bloody/fever/lethargy/vomiting or >24–48 h → *vet*`}},
  { key:'constipation',
    regex:/(verstopfung|constipat|hard\s*stool|straining\s*no\s*poop)/i,
    text:{ de:`🚽 *Verstopfung*\n• Kein hartes Drücken provozieren, keine Hausmittel\n• Wasser anbieten, sanfte Bewegung\n• Schmerz, Lethargie, Erbrechen oder >24–48 h → *Tierarzt*`,
           en:`🚽 *Constipation*\n• Don’t force bowel movements, avoid home meds\n• Offer water, gentle movement\n• Pain, lethargy, vomiting or >24–48 h → *vet*`}},
  { key:'pancreatitis',
    regex:/(pankreatitis|pancreatitis|abdominal\s*pain.*fat|after\s*fatty\s*meal|fettiges\s*futter)/i,
    text:{ de:`🔥 *Pankreatitis-Verdacht*\n• Bauchschmerz, Erbrechen, Mattigkeit nach *fettem Futter*\n• Schonkost wenig, Wasser\n• *Tierarzt* (Schmerz/Infusion möglich)`,
           en:`🔥 *Pancreatitis (suspected)*\n• Abdominal pain, vomiting, lethargy after *fatty meal*\n• Bland diet small portions, water\n• *Vet* (pain relief/fluids may be needed)`}},
  { key:'bloat_gdv',
    regex:/(aufgebl[aä]ht|bloat|gdv|distend.*abdomen|hard\s*belly|unsuccessful\s*retch)/i,
    text:{ de:`🚨 *Magendrehung (Hund) – Verdacht*\n• Aufgeblähter harter Bauch, erfolgloses Würgen, Unruhe\n• Nicht füttern/tränken → *sofort* Notdienst (zeitkritisch)`,
           en:`🚨 *Gastric dilatation/volvulus (dog) suspected*\n• Hard distended belly, unproductive retching, restlessness\n• No food/water → *emergency vet now* (time critical)`}},
  { key:'dehydration',
    regex:/(dehydriert|dehydrated|dry\s*gums|skin\s*tent|drinks?\s*little)/i,
    text:{ de:`💧 *Dehydrierung*\n• Häufig kleine Wassermengen anbieten\n• Lethargie, trockene Schleimhäute, stehende Hautfalte → *Tierarzt* (Infusion)`,
           en:`💧 *Dehydration*\n• Offer small amounts of water frequently\n• Lethargy, dry gums, skin tent → *vet* (fluids)`}},
  // Trauma / Wunden / Zähne
  { key:'wound_limp',
    regex:/(wunde|schnitt|cut|laceration|humpel|limp|lame|paw\s*(cut|injured))/i,
    text:{ de:`🩹 *Wunde/Humpeln*\n• Lauwarm spülen, *Druck* bei Blutung\n• Lecken verhindern (Body/Kragen), ruhig halten\n• Tiefe/verschmutzte Wunden → *Tierarzt*\n• Lahmheit/Schwellung >24–48 h → *Tierarzt*`,
           en:`🩹 *Wound/Limp*\n• Rinse with lukewarm water, *gentle pressure* if bleeding\n• Prevent licking (cone/shirt), rest\n• Deep/contaminated wounds → *vet*\n• Lameness/swelling >24–48 h → *vet*`}},
  { key:'bite_wound',
    regex:/(biss|bite\s*wound|dog\s*bite|cat\s*bite|fight)/i,
    text:{ de:`🦷 *Bissverletzung*\n• Kleine Löcher = tiefe Taschen möglich → Infektionsrisiko\n• Spülen (lauwarm), sauber abdecken, ruhig halten\n• *Tierarzt* (Reinigung, ggf. AB/Drainage)`,
           en:`🦷 *Bite wound*\n• Small holes can hide deep pockets → infection risk\n• Rinse lukewarm, cover cleanly, rest\n• *Vet* (cleaning, possible antibiotics/drain)`}},
  { key:'dental_fracture',
    regex:/(zahn.*abgebrochen|tooth\s*(fracture|broken))/i,
    text:{ de:`🦷 *Zahn abgebrochen*\n• Schmerz möglich; Speicheln/Blut\n• Kein hartes Futter/Kauartikel\n• *Zeitnah Tier(zahn)arzt* (Pulpa offen? Entzündungsgefahr)`,
           en:`🦷 *Tooth fracture*\n• Pain possible; drooling/blood\n• No hard food/chews\n• *See (dental) vet soon* (pulp exposure risk)`}},
  // Airways / Neuro / Electric / Drowning
  { key:'choking',
    regex:/(erstick|chok(e|ing)|object\s*stuck|würg|wuerg|keuch|breath\s*hard)/i,
    text:{ de:`🫁 *Erstickungsverdacht/Fremdkörper*\n• Sichtbar lockeres vorsichtig entfernen (nicht stechen)\n• Keine blinden Tiefgriffe\n• Kleine Hunde: 5× Rückenschläge zw. Schultern, im Wechsel mit Brustkompressionen\n• *Sofort Tierarzt* bei Atemnot`,
           en:`🫁 *Choking/foreign body*\n• Remove only *visible loose* objects (no probing)\n• No blind deep grabs\n• Small dogs: 5 firm back blows between shoulders, alternate with chest compressions\n• *Vet immediately* if breathing difficulty persists`}},
  { key:'seizure',
    regex:/(krampf|seizure|epilep)/i,
    text:{ de:`⚡ *Krampfanfall*\n• Nicht festhalten, nichts ins Maul, Umgebung sichern\n• Zeit messen (>3–5 min/Cluster = kritisch)\n• Danach ruhig, warm halten\n• *Sofort Tierarzt* bei erstem Anfall/ >3–5 min/mehreren Anfällen`,
           en:`⚡ *Seizure*\n• Don’t restrain, nothing in mouth, make area safe\n• Time it (>3–5 min/cluster = critical)\n• Afterwards keep calm and warm\n• *Emergency vet* for first seizure/>3–5 min/multiple`}},
  { key:'near_drowning',
    regex:/(beinahe.*ertrunken|near\s*drown|inhaled\s*water)/i,
    text:{ de:`🌊 *Beinahe-Ertrinken*\n• Ruhig, wärmen\n• Kopf/Brust leicht tiefer, wenn Wasser austritt\n• Anhaltende Atemnot/Husten/Blaufärbung → *sofort Tierarzt*`,
           en:`🌊 *Near drowning*\n• Keep calm and warm\n• Slightly lower head/chest if water drains\n• Ongoing breathing issues/cough/blue gums → *emergency vet*`}},
  { key:'electric_shock',
    regex:/(stromschlag|electric\s*shock|chewed\s*cable)/i,
    text:{ de:`⚡ *Stromschlag*\n• Stromquelle trennen, erst dann anfassen\n• Maulverbrennungen möglich → ruhig beobachten\n• Atemnot, Apathie, Krampf → *sofort Tierarzt*`,
           en:`⚡ *Electric shock*\n• Disconnect power before touching\n• Mouth burns possible → monitor\n• Breathing trouble, lethargy, seizures → *emergency vet*`}},
  // Urogenital / Birth
  { key:'urinary_block',
    regex:/(kater.*nicht.*urin|urinary\s*block|straining\s*no\s*urine|blocked\s*tom)/i,
    text:{ de:`🚨 *Harnröhrenverschluss (v. a. Kater)*\n• Häufiges Pressen ohne Urin, Schmerz, Lautäußerung\n• *Sofort* Notdienst – lebensbedrohlich`,
           en:`🚨 *Urethral blockage (esp. male cats)*\n• Repeated straining with little/no urine, pain, vocalizing\n• *Emergency vet now* — life-threatening`}},
  { key:'pyometra',
    regex:/(pyometra|eitergebärmutter|gebärmutterentzündung|uterus\s*infection)/i,
    text:{ de:`🚨 *Gebärmuttervereiterung*\n• Matt, Fieber, Durst, evtl. eitriger Ausfluss\n• *Sofort Tierarzt* (oft OP/Intensiv)`,
           en:`🚨 *Pyometra*\n• Lethargy, fever, thirst, possible pus discharge\n• *Emergency vet* (often surgery/IV needed)`}},
  { key:'whelping',
    regex:/(geburt|wehen|whelp(ing)?|in\s*labour|labor)/i,
    text:{ de:`👶 *Geburt/Wehen*\n• Pausen zw. Welpen bis ~2 h normal\n• Pressen >20–30 min ohne Welpe, stinkender Ausfluss, Welpe steckt → *sofort Notdienst*\n• Warm, ruhig, saubere Tücher`,
           en:`👶 *Whelping/Labour*\n• Gaps up to ~2 h between pups can be normal\n• Straining >20–30 min without pup, foul discharge, stuck pup → *emergency vet*\n• Keep warm, calm, clean towels`}},
  // Allergy / Skin / Eyes / Ears / Ticks
  { key:'allergy_anaphylaxis',
    regex:/(allerg|anaphy|swollen\s*face|gesicht\s*geschwollen|hives|quaddeln|sting.*reaction)/i,
    text:{ de:`🤧 *Allergische Reaktion*\n• Leicht: kühlen\n• Gesicht/Kehlkopf-Schwellung, Atemnot → *sofort Notdienst*\n• Keine Human-Antihistaminika ohne Rücksprache`,
           en:`🤧 *Allergic reaction*\n• Mild: cool compress\n• Facial/throat swelling, breathing trouble → *emergency vet*\n• No human antihistamines without vet advice`}},
  { key:'eye_injury',
    regex:/(auge.*verletz|eye\s*(injury|ulcer|red|discharge|foreign))/i,
    text:{ de:`👁️ *Augenproblem*\n• Nicht reiben lassen (Kragen), Licht meiden\n• Keine Salben ohne Diagnose\n• Schmerz, Eiter, Trübung, Fremdkörper → *zeitnah Tierarzt*`,
           en:`👁️ *Eye problem*\n• Prevent rubbing (cone), avoid bright light\n• No ointments without diagnosis\n• Pain, discharge, cloudiness, foreign body → *see a vet promptly*`}},
  { key:'ear_infection',
    regex:/(ohr.*entzündung|ear\s*infection|head\s*shaking|kopfschütteln|othaemat|oth[aä]matom|aural\s*hematoma)/i,
    text:{ de:`👂 *Ohrproblem*\n• Schütteln/Juckreiz, evtl. Geruch\n• Nicht tief reinigen, nichts einträufeln\n• Blutblase (Othämatom) → *Tierarzt*`,
           en:`👂 *Ear problem*\n• Head shaking/itching, possible odor\n• Don’t deep-clean or add drops\n• Aural hematoma → *vet*`}},
  { key:'tick_foxtail',
    regex:/(zecke|tick|foxtail|grassamen|grasfahne|foreign\s*body\s*(paw|nose|ear))/i,
    text:{ de:`🪲 *Zecke/Fremdkörper*\n• Zecke hautnah mit Karte/Zange *gerade* ziehen (nicht quetschen)\n• Grasfahne in Nase/Ohr/Pfote → *Tierarzt* (nicht stochern)`,
           en:`🪲 *Tick/foxtail foreign body*\n• Remove tick close to skin with tool *straight out* (don’t crush)\n• Foxtail in nose/ear/paw → *vet* (don’t probe)`}},
  // Burns / Chemicals / Blunt trauma
  { key:'burns_chemical',
    regex:/(verbrennung|burn|scald|chemical|verätzt|veraetzt|acid|alkali|laugen)/i,
    text:{ de:`🔥 *Verbrennung/Verätzung*\n• Quelle entfernen; 10–15 min *lauwarm* kühlen (nicht eiskalt)\n• Chemikalie: *lange* spülen, Handschutz\n• Keine Salben/Öle; steril abdecken\n• Je nach Ausmaß *Tierarzt*`,
           en:`🔥 *Burn/Chemical exposure*\n• Remove source; cool *lukewarm* 10–15 min (not ice)\n• Chemicals: flush thoroughly, protect your hands\n• No creams/oils; cover sterile\n• See a vet depending on severity`}},
  { key:'blunt_trauma',
    regex:/(angefahren|hit\s*by\s*car|fallen|sturz|kollision|collision|autounfall|kicked)/i,
    text:{ de:`🩺 *Stumpfes Trauma*\n• Ruhe, warm halten, Blutungen stillen\n• Versteckte Innenschäden möglich (Milz, Lunge)\n• Apathie, blasse Schleimhäute, schneller Puls, Bauchschmerz → *sofort Tierarzt*`,
           en:`🩺 *Blunt trauma*\n• Rest, keep warm, control bleeding\n• Internal injuries possible (spleen, lungs)\n• Lethargy, pale gums, fast pulse, belly pain → *emergency vet*`}},
];

const ISSUE_LABELS = {
  heatstroke:{de:'Hitzschlag/Überhitzung', en:'Heatstroke/Overheating'},
  hypothermia_frost:{de:'Unterkühlung/Frost', en:'Hypothermia/Frost'},
  hypoglycemia:{de:'Unterzucker', en:'Hypoglycemia'},
  poison:{de:'Vergiftung', en:'Poisoning'},
  foreign_body:{de:'Fremdkörper verschluckt', en:'Foreign body swallowed'},
  vomiting:{de:'Erbrechen', en:'Vomiting'},
  diarrhea:{de:'Durchfall', en:'Diarrhea'},
  constipation:{de:'Verstopfung', en:'Constipation'},
  pancreatitis:{de:'Pankreatitis-Verdacht', en:'Pancreatitis (suspected)'},
  bloat_gdv:{de:'Magendrehung (Hund)', en:'GDV (dog)'},
  dehydration:{de:'Dehydrierung', en:'Dehydration'},
  wound_limp:{de:'Wunde/Humpeln', en:'Wound/Limp'},
  bite_wound:{de:'Bissverletzung', en:'Bite wound'},
  dental_fracture:{de:'Zahn abgebrochen', en:'Tooth fracture'},
  choking:{de:'Erstickungsverdacht', en:'Choking/Foreign body'},
  seizure:{de:'Krampfanfall', en:'Seizure'},
  near_drowning:{de:'Beinahe-Ertrinken', en:'Near drowning'},
  electric_shock:{de:'Stromschlag', en:'Electric shock'},
  urinary_block:{de:'Harnröhrenverschluss (Kater)', en:'Urethral blockage (male cat)'},
  pyometra:{de:'Gebärmuttervereiterung', en:'Pyometra'},
  whelping:{de:'Geburt/Wehen', en:'Whelping/Labour'},
  allergy_anaphylaxis:{de:'Allergische Reaktion', en:'Allergic reaction'},
  eye_injury:{de:'Augenproblem', en:'Eye problem'},
  ear_infection:{de:'Ohrenproblem', en:'Ear problem'},
  tick_foxtail:{de:'Zecke/Grasfahne', en:'Tick/Foxtail'},
  burns_chemical:{de:'Verbrennung/Verätzung', en:'Burn/Chemical'},
  blunt_trauma:{de:'Stumpfes Trauma', en:'Blunt trauma'},
};

function firstAidFor(key, lang) {
  const item = INTENTS.find(i => i.key === key);
  if (!item) return null;
  return item.text[lang] || item.text.de;
}

// ----------------- Commands -----------------
bot.command('hilfe', async (ctx) => {
  const p = ensureProfile(ctx);
  setLangByContext(ctx, p, null);
  await ctx.reply(TXT.helpCmd[p.lang](p.name), { parse_mode:'Markdown' });
  setState(p,'idle');
});
bot.command('notfall', async (ctx) => {
  const p = ensureProfile(ctx);
  setLangByContext(ctx, p, null);
  await ctx.reply(TXT.sosCmd[p.lang], { parse_mode:'Markdown' });
  setState(p,'idle');
});
bot.command('kontakt', (ctx) => {
  const p = ensureProfile(ctx); setLangByContext(ctx, p, null);
  return ctx.reply(TXT.contact[p.lang]);
});
bot.command('datenschutz', (ctx) => {
  const p = ensureProfile(ctx); setLangByContext(ctx, p, null);
  return ctx.reply(TXT.privacy[p.lang]);
});
// Manual language switch: /language de  or  /language en
bot.command('language', async (ctx) => {
  const p = ensureProfile(ctx);
  const args = (ctx.message.text || '').split(/\s+/);
  const choice = (args[1] || '').toLowerCase();
  if (choice === 'de' || choice === 'en') {
    p.lang = choice;
    await ctx.reply(choice === 'de'
      ? '✅ Sprache gesetzt: Deutsch.'
      : '✅ Language set to English.'
    );
  } else {
    await ctx.reply('Use: /language de   or   /language en\nBenutze: /language de   oder   /language en');
  }
});

// ----------------- Greetings & Pet type -----------------
const greet = /^(hi|hello|hallo|hey|servus|moin|guten\s*tag|good\s*(morning|evening)|guten\s*(morgen|abend))\b/i;
bot.hears(greet, async (ctx) => {
  const p = ensureProfile(ctx);
  setLangByContext(ctx, p, ctx.message.text);
  await ctx.reply(TXT.welcome[p.lang](p.name), { parse_mode:'Markdown' });
  if (!p.pet) await ctx.reply(TXT.askPet[p.lang], { parse_mode:'Markdown' });
});

bot.hears(/^(hund|dog)$/i, async (ctx)=>{ const p=ensureProfile(ctx); setLangByContext(ctx,p,ctx.message.text); p.pet = (p.lang==='en'?'Dog':'Hund'); await ctx.reply(p.lang==='en'?'Got it: 🐶 *Dog*.':'Alles klar, ich merke mir: 🐶 *Hund*.',{parse_mode:'Markdown'});});
bot.hears(/^(katze|cat)$/i, async (ctx)=>{ const p=ensureProfile(ctx); setLangByContext(ctx,p,ctx.message.text); p.pet = (p.lang==='en'?'Cat':'Katze'); await ctx.reply(p.lang==='en'?'Got it: 🐱 *Cat*.':'Alles klar, ich merke mir: 🐱 *Katze*.',{parse_mode:'Markdown'});});

// ----------------- Foto → Details -----------------
bot.on('photo', async (ctx) => {
  const p = ensureProfile(ctx);
  setLangByContext(ctx, p, null);
  p.lastPhotoTs = Date.now();
  p.details = {};
  setState(p,'await_details');
  await ctx.reply(TXT.photoQs[p.lang](p.name, p.pet));
});

// ----------------- Text-Flow (FSM + Intents) -----------------
bot.on('text', async (ctx) => {
  const p = ensureProfile(ctx);
  const t = (ctx.message.text || '').trim();
  setLangByContext(ctx, p, t);
  console.log('📥', p.lang, p.state, '-', ctx.from?.username || ctx.from?.id, ':', t);

  // 1) Große Themen-Erkennung → sofort Erstinfo + Profil abfragen
  for (const it of INTENTS) {
    if (it.regex.test(t)) {
      p.lastIssue = it.key;
      setState(p, 'await_profile');
      await ctx.reply(firstAidFor(p.lastIssue, p.lang) + (p.lang==='en'
        ? `\nIf you can, share *age, weight, and since when* — I’ll tailor guidance.`
        : `\nWenn du magst, nenn mir noch *Alter, Gewicht und seit wann* – dann kann ich gezielter helfen.`),
        { parse_mode:'Markdown' }
      );
      return;
    }
  }

  // 2) Intent „erste hilfe / next steps / weiter / tipps / beobachtung“
  if (/(erste\s*hilfe|n[aä]chst\w*\s*schritt\w*|weiter(gehen|e|)\b|was\s*(jetzt|tun)|tipps?|anleitung|beobachtung|first\s*aid|next\s*steps|what\s*to\s*do|advice)/i.test(t)) {
    const txt = firstAidFor(p.lastIssue, p.lang);
    if (txt) {
      await ctx.reply(txt, { parse_mode:'Markdown' });
    } else {
      await ctx.reply(p.lang==='en'
        ? `Sure. Tell me briefly *what it is* (e.g., “limping”, “diarrhea”, “poisoning”, “heatstroke”).`
        : `Gern. Sag mir kurz, *worum* es geht (z. B. „humpelt“, „Durchfall“, „vergiftung“, „hitzschlag“).`
      );
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
    if (/(fieber|fever|temperatur|temperature|erbrechen|brechen|vomit)/i.test(t)) {
      p.details.feverVomiting = /kein|keine|ohne|no|none/i.test(t) ? false : true;
    }
    if (/(ruhig|apath|anders|verhält|humpel|lahm|frisst|trinkt|quiet|letharg|not\s*eating|not\s*drinking|limp|behav)/i.test(t)) {
      p.details.behavior = t;
    }
    setState(p,'await_profile');
    await ctx.reply(TXT.askProfile[p.lang]);
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
      const labelObj = ISSUE_LABELS[p.lastIssue];
      const label = labelObj ? (labelObj[p.lang] || labelObj.de) : (p.lastIssue || '—');

      const b = TXT.summaryBullets[p.lang];
      await ctx.reply(
        `${TXT.summaryLead[p.lang](p.name)}\n` +
        `${p.pet ? `${b.pet}${p.pet}\n` : ''}` +
        `${p.lastIssue ? `${b.issue}${label}\n` : ''}` +
        `${p.details.since ? `${b.since}${p.details.since}\n` : ''}` +
        `${p.details.pain !== undefined ? `${b.pain}${p.details.pain ? (p.lang==='en'?'yes':'ja') : (p.lang==='en'?'no':'nein')}\n` : ''}` +
        `${p.details.feverVomiting !== undefined ? `${b.fever}${p.details.feverVomiting ? (p.lang==='en'?'yes':'ja') : (p.lang==='en'?'no':'nein')}\n` : ''}` +
        `${p.details.weight ? `${b.weight}${p.details.weight} kg\n` : ''}` +
        `${p.details.age ? `${b.age}${p.details.age}\n` : ''}` +
        TXT.summaryTail[p.lang],
        { parse_mode:'Markdown' }
      );
      return;
    }
  }

  // 5) Letzter Fallback (ohne Loop)
  await ctx.reply(TXT.fallback[p.lang](p.name));
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











