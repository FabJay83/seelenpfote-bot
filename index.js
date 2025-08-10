// index.js — Seelenpfote Telegram-Helfer (ohne OpenAI, regelbasiert & empathisch)
// Benötigt nur: TELEGRAM_BOT_TOKEN (Railway Variables)
// Optional: ./cases.js mit zusätzlichen Cases (siehe unten)

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const TELEGRAM_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
if (!TELEGRAM_TOKEN) {
  console.error('❌ Fehlt: TELEGRAM_BOT_TOKEN (Railway → Variables)');
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
bot.deleteWebHook({ drop_pending_updates: true }).catch(() => {});

bot.getMe()
  .then(me => console.log('🤖 Eingeloggt als @' + me.username))
  .catch(err => {
    console.error('❌ Telegram-Token ungültig:', err?.message || err);
    process.exit(1);
  });

// ---------- Utils ----------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function careBlock(intro, bullets = [], outro) {
  let msg = '';
  if (intro) msg += intro + '\n\n';
  if (bullets.length) msg += bullets.map(b => '• ' + b).join('\n') + '\n\n';
  if (outro) msg += outro;
  return msg.trim();
}

function joinParts(...parts) {
  return parts.filter(Boolean).join('\n\n').trim();
}

// ---------- Built‑in Cases (fallen back, wenn keine ./cases.js vorhanden) ----------
const defaultCases = [
  {
    id: 'bleeding',
    intent: /blut|blutet|blutung|offen|wunde|schnitt/i,
    title: 'Blutung / offene Wunde',
    questions: [
      'Wo genau ist die Wunde (Pfote, Bein, Ohr, Bauch …)?',
      'Wie groß ungefähr? Blutet es stark oder sickernd?',
      'Seit wann besteht das? Humpelt/leckst dein Tier?',
    ],
    firstAid: [
      'Ruhig halten, Stress reduzieren.',
      'Klaren Druckverband anlegen (sauberes Tuch/Gaze), 10–15 Minuten sanft drücken.',
      'Wunde nicht schrubben. Nur groben Schmutz mit lauwarmem Wasser lösen.',
    ],
    vetTriggers: [
      'Starkes, pulsierendes Bluten > 10 Minuten trotz Druck.',
      'Tiefe/klappende Wunde, starker Schmerz, Fremdkörper sicht­bar.',
      'Blut aus Maul/Nase/Ohr ohne erklärbaren Grund.',
    ],
  },
  {
    id: 'limp',
    intent: /humpel|lahm|tritt nicht auf|belastet nicht|zieht bein/i,
    title: 'Humpeln / Lahmheit',
    questions: [
      'Seit wann humpelt dein Tier? Wurde es schlechter/besser?',
      'Gab es einen Sprung, Sturz oder etwas im Pfotenballen?',
      'Siehst du Schwellung, Wärme oder Schmerzreaktion beim Abtasten?',
    ],
    firstAid: [
      'Kurzfristig Ruhe, keine Sprünge/Treppen.',
      'Pfote sichten: Fremdkörper, Riss, eingerissene Kralle?',
      'Kühlen (in Tuch gewickeltes Coolpack) 5–10 Minuten, 2–3×/Tag, wenn geschwollen.',
    ],
    vetTriggers: [
      'Starke Schmerzen, Jaulen, anhaltende Lahmheit > 24–48 h.',
      'Offene Wunde, deformiertes Gelenk, nicht belastbar.',
    ],
  },
  {
    id: 'vomit_diarrhea',
    intent: /erbrech|kotz|bricht|durchfall|dünn/i,
    title: 'Erbrechen / Durchfall',
    questions: [
      'Seit wann? Wie oft in den letzten 12 h?',
      'Ist Blut dabei (rot oder kaffeebraun)?',
      'Trinkt und frisst dein Tier? Wirkt es munter oder schlapp?',
    ],
    firstAid: [
      '6–8 h Futterpause (Wasser anbieten).',
      'Danach Schonkost: z. B. gekochter Reis + Huhn (ohne Haut, ungewürzt).',
      'Kleine Portionen, beobachten. Elektrolytlösung bei Bedarf (tiergeeignet).',
    ],
    vetTriggers: [
      'Blut im Erbrochenen/Stuhl, starke Mattigkeit, Fieber.',
      'Sehr häufiges Erbrechen, kein Wasser bleibt drin.',
      'Welpe/Kitten/alte Tiere → früh abklären.',
    ],
  },
  {
    id: 'eye',
    intent: /auge|augen|bindehaut|eitrig|verkleb|blinzeln|lichtempfindlich/i,
    title: 'Auge / Reizung',
    questions: [
      'Ein Auge oder beide? Seit wann?',
      'Eitrig/gelblich/grünlich? Tränend? Lichtempfindlich?',
      'Fremdkörper/Gras oder Kratzer erkennbar?',
    ],
    firstAid: [
      'Nicht reiben. Sanft mit steriler Kochsalzlösung spülen (Zimmertemperatur).',
      'Licht meiden, Ruhe geben.',
    ],
    vetTriggers: [
      'Starke Schmerzen, Auge nicht zu öffnen, plötzliche Trübung.',
      'Verletzung/Kratzspur auf der Hornhaut.',
    ],
  },
  {
    id: 'heat',
    intent: /hitze|überhitzt|heiss|wärme|zunge hängt|hechelt stark/i,
    title: 'Hitzestress / Überhitzung',
    questions: [
      'Wie warm ist es? War dein Tier in der Sonne/Auto?',
      'Hechelt es stark, wirkt es desorientiert?',
    ],
    firstAid: [
      'Sofort in kühle, schattige Umgebung.',
      'Langsam (!) kühlen: feuchte Tücher, Pfoten befeuchten. Kein eiskaltes Wasser.',
      'Kleine Mengen Wasser anbieten.',
    ],
    vetTriggers: [
      'Taumeln, Erbrechen, Durchfall, Krämpfe.',
      'Keine Besserung innerhalb 10–15 Minuten.',
    ],
  },
  {
    id: 'sting_tick',
    intent: /stich|wespe|biene|insektenstich|zecke|zecken/i,
    title: 'Insektenstich / Zecke',
    questions: [
      'Wo ist die Stelle? Schwellung sichtbar?',
      'Atemnot, geschwollene Schnauze/Lippen?',
    ],
    firstAid: [
      'Stachel (falls sichtbar) vorsichtig entfernen, nicht ausdrücken.',
      'Kühlen (Tuch + Coolpack) 5–10 Minuten.',
      'Zecke mit Zeckenkarte drehen/ziehen; Stelle desinfizieren.',
    ],
    vetTriggers: [
      'Atemnot, starke Gesichts‑/Kehlkopfschwellung (Allergieschock).',
      'Zecke sitzt an Auge/Ohrenkanal und lässt sich nicht sicher entfernen.',
    ],
  },
  {
    id: 'itch_allergy',
    intent: /juck|kratzt|leckt|allerg|hotspot|ausschlag|rötung/i,
    title: 'Juckreiz / Hautreizung',
    questions: [
      'Seit wann? Saisonbedingt? Neues Futter/Waschmittel?',
      'Wo genau juckt es? Offene Stellen/„Hotspots“?',
    ],
    firstAid: [
      'Bereich trocken halten, Lecken verhindern (Body/Trichter falls vorhanden).',
      'Kurzes, kühles Abspülen bei Reizung; sanft trockentupfen.',
    ],
    vetTriggers: [
      'Rasch größer werdende nässende Stellen.',
      'Starker Juckreiz, Schmerzen, Apathie.',
    ],
  },
  {
    id: 'poison',
    intent: /gift|vergift|köder|schnecken|frostschutz|ratten|xylit|medikament/i,
    title: 'Vergiftungsverdacht',
    questions: [
      'Was wurde aufgenommen (so genau wie möglich)? Wann ungefähr?',
      'Erbrechen, Zittern, Speicheln, Taumeln?',
    ],
    firstAid: [
      'Nichts erzwingen (kein Erbrechen auslösen!).',
      'Reste/Foto/Verpackung sichern für den Tierarzt.',
    ],
    vetTriggers: [
      'Immer zügig Tierarzt/Notdienst kontaktieren.',
    ],
  },
  {
    id: 'seizure',
    intent: /krampf|epilep|zuckt|anfälle/i,
    title: 'Krampfgeschehen',
    questions: [
      'Wie lange dauert/dauerte es? Wie oft bisher?',
      'Ist dein Tier ansprechbar zwischen den Anfällen?',
    ],
    firstAid: [
      'Gefahren entfernen (Ecken, Treppen), Ruhe, abdunkeln.',
      'Nicht festhalten, nichts ins Maul stecken.',
      'Zeit stoppen, Video falls möglich.',
    ],
    vetTriggers: [
      'Anfall > 3–5 Minuten, mehrere kurz hintereinander.',
      'Erstmals aufgetretene Krämpfe.',
    ],
  },
  {
    id: 'not_eating',
    intent: /frisst nicht|isst nicht|verweigert futter|kein appetit/i,
    title: 'Frisst nicht',
    questions: [
      'Seit wann? Trinkt es? Erbrechen/Durchfall dabei?',
      'Zahnfleisch, Maulgeruch, Schmerz am Maul bemerkbar?',
    ],
    firstAid: [
      'Wasser anbieten, ruhige Umgebung.',
      'Leicht verdauliches Futter versuchsweise (falls kein Erbrechen).',
    ],
    vetTriggers: [
      'Komplette Futterverweigerung > 24 h (Katze: eher früher).',
      'Apathie, Fieber, schnelle Verschlechterung.',
    ],
  },
  {
    id: 'lethargy',
    intent: /müde|schlapp|apath|kraftlos|liegt nur/i,
    title: 'Apathie / Schlappheit',
    questions: [
      'Seit wann? Gab es kürzlich Stress/Hitze/Infekt?',
      'Trinkt/frisst es normal? Fieber gemessen?',
    ],
    firstAid: [
      'Ruhig halten, Wasser anbieten, Temperatur prüfen (wenn möglich).',
    ],
    vetTriggers: [
      'Anhaltende Apathie, Fieber, blasse Schleimhäute.',
    ],
  },
];

