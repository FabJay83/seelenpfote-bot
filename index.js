// index.js — Seelenpfote (mit externer cases.js), stabil & kurz
require('dotenv').config();

const BOT_NAME = process.env.BOT_NAME || 'Seelenpfote';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
let Telegraf; try { ({ Telegraf } = require('telegraf')); } catch {}
const USE_TELEGRAM = !!TOKEN;

/* ---------- Helpers ---------- */
const now  = () => Date.now();
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
  const ascii = text.replace(/[^\x00-\x7F]/g,'').length / text.length;
  return ascii > 0.9 ? 'en' : 'de';
}

/* ---------- Sessions ---------- */
const sessions = new Map();
function getSession(id='cli') {
  if (!sessions.has(id)) {
    sessions.set(id, {
      lang: 'de',
      lastUser: '', lastUserAt: 0, lastBot: '',
      idx: { value: 0 },
      state: { name: null, step: 0, data: {} }
    });
  }
  return sessions.get(id);
}

/* ---------- Texte ---------- */
const TXT = {
  de: {
    hello: n => `👋 Willkommen bei ${n}!\nSag mir kurz, was los ist: „Durchfall“, „erbricht“, „humpelt“, „Pfote entzündet“, „Blutung“, „Zecke“, „Ohr/Auge“, „Husten“, „Appetitlosigkeit“, „Harn“, „Verstopfung“, „Zahn/Bruch“, „Hitzschlag“, „Vergiftung“, „Krampf“, „aufgeblähter Bauch“… (/help)`,
    help: `Befehle:\n/start – Begrüßung\n/help – Hilfe\n/reset – Verlauf löschen\n/langde – Deutsch\n/langen – Englisch\n/langauto – Auto‑Sprache`,
    askPhoto: `Bitte ein **klares Foto** senden. Danach „Foto gesendet“ schreiben.`,
    photoReceived: `Foto erhalten, danke!`,
    acks: ["Alles klar.","Verstanden.","Okay."],
    tails: ["Wie kann ich weiter helfen?","Magst du 1–2 Details ergänzen?","Was ist das Wichtigste?"],
    dup: ["Das habe ich gerade beantwortet.","Gleiche Eingabe erkannt.","Wir hatten das eben schon."],
    reset: "Verlauf gelöscht. Erzähl mir, was los ist.",
    bye: "Bis bald!"
  },
  en: {
    hello: n => `👋 Welcome to ${n}!\nTell me what’s up: “diarrhea”, “vomiting”, “limping”, “inflamed paw”, “bleeding”, “tick”, “ear/eye”, “cough”, “no appetite”, “urine”, “constipation”, “tooth/fracture”, “heatstroke”, “poisoning”, “seizure”, “bloat”… (/help)`,
    help: `Commands:\n/start – greeting\n/help – help\n/reset – clear\n/langde – German\n/langen – English\n/langauto – auto language`,
    askPhoto: `Please send a **clear photo**. Then type “photo sent”.`,
    photoReceived: `Photo received, thanks!`,
    acks: ["Got it.","Understood.","Okay."],
    tails: ["How can I help further?","Add 1–2 details.","What’s the key issue?"],
    dup: ["I just answered that.","Same input detected.","We just covered that."],
    reset: "Session cleared. Tell me what’s happening.",
    bye: "See you!"
  }
};

/* ---------- Fälle laden ---------- */
const CASES = require('./cases.js');
const getCaseById = id => (CASES || []).find(c => c.id === id);
function findCase(text, lang) { for (const c of CASES) if (c.match(text, lang)) return c; return null; }

/* ---------- Anti‑Repeat ---------- */
function antiRepeat(out, s) {
  const outNorm = norm(out);
  if (outNorm === s.lastBot) {
    const extra = (s.lang === 'en') ? "Anything else?" : "Noch etwas?";
    if (norm(out + "\n" + extra) !== s.lastBot) return out + "\n" + extra;
    return out + " …";
  }
  return out;
}

