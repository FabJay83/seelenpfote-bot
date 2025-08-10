// index.js — Seelenpfote Bot (All‑in‑One, 18 Fälle)
// Telegram + CLI, DE default, Auto‑DE/EN, Zustandsmaschine, Foto‑Handling, Anti‑Repeat
require('dotenv').config();

const BOT_NAME = process.env.BOT_NAME || 'Seelenpfote';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
let Telegraf; try { ({ Telegraf } = require('telegraf')); } catch {}
const USE_TELEGRAM = !!TOKEN;

/* ---------- Helpers ---------- */
const now = () => Date.now();
const norm = s => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const rotate = (arr, ref) => arr[(ref.value++ % arr.length + arr.length) % arr.length];
function detectLang(raw) {
  const text = (raw || '').toLowerCase();
  if (!text.trim()) return 'de';
  if (/[äöüß]/.test(text)) return 'de';
  const de = [/\b(und|oder|nicht|auch|ein(e|en|er)?|der|die|das|mit|ohne|bitte|danke|hilfe|warum|wieso|wie|was|wann|wo|welch\w*|mein|dein|sein|ihr|zum|zur|im|am|vom|beim)\b/, /(ung|keit|chen|lich|isch)\b/].some(r=>r.test(text));
  if (de) return 'de';
  const en = [/\b(the|and|or|not|with|without|please|thanks|help|why|how|what|when|where|which|who|i|you|he|she|we|they|my|your|his|her|their)\b/, /(ing|ed|ly)\b/].some(r=>r.test(text));
  if (en) return 'en';
  const asciiRatio = (text.replace(/[^\x00-\x7F]/g,'').length)/text.length;
  return asciiRatio > 0.9 ? 'en' : 'de';
}

/* ---------- Session ---------- */
const sessions = new Map();
function getSession(id='cli') {
  if (!sessions.has(id)) {
    sessions.set(id, { lang: 'de', lastUser: '', lastUserAt: 0, lastBot: '', idx:{value:0}, state:{name:null,step:0,data:{}} });
  }
  return sessions.get(id);
}

/* ---------- Global texts ---------- */
const TXT = {
  de:{
    hello:(n)=>`👋 Willkommen bei ${n}!\nSag mir kurz, was los ist: „Durchfall“, „erbricht“, „humpelt“, „Pfote entzündet“, „Blutung“, „Zecke“, „Ohr/Auge“, „Husten“, „Appetitlosigkeit“, „Harn“, „Verstopfung“, „Zahn/Bruch“, „Hitzschlag“, „Vergiftung“, „Krampf“, „aufgeblähter Bauch“… (/help)`,
    help:`Befehle:\n/start – Begrüßung\n/help – Hilfe\n/reset – Verlauf löschen\n/langde – Deutsch\n/langen – Englisch\n/langauto – Auto‑Sprache`,
    askPhoto:`Bitte ein **klares Foto** senden (ggf. mehrere Perspektiven). Danach „Foto gesendet“ schreiben.`,
    photoReceived:`Foto erhalten, danke! Wenn etwas fehlt, beschreibe es kurz.`,
    acks:["Alles klar.","Verstanden.","Okay."],
    tails:["Wie kann ich weiter helfen?","Magst du 1–2 Details ergänzen?","Was ist das Wichtigste?"],
    dup:["Das habe ich gerade beantwortet.","Gleiche Eingabe erkannt.","Wir hatten das eben schon."],
    reset:"Verlauf gelöscht. Erzähl mir, was los ist.",
    bye:"Bis bald!"
  },
  en:{
    hello:(n)=>`👋 Welcome to ${n}!\nTell me what’s up: “diarrhea”, “vomiting”, “limping”, “inflamed paw”, “bleeding”, “tick”, “ear/eye”, “cough”, “no appetite”, “urine”, “constipation”, “tooth/fracture”, “heatstroke”, “poisoning”, “seizure”, “bloat”… (/help)`,
    help:`Commands:\n/start – greeting\n/help – help\n/reset – clear\n/langde – German\n/langen – English\n/langauto – auto language`,
    askPhoto:`Please send a **clear photo** (multiple angles if useful). Then type “photo sent”.`,
    photoReceived:`Photo received, thanks! Add a short note if needed.`,
    acks:["Got it.","Understood.","Okay."],
    tails:["How can I help further?","Add 1–2 details.","What’s the key issue?"],
    dup:["I just answered that.","Same input detected.","We just covered that."],
    reset:"Session cleared. Tell me what’s happening.",
    bye:"See you!"
  }
};