// Versuche optionale externe Cases zu laden
let extraCases = [];
try {
  extraCases = require('./cases.js'); // erwartet Array gleiches Schema
  if (!Array.isArray(extraCases)) extraCases = [];
} catch (_) {
  extraCases = [];
}
const ALL_CASES = [...extraCases, ...defaultCases];

// ---------- Core: Intent Matching ----------
function matchCases(text) {
  const t = (text || '').toString();
  return ALL_CASES.filter(c => c.intent.test(t));
}

function buildResponse(matched, userText) {
  if (!matched.length) {
    // Fallback freundlich + Fragen
    return careBlock(
      'Ich bin da für dich 🐾💛 Danke fürs Beschreiben. Damit ich dir gezielt helfen kann:',
      [
        'Wo genau ist die Stelle? (Pfote, Bein, Auge, Bauch …)',
        'Seit wann besteht das? Wird es besser oder schlimmer?',
        'Gibt es Blut, Schwellung, Geruch oder Sekret?',
      ],
      'Wenn du magst, schreib mir 1–2 Antworten – ich leite dich Schritt für Schritt an.'
    );
  }

  // Nimm den besten Match (erster Treffer) und zeige strukturiert an
  const c = matched[0];
  const head = `🩺 ${c.title}`;
  const ask = careBlock('Kurze Fragen an dich:', c.questions || []);
  const aid = careBlock('Erste Hilfe (sofort):', c.firstAid || []);
  const vet = (c.vetTriggers?.length)
    ? careBlock('Bitte zum Tierarzt, wenn:', c.vetTriggers)
    : '';

  const outro = 'Du machst das gut 💪 Ich bleibe hier und begleite dich Schritt für Schritt.';
  return joinParts(head, ask, aid, vet, outro);
}

