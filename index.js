// index.js — Seelenpfote (Empathie + Notfall-Priorität + Bildanalyse + Mini-Memory)
// Requires: telegraf, dotenv, openai  |  Node >=18

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const BOT_NAME = process.env.BOT_NAME || 'Seelenpfote';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
let Telegraf; try { ({ Telegraf } = require('telegraf')); } catch {}
const USE_TELEGRAM = !!TOKEN;

// ---- OpenAI (Vision) ----
let OpenAI, openai;
try {
  OpenAI = require('openai');
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
} catch (e) {
  console.warn('[INIT] openai SDK not installed; image analysis disabled.');
}

// ---- Cases extern laden (deine 18 Fälle) ----
// Wenn du noch keine cases.js hast, kannst du diesen require vorerst auskommentieren.
// Empfohlen: auslagern, damit du neue Fälle leicht ergänzen kannst.
let CASES = [];
try { CASES = require('./cases.js'); } catch { console.warn('[INIT] cases.js nicht gefunden – nur Bildanalyse & Smalltalk aktiv.'); }

/* ---------- Helpers ---------- */
const now = () => Date.now();
const norm = s => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const rotate = (arr, ref) => arr[(ref.value++ % arr.length + arr.length) % arr.length];

function detectLang(raw) {
  const text = (raw || '').toLowerCase();
  if (!text.trim()) return 'de';
  if (/[äöüß]/.test(text)) return 'de';
  const de = [/\b(und|oder|nicht|auch|ein(e|en|er)?|der|die|das|mit|ohne|bitte|danke|hilfe|warum|wieso|wie|was|wann|wo|welch\w*|mein|dein|sein|ihr|zum|zur|im|am|vom|beim)\b/, /(ung|keit|chen|lich|isch)\b/].some(r=>r.test(text));
  if (de) return 'de';
  const en = [/\b(the|and|or|not|with|without|please|thanks|help|why|how|what|when|where|which|who|i|you|he|she|we|they|my|your|his|her|their)\b/, /(ing|ed|ly)\b/].some(r=>r.test(text));
  if (en) return 'en';
  const asciiRatio = (text.replace(/[^\x00-\x7F]/g,'').length)/text.length;
  return asciiRatio > 0.9 ? 'en' : 'de';
}

/* ---------- Session ---------- */
const sessions = new Map();
function getSession(id='cli') {
  if (!sessions.has(id)) {
    sessions.set(id, {
      lang: 'de',
      lastUser: '', lastUserAt: 0, lastBot: '', idx:{value:0},
      state:{name:null, step:0, data:{}, lastPhotoAt:0, lastPhotoUrl:null},
      pet:null
    });
  }
  return sessions.get(id);
}

