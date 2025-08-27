// Seelenpfote – einfühlsamer Tier-Begleiter (natürliche Sprache + OpenAI Vision)
const { Telegraf } = require('telegraf');
const OpenAI = require('openai');

const BOT_TOKEN = process.env.BOT_TOKEN || 'HIER_DEIN_TELEGRAM_BOT_TOKEN';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'HIER_DEIN_OPENAI_API_KEY';

if (!BOT_TOKEN || BOT_TOKEN === 'HIER_DEIN_TELEGRAM_BOT_TOKEN') {
  console.error('Fehlender BOT_TOKEN (Telegram). Bitte Umgebungsvariable BOT_TOKEN setzen.');
  process.exit(1);
}
if (!OPENAI_API_KEY || OPENAI_API_KEY === 'HIER_DEIN_OPENAI_API_KEY') {
  console.error('Fehlender OPENAI_API_KEY. Bitte Umgebungsvariable OPENAI_API_KEY setzen.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ===== einfache Datenspeicherung im Speicher =====
const users = new Map(); // userId -> { name: string|null, pets: [{name,type,confirmed:boolean}] }

function getUser(ctx) {
  const id = ctx.from.id;
  if (!users.has(id)) users.set(id, { name: null, pets: [] });
  return users.get(id);
}

function cleanName(raw) {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(ich\s+bin\s+)?(der|die|das|den|dem|ein|eine|einen)\s+/i, '')
    .replace(/^[a-zäöüß]/, c => c.toUpperCase());
}

function fmtShort(d) {
  const name = d.name ? d.name : 'du';
  const pet = d.pets[0]?.name || 'deine Fellnase';
  return { name, pet };
}

// ===== freundliche Texte =====
const START_TEXT =
'🌷 Willkommen bei Seelenpfote 🐾\n' +
'Schön, dass du da bist. Ich bin ruhig an deiner Seite und helfe dir, deine Sorgen einzuordnen.\n\n' +
'Erzähl mir gern von dir und deiner Fellnase – oder schicke mir ein Foto. Ich höre zu. 💛';

const SOFT_NAME_PROMPT = 'Wie darf ich dich ansprechen? 😊';
const SOFT_PET_PROMPT  = 'Magst du mir den Namen und die Art deiner Fellnase verraten? (z. B. Jaxx, Hund) 🐶';

// ===== Erkennung (DE, einfache Regeln) =====
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
  new RegExp(`\\bmein(?:e)?\\s+(${ANIMALS.join('|')})\\s+(?:heißt|heisst|ist|namens|name\\s+ist)\\s+([a-zäöüß\\- ]{2,})\\b`, 'i'),
  new RegExp(`\\bich\\s+habe\\s+(?:einen|eine|ein)\\s+(${ANIMALS.join('|')})\\s+(?:namens\\s+|name\\s+ist\\s+|)([a-zäöüß\\- ]{2,})\\b`, 'i'),
  new RegExp(`\\bmein(?:e)?\\s+(${ANIMALS.join('|')})\\s+([a-zäöüß\\- ]{2,})\\b`, 'i')
];

// einfache Symptom-Erkennung für eine erste, behutsame Antwort
const concernRegexes = [
  { re: /\bhumpel|lahm|tritt\s+nicht\s+auf\b/i, key: 'lahmheit' },
  { re: /\bentz(ü|ue)nd|ger(ö|oe)t|geschwoll|schwellung\b/i, key: 'entzündung' },
  { re: /\bblut|wunde|riss|offen\b/i, key: 'wunde' },
  { re: /\bfieber|heiß\b/i, key: 'fieber' },
];

// ===== kleine Hilfsfunktionen =====
function gentleConfirmPet(ctx, d, petName, petType) {
  const prettyType = petType.toLowerCase();
  d.pets.push({ name: petName, type: prettyType, confirmed: true });
  return ctx.reply(`Wie schön – ${petName}. Ich habe mir notiert, dass ${petName} ein ${prettyType} ist. 🐾`);
}

