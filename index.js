// index.js — Seelenpfote Bot (All‑in‑One, Notfälle sofort)
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

/* ---------- Cases (18) ---------- */
/* Struktur: {id, emergency:boolean, match(text,lang), start(text,s,L), step(text,s,L), photo?()} */
/* Notfälle: emergency=true → sofortige Antwort + state reset */

const CASES = [
/* 1) Pfote/Wunde/Schwellung (nicht Notfall) */
{ id:'paw', emergency:false,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en' ? (/(paw|pad|nail)/.test(s)&&/(inflam|red|swoll|wound|pus|cut|crack)/.test(s)) : (/(pfote|ballen|kralle)/.test(s)&&/(entzünd|rot|schwell|wund|eiter|schnitt|riss)/.test(s));},
  start:(text,s,L)=>{s.state.step=1;return`Pfote/Wunde – Erste Hilfe:\n• Mit lauwarmem Wasser/NaCl spülen, sanft trocken tupfen.\n• Lecken verhindern (Socke/Schuh/Halskragen).\n• 10–15 Min. kühlen (Tuch, kein Eis direkt).\nFragen:\n1) Seit wann?\n2) Lahmt stark/leicht?\n3) Schnitt/Fremdkörper sichtbar? (ja/nein)\n(Optional: Foto senden)`;},
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(s.state.step===1){s.state.step=2;const t=s.state.data.text;const long=/(tage|woche|seit.*tag|seit.*woche)/i.test(t);const strong=/(gar nicht|kaum|stark|nicht belastet)/i.test(t);const foreignNo=/\bnein\b/i.test(t);const final=`Einschätzung:\n• ${long?'Seit mehreren Tagen':'Eher frisch'}${strong?' + deutliche Lahmheit':''}.\n• ${foreignNo?'Kein sichtbarer Fremdkörper.':'Zwischen Ballen auf Schnitt/Splitter prüfen.'}\nNächste Schritte:\n1) 2–3×/Tag spülen, trocken tupfen; Lecken verhindern.\n2) 10–15 Min. kühlen, 2–3×/Tag.\n3) Schonung/kurze Gassi‑Runden.\n4) ${long||strong?'Tierarzt innerhalb 24 h.':'Keine Besserung in 24–48 h → Tierarzt.'}`; s.state.name=null; return final;}return"Kurzes Update: besser/schlechter? (Foto möglich)";},
  photo:(s,L)=>L.photoReceived },

/* ---------- NOTFÄLLE ab hier: sofortige Antwort ---------- */

/* 2) Hitzschlag / Überhitzung */
{ id:'heat', emergency:true,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(heatstroke|overheat|overheated|hot car|panting heavily)/.test(s):/(hitzschlag|hitzeschlag|überhitz|heißes auto|starkes hecheln|überwärmt)/.test(s);},
  start:(text,s,L)=>{ s.state.name=null; return (
`⚠️ **Hitzschlag – jetzt handeln:**
1) In Schatten/kühlen Raum; Ventilator wenn möglich.
2) Mit *kühlem* (nicht eiskaltem) Wasser befeuchten – Bauch/Leisten.
3) Frisches Wasser in kleinen Mengen anbieten.
4) **Sofort Tierarzt anrufen** und Ankunft ankündigen. 
5) Wenn taumelt/erbricht/kollabiert → **direkt losfahren**.`);},
  step:()=>{return "Bitte jetzt sofort handeln – schreib danach ein Update.";}},
/* 3) Starke Blutung / Blutung unklar */
{ id:'bleeding', emergency:true,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(bleeding|bleeds a lot|spurting blood|severe cut)/.test(s):/(starke blutung|blutet stark|spritzend|pulsierend|tiefe schnitt|platzwunde)/.test(s) || /(blutung|blutet|schnitt|platzwunde|offene wunde)/.test(s);},
  start:(text,s,L)=>{ s.state.name=null; return (
`⚠️ **Blutung – Sofortmaßnahmen:**
1) **Druckverband** anlegen (Gaze/Tuch) und **5–10 Min. nicht lösen**.
2) Falls möglich, verletzte Stelle leicht hochlagern.
3) Ruhig + warm halten – nichts in die Wunde füllen.
4) **Umgehend Tierarzt/Notdienst** aufsuchen.`);},
  step:()=> "Halte den Druckverband – wenn die Blutung nicht stoppt: sofort losfahren." },
