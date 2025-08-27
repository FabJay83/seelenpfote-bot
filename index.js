// Telegraf x OpenAI mit empathischem Stil + per-User-Memory (persistiert in data.json)

const { Telegraf } = require("telegraf");
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");

// === Env ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!BOT_TOKEN) { console.error("Fehler: BOT_TOKEN fehlt"); process.exit(1); }
if (!OPENAI_API_KEY) { console.error("Fehler: OPENAI_API_KEY fehlt"); process.exit(1); }

const bot = new Telegraf(BOT_TOKEN);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// === Simple JSON "DB" ===
const DB_FILE = path.join(__dirname, "data.json");
let DB = { users: {} }; // { [chatId]: { ownerName, pets: [{name,species}], notes: string } }

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf8");
      DB = JSON.parse(raw || "{}") || { users: {} };
      DB.users = DB.users || {};
    }
  } catch (e) {
    console.error("Konnte data.json nicht lesen:", e);
  }
}
function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(DB, null, 2), "utf8");
  } catch (e) {
    console.error("Konnte data.json nicht speichern:", e);
  }
}
loadDB();

// Helpers
function getProfile(chatId) {
  if (!DB.users[chatId]) DB.users[chatId] = { ownerName: null, pets: [], notes: "" };
  return DB.users[chatId];
}
function setOwnerName(chatId, name) {
  const p = getProfile(chatId);
  p.ownerName = name;
  saveDB();
}
function addPet(chatId, name, species) {
  const p = getProfile(chatId);
  if (!p.pets) p.pets = [];
  // Falls Tier schon existiert, aktualisieren
  const idx = p.pets.findIndex((x) => x.name?.toLowerCase() === name.toLowerCase());
  if (idx >= 0) p.pets[idx] = { name, species: species || p.pets[idx].species || "" };
  else p.pets.push({ name, species: species || "" });
  saveDB();
}
function clearProfile(chatId) {
  DB.users[chatId] = { ownerName: null, pets: [], notes: "" };
  saveDB();
}
function profileSummary(p) {
  const pets = (p.pets || []).map((t) => `${t.name}${t.species ? ` (${t.species})` : ""}`).join(", ");
  return `Halter: ${p.ownerName || "—"} | Tiere: ${pets || "—"}${p.notes ? ` | Notizen: ${p.notes}` : ""}`;
}

// Persona/System-Prompt
function buildSystemPrompt(profile) {
  const who =
    `Du bist "Seelenpfote", ein empathischer, mitfühlender und fürsorglicher Tierarzt-Assistant. ` +
    `Du erklärst klar, freundlich und beruhigend. Du bleibst professionell und rätst bei Notfällen zu einem Tierarztbesuch.`;

  const memory =
    `Bekannte Informationen zur Person/Tieren:\n` +
    `- Halter: ${profile.ownerName || "unbekannt"}\n` +
    `- Tiere: ${
      (profile.pets && profile.pets.length)
        ? profile.pets.map(p => `${p.name}${p.species ? ` (${p.species})` : ""}`).join(", ")
        : "keine gespeichert"
    }\n`;

  const style =
    `Stil-Richtlinien:\n` +
    `- Begrüße persönlich (verwende den Halternamen, falls bekannt).\n` +
    `- Nutze einen warmen, beruhigenden Ton, zeige Verständnis.\n` +
    `- Gib strukturierte, gut umsetzbare Schritte (Bulletpoints, kurze Sätze).\n` +
    `- Frage am Ende sanft nach, ob noch etwas unklar ist oder wie es dem Tier geht.\n` +
    `- Keine Ferndiagnosen behaupten; weise bei ernsten Symptomen auf Tierarzt/Notdienst hin.`;

  return `${who}\n\n${memory}\n${style}`;
}

