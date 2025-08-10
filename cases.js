// cases.js — 18 Fälle (Notfall-Priorität, kurze Fragen, klare Schritte)
// Hinweis: Empathie/Verpackung passiert in index.js via careWrap()

module.exports = [
  // ========== NOTFÄLLE (sofortige Antwort, keine Rückfragen) ==========

  // 1) Hitzschlag / Überhitzung
  {
    id: 'heat',
    emergency: true,
    match: (t, lang) => {
      const s = t.toLowerCase();
      return lang === 'en'
        ? /(heatstroke|overheat|overheated|hot car|panting heavily|collapsed from heat)/.test(s)
        : /(hitzschlag|hitzeschlag|überhitz|heißes auto|starkes hecheln|kollaps durch hitze)/.test(s);
    },
    start: () =>
`⚠️ **Hitzschlag – jetzt handeln:**
1) In Schatten/kühlen Raum; Ventilator wenn möglich.
2) Mit *kühlem* (nicht eiskaltem) Wasser befeuchten – Bauch/Leisten/Pfoten.
3) Wasser in kleinen Mengen anbieten.
4) **Sofort Tierarzt anrufen** und Ankunft ankündigen.
5) Taumeln/Erbrechen/Kollaps → **direkt losfahren**.`,
    step: () => null
  },

  // 2) Starke Blutung / tiefer Schnitt
  {
    id: 'bleeding',
    emergency: true,
    match: (t, lang) => {
      const s = t.toLowerCase();
      const strongDe = /(starke?r?|pulsierend|spritzend|viel)\s*blut/i.test(s) || /(tiefe?r?|klaffend)\s*(schnitt|wunde)/i.test(s);
      const strongEn = /(heavy|spurting|pulsing)\s*blood/i.test(s) || /(deep|gaping)\s*(cut|wound)/i.test(s);
      const genericDe = /(blutung|blutet|schnitt|platzwunde|offene wunde)/.test(s);
      const genericEn = /(bleeding|cut|laceration|open wound)/.test(s);
      return lang === 'en' ? (strongEn || genericEn) : (strongDe || genericDe);
    },
    start: () =>
`⚠️ **Blutung – Sofortmaßnahmen:**
1) **Druckverband** anlegen (Gaze/Tuch) und **5–10 Min. nicht lösen**.
2) Möglichst hochlagern, ruhig & warm halten.
3) Nichts in die Wunde füllen; tiefe Wunden nicht spülen.
4) **Umgehend Tierarzt/Notdienst** aufsuchen.`,
    step: () => null
  },

  // 3) Vergiftung
  {
    id: 'poison',
    emergency: true,
    match: (t, lang) => {
      const s = t.toLowerCase();
      const en = /(poison|toxin|ate rat poison|chocolate|xylitol|ibuprofen|grapes|raisins|antifreeze|slug pellets)/.test(s);
      const de = /(vergift|gift|rattenköder|schokolade|xylit|ibuprofen|trauben|rosinen|frostschutz|schneckenkorn)/.test(s);
      return lang === 'en' ? en : de;
    },
    start: () =>
`⚠️ **Vergiftungsverdacht:**
1) **Nichts** einflößen, **kein** Erbrechen erzwingen.
2) Verpackung/Fotos sichern (Stoff, Menge, Zeitpunkt, Gewicht).
3) **Sofort** Tierarzt/Notdienst anrufen.
4) Bei Taumeln/Krämpfen → **ohne Verzögerung losfahren**.`,
    step: () => null
  },

  // 4) Aufgeblähter Bauch / GDV
  {
    id: 'bloat',
    emergency: true,
    match: (t, lang) => {
      const s = t.toLowerCase();
      return lang === 'en'
        ? /(bloat|gdv|swollen belly|retches but nothing|distended abdomen)/.test(s)
        : /(aufgeblähter bauch|magenumdrehung|magendrehung|magnetorsion|würgen ohne erbrechen|aufgetriebener bauch)/.test(s);
    },
    start: () =>
`⚠️ **Verdacht auf Magendrehung (GDV):**
Harter, aufgetriebener Bauch + Würgen ohne Erbrechen + Unruhe/Schmerz.
→ **Sofort** Notdienst/Tierklinik – keine Zeit verlieren!`,
    step: () => null
  },

  // 5) Krampfanfall
  {
    id: 'seizure',
    emergency: true,
    match: (t, lang) => {
      const s = t.toLowerCase();
      return lang === 'en' ? /(seizure|convulsion|fits|epilepsy)/.test(s)
                           : /(krampf|krampfanfall|epilepsie|anfälle)/.test(s);
    },
    start: () =>
`⚠️ **Krampfanfall – jetzt:**
1) Verletzungen vermeiden, nicht festhalten; Kopf seitlich lagern.
2) Zeit messen; Umgebung abdunkeln.
3) Nach dem Anfall: ruhig halten, nichts füttern.
4) **Notdienst kontaktieren**, besonders >5 Min., mehrere Anfälle oder keine Erholung.`,
    step: () => null
  },

  // 6) Harnblockade / kann nicht pinkeln
  {
    id: 'urine',
    emergency: true,
    match: (t, lang) => {
      const s = t.toLowerCase();
      const en = /(can'?t pee|cannot pee|no urine|straining no urine|blocked)/.test(s);
      const de = /(kann nicht pinkeln|kein urin|ohne erfolg drücken|strengt sich an und es kommt nichts|harnblockade)/.test(s);
      return lang === 'en' ? en : de;
    },
    start: () =>
`⚠️ **Harnabfluss gestört** (möglicher Notfall):
1) Nicht warten – **sofort Tierarzt/Notdienst** (Gefahr Harnstau/Intox).
2) Ruhe, Wasser anbieten – nichts forcieren.
3) Bei Schmerzen/Unruhe → **direkt losfahren**.`,
    step: () => null
  },

  // 7) Knochenbruch / schweres Trauma
  {
    id: 'fracture',
    emergency: true,
    match: (t, lang) => {
      const s = t.toLowerCase();
      return lang === 'en' ? /(fracture|broken bone|broken leg|severe trauma|hit by car)/.test(s)
                           : /(bruch|knochenbruch|bein gebrochen|schweres trauma|autounfall)/.test(s);
    },
    start: () =>
`⚠️ **Verdacht auf Bruch/Trauma:**
1) Ruhig halten, nicht „einrenken“.
2) Provisorische Schiene nur wenn sicher; sonst weich polstern.
3) **Sofort** Tierarzt/Notdienst (Röntgen, Schmerztherapie).`,
    step: () => null
  },

  // ========== NICHT-NOTFÄLLE (Dialog in 1–2 Schritten, danach Abschluss) ==========

  // 8) Pfote/Wunde/Schwellung
  {
    id: 'paw',
    emergency: false,
    match: (t, lang) => {
      const s = t.toLowerCase();
      const en = (/(paw|pad|nail)/.test(s) && /(inflam|red|swoll|wound|pus|cut|crack)/.test(s)) || /(inflamed paw|paw wound)/.test(s);
      const de = (/(pfote|ballen|kralle)/.test(s) && /(entzünd|rot|schwell|wund|eiter|schnitt|riss)/.test(s)) || /(pfote entzündet|pfotenwunde)/.test(s);
      return lang === 'en' ? en : de;
    },
    start: () =>
`Pfote/Wunde – Erste Hilfe:
• Mit lauwarmem Wasser/NaCl spülen, sanft trocken tupfen.
• Lecken verhindern (Socke/Schuh/Halskragen).
• 10–15 Min. kühlen (Tuch, kein Eis direkt).
Fragen:
1) Seit wann?
2) Lahmt stark/leicht?
3) Schnitt/Fremdkörper sichtbar? (ja/nein)
(Optional: Foto senden)`,
    step: (text, s) => {
      s.state.name = null;
      const t = text.toLowerCase();
      const long = /(tage|woche|seit.*tag|seit.*woche)/.test(t);
      const strong = /(gar nicht|kaum|stark|nicht belastet)/.test(t);
      const foreignNo = /\bnein\b/.test(t);
      return `Einschätzung:
• ${long ? 'Seit mehreren Tagen' : 'Eher frisch'}${strong ? ' + deutliche Lahmheit' : ''}.
• ${foreignNo ? 'Kein sichtbarer Fremdkörper.' : 'Zwischen Ballen auf Schnitt/Splitter prüfen.'}
Nächste Schritte:
1) 2–3×/Tag spülen, trocken tupfen; Lecken verhindern.
2) 10–15 Min. kühlen, 2–3×/Tag.
3) Schonung/kurze Gassi‑Runden.
4) ${long || strong ? 'Tierarzt innerhalb 24 h.' : 'Keine Besserung in 24–48 h → Tierarzt.'}`;
    },
    photo: () => `Foto erhalten, danke! Bitte achte auf Größe, Rötung/Schwellung, nässend/trocken, und ob er die Pfote belastet.`
  },

  // 9) Durchfall
  {
    id: 'diarrhea',
    emergency: false,
    match: (t, lang) => {
      const s = t.toLowerCase();
      return lang === 'en' ? /(diarrhea|loose stool|watery stool|bloody stool)/.test(s)
                           : /(durchfall|dünn|wässrig|breiig|blut im stuhl)/.test(s);
    },
    start: () =>
`Durchfall – Fragen:
1) Seit wann?
2) Appetit/Trinken? (ja/nein)
3) Blut/Schleim? (ja/nein)
4) Zustand? (munter/müde)
(Optional: Foto vom Kot)`,
    step: (text, s) => {
      s.state.name = null;
      const t = text.toLowerCase();
      const long = /(48|zwei tage|2 tage|seit.*tagen)/.test(t);
      const bloody = /\b(blut|blutig|schleim)\b/.test(t);
      const leth = /\b(müde|apathisch|schwach)\b/.test(t);
      const nodrink = /(trinkt nicht|kein wasser|trinkt kaum)/.test(t);
      const alarm = long || bloody || leth || nodrink;
      return `Einschätzung:
• ${alarm ? 'Warnzeichen vorhanden.' : 'Leichter/mäßiger Durchfall.'}
Nächste Schritte:
1) 6–12 h Schonkostpause (Wasser anbieten).
2) Danach kleine Portionen: Reis+Huhn oder Morosuppe.
3) Elektrolytlösung (Tierbedarf).
4) ${alarm ? 'Heute noch Tierarzt kontaktieren.' : 'Keine Besserung in 24–36 h → Tierarzt.'}
⚠️ Welpen/Senioren/Vorerkrankungen → früher abklären.`;
    },
    photo: () => `Foto erhalten. Falls Blut/Schleim sichtbar ist oder dein Tier müde wirkt, bitte heute noch beim Tierarzt melden.`
  },

  // 10) Erbrechen
  {
    id: 'vomit',
    emergency: false,
    match: (t, lang) => {
      const s = t.toLowerCase();
      return lang === 'en' ? /(vomit|throwing up|nausea|bile|foam)/.test(s)
                           : /(erbroch|kotz|brechen|übelkeit|galle|schaum)/.test(s);
    },
    start: () =>
`Erbrechen – Fragen:
1) Wie oft/12 h?
2) Futter/Galle/Schaum? Blut?
3) Hält Wasser? (ja/nein)
4) Zustand? (munter/müde)
(Optional: Foto)`,
    step: (text, s) => {
      s.state.name = null;
      const t = text.toLowerCase();
      const many = /(3|drei|mehrfach|oft|häufig)/.test(t);
      const blood = /\b(blut|rötlich)\b/.test(t);
      const nowater = /(hält.*nicht|erbricht wasser|trinkt nicht)/.test(t);
      const leth = /\b(müde|apathisch|schwach)\b/.test(t);
      const alarm = many || blood || nowater || leth;
      return `Einschätzung:
• ${alarm ? 'Warnzeichen vorhanden.' : 'Wahrscheinlich gereizter Magen.'}
Nächste Schritte:
1) 6–12 h Futterpause (Wasser in kleinen Mengen, häufig).
2) Danach Miniportionen Schonkost (Huhn/Reis/Morosuppe).
3) Bauchschmerz/Aufblähung/Fremdkörper?
4) ${alarm ? 'Heute noch Tierarzt.' : 'Keine Besserung in 24 h → Tierarzt.'}`;
    },
    photo: () => `Danke fürs Foto. Achte bitte auf Blutanteile, fremde Teile (Fäden/Knochenstücke) und ob Wasser bei kleinen Schlucken drin bleibt.`
  },

  // 11) Humpeln/Lahmheit
  {
    id: 'limp',
    emergency: false,
    match: (t, lang) => {
      const s = t.toLowerCase();
      return lang === 'en' ? /(limp|lameness|not weight-bearing|favoring leg)/.test(s)
                           : /(humpel|lahm|zieht bein|belastet nicht|lahmt)/.test(s);
    },
    start: () =>
`Humpeln – Fragen:
1) Seit wann?
2) Belastet gar nicht/wenig?
3) Schwellung/Verletzung? (ja/nein)
4) Unfall/Sturz? (ja/nein)
(Optional: Foto/kurzes Video)`,
    step: (text, s) => {
      s.state.name = null;
      const t = text.toLowerCase();
      const sinceDays = /(tage|seit.*tag|woche)/.test(t);
      const noWeight = /(gar nicht|nicht belastet|trägt nicht)/.test(t);
      const swelling = /(schwell|dick|heiß|warm)/.test(t);
      const accident = /(unfall|sturz|zerrung|umgeknickt)/.test(t);
      const alarm = noWeight || swelling || accident || sinceDays;
      return `Einschätzung:
• ${noWeight ? 'Nicht‑Belasten = Warnzeichen.' : (sinceDays ? '>24–48 h bestehend.' : 'Leichte Lahmheit möglich.')}
Nächste Schritte:
1) Schonung, keine Treppen/Wildspiele.
2) Kühlen 10–15 Min., 2–3×/Tag (Tuch, kein Eis direkt).
3) Kurze ruhige Runden.
4) ${alarm ? 'Tierarzt innerhalb 24 h.' : 'Keine Besserung → Tierarzt.'}`;
    }
  },

  // 12) Auge
  {
    id: 'eye',
    emergency: false,
    match: (t, lang) => {
      const s = t.toLowerCase();
      return lang === 'en' ? /(eye|ocular|red eye|squint|discharge)/.test(s)
                           : /(auge|augen|augenlid|rot|blinzelt|ausfluss)/.test(s);
    },
    start: () =>
`Auge – Erste Hilfe:
• Nicht reiben lassen, ggf. Halskragen.
• Keine Menschen‑Augentropfen.
• ggf. NaCl‑Spülung bei Fremdkörperverdacht.
Fragen: stark rot/schmerz? Lichtempfindlich? Verletzung sichtbar? (Foto möglich)`,
    step: (text, s) => {
      s.state.name = null;
      const severe = /(stark|sehr|verletz|fremdkörper|trüb|blut)/i.test(text);
      return `Nächste Schritte:
1) ${severe ? 'Heute noch' : 'Zeitnah'} Tierarzt (Hornhaut kann schmerzhaft sein).
2) Nicht reiben; ggf. Halskragen.
3) Foto/Video hilft.`;
    },
    photo: () => `Foto erhalten. Achte auf Trübung, starke Rötung oder Verletzung – das gehört eher früher als später zum Tierarzt.`
  },

  // 13) Ohrentzündung
  {
    id: 'ear',
    emergency: false,
    match: (t, lang) => {
      const s = t.toLowerCase();
      return lang === 'en' ? /(ear|otitis|shaking head|scratching ear|ear discharge)/.test(s)
                           : /(ohr|ohren|ohrenentzündung|kopfschütteln|kratzt ohr|ohr ausfluss)/.test(s);
    },
    start: () =>
`Ohr – Erste Hilfe:
• Nicht mit Wattestäbchen tief reinigen.
• Ohr trocken halten, Kratzen vermeiden.
Fragen: Rötung/Schwellung/Geruch? Schmerz? Seit wann? (Foto möglich)`,
    step: (text, s) => {
      s.state.name = null;
      const severe = /(stark|eitrig|geruch|sehr rot|schmerz)/i.test(text);
      return `Nächste Schritte:
1) ${severe ? 'Heute noch' : 'Zeitnah'} Tierarzt zur Reinigung/Medikation.
2) Bis dahin Kratzen vermeiden, Ohr trocken halten.
3) Keine Hausmittel tief ins Ohr.`;
    },
    photo: () => `Danke fürs Foto. Wenn dicker, gelblicher Ausfluss oder starker Geruch zu sehen ist, bitte heute noch beim Tierarzt melden.`
  },

  // 14) Zecke/Stich/Allergie
  {
    id: 'tick',
    emergency: false,
    match: (t, lang) => {
      const s = t.toLowerCase();
      return lang === 'en' ? /(tick|bee sting|wasp sting|allergic reaction|hives)/.test(s)
                           : /(zecke|stich|wespe|biene|allergie|quaddeln)/.test(s);
    },
    start: () =>
`Zecke/Stich:
• Zecke mit Zange nahe der Haut greifen, langsam ziehen; keine Öle.
• Stich kühlen, Ruhe.
Fragen: Gesicht/Zunge geschwollen? Atemprobleme? Seit wann? (Foto möglich)`,
    step: (text, s) => {
      s.state.name = null;
      const t = text.toLowerCase();
      const face = /(gesicht|zunge|augenlid|maul)/.test(t);
      const breath = /(atemnot|keucht|schlecht luft)/.test(t);
      return `Nächste Schritte:
1) Kühlen, Ruhe.
2) ${face || breath ? 'Sofort Tierarzt/Notdienst.' : 'Beobachten; starke Schwellung/Schwäche → Tierarzt.'}
3) Nach Zecke: Stelle täglich sichten; Fieber/Trägheit → abklären.`;
    },
    photo: () => `Foto erhalten. Markiere die Stelle 1× täglich – wenn die Rötung stark größer wird oder dein Tier matt wirkt, bitte abklären lassen.`
  },

  // 15) Husten/Atemwege
  {
    id: 'cough',
    emergency: false,
    match: (t, lang) => {
      const s = t.toLowerCase();
      return lang === 'en' ? /(cough|kennel cough|trachea|honking|breath|breathing|wheez)/.test(s)
                           : /(husten|zwingerhusten|trachea|würgen|atem|pfeift|keucht)/.test(s);
    },
    start: () =>
`Husten/Atemwege – Fragen:
1) Seit wann? Fieber?
2) Husten trocken/feucht? Würgen?
3) Atemnot (Maul offen, blaue Zunge), kollabiert? (ja/nein)`,
    step: (text, s) => {
      s.state.name = null;
      const distress = /(atemnot|keucht|maul offen|blaue zunge|kollabiert)/i.test(text);
      return `Einschätzung & Schritte:
1) ${distress ? 'Akut: sofort' : 'Zeitnah'} Tierarzt, besonders bei Atemnot.
2) Ruhe, Zugluft vermeiden, Geschirr statt Halsband.
3) Trinken anbieten, Anstrengung vermeiden.`;
    }
  },

  // 16) Appetitlosigkeit
  {
    id: 'anorexia',
    emergency: false,
    match: (t, lang) => {
      const s = t.toLowerCase();
      return lang === 'en' ? /(no appetite|not eating|refuses food|stopped eating)/.test(s)
                           : /(appetitlos|frisst nicht|frisst kaum|futter verweigert)/.test(s);
    },
    start: () =>
`Appetitlosigkeit – Fragen:
1) Seit wann?
2) Trinkt normal? (ja/nein)
3) Begleitend: Erbrechen/Durchfall/Fieber/Schmerz?`,
    step: (text, s) => {
      s.state.name = null;
      const t = text.toLowerCase();
      const long = /(tage|seit.*tag|woche)/.test(t);
      const alarm = /(erbricht|durchfall|fieber|schmerz|apathisch)/.test(t);
      return `Schritte:
1) Wasser anbieten, Futter leicht erwärmen, sehr kleine Portionen.
2) ${alarm || long ? 'Heute noch Tierarzt' : 'Wenn keine Besserung <24–48 h → Tierarzt'}.
3) Beobachten: Trinken/Urin/Schmerzen.`;
    }
  },

  // 17) Verstopfung
  {
    id: 'constipation',
    emergency: false,
    match: (t, lang) => {
      const s = t.toLowerCase();
      return lang === 'en' ? /(constipation|hard stool|straining to poop)/.test(s)
                           : /(verstopfung|harte(s|r)? kot|drückt ohne erfolg)/.test(s);
    },
    start: () =>
`Verstopfung – Fragen:
1) Seit wann?
2) Frisst/Trinkt normal? (ja/nein)
3) Schmerz, Aufblähung, Erbrechen? (ja/nein)`,
    step: (text, s) => {
      s.state.name = null;
      const t = text.toLowerCase();
      const long = /(tage|seit.*tag|woche)/.test(t);
      const alarm = /(starke schmerzen|aufgebläht|erbricht)/.test(t);
      return `Schritte:
1) Wasser anbieten, kurze entspannte Spaziergänge.
2) Leichte Kost, ggf. etwas Morosuppe.
3) ${alarm || long ? 'Tierarzt (Darmverschluss ausschließen).' : 'Wenn keine Besserung 24–48 h → Tierarzt.'}`;
    }
  },

  // 18) Zahn/Zahnfleisch/Zahnbruch
  {
    id: 'tooth',
    emergency: false,
    match: (t, lang) => {
      const s = t.toLowerCase();
      return lang === 'en' ? /(tooth|teeth|gum|broken tooth|tooth pain)/.test(s)
                           : /(zahn|zähne|zahnfleisch|zahnbruch|zahnschmerz)/.test(s);
    },
    start: () =>
`Zahn/Zahnfleisch – Fragen:
1) Abgebrochener Zahn sichtbar? (ja/nein)
2) Blutung/übel riechender Mund? (ja/nein)
3) Frisst er schlechter? (ja/nein)`,
    step: (text, s) => {
      s.state.name = null;
      const t = text.toLowerCase();
      const broken = /(abgebrochen|bruch|splitter)/.test(t);
      const bleedSmell = /(blutet|geruch)/.test(t);
      return `Schritte:
1) Weiche Kost, nichts Hartes kauen lassen.
2) ${broken || bleedSmell ? 'Heute noch' : 'Zeitnah'} Tierarzt/Zahnröntgen.
3) Schmerzen/Schwellung → schneller Termin.`;
    }
  }
];