/* ---------- Case Engine (18 Fälle) ---------- */
/* Each case: {id, match(text,lang), start(text,s,L), step(text,s,L), photo?(s,L)}  */
/* Kurz, klar, mit Warnzeichen → „Tierarzt/Notdienst“. */

const CASES = [
/* 1) Pfote/Wunde/Schwellung */
{ id:'paw',
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en' ? (/(paw|pad|nail)/.test(s)&&/(inflam|red|swoll|wound|pus|cut|crack)/.test(s)) : (/(pfote|ballen|kralle)/.test(s)&&/(entzünd|rot|schwell|wund|eiter|schnitt|riss)/.test(s));},
  start:(text,s,L)=>{s.state.step=1;return`Pfote/Wunde – Erste Hilfe:\n• Mit lauwarmem Wasser/NaCl spülen, sanft trocken tupfen.\n• Lecken verhindern (Socke/Schuh/Halskragen).\n• 10–15 Min. kühlen (Tuch, kein Eis direkt).\nFragen:\n1) Seit wann?\n2) Lahmt stark/leicht?\n3) Schnitt/Fremdkörper sichtbar? (ja/nein)\n(Optional: Foto senden)`;},
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(s.state.step===1){s.state.step=2;const t=s.state.data.text;const long=/(tage|woche|seit.*tag|seit.*woche)/i.test(t);const strong=/(gar nicht|kaum|stark|nicht belastet)/i.test(t);const foreignNo=/\bnein\b/i.test(t);return`Einschätzung:\n• ${long?'Seit mehreren Tagen':'Eher frisch'}${strong?' + deutliche Lahmheit':''}.\n• ${foreignNo?'Kein sichtbarer Fremdkörper.':'Zwischen Ballen auf Schnitt/Splitter prüfen.'}\nNächste Schritte:\n1) 2–3×/Tag spülen, trocken tupfen; Lecken verhindern.\n2) 10–15 Min. kühlen, 2–3×/Tag.\n3) Schonung/kurze Gassi‑Runden.\n4) ${long||strong?'Tierarzt innerhalb 24 h.':'Keine Besserung in 24–48 h → Tierarzt.'}`;}return"Kurzes Update: besser/schlechter? (Foto möglich)";},
  photo:(s,L)=>L.photoReceived },
/* 2) Durchfall */
{ id:'diarrhea',
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en' ? /(diarrhea|loose stool|watery stool|bloody stool)/.test(s) : /(durchfall|dünn|wässrig|breiig|blut im stuhl)/.test(s);},
  start:(text,s,L)=>{s.state.step=1;return`Durchfall – Fragen:\n1) Seit wann?\n2) Appetit/Trinken? (ja/nein)\n3) Blut/Schleim? (ja/nein)\n4) Zustand? (munter/müde)\n(Optional: Foto vom Kot)`;},
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(s.state.step===1){s.state.step=2;const t=s.state.data.text;const long=/(48|zwei tage|2 tage|seit.*tagen)/i.test(t);const bloody=/\b(blut|blutig|schleim)\b/i.test(t);const leth=/\b(müde|apathisch|schwach)\b/i.test(t);const nodrink=/(trinkt nicht|kein wasser|trinkt kaum)/i.test(t);const alarm=long||bloody||leth||nodrink;return`Einschätzung:\n• ${alarm?'Warnzeichen vorhanden.':'Leichter/mäßiger Durchfall.'}\nNächste Schritte:\n1) 6–12 h Schonkostpause (Wasser anbieten).\n2) Danach kleine Portionen: Reis+Huhn oder Morosuppe.\n3) Elektrolytlösung (Tierbedarf).\n4) ${alarm?'Heute noch Tierarzt kontaktieren.':'Keine Besserung in 24–36 h → Tierarzt.'}\n⚠️ Welpen/Senioren/Vorerkrankungen → früher abklären.`;}return"Sag Bescheid, falls Blut, Schwäche oder keine Besserung.";},
  photo:(s,L)=>L.photoReceived },