// Optional: sehr einfache Name-/Tier-Erkennung aus Text (heuristisch)
function maybeExtractData(chatId, text) {
  // /myname Max
  const nameMatch = text.match(/\bmein\s+name\s+ist\s+([A-Za-zÀ-ÿ' -]{2,40})/i);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    setOwnerName(chatId, name);
  }
  // "Mein Hund heißt Bella" / "Meine Katze Luna"
  const petMatch = text.match(/\b(mein(?:e|)?)\s+(hund|katze|kater|kaninchen|vogel|hamster|meerschweinchen|pferd|welpe|kätzchen)\s+(heißt|ist)\s+([A-Za-zÀ-ÿ' -]{2,40})/i);
  if (petMatch) {
    const species = petMatch[2].toLowerCase();
    const petName = petMatch[4].trim();
    addPet(chatId, petName, species);
  }
}

// --- Commands ---
bot.start(async (ctx) => {
  const chatId = String(ctx.chat.id);
  const p = getProfile(chatId);

  const intro =
    `Hey ${p.ownerName ? p.ownerName : "und herzlich willkommen"}! 🐾\n` +
    `Ich bin **Seelenpfote**, dein einfühlsamer Tier-Assistant. ` +
    `Ich merke mir deinen Namen und die deiner Tiere, damit ich künftig persönlicher helfen kann.\n\n` +
    `Los geht’s:\n` +
    `• Teile mir deinen Namen: /myname Max\n` +
    `• Ein Tier speichern: /addpet Name [Art]  → z.B.  /addpet Jaxx Hund\n` +
    `• Profil anzeigen: /profile\n` +
    `• Alles zurücksetzen: /reset`;

  await ctx.reply(intro, { parse_mode: "Markdown" });
});

bot.command("myname", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const args = (ctx.message.text || "").split(" ").slice(1);
  const name = args.join(" ").trim();
  if (!name) return ctx.reply("Wie darf ich dich nennen? Beispiel:  /myname Jakob");

  setOwnerName(chatId, name);
  await ctx.reply(`Danke, ${name}! 😊 Ich habe deinen Namen gespeichert.`);
});

bot.command("addpet", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const args = (ctx.message.text || "").split(" ").slice(1);
  if (args.length < 1) {
    return ctx.reply("Bitte so verwenden:  /addpet Name [Art]\nBeispiel: /addpet Jaxx Hund");
  }
  const petName = args[0];
  const species = args.slice(1).join(" ");
  addPet(chatId, petName, species);
  await ctx.reply(
    `Super! Ich habe **${petName}**${species ? ` (${species})` : ""} gespeichert. 🐶🐱`
    , { parse_mode: "Markdown" }
  );
});

bot.command("profile", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const p = getProfile(chatId);
  await ctx.reply("Aktuelles Profil:\n" + profileSummary(p));
});

bot.command("reset", async (ctx) => {
  const chatId = String(ctx.chat.id);
  clearProfile(chatId);
  await ctx.reply("Alles gelöscht. Wir starten frisch! Du kannst mit /myname und /addpet neu beginnen.");
});

// --- Haupt-Dialog ---
bot.on("text", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const userMessage = (ctx.message?.text || "").trim();
  if (!userMessage) return;

  // Leichte Heuristiken zum automatischen Lernen aus Freitext
  maybeExtractData(chatId, userMessage);

  const profile = getProfile(chatId);
  const systemPrompt = buildSystemPrompt(profile);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        // Kontext-Sandwich: merke die bekannten Tiere direkt in die User-Message
        {
          role: "user",
          content:
            `Nutzerprofil (aus Bot-Speicher): Halter=${profile.ownerName || "—"}; ` +
            `Tiere=${(profile.pets||[]).map(p=>p.name+(p.species?` (${p.species})`:"")).join(", ") || "—"}\n\n` +
            `Nachricht:\n${userMessage}`
        }
      ],
      temperature: 0.7,
      max_tokens: 700,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Entschuldige, ich konnte gerade keine Antwort generieren.";

    // Wenn der Nutzer im Text etwas wie "Ich heiße ..." geschrieben hat, hatten wir oben maybeExtractData().
    await ctx.reply(reply, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("OpenAI API Fehler:", error?.response?.data || error);
    await ctx.reply("Oh je, da ist etwas schiefgelaufen. Versuch es bitte gleich nochmal.");
  }
});

// Start & Cleanup
bot.launch()
  .then(() => console.log("Seelenpfote läuft (empathisch, mit Gedächtnis)!"))
  .catch((err) => { console.error("Startfehler:", err); process.exit(1); });

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e));




