/* 4) Vergiftung */
{ id:'poison', emergency:true,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(poison|toxin|ate rat poison|chocolate|xylitol|ibuprofen|grapes|rosins)/.test(s):/(vergift|gift|rattenköder|schokolade|xylit|ibuprofen|trauben|rosinen)/.test(s);},
  start:(text,s,L)=>{ s.state.name=null; return (
`⚠️ **Vergiftungsverdacht:**
1) **Nichts** einflößen, **kein** Erbrechen erzwingen.
2) Verpackung/Foto vom Stoff sichern.
3) **Sofort** Tierarzt/Notdienst anrufen (Stoff, Menge, Zeit, Gewicht nennen).
4) Bei Taumeln/Krämpfen → **ohne Verzögerung losfahren**.`);},
  step:()=> "Bitte jetzt den Tierarzt anrufen. Ich bleibe hier für Rückfragen." },
/* 5) Aufgeblähter Bauch / GDV */
{ id:'bloat', emergency:true,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(bloat|gdv|swollen belly|retches but nothing)/.test(s):/(aufgeblähter bauch|magenumdrehung|magen\-torsion|würgen ohne erbrechen)/.test(s);},
  start:()=>{ return "⚠️ **Verdacht auf Magendrehung**: harter Bauch, Würgen ohne Erbrechen, Unruhe/Schmerz.\n→ **Sofort** Notdienst/Tierklinik – keine Zeit verlieren!"; },
  step:()=> "Bitte direkt in die Tierklinik fahren." },
/* 6) Krampfanfall */
{ id:'seizure', emergency:true,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(seizure|convulsion|fits|epilepsy)/.test(s):/(krampf|krampfanfall|epilepsie|anfälle)/.test(s);},
  start:()=>{ return (
`⚠️ **Krampfanfall – jetzt:**
1) Verletzungen vermeiden, nicht festhalten; Kopf seitlich lagern.
2) Zeit messen; Umgebung abdunkeln.
3) Nach dem Anfall: ruhig halten, nichts füttern.
4) **Notdienst kontaktieren**, besonders >5 Min., mehrere Anfälle oder keine Erholung.`);},
  step:()=> "Wenn der Anfall >5 Min. dauert oder direkt wiederkommt → Notdienst sofort." },
/* 7) Harnblockade / „kann nicht pinkeln“ */
{ id:'urine', emergency:true,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(can'?t pee|cannot pee|no urine|straining no urine)/.test(s):/(kann nicht pinkeln|kein urin|strengt sich an und es kommt nichts)/.test(s) || /(urin|pinkelt|strengt sich an)/.test(s);},
  start:()=>{ return (
`⚠️ **Harnabfluss gestört** (möglicher Notfall):
1) Nicht warten – **sofort Tierarzt/Notdienst** (Gefahr Vergiftung durch Harnstau).
2) Ruhig halten, Wasser anbieten – nicht forcieren.
3) Wenn Schmerzen/Unruhe → direkt losfahren.`);},
  step:()=> "Bitte fahre jetzt los – Harnblockaden können schnell gefährlich werden." },
/* 8) Knochenbruch/Trauma */
{ id:'fracture', emergency:true
  ,match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(fracture|broken bone|broken leg|severe trauma|hit by car)/.test(s):/(bruch|knochenbruch|bein gebrochen|schweres trauma|autounfall)/.test(s);},
  start:()=>{ return (
`⚠️ **Verdacht auf Bruch/Trauma:**
1) Tier ruhig halten, nicht selbst „einrenken“.
2) Provisorische Schiene nur wenn sicher; sonst Polsterung.
3) **Sofort** Tierarzt/Notdienst (Röntgen, Schmerztherapie).`);},
  step:()=> "Bitte direkt zum Tierarzt/Notdienst fahren." },

