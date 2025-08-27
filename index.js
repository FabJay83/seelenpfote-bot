// ----- Grundsetup -----
const { Telegraf } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN || 'HIER_DEIN_TELEGRAM_BOT_TOKEN';
if (!BOT_TOKEN) {
  console.error('Fehlender BOT_TOKEN. Bitte als Umgebungsvariable setzen.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// einfache In-Memory "Datenbank"
const users = new Map(); // key: userId -> { name: 'Jakob', pets: [{name:'Jaxx', type:'Hund'}] }

// ----- Hilfsfunktionen -----
function getUser(ctx) {
  const id = ctx.from.id;
  if (!users.has(id)) users.set(id, { name: null, pets: [] });
  return users.get(id);
}

function fmtProfile(data) {
  const name = data.name ? `• Dein Name: ${data.name}` : '• Deinen Namen kenne ich noch nicht';
  const pets = data.pets.length
    ? data.pets.map(p => `   – ${p.name} (${p.type})`).join('\n')
    : '• Noch keine Tiere gespeichert';
  return `${name}\n• Deine Tiere:\n${pets}`;
}

// ----- Texte -----
const START_TEXT =
`🌸 *Willkommen bei Seelenpfote* 🐾
Schön, dass du da bist! Ich bin dein einfühlsamer Tier-Begleiter und möchte dir helfen, gut für deine Fellnase(n) zu sorgen. 💛

So kannst du starten:
✨ Sag mir deinen Namen → \`/meinname Max\`
✨ Erzähl mir von deinem Tier → \`/tier Jaxx Hund\`
✨ Schau dein Profil an → \`/profil\`
✨ Alles zurücksetzen → \`/zurücksetzen\`

Ich freue mich, euch kennenzulernen! 💕`;

const HELP_TEXT =
`ℹ️ *Kurze Hilfe*
• Namen setzen: \`/meinname Max\`
• Tier speichern: \`/tier Name Art\`  z. B. \`/tier Jaxx Hund\`
• Profil anzeigen: \`/profil\`
• Zurücksetzen: \`/zurücksetzen\``;

// ----- Kommandos -----
// /start
bot.start(async (ctx) => {
  await ctx.replyWithMarkdownV2(START_TEXT);
});

// /meinname <Name>   (Alias: /myname)
bot.command(['meinname', 'myname'], (ctx) => {
  const parts = ctx.message.text.trim().split(/\s+/).slice(1);
  if (parts.length === 0) {
    return ctx.reply('Wie darf ich dich nennen? Schreib z. B. „/meinname Max“.');
  }
  const data = getUser(ctx);
  data.name = parts.join(' ');
  ctx.reply(`Danke dir, ${data.name}! 😊`);
});

// /tier <Name> <Art>   (Alias: /addpet)
bot.command(['tier', 'addpet'], (ctx) => {
  const args = ctx.message.text.trim().split(/\s+/).slice(1);
  if (args.length < 2) {
    return ctx.reply('Erzähl mir kurz Name und Art deines Tieres, z. B. „/tier Jaxx Hund“.');
  }
  const name = args.slice(0, -1).join(' ');
  const type = args[args.length - 1];
  const data = getUser(ctx);
  data.pets.push({ name, type });
  ctx.reply(`Wunderbar! Ich habe *${name}* als ${type} gespeichert 🐾`, { parse_mode: 'Markdown' });
});

// /profil   (Alias: /profile)
bot.command(['profil', 'profile'], (ctx) => {
  const data = getUser(ctx);
  ctx.reply(`📒 *Dein Profil*\n${fmtProfile(data)}`, { parse_mode: 'Markdown' });
});

// /zurücksetzen   (Alias: /reset)
bot.command(['zurücksetzen', 'zuruecksetzen', 'reset'], (ctx) => {
  users.set(ctx.from.id, { name: null, pets: [] });
  ctx.reply('Alles zurückgesetzt. Wir fangen ganz gemütlich von vorne an 🤝');
});

// /hilfe   (Alias: /help)
bot.command(['hilfe', 'help'], (ctx) => ctx.replyWithMarkdown(HELP_TEXT));

// Fallback: freundliche Hilfe
bot.on('text', (ctx) => {
  return ctx.reply('Wenn du magst, schreib „/hilfe“ für eine kurze Übersicht der Möglichkeiten 💡');
});

// ----- Start (Long Polling) -----
bot.launch()
  .then(() => console.log('Seelenpfote läuft (Polling) 🐶'))
  .catch(err => {
    console.error('Startfehler:', err);
    process.exit(1);
  });

// Sanft beenden (Railway/Heroku)
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));






























