// cases.js — Alle Fälle. Notfälle: emergency:true → sofortige Antwort, kein Nachfragen.
module.exports = [

/* 1) Pfote/Wunde/Schwellung */
{
  id:'paw', emergency:false,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en' ? (/(paw|pad|nail)/.test(s)&&/(inflam|red|swoll|wound|pus|cut|crack)/.test(s)) : (/(pfote|ballen|kralle)/.test(s)&&/(entzünd|rot|schwell|wund|eiter|schnitt|riss)/.test(s));},
  start:(text,s,L)=>{s.state.step=1;return`Pfote/Wunde – Erste Hilfe:\n• Lauwarmes Wasser/NaCl spülen, sanft trocken tupfen.\n• Lecken verhindern (Socke/Schuh/Halskragen).\n• 10–15 Min. kühlen (Tuch, kein Eis direkt).\nFragen:\n1) Seit wann?\n2) Lahmt stark/leicht?\n3) Schnitt/Fremdkörper sichtbar? (ja/nein)\n(Optional: Foto)`;},
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(s.state.step===1){s.state.step=2;const t=s.state.data.text;const long=/(tage|woche|seit.*tag|seit.*woche)/i.test(t);const strong=/(gar nicht|kaum|stark|nicht belastet)/i.test(t);const foreignNo=/\bnein\b/i.test(t);const out=`Einschätzung:\n• ${long?'Seit mehreren Tagen':'Eher frisch'}${strong?' + deutliche Lahmheit':''}.\n• ${foreignNo?'Kein sichtbarer Fremdkörper.':'Zwischen Ballen auf Schnitt/Splitter prüfen.'}\nNächste Schritte:\n1) 2–3×/Tag spülen, trocken tupfen; Lecken verhindern.\n2) 10–15 Min. kühlen, 2–3×/Tag.\n3) Schonung/kurze Gassi‑Runden.\n4) ${long||strong?'Tierarzt innerhalb 24 h.':'Keine Besserung in 24–48 h → Tierarzt.'}`; s.state.name=null; return out;}return"Kurzes Update: besser/schlechter?";},
  photo:(s,L)=>L.photoReceived
},

/* ---------- NOTFÄLLE (sofortige Antwort) ---------- */

/* 2) Hitzschlag */
{
  id:'heat', emergency:true,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(heatstroke|overheat|overheated|hot car|panting heavily)/.test(s):/(hitzschlag|hitzeschlag|überhitz|heißes auto|starkes hecheln|überwärmt)/.test(s);},
  start:(text,s,L)=>{ s.state.name=null; return `⚠️ **Hitzschlag – jetzt handeln:**\n1) Schatten/kühlen Raum, Ventilator.\n2) *Kühles* Wasser auf Bauch/Leisten (nicht eiskalt).\n3) Kleine Mengen Wasser anbieten.\n4) **Sofort Tierarzt anrufen**, Ankunft ankündigen.\n5) Taumelt/erbricht/kollabiert → **direkt losfahren**.`; },
  step:()=>`Bitte sofort handeln – melde dich nach dem Telefonat.`
},

/* 3) Starke Blutung / Blutung unklar */
{
  id:'bleeding', emergency:true,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(bleeding|bleeds a lot|spurting blood|severe cut)/.test(s):/(starke blutung|blutet stark|spritzend|pulsierend|tiefer schnitt|platzwunde)/.test(s) || /(blutung|blutet|schnitt|platzwunde|offene wunde)/.test(s);},
  start:(text,s,L)=>{ s.state.name=null; return `⚠️ **Blutung – Sofortmaßnahmen:**\n1) **Druckverband** 5–10 Min. ohne Unterbrechung.\n2) Stelle leicht hochlagern.\n3) Ruhig + warm halten, nichts in die Wunde füllen.\n4) **Umgehend Tierarzt/Notdienst** aufsuchen.`; },
  step:()=>`Halte den Druckverband – stoppt es nicht: sofort losfahren.`
},

