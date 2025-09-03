// Seelenpfote Telegram-Bot (Polling only)
// Hunde & Katzen, empathisch, Memory (Name/Tiere), Red-Flag -> Standort & Notdienst (OSM/Overpass),
// Vision: fokussiert auf beschriebene Auffälligkeit (keine generischen Pflegetipps), JSON-Persistenz.

const { Telegraf } = require("telegraf");
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");

// ===== ENV =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!BOT_TOKEN) { console.error("Fehler: BOT_TOKEN fehlt"); process.exit(1); }
if (!OPENAI_API_KEY) { console.error("Fehler: OPENAI_API_KEY fehlt"); process.exit(1); }

const bot = new Telegraf(BOT_TOKEN);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ===== Persistenz (JSON) =====
const DB_FILE = path.join(__dirname, "data.json");
/**
 * DB.users[chatId] = {
 *   ownerName: string|null,
 *   pets: [{name, species:'hund'|'katze'}],
 *   notes: string,
 *   pending: 'vet'|null,
 *   lastIssue: string|null // letzte textliche Beschreibung (z.B. "Beule über der Nase")
 * }
 */
let DB = { users: {} };

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf8");
      DB = JSON.parse(raw || "{}") || { users: {} };
      DB.users = DB.users || {};
    }
  } catch (e) { console.error("Konnte data.json nicht lesen:", e); }
}
function saveDB() {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(DB, null, 2), "utf8"); }
  catch (e) { console.error("Konnte data.json nicht speichern:", e); }
}
loadDB();

function getProfile(chatId) {
  if (!DB.users[chatId]) DB.users[chatId] = { ownerName: null, pets: [], notes: "", pending: null, lastIssue: null };
  return DB.users[chatId];
}
function setOwnerName(chatId, name) { const p = getProfile(chatId); p.ownerName = name; saveDB(); }
function normalizeSpecies(sp) {
  if (!sp) return null;
  const s = sp.toLowerCase().trim();
  if (["hund", "dog", "hündin", "rüde", "welpe"].includes(s)) return "hund";
  if (["katze", "kater", "cat", "kätzchen"].includes(s)) return "katze";
  return null;
}
function addPet(chatId, name, speciesRaw) {
  const species = normalizeSpecies(speciesRaw || "");
  if (!species) return false;
  const p = getProfile(chatId);
  if (!p.pets) p.pets = [];
  const idx = p.pets.findIndex(x => x.name?.toLowerCase() === name.toLowerCase());
  if (idx >= 0) p.pets[idx] = { name, species };
  else p.pets.push({ name, species });
  saveDB();
  return true;
}
function clearProfile(chatId) {
  DB.users[chatId] = { ownerName: null, pets: [], notes: "", pending: null, lastIssue: null };
  saveDB();
}
function profileSummary(p) {
  const pets = (p.pets || []).map(t => `${t.name}${t.species ? ` (${t.species})` : ""}`).join(", ");
  return `Halter: ${p.ownerName || "—"} | Tiere: ${pets || "—"}${p.notes ? ` | Notizen: ${p.notes}` : ""}`;
}

// ===== Prompting =====
function buildSystemPrompt(profile) {
  const who =
    `Du bist "Seelenpfote", ein warmherziger, mitfühlender Begleiter. ` +
    `Du unterstützt ausschließlich HUNDE und KATZEN (andere Tiere freundlich ablehnen). ` +
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
    `- Persönliche Ansprache; bekannte Tiernamen nutzen.\n` +
    `- 1–3 passende Emojis (🐾❤️🙂) dezent.\n` +
    `- Kurze, klare Sätze; Bulletpoints für Schritte.\n` +
    `- **Kein Fragesatz als Abschluss** – warm & ermutigend enden.\n` +
    `- Keine Ferndiagnosen; bei Red Flags klar Notdienst empfehlen.`;

  const visionFocus =
    `WICHTIG (Vision): Wenn es um ein Foto mit einer beschriebenen Auffälligkeit geht (z. B. "Beule über der Nase"), ` +
    `FOKUSSIERE dich ausschließlich darauf. **Keine generischen Pflege-Listen**. Sag, worauf zu achten ist (Größe, Rötung, Wärme, Schmerz, Verhalten), ` +
    `wann Tierarzt sinnvoll ist, und gib 2–5 gezielte Beobachtungs-/Handlungs-Schritte.`;

  return `${who}\n\n${memory}\n${style}\n\n${visionFocus}`;
}