/* ---------- Nicht-Notfälle (Dialog) ---------- */
/* 9) Durchfall */
{ id:'diarrhea', emergency:false,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en' ? /(diarrhea|loose stool|watery stool|bloody stool)/.test(s) : /(durchfall|dünn|wässrig|breiig|blut im stuhl)/.test(s);},
  start:(text,s,L)=>{s.state.step=1;return`Durchfall – Fragen:\n1) Seit wann?\n2) Appetit/Trinken? (ja/nein)\n3) Blut/Schleim? (ja/nein)\n4) Zustand? (munter/müde)\n(Optional: Foto vom Kot)`;},
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(s.state.step===1){s.state.step=2;const t=s.state.data.text;const long=/(48|zwei tage|2 tage|seit.*tagen)/i.test(t);const bloody=/\b(blut|blutig|schleim)\b/i.test(t);const leth=/\b(müde|apathisch|schwach)\b/i.test(t);const nodrink=/(trinkt nicht|kein wasser|trinkt kaum)/i.test(t);const alarm=long||bloody||leth||nodrink;const final=`Einschätzung:\n• ${alarm?'Warnzeichen vorhanden.':'Leichter/mäßiger Durchfall.'}\nNächste Schritte:\n1) 6–12 h Schonkostpause (Wasser anbieten).\n2) Danach kleine Portionen: Reis+Huhn oder Morosuppe.\n3) Elektrolytlösung (Tierbedarf).\n4) ${alarm?'Heute noch Tierarzt kontaktieren.':'Keine Besserung in 24–36 h → Tierarzt.'}\n⚠️ Welpen/Senioren/Vorerkrankungen → früher abklären.`; s.state.name=null; return final;}return"Sag Bescheid, falls Blut, Schwäche oder keine Besserung.";},
  photo:(s,L)=>L.photoReceived },
/* 10) Erbrechen */
{ id:'vomit', emergency:false,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en' ? /(vomit|throwing up|nausea|bile|foam)/.test(s) : /(erbroch|kotz|brechen|übelkeit|galle|schaum)/.test(s);},
  start:(text,s,L)=>{s.state.step=1;return`Erbrechen – Fragen:\n1) Wie oft/12 h?\n2) Futter/Galle/Schaum? Blut?\n3) Hält Wasser? (ja/nein)\n4) Zustand? (munter/müde)\n(Optional: Foto)`;},
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(s.state.step===1){s.state.step=2;const t=s.state.data.text;const many=/(3|drei|mehrfach|oft|häufig)/i.test(t);const blood=/\b(blut|rötlich)\b/i.test(t);const nowater=/(hält.*nicht|erbricht wasser|trinkt nicht)/i.test(t);const leth=/\b(müde|apathisch|schwach)\b/i.test(t);const alarm=many||blood||nowater||leth;const final=`Einschätzung:\n• ${alarm?'Warnzeichen vorhanden.':'Wahrscheinlich gereizter Magen.'}\nNächste Schritte:\n1) 6–12 h Futterpause (Wasser in kleinen Mengen, häufig).\n2) Danach Miniportionen Schonkost (Huhn/Reis/Morosuppe).\n3) Bauchschmerz/Aufblähung/Fremdkörper?\n4) ${alarm?'Heute noch Tierarzt.':'Keine Besserung in 24 h → Tierarzt.'}`; s.state.name=null; return final;}return"Gib ein Update, ob es besser wird.";},
  photo:(s,L)=>L.photoReceived },
/* 11) Humpeln/Lahmheit */
{ id:'limp', emergency:false,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en' ? /(limp|lameness|not weight-bearing|favoring leg)/.test(s) : /(humpel|lahm|zieht bein|belastet nicht|lahmt)/.test(s);},
  start:(text,s,L)=>{s.state.step=1;return`Humpeln – Fragen:\n1) Seit wann?\n2) Belastet gar nicht/wenig?\n3) Schwellung/Verletzung? (ja/nein)\n4) Unfall/Sturz? (ja/nein)\n(Optional: Foto/kurzes Video)`;},
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(s.state.step===1){s.state.step=2;const t=s.state.data.text;const sinceDays=/(tage|seit.*tag|woche)/i.test(t);const noWeight=/(gar nicht|nicht belastet|trägt nicht)/i.test(t);const swelling=/(schwell|dick|heiß|warm)/i.test(t);const accident=/(unfall|sturz|zerrung|umgeknickt)/i.test(t);const alarm=noWeight||swelling||accident||sinceDays;const final=`Einschätzung:\n• ${noWeight?'Nicht‑Belasten = Warnzeichen.':(sinceDays?'>24–48 h bestehend.':'Leichte Lahmheit möglich.')}\nNächste Schritte:\n1) Schonung, keine Treppen/Wildspiele.\n2) Kühlen 10–15 Min., 2–3×/Tag (Tuch, kein Eis direkt).\n3) Kurze ruhige Runden.\n4) ${alarm?'Tierarzt innerhalb 24 h.':'Keine Besserung → Tierarzt.'}`; s.state.name=null; return final;}return"Kurzes Update, bitte.";},
  photo:(s,L)=>L.photoReceived },
