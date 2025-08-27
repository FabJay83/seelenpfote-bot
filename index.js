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

// --- freundliche Texte (kein MarkdownV2 notwendig) ---
const START_TEXT =
`🌸 Willkommen bei Seelenpfote 🐾
Schön, dass du da bist! Ich bin dein einfühlsamer Tier-Begleiter. Sprich einfach ganz normal mit mir:

• „Ich heiße Max.“  → ich merke mir deinen Namen
• „Mein Hund heißt Jaxx.“ oder „Ich habe eine Katze namens Luna.“  → ich speichere dein Tier
• „Zeig mir mein Profil.“  → ich fasse alles für dich zusammen
• „Alles löschen“ oder „Setz zurück“  → ich lösche die gespeicherten Daten

Wenn du mir unsicher bist, frag einfach: „Was kann ich sagen?“ 😊`;

const HELP_TEXT =
`Ich verstehe natürliche Sätze wie:
• „Ich heiße … / Mein Name ist …“
• „Mein Hund/Meine Katze heißt …“ oder „Ich habe einen … namens …“
• „Zeig mir mein Profil / Was weißt du über mich?“
• „Alles löschen / Zurücksetzen“
Ich bin für dich da 💛`;

// --- Intent-Erkennung (de) ---
const ANIMALS = [
  'hund','katze','kater','welpe','hündin','kaninchen','hamster','meerschweinchen','vogel',
  'papagei','sittich','kanarie','pferd','pony','esel','ziege','schaf','kuh','fisch','schildkröte',
  'echse','gecko','schlange','igel','frettchen','ratte','maus','wellensittich','border collie','mops','boston terrier'
];

// Name: „Ich heiße Max“, „Mein Name ist Max“, „Nennt mich Max“
const nameRegexes = [
  /\b(?:ich\s+heiße|ich\s+heisse|mein\s+name\s+ist|nenn(?:e|t)?\s+mich)\s+([a-zäöüß\- ]{2,})\b/i,
  /\b(?:ich\s+bin)\s+([a-zäöüß\- ]{2,})\b/i
];

// Tier: „Mein Hund heißt Jaxx“, „Ich habe eine Katze namens Luna“, „Mein Hund Jaxx“
const p