/* ---------- Texte ---------- */
const TXT = {
  de: {
    hello: (n) => `🐾 Willkommen bei ${n}.
Ich bin da, um dir in unsicheren Momenten ruhig und liebevoll zu helfen.
Erzähl mir kurz, was los ist – z. B. „Durchfall“, „erbricht“, „humpelt“, „Pfote entzündet“, „Blutung“, „Hitzschlag“, „Vergiftung“, „Krampf“… 
Ich gebe dir eine klare Ersteinschätzung und sanfte nächste Schritte. (/help)`,
    help: `So nutzt du mich:
• Beschreibe in 1–2 Sätzen, was du beobachtest (gern mit Foto).
• Ich antworte ruhig, strukturiert und sage dir, was jetzt wichtig ist.
Befehle:
/start – Begrüßung
/help – Hilfe
/reset – Verlauf löschen
/langde – Deutsch
/langen – Englisch
/langauto – Auto‑Sprache`,
    askPhoto: `Bitte ein **klares Foto** senden (ggf. mehrere Perspektiven). Danach „Foto gesendet“ schreiben.`,
    photoReceived: `Foto erhalten, danke! Wenn etwas fehlt, beschreibe es kurz.`,
    acks: ["Alles klar.", "Verstanden.", "Okay."],
    tails: ["Wie kann ich weiter helfen?", "Magst du 1–2 Details ergänzen?", "Was ist das Wichtigste?"],
    dup: ["Das habe ich gerade beantwortet.", "Gleiche Eingabe erkannt.", "Wir hatten das eben schon."],
    reset: "Verlauf gelöscht. Erzähl mir, was los ist.",
    bye: "Bis bald!"
  },
  en: {
    hello: (n) => `👋 Welcome to ${n}.
I’m here to support you calmly and kindly when things feel uncertain.
Tell me briefly what’s happening — e.g., “diarrhea”, “vomiting”, “limping”, “bleeding”, “heatstroke”, “poisoning”, “seizure”… 
I’ll give you a clear first assessment and gentle next steps. (/help)`,
    help: `How to use me:
• Describe what you see in 1–2 sentences (photo welcome).
• I’ll respond calmly, structured, and highlight what matters now.
Commands:
/start – greeting
/help – help
/reset – clear
/langde – German
/langen – English
/langauto – auto language`,
    askPhoto: `Please send a **clear photo** (multiple angles). Then type “photo sent”.`,
    photoReceived: `Photo received, thank you! Add a short note if needed.`,
    acks: ["Got it.", "Understood.", "Okay."],
    tails: ["How can I help further?", "Add 1–2 details.", "What’s the key issue?"],
    dup: ["I just answered that.", "Same input detected.", "We just covered that."],
    reset: "Session cleared. Tell me what’s happening.",
    bye: "See you!"
  }
};

/* ---------- Empathie-Baukasten ---------- */
const CARE = {
  de: {
    open: [
      "Das klingt belastend, ich bin gerade bei dir.",
      "Danke, dass du mir das anvertraust.",
      "Ich verstehe gut, dass dich das beunruhigt."
    ],
    openEmergency: [
      "Ich bin bei dir – wir machen das jetzt Schritt für Schritt.",
      "Atme einmal ruhig durch, ich leite dich jetzt an."
    ],
    reassure: [
      "Du machst das gut.",
      "Wir gehen das gemeinsam an.",
      "Ich achte darauf, dass nichts Wichtiges fehlt."
    ],
    close: [
      "Wenn etwas unklar ist, frag mich jederzeit.",
      "Ein Foto hilft oft – wenn du magst.",
      "Ich bleibe hier – gib mir gern ein kurzes Update."
    ]
  },
  en: {
    open: [
      "That sounds worrying — I’m right here with you.",
      "Thanks for telling me.",
      "I understand why you’re concerned."
    ],
    openEmergency: [
      "I’m with you — we’ll take this step by step.",
      "Take a breath — I’ll guide you now."
    ],
    reassure: [
      "You’re doing the right thing.",
      "We’ll handle this together.",
      "I’ll make sure nothing important is missed."
    ],
    close: [
      "Ask me anything if unclear.",
      "A photo can help if you have one.",
      "I’m here — keep me posted."
    ]
  }
};

function maybeCapturePet(s, text) {
  const mDog = text.match(/\bmein(?:e|em|en)?\s+(hund|rüde|hündin)\s+([A-ZÄÖÜ][a-zäöüß]+)\b/);
  const mCat = text.match(/\bmein(?:e|em|en)?\s+(kater|katze)\s+([A-ZÄÖÜ][a-zäöüß]+)\b/);
  if (mDog) s.pet = { species: 'Hund', name: mDog[2] };
  if (mCat) s.pet = { species: 'Katze', name: mCat[2] };
}

function careWrap(body, s, mood = 'neutral') {
  const lang = s.lang || 'de';
  const tone = CARE[lang] || CARE.de;
  if (/^Befehle:|^Commands:|^🐾|^👋|^⚠️/.test(body)) return body; // Systemtexte nicht doppelt
  const opener = (mood === 'emergency')
    ? tone.openEmergency[Math.floor(Math.random() * tone.openEmergency.length)]
    : tone.open[Math.floor(Math.random() * tone.open.length)];
  const reassurance = tone.reassure[Math.floor(Math.random() * tone.reassure.length)];
  const closing = tone.close[Math.floor(Math.random() * tone.close.length)];
  const petName = s.pet?.name ? ` – ${s.pet.name}` : '';
  return `${opener}${petName ? `,` : ''}\n\n${body}\n\n_${reassurance}_  •  ${closing}`;
}