/* 3) Erbrechen */
{ id:'vomit',
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en' ? /(vomit|throwing up|nausea|bile|foam)/.test(s) : /(erbroch|kotz|brechen|übelkeit|galle|schaum)/.test(s);},
  start:(text,s,L)=>{s.state.step=1;return`Erbrechen – Fragen:\n1) Wie oft/12 h?\n2) Futter/Galle/Schaum? Blut?\n3) Hält Wasser? (ja/nein)\n4) Zustand? (munter/müde)\n(Optional: Foto)`;},
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(s.state.step===1){s.state.step=2;const t=s.state.data.text;const many=/(3|drei|mehrfach|oft|häufig)/i.test(t);const blood=/\b(blut|rötlich)\b/i.test(t);const nowater=/(hält.*nicht|erbricht wasser|trinkt nicht)/i.test(t);const leth=/\b(müde|apathisch|schwach)\b/i.test(t);const alarm=many||blood||nowater||leth;return`Einschätzung:\n• ${alarm?'Warnzeichen vorhanden.':'Wahrscheinlich gereizter Magen.'}\nNächste Schritte:\n1) 6–12 h Futterpause (Wasser in kleinen Mengen, häufig).\n2) Danach Miniportionen Schonkost (Huhn/Reis/Morosuppe).\n3) Bauchschmerz/Aufblähung/Fremdkörper?\n4) ${alarm?'Heute noch Tierarzt.':'Keine Besserung in 24 h → Tierarzt.'}`;}return"Gib ein Update, ob es besser wird.";},
  photo:(s,L)=>L.photoReceived },
/* 4) Humpeln/Lahmheit */
{ id:'limp',
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en' ? /(limp|lameness|not weight-bearing|favoring leg)/.test(s) : /(humpel|lahm|zieht bein|belastet nicht|lahmt)/.test(s);},
  start:(text,s,L)=>{s.state.step=1;return`Humpeln – Fragen:\n1) Seit wann?\n2) Belastet gar nicht/wenig?\n3) Schwellung/Verletzung? (ja/nein)\n4) Unfall/Sturz? (ja/nein)\n(Optional: Foto/kurzes Video)`;},
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(s.state.step===1){s.state.step=2;const t=s.state.data.text;const sinceDays=/(tage|seit.*tag|woche)/i.test(t);const noWeight=/(gar nicht|nicht belastet|trägt nicht)/i.test(t);const swelling=/(schwell|dick|heiß|warm)/i.test(t);const accident=/(unfall|sturz|zerrung|umgeknickt)/i.test(t);const alarm=noWeight||swelling||accident||sinceDays;return`Einschätzung:\n• ${noWeight?'Nicht‑Belasten = Warnzeichen.':(sinceDays?'>24–48 h bestehend.':'Leichte Lahmheit möglich.')}\nNächste Schritte:\n1) Schonung, keine Treppen/Wildspiele.\n2) Kühlen 10–15 Min., 2–3×/Tag (Tuch, kein Eis direkt).\n3) Kurze ruhige Runden.\n4) ${alarm?'Tierarzt innerhalb 24 h.':'Keine Besserung → Tierarzt.'}`;}return"Kurzes Update, bitte.";},
  photo:(s,L)=>L.photoReceived },
/* 5) Blutung/Schnitt */
{ id:'bleeding',
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(bleeding|cut|laceration|open wound)/.test(s):/(blutung|blutet|schnitt|platzwunde|offene wunde)/.test(s);},
  start:(text,s,L)=>{s.state.step=1;return`Blutung/Schnitt – Erste Hilfe:\n• Druckverband 5–10 Min. ohne Unterbrechung.\n• Tiefe Wunden nicht spülen (nur Ränder säubern).\n• Wenn möglich, hochlagern.\nFragen:\n1) Blutung stark/mittel/leicht?\n2) Tiefe klaffende Wunde? (ja/nein)\n3) Ort der Wunde?`},
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(s.state.step===1){s.state.step=2;const t=s.state.data.text;const heavy=/(stark|pulsierend|spritzend)/i.test(t);const deep=/(tief|sehne|knochen|klaffend)/i.test(t);return`Einschätzung:\n• ${heavy?'Starke Blutung':'Keine starke Blutung'}${deep?' + tiefe Wunde.':'.'}\nNächste Schritte:\n1) Druckverband belassen/erneuern.\n2) Ruhig + warm halten.\n3) ${heavy||deep?'Bitte umgehend Tierarzt/Notdienst.':'Unsicher/weiter blutend → Tierarzt heute.'}`;}return"Stoppt der Druckverband die Blutung?";},
  photo:(s,L)=>L.photoReceived },