// ===== Abschluss ohne Frage-Spam =====
function friendlyFinish(text) {
  let out = (text || "").trim();
  const hasEmoji = /[\u231A-\uD83E\uDDFF]/.test(out);
  if (!hasEmoji) out += " 🐾";
  if (!/❤️$/.test(out) && !/❤️/.test(out)) out += " ❤️";
  return out;
}

// ===== Heuristik: Namen/Tiere + letzte Auffälligkeit merken =====
function maybeExtractData(chatId, text) {
  const p = getProfile(chatId);
  const nameMatch = text.match(/\bmein\s+name\s+ist\s+([A-Za-zÀ-ÿ' -]{2,40})/i);
  if (nameMatch) setOwnerName(chatId, nameMatch[1].trim());

  const petMatch = text.match(/\b(mein(?:e)?|unsere?)\s+(hund|katze|kater|welpe|kätzchen)\s+(heißt|ist)\s+([A-Za-zÀ-ÿ' -]{2,40})/i);
  if (petMatch) {
    const species = normalizeSpecies(petMatch[2]);
    const petName = petMatch[4].trim();
    if (species) addPet(chatId, petName, species);
  }

  // „Letzte Auffälligkeit“ grob aus Text übernehmen (z.B. "Beule über der Nase")
  const issueCandidates = [
    /beule[^.?!\n]*/i, /schwellung[^.?!\n]*/i, /wunde[^.?!\n]*/i, /rötung[^.?!\n]*/i,
    /laufschwierigkeiten[^.?!\n]*/i, /humpeln[^.?!\n]*/i, /erbrechen[^.?!\n]*/i,
  ];
  for (const re of issueCandidates) {
    const m = text.match(re);
    if (m) { p.lastIssue = m[0].trim(); saveDB(); break; }
  }
}

// ===== Red-Flags (SOS) =====
function isRedFlag(text) {
  const t = (text || "").toLowerCase();
  const patterns = [
    /atemnot|keine luft|keucht|blau(e|e?) zunge|blasse zunge/,
    /starke blutung|viel blut|nicht zu stoppen/,
    /krampf|krampft|krampfanfall|anfälle/,
    /vergiftung|gift|schokolade|trauben|xylit|medikament/,
    /apathisch|bewusstlos|kollabiert/,
    />\s*24\s*h.*nicht (frisst|isst|trinkt)/,
    /fremdkörper|knochen steckt|verschluckt/,
    /augenverletzung|offene wunde|bruch|brüche/
  ];
  return patterns.some(re => re.test(t));
}

// ===== Telegram-Datei -> Base64 (für Vision) =====
async function telegramFileToBase64(ctx, fileId) {
  const file = await ctx.telegram.getFile(fileId);
  if (!file?.file_path) throw new Error("Kein file_path erhalten.");
  const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download fehlgeschlagen: ${res.status} ${res.statusText}`);
  const buf = await res.arrayBuffer();
  const ext = (file.file_path.split('.').pop() || 'jpg').toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
  const b64 = Buffer.from(buf).toString('base64');
  return `data:${mime};base64,${b64}`;
}

// ===== Vet-Suche (OSM/Overpass) =====
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
async function findNearbyVets(lat, lon, radiusMeters = 8000, limit = 6) {
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
function formatVetList(vets) {
  if (!vets.length) return "Ich habe in der Nähe leider nichts gefunden. Versuche es später erneut oder erweitere die Umgebung. 🐾❤️";
  const lines = vets.map(v => {
    const km = v.dist != null ? `${v.dist.toFixed(1)} km` : "";
    const gmaps = `https://www.google.com/maps?q=${v.lat},${v.lon}`;
    const osm = `https://www.openstreetmap.org/?mlat=${v.lat}&mlon=${v.lon}#map=18/${v.lat}/${v.lon}`;
    return `• *${v.name}* – ${km}\n  [🗺️ Google Maps](${gmaps}) | [🧭 OSM](${osm})`;
  });
  return `Hier sind nahegelegene Tierarztpraxen/Notdienste:\n\n${lines.join("\n\n")}\n\nGute Besserung – ihr schafft das. 🐾❤️`;
}
const requestLocationKeyboard = {
  reply_markup: {
    keyboard: [[{ text: "📍 Standort senden", request_location: true }]],
    resize_keyboard: true,
    one_time_keyboard: true
  }
};

// ===== Guards =====
function mentionsNonDogCat(text) {
  const t = (text || "").toLowerCase();
  return /\b(kaninchen|hase|meerschweinchen|hamster|pferd|pony|vogel|papagei|schildkröte|schlange|echse|fisch|ratte|maus|igel|frettchen|ziege|huhn|ente|bartagame)\b/.test(t);
}

// ===== Commands =====
bot.start(async (ctx) => {
  const chatId = String(ctx.chat.id);
  const p = getProfile(chatId);
  const intro =
    `Hey ${p.ownerName ? p.ownerName : "und herzlich willkommen"}! 🐾\n` +
    `Ich bin **Seelenpfote**, dein einfühlsamer Begleiter für **Hunde & Katzen**. ` +
    `Bei Notfällen kann ich deinen Standort anfragen und dir direkt **Tierärzte/Notdienste** in der Nähe zeigen.\n\n` +
    `• Namen setzen: /myname Max\n` +
    `• Tier speichern: /addpet Name (Hund|Katze)  → z.B.  /addpet Jaxx Hund\n` +
    `• Profil anzeigen: /profile\n` +
    `• Zurücksetzen: /reset\n` +
    `• Notdienst suchen: /notdienst\n\n` +
    `Schreib mir einfach oder sende ein Foto – beschreibe dabei kurz die Auffälligkeit (z. B. "Beule über der Nase"). ❤️`;
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
    return ctx.reply("Ich unterstütze aktuell nur **Hunde & Katzen**. Bitte nutze: /addpet Name (Hund|Katze) 🐾", { parse_mode: "Markdown" });
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
  await ctx.reply("Alles gelöscht. Wir starten frisch! ❤️");
});

bot.command("notdienst", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const p = getProfile(chatId);
  p.pending = "vet"; saveDB();
  await ctx.reply(
    "Gern – sende mir bitte deinen Standort, dann zeige ich dir die nächsten Tierärzte/Notdienste. 🐾",
    { parse_mode: "Markdown", ...requestLocationKeyboard }
  );
});

// ===== Standort =====
bot.on("location", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const p = getProfile(chatId);
  const { latitude, longitude } = ctx.message.location || {};
  if (!latitude || !longitude) return;

  if (p.pending === "vet") {
    try {
      await ctx.reply("Einen Moment, ich suche Tierärzte/Notdienste in deiner Nähe … 🐾");
      const vets = await findNearbyVets(latitude, longitude, 8000, 6);
      const text = formatVetList(vets);
      await ctx.reply(text, { parse_mode: "Markdown", disable_web_page_preview: false });
    } catch (e) {
      console.error("Vet-Suche fehlgeschlagen:", e?.message || e);
      await ctx.reply("Ich konnte gerade nichts finden. Versuche es bitte später erneut oder erweitere die Umgebung. 🐾❤️");
    } finally {
      p.pending = null; saveDB();
    }
  } else {
    await ctx.reply("Danke für deinen Standort! Sende /notdienst, wenn ich in deiner Nähe suchen soll. 🐾");
  }
});

// ===== Text-Dialog =====
bot.on("text", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const userMessage = (ctx.message?.text || "").trim();
  if (!userMessage) return;

  // Nur Hunde/Katzen
  if (mentionsNonDogCat(userMessage)) {
    return ctx.reply(
      "Ich bin speziell für **Hunde & Katzen** da. Für andere Tiere ist eine passende Tierarztpraxis die beste Wahl. 🐾❤️",
      { parse_mode: "Markdown" }
    );
  }

  // Daten & letzte Auffälligkeit merken
  maybeExtractData(chatId, userMessage);

  // Red Flags -> Standort anbieten
  if (isRedFlag(userMessage)) {
    const p = getProfile(chatId);
    p.pending = "vet"; saveDB();
    await ctx.reply(
      "Das klingt dringend. Bitte suche zeitnah eine Tierarztpraxis auf. Ich helfe dir sofort mit Adressen in der Nähe – sende mir einfach deinen Standort. 🐾❤️",
      { parse_mode: "Markdown", ...requestLocationKeyboard }
    );
  }

  const profile = getProfile(chatId);
  const systemPrompt = buildSystemPrompt(profile);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "assistant", content: `Hi ${profile.ownerName || "du"}! Ich bin Seelenpfote 🐾 – ich helfe dir Schritt für Schritt.` },
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

    const raw = completion.choices?.[0]?.message?.content?.trim() ||
      "Entschuldige, ich konnte gerade keine Antwort generieren.";
    const friendly = friendlyFinish(raw);
    await ctx.reply(friendly, { parse_mode: "Markdown", disable_web_page_preview: true });
  } catch (error) {
    console.error("OpenAI API Fehler:", error?.response?.data || error);
    await ctx.reply("Oh je, da ist etwas schiefgelaufen. Versuch es bitte gleich nochmal. 🐾❤️");
  }
});