/* ---------- Router & Utilities ---------- */
function findCase(text, lang) { for (const c of CASES) if (c.match && c.match(text, lang)) return c; return null; }
function findEmergencyCase(text, lang) { for (const c of CASES) if (c.emergency && c.match(text, lang)) return c; return null; }

function antiRepeat(out, s) {
  const outNorm = norm(out);
  if (outNorm === s.lastBot) {
    const extra = (s.lang === 'en') ? "Anything else?" : "Noch etwas?";
    if (norm(out + "\n" + extra) !== s.lastBot) return out + "\n" + extra;
    return out + " …";
  }
  return out;
}

/* ---------- Mini-Memory (JSON) ---------- */
const MEM_PATH = path.join(process.cwd(), 'memory.json');
function saveMemory(entry) {
  try {
    let arr = [];
    if (fs.existsSync(MEM_PATH)) {
      arr = JSON.parse(fs.readFileSync(MEM_PATH, 'utf-8') || '[]');
    }
    arr.push(entry);
    fs.writeFileSync(MEM_PATH, JSON.stringify(arr.slice(-500), null, 2)); // Deckel bei 500 Einträgen
  } catch (e) {
    console.warn('[MEM] could not write memory.json', e.message);
  }
}

/* ---------- Bildanalyse mit OpenAI ---------- */
async function analyzeImage(url, lang='de') {
  if (!openai) {
    return (lang==='en')
      ? "I can’t analyze images right now. Please describe what you see (size, color, swelling, discharge, pain)."
      : "Ich kann Bilder gerade nicht automatisch auswerten. Beschreibe bitte kurz: Größe, Rötung/Schwellung, nässend/trocken, Eiter/Blut, Schmerz/Belastung.";
  }

  const sys_de = `Du bist ein tiermedizinischer Triage-Assistent (Hund/Katze). Du siehst 1 Foto. 
Antworte kurz, strukturiert und risiko-orientiert: 
1) Mögliche Befunde (max 3 Bulletpoints)
2) Nächste Schritte (konkret, 3–5 Punkte, Hausmittel nur sichere Basics)
3) Warnzeichen → Tierarzt/Notdienst (knapp)
Keine Ferndiagnosen, keine Medikamente.`;
  const sys_en = `You are a veterinary triage assistant (dogs/cats). You see one photo. 
Respond briefly, structured and risk-aware:
1) Likely findings (max 3 bullets)
2) Next steps (3–5 concrete items, only safe home measures)
3) Red flags → vet/ER (short)
No firm diagnoses, no drugs.`;

  const prompt = (lang==='en')
    ? "Analyze this pet photo for triage."
    : "Bitte analysiere dieses Tierfoto für eine vorsichtige Ersteinschätzung.";

  const system = (lang==='en') ? sys_en : sys_de;

  const res = await openai.chat.completions.create({
    model: process.env.VISION_MODEL || 'gpt-4o-mini',
    temperature: 0.3,
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url } }
        ]
      }
    ]
  });
  const out = res.choices?.[0]?.message?.content?.trim() || '';
  return out || ((lang==='en') ? "No analysis returned." : "Keine Auswertung erhalten.");
}