/* 6) Hitzschlag */
{ id:'heat',
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(heatstroke|overheat|overheated|hot car|panting heavily)/.test(s):/(hitzschlag|überhitz|heißes auto|starkes hecheln|überwärmt)/.test(s);},
  start:(text,s,L)=>{s.state.step=1;return`Überhitzung – Sofort:\n• In Schatten/kühlen Raum.\n• Mit kühlem (nicht eiskaltem) Wasser befeuchten, Ventilator.\n• Wasser anbieten (kleine Mengen).\nFragen:\n1) Ansprechbar? (ja/nein)\n2) Taumelt/erbricht? (ja/nein)\n3) Wie lange Hitze ausgesetzt?`},
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(s.state.step===1){s.state.step=2;const t=s.state.data.text;const collapse=/(ohnmacht|bewusstlos|nicht ansprechbar|taumelt)/i.test(t);const vomit=/(erbricht|kotzt)/i.test(t);return`Weitere Schritte:\n1) Weiter langsam kühlen.\n2) Kein eiskaltes Wasser.\n3) Sofort Tierarzt anrufen/ankündigen.\n4) ${collapse||vomit?'Akut: direkt losfahren.':'Auch ohne Kollaps zeitnah vorstellen.'}`;}return"Bitte fahr los, wenn keine schnelle Besserung.";}},
/* 7) Vergiftung */
{ id:'poison',
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(poison|toxin|ate rat poison|chocolate|xylitol|ibuprofen|grapes)/.test(s):/(vergift|gift|rattenköder|schokolade|xylit|ibuprofen|trauben|rosinen)/.test(s);},
  start:(text,s,L)=>{s.state.step=1;return`Vergiftungsverdacht:\n• Nichts selbst einflößen/kein Erbrechen erzwingen.\n• Verpackung/Foto sichern.\nFragen:\n1) Was/Menge/seit wann?\n2) Symptome? (erbricht, wackelig, Krämpfe)\n3) Gewicht des Hundes?`},
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(s.state.step===1){s.state.step=2;return`Maßnahmen:\n1) Sofort Tierarzt/Notdienst anrufen.\n2) Stoff/Menge/Zeit nennen, Verpackung mitnehmen.\n3) Bei Neurologie‑Symptomen keine Zeit verlieren.`;}return"Bitte jetzt den Tierarzt kontaktieren – ich bleibe hier für Fragen.";}},
/* 8) Aufgeblähter Bauch / GDV */
{ id:'bloat',
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(bloat|gdv|swollen belly|retches but nothing)/.test(s):/(aufgeblähter bauch|magenumdrehung|magen\-torsion|würgen ohne erbrechen)/.test(s);},
  start:()=>`⚠️ Verdacht auf Magendrehung: harter Bauch, Würgen ohne Erbrechen, starke Unruhe/Schmerz.\n→ **Sofort** Notdienst/Tierklinik!`,
  step:()=>`Bitte direkt in die Tierklinik fahren.`},
/* 9) Krampfanfall */
{ id:'seizure',
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(seizure|convulsion|fits|epilepsy)/.test(s):/(krampf|krampfanfall|epilepsie|anfälle)/.test(s);},
  start:()=>{return`Krampfanfall – Sofort:\n• Verletzungen vermeiden, nicht festhalten, Kopf seitlich.\n• Zeit messen.\n• Danach: ruhiger dunkler Raum, nichts füttern.\nFragen: Dauer? Mehrere Anfälle? Wieder ansprechbar?`;},
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(s.state.step===0)s.state.step=1;const t=s.state.data.text;const long=/(>?\s*5\s*min|fünf|minuten|>5)/i.test(t);const cluster=/(mehrere|hintereinander|cluster)/i.test(t);const notok=/(nicht ansprechbar|apathisch|lang anhaltend)/i.test(t);return`Einschätzung:\n• ${long||cluster||notok?'Notfallverdacht.':'Abklären lassen.'}\nNächste Schritte:\n1) ${long||cluster||notok?'Sofort Notdienst.':'Tierarzttermin zeitnah.'}\n2) Falls möglich Video/Uhrzeiten notieren.`;}},
/* 10) Auge */
{ id:'eye',
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(eye|ocular|red eye|squint|discharge)/.test(s):/(auge|augen|augenlid|rot|blinzelt|ausfluss)/.test(s);},
  start:()=>{return`Auge – Erste Hilfe:\n• Nicht reiben lassen, ggf. Halskragen.\n• Keine Menschen‑Augentropfen.\n• ggf. NaCl‑Spülung bei Fremdkörperverdacht.\nFragen: stark rot/schmerz? Lichtempfindlich? Verletzung sichtbar? (Foto möglich)`;},
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(s.state.step===0)s.state.step=1;const t=s.state.data.text;const severe=/(stark|sehr|verletz|fremdkörper|trüb|blut)/i.test(t);return`Nächste Schritte:\n1) ${severe?'Heute noch':'Zeitnah'} Tierarzt (Hornhaut kann schmerzhaft sein).\n2) Nicht reiben; ggf. Halskragen.\n3) Foto/Video hilft.`;},
  photo:(s,L)=>L.photoReceived },