/* 12) Auge */
{ id:'eye', emergency:false,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(eye|ocular|red eye|squint|discharge)/.test(s):/(auge|augen|augenlid|rot|blinzelt|ausfluss)/.test(s);},
  start:()=>`Auge – Erste Hilfe:\n• Nicht reiben lassen, ggf. Halskragen.\n• Keine Menschen‑Augentropfen.\n• ggf. NaCl‑Spülung bei Fremdkörperverdacht.\nFragen: stark rot/schmerz? Lichtempfindlich? Verletzung sichtbar? (Foto möglich)`,
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text; if(s.state.step===0)s.state.step=1; const t=s.state.data.text; const severe=/(stark|sehr|verletz|fremdkörper|trüb|blut)/i.test(t); const final=`Nächste Schritte:\n1) ${severe?'Heute noch':'Zeitnah'} Tierarzt (Hornhaut kann schmerzhaft sein).\n2) Nicht reiben; ggf. Halskragen.\n3) Foto/Video hilft.`; s.state.name=null; return final;},
  photo:(s,L)=>L.photoReceived },
/* 13) Ohr */
{ id:'ear', emergency:false,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(ear|otitis|shaking head|scratching ear|ear discharge)/.test(s):/(ohr|ohren|ohrenentzündung|kopfschütteln|kratzt ohr|ohr ausfluss)/.test(s);},
  start:()=>`Ohr – Erste Hilfe:\n• Nicht mit Wattestäbchen tief reinigen.\n• Ohr trocken halten, Kratzen vermeiden.\nFragen: Rötung/Schwellung/Geruch? Schmerz? Seit wann? (Foto möglich)`,
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text; if(s.state.step===0)s.state.step=1; const t=s.state.data.text; const severe=/(stark|eitrig|geruch|sehr rot|schmerz)/i.test(t); const final=`Nächste Schritte:\n1) ${severe?'Heute noch':'Zeitnah'} Tierarzt zur Reinigung/Medikation.\n2) Bis dahin Kratzen vermeiden, Ohr trocken halten.\n3) Keine Hausmittel tief ins Ohr.`; s.state.name=null; return final;},
  photo:(s,L)=>L.photoReceived },
/* 14) Zecke/Stich/Allergie (kein echter Notfall, aber klare Schritte) */
{ id:'tick', emergency:false,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(tick|bee sting|wasp sting|allergic reaction|hives)/.test(s):/(zecke|stich|wespe|biene|allergie|quaddeln)/.test(s);},
  start:()=>`Zecke/Stich:\n• Zecke mit Zange nahe der Haut greifen, langsam ziehen; keine Öle.\n• Stich kühlen, Ruhe.\nFragen: Gesicht/Zunge geschwollen? Atemprobleme? Seit wann? (Foto möglich)`,
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text; if(s.state.step===0)s.state.step=1; const t=s.state.data.text; const face=/(gesicht|zunge|augenlid|maul)/i.test(t); const breath=/(atemnot|keucht|schlecht luft)/i.test(t); const final=`Nächste Schritte:\n1) Kühlen, Ruhe.\n2) ${face||breath?'Sofort Tierarzt/Notdienst.':'Beobachten; starke Schwellung/Schwäche → Tierarzt.'}\n3) Nach Zecke: Stelle täglich sichten; Fieber/Trägheit → abklären.`; s.state.name=null; return final;},
  photo:(s,L)=>L.photoReceived },