/* ---------- Reply Core (mit Empathie & Notfall-Priorität + Foto-Frage-Handling) ---------- */
function replyFor(text, s) {
  if (s.lang === null) s.lang = detectLang(text);
  const L = TXT[s.lang || 'de'];
  const n = norm(text);
  const tNow = now();

  maybeCapturePet(s, text);

  // Commands
  if (n === '/start') { s.state = { name: null, step: 0, data: {}, lastPhotoAt:0, lastPhotoUrl:null }; return L.hello(BOT_NAME); }
  if (n === '/help')  return L.help;
  if (n === '/reset') { s.state = { name: null, step: 0, data: {}, lastPhotoAt:0, lastPhotoUrl:null }; s.lastUser=''; s.lastBot=''; return L.reset; }
  if (n === '/langde')   { s.lang = 'de'; return "Alles klar, ich antworte auf Deutsch."; }
  if (n === '/langen')   { s.lang = 'en'; return "Got it, I’ll reply in English."; }
  if (n === '/langauto') { s.lang = null; return (detectLang(text)==='en' ? "Auto language enabled." : "Automatische Sprache aktiviert."); }

  // Anti-duplicate (10s)
  if (n && n === s.lastUser && (tNow - s.lastUserAt < 10000)) {
    return careWrap(rotate(TXT[s.lang || 'de'].dup, s.idx), s);
  }

  // 🆕 Nutzer fragt direkt nach Foto-Auswertung
  const askedPhotoView = /\b(was\s+siehst\s+du\s+auf\s+dem\s+bild|was\s+siehst\s+du\s+am\s+foto|what\s+do\s+you\s+see\s+in\s+the\s+photo)\b/i.test(n);
  if (askedPhotoView && s.state.lastPhotoUrl && (now() - s.state.lastPhotoAt < 5*60*1000)) {
    // Wir triggern aktiv die Vision-Analyse aus dem letzten Foto
    s.state.forceAnalyze = true; // Marker für onPhoto-Flow (falls nötig)
    const lang = s.lang || 'de';
    return careWrap((lang==='en'
      ? "Give me a second — I’ll analyze your last photo now. If you have details (size, swelling, discharge), tell me too."
      : "Gib mir einen Moment – ich werte dein letztes Foto jetzt aus. Wenn du Details hast (Größe, Schwellung, nässend), schreib sie gern dazu."), s, 'followup');
  }

  // 1) Notfall hat immer Vorrang (unterbricht aktive Fälle)
  const emerg = findEmergencyCase(text, s.lang || 'de');
  if (emerg) {
    s.state = { name: null, step: 0, data: {}, lastPhotoAt: s.state.lastPhotoAt, lastPhotoUrl: s.state.lastPhotoUrl };
    const body = emerg.start(text, s, L);
    return careWrap(body, s, 'emergency');
  }

  // 2) Laufenden Case fortsetzen (keine neue Erkennung!)
  if (s.state.name) {
    const active = CASES.find(c => c.id === s.state.name);
    if (active) {
      const body = active.step(text, s, L);
      return careWrap(body, s, 'followup');
    }
    s.state = { name: null, step: 0, data: {}, lastPhotoAt: s.state.lastPhotoAt, lastPhotoUrl: s.state.lastPhotoUrl };
  }

  // 3) Neuen Case starten (falls vorhanden)
  const match = findCase(text, s.lang || 'de');
  if (match) {
    s.state = { name: match.id, step: 0, data: {}, lastPhotoAt: s.state.lastPhotoAt, lastPhotoUrl: s.state.lastPhotoUrl };
    const body = match.start(text, s, L);
    return careWrap(body, s, 'concern');
  }

  // 4) Fallback
  return careWrap(`${rotate(L.acks, s.idx)} ${rotate(L.tails, s.idx)}`, s);
}