/* 11) Ohrentzündung */
{ id:'ear',
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(ear|otitis|shaking head|scratching ear|ear discharge)/.test(s):/(ohr|ohren|ohrenentzündung|kopfschütteln|kratzt ohr|ohr ausfluss)/.test(s);},
  start:()=>{return`Ohr – Erste Hilfe:\n• Nicht mit Wattestäbchen tief reinigen.\n• Ohr trocken halten, Kratzen vermeiden.\nFragen: Rötung/Schwellung/Geruch? Schmerz? Seit wann? (Foto möglich)`;},
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(s.state.step===0)s.state.step=1;const t=s.state.data.text;const severe=/(stark|eitrig|geruch|sehr rot|schmerz)/i.test(t);return`Nächste Schritte:\n1) ${severe?'Heute noch':'Zeitnah'} Tierarzt zur Reinigung/Medikation.\n2) Bis dahin Kratzen vermeiden, Ohr trocken halten.\n3) Keine Hausmittel tief ins Ohr.`;},
  photo:(s,L)=>L.photoReceived },
/* 12) Zecke/Stich/Allergie */
{ id:'tick',
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(tick|bee sting|wasp sting|allergic reaction|hives)/.test(s):/(zecke|stich|wespe|biene|allergie|quaddeln)/.test(s);},
  start:()=>{return`Zecke/Stich:\n• Zecke mit Zange nahe der Haut greifen, langsam ziehen; keine Öle.\n• Stich kühlen, Ruhe.\nFragen: Gesicht/Zunge geschwollen? Atemprobleme? Seit wann? (Foto möglich)`;},
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(s.state.step===0)s.state.step=1;const t=s.state.data.text;const face=/(gesicht|zunge|augenlid|maul)/i.test(t);const breath=/(atemnot|keucht|schlecht luft)/i.test(t);return`Nächste Schritte:\n1) Kühlen, Ruhe.\n2) ${face||breath?'Sofort Tierarzt/Notdienst.':'Beobachten; starke Schwellung/Schwäche → Tierarzt.'}\n3) Nach Zecke: Stelle täglich sichten; Fieber/Trägheit → abklären.`;},
  photo:(s,L)=>L.photoReceived },
