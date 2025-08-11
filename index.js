// index.js — Seelenpfote (Telegram)
// Fotoanalyse → EXTERNER DIENST (kein OpenAI), dann Empathie
// Gesprächs-Status, Anti-Duplikat, Intents (humpeln/durchfall/erbrechen/zecke/schnitt/hitze)
// Railway Vars: TELEGRAM_BOT_TOKEN, ANALYSIS_URL, ANALYSIS_KEY (optional)

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// --- ENV ---
const TELEGRAM_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const ANALYSIS_URL   = (process.env.ANALYSIS_URL || '').trim();
const ANALYSIS_KEY   = (process.env.ANALYSIS_KEY || '').trim();

if (!TELEGRAM_TOKEN) {
  console.error('❌ Fehlt: TELEGRAM_BOT_TOKEN (Railway → Variables setzen)');
  process.exit(1);
}
if (!ANALYSIS_URL) {
  console.error('❌ Fehlt: ANALYSIS_URL (Endpoint deiner ausgelagerten Fotoanalyse)');
  process.exit(1);
}

// --- Bot ---
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
// Falls früher ein Webhook aktiv war: wegräumen
bot.deleteWebHook({ drop_pending_updates: true }).catch(() => {});

bot.getMe()
  .then(me => console.log('🤖 Eingeloggt als @' + me.username))
  .catch(err => {
    const msg = err?.response?.body ? JSON.stringify(err.response.body) : (err?.message || String(err));
    console.error('❌ Telegram-Token ungültig:', msg);
    process.exit(1);
  });

// ---------- Helpers ----------
const chatState = new Map(); // chatId -> { awaitingDetails: false, intent: null, lastMsg: "" }

function sendOnce(chatId, text, opts = {}) {
  const st = chatState.get(chatId) || {};
  if (st.lastMsg === text) return Promise.resolve();
  st.lastMsg = text;
  chatState.set(chatId, st);
  return bot.sendMessage(chatId, text, opts);
}

function careReply({ intro, bullets = [], outro }) {
  let msg = '';
  if (intro) msg += `${intro}\n\n`;
  if (bullets.length) msg += bullets.map(b => `• ${b}`).join('\n') + '\n\n';
  if (outro) msg += outro;
  return msg;
}

async function getTelegramFileUrl(fileId) {
  const f = await bot.getFile(fileId);
  return `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${f.file_path}`;
}

// Lade Bild selbst & konvertiere zu Base64-Data-URL (externen Fetch-Problemen vorbeugen)
async function loadImageAsDataUrl(fileUrl) {
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Bild-Download fehlgeschlagen: HTTP ${res.status}`);
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const arrayBuf = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuf).toString('base64');
  return `data:${contentType};base64,${base64}`;
}

// ---- EXTERNE FOTOANALYSE ----
// Erwartetes Response-Format deines Dienstes (Beispiel):
// { summary: "Kurze sachliche Bildbeschreibung ..." }
// Wenn dein Dienst anders antwortet, bitte Mapping unten anpassen.
async function analyzeExtern(dataUrl, extraPrompt = '') {
  // Timeout, damit wir nicht hängen bleiben
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20000); // 20s

  try {
    const payload = {
      image: dataUrl,            // Base64-Data-URL
      context: extraPrompt || '',// optional
    };

    const headers = { 'Content-Type': 'application/json' };
    if (ANALYSIS_KEY) headers['Authorization'] = `Bearer ${ANALYSIS_KEY}`;

    const res = await fetch(ANALYSIS_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(t);

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Analyse-Endpoint HTTP ${res.status} ${txt?.slice(0, 200)}`);
    }

    const json = await res.json().catch(() => ({}));
    // Mögliche Felder: summary / result / text
    const text = (json.summary || json.result || json.text || '').toString().trim();
    if (!text) throw new Error('Analyse-Endpoint lieferte kein "summary/result/text".');

    // Zur Sicherheit Markdown gefährliche Zeichen entschärfen, wir senden aber plain text
    return text.replace(/\r/g, '').trim();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Analyse-Endpoint Timeout (20s).');
    throw e;
  }
}

// ---------- Intents ----------
function detectIntent(text) {
  const t = (text || '').toLowerCase();
  if (/(humpel|lahm|lahmt|hinkt|zieht die pfote|schont die pfote|belastet kaum)/.test(t)) return 'limp';
  if (/(durchfall|flüssig(er)? kot|wässrig(er)? kot|diarrh)/.test(t)) return 'diarrhea';
  if (/(erbrech|kotzt|spuckt|übelkeit|galle|schäumt)/.test(t)) return 'vomit';
  if (/(zeck|zecke|tick)/.test(t)) return 'tick';
  if (/(schnitt|geschnitten|blutet|blutung|wunde|aufgerissen|verband)/.test(t)) return 'cut';
  if (/(hitz|überhitz|hechelt stark|kollaps in der hitze|sonnenstich|hitzschlag)/.test(t)) return 'heat';
  return null;
}

