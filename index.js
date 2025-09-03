// Seelenpfote Telegram-Bot (Polling only, Hunde & Katzen, empathisch, Notdienst-Suche mit Standort)
// Features: per-User-Memory, Foto-Analyse (OpenAI Vision), Red-Flag-Erkennung -> Standort anfragen -> Vets suchen (OSM/Overpass), JSON-Persistenz

const { Telegraf } = require("telegraf");
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");

// ====== ENV ======
const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!BOT_TOKEN) { console.error("Fehler: BOT_TOKEN fehlt"); process.exit(1); }
if (!OPENAI_API_KEY) { console.error("Fehler: OPENAI_API_KEY fehlt"); process.exit(1); }

const bot = new Telegraf(BOT_TOKEN);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ====== PERSISTENZ (JSON) ======
const DB_FILE = path.join(__dirname, "data.json");
/** DB.users[chatId] = { ownerName, pets:[{name,species}], notes, pending: 'vet'|null } */
let DB = { users: {} };

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
  if (!DB.users[chatId]) DB.users[chatId] = { ownerName: null, pets: [], notes: "", pending: null };
  return DB.users[chatId];
}
function setOwnerName(chatId, name) {
  const p = getProfile(chatId);
  p.ownerName = name;
  saveDB();
}
function normalizeSpecies(sp) {
  if (!sp) return null;
  const s = sp.toLowerCase().trim();
  if (["hund", "dog", "hündin", "rüde", "welpe"].includes(s)) return "hund";
  if (["katze", "kater", "cat", "kätzchen"].includes(s)) return "katze";
  return null;
}
function addPet(chatId, name, speciesRaw) {
  const species = normalizeSpecies(speciesRaw || "");
  if (!species) return false; // nur Hund/Katze
  const p = getProfile(chatId);
  if (!p.pets) p.pets = [];
  const idx = p.pets.findIndex(x => x.name?.toLowerCase() === name.toLowerCase());
  if (idx >= 0) p.pets[idx] = { name, species };
  else p.pets.push({ name, species });
  saveDB();
  return true;
}
function clearProfile(chatId) {
  DB.users[chatId] = { ownerName: null, pets: [], notes: "", pending: null };
  saveDB();
}
function profileSummary(p) {
  const pets = (p.pets || []).map(t => `${t.name}${t.species ? ` (${t.species})` : ""}`).join(", ");
  return `Halter: ${p.ownerName || "—"} | Tiere: ${pets || "—"}${p.notes ? ` | Notizen: ${p.notes}` : ""}`;
}