/* 4) Vergiftung */
{
  id:'poison', emergency:true,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(poison|toxin|ate rat poison|chocolate|xylitol|ibuprofen|grapes|raisins)/.test(s):/(vergift|gift|rattenköder|schokolade|xylit|ibuprofen|trauben|rosinen)/.test(s);},
  start:(text,s,L)=>{ s.state.name=null; return `⚠️ **Vergiftungsverdacht:**\n1) **Nichts** einflößen, **kein** Erbrechen erzwingen.\n2) Verpackung/Foto sichern.\n3) **Sofort** Tierarzt/Notdienst anrufen – Stoff, Menge, Zeit, Gewicht nennen.\n4) Taumeln/Krämpfe → **ohne Verzögerung losfahren**.`; },
  step:()=>`Bitte jetzt den Tierarzt anrufen – ich bleibe für Rückfragen.`
},

/* 5) Aufgeblähter Bauch / GDV */
{
  id:'bloat', emergency:true,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(bloat|gdv|swollen belly|retches but nothing)/.test(s):/(aufgeblähter bauch|magenumdrehung|magen\-torsion|würgen ohne erbrechen)/.test(s);},
  start:()=>{ return "⚠️ **Verdacht auf Magendrehung**: harter Bauch, Würgen ohne Erbrechen, Unruhe/Schmerz.\n→ **Sofort** Notdienst/Tierklinik – keine Zeit verlieren!"; },
  step:()=> "Bitte direkt in die Tierklinik fahren."
},

/* 6) Krampfanfall */
{
  id:'seizure', emergency:true,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(seizure|convulsion|fits|epilepsy)/.test(s):/(krampf|krampfanfall|epilepsie|anfälle)/.test(s);},
  start:()=>{ return `⚠️ **Krampfanfall – jetzt:**\n1) Verletzungen vermeiden, nicht festhalten; Kopf seitlich.\n2) Zeit messen; Umgebung abdunkeln.\n3) Nach dem Anfall: ruhig halten, nichts füttern.\n4) **Notdienst kontaktieren**, besonders >5 Min., mehrere Anfälle oder keine Erholung.`; },
  step:()=> "Wenn der Anfall >5 Min. dauert oder wiederkommt → Notdienst."
},

/* 7) Harnblockade / „kann nicht pinkeln“ */
{
  id:'urine', emergency:true,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(can'?t pee|cannot pee|no urine|straining no urine)/.test(s):/(kann nicht pinkeln|kein urin|strengt sich an und es kommt nichts)/.test(s) || /(urin|pinkelt|strengt sich an)/.test(s);},
  start:()=>{ return `⚠️ **Harnabfluss gestört** (Notfall möglich):\n1) Nicht warten – **sofort Tierarzt/Notdienst** (Gefahr durch Harnstau).\n2) Ruhig halten, Wasser anbieten – nicht forcieren.\n3) Bei Schmerzen/Unruhe → direkt losfahren.`; },
  step:()=> "Bitte fahre jetzt los – Harnblockaden werden schnell gefährlich."
},

/* 8) Knochenbruch/Trauma */
{
  id:'fracture', emergency:true,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(fracture|broken bone|broken leg|severe trauma|hit by car)/.test(s):/(bruch|knochenbruch|bein gebrochen|schweres trauma|autounfall)/.test(s);},
  start:()=>{ return `⚠️ **Verdacht auf Bruch/Trauma:**\n1) Ruhig halten, nicht selbst „einrenken“.\n2) Provisorische Schiene nur wenn sicher; sonst weich polstern.\n3) **Sofort** Tierarzt/Notdienst (Röntgen, Schmerztherapie).`; },
  step:()=> "Bitte direkt zum Tierarzt/Notdienst fahren."
},

/* ---------- Nicht‑Notfälle (Dialog mit 1–2 Schritten) ---------- */

