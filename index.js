
const { Telegraf, session, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(session());

function getProfile(ctx) {
  if (!ctx.session.profile) {
    ctx.session.profile = {
      id: ctx.from?.id,
      name: ctx.from?.first_name || "Freund",
      pet: null,
      lastIssue: null,
      lastPhotoTs: null
    };
  }
  return ctx.session.profile;
}

const mainKb = Markup.keyboard([
  ['🆘 /notfall', 'ℹ️ /hilfe'],
  ['📨 /kontakt', '🔒 /datenschutz']
]).resize();

bot.start(async (ctx) => {
  const p = getProfile(ctx);
  await ctx.reply(
    `🐾 Hallo ${p.name}! Ich bin Seelenpfote.\nErzähl mir, was los ist – du kannst mir auch ein Foto schicken.`,
    mainKb
  );
  await ctx.reply('Hast du einen Hund oder eine Katze? Antworte einfach mit „Hund“ oder „Katze“.');
});

bot.hears(/^hund$/i, async (ctx) => {
  const p = getProfile(ctx);
  p.pet = 'Hund';
  await ctx.reply('Alles klar, ich merke mir: 🐶 Hund.');
});
bot.hears(/^katze$/i, async (ctx) => {
  const p = getProfile(ctx);
  p.pet = 'Katze';
  await ctx.reply('Alles klar, ich merke mir: 🐱 Katze.');
});

bot.command('hilfe', async (ctx) => {
  const p = getProfile(ctx);
  await ctx.reply(
    `So nutzt du Seelenpfote, ${p.name}:\n1) Beschreibe kurz das Problem.\n2) Sende Foto/Video (falls sinnvoll).\n3) Ich gebe dir eine ruhige Ersteinschätzung & nächste Schritte.\n\n⚠️ Ich ersetze keinen Tierarzt – bei Atemnot, starken Schmerzen, Krampfanfällen sofort Notdienst.`
  );
});

bot.command('notfall', async (ctx) => {
  await ctx.reply(
    `Erste Schritte:\n• Blutung: sanfter Druck mit sauberem Tuch\n• Vergiftung: kein Erbrechen auslösen, Verpackung merken\n• Hitzschlag: Schatten, Pfoten/Brust kühlen (nicht eiskalt)\n• Atemnot/Kollaps: sofort Tierarzt-Notdienst\nSchreib mir kurz Situation + seit wann – ich begleite dich.`
  );
});

bot.command('kontakt', (ctx) =>
  ctx.reply('E-Mail: info@seelenpfote.app\nInstagram: @seelenpfote.app')
);
bot.command('datenschutz', (ctx) =>
  ctx.reply('Kurzfassung: Ich speichere nur, was nötig ist. Details: https://www.seelenpfote.app/#Datenschutz')
);

bot.on('photo', async (ctx) => {
  const p = getProfile(ctx);
  p.lastPhotoTs = Date.now();
  await ctx.reply(
    `Danke fürs Bild, ${p.name}. Bitte beschreibe kurz:\n• Seit wann?\n• Schmerzen (ja/nein)?\n• Fieber/Erbrechen?\n• Verhalten verändert?\n${p.pet ? `(Tier: ${p.pet})` : ''}`
  );
});

bot.on('text', async (ctx) => {
  const p = getProfile(ctx);
  const t = ctx.message.text;
  if (/durchfall|diarrh/i.test(t)) {
    p.lastIssue = 'Durchfall';
    await ctx.reply(`Verstanden – Durchfall. Flüssigkeit & leichtes Futter; wenn blutig, apathisch oder >24–48h → Tierarzt.`);
    return;
  }
  if (/wunde|verletz|schnitt/i.test(t)) {
    p.lastIssue = 'Wunde';
    await ctx.reply(`Okay – Wunde. Sanft reinigen, Druck bei Blutung, nicht lecken lassen; tiefe/verschmutzte Wunden zeitnah zum Tierarzt.`);
    return;
  }
  await ctx.reply(`Danke, ${p.name}. Magst du Alter, Gewicht und seit wann das Problem besteht sagen?${p.pet ? ` (Tier: ${p.pet})` : ''}`);
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
