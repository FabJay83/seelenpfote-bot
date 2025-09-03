// Seelenpfote Telegram-Bot (Telegraf + OpenAI v4)
// Features: empathisch, per-User-Memory (Name/Tiere), Foto-Analyse, Polling/Webhook, JSON-Persistenz

const { Telegraf } = require("telegraf");
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");
const express = require("express");
const http = require("http");

// ====== ENV ======
const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PUBLIC_URL = process.env.PUBLIC_URL; // optional: https://<deinprojekt>.up.railway.app
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) { console.error("Fehler: BOT_TOKEN fehlt"); process.exit(1); }
if (!OPENAI_API_KEY) { console.error("Fehler: OPENAI_API_KEY fehlt"); process.exit(1); }

const bot = new Telegraf(BOT_TOKEN);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ====== PERSISTENZ (JSON) ======
const DB_FILE = path.join(__dirname, "data.json");
let DB = { users: {} }; // { [chatId]: { ownerName: string|null, pets: [{name,species}], notes: string } }

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
  const idx = p.pets.findIndex(x => x.name?.toLowerCase() === name.toLowerCase());
  if (idx >= 0) p.pets[idx] = { name, species: species || p.pets[idx].species || "" };
  else p.pets.push({ name, species: species || "" });
  saveDB();
}
function clearProfile(chatId) {
  DB.users[chatId] = { ownerName: null, pets: [], notes: "" };
  saveDB();
}
function profileSummary(p) {
  const pets = (p.pets || []).map(t => `${t.name}${t.species ? ` (${t.species})` : ""}`).join(", ");
  return `Halter: ${p.ownerName || "—"} | Tiere: ${pets || "—"}${p.notes ? ` | Notizen: ${p.notes}` : ""}`;
}

// ====== PROMPTING ======
function buildSystemPrompt(profile) {
  const who =
    `Du bist "Seelenpfote", ein empathischer, mitfühlender und fürsorglicher Tier-Assistant. ` +
    `Du erklärst ruhig, klar und freundlich, gibst praktische Schritt-für-Schritt-Hinweise und zeigst Verständnis. ` +
    `Bei ernsten Symptomen rätst du, eine Tierarztpraxis/Notdienst aufzusuchen.`;

  const memory =
    `Bekannte Informationen:\n` +
    `- Halter: ${profile.ownerName || "unbekannt"}\n` +
    `- Tiere: ${
      (profile.pets && profile.pets.length)
        ? profile.pets.map(p => `${p.name}${p.species ? ` (${p.species})` : ""}`).join(", ")
        : "keine gespeichert"
    }\n`;

  const style =
    `Stil-Richtlinien:\n` +
    `- Begrüße persönlich (nutze Halternamen, falls vorhanden).\n` +
    `- Warm, beruhigend, lösungsorientiert; keine Ferndiagnosen.\n` +
    `- Gib klare Handlungsschritte (Bulletpoints, kurze Sätze).\n` +
    `- Frage am Ende sanft nach, ob noch etwas unklar ist / wie es dem Tier geht.`;

  return `${who}\n\n${memory}\n${style}`;
}