// ====== PROMPTING ======
function buildSystemPrompt(profile) {
  const who =
    `Du bist "Seelenpfote", ein warmherziger, mitfühlender Begleiter für Tierhalter:innen. ` +
    `Du unterstützt ausschließlich HUNDE und KATZEN. Für andere Tiere lehnst du freundlich ab und empfiehlst, eine geeignete Tierpraxis zu kontaktieren. ` +
    `Du sprichst wie ein vertrauter Freund, bleibst professionell, beruhigst und stärkst. ` +
    `Gib konkrete, machbare Schritte. Bei ernsten Symptomen rätst du klar zum Tierarzt/Notdienst.`;

  const memory =
    `Bekannte Infos:\n` +
    `- Halter: ${profile.ownerName || "unbekannt"}\n` +
    `- Tiere: ${
      (profile.pets && profile.pets.length)
        ? profile.pets.map(p => `${p.name}${p.species ? ` (${p.species})` : ""}`).join(", ")
        : "keine gespeichert"
    }\n`;

  const style =
    `Stil:\n` +
    `- Begrüße persönlich (nutze Halternamen) und nenne Tiere namentlich.\n` +
    `- Verwende 1–3 passende Emojis (z.B. 🐾❤️🙂) – dezent.\n` +
    `- Aktives Zuhören: fasse das Anliegen kurz in eigenen Worten zusammen.\n` +
    `- Klare Handlungsschritte als kurze Bulletpoints; einfacher Wortschatz.\n` +
    `- Freundlicher, kurzer Abschluss mit Rückfrage.\n` +
    `- Keine Ferndiagnosen; bei Red Flags: Tierarzt/Notdienst empfehlen.\n` +
    `- Erinnere daran, dass Seelenpfote nur Hunde & Katzen unterstützt.`;

  const fewshot =
    `Beispiel (Hund):\n` +
    `User: "Mein Hund Jaxx frisst seit gestern kaum."\n` +
    `Assistent: "Oh je, das tut mir leid, ${profile.ownerName || "du"}. ❤️ Ich höre: Jaxx frisst seit gestern wenig. \n• Prüfe heute Wasseraufnahme & Energie.\n• Biete leicht verdauliches Futter (Huhn+Reis) in kleinen Portionen an.\n• Achte auf Erbrechen, Durchfall oder Schmerzen.\n• Wenn Jaxx apathisch wirkt oder >24h gar nicht frisst → bitte Tierarzt. \nMagst du mir sagen, wie Jaxx sonst drauf ist? 🐾"\n\n` +
    `Beispiel (Nicht Hund/Katze):\n` +
    `User: "Mein Kaninchen frisst nicht."\n` +
    `Assistent: "Danke fürs Vertrauen. Ich bin auf Hunde & Katzen spezialisiert 🐾. Für Kaninchen wende dich bitte an eine kleintierkundige Praxis oder den Notdienst – das kann dringend sein. ❤️"`; 

  return `${who}\n\n${memory}\n${style}\n\n${fewshot}`;
}

// ====== EMPATHISCHE NACHBEARBEITUNG ======
function friendlyFinish(text, profile) {
  const hasEmoji = /[\u231A-\uD83E\uDDFF]/.test(text);
  let out = (text || "").trim();

  if (!hasEmoji) out = out + " 🐾";
  const hasClosing = /(alles klar|hilft dir das|noch etwas|wie geht es|ist das okay|klingt das gut|magst du mir|soll ich)/i.test(out);
  if (!hasClosing) {
    out += `\n\n${profile.ownerName ? profile.ownerName + ", " : ""}magst du mir kurz sagen, wie es ${profile.pets?.[0]?.name || "deinem Tier"} gerade geht? ❤️`;
  }
  return out;
}