/* 13) Husten/Atemwege */
{ id:'cough',
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(cough|kennel cough|trachea|honking|breath|breathing)/.test(s):/(husten|zwingerhusten|trachea|würgen|atem|pfeift|keucht)/.test(s);},
  start:()=>{return`Husten/Atemwege – Fragen:\n1) Seit wann? Fieber?\n2) Husten trocken/feucht? Würgen?\n3) Atemnot (Maul offen, blaue Zunge), kollabiert? (ja/nein)`;},
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(s.state.step===0)s.state.step=1;const t=s.state.data.text;const distress=/(atemnot|keucht|maul offen|blaue zunge|kollabiert)/i.test(t);return`Einschätzung & Schritte:\n1) ${distress?'Akut: sofort':'Zeitnah'} Tierarzt, besonders bei Atemnot.\n2) Ruhe, Zugluft vermeiden, Geschirr statt Halsband.\n3) Trinken anbieten, Anstrengung vermeiden.`;}},
/* 14) Appetitlosigkeit */
{ id:'anorexia',
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(no appetite|not eating|refuses food|stopped eating)/.test(s):/(appetitlos|frisst nicht|frisst kaum|futter verweigert)/.test(s);},
  start:()=>{return`Appetitlosigkeit – Fragen:\n1) Seit wann?\n2) Trinkt normal? (ja/nein)\n3) Begleitend: Erbrechen/Durchfall/Fieber/Schmerz?`},
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(s.state.step===0)s.state.step=1;const t=s.state.data.text;const long=/(tage|seit.*tag|woche)/i.test(t);const alarm=/(erbricht|durchfall|fieber|schmerz|apathisch)/i.test(t);return`Schritte:\n1) Wasser anbieten, Futter leicht erwärmen, sehr kleine Portionen.\n2) ${alarm||long?'Heute noch Tierarzt':'Wenn keine Besserung <24–48 h → Tierarzt'}.\n3) Beobachten: Trinken/Urin/Schmerzen.`;}},
/* 15) Harnprobleme (Cystitis/Blockade) */
{ id:'urine',
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(urine|peeing|straining|blood in urine|can\'t pee)/.test(s):/(urin|pinkelt|strengt sich an|blut im urin|kann nicht pinkeln)/.test(s);},
  start:()=>{return`Harnprobleme – Fragen:\n1) Strengt er sich an, ohne dass etwas kommt? (ja/nein)\n2) Blut im Urin? (ja/nein)\n3) Schmerzen/Unruhe? (ja/nein)`;},
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(s.state.step===0)s.state.step=1;const t=s.state.data.text;const block=/(kann nicht|nix kommt|ohne erfolg|sehr wenig)/i.test(t);const blood=/\b(blut)\b/i.test(t);return`Einschätzung:\n• ${block?'Harnabfluss gestört (Notfall möglich).':'Reizung/Entzündung möglich.'}\nSchritte:\n1) ${block?'Sofort Tierarzt/Notdienst.':'Zeitnah Tierarzt (Urinprobe hilfreich).'}\n2) Viel Wasser anbieten, Ruhe.`;}},
/* 16) Verstopfung */
{ id:'constipation',
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(constipation|hard stool|straining to poop)/.test(s):/(verstopfung|harte kot|drückt ohne erfolg)/.test(s);},
  start:()=>{return`Verstopfung – Fragen:\n1) Seit wann?\n2) Frisst/Trinkt normal? (ja/nein)\n3) Schmerz, Aufblähung, Erbrechen? (ja/nein)`;},
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(s.state.step===0)s.state.step=1;const t=s.state.data.text;const long=/(tage|seit.*tag|woche)/i.test(t);const alarm=/(starke schmerzen|aufgebläht|erbricht)/i.test(t);return`Schritte:\n1) Wasser anbieten, kurze entspannte Spaziergänge.\n2) Leichte Kost, ggf. etwas Öl/Morosuppe.\n3) ${alarm||long?'Tierarzt (Darmverschluss ausschließen).':'Wenn keine Besserung 24–48 h → Tierarzt.'}`;}},
/* 17) Zahn/Zahnfleisch */
{ id:'tooth',
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(tooth|teeth|gum|broken tooth|tooth pain)/.test(s):/(zahn|zähne|zahnfleisch|zahnbruch|zahnschmerz)/.test(s);},
  start:()=>{return`Zahn/Zahnfleisch – Fragen:\n1) Abgebrochener Zahn sichtbar? (ja/nein)\n2) Blutung/übel riechender Mund? (ja/nein)\n3) Frisst er schlechter? (ja/nein)`;},
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(s.state.step===0)s.state.step=1;const t=s.state.data.text;const broken=/(abgebrochen|bruch|splitter)/i.test(t);const bleedSmell=/(blutet|geruch)/i.test(t);return`Schritte:\n1) Weiche Kost, nichts Hartes kauen lassen.\n2) ${broken||bleedSmell?'Heute noch':'Zeitnah'} Tierarzt/Zahnröntgen.\n3) Schmerzen/Schwellung → schneller Termin.`;}},
/* 18) Knochenbruch/Trauma */
{ id:'fracture',
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(fracture|broken bone|broken leg|severe trauma|hit by car)/.test(s):/(bruch|knochenbruch|bein gebrochen|schweres trauma|autounfall)/.test(s);},
  start:()=>`⚠️ Verdacht auf Bruch/Trauma:\n• Ruhig halten, nicht selbst reponieren.\n• Schiene nur wenn sicher; Schmerz schonen.\n→ **Sofort** Tierarzt/Notdienst (Röntgen).`,
  step:()=>`Bitte sofort zum Tierarzt/Notdienst fahren.`}
];

