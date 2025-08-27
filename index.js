// Seelenpfote – natürliche Dialoge, keine Slash-Commands
const { Telegraf } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN || 'HIER_DEIN_TELEGRAM_BOT_TOKEN';
if (!BOT_TOKEN || BOT_TOKEN === 'HIER_DEIN_TELEGRAM_BOT_TOKEN') {
  console.error('Fehlender BOT_TOKEN. Bitte Umgebungsvariable BOT_TOKEN setzen.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// ===== Mini-"Datenbank" im Arbeitsspeicher =====
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

// ===== Texte (Plain Text) =====
const START_TEXT =
'🌸 Willkommen bei Seelenpfote 🐾\n' +
'Schön, dass du da bist! Ich bin dein einfühlsamer Tier-Begleiter. Sprich einfach ganz normal mit mir:\n\n' +
'• „Ich heiße Max.“  → ich merke mir deinen Namen\n' +
'• „Mein Hund heißt Jaxx.“ / „Ich habe eine Katze namens Luna.“ → ich speichere dein Tier\n' +
'• „Zeig mir mein Profil.“  → ich fasse alles für dich zusammen\n' +
'• „Alles löschen“ / „Zurücksetzen“  → ich lösche die gespeicherten Daten\n\n' +
'Wenn du unsicher bist: „Was kann ich sagen?“ 😊';

const HELP_TEXT =
'Ich verstehe u. a.:\n' +
'• „Ich heiße … / Mein Name ist …”\n' +
'• „Mein Hund/Meine Katze heißt …” / „Ich habe einen … namens …”\n' +
'• „Zeig mir mein Profil / Was weißt du über mich?”\n' +
'• „Alles löschen / Zurücksetzen”\n' +
'Ich bin für dich da 💛';

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

const profileRegex = /\b(zeig(?:e)?\s+mir\s+(?:mein\s+)?profil|was\s+weißt\s+du\s+über\s+mich|was\s+weißt\s+du\s+von\s+mir)\b/i;
const resetRegex   = /\b(alles\s+l(ö|oe)schen|zur(ü|ue)cksetzen|setz\s+zur(ü|ue)ck|vergiss\s+alles)\b/i;
const helpRegex    = /\b(hilfe|was\s+kann\s+ich\s+sagen|was\s+kann\s+ich\s+tun)\b/i;

// ===== Fehler-Handler =====
bot.catch((err, ctx) => {
  console.error('Bot-Fehler bei Update', ctx.update?.update_id, err);
});

// ===== Begrüßung =====
bot.start((ctx) => ctx.reply(START_TEXT));

// ===== Hauptlogik: natürliche Sprache =====
bot.on('text', (ctx) => {
  const text = (ctx.message.text || '').trim();

  // Zurücksetzen?
  if (resetRegex.test(text)) {
    users.set(ctx.from.id, { name: null, pets: [] });
    return ctx.reply('Alles klar – ich habe deine Daten gelöscht. Wir starten ganz in Ruhe neu 🤝');
  }

  // Hilfe?
  if (helpRegex.test(text)) {
    return ctx.reply(HELP_TEXT);
  }

  // Profil?
  if (profileRegex.test(text)) {
    const d = getUser(ctx);
    return ctx.reply('📒 Dein Profil\n' + fmtProfile(d));
  }

  // Name erkennen
  for (const re of nameRegexes) {
    const m = text.match(re);
    if (m && m[1]) {
      const name = m[1].trim().replace(/\s+/g,' ').replace(/^[a-z]/, c => c.toUpperCase());
      const d = getUser(ctx); d.name = name;
      return ctx.reply(`Schön, dich kennenzulernen, ${name}! 😊 Ich habe mir deinen Namen gemerkt.`);
    }
  }

  // Tier erkennen
  for (const re of petPatterns) {
    const m = text.match(re);
    if (m && m[1] && m[2]) {
      const type = m[1].toLowerCase();
      const petName = m[2].trim().replace(/\s+/g,' ').replace(/^[a-z]/, c => c.toUpperCase());
      const d = getUser(ctx); d.pets.push({ name: petName, type });
      return ctx.reply(`Wunderbar! Ich habe ${petName} als ${type} gespeichert 🐾`);
    }
  }

  // Sanfter Fallback je nach Status
  const d = getUser(ctx);
  if (!d.name) {
    return ctx.reply('Magst du mir deinen Namen verraten? Zum Beispiel: „Ich heiße Alex.“ 💬');
  }
  if (!d.pets.length) {
    return ctx.reply('Erzähl mir gern von deinem Tier, z. B.: „Mein Hund heißt Jaxx.“ 🐶');
  }
  return ctx.reply('Wenn du möchtest, schreib: „Zeig mir mein Profil“. Oder erzähl mir mehr über deine Fellnase 💛');
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