/* 9) Durchfall */
{
  id:'diarrhea', emergency:false,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en' ? /(diarrhea|loose stool|watery stool|bloody stool)/.test(s) : /(durchfall|dünn|wässrig|breiig|blut im stuhl)/.test(s);},
  start:(text,s,L)=>{s.state.step=1;return`Durchfall – Fragen:\n1) Seit wann?\n2) Appetit/Trinken? (ja/nein)\n3) Blut/Schleim? (ja/nein)\n4) Zustand? (munter/müde)`;},
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(s.state.step===1){s.state.step=2;const t=s.state.data.text;const long=/(48|zwei tage|2 tage|seit.*tagen)/i.test(t);const bloody=/\b(blut|blutig|schleim)\b/i.test(t);const leth=/\b(müde|apathisch|schwach)\b/i.test(t);const nodrink=/(trinkt nicht|kein wasser|trinkt kaum)/i.test(t);const alarm=long||bloody||leth||nodrink;const out=`Einschätzung:\n• ${alarm?'Warnzeichen vorhanden.':'Leichter/mäßiger Durchfall.'}\nNächste Schritte:\n1) 6–12 h Schonkostpause (Wasser anbieten).\n2) Danach kleine Portionen: Reis+Huhn/Morosuppe.\n3) Elektrolytlösung (Tierbedarf).\n4) ${alarm?'Heute noch Tierarzt.':'Keine Besserung in 24–36 h → Tierarzt.'}\n⚠️ Welpen/Senioren/Vorerkrankungen → früher abklären.`; s.state.name=null; return out;}return"Sag Bescheid, falls Blut, Schwäche oder keine Besserung."; }
},

/* 10) Erbrechen */
{
  id:'vomit', emergency:false,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en' ? /(vomit|throwing up|nausea|bile|foam)/.test(s) : /(erbroch|kotz|brechen|übelkeit|galle|schaum)/.test(s);},
  start:(text,s,L)=>{s.state.step=1;return`Erbrechen – Fragen:\n1) Wie oft/12 h?\n2) Futter/Galle/Schaum? Blut?\n3) Hält Wasser? (ja/nein)\n4) Zustand? (munter/müde)`;},
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(s.state.step===1){s.state.step=2;const t=s.state.data.text;const many=/(3|drei|mehrfach|oft|häufig)/i.test(t);const blood=/\b(blut|rötlich)\b/i.test(t);const nowater=/(hält.*nicht|erbricht wasser|trinkt nicht)/i.test(t);const leth=/\b(müde|apathisch|schwach)\b/i.test(t);const alarm=many||blood||nowater||leth;const out=`Einschätzung:\n• ${alarm?'Warnzeichen vorhanden.':'Wahrscheinlich gereizter Magen.'}\nNächste Schritte:\n1) 6–12 h Futterpause (Wasser in kleinen Mengen, häufig).\n2) Danach Miniportionen Schonkost (Huhn/Reis/Morosuppe).\n3) Bauchschmerz/Aufblähung/Fremdkörper?\n4) ${alarm?'Heute noch Tierarzt.':'Keine Besserung in 24 h → Tierarzt.'}`; s.state.name=null; return out;}return"Gib ein Update, ob es besser wird."; }
},

/* 11) Humpeln/Lahmheit */
{
  id:'limp', emergency:false,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en' ? /(limp|lameness|not weight-bearing|favoring leg)/.test(s) : /(humpel|lahm|zieht bein|belastet nicht|lahmt)/.test(s);},
  start:(text,s,L)=>{s.state.step=1;return`Humpeln – Fragen:\n1) Seit wann?\n2) Belastet gar nicht/wenig?\n3) Schwellung/Verletzung? (ja/nein)\n4) Unfall/Sturz? (ja/nein)`;},
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(s.state.step===1){s.state.step=2;const t=s.state.data.text;const sinceDays=/(tage|seit.*tag|woche)/i.test(t);const noWeight=/(gar nicht|nicht belastet|trägt nicht)/i.test(t);const swelling=/(schwell|dick|heiß|warm)/i.test(t);const accident=/(unfall|sturz|zerrung|umgeknickt)/i.test(t);const alarm=noWeight||swelling||accident||sinceDays;const out=`Einschätzung:\n• ${noWeight?'Nicht‑Belasten = Warnzeichen.':(sinceDays?'>24–48 h bestehend.':'Leichte Lahmheit möglich.')}\nNächste Schritte:\n1) Schonung, keine Treppen/Wildspiele.\n2) Kühlen 10–15 Min., 2–3×/Tag.\n3) ${alarm?'Tierarzt innerhalb 24 h.':'Wenn keine Besserung → Tierarzt.'}`; s.state.name=null; return out;}return"Kurzes Update, bitte."; },
  photo:(s,L)=>L.photoReceived
},