// ===== Foto (Vision) – fokussiert auf beschriebene Auffälligkeit =====
function buildVisionFocusText(ctx, chatId) {
  // nutze erst die Bild-Unterschrift, sonst letzte textliche Beschreibung
  const cap = (ctx.message.caption || "").trim();
  const p = getProfile(chatId);
  const last = p.lastIssue ? ` (letzte Beschreibung: ${p.lastIssue})` : "";
  return cap ? cap : (p.lastIssue ? p.lastIssue : "auffällige Stelle");
}

bot.on("photo", async (ctx) => {
  try {
    const chatId = String(ctx.chat.id);
    const sizes = ctx.message.photo || [];
    const fileId = sizes.at(-1).file_id;
    const dataUrl = await telegramFileToBase64(ctx, fileId);
    const profile = getProfile(chatId);
    const focus = buildVisionFocusText(ctx, chatId);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildSystemPrompt(profile) },
        { role: "assistant", content: "Ich beziehe mich ausschließlich auf die beschriebene Auffälligkeit und vermeide generische Pflegetipps." },
        {
          role: "user",
          content: [
            { type: "text", text: `Bitte schau **nur** auf folgendes: ${focus}. Sag mir, worauf ich achten soll (Größe, Rötung, Wärme, Schmerz, Verhalten) und wann Tierarzt sinnvoll ist. 2–5 kurze, praktische Schritte. Keine allgemeinen Haustierpflege-Listen.` },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }
      ],
      temperature: 0.6,
      max_tokens: 600
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "Ich konnte das Bild nicht auswerten.";
    const friendly = friendlyFinish(raw);
    await ctx.reply(friendly, { parse_mode: "Markdown", disable_web_page_preview: true });
  } catch (e) {
    console.error("Foto-Verarbeitung fehlgeschlagen:", e?.message || e);
    await ctx.reply("Ich konnte dein Foto nicht verarbeiten. Bitte sende es nochmal als Foto (nicht als Datei). 🐾❤️");
  }
});