// ====== HEURISTIK: Namen/Tiere aus Freitext erkennen (nur Hund/Katze) ======
function maybeExtractData(chatId, text) {
  const nameMatch = text.match(/\bmein\s+name\s+ist\s+([A-Za-zÀ-ÿ' -]{2,40})/i);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    setOwnerName(chatId, name);
  }
  const petMatch = text.match(/\b(mein(?:e)?|unsere?)\s+(hund|katze|kater|welpe|kätzchen)\s+(heißt|ist)\s+([A-Za-zÀ-ÿ' -]{2,40})/i);
  if (petMatch) {
    const species = normalizeSpecies(petMatch[2]);
    const petName = petMatch[4].trim();
    if (species) addPet(chatId, petName, species);
  }
}

// ====== RED-FLAGS (schnelle SOS-Erkennung) ======
function isRedFlag(text) {
  const t = (text || "").toLowerCase();
  // einfache Muster — erweitere bei Bedarf
  const patterns = [
    /atemnot|keine luft|keine luft bekommt|keucht|blau\/?blasse zunge/,
    /starke blutung|viel blut|nicht zu stoppen/,
    /krampf|krampft|krampfanfall|anfälle/,
    /vergiftung|gift|schokolade|trauben|xylit|medikament/,
    /apathisch|bewusstlos|kollabiert/,
    />\s*24\s*h.*nicht (frisst|isst|trinkt)/,
    /fremdkörper|knochen steckt|verschluckt/,
    /augenverletzung|offene wunde|brüche/
  ];
  return patterns.some(re => re.test(t));
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

// ====== MAPS/NOTDIENST ======
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function findNearbyVets(lat, lon, radiusMeters = 8000, limit = 6) {
  // Overpass-Query: amenity=veterinary in Umkreis
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="veterinary"](around:${radiusMeters},${lat},${lon});
      way["amenity"="veterinary"](around:${radiusMeters},${lat},${lon});
      relation["amenity"="veterinary"](around:${radiusMeters},${lat},${lon});
    );
    out center tags;
  `.trim();
  const resp = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: new URLSearchParams({ data: query }).toString()
  });
  if (!resp.ok) throw new Error(`Overpass API Fehler: ${resp.status} ${resp.statusText}`);
  const data = await resp.json();

  const results = (data.elements || []).map(el => {
    const name = el.tags?.name || "Tierarztpraxis";
    const lat2 = el.lat || el.center?.lat;
    const lon2 = el.lon || el.center?.lon;
    const dist = (lat2 && lon2) ? haversineKm(lat, lon, lat2, lon2) : null;
    return { name, lat: lat2, lon: lon2, dist };
  }).filter(x => x.lat && x.lon);

  results.sort((a,b) => (a.dist ?? 1e9) - (b.dist ?? 1e9));
  return results.slice(0, limit);
}

function formatVetList(vets, lat, lon) {
  if (!vets.length) return "Ich habe in der Nähe leider nichts gefunden. Versuche es bitte erneut oder prüfe größere Umgebung. ❤️";
  const lines = vets.map(v => {
    const km = v.dist != null ? `${v.dist.toFixed(1)} km` : "";
    const gmaps = `https://www.google.com/maps?q=${v.lat},${v.lon}`;
    const osm = `https://www.openstreetmap.org/?mlat=${v.lat}&mlon=${v.lon}#map=18/${v.lat}/${v.lon}`;
    return `• *${v.name}* – ${km}\n  [🗺️ Google Maps](${gmaps}) | [🧭 OSM](${osm})`;
  });
  return `Hier sind nahegelegene Tierarztpraxen/Notdienste:\n\n${lines.join("\n\n")}\n\nGute Besserung – ich bin bei euch. ❤️`;
}

const requestLocationKeyboard = {
  reply_markup: {
    keyboard: [[{ text: "📍 Standort senden", request_location: true }]],
    resize_keyboard: true,
    one_time_keyboard: true
  }
};

// ====== ONLY-DOG/CAT GUARD ======
function mentionsNonDogCat(text) {
  const t = (text || "").toLowerCase();
  return /\b(kaninchen|hase|meerschweinchen|hamster|pferd|pony|vogel|papagei|schildkröte|schlange|echse|fisch|ratte|maus|igel|frettchen|ziege|huhn|ente|bartagame)\b/.test(t);
}

// ====== COMMANDS ======
bot.start(async (ctx) => {
  const chatId = String(ctx.chat.id);
  const p = getProfile(chatId);
  const intro =
    `Hey ${p.ownerName ? p.ownerName : "und herzlich willkommen"}! 🐾\n` +
    `Ich bin **Seelenpfote**, dein einfühlsamer Begleiter für **Hunde & Katzen**. ` +
    `Ich kann bei Notfällen deinen Standort anfragen und dir direkt **Tierärzte/Notdienste in der Nähe** zeigen.\n\n` +
    `• Deinen Namen setzen: /myname Max\n` +
    `• Tier speichern: /addpet Name (Hund|Katze)  → z.B.  /addpet Jaxx Hund\n` +
    `• Profil anzeigen: /profile\n` +
    `• Zurücksetzen: /reset\n` +
    `• Notdienst suchen: /notdienst (ich frage dann nach deinem Standort)\n\n` +
    `Schreib mir einfach oder sende ein Foto von deinem Hund/deiner Katze. ❤️`;
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
  if (args.length < 2) {
    return ctx.reply("Bitte so verwenden:  /addpet Name (Hund|Katze)\nBeispiel: /addpet Jaxx Hund");
  }
  const petName = args[0];
  const speciesRaw = args.slice(1).join(" ");
  const ok = addPet(chatId, petName, speciesRaw);
  if (!ok) {
    return ctx.reply("Ich unterstütze aktuell nur **Hunde & Katzen**. Bitte nutze: /addpet Name (Hund|Katze) ❤️", { parse_mode: "Markdown" });
  }
  await ctx.reply(`Super! Ich habe **${petName}** (${normalizeSpecies(speciesRaw)}) gespeichert. 🐶🐱`, { parse_mode: "Markdown" });
});

bot.command("profile", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const p = getProfile(chatId);
  await ctx.reply("Aktuelles Profil:\n" + profileSummary(p));
});

bot.command("reset", async (ctx) => {
  const chatId = String(ctx.chat.id);
  clearProfile(chatId);
  await ctx.reply("Alles gelöscht. Wir starten frisch! Nutze /myname und /addpet, um neu zu beginnen. ❤️");
});

bot.command("notdienst", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const p = getProfile(chatId);
  p.pending = "vet"; saveDB();
  await ctx.reply(
    "Gern – schick mir bitte deinen Standort, damit ich nahegelegene Tierärzte/Notdienste finden kann. ❤️",
    { parse_mode: "Markdown", ...requestLocationKeyboard }
  );
});