// ---------- Handlers ----------
bot.onText(/^\/start\b/i, async (msg) => {
  const chatId = msg.chat.id;
  const text =
    'Willkommen 💛\n' +
    'Erzähl mir, was bei deinem Tier los ist – ich höre zu und helfe dir Schritt für Schritt. ' +
    'Beschreibe bitte so genau wie möglich, was du beobachtest. 🐕🐈';
  await bot.sendMessage(chatId, text);
});

bot.onText(/^\/help\b/i, async (msg) => {
  const chatId = msg.chat.id;
  const text = careBlock(
    'So kann ich dir helfen:',
    [
      'Schreib frei in deinen Worten, was du beobachtest.',
      'Ich erkenne wichtige Hinweise (z. B. Wunde, Humpeln, Erbrechen …).',
      'Ich antworte einfühlsam, stelle gezielte Fragen und gebe Erste‑Hilfe‑Tipps.',
    ],
    'Hinweis: Ich ersetze keinen Tierarzt. Bei starken Schmerzen, Atemnot oder Blutungen bitte sofort den Notdienst anrufen.'
  );
  await bot.sendMessage(chatId, text);
});

bot.onText(/^\/panic\b/i, async (msg) => {
  const chatId = msg.chat.id;
  const text = careBlock(
    'Wenn es sich akut gefährlich anfühlt:',
    [
      'Atemnot, starke Blutung, Krampf > 3–5 Minuten, Bewusstlosigkeit → sofort Notdienst anrufen.',
      'Halte dein Tier warm/komfortabel und entferne Gefahrenquellen.',
      'Wenn möglich: kurze Notizen/Foto für den Tierarzt (ohne Risiko).',
    ],
    'Ich bleibe bei dir, atme ruhig – du machst das richtig, Hilfe ist unterwegs. ❤️'
  );
  await bot.sendMessage(chatId, text);
});

// Haupttext-Flow
bot.on('text', async (msg) => {
  if (/^\/(start|help|panic)\b/i.test(msg.text)) return;

  const chatId = msg.chat.id;
  const userText = msg.text || '';

  try {
    await bot.sendChatAction(chatId, 'typing');
    await sleep(300); // mini Delay für „natürlicheres“ Gefühl

    const matches = matchCases(userText);
    const reply = buildResponse(matches, userText);

    await bot.sendMessage(chatId, reply);
  } catch (err) {
    console.error('❌ Text-Flow Fehler:', err?.message || err);
    await bot.sendMessage(chatId, '⚠️ Etwas ist schiefgelaufen – versuch es bitte nochmal.');
  }
});

// Fotos derzeit bewusst ignorieren (kein OpenAI)
bot.on('message', async (msg) => {
  // Falls Fotos geschickt werden, geben wir höfliches Feedback
  if (Array.isArray(msg.photo) && msg.photo.length) {
    const chatId = msg.chat.id;
    await bot.sendMessage(
      chatId,
      'Danke fürs Foto 🙏 Aktuell kann ich Bilder noch nicht automatisch auswerten. ' +
      'Beschreibe bitte kurz in 1–2 Sätzen, was du darauf zeigen wolltest – dann helfe ich dir Schritt für Schritt. 💛'
    ).catch(() => {});
  }
});

console.log('✅ Bot läuft – regelbasiert & empathisch (ohne OpenAI)');




