/* 12) Auge */
{
  id:'eye', emergency:false,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(eye|ocular|red eye|squint|discharge)/.test(s):/(auge|augen|augenlid|rot|blinzelt|ausfluss)/.test(s);},
  start:()=>`Auge – Erste Hilfe:\n• Nicht reiben lassen; ggf. Halskragen.\n• Keine Menschen‑Augentropfen.\n• Evtl. NaCl‑Spülung bei Fremdkörperverdacht.\nFragen: stark rot/schmerz? Lichtempfindlich? Verletzung sichtbar?`,
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(!s.state.step)s.state.step=1;const t=s.state.data.text;const severe=/(stark|sehr|verletz|fremdkörper|trüb|blut)/i.test(t);const out=`Nächste Schritte:\n1) ${severe?'Heute noch':'Zeitnah'} Tierarzt (Hornhaut kann schmerzhaft sein).\n2) Nicht reiben; ggf. Halskragen.`; s.state.name=null; return out;},
  photo:(s,L)=>L.photoReceived
},

/* 13) Ohr */
{
  id:'ear', emergency:false,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(ear|otitis|shaking head|scratching ear|ear discharge)/.test(s):/(ohr|ohren|ohrenentzündung|kopfschütteln|kratzt ohr|ohr ausfluss)/.test(s);},
  start:()=>`Ohr – Erste Hilfe:\n• Nicht mit Wattestäbchen tief reinigen.\n• Ohr trocken halten; Kratzen vermeiden.\nFragen: Rötung/Schwellung/Geruch? Schmerz? Seit wann?`,
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(!s.state.step)s.state.step=1;const t=s.state.data.text;const severe=/(stark|eitrig|geruch|sehr rot|schmerz)/i.test(t);const out=`Nächste Schritte:\n1) ${severe?'Heute noch':'Zeitnah'} Tierarzt (Reinigung/Medikation).\n2) Bis dahin Kratzen vermeiden, Ohr trocken halten.`; s.state.name=null; return out;},
  photo:(s,L)=>L.photoReceived
},

/* 14) Zecke/Stich/Allergie */
{
  id:'tick', emergency:false,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(tick|bee sting|wasp sting|allergic reaction|hives)/.test(s):/(zecke|stich|wespe|biene|allergie|quaddeln)/.test(s);},
  start:()=>`Zecke/Stich:\n• Zecke mit Zange nahe der Haut greifen, langsam ziehen; keine Öle.\n• Stich kühlen, Ruhe.\nFragen: Gesicht/Zunge geschwollen? Atemprobleme? Seit wann?`,
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(!s.state.step)s.state.step=1;const t=s.state.data.text;const face=/(gesicht|zunge|augenlid|maul)/i.test(t);const breath=/(atemnot|keucht|schlecht luft)/i.test(t);const out=`Nächste Schritte:\n1) Kühlen, Ruhe.\n2) ${face||breath?'Sofort Tierarzt/Notdienst.':'Beobachten; bei starker Schwellung/Schwäche → Tierarzt.'}\n3) Nach Zecke: Stelle täglich ansehen; Fieber/Trägheit → abklären.`; s.state.name=null; return out;},
  photo:(s,L)=>L.photoReceived
},