// ====== LOCATION-HANDLER ======
bot.on("location", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const p = getProfile(chatId);
  const { latitude, longitude } = ctx.message.location || {};
  if (!latitude || !longitude) return;

  if (p.pending === "vet") {
    try {
      await ctx.reply("Einen Moment, ich suche Tierärzte/Notdienste in deiner Nähe … 🐾");
      const vets = await findNearbyVets(latitude, longitude, 8000, 6);
      const text = formatVetList(vets, latitude, longitude);
      await ctx.reply(text, { parse_mode: "Markdown", disable_web_page_preview: false });
    } catch (e) {
      console.error("Vet-Suche fehlgeschlagen:", e?.message || e);
      await ctx.reply("Ich konnte gerade nichts finden. Bitte versuche es in ein paar Minuten erneut oder erweitere den Suchradius. ❤️");
    } finally {
      p.pending = null; saveDB();
    }
  } else {
    // Standort kam ohne Anforderung – biete Notdienst-Suche an
    await ctx.reply(
      "Danke für deinen Standort! Soll ich Tierärzte/Notdienste in der Nähe suchen? Sende dafür: /notdienst 🐾"
    );
  }
});

// ====== TEXT-Dialog ======
bot.on("text", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const userMessage = (ctx.message?.text || "").trim();
  if (!userMessage) return;

  // Nicht Hund/Katze -> freundlich ablehnen
  if (mentionsNonDogCat(userMessage)) {
    return ctx.reply(
      "Danke fürs Vertrauen! Ich bin speziell für **Hunde & Katzen** da 🐾. Für andere Tiere wende dich bitte an eine passende Tierarztpraxis oder den Notdienst – dort bist du bestens aufgehoben. ❤️",
      { parse_mode: "Markdown" }
    );
  }

  // Heuristiken: Daten aus Freitext lernen
  maybeExtractData(chatId, userMessage);

  // Red-Flag? -> sofort Standort anfragen
  if (isRedFlag(userMessage)) {
    const p = getProfile(chatId);
    p.pending = "vet"; saveDB();
    await ctx.reply(
      "Das klingt nach einem möglichen Notfall. Bitte **geh zeitnah zum Tierarzt**. Ich suche dir gern sofort Hilfe in der Nähe – sende mir dafür bitte deinen Standort. ❤️",
      { parse_mode: "Markdown", ...requestLocationKeyboard }
    );
    // Trotzdem eine kurze empathische Antwort generieren (optional, aber hilfreich)
  }

  const profile = getProfile(chatId);
  const systemPrompt = buildSystemPrompt(profile);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "assistant", content: `Hi ${profile.ownerName || "du"}! Ich bin Seelenpfote 🐾 – ich bin bei dir und helfe dir Schritt für Schritt.` },
        {
          role: "user",
          content:
            `Nutzerprofil: Halter=${profile.ownerName || "—"}; ` +
            `Tiere=${(profile.pets||[]).map(p=>p.name+(p.species?` (${p.species})`:"")).join(", ") || "—"}\n\n` +
            `Nachricht:\n${userMessage}`
        }
      ],
      temperature: 0.85,
      presence_penalty: 0.3,
      max_tokens: 700
    });

    const raw =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Entschuldige, ich konnte gerade keine Antwort generieren.";
    const friendly = friendlyFinish(raw, profile);
    await ctx.reply(friendly, { parse_mode: "Markdown", disable_web_page_preview: true });
  } catch (error) {
    console.error("OpenAI API Fehler:", error?.response?.data || error);
    await ctx.reply("Oh je, da ist etwas schiefgelaufen. Versuch es bitte gleich nochmal. ❤️");
  }
});

