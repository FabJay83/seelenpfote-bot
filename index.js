// Seelenpfote – einfühlsamer Tier-Begleiter (natürlich, ohne Slash-Commands)
const { Telegraf } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN || 'HIER_DEIN_TELEGRAM_BOT_TOKEN';
if (!BOT_TOKEN || BOT_TOKEN === 'HIER_DEIN_TELEGRAM_BOT_TOKEN') {
  console.error('Fehlender BOT_TOKEN. Bitte Umgebungsvariable BOT_TOKEN setzen.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// ===== einfache Datenspeicherung im Arbeitsspeicher =====
const users = new Map(); // userId -> { name, pets:[{name,type}], last:{key, at:number} }
function getUser(ctx) {
  const id = ctx.from.id;
  if (!users.has(id)) users.set(id, { name: null, pets: [], last: { key: null, at: 0 } });
  return users.get(id);
}
function fmtProfile(d) {
  const name = d.name ? `• Name: ${d.name}` : '• Name: (noch nicht gespeichert)';
  const pets = d.pets.length
    ? d.pets.map(p => `   – ${p.name} (${p.type})`).join('\n')
    : '• Tiere: (noch keine gespeichert)';
  return `${name}\n${pets}`;
}

// ===== Anti-Wiederholungs-Helper =====
function replyOnce(ctx, d, key, message, minSeconds = 40) {
  const now = Date.now();
  if (d.last.key === key && now - d.last.at < minSeconds * 1000) {
    // nicht nochmal dieselbe Antwort schicken
    return Promise.resolve();
  }
  d.last = { key, at: now };
  return ctx.reply(message);
}

// ===== sensible, warme Texte =====
const START_TEXT =
'🌷 Willkommen bei Seelenpfote 🐾\n' +
'Schön, dass du hier bist. Ich bin für dich da – ruhig, freundlich und ohne Hektik.\n\n' +
'Erzähl mir gern ein bisschen von dir und deiner Fellnase. Wenn du magst, kannst du mir auch ein Foto schicken. ' +
'Ich höre zu und helfe dir, die Situation besser einzuordnen. 💛';

const SOFT_NAME_PROMPT = 'Wie darf ich dich ansprechen? 💬';
const SOFT_PET_PROMPT  = 'Magst du mir den Namen und die Art deiner Fellnase verraten? (z. B. Jaxx, Hund) 🐾';

// ===== Intent-Erkennung (DE, einfache Regeln) =====
const ANIMALS = [
  'hund','katze','kater','welpe','hündin','kaninchen','hamster','meerschweinchen','vogel',
  'papagei','sittich','kanarie','pferd','pony','esel','ziege','schaf','kuh','fisch','schildkröte',
  'echse','gecko','schlange','igel','frettchen','ratte','maus','wellensittich','mops','boston terrier','boston-terrier'
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

// Sorgen-/Symptom-Erkennung (sehr grob, empathische Antwort)
const concernRegex = new RegExp([
  'humpel','lahm','schmerz','wehtut','entzünd','wunde','blut','eiter','schwell','heiss','heiß',
  'leck','knabbern','beisst','beißt','kratzt','erbricht','kotzt','durchfall','apath','matt',
  'frisst\\s+nicht','trinkt\\s+nicht','atmet\\s+schwer','hechelt\\s+stark','fieber','taumel'
].join('|'), 'i');

// zarte Profil-Nachfrage
const profileRegex = /\b(zeig(?:e)?\s+mir\s+(?:mein\s+)?profil|überblick|zusammenfassung)\b/i;

// ===== Fehler-Handler =====
bot.catch((err, ctx) => {
  console.error('Bot-Fehler bei Update', ctx.update?.update_id, err);
});

// ===== Begrüßung =====
bot.start(async (ctx) => {
  await ctx.reply(START_TEXT);
  const d = getUser(ctx);
  if (!d.name) {
    setTimeout(() => replyOnce(ctx, d, 'ask_name', SOFT_NAME_PROMPT, 5), 300);
  }
});

// ===== Fotos: behutsam reagieren =====
bot.on(['photo', 'document'], async (ctx) => {
  const d = getUser(ctx);
  if (!d.name) {
    return replyOnce(ctx, d, 'photo_need_name', 'Danke für das Bild. Wie darf ich dich ansprechen? 💬');
  }
  if (!d.pets.length) {
    return replyOnce(ctx, d, 'photo_need_pet', `Danke dir, ${d.name}. Wie heißt deine Fellnase und welche Art ist sie? 🐶🐱`);
  }
  return replyOnce(ctx, d, 'photo_ack', 'Danke für das Foto. Magst du kurz beschreiben, was dir gerade Sorge macht? Ich höre zu. 🫶');
});

// ===== Hauptlogik: natürliche Sprache =====
bot.on('text', async (ctx) => {
  const text = (ctx.message.text || '').trim();
  const d = getUser(ctx);

  // Profil?
  if (profileRegex.test(text)) {
    return replyOnce(ctx, d, 'profile', '📒 Kleiner Überblick\n' + fmtProfile(d));
  }

  // Name erkennen (mit Artikel-Filter)
  for (const re of nameRegexes) {
    const m = text.match(re);
    if (m && m[1]) {
      let name = m[1].trim().replace(/\s+/g,' ');
      name = name.replace(/^(der|die|das|den|dem|mein|meine|mich\s+nennt\s+man)\s+/i, ''); // Artikel/Präfixe
      name = name.replace(/^[a-z]/, c => c.toUpperCase());
      d.name = name;
      await replyOnce(ctx, d, 'saved_name', `Danke dir, ${name}. Schön, dass du hier bist. 🤝`, 5);
      if (!d.pets.length) setTimeout(() => replyOnce(ctx, d, 'ask_pet', SOFT_PET_PROMPT, 10), 400);
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
      return replyOnce(ctx, d, 'saved_pet', `Wie schön – ${petName} (${type}). Ich habe mir das notiert. 🐾`);
    }
  }

  // Sorgen erkannt?
  if (concernRegex.test(text)) {
    // Baue sanfte, kurze Erste-Hilfe-Antwort
    const petName = d.pets[0]?.name ? d.pets[0].name : 'deiner Fellnase';
    const lines = [
      `Danke fürs Teilen. Das klingt belastend – ich bin bei dir. 🫶`,
      `Zu ${petName}:`,
      `• Schau bitte, ob eine Wunde, Schwellung oder starke Wärme zu fühlen ist.`,
      `• Ruhig halten, kurz beobachten und – falls möglich – Pfote sanft reinigen.`,
      `• Wenn starke Schmerzen, Fieber, offene Wunde oder anhaltendes Humpeln: bitte zeitnah tierärztlich abklären lassen.`,
      `Möchtest du mir sagen, seit wann es so ist und ob ${petName} auftreten oder auftreten möchte?`
    ];
    return replyOnce(ctx, d, 'concern_reply', lines.join('\n'));
  }

  // Sanfte Führung – ohne Wiederholung
  if (!d.name) {
    return replyOnce(ctx, d, 'ask_name', 'Wie darf ich dich ansprechen? 💬');
  }
  if (!d.pets.length) {
    return replyOnce(ctx, d, 'ask_pet', `Und wie heißt deine Fellnase, ${d.name}? Welche Art ist sie? 🐶🐱`);
  }

  // Alles vorhanden: offene, empathische Frage (abwechselnd zwei Varianten)
  const alt = (Date.now() / 60000 | 0) % 2 === 0;
  const msg = alt
    ? `Ich bin ganz Ohr, ${d.name}. Was beschäftigt dich gerade bei ${d.pets[0].name}?`
    : `Erzähl mir gern, was dir bei ${d.pets[0].name} auffällt – ich höre aufmerksam zu.`;
  return replyOnce(ctx, d, 'open_followup', msg);
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
