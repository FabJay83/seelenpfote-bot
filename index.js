// Seelenpfote – einfühlsamer Tier-Begleiter (natürliche Sprache + Bildanalyse)
const { Telegraf } = require('telegraf');
const OpenAI = require('openai');

const BOT_TOKEN = process.env.BOT_TOKEN || 'HIER_DEIN_TELEGRAM_BOT_TOKEN';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'HIER_DEIN_OPENAI_KEY';

if (!BOT_TOKEN || BOT_TOKEN === 'HIER_DEIN_TELEGRAM_BOT_TOKEN') {
  console.error('Fehlender BOT_TOKEN. Bitte als Umgebungsvariable setzen.');
  process.exit(1);
}
if (!OPENAI_API_KEY || OPENAI_API_KEY === 'HIER_DEIN_OPENAI_KEY') {
  console.error('Fehlender OPENAI_API_KEY. Bitte als Umgebungsvariable setzen.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ===== einfache Datenspeicherung im Arbeitsspeicher =====
const users = new Map(); // userId -> { name: string|null, pet: {name,type}|null }
function getUser(ctx) {
  const id = ctx.from.id;
  if (!users.has(id)) users.set(id, { name: null, pet: null, lastHelp: null });
  return users.get(id);
}

// ===== Helfer =====
function niceCap(s) {
  if (!s) return s;
  return s.trim().replace(/\s+/g, ' ').replace(/^[a-zäöüß]/, c => c.toUpperCase());
}
function cleanHumanName(s) {
  // entferne Artikel/Pronomen am Anfang (der/die/das/ich bin der/...)
  let t = s.trim();
  t = t.replace(/^(der|die|das|den|dem)\s+/i, '');
  t = t.replace(/^(ich\s+bin\s+)(der|die|das)\s+/i, 'ich bin ');
  return niceCap(t);
}

// ===== sensible, warme Texte =====
const START_TEXT =
'🌷 Willkommen bei Seelenpfote 🐾\n' +
'Schön, dass du da bist. Ich bin für dich da – ruhig, freundlich und ohne Hektik.\n\n' +
'Erzähl mir gern ein bisschen von dir und deiner Fellnase. Wenn du magst, kannst du mir auch ein Foto schicken. ' +
'Ich höre zu und helfe dir, die Situation besser einzuordnen. 💛';

const SOFT_NAME_PROMPT = 'Wie darf ich dich ansprechen? 💬';
const SOFT_PET_PROMPT  = 'Magst du mir den Namen und die Art deiner Fellnase verraten? (z. B. Jaxx, Hund) 🐾';

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

// Tier: „Mein Hund heißt Jaxx“, „Ich habe einen Hund namens Jaxx“, „Mein Hund Jaxx“
const petPatterns = [
  new RegExp(`\\bmein(?:e)?\\s+(${ANIMALS.join('|')})\\s+(?:heißt|heisst|ist|namens|name\\s+ist)\\s+([a-zäöüß\\- ]{2,})\\b`, 'i'),
  new RegExp(`\\bich\\s+habe\\s+(?:einen|eine|ein)\\s+(${ANIMALS.join('|')})\\s+(?:namens\\s+|name\\s+ist\\s+|)([a-zäöüß\\- ]{2,})\\b`, 'i'),
  new RegExp(`\\bmein(?:e)?\\s+(${ANIMALS.join('|')})\\s+([a-zäöüß\\- ]{2,})\\b`, 'i')
];

// Sorgen-Signale (humpeln, entzündet, wunde, schmerz, pfote, lahm, blutet, schwellung)
const worryRegex = /(humpel|lahm|entzünd|wund|blut|schmerz|pfote|taumel|schwell)/i;

// Danke/Abschluss
const thanksRegex = /\b(danke|vielen dank|dankeschön|merci|thx)\b/i;

// Profil
const profileRegex = /\b(zeig(?:e)?\s+mir\s+(?:mein\s+)?profil|was\s+weißt\s+du\s+über\s+mich|was\s+weißt\s+du\s+von\s+mir)\b/i;

// ===== OpenAI Vision: Foto analysieren =====
async function analyzeImage(url, name, pet) {
  const system = 'Du bist ein einfühlsamer Tierassistent. Beurteile das Bild eines Haustiers umsichtig. ' +
                 'Formuliere kurz, warm und klar. Gib einfache Erste-Hilfe-Schritte (sicher & haushaltsüblich) ' +
                 'und nenne deutliche Warnzeichen, bei denen zeitnah ein Tierarzt sinnvoll ist. Keine Diagnosen, keine Panik.';

  const who = name ? `Das Haustier gehört zu ${name}.` : 'Das ist ein Haustier.';
  const petLine = pet ? `Es heißt ${pet.name} und ist ein ${pet.type}.` : '';

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: [
          { type: 'text', text: `${who} ${petLine} Bitte beurteile vorsichtig das Foto: erkennst du Wunde/Entzündung/Schwellung?` },
          { type: 'image_url', image_url: { url } }
        ]
      }
    ],
    temperature: 0.3,
  });
  return res.choices?.[0]?.message?.content?.trim() || 'Ich konnte das Bild leider nicht beurteilen.';
}

// ===== Fehler-Handler =====
bot.catch((err, ctx) => {
  console.error('Bot-Fehler bei Update', ctx.update?.update_id, err);
});

