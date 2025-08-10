// index.js — Seelenpfote (Telegram) mit Standard-Dialog & Intent-Erkennung
require('dotenv').config();
const { Telegraf } = require('telegraf');
const CASES = require('./cases.js');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
if (!TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN fehlt (.env)'); process.exit(1);
}
const bot = new Telegraf(TOKEN);

/* ---- Fälle + Synonyme/Keywords (DE+EN) ---- */
const KEYWORDS = {
  'durchfall':        [/durchfall|dünn|wässrig|breiig|blut.*stuhl|diarr(h|r)ea/i],
  'erbricht':         [/erbrech|kotz|übelkeit|galle|schaum|vomit|throw.*up|nausea/i],
  'humpelt':          [/humpel|lahm|belastet.*nicht|zieht.*bein|limp|lameness/i],
  'pfote entzündet':  [/pfote|ballen|kralle|entzünd|rot|schwell|eiter|schnitt|riss|paw|pad|nail/i],
  'blutung':          [/blut(ung|et)|schnitt|platzwunde|offene.*wunde|bleed|laceration|cut/i],
  'zecke':            [/zecke|stich|wespe|biene|allergie|quaddeln|tick|bee|wasp|hives/i],
  'ohr/auge':         [/ohr|ohren|au(s)?fluss|kopfsch(ü|u)tteln|auge|augen|rot.*auge|eye|ear/i],
  'husten':           [/hust|zwingerhusten|trachea|würgen|atem|pfeift|keucht|cough|breath/i],
  'appetitlosigkeit': [/appetitlos|frisst.*nicht|refuses.*food|no.*appetite/i],
  'harn':             [/urin|pinkelt|strengt.*an|blut.*urin|can.?t.*pee|no.*urine/i],
  'verstopfung':      [/verstopfung|harte.*kot|dr(ü|u)ckt.*ohne.*erfolg|constipation|hard.*stool/i],
  'zahn/bruch':       [/zahn|z(ä|a)hne|zahnfleisch|zahnbruch|bruch|fracture|broken/i],
  'hitzschlag':       [/hitzschlag|überhitz|heißes.*auto|heat.?stroke|overheat|panting.*heavily/i]
};

/* ---- kleine Hilfen ---- */
const sessions = new Map();
const norm = s => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();

function getSession(id) {
  if (!sessions.has(id)) sessions.set(id, { lastUser: '', lastAt: 0, lastBot: '' });
  return sessions.get(id);
}

function scoreCase(text) {
  let best = null, bestScore = 0;
  for (const [key, regs] of Object.entries(KEYWORDS)) {
    const hits = regs.reduce((n, r) => n + (r.test(text) ? 1 : 0), 0);
    if (hits > bestScore) { best = key; bestScore = hits; }
  }
  return bestScore > 0 ? best : null;
}

function renderCase(key) {
  const c = CASES[key];
  if (!c) return null;
  const steps = (c.steps || []).map(s => `• ${s}`).join('\n');
  const qs    = (c.questions || []).map((q,i)=>`${i+1}) ${q}`).join('\n');
  return `${c.intro}\n\n${steps}\n\nFragen an dich:\n${qs}`;
}

/* ---- Befehle ---- */
bot.start(ctx => {
  const list = Object.keys(CASES).map(k => `„${k}“`).join(', ');
  const msg =
`👋 Willkommen bei Seelenpfote!
Sag mir kurz, was los ist – z. B. ${list}.
💡 Hinweis: Ich ersetze keinen Tierarzt, helfe dir aber mit einer liebevollen Ersteinschätzung.

Schreib einfach in eigenen Worten, z. B. „mein Hund humpelt seit gestern“ oder „blutet stark“.`;
  ctx.reply(msg);
});

bot.help(ctx => {
  ctx.reply(`/start – Begrüßung\n/help – Hilfe\n/reset – Verlauf zurücksetzen`);
});

bot.command('reset', ctx => {
  sessions.delete(String(ctx.chat.id));
  ctx.reply('Verlauf gelöscht. Erzähl mir, was los ist.');
});

/* ---- normale Nachrichten: Intent erkennen ---- */
bot.on('text', ctx => {
  const chatId = String(ctx.chat.id);
  const s = getSession(chatId);
  const text = ctx.message.text || '';
  const n = norm(text);

  // Anti-Repeat 10s
  if (n === s.lastUser && Date.now() - s.lastAt < 10000) {
    return ctx.reply('Gleiche Eingabe erkannt. Magst du 1–2 Details ergänzen?');
  }

  // 1) exakter Treffer (User tippt den Fallnamen)
  if (CASES[n]) {
    const out = renderCase(n);
    if (out) ctx.reply(out);
  } else {
    // 2) freier Text → Case scoren
    const key = scoreCase(n);
    if (key) {
      const out = renderCase(key);
      if (out) ctx.reply(out);
    } else {
      // 3) nichts erkannt
      ctx.reply('Alles klar. Beschreib kurz, was passiert (z. B. „Durchfall seit gestern“, „humpelt“, „blutet stark“).');
    }
  }

  s.lastUser = n; s.lastAt = Date.now();
});

/* ---- Fotos nur freundlich quittieren ---- */
bot.on('photo', ctx => ctx.reply('Foto erhalten, danke! Wenn du magst: 1–2 Details dazu.'));

bot.launch().then(()=>console.log('Seelenpfote Telegram-Bot läuft.'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));




