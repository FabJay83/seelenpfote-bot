// Seelenpfote – einfühlsamer Tier-Begleiter (natürliche Sprache, keine Slash-Commands)
const { Telegraf } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN || 'HIER_DEIN_TELEGRAM_BOT_TOKEN';
if (!BOT_TOKEN || BOT_TOKEN === 'HIER_DEIN_TELEGRAM_BOT_TOKEN') {
  console.error('Fehlender BOT_TOKEN. Bitte Umgebungsvariable BOT_TOKEN setzen.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// ===== einfache Datenspeicherung im Arbeitsspeicher =====
const users = new Map(); // userId -> { name: string|null, pets: [{name,type}] }
function getUser(ctx) {
  const id = ctx.from.id;
  if (!users.has(id)) users.set(id, { name: null, pets: [] });
  return users.get(id);
}
function fmtProfile(d) {
  const name = d.name ? `• Name: ${d.name}` : '• Name: (noch nicht gespeichert)';
  const pets = d.pets.length
    ? d.pets.map(p => `   – ${p.name} (${p.type})`).join('\n')
    : '• Tiere: (noch keine gespeichert)';
  return `${name}\n${pets}`;
}

// ===== sensible, warme Texte =====
const START_TEXT =
'🌷 Willkommen bei *Seelenpfote* 🐾\n' +
'Schön, dass du da bist. Ich bin für dich da – ruhig, freundlich und ohne Hektik.\n\n' +
'Erzähl mir gern ein bisschen von dir und deiner Fellnase. Wenn du magst, kannst du mir auch ein Foto schicken. ' +
'Ich höre dir zu und helfe dir, die Situation besser einzuordnen. 💛';

const SOFT_NAME_PROMPT = 'Wie darf ich dich ansprechen? 💬';
const SOFT_PET_PROMPT  = 'Magst du mir den Namen und die Art deiner Fellnase verraten? (z. B. Jaxx, Hund) 🐶';

// ===== Intent-Erkennung (DE, einfache Regeln) =====
const ANIMALS = [
  'hund','katze','kater','welpe','hündin','kaninchen','hamster','meerschweinchen','vogel',
  'papagei','sittich','kanarie','pferd','pony','esel','ziege','schaf','kuh','fisch','schildkröte',
  'echse','gecko','schlange','igel','frettchen','ratte','maus','wellensittich','mops','boston terrier'
];

const nameRegexes = [
  /\b(?:ich\s+heiße|ich\s+heisse|mein\s+name\s+ist|nenn(?:e|t)?\s+mich)\s+([a-zäöüß\- ]{2,})\b/i,
  /\bich\s+bin\s+([a-zäöüß\- ]{2,})\b/i
];

const petPatterns = [
  // Mein Hund heißt Jaxx / Meine Katze heisst Luna
  new RegExp(`\\bmein(?:e)?\\s+(${ANIMALS.join('|')})\\s+(?:heißt|heisst|ist|namens|name\\s+ist)\\s+([a-zäöüß\\- ]{2,})\\b`, 'i'),
  // Ich habe einen Hund namens Jaxx / Ich habe eine Katze Luna
  new RegExp(`\\bich\\s+habe\\s+(?:einen|eine|ein)\\s+(${ANIMALS.join('|')})\\s+(?:namens\\s+|name\\s+ist\\s+|)([a-zäöüß\\- ]{2,})\\b`, 'i'),
  // Mein Hund Jaxx (ohne Verb)
  new RegExp(`\\bmein(?:e)?\\s+(${ANIMALS.join('|')})\\s+([a-zäöüß\\- ]{2,})\\b`, 'i')
];

// zarte Profil-Nachfrage
const profileRegex = /\b(zeig(?:e)?\s+mir\s+(?:mein\s+)?profil|was\s+weißt\s+du\s+über\s+mich|was\s+weißt\s+du\s+von\s+mir)\b/i;

// ===== Fehler-Handler =====
bot.catch((err, ctx) => {
  console.error('Bot-Fehler bei Update', ctx.update?.update_id, err);
});

// ===== Begrüßung =====
bot.start(async (ctx) => {
  await ctx.replyWithMarkdown(START_TEXT);
  const d = getUser(ctx);
  if (!d.name) {
    setTimeout(() => ctx.reply(SOFT_NAME_PROMPT), 300);
  }
});

// ===== Fotos: behutsam reagieren =====
bot.on(['photo', 'document'], async (ctx) => {
  const d = getUser(ctx);
  if (!d.name) {
    await ctx.reply('Danke für das Bild. Bevor wir schauen, wie es deinem Schatz geht: Wie darf ich dich ansprechen? 💬');
    return;
  }
  if (!d.pets.length) {
    await ctx.reply(`Danke dir, ${d.name}. Magst du mir noch Name und Art deiner Fellnase sagen? Dann kann ich besser auf das Foto eingehen. 🐾`);
    return;
  }
  await ctx.reply('Danke für das Foto. Magst du mir kurz beschreiben, was dir gerade Sorgen macht? Ich höre zu. 🫶');
});

// ===== Hauptlogik: natürliche Sprache =====
bot.on('text', async (ctx) => {
  const text = (ctx.message.text || '').trim();
  const d = getUser(ctx);

  // Profil?
  if (profileRegex.test(text)) {
    return ctx.reply('📒 Kleiner Überblick\n' + fmtProfile(d));
  }

  // Name erkennen
  for (const re of nameRegexes) {
    const m = text.match(re);
    if (m && m[1]) {
      const name = m[1].trim().replace(/\s+/g,' ').replace(/^[a-z]/, c => c.toUpperCase());
      d.name = name;
      await ctx.reply(`Danke dir, ${name}. Schön, dass du hier bist. 🤝`);
      if (!d.pets.length) setTimeout(() => ctx.reply(SOFT_PET_PROMPT), 300);
      return;
    }
  }

  // Tier erkennen
  for (const re of petPatterns) {
    const m = text.match(re);
    if (m && m[1] && m[2]) {
      const type = m[1].toLowerCase();
      const petName = m[2].trim().replace(/\s+/g,' ').replace(/^[a-z]/, c => c.toUpperCase());
      d.pets.push({ name: petName, type });
      await ctx.reply(`Wie schön – ${petName} (${type}). Ich habe mir das notiert. 🐾`);
      return;
    }
  }

  // Sanfte Führung – ohne Technik & ohne Befehle
  if (!d.name) {
    return ctx.reply('Magst du mir deinen Vornamen sagen? Dann kann ich dich persönlich ansprechen. 🌼');
  }
  if (!d.pets.length) {
    return ctx.reply(`Und wie heißt deine Fellnase, ${d.name}? Welche Art ist sie? 🐶🐱`);
  }

  // Wenn alles bekannt ist: empathische offene Frage
  return ctx.reply(`Ich bin ganz Ohr, ${d.name}. Was beschäftigt dich gerade bei ${d.pets[0].name}? 🫶`);
});

// ===== Start (Webhook aus, nur Polling – verhindert 409) =====
(async () => {
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await bot.launch({ dropPendingUpdates: true });
    console.log('Seelenpfote läuft (natürlicher Dialog, Polling) 🐶');
  } catch (e) {
    console.error('Startfehler:', e);
    process.exit(1);
  }
})();

// Sauber beenden (Railway/Heroku)
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