// ====== HEURISTIK: Namen/Tiere aus Freitext erkennen ======
function maybeExtractData(chatId, text) {
  const nameMatch = text.match(/\bmein\s+name\s+ist\s+([A-Za-zÀ-ÿ' -]{2,40})/i);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    setOwnerName(chatId, name);
  }
  const petMatch = text.match(/\b(mein(?:e)?|unsere?)\s+(hund|katze|kater|kaninchen|vogel|hamster|meerschweinchen|pferd|welpe|kätzchen)\s+(heißt|ist)\s+([A-Za-zÀ-ÿ' -]{2,40})/i);
  if (petMatch) {
    const species = petMatch[2].toLowerCase();
    const petName = petMatch[4].trim();
    addPet(chatId, petName, species);
  }
}

// ====== TELEGRAM DATEI → BASE64 ======
async function telegramFileToBase64(ctx, fileId) {
  const file = await ctx.telegram.getFile(fileId); // { file_path, ... }
  if (!file?.file_path) throw new Error("Kein file_path erhalten.");
  const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download fehlgeschlagen: ${res.status} ${res.statusText}`);
  const buf = await res.arrayBuffer();
  const ext = (file.file_path.split('.').pop() || 'jpg').toLowerCase();
  const mime =
    ext === 'png' ? 'image/png' :
    ext === 'webp' ? 'image/webp' :
    ext === 'gif' ? 'image/gif' :
    'image/jpeg';
  const b64 = Buffer.from(buf).toString('base64');
  return `data:${mime};base64,${b64}`;
}

// ====== COMMANDS ======
bot.start(async (ctx) => {
  const chatId = String(ctx.chat.id);
  const p = getProfile(chatId);
  const intro =
    `Hey ${p.ownerName ? p.ownerName : "und herzlich willkommen"}! 🐾\n` +
    `Ich bin **Seelenpfote**, dein einfühlsamer Tier-Assistant. ` +
    `Ich merke mir deinen Namen und die deiner Tiere.\n\n` +
    `• Deinen Namen setzen: /myname Max\n` +
    `• Tier speichern: /addpet Name [Art]  → z.B.  /addpet Jaxx Hund\n` +
    `• Profil anzeigen: /profile\n` +
    `• Zurücksetzen: /reset\n\n` +
    `Du kannst mir auch einfach schreiben oder ein Foto senden.`;
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
  await ctx.reply(`Super! Ich habe **${petName}**${species ? ` (${species})` : ""} gespeichert. 🐶🐱`, { parse_mode: "Markdown" });
});

bot.command("profile", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const p = getProfile(chatId);
  await ctx.reply("Aktuelles Profil:\n" + profileSummary(p));
});

bot.command("reset", async (ctx) => {
  const chatId = String(ctx.chat.id);
  clearProfile(chatId);
  await ctx.reply("Alles gelöscht. Wir starten frisch! Nutze /myname und /addpet, um neu zu beginnen.");
});

// ====== TEXT-Dialog ======
bot.on("text", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const userMessage = (ctx.message?.text || "").trim();
  if (!userMessage) return;

  // Heuristiken: Daten aus Freitext lernen
  maybeExtractData(chatId, userMessage);

  const profile = getProfile(chatId);
  const systemPrompt = buildSystemPrompt(profile);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content:
            `Nutzerprofil (aus Bot-Speicher): Halter=${profile.ownerName || "—"}; ` +
            `Tiere=${(profile.pets||[]).map(p=>p.name+(p.species?` (${p.species})`:"")).join(", ") || "—"}\n\n` +
            `Nachricht:\n${userMessage}`
        }
      ],
      temperature: 0.7,
      max_tokens: 700
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Entschuldige, ich konnte gerade keine Antwort generieren.";
    await ctx.reply(reply, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("OpenAI API Fehler:", error?.response?.data || error);
    await ctx.reply("Oh je, da ist etwas schiefgelaufen. Versuch es bitte gleich nochmal.");
  }
});

// ====== FOTO-Handler (Vision) ======
bot.on("photo", async (ctx) => {
  try {
    const sizes = ctx.message.photo || [];
    const fileId = sizes.at(-1).file_id; // größtes Bild
    const dataUrl = await telegramFileToBase64(ctx, fileId);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Du bist Seelenpfote, empathisch & fürsorglich. Beschreibe Haustier-Fotos vorsichtig, gib sanfte, praktische Tipps. Keine Ferndiagnosen." },
        {
          role: "user",
          content: [
            { type: "text", text: "Bitte hilf mir, dieses Haustier-Foto einzuschätzen und gib hilfreiche Hinweise." },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }
      ],
      temperature: 0.6,
      max_tokens: 600
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || "Ich konnte das Bild nicht auswerten.";
    await ctx.reply(reply, { parse_mode: "Markdown" });
  } catch (e) {
    console.error("Foto-Verarbeitung fehlgeschlagen:", e?.message || e);
    await ctx.reply("Hm, ich konnte dein Foto nicht verarbeiten. Sende es bitte nochmal als Foto (nicht als Datei) oder versuche ein anderes.");
  }
});

// ====== DOKUMENT-Handler (falls Bild als Datei gesendet) ======
bot.on("document", async (ctx) => {
  try {
    const mime = ctx.message.document?.mime_type || "";
    if (!mime.startsWith("image/")) {
      return ctx.reply("Sende bitte ein Bild (PNG/JPG) – als Foto oder als Bild-Datei.");
    }
    const fileId = ctx.message.document.file_id;
    const dataUrl = await telegramFileToBase64(ctx, fileId);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Du bist Seelenpfote, empathisch & fürsorglich. Beschreibe Haustier-Bilder vorsichtig, gib praktische Hinweise. Keine Ferndiagnosen." },
        {
          role: "user",
          content: [
            { type: "text", text: "Bitte bewerte dieses Bild meines Tieres und gib sanfte, pragmatische Tipps." },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }
      ],
      temperature: 0.6,
      max_tokens: 600
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || "Ich konnte das Bild nicht auswerten.";
    await ctx.reply(reply, { parse_mode: "Markdown" });
  } catch (e) {
    console.error("Dokument-Verarbeitung fehlgeschlagen:", e?.message || e);
    await ctx.reply("Ich konnte die Bild-Datei nicht verarbeiten. Bitte versuche es nochmal.");
  }
});

// ====== START (Webhook bevorzugt, sonst Polling) ======
(async () => {
  try {
    if (PUBLIC_URL) {
      const pathSuffix = `/telegram/${BOT_TOKEN.slice(-12)}`;
      await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {});
      await bot.telegram.setWebhook(`${PUBLIC_URL}${pathSuffix}`);

      const app = express();
      app.use(express.json());
      app.use(bot.webhookCallback(pathSuffix));
      app.get("/", (_req, res) => res.status(200).send("OK")); // Healthcheck

      http.createServer(app).listen(PORT, () => {
        console.log(`✅ Webhook aktiv: ${PUBLIC_URL}${pathSuffix} (Port ${PORT})`);
      });
    } else {
      await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {});
      await bot.launch();
      console.log("✅ Polling aktiv (kein PUBLIC_URL gesetzt).");
    }
  } catch (err) {
    console.error("Startfehler:", err);
    process.exit(1);
  }
})();

// ====== CLEAN SHUTDOWN & CRASH-SCHUTZ ======
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e));