/* 15) Husten/Atemwege */
{
  id:'cough', emergency:false,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(cough|kennel cough|trachea|honking|breath|breathing)/.test(s):/(husten|zwingerhusten|trachea|würgen|atem|pfeift|keucht)/.test(s);},
  start:()=>`Husten – Fragen:\n1) Seit wann? Fieber?\n2) Trocken/feucht? Würgen?\n3) Atemnot (Maul offen, blaue Zunge), kollabiert?`,
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(!s.state.step)s.state.step=1;const t=s.state.data.text;const distress=/(atemnot|keucht|maul offen|blaue zunge|kollabiert)/i.test(t);const out=`Einschätzung & Schritte:\n1) ${distress?'Akut: sofort':'Zeitnah'} Tierarzt, besonders bei Atemnot.\n2) Ruhe, Zugluft vermeiden, Geschirr statt Halsband.\n3) Trinken anbieten, Anstrengung vermeiden.`; s.state.name=null; return out;}
},

/* 16) Appetitlosigkeit */
{
  id:'anorexia', emergency:false,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(no appetite|not eating|refuses food|stopped eating)/.test(s):/(appetitlos|frisst nicht|frisst kaum|futter verweigert)/.test(s);},
  start:()=>`Appetitlosigkeit – Fragen:\n1) Seit wann?\n2) Trinkt normal? (ja/nein)\n3) Begleitend: Erbrechen/Durchfall/Fieber/Schmerz?`,
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(!s.state.step)s.state.step=1;const t=s.state.data.text;const long=/(tage|seit.*tag|woche)/i.test(t);const alarm=/(erbricht|durchfall|fieber|schmerz|apathisch)/i.test(t);const out=`Schritte:\n1) Wasser anbieten, Futter leicht erwärmen, sehr kleine Portionen.\n2) ${alarm||long?'Heute noch Tierarzt':'Wenn keine Besserung <24–48 h → Tierarzt'}.\n3) Beobachten: Trinken/Urin/Schmerzen.`; s.state.name=null; return out;}
},

/* 17) Verstopfung */
{
  id:'constipation', emergency:false,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(constipation|hard stool|straining to poop)/.test(s):/(verstopfung|harte kot|drückt ohne erfolg)/.test(s);},
  start:()=>`Verstopfung – Fragen:\n1) Seit wann?\n2) Frisst/Trinkt normal? (ja/nein)\n3) Schmerz, Aufblähung, Erbrechen? (ja/nein)`,
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(!s.state.step)s.state.step=1;const t=s.state.data.text;const long=/(tage|seit.*tag|woche)/i.test(t);const alarm=/(starke schmerzen|aufgebläht|erbricht)/i.test(t);const out=`Schritte:\n1) Wasser anbieten, kurze entspannte Spaziergänge.\n2) Leichte Kost, ggf. etwas Öl/Morosuppe.\n3) ${alarm||long?'Tierarzt (Darmverschluss ausschließen).':'Wenn keine Besserung 24–48 h → Tierarzt.'}`; s.state.name=null; return out;}
},

/* 18) Zahn/Zahnfleisch */
{
  id:'tooth', emergency:false,
  match:(t,lang)=>{const s=t.toLowerCase();return lang==='en'?/(tooth|teeth|gum|broken tooth|tooth pain)/.test(s):/(zahn|zähne|zahnfleisch|zahnbruch|zahnschmerz)/.test(s);},
  start:()=>`Zahn/Zahnfleisch – Fragen:\n1) Abgebrochener Zahn sichtbar? (ja/nein)\n2) Blutung/übel riechender Mund? (ja/nein)\n3) Frisst er schlechter? (ja/nein)`,
  step:(text,s,L)=>{s.state.data.text=(s.state.data.text||'')+' '+text;if(!s.state.step)s.state.step=1;const t=s.state.data.text;const broken=/(abgebrochen|bruch|splitter)/i.test(t);const bleedSmell=/(blutet|geruch)/i.test(t);const out=`Schritte:\n1) Weiche Kost, nichts Hartes kauen lassen.\n2) ${broken||bleedSmell?'Heute noch':'Zeitnah'} Tierarzt/Zahnröntgen.\n3) Schmerzen/Schwellung → schneller Termin.`; s.state.name=null; return out;}
}

];