async function getTelegramFileUrl(ctx, fileId) {
  const file = await ctx.telegram.getFile(fileId);
  return `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
}

async function analyzeImageWithOpenAI(imageUrl, contextText = '') {
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content:
          'Du bist ein einfühlsamer, vorsichtiger Tierassistent. Beschreibe, was du SICHER siehst, ' +
          'formuliere beruhigend und für Laien verständlich. Keine Diagnosen, keine Medikamente. ' +
          'Gib 2–3 sinnvolle nächste Schritte (Beobachten, kurz reinigen, schonen) und 3 Warnzeichen, ' +
          'bei denen man zeitnah tierärztlich abklären sollte.'
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: contextText || 'Bitte beurteile dieses Foto behutsam.' },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }
    ]
  });
  return res.choices?.[0]?.message?.content?.trim() || 'Ich konnte das Bild leider nicht sicher beurteilen.';
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

// ===== Fotos & Bild-Dokumente =====
bot.on(['photo', 'document'], async (ctx) => {
  try {
    const d = getUser(ctx);

    // nur Bild-Dokumente annehmen
    if (ctx.message.document && !String(ctx.message.document.mime_type || '').startsWith('image/')) {
      return ctx.reply('Danke dir. Schick mir gern ein Foto als Bild, dann kann ich es besser einschätzen. 📸');
    }

    // größte Foto-Variante wählen
    let fileId = null;
    if (ctx.message.photo && ctx.message.photo.length) {
      fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    } else if (ctx.message.document) {
      fileId = ctx.message.document.file_id;
    }
    if (!fileId) return;

    const url = await getTelegramFileUrl(ctx, fileId);
    const { name, pet } = fmtShort(d);

    const contextText =
      `Kontext: Nutzer*in heißt ${d.name || 'unbekannt'}. ` +
      `Tier: ${d.pets[0]?.name ? d.pets[0].name : 'unbekannt'}` +
      `${d.pets[0]?.type ? ' (' + d.pets[0].type + ')' : ''}. ` +
      'Bitte antworte warm, kurz und klar.';

    const ai = await analyzeImageWithOpenAI(url, contextText);
    await ctx.reply(`📸 Danke für das Bild.\n${ai}`);

    if (!d.name) setTimeout(() => ctx.reply(SOFT_NAME_PROMPT), 300);
    else if (!d.pets.length) setTimeout(() => ctx.reply(`Magst du mir noch sagen, wie ${pet} heißt und welche Art er/sie ist? 🐾`), 400);
  } catch (err) {
    console.error('Bildanalyse-Fehler:', err);
    await ctx.reply('Ups, da lief bei der Analyse etwas schief. Versuch es bitte gleich nochmal, ich bin bei dir. 🙏');
  }
});

// ===== Text-Dialog =====
bot.on('text', async (ctx) => {
  const text = (ctx.message.text || '').trim();
  const d = getUser(ctx);

  // Name erkennen
  for (const re of nameRegexes) {
    const m = text.match(re);
    if (m && m[1]) {
      d.name = cleanName(m[1]);
      await ctx.reply(`Danke dir, ${d.name}. Schön, dass du hier bist. 🤝`);
      if (!d.pets.length) setTimeout(() => ctx.reply(SOFT_PET_PROMPT), 300);
      return;
    }
  }

  // Tier erkennen
  for (const re of petPatterns) {
    const m = text.match(re);
    if (m && m[1] && m[2]) {
      const type = m[1].toLowerCase();
      const petName = cleanName(m[2]);
      await gentleConfirmPet(ctx, d, petName, type);
      return;
    }
  }

  // Sorgen/Probleme erkennen → behutsame Soforthilfe
  for (const { re, key } of concernRegexes) {
    if (re.test(text)) {
      const petName = d.pets[0]?.name || 'deine Fellnase';
      const name = d.name ? `${d.name}` : 'dir';
      let tips = '';

      switch (key) {
        case 'lahmheit':
          tips =
            `Danke fürs Teilen. Das klingt belastend – ich bin bei ${name}. 🫶\n` +
            `Zu ${petName}:\n` +
            `• Versuch bitte, Bewegung zu reduzieren und kurz zu beobachten.\n` +
            `• Fühl vorsichtig, ob eine Stelle warm, geschwollen oder druckempfindlich ist.\n` +
            `• Bei starken Schmerzen, Fieber, offener Wunde oder anhaltendem Humpeln: bitte zeitnah tierärztlich abklären lassen.\n` +
            `Wenn du magst, schick mir ein Foto – dann schaue ich behutsam drauf.`;
          break;
        case 'entzündung':
          tips =
            `Danke, dass du das sagst. Das kann sich unangenehm anfühlen – ich bin da. 💛\n` +
            `Für ${petName}:\n` +
            `• Pfote kurz inspizieren: Rötung, Schwellung, Fremdkörper zwischen den Ballen?\n` +
            `• Falls möglich: sanft mit lauwarmem Wasser reinigen und trocken tupfen.\n` +
            `• Bei starker Schwellung, Eiter, Fieber oder Schmerz: bitte zeitnah tierärztlich anschauen lassen.\n` +
            `Ein Foto hilft mir, es besser einzuschätzen.`;
          break;
        case 'wunde':
          tips =
            `Danke für deine Sorge – das kann beunruhigen. 🤍\n` +
            `• Offene Stellen vorsichtig mit lauwarmem Wasser säubern, trocken halten.\n` +
            `• Lecken wenn möglich kurz verhindern (z. B. durch Ablenken/Schutz), um Reizung zu vermeiden.\n` +
            `• Bei größerer/ tiefer Wunde, Blutung, üblem Geruch oder Fieber: bitte tierärztlich abklären.\n` +
            `Wenn du magst, schick mir ein Foto – ich werte es behutsam aus.`;
          break;
        case 'fieber':
          tips =
            `Ich verstehe, das verunsichert. 🌿\n` +
            `• Achte auf Anzeichen wie warme Ohren/ Bauch, Mattigkeit, fehlender Appetit.\n` +
            `• Sorge für Ruhe, frisches Wasser und beobachte.\n` +
            `• Bei deutlicher Wärme, Zittern, Apathie oder anhaltender Verschlechterung: bitte ärztlich abklären.\n` +
            `Ein Foto (z. B. der betroffenen Stelle) kann ich gern einschätzen.`;
          break;
      }

      await ctx.reply(tips);
      return;
    }
  }

  // Sanfte Führung – ohne Technik
  if (!d.name) {
    return ctx.reply('Wie darf ich dich ansprechen? 💬');
  }
  if (!d.pets.length) {
    return ctx.reply(`Magst du mir den Namen und die Art deiner Fellnase verraten, ${d.name}? (z. B. Jaxx, Hund) 🐾`);
  }

  const { pet } = fmtShort(d);
  return ctx.reply(`Ich bin ganz Ohr. Magst du mir kurz beschreiben, was dir bei ${pet} auffällt – oder ein Foto schicken? 🫶`);
});

// ===== Start (Webhook aus, nur Polling – verhindert 409) =====
(async () => {
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await bot.launch({ dropPendingUpdates: true });
    console.log('Seelenpfote läuft (natürlicher Dialog + Vision, Polling) 🐶');
  } catch (e) {
    console.error('Startfehler:', e);
    process.exit(1);
  }
})();

// Sanft beenden
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