// ====== FOTO-Handler (Vision) ======
bot.on("photo", async (ctx) => {
  try {
    const sizes = ctx.message.photo || [];
    const fileId = sizes.at(-1).file_id; // größtes Bild
    const dataUrl = await telegramFileToBase64(ctx, fileId);
    const profile = getProfile(String(ctx.chat.id));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Du bist Seelenpfote: empathisch, beruhigend, nur Hunde & Katzen. Wenn das Bild kein Hund/Katze zeigt, freundlich ablehnen und an Praxis/Notdienst verweisen." },
        {
          role: "user",
          content: [
            { type: "text", text: "Dieses Foto zeigt meinen Hund oder meine Katze. Bitte bewerte vorsichtig und gib sanfte, praktische Tipps (keine Ferndiagnosen)." },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }
      ],
      temperature: 0.6,
      max_tokens: 600
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "Ich konnte das Bild nicht auswerten.";
    const friendly = friendlyFinish(raw, profile);
    await ctx.reply(friendly, { parse_mode: "Markdown", disable_web_page_preview: true });
  } catch (e) {
    console.error("Foto-Verarbeitung fehlgeschlagen:", e?.message || e);
    await ctx.reply("Hm, ich konnte dein Foto nicht verarbeiten. Sende es bitte nochmal als Foto (nicht als Datei) oder versuche ein anderes. ❤️");
  }
});

// ====== DOKUMENT-Handler (falls Bild als Datei gesendet) ======
bot.on("document", async (ctx) => {
  try {
    const mime = ctx.message.document?.mime_type || "";
    if (!mime.startsWith("image/")) {
      return ctx.reply("Sende bitte ein Bild (PNG/JPG) – als Foto oder als Bild-Datei. ❤️");
    }
    const fileId = ctx.message.document.file_id;
    const dataUrl = await telegramFileToBase64(ctx, fileId);
    const profile = getProfile(String(ctx.chat.id));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Du bist Seelenpfote: empathisch, beruhigend, nur Hunde & Katzen. Wenn das Bild kein Hund/Katze zeigt, freundlich ablehnen und an Praxis/Notdienst verweisen." },
        {
          role: "user",
          content: [
            { type: "text", text: "Dieses Bild ist von meinem Hund oder meiner Katze. Bitte gib mir sanfte, praktische Tipps (keine Ferndiagnosen)." },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }
      ],
      temperature: 0.6,
      max_tokens: 600
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "Ich konnte das Bild nicht auswerten.";
    const friendly = friendlyFinish(raw, profile);
    await ctx.reply(friendly, { parse_mode: "Markdown", disable_web_page_preview: true });
  } catch (e) {
    console.error("Dokument-Verarbeitung fehlgeschlagen:", e?.message || e);
    await ctx.reply("Ich konnte die Bild-Datei nicht verarbeiten. Bitte versuche es nochmal. ❤️");
  }
});

// ====== START (POLLING) ======
(async () => {
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {});
    await bot.launch();
    console.log("✅ Polling aktiv. (Bitte nur 1 Instanz laufen lassen!)");
  } catch (err) {
    console.error("Startfehler:", err);
    process.exit(1);
  }
})();

// ====== CLEAN SHUTDOWN ======
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e));











