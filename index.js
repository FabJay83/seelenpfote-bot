const { Telegraf } = require('telegraf');

// Bot-Token aus Umgebungsvariable (empfohlen für Railway)
const bot = new Telegraf(process.env.BOT_TOKEN);

// Schlüsselwörter für verschiedene Probleme
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
  },
  // Weitere Problemgruppen kannst du hier ergänzen
];

bot.on('text', (ctx) => {
  const userMessage = ctx.message.text.toLowerCase();

  // Versuchen, das Problem zu erkennen
  const found = problems.find(problem =>
    problem.keywords.some(keyword => userMessage.includes(keyword))
  );

  if (found) {
    ctx.reply(found.response);
  } else {
    ctx.reply('Kannst du das Problem bitte noch etwas genauer beschreiben? Zum Beispiel: "Mein Hund humpelt seit 1 Woche."');
  }
});

bot.launch();
console.log('Bot läuft!');

// Railway/Heroku: Sauberes Beenden
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

