/* ---------- Router (Fix: aktiven Fall zuerst fortsetzen; Notfälle haben Vorrang) ---------- */
function replyFor(text, s) {
  if (s.lang === null) s.lang = detectLang(text);
  const L = TXT[s.lang || 'de'];
  const n = norm(text);
  const tNow = now();

  // Commands
  if (n === '/start') { s.state = { name:null, step:0, data:{} }; return L.hello(BOT_NAME); }
  if (n === '/help')  return L.help;
  if (n === '/reset') { s.state = { name:null, step:0, data:{} }; s.lastUser=''; s.lastBot=''; return L.reset; }
  if (n === '/langde')  { s.lang = 'de'; return "Alles klar, ich antworte auf Deutsch."; }
  if (n === '/langen')  { s.lang = 'en'; return "Got it, I’ll reply in English."; }
  if (n === '/langauto'){ s.lang = null;  return (detectLang(text)==='en' ? "Auto language enabled." : "Automatische Sprache aktiviert."); }

  // Anti‑Duplicate (10 s)
  if (n && n === s.lastUser && (tNow - s.lastUserAt < 10000)) {
    return rotate(TXT[s.lang || 'de'].dup, s.idx);
  }

  // Vorab: Erkennung (für Notfall-Priorität)
  const detected = findCase(text, s.lang || 'de');

  // 1) Notfälle sofort → State reset + direkte Antwort
  if (detected && detected.emergency) {
    s.state = { name:null, step:0, data:{} };
    return detected.start(text, s, L);
  }

  // 2) Aktiven Fall fortsetzen
  if (s.state.name) {
    const active = getCaseById(s.state.name);
    if (active) return active.step(text, s, L);
    s.state = { name:null, step:0, data:{} };
  }

  // 3) Neuen Fall starten (kein aktiver Case)
  if (detected) {
    s.state = { name: detected.id, step:0, data:{} };
    return detected.start(text, s, L);
  }

  // 4) Fallback
  return `${rotate(L.acks, s.idx)} ${rotate(L.tails, s.idx)}`;
}

/* ---------- Foto ---------- */
function onPhoto(s) {
  const L = TXT[s.lang || 'de'];
  if (s.state.name) {
    const active = getCaseById(s.state.name);
    if (active && typeof active.photo === 'function') return active.photo(s, L);
  }
  return L.photoReceived;
}

/* ---------- Telegram ---------- */
async function startTelegram() {
  if (!Telegraf) throw new Error('telegraf not installed');
  const bot = new Telegraf(TOKEN);

  bot.on('text', (ctx) => {
    const id = String(ctx.chat.id);
    const s  = getSession(id);
    const msg = ctx.message.text || '';
    if (s.lang === null) s.lang = detectLang(msg);

    let out = replyFor(msg, s);
    out = antiRepeat(out, s);

    s.lastUser   = norm(msg);
    s.lastUserAt = now();
    s.lastBot    = norm(out);

    ctx.reply(out).catch(err => console.error('[TELEGRAM send error]', err));
  });

  bot.on('photo', (ctx) => {
    const id = String(ctx.chat.id);
    const s  = getSession(id);
    const out = onPhoto(s);
    s.lastBot = norm(out);
    ctx.reply(out).catch(err => console.error('[TELEGRAM send error]', err));
  });

  await bot.launch();
  console.log(`[${BOT_NAME}] Telegram-Bot läuft.`);
  process.once('SIGINT', () => { bot.stop('SIGINT'); process.exit(0); });
  process.once('SIGTERM', () => { bot.stop('SIGTERM'); process.exit(0); });
}

/* ---------- CLI ---------- */
function startCLI() {
  const id='cli'; const s=getSession(id);
  const rl = require('readline').createInterface({ input:process.stdin, output:process.stdout, prompt:`${BOT_NAME}> ` });
  console.log(`${BOT_NAME} – CLI. Tippe /help.`); rl.prompt();
  rl.on('line', (line) => {
    const msg = line || '';
    if (s.lang === null) s.lang = detectLang(msg);
    let out = replyFor(msg, s);
    out = antiRepeat(out, s);
    s.lastUser = norm(msg); s.lastUserAt = now(); s.lastBot = norm(out);
    console.log(out); rl.prompt();
  });
  rl.on('close', () => { console.log((s.lang==='en')?TXT.en.bye:TXT.de.bye); process.exit(0); });
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