/* ---------- Foto-Handling (mit Vision & Memory) ---------- */
async function onPhoto(ctx, s) {
  const L = TXT[s.lang || 'de'];

  try {
    // 1) Bestes Foto holen
    const photos = ctx.message.photo || [];
    if (!photos.length) return careWrap(L.photoReceived, s, 'followup');
    const best = photos[photos.length - 1]; // höchstauflösend
    const fileId = best.file_id;

    // 2) Telegram-File-Link erzeugen
    const link = await ctx.telegram.getFileLink(fileId);
    const imageUrl = String(link);
    s.state.lastPhotoAt = now();
    s.state.lastPhotoUrl = imageUrl;
    s.state.data = s.state.data || {};
    s.state.data.photos = (s.state.data.photos || 0) + 1;

    // 3) Bildanalyse (falls API-Key vorhanden)
    let analysis = null;
    if (openai && process.env.OPENAI_API_KEY) {
      // kurze Info zeigen
      try { await ctx.sendChatAction('typing'); } catch {}
      analysis = await analyzeImage(imageUrl, s.lang || 'de');
    }

    // 4) Antwort bauen
    let body;
    if (analysis) {
      body = analysis;
      // mini learning-note
      saveMemory({
        ts: new Date().toISOString(),
        chat: String(ctx.chat?.id || ''),
        lang: s.lang || 'de',
        imageUrl,
        analysis
      });
    } else {
      body =
`Foto erhalten, danke! Damit ich es gut einschätzen kann:
• Wo genau ist die Stelle? (Pfote/Bein/Auge/Ohren/Bauch …)
• Größe ca. in cm, rot/geschwollen/eitrig/feucht/trocken?
• Belastet/kratzt/leckt er daran? Geruch?

Schreib mir 1–2 Punkte, ich leite dich konkret an.`;
    }

    return careWrap(body, s, analysis ? 'concern' : 'followup');

  } catch (err) {
    console.error('[PHOTO]', err);
    return careWrap(L.photoReceived, s, 'followup');
  }
}

/* ---------- Telegram ---------- */
async function startTelegram() {
  if (!Telegraf) throw new Error('telegraf not installed');
  const bot = new Telegraf(TOKEN);

  bot.on('text', async (ctx) => {
    const id = String(ctx.chat.id);
    const s = getSession(id);
    const msg = ctx.message.text || '';
    if (s.lang === null) s.lang = detectLang(msg);

    try { await ctx.sendChatAction('typing'); } catch {}

    let out = replyFor(msg, s);
    out = antiRepeat(out, s);

    s.lastUser   = norm(msg);
    s.lastUserAt = now();
    s.lastBot    = norm(out);

    ctx.reply(out).catch(err => console.error('[TELEGRAM send error]', err));
  });

  bot.on('photo', async (ctx) => {
    const id = String(ctx.chat.id);
    const s = getSession(id);
    try { await ctx.sendChatAction('typing'); } catch {}
    const out = await onPhoto(ctx, s);
    s.lastBot = norm(out);
    ctx.reply(out).catch(err => console.error('[TELEGRAM send error]', err));
  });

  await bot.launch();
  console.log(`[${BOT_NAME}] Telegram-Bot läuft.`);
  process.once('SIGINT', () => { bot.stop('SIGINT'); process.exit(0); });
  process.once('SIGTERM', () => { bot.stop('SIGTERM'); process.exit(0); });
}

/* ---------- CLI (Fallback) ---------- */
function startCLI() {
  const id = 'cli';
  const s = getSession(id);
  const rl = require('readline').createInterface({
    input: process.stdin, output: process.stdout, prompt: `${BOT_NAME}> `
  });

  console.log(`${BOT_NAME} – CLI. Tippe /help.`);
  rl.prompt();

  rl.on('line', async (line) => {
    const msg = line || '';
    if (s.lang === null) s.lang = detectLang(msg);
    let out = replyFor(msg, s);
    out = antiRepeat(out, s);
    s.lastUser   = norm(msg);
    s.lastUserAt = now();
    s.lastBot    = norm(out);
    console.log(out);
    rl.prompt();
  });

  rl.on('close', () => {
    console.log((s.lang === 'en') ? TXT.en.bye : TXT.de.bye);
    process.exit(0);
  });
}

/* ---------- Start ---------- */
(async () => {
  try {
    if (USE_TELEGRAM) await startTelegram();
    else startCLI();
  } catch (e) {
    console.error('[FATAL]', e);
    process.exit(1);
  }
})();