function intentIntro(intent) {
  switch (intent) {
    case 'limp':
      return '🚶‍♂️ Humpeln – wir schauen genau hin.\n' +
             '• Schonung: keine Treppen/kein Springen.\n' +
             '• Kühlen 10–15 Min., 2–3×/Tag (Tuch, kein Eis direkt).\n' +
             '• Kurze, ruhige Runden an der Leine.\n\n' +
             'Magst du mir kurz sagen: seit wann, Belastung (gar nicht/leicht), Schwellung/Wunde, Sturz/Umknicken? 💛';
    case 'diarrhea':
      return '💩 Durchfall – ruhig vorgehen.\n' +
             '• 6–8 h Futterpause (Wasser anbieten).\n' +
             '• Dann Schonkost: Reis + Huhn/Hüttenkäse in kleinen Portionen.\n' +
             '• Elektrolyte/Wasser häufiger anbieten.\n\n' +
             'Seit wann, Blut/Schleim, Erbrechen dazu, Fieber/Abgeschlagenheit, etwas Ungewöhnliches gefressen?';
    case 'vomit':
      return '🤢 Erbrechen – erst beruhigen, dann Schritte.\n' +
             '• 6–8 h Futterpause (Wasser in kleinen Mengen).\n' +
             '• Danach winzige Schonkost-Portionen (Huhn/Reis).\n\n' +
             'Wie oft, seit wann, Blut/Galle, zusätzlich Durchfall, Fremdkörper möglich, trinkt/uriniert normal?';
    case 'tick':
      return '🪳 Zecke – so entfernst du sie sicher:\n' +
             '• Mit Zeckenzange/karte hautnah am Kopf ansetzen, langsam gerade herausziehen.\n' +
             '• Stelle mit Wasser/Seife reinigen, trocken tupfen.\n' +
             '• 2–3 Wo. beobachten (Rötung/Schwellung?).\n\n' +
             'Ist der Kopf stecken geblieben oder wirkt die Stelle stark gereizt?';
    case 'cut':
      return '🩹 Schnitt/Blutung – wir stoppen & säubern.\n' +
             '• Druckverband 5–10 Min. mit sauberer Kompresse/Tuch.\n' +
             '• Danach mit lauwarmem Wasser spülen, Fremdkörper prüfen.\n' +
             '• Leichte Blutung: sauber abdecken, ruhig halten.\n\n' +
             'Wo ist die Wunde (Pfote/Bein/Bauch), wie groß, frisch starke Blutung oder eher oberflächlich?';
    case 'heat':
      return '🌡️ Verdacht auf Hitzestress – sofort handeln.\n' +
             '• Schatten/kühlen Raum, Ruhe.\n' +
             '• Pfoten/Bauch/Leisten mit *kühlem* (nicht eiskaltem) Wasser befeuchten.\n' +
             '• Kleine Wassermengen anbieten.\n\n' +
             'Taumeln, Kollaps, glasige Augen oder extrem angestrengtes Hecheln? → *sofort* Tierarzt/Notdienst.';
    default:
      return null;
  }
}

function intentFollowup(intent) {
  switch (intent) {
    case 'limp':
      return 'Danke, das hilft. 🐾\n' +
             '👉 Jetzt:\n' +
             '• Strikte Schonung 24–48 h, kühlen wie besprochen.\n' +
             '• Wunde? Sanft säubern, abdecken, Lecken verhindern (Socken/Trichter).\n' +
             '• Bei starker Schwellung/Schmerz/Fehlstellung oder keiner Besserung in 48 h → Tierarzt.\n' +
             '• Akut (nicht belastbar, Schreien, tiefe Wunde) → Notdienst.';
    case 'diarrhea':
      return 'Verstanden.\n' +
             '👉 Beobachtung & Schritte:\n' +
             '• Schonkost 1–2 Tage, kleine Portionen.\n' +
             '• Blut, starke Mattigkeit, Fieber, häufiges Erbrechen oder >48 h → Tierarzt.\n' +
             '• Welpe/Senior: lieber früher vorstellen (Austrocknung).';
    case 'vomit':
      return 'Alles klar.\n' +
             '👉 Weiter:\n' +
             '• Nach der Pause sehr kleine Schonkost-Portionen, langsam steigern.\n' +
             '• Viel Trinken in kleinen Mengen.\n' +
             '• Wiederholtes Erbrechen, Blut, Fremdkörperverdacht, Bauchschmerz oder Mattigkeit → Tierarzt.';
    case 'tick':
      return 'Gut gemacht.\n' +
             '👉 Beobachten:\n' +
             '• Stelle 2–3 Wo. prüfen (Rötung/Schwellung).\n' +
             '• Fieber, Appetitlosigkeit, Lahmheit → Tierarzt (Zeckenkrankheiten).\n' +
             '• Für die Zukunft: Prophylaxe besprechen.';
    case 'cut':
      return 'Danke dir.\n' +
             '👉 Weiter so:\n' +
             '• Täglich säubern, trocken halten, Lecken verhindern.\n' +
             '• Tiefe/klaffende Wunden, Sehnen sichtbar, starke Blutung oder stark betroffene Pfote → Tierarzt (Nähen/Versorgen).\n' +
             '• Entzündungszeichen (Rötung, Wärme, Eiter, Geruch) → vorstellen.';
    case 'heat':
      return 'Gut reagiert.\n' +
             '👉 Weiter kühlen (nicht eiskalt), Ruhe, kleine Wassermengen.\n' +
             '• Keine rasche Besserung oder Neurologie/Kollaps → *sofort* Tierarzt/Notdienst.\n' +
             '• Auch nach Besserung am selben Tag aufmerksam bleiben.';
    default:
      return null;
  }
}

