const { Telegraf } = require('telegraf');

// Prüfen, ob das Bot-Token vorhanden ist
if (!process.env.BOT_TOKEN) {
  console.error('Fehler: Die Umgebungsvariable BOT_TOKEN ist nicht gesetzt!');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// Schlüsselwörter und Antworten
const problems = [
  {
    keywords: ['humpelt', 'lahmt', 'bein', 'laufen', 'schmerzen'],
    response: 'Es klingt, als hätte dein Tier Probleme mit dem Bewegungsapparat. Seit wann besteht das Problem? Gibt es noch weitere Symptome?'
  },
  {
    keywords: ['erbrechen', 'kotzt', 'übelkeit', 'spuckt'],
    response: 'Dein Tier scheint Magen-Darm-Probleme zu haben. Wie oft kommt das vor? Frisst und trinkt es normal?'
  },
  {
    keywords: ['durchfall', 'stuhl', 'kot', 'dünn'],
    response: 'Dein Tier hat Verdauungsprobleme. Seit wann besteht der Durchfall? Gibt es Blut oder Schleim im Kot?'
  }
];

// Nachrichtenverarbeitung
bot.on('text', (ctx) => {
  const msg = ctx.message.text.toLowerCase();
  const found = problems.find(p => p.keywords.some(word => msg.includes(word)));
  if (found) {
    ctx.reply(found.response);
  } else {
    ctx.reply('Kannst du das Problem bitte noch etwas genauer beschreiben? Zum Beispiel: "Mein Hund humpelt seit 1 Woche."');
  }
});

// Bot starten
bot.launch()
  .then(() => console.log('Bot läuft!'))
  .catch(err => {
    console.error('Fehler beim Starten des Bots:', err);
    process.exit(1);
  });

// Sauberes Beenden
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

