// ===== Begrüßung =====
bot.start(async (ctx) => {
  await ctx.reply(START_TEXT);
  const d = getUser(ctx);
  if (!d.name) setTimeout(() => ctx.reply(SOFT_NAME_PROMPT), 300);
});

// ===== Fotos: echte Analyse mit OpenAI =====
bot.on('photo', async (ctx) => {
  const d = getUser(ctx);
  try {
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const file = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

    const analysis = await analyzeImage(fileUrl, d.name, d.pet);
    const greet = d.name ? `Hallo ${d.name},` : 'Hallo,';
    await ctx.reply(`📸 Danke für das Bild.\n${greet}\n\n${analysis}`);
    d.lastHelp = 'image';
  } catch (e) {
    console.error(e);
    await ctx.reply('Entschuldige, das Bild konnte ich gerade nicht auswerten. Probier es bitte gleich nochmal. 🙏');
  }
});

// ===== Dokumente mit Bild: wie Foto behandeln =====
bot.on('document', async (ctx) => {
  const d = getUser(ctx);
  try {
    const fileId = ctx.message.document.file_id;
    const file = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
    const analysis = await analyzeImage(fileUrl, d.name, d.pet);
    const greet = d.name ? `Hallo ${d.name},` : 'Hallo,';
    await ctx.reply(`📎 Danke für die Datei.\n${greet}\n\n${analysis}`);
    d.lastHelp = 'image';
  } catch (e) {
    console.error(e);
    await ctx.reply('Entschuldige, die Datei konnte ich gerade nicht auswerten. Magst du ein Foto senden?');
  }
});

// ===== Text-Dialog =====
bot.on('text', async (ctx) => {
  const textRaw = (ctx.message.text || '').trim();
  const text = textRaw.replace(/\s+/g, ' ');
  const d = getUser(ctx);

  // 1) Danke erkannt -> warm abschließen (keine neue Frage)
  if (thanksRegex.test(text)) {
    const who = d.name ? d.name : 'dir';
    return ctx.reply(`Von Herzen gern, ${who} 💛 Wenn später nochmal etwas ist, schreib mir einfach jederzeit.`);
  }

  // 2) Profil?
  if (profileRegex.test(text)) {
    const nameLine = d.name ? `• Name: ${d.name}` : '• Name: (noch nicht gespeichert)';
    const petLine = d.pet ? `• Fellnase: ${d.pet.name} (${d.pet.type})` : '• Fellnase: (noch keine gespeichert)';
    return ctx.reply('📒 Kleiner Überblick\n' + nameLine + '\n' + petLine);
  }

  // 3) Name erkennen
  for (const re of nameRegexes) {
    const m = text.match(re);
    if (m && m[1]) {
      const name = cleanHumanName(m[1]);
      d.name = name;
      await ctx.reply(`Danke dir, ${name}. Schön, dass du hier bist. 🤝`);
      if (!d.pet) setTimeout(() => ctx.reply(SOFT_PET_PROMPT), 300);
      return;
    }
  }

  // 4) Tier erkennen (einmal freundlich bestätigen, danach nur noch Name verwenden)
  for (const re of petPatterns) {
    const m = text.match(re);
    if (m && m[1] && m[2]) {
      const type = niceCap(m[1].toLowerCase());
      const petName = niceCap(m[2]);
      d.pet = { name: petName, type };
      await ctx.reply(`Wie schön – ${petName}. Ich habe mir das notiert. 🐾`);
      return;
    }
  }

  // 5) Sorgen erkannt? -> einfühlsame Soforthilfe (ohne Art ständig zu wiederholen)
  if (worryRegex.test(text)) {
    const petName = d.pet?.name || 'dein Schatz';
    d.lastHelp = 'worry';
    return ctx.reply(
      'Danke fürs Teilen. Das klingt belastend – ich bin bei dir. 🫶\n' +
      `Zu ${petName}:\n` +
      '• Schau bitte, ob eine Wunde, Schwellung oder starke Wärme zu fühlen ist.\n' +
      '• Ruhig halten, kurz beobachten – und falls möglich die Stelle sanft reinigen (lauwarmes Wasser, ohne Druck).\n' +
      '• Bei starkem Schmerz, Fieber, offener Wunde oder anhaltendem Humpeln: bitte zeitnah tierärztlich abklären lassen.\n' +
      'Wenn du magst, kannst du mir auch ein Foto schicken – dann schaue ich noch genauer hin. 📷'
    );
  }

  // 6) Sanfte Führung – ohne Technik
  if (!d.name) return ctx.reply('Wie darf ich dich ansprechen? 💬');
  if (!d.pet)  return ctx.reply(`Und wie heißt deine Fellnase, ${d.name}? Welche Art ist sie? 🐶🐱`);
  return ctx.reply(`Ich bin ganz Ohr. Magst du kurz beschreiben, was dir bei ${d.pet.name} auffällt – oder ein Foto schicken? 🫶`);
});

// ===== Start (Webhook aus, nur Polling – verhindert 409) =====
(async () => {
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await bot.launch({ dropPendingUpdates: true });
    console.log('Seelenpfote läuft (natürlicher Dialog, Vision, Polling) 🐶');
  } catch (e) {
    console.error('Startfehler:', e);
    process.exit(1);
  }
})();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));