/* 15) Husten/Atemwege */
{ id:'cough', emergency:false,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(cough|kennel cough|trachea|honking|breath|breathing)/.test(s):/(husten|zwingerhusten|trachea|würgen|atem|pfeift|keucht)/.test(s);},
  start:()=>`Husten/Atemwege – Fragen:\n1) Seit wann? Fieber?\n2) Husten trocken/feucht? Würgen?\n3) Atemnot (Maul offen, blaue Zunge), kollabiert? (ja/nein)`,
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text; if(s.state.step===0)s.state.step=1; const t=s.state.data.text; const distress=/(atemnot|keucht|maul offen|blaue zunge|kollabiert)/i.test(t); const final=`Einschätzung & Schritte:\n1) ${distress?'Akut: sofort':'Zeitnah'} Tierarzt, besonders bei Atemnot.\n2) Ruhe, Zugluft vermeiden, Geschirr statt Halsband.\n3) Trinken anbieten, Anstrengung vermeiden.`; s.state.name=null; return final;}},
/* 16) Appetitlosigkeit */
{ id:'anorexia', emergency:false,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(no appetite|not eating|refuses food|stopped eating)/.test(s):/(appetitlos|frisst nicht|frisst kaum|futter verweigert)/.test(s);},
  start:()=>`Appetitlosigkeit – Fragen:\n1) Seit wann?\n2) Trinkt normal? (ja/nein)\n3) Begleitend: Erbrechen/Durchfall/Fieber/Schmerz?`,
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text; if(s.state.step===0)s.state.step=1; const t=s.state.data.text; const long=/(tage|seit.*tag|woche)/i.test(t); const alarm=/(erbricht|durchfall|fieber|schmerz|apathisch)/i.test(t); const final=`Schritte:\n1) Wasser anbieten, Futter leicht erwärmen, sehr kleine Portionen.\n2) ${alarm||long?'Heute noch Tierarzt':'Wenn keine Besserung <24–48 h → Tierarzt'}.\n3) Beobachten: Trinken/Urin/Schmerzen.`; s.state.name=null; return final;}},
/* 17) Verstopfung */
{ id:'constipation', emergency:false
  ,match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(constipation|hard stool|straining to poop)/.test(s):/(verstopfung|harte kot|drückt ohne erfolg)/.test(s);},
  start:()=>`Verstopfung – Fragen:\n1) Seit wann?\n2) Frisst/Trinkt normal? (ja/nein)\n3) Schmerz, Aufblähung, Erbrechen? (ja/nein)`,
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text; if(s.state.step===0)s.state.step=1; const t=s.state.data.text; const long=/(tage|seit.*tag|woche)/i.test(t); const alarm=/(starke schmerzen|aufgebläht|erbricht)/i.test(t); const final=`Schritte:\n1) Wasser anbieten, kurze entspannte Spaziergänge.\n2) Leichte Kost, ggf. etwas Öl/Morosuppe.\n3) ${alarm||long?'Tierarzt (Darmverschluss ausschließen).':'Wenn keine Besserung 24–48 h → Tierarzt.'}`; s.state.name=null; return final;}},
/* 18) Zahn/Zahnfleisch */
{ id:'tooth', emergency:false,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(tooth|teeth|gum|broken tooth|tooth pain)/.test(s):/(zahn|zähne|zahnfleisch|zahnbruch|zahnschmerz)/.test(s);},
  start:()=>`Zahn/Zahnfleisch – Fragen:\n1) Abgebrochener Zahn sichtbar? (ja/nein)\n2) Blutung/übel riechender Mund? (ja/nein)\n3) Frisst er schlechter? (ja/nein)`,
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text; if(s.state.step===0)s.state.step=1; const t=s.state.data.text; const broken=/(abgebrochen|bruch|splitter)/i.test(t); const bleedSmell=/(blutet|geruch)/i.test(t); const final=`Schritte:\n1) Weiche Kost, nichts Hartes kauen lassen.\n2) ${broken||bleedSmell?'Heute noch':'Zeitnah'} Tierarzt/Zahnröntgen.\n3) Schmerzen/Schwellung → schneller Termin.`; s.state.name=null; return final;}}
];

/* ---------- Router ---------- */
function findCase(text, lang){ for(const c of CASES){ if(c.match(text,lang)) return c; } return null; }
function antiRepeat(out, s){ const outNorm=norm(out); if(outNorm===s.lastBot){ const extra=(s.lang==='en')?"Anything else?":"Noch etwas?"; if(norm(out+"\n"+extra)!==s.lastBot) return out+"\n"+extra; return out+" …"; } return out; }

/* ---------- Main reply (Notfall-Priorität) ---------- */
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

  // 1) Notfall zuerst prüfen → SOFORT antworten
  const detected = findCase(text, s.lang || 'de');
  if (detected && detected.emergency) {
    s.state = { name: null, step: 0, data: {} };
    return detected.start(text, s, L); // start() gibt die fertige Notfall-Antwort zurück
  }

  // 2) Falls kein Notfall: aktiven Case fortsetzen oder neuen Case starten
  if (s.state.name){
    const active = CASES.find(c=>c.id===s.state.name);
    if (active) return active.step(text, s, L);
    s.state={name:null,step:0,data:{}};
  }
  if (detected){
    s.state = { name: detected.id, step: 0, data: {} };
    return detected.start(text, s, L);
  }

  // 3) Default
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