// ---------- /start ----------
bot.onText(/^\/start\b/i, async (msg) => {
  const chatId = msg.chat.id;
  const hello =
    'Ich bin für dich da, wenn du dir Sorgen um dein Tier machst 🐕🐈\n' +
    'Schick mir ein Foto der Stelle – ich mache zuerst eine kurze Fotoanalyse 🔎\n' +
    'und gebe dir danach eine ruhige, einfühlsame Einschätzung. 💛';
  await sendOnce(chatId, hello).catch(err => console.error('❌ Send /start:', err?.message || err));
});

// ---------- Foto-Flow ----------
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const hasPhoto = Array.isArray(msg.photo) && msg.photo.length > 0;
  if (!hasPhoto) return;

  try {
    await bot.sendChatAction(chatId, 'typing');

    const best = msg.photo[msg.photo.length - 1];
    const fileUrl = await getTelegramFileUrl(best.file_id);

    // Bild laden → Data-URL (stabil für externen Dienst)
    const dataUrl = await loadImageAsDataUrl(fileUrl);

    // 1) Analyse (plain text senden, kein Markdown)
    const analysis = await analyzeExtern(dataUrl, 'Tierfoto vom Besitzer. Kurz & sachlich.');
    await sendOnce(chatId, `🔎 Fotoanalyse\n${analysis}`)
      .catch(err => console.error('❌ Send analysis:', err?.response?.body || err?.message || err));

    // 2) Empathische Folge
    const reply = careReply({
      intro: 'Ich bin bei dir 🐾❤️ – schreib mir kurz, damit ich dich gezielt anleiten kann:',
      bullets: [
        '🐶 Wo ist die Stelle genau? (Pfote, Bein, Auge, Bauch …)',
        '📏 Wie groß ungefähr? Rot, geschwollen oder feucht?',
        '🧭 Seit wann? Wird es besser oder schlimmer?',
        '⚠️ Leckt/kratzt dein Tier daran? Geruch/Sekret?',
      ],
      outro: 'Schick mir 1–2 Punkte – ich leite dich Schritt für Schritt an. Du machst das super 💪',
    });
    await sendOnce(chatId, reply);
  } catch (err) {
    console.error('❌ Foto‑Flow Fehler:', err?.message || err);
    await sendOnce(chatId, '⚠️ Da ist gerade etwas schiefgelaufen bei der Fotoanalyse. Bitte versuch es gleich nochmal.');
  }
});

// ---------- Text-Flow ----------
bot.on('text', async (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  if (/^\/start\b/i.test(text)) return;
  if (msg.photo && msg.photo.length) return;

  const st = chatState.get(chatId) || { awaitingDetails: false, intent: null, lastMsg: '' };

  // Followup, wenn wir Details erwartet haben
  if (st.awaitingDetails && st.intent) {
    st.awaitingDetails = false;
    chatState.set(chatId, st);
    const follow = intentFollowup(st.intent);
    if (follow) {
      await sendOnce(chatId, follow);
      return;
    }
  }

  // Intent erkennen
  const intent = detectIntent(text);
  if (intent) {
    chatState.set(chatId, { awaitingDetails: true, intent, lastMsg: st.lastMsg });
    const intro = intentIntro(intent);
    if (intro) {
      await sendOnce(chatId, intro);
      return;
    }
  }

  // Kein spezieller Intent → freundlich Foto erbitten
  const askForPhoto = careReply({
    intro: 'Danke für deine Nachricht 🙏\nWenn möglich, schick mir bitte ein *Foto* oder beschreibe die Stelle kurz.',
    bullets: [
      '🐾 Körperstelle (Pfote, Bein, Auge …)',
      '📏 Größe ungefähr',
      '⏱️ Seit wann?',
      '⚠️ Auffälligkeiten (rot, geschwollen, feucht, Geruch …)',
    ],
    outro: 'Mit einem Foto kann ich zuerst eine kurze Analyse machen und dir danach konkrete Schritte geben 💛',
  });

  await sendOnce(chatId, askForPhoto, { parse_mode: 'Markdown' });
});

console.log('✅ Bot läuft…');

























