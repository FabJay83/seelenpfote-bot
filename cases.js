// cases.js — 18 empathische Fälle (CommonJS, ohne OpenAI)
// Schema pro Fall: { id, emergency, match(t, lang), start(), step?(text,s), photo?() }

const safeMatch = (t) => (typeof t === 'string' ? t.toLowerCase() : '');
const safeLang  = (l) => (l === 'en' ? 'en' : 'de');

module.exports = [
  // ===================== NOTFÄLLE =====================

  // 1) Hitzschlag / Überhitzung
  {
    id: 'heat',
    emergency: true,
    match: (t, lang) => {
      const s = safeMatch(t), l = safeLang(lang);
      return l === 'en'
        ? /(heatstroke|overheat|overheated|hot car|panting heavily|collapsed from heat)/.test(s)
        : /(hitzschlag|hitzeschlag|überhitz|heißes auto|starkes hecheln|kollaps durch hitze)/.test(s);
    },
    start: () =>
`⚠️ **Hitzestress – atme kurz durch, wir handeln jetzt Schritt für Schritt.**  
1) 🧊 In **Schatten/kühlen Raum** bringen (Ventilator, wenn möglich).  
2) 💧 **Langsam kühlen**: Bauch, Leisten, Pfoten mit *kühlem* (nicht eiskaltem) Wasser befeuchten.  
3) 🥤 **Wasser in kleinen Schlucken** anbieten.  
4) ☎️ **Sofort Tierarzt/Notdienst** anrufen und Ankunft ankündigen.  
5) 🚑 Bei Taumeln, Erbrechen, Kollaps **direkt losfahren**. Ich bin bei dir. 💛`
  },

  // 2) Starke Blutung / tiefer Schnitt
  {
    id: 'bleeding',
    emergency: true,
    match: (t, lang) => {
      const s = safeMatch(t), l = safeLang(lang);
      const en = /(heavy|spurting|pulsing)\s*blood/.test(s) || /(deep|gaping)\s*(cut|wound)/.test(s) || /(bleeding|cut|laceration|open wound)/.test(s);
      const de = /(starke?r?|pulsierend|spritzend|viel)\s*blut/.test(s) || /(tiefe?r?|klaffend)\s*(schnitt|wunde)/.test(s) || /(blutung|blutet|schnitt|platzwunde|offene wunde)/.test(s);
      return l === 'en' ? en : de;
    },
    start: () =>
`⚠️ **Blutung – bleib ruhig, wir packen das gemeinsam.**  
1) 🩹 **Druckverband** anlegen (sauberes Tuch/Gaze) und **5–10 Min. NICHT lösen**.  
2) 🧍‍♀️ Möglichst **hochlagern**, ruhig & warm halten.  
3) 🚫 **Nichts in die Wunde füllen**, tiefe Wunden nicht spülen.  
4) ☎️ **Umgehend Tierarzt/Notdienst** informieren. Du machst das gut. 💛`
  },

  // 3) Vergiftung
  {
    id: 'poison',
    emergency: true,
    match: (t, lang) => {
      const s = safeMatch(t), l = safeLang(lang);
      const en = /(poison|toxin|ate rat poison|chocolate|xylitol|ibuprofen|grapes|raisins|antifreeze|slug pellets)/.test(s);
      const de = /(vergift|gift|rattenköder|schokolade|xylit|ibuprofen|trauben|rosinen|frostschutz|schneckenkorn)/.test(s);
      return l === 'en' ? en : de;
    },
    start: () =>
`⚠️ **Vergiftungsverdacht – wir handeln sofort.**  
1) 🚫 **Nichts einflößen**, **kein Erbrechen erzwingen**.  
2) 📸 **Verpackung/Fotos** sichern (Stoff, Menge, Zeitpunkt, Gewicht).  
3) ☎️ **Sofort Tierarzt/Notdienst** anrufen.  
4) 🚑 Bei Taumeln, Krämpfen, starker Schwäche **direkt losfahren**. Ich bleibe bei dir. 🐾`
  },

  // 4) Aufgeblähter Bauch / GDV
  {
    id: 'bloat',
    emergency: true,
    match: (t, lang) => {
      const s = safeMatch(t), l = safeLang(lang);
      return l === 'en'
        ? /(bloat|gdv|swollen belly|retches but nothing|distended abdomen)/.test(s)
        : /(aufgeblähter bauch|magenumdrehung|magendrehung|würgen ohne erbrechen|aufgetriebener bauch)/.test(s);
    },
    start: () =>
`⚠️ **Verdacht auf Magendrehung (GDV).**  
Harter, aufgetriebener Bauch + Würgen ohne Erbrechen + Unruhe/Schmerz.  
👉 **Keine Zeit verlieren**: ☎️ **Sofort Tierklinik/Notdienst**, **direkt losfahren**. Ich bin bei dir. 💛`
  },

  // 5) Krampfanfall
  {
    id: 'seizure',
    emergency: true,
    match: (t, lang) => {
      const s = safeMatch(t), l = safeLang(lang);
      return l === 'en' ? /(seizure|convulsion|fits|epilepsy)/.test(s)
                        : /(krampf|krampfanfall|epilepsie|anfälle)/.test(s);
    },
    start: () =>
`⚠️ **Krampfanfall – atme ruhig, ich helfe dir.**  
1) 🛡️ **Gefahren entfernen**, nicht festhalten; Kopf seitlich lagern.  
2) ⏱️ **Dauer messen**, Umgebung abdunkeln.  
3) 🌿 Nach dem Anfall: **ruhig halten**, nichts füttern.  
4) ☎️ **Notdienst kontaktieren**, besonders >5 Min., mehrere Anfälle oder keine Erholung. Du bist nicht allein. 🐾`
  },

  // 6) Harnblockade / kann nicht pinkeln
  {
    id: 'urine',
    emergency: true,
    match: (t, lang) => {
      const s = safeMatch(t), l = safeLang(lang);
      const en = /(can'?t pee|cannot pee|no urine|straining no urine|blocked)/.test(s);
      const de = /(kann nicht pinkeln|kein urin|ohne erfolg drücken|strengt sich an und es kommt nichts|harnblockade)/.test(s);
      return l === 'en' ? en : de;
    },
    start: () =>
`⚠️ **Harnabfluss gestört – das ist dringend.**  
1) ⛑️ **Nicht abwarten** – ☎️ **sofort Tierarzt/Notdienst** (Gefahr Harnstau/Intox).  
2) 🌊 **Wasser anbieten**, nichts forcieren.  
3) 🚑 Bei Schmerzen/Unruhe **direkt losfahren**. Du handelst richtig. 💛`
  },

  // 7) Knochenbruch / schweres Trauma
  {
    id: 'fracture',
    emergency: true,
    match: (t, lang) => {
      const s = safeMatch(t), l = safeLang(lang);
      return l === 'en' ? /(fracture|broken bone|broken leg|severe trauma|hit by car)/.test(s)
                        : /(bruch|knochenbruch|bein gebrochen|schweres trauma|autounfall)/.test(s);
    },
    start: () =>
`⚠️ **Verdacht auf Bruch/Trauma – ruhig bleiben, wir handeln jetzt.**  
1) 🤲 **Ruhig halten**, nicht „einrenken“.  
2) 🧻 Nur wenn du dich sicher fühlst: **weich polstern**, keine harte Schiene.  
3) ☎️ **Sofort Tierarzt/Notdienst** (Röntgen, Schmerztherapie). Ich bin bei dir. 🐾`
  },

  // ===================== NICHT-NOTFÄLLE =====================

  // 8) Pfote/Wunde/Schwellung
  {
    id: 'paw',
    emergency: false,
    match: (t, lang) => {
      const s = safeMatch(t), l = safeLang(lang);
      const en = (/(paw|pad|nail)/.test(s) && /(inflam|red|swoll|wound|pus|cut|crack)/.test(s)) || /(inflamed paw|paw wound)/.test(s);
      const de = (/(pfote|ballen|kralle)/.test(s) && /(entzünd|rot|schwell|wund|eiter|schnitt|riss)/.test(s)) || /(pfote entzündet|pfotenwunde)/.test(s);
      return l === 'en' ? en : de;
    },
    start: () =>
`🐾 **Pfote/Wunde – wir schauen das gemeinsam an.**  
• Mit lauwarmem Wasser/NaCl spülen, sanft trocken tupfen.  
• Lecken verhindern (Socke/Schuh/Body), kurze Ruhe.  
• 10–15 Min. kühlen (Tuch, kein Eis direkt).  
Magst du mir sagen: **seit wann**, **Lahmheit stark/leicht**, **Schnitt/Fremdkörper sichtbar**?`
  },

  // 9) Durchfall
  {
    id: 'diarrhea',
    emergency: false,
    match: (t, lang) => {
      const s = safeMatch(t), l = safeLang(lang);
      return l === 'en' ? /(diarrhea|loose stool|watery stool|bloody stool)/.test(s)
                        : /(durchfall|dünn|wässrig|breiig|blut im stuhl)/.test(s);
    },
    start: () =>
`💧 **Durchfall – wir gehen das ruhig an.**  
• 6–12 h Futterpause (Wasser anbieten).  
• Danach kleine Portionen Schonkost (Reis+Huhn/Morosuppe).  
• Optional: Elektrolytlösung (Tierbedarf).  
Kurze Fragen: **seit wann**, **trinkt normal**, **Blut/Schleim**, **wirkt müde**?`
  },

  // 10) Erbrechen
  {
    id: 'vomit',
    emergency: false,
    match: (t, lang) => {
      const s = safeMatch(t), l = safeLang(lang);
      return l === 'en' ? /(vomit|throwing up|nausea|bile|foam)/.test(s)
                        : /(erbroch|kotz|brechen|übelkeit|galle|schaum)/.test(s);
    },
    start: () =>
`🤢 **Erbrechen – wir ordnen das in Ruhe.**  
• 6–12 h Futterpause (Wasser in **kleinen Schlucken**, häufiger).  
• Danach Miniportionen Schonkost (Huhn/Reis/Morosuppe).  
Sag mir bitte: **wie oft/12 h**, **Wasser bleibt drin**, **müde/normal**, **Blut sichtbar**?`
  },

  // 11) Humpeln/Lahmheit
  {
     id: 'limp',
  emergency: false,
  match: (t, lang) => {
    const s = safeMatch(t), l = safeLang(lang);
    return l === 'en' ? /(limp|lameness|not weight-bearing|favoring leg)/.test(s)
                      : /(humpel|lahm|zieht bein|belastet nicht|lahmt)/.test(s);
    },
    start: () =>
`🚶 **Humpeln – wir schauen genau hin.**  
• Schonung, keine Treppen/wilden Spiele.  
• Kühlen 10–15 Min., 2–3×/Tag (Tuch, kein Eis direkt).  
• Kurze, ruhige Runden.  
Kurze Fragen: **seit wann**, **belastet gar nicht/leicht**, **Schwellung/Verletzung**, **Unfall/Sturz**?`
  },

  // 12) Auge
  {
    id: 'eye',
    emergency: false,
    match: (t, lang) => {
      const s = safeMatch(t), l = safeLang(lang);
      return l === 'en' ? /(eye|ocular|red eye|squint|discharge)/.test(s)
                        : /(auge|augen|augenlid|rot|blinzelt|ausfluss)/.test(s);
    },
    start: () =>
`👁️ **Auge – sanft vorgehen.**  
• Nicht reiben lassen (Body/Halskragen wenn vorhanden).  
• Keine Menschen‑Augentropfen.  
• Bei Fremdkörpergefühl: sanft mit NaCl spülen.  
Fragen: **stark rot/schmerz**, **lichtempfindlich**, **Verletzung sichtbar**?`
  },

  // 13) Ohrentzündung
  {
    id: 'ear',
    emergency: false,
    match: (t, lang) => {
      const s = safeMatch(t), l = safeLang(lang);
      return l === 'en' ? /(ear|otitis|shaking head|scratching ear|ear discharge)/.test(s)
                        : /(ohr|ohren|ohrenentzündung|kopfschütteln|kratzt ohr|ohr ausfluss)/.test(s);
    },
    start: () =>
`👂 **Ohr – behutsam handeln.**  
• Keine Wattestäbchen tief ins Ohr.  
• Ohr trocken halten, Kratzen vermeiden.  
Fragen: **Rötung/Schwellung/Geruch**, **Schmerz**, **seit wann**?`
  },

  // 14) Zecke/Stich/Allergie
  {
    id: 'tick',
    emergency: false,
    match: (t, lang) => {
      const s = safeMatch(t), l = safeLang(lang);
      return l === 'en' ? /(tick|bee sting|wasp sting|allergic reaction|hives)/.test(s)
                        : /(zecke|stich|wespe|biene|allergie|quaddeln)/.test(s);
    },
    start: () =>
`🐝 **Zecke/Stich – ruhig bleiben, wir kümmern uns.**  
• Zecke hautnah greifen und langsam ziehen (keine Öle).  
• Stich kühlen, Ruhe geben.  
Fragen: **Gesicht/Zunge geschwollen**, **Atemprobleme**, **seit wann**?`
  },

  // 15) Husten/Atemwege
  {
    id: 'cough',
    emergency: false,
    match: (t, lang) => {
      const s = safeMatch(t), l = safeLang(lang);
      return l === 'en' ? /(cough|kennel cough|trachea|honking|breath|breathing|wheez)/.test(s)
                        : /(husten|zwingerhusten|trachea|würgen|atem|pfeift|keucht)/.test(s);
    },
    start: () =>
`🌬️ **Husten/Atemwege – behutsam vorgehen.**  
• Ruhe, Zugluft vermeiden, **Geschirr** statt Halsband.  
• Trinken anbieten, Anstrengung vermeiden.  
Fragen: **seit wann**, **Fieber**, **trocken/feucht**, **Atemnot/Kollaps**?`
  },

  // 16) Appetitlosigkeit
  {
    id: 'anorexia',
    emergency: false,
    match: (t, lang) => {
      const s = safeMatch(t), l = safeLang(lang);
      return l === 'en' ? /(no appetite|not eating|refuses food|stopped eating)/.test(s)
                        : /(appetitlos|frisst nicht|frisst kaum|futter verweigert)/.test(s);
    },
    start: () =>
`🍗 **Frisst nicht – wir schauen gemeinsam.**  
• Wasser anbieten, Futter leicht erwärmen, sehr kleine Portionen.  
Kurze Fragen: **seit wann**, **trinkt normal**, **Erbrechen/Durchfall/Fieber/Schmerz**?`
  },

  // 17) Verstopfung
  {
    id: 'constipation',
    emergency: false,
    match: (t, lang) => {
      const s = safeMatch(t), l = safeLang(lang);
      return l === 'en' ? /(constipation|hard stool|straining to poop)/.test(s)
                        : /(verstopfung|harte(s|r)? kot|drückt ohne erfolg)/.test(s);
    },
    start: () =>
`🚻 **Verstopfung – ruhig bleiben, wir lösen das.**  
• Wasser anbieten, kurze entspannte Spaziergänge.  
• Leichte Kost, ggf. Morosuppe.  
Fragen: **seit wann**, **frisst/trinkt normal**, **Schmerz/Aufblähung/Erbrechen**?`
  },

  // 18) Zahn/Zahnfleisch/Zahnbruch
  {
    id: 'tooth',
    emergency: false,
    match: (t, lang) => {
      const s = safeMatch(t), l = safeLang(lang);
      return l === 'en' ? /(tooth|teeth|gum|broken tooth|tooth pain)/.test(s)
                        : /(zahn|zähne|zahnfleisch|zahnbruch|zahnschmerz)/.test(s);
    },
    start: () =>
`🦷 **Zahn/Zahnfleisch – sanft angehen.**  
• Weiche Kost, nichts Hartes kauen lassen.  
Fragen: **abgebrochener Zahn sichtbar**, **Blutung/Geruch**, **frisst schlechter**?`
  }
];







