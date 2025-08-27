// Seelenpfote – natürliche Dialoge, keine Slash-Commands
const { Telegraf } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN || 'HIER_DEIN_TELEGRAM_BOT_TOKEN';
if (!BOT_TOKEN) {
  console.error('Fehlender BOT_TOKEN. Bitte als Umgebungsvariable setzen.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// --- Mini-"Datenbank" im Speicher ---
const users = new Map(); // userId -> { name: string|null, pets: [{name,type}] }
const getUser = (ctx) => {
  const id = ctx.from.id;
  if (!users.has(id)) users.set(id, { name: null, pets: [] });
  return users.get(id);
};
const fmtProfile = (d) => {
  const name = d.name ? `• Name: ${d.name}` : '• Name: (noch nicht gespeichert)';
  const pets = d.pets.length
    ? d.pets.map(p => `   – ${p.name} (${p.type})`).join('\n')
    : '• Tiere: (noch keine gespeichert)';
  return `${name}\n${pets}`;
};

// --- freundliche Texte ---
const START_TEXT =
`🌸 Willkommen bei Seelenpfote 🐾
Schön, dass du da bist! Ich bin dein einfühlsamer Tier-Begleiter. Sprich einfach ganz normal mit mir:

• „Ich heiße Max.“  → ich merke mir deinen Namen
• „Mein Hund heißt Jaxx.“ oder „Ich habe eine Katze namens Luna.“  → ich speichere dein Tier
• „Zeig mir mein Profil.“  → ich fasse alles für dich zusammen
• „Alles löschen“ oder „Setz zurück“  → ich lösche die gespeicherten Date