// ===== Dokument-Bild (Vision) =====
bot.on("document", async (ctx) => {
  try {
    const chatId = String(ctx.chat.id);
    const mime = ctx.message.document?.mime_type || "";
    if (!mime.startsWith("image/")) {
      return ctx.reply("Sende bitte ein Bild (PNG/JPG) – als Foto oder als Bild-Datei. 🐾❤️");
    }
    const fileId = ctx.message.document.file_id;
    const dataUrl = await telegramFileToBase64(ctx, fileId);
    const profile = getProfile(chatId);
    const focus = buildVisionFocusText(ctx, chatId);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildSystemPrompt(profile) },
        { role: "assistant", content: "Ich beziehe mich ausschließlich auf die beschriebene Auffälligkeit und vermeide generische Pflegetipps." },
        {
          role: "user",
          content: [
            { type: "text", text: `Bitte schau **nur** auf folgendes: ${focus}. Gib 2–5 gezielte Beobachtungs-/Handlungsschritte; nenne, wann Tierarzt/Notdienst sinnvoll ist. Keine allgemeinen Listen.` },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }
      ],
      temperature: 0.6,
      max_tokens: 600
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "Ich konnte das Bild nicht auswerten.";
    const friendly = friendlyFinish(raw);
    await ctx.reply(friendly, { parse_mode: "Markdown", disable_web_page_preview: true });
  } catch (e) {
    console.error("Dokument-Verarbeitung fehlgeschlagen:", e?.message || e);
    await ctx.reply("Ich konnte die Bild-Datei nicht verarbeiten. Bitte versuche es erneut. 🐾❤️");
  }
});

// ===== Start (Polling) =====
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

// ===== Shutdown / Crash-Schutz =====
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e));