/* ---------- Router ---------- */
function findCase(text, lang){ for(const c of CASES){ if(c.match(text,lang)) return c; } return null; }
function antiRepeat(out, s){ const outNorm=norm(out); if(outNorm===s.lastBot){ const extra=(s.lang==='en')?"Anything else?":"Noch etwas?"; if(norm(out+"\n"+extra)!==s.lastBot) return out+"\n"+extra; return out+" …"; } return out; }

/* ---------- Main reply ---------- */
function replyFor(text, s){
  if (s.lang===null) s.lang = detectLang(text);
  const L = TXT[s.lang || 'de'];
  const n = norm(text);
  const tNow = now();

  // Commands
  if (n==='/start'){ s.state={name:null,step:0,data:{}}; return L.hello(BOT_NAME); }
  if (n==='/help') return L.help;
  if (n==='/reset'){ s.state={name:null,step:0,data:{}}; s.lastUser=''; s.lastBot=''; return L.reset; }
  if (n==='/langde'){ s.lang='de'; return "Alles klar, ich antworte auf Deutsch."; }
  if (n==='/langen'){ s.lang='en'; return "Got it, I’ll reply in English."; }
  if (n==='/langauto'){ s.lang=null; return (detectLang(text)==='en'?"Auto language enabled.":"Automatische Sprache aktiviert."); }

  // Anti-duplicate input
  if (n && n===s.lastUser && (tNow - s.lastUserAt < 10000)) return rotate(TXT[s.lang||'de'].dup, s.idx);

  // Continue active case
  if (s.state.name){
    const active = CASES.find(c=>c.id===s.state.name);
    if (active) return active.step(text, s, L);
    s.state={name:null,step:0,data:{}};
  }

  // Start new case
  const match = findCase(text, s.lang || 'de');
  if (match){ s.state={name:match.id,step:0,data:{}}; return match.start(text, s, L); }

  // Default
  return `${rotate(L.acks,s.idx)} ${rotate(L.tails,s.idx)}`;
}

/* ---------- Photo handling ---------- */
function onPhoto(s){
  const L = TXT[s.lang || 'de'];
  if (s.state.name){
    const active = CASES.find(c=>c.id===s.state.name);
    if (active && typeof active.photo==='function') return active.photo(s,L);
  }
  return L.photoReceived;
}

/* ---------- Telegram ---------- */
async function startTelegram(){
  if (!Telegraf) throw new Error('telegraf not installed');
  const bot = new Telegraf(TOKEN);

  bot.on('text', (ctx)=>{
    const id = String(ctx.chat.id);
    const s = getSession(id);
    const msg = ctx.message.text || '';
    if (s.lang===null) s.lang = detectLang(msg);

    let out = replyFor(msg, s);
    out = antiRepeat(out, s);

    s.lastUser = norm(msg);
    s.lastUserAt = now();
    s.lastBot = norm(out);

    ctx.reply(out).catch(err=>console.error('[TELEGRAM send error]', err));
  });

  bot.on('photo', (ctx)=>{
    const id = String(ctx.chat.id);
    const s = getSession(id);
    const out = onPhoto(s);
    s.lastBot = norm(out);
    ctx.reply(out).catch(err=>console.error('[TELEGRAM send error]', err));
  });

  await bot.launch();
  console.log(`[${BOT_NAME}] Telegram-Bot läuft.`);
  process.once('SIGINT', ()=>{ bot.stop('SIGINT'); process.exit(0); });
  process.once('SIGTERM', ()=>{ bot.stop('SIGTERM'); process.exit(0); });
}

/* ---------- CLI ---------- */
function startCLI(){
  const id='cli'; const s=getSession(id);
  const rl=require('readline').createInterface({input:process.stdin,output:process.stdout,prompt:`${BOT_NAME}> `});
  console.log(`${BOT_NAME} – CLI. Tippe /help.`); rl.prompt();
  rl.on('line',(line)=>{
    const msg=line||''; if (s.lang===null) s.lang=detectLang(msg);
    let out=replyFor(msg,s); out=antiRepeat(out,s);
    s.lastUser=norm(msg); s.lastUserAt=now(); s.lastBot=norm(out);
    console.log(out); rl.prompt();
  });
  rl.on('close',()=>{ console.log((s.lang==='en')?TXT.en.bye:TXT.de.bye); process.exit(0); });
}

/* ---------- Start ---------- */
(async()=>{
  try{
    if (USE_TELEGRAM) await startTelegram();
    else startCLI();
  }catch(e){
    console.error('[FATAL]', e); process.exit(1);
  }
})();
