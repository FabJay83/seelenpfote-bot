// cases.js — 18 empathische Fälle (Du-Form) • sichere match()-Funktionen
// Schema: { id, emergency, match(t,lang), start(), step?(text,s), photo?() }

const safeMatch = (t) => (typeof t === 'string' ? t.toLowerCase() : '');
const safeLang  = (l) => (l === 'en' ? 'en' : 'de');

module.exports = [
  // ===================== NOTFÄLLE (sofort handeln, mit Beruhigung) =====================

  // 1) Hitzschlag / Überhitzung
  {
    id: 'heat',
    emergency: true,
    match: (t, lang) => {
      const s = safeMatch(t); const l = safeLang(lang);
      return l === 'en'
        ? /(heatstroke|overheat|overheated|hot car|panting heavily|collapsed from heat)/.test(s)
        : /(hitzschlag|hitzeschlag|überhitz|heißes auto|starkes hecheln|kollaps durch hitze)/.test(s);
    },
    start: () =>
`⚠️ **Hitzestress – atme kurz durch, wir handeln jetzt Schritt für Schritt.**  
Ich bin bei dir – du machst das richtig.

1) 🧊 In **Schatten/kühlen Raum** bringen (Ventilator, wenn möglich).  
2) 💧 **Langsam kühlen**: Bauch, Leisten, Pfoten mit *kühlem* (nicht eiskaltem) Wasser befeuchten.  
3) 🥤 **Wasser in kleinen Schlucken** anbieten.  
4) ☎️ **Sofort Tierarzt/Notdienst** anrufen und Ankunft ankündigen.  
5) 🚑 Bei Taumeln, Erbrechen, Kollaps **direkt losfahren**. 🐾`,
    step: () => null
  },

  // 2) Starke Blutung / tiefer Schnitt
  {
    id: 'bleeding',
    emergency: true,
    match: (t, lang) => {
      const s = safeMatch(t); const l = safeLang(lang);
      const en = /(heavy|spurting|pulsing)\s*blood/.test(s) || /(deep|gaping)\s*(cut|wound)/.test(s) || /(bleeding|cut|laceration|open wound)/.test(s);
      const de = /(starke?r?|pulsierend|spritzend|viel)\s*blut/.test(s) || /(tiefe?r?|klaffend)\s*(schnitt|wunde)/.test(s) || /(blutung|blutet|schnitt|platzwunde|offene wunde)/.test(s);
      return l === 'en' ? en : de;
    },
    start: () =>
`⚠️ **Blutung – bleib ruhig, wir packen das gemeinsam.**  

1) 🩹 **Druckverband** anlegen (sauberes Tuch/Gaze) und **5–10 Min. NICHT lösen**.  
2) 🧍‍♀️ Möglichst **hochlagern**, ruhig & warm halten.  
3) 🚫 **Nichts in die Wunde füllen**, tiefe Wunden nicht spülen.  
4) ☎️ **Umgehend Tierarzt/Notdienst** informieren.  
Ich bin an deiner Seite – du machst das gut. 💛`,
    step: () => null
  },

  // 3) Vergiftung
  {
    id: 'poison',
    emergency: true,
    match: (t, lang) => {
      const s = safeMatch(t); const l = safeLang(lang);
      const en = /(poison|toxin|ate rat poison|chocolate|xylitol|ibuprofen|grapes|raisins|antifreeze|slug pellets)/.test(s);
      const de = /(vergift|gift|rattenköder|schokolade|xylit|ibuprofen|trauben|rosinen|frostschutz|schneckenkorn)/.test(s);
      return l === 'en' ? en : de;
    },
    start: () =>
`⚠️ **Vergiftungsverdacht – wir handeln sofort.**  

1) 🚫 **Nichts einflößen**, **kein Erbrechen erzwingen**.  
2) 📸 **Verpackung/Fotos** sichern (Stoff, Menge, Zeitpunkt, Gewicht).  
3) ☎️ **Sofort Tierarzt/Notdienst** anrufen.  
4) 🚑 Bei Taumeln, Krämpfen, starker Schwäche **direkt losfahren**.  
Ich bleibe bei dir – Schritt für Schritt. 🐾`,
    step: () => null
  },

  // 4) Aufgeblähter Bauch / GDV
  {
    id: 'bloat',
    emergency: true,
    match: (t, lang) => {
      const s = safeMatch(t); const l = safeLang(lang);
      return l === 'en'
        ? /(bloat|gdv|swollen belly|retches but nothing|distended abdomen)/.test(s)
        : /(aufgeblähter bauch|magenumdrehung|magendrehung|würgen ohne erbrechen|aufgetriebener bauch)/.test(s);
    },
    start: () =>
`⚠️ **Verdacht auf Magendrehung (GDV).**  
Harter, aufgetriebener Bauch + Würgen ohne Erbrechen + Unruhe/Schmerz.

👉 **Keine Zeit verlieren**: ☎️ **Sofort Tierklinik/Notdienst**, **direkt losfahren**.  
Ich bin bei dir – du machst das genau richtig. 💛`,
    step: () => null
  },

  // 5) Krampfanfall
  {
    id: 'seizure',
    emergency: true,
    match: (t, lang) => {
      const s = safeMatch(t); const l = safeLang(lang);
      return l === 'en'
        ? /(seizure|convulsion|fits|epilepsy)/.test(s)
        : /(krampf|krampfanfall|epilepsie|anfälle)/.test(s);
    },
    start: () =>
`⚠️ **Krampfanfall – atme ruhig, ich helfe dir.**  

1) 🛡️ **Gefahren entfernen**, nicht festhalten; Kopf seitlich lagern.  
2) ⏱️ **Dauer messen**, Umgebung abdunkeln.  
3) 🌿 Nach dem Anfall: **ruhig halten**, nichts füttern.  
4) ☎️ **Notdienst kontaktieren**, besonders >5 Min., mehrere Anfälle oder keine Erholung.  
Du bist nicht allein – ich bleibe bei dir. 🐾`,
    step: () => null
  },

  // 6) Harnblockade / kann nicht pinkeln
  {
    id: 'urine',
    emergency: true,
    match: (t, lang) => {
      const s = safeMatch(t); const l = safeLang(lang);
      const en = /(can'?t pee|cannot pee|no urine|straining no urine|blocked)/.test(s);
      const de = /(kann nicht pinkeln|kein urin|ohne erfolg drücken|strengt sich an und es kommt nichts|harnblockade)/.test(s);
      return l === 'en' ? en : de;
    },
    start: () =>
`⚠️ **Harnabfluss gestört – das ist dringend.**  

1) ⛑️ **Nicht abwarten** – ☎️ **sofort Tierarzt/Notdienst** (Gefahr Harnstau/Intox).  
2) 🌊 **Wasser anbieten**, nichts forcieren.  
3) 🚑 Bei Schmerzen/Unruhe **direkt losfahren**.  
Ich weiß, das ist beunruhigend – du handelst genau richtig. 💛`,
    step: () => null
  },

  // 7) Knochenbruch / schweres Trauma
  {
    id: 'fracture',
    emergency: true,
    match: (t, lang) => {
      const s = safeMatch(t); const l = safeLang(lang);
      return l === 'en'
        ? /(fracture|broken bone|broken leg|severe trauma|hit by car)/.test(s)
        : /(bruch|knochenbruch|bein gebrochen|schweres trauma|autounfall)/.test(s);
    },
    start: () =>
`⚠️ **Verdacht auf Bruch/Trauma – ruhig bleiben, wir handeln jetzt.**  

1) 🤲 **Ruhig halten**, nicht „einrenken“.  
2) 🧻 Nur wenn du dich sicher fühlst: **weich polstern**, keine harte Schiene.  
3) ☎️ **Sofort Tierarzt/Notdienst** (Röntgen, Schmerztherapie).  
Ich bin bei dir – Schritt für Schritt. 🐾`,
    step: () => null
  },

  // ===================== NICHT-NOTFÄLLE (Dialog + Anleitung) =====================

  // 8) Pfote/Wunde/Schwellung
  {
    id: 'paw',
    emergency: false,
    match: (t, lang) => {
      const s = safeMatch(t); const l = safeLang(lang);
      const en = (/(paw|pad|nail)/.test(s) && /(inflam|red|swoll|wound|pus|cut|crack)/.test(s)) || /(inflamed paw|paw wound)/.test(s);
      const de = (/(pfote|ballen|kralle)/.test(s) && /(entzünd|rot|schwell|wund|eiter|schnitt|riss)/.test(s)) || /(pfote entzündet|pfotenwunde)/.test(s);
      return l === 'en' ? en : de;
    },
    start: () =>
`🐾 **Pfote/Wunde – ich bin bei dir, wir schauen das gemeinsam an.**  

**Sofort hilfreich:**  
• Mit lauwarmem Wasser/NaCl spülen, sanft trocken tupfen.  
• Lecken verhindern (Socke/Schuh/Body), kurze Ruhe.  
• 10–15 Min. kühlen (Tuch, kein Eis direkt).

**Kurze Fragen an dich:**  
1) Seit wann ungefähr?  
2) Lahmt dein Liebling stark/leicht?  
3) Siehst du Schnitt/Fremdkörper? (ja/nein)  
(🔎 Foto ist ok, aber nicht zwingend)`,
    step: (text, s) => {
      if (s?.state) s.state.name = null;
      const t = safeMatch(text);
      const long = /(tage|woche|seit.*tag|seit.*woche)/.test(t);
      const strong = /(gar nicht|kaum|stark|nicht belastet)/.test(t);
      const foreignNo = /\bnein\b/.test(t);
      return `🩺 **Einschätzung:**  
• ${long ? 'Wirkt schon **länger bestehend**' : 'Eher **frisch**'}${strong ? ' **+ deutliche Lahmheit**' : ''}.  
• ${foreignNo ? 'Kein sichtbarer Fremdkörper.' : 'Bitte zwischen den Ballen vorsichtig auf Splitter/Schnitt prüfen.'}

**Als Nächstes:**  
1) 2–3×/Tag spülen, trocken tupfen; Lecken verhindern.  
2) 10–15 Min. kühlen, 2–3×/Tag.  
3) Schonung/kurze Gassi‑Runden.  
4) ${long || strong ? '**Bitte innerhalb 24 h zum Tierarzt.**' : '**Wenn keine Besserung in 24–48 h → Tierarzt.**'}  
Ich bleibe bei dir – du machst das gut. 💛`;
    },
    photo: () => `📸 Danke fürs Foto. Achte auf Größe, Rötung/Schwellung, ob es nässt, und ob dein Liebling die Pfote belastet.`
  },

  // 9) Durchfall
  {
    id: 'diarrhea',
    emergency: false,
    match: (t, lang) => {
      const s = safeMatch(t); const l = safeLang(lang);
      return l === 'en' ? /(diarrhea|loose stool|watery stool|bloody stool)/.test(s)
                        : /(durchfall|dünn|wässrig|breiig|blut im stuhl)/.test(s);
    },
    start: () =>
`💧 **Durchfall – wir gehen das ruhig an.**  

**Fragen:**  
1) Seit wann?  
2) Appetit/Trinken? (ja/nein)  
3) Blut/Schleim? (ja/nein)  
4) Wirkt dein Liebling munter oder müde?  
(🔎 Foto vom Kot ist optional)

**Ersthilfe:**  
• 6–12 h Futterpause (Wasser anbieten).  
• Danach kleine Portionen Schonkost (Reis+Huhn oder Morosuppe).  
• Elektrolytlösung aus dem Tierbedarf kann helfen.`,
    step: (text, s) => {
      if (s?.state) s.state.name = null;
      const t = safeMatch(text);
      const long = /(48|zwei tage|2 tage|seit.*tagen)/.test(t);
      const bloody = /\b(blut|blutig|schleim)\b/.test(t);
      const leth = /\b(müde|apathisch|schwach)\b/.test(t);
      const nodrink = /(trinkt nicht|kein wasser|trinkt kaum)/.test(t);
      const alarm = long || bloody || leth || nodrink;
      return `🩺 **Einschätzung:** ${alarm ? 'Es gibt **Warnzeichen**.' : 'Wirkt eher **leicht/mittel**.'}

**Nächste Schritte:**  
1) 6–12 h Pause, Wasser anbieten.  
2) Schonkost in Miniportionen.  
3) Beobachten: Blut, Schleim, Mattigkeit?  
4) ${alarm ? '**Bitte heute noch Tierarzt kontaktieren.**' : '**Keine Besserung in 24–36 h → Tierarzt.**'}  
⚠️ **Welpen/Senioren/Vorerkrankungen** → früher abklären.  
Ich bin bei dir – Schritt für Schritt. 💛`;
    },
    photo: () => `📸 Danke fürs Foto. Wenn Blut/Schleim sichtbar ist oder dein Liebling müde wirkt, melde dich bitte **heute** beim Tierarzt.`
  },

  // 10) Erbrechen
  {
    id: 'vomit',
    emergency: false,
    match: (t, lang) => {
      const s = safeMatch(t); const l = safeLang(lang);
      return l === 'en' ? /(vomit|throwing up|nausea|bile|foam)/.test(s)
                        : /(erbroch|kotz|brechen|übelkeit|galle|schaum)/.test(s);
    },
    start: () =>
`🤢 **Erbrechen – wir ordnen das in Ruhe.**  

**Fragen:**  
1) Wie oft in den letzten 12 h?  
2) Futter/Galle/Schaum? Blut?  
3) Bleibt **Wasser** drin? (ja/nein)  
4) Wirkt dein Liebling müde/schlapp?  
(🔎 Foto optional)`,
    step: (text, s) => {
      if (s?.state) s.state.name = null;
      const t = safeMatch(text);
      const many = /(3|drei|mehrfach|oft|häufig)/.test(t);
      const blood = /\b(blut|rötlich)\b/.test(t);
      const nowater = /(hält.*nicht|erbricht wasser|trinkt nicht)/.test(t);
      const leth = /\b(müde|apathisch|schwach)\b/.test(t);
      const alarm = many || blood || nowater || leth;
      return `🩺 **Einschätzung:** ${alarm ? '**Warnzeichen** sind vorhanden.' : 'Es wirkt eher wie eine **Magenreizung**.'}

**Nächste Schritte:**  
1) 6–12 h Futterpause (Wasser in **kleinen Schlucken**, häufiger).  
2) Danach Miniportionen Schonkost (Huhn/Reis/Morosuppe).  
3) Bauch prüfen: Aufblähung/Schmerz/Fremdkörper?  
4) ${alarm ? '**Bitte heute noch zum Tierarzt.**' : '**Keine Besserung in 24 h → Tierarzt.**'}  
Ich bleibe bei dir – du machst das gut. 💛`;
    },
    photo: () => `📸 Danke fürs Foto. Achte auf Blutanteile, Fäden/Knochenstücke und ob kleine Schlucke Wasser drin bleiben.`
  },

  // 11) Humpeln/Lahmheit
  {
    id: 'limp',
    emergency: false,
    match: (t, lang) => {
      const s = safeMatch(t); const l = safeLang(lang);
      return l === 'en' ? /(limp|lameness|not weight-bearing|favoring leg)/.test(s)
                        : /(humpel|lahm|zieht bein|belastet nicht|lahmt)/.test(s);
    },
    start: () =>
`🚶 **Humpeln – wir schauen genau hin.**  

**Fragen:**  
1) Seit wann?  
2) Belastet gar nicht/wenig?  
3) Schwellung/Verletzung sichtbar?  
4) Unfall/Sturz passiert?  
(🔎 Foto/kurzes Video hilft)`,
    step: (text, s) => {
      if (s?.state) s.state.name = null;
      const t = safeMatch(text);
      const sinceDays = /(tage|seit.*tag|woche)/.test(t);
      const noWeight = /(gar nicht|nicht belastet|trägt nicht)/.test(t);
      const swelling = /(schwell|dick|heiß|warm)/.test(t);
      const accident = /(unfall|sturz|zerrung|umgeknickt)/.test(t);
      const alarm = noWeight || swelling || accident || sinceDays;
      return `🩺 **Einschätzung:** ${noWeight ? '**Nicht‑Belasten** ist ein Warnzeichen.' : (sinceDays ? '**>24–48 h** bestehend.' : 'Eher **leichte Lahmheit** möglich.')}

**Nächste Schritte:**  
1) Schonung, keine Treppen/wilden Spiele.  
2) Kühlen 10–15 Min., 2–3×/Tag (Tuch, kein Eis direkt).  
3) Kurze, ruhige Runden.  
4) ${alarm ? '**Bitte innerhalb 24 h zum Tierarzt.**' : '**Wenn keine Besserung → Tierarzt.**'}  
Ich begleite dich – Schritt für Schritt. 💛`;
    }
  },

  // 12) Auge
  {
    id: 'eye',
    emergency: false,
    match: (t, lang) => {
      const s = safeMatch(t); const l = safeLang(lang);
      return l === 'en' ? /(eye|ocular|red eye|squint|discharge)/.test(s)
                        : /(auge|augen|augenlid|rot|blinzelt|ausfluss)/.test(s);
    },
    start: () =>
`👁️ **Auge – sanft vorgehen.**  

**Sofort hilfreich:**  
• Nicht reiben lassen (Body/Halskragen wenn vorhanden).  
• Keine Menschen‑Augentropfen.  
• Bei Fremdkörpergefühl: sanft mit NaCl spülen.

**Fragen:** Stark rot? Schmerz/Schielen? Lichtempfindlich? Verletzung sichtbar? (Foto möglich)`,
    step: (text, s) => {
      if (s?.state) s.state.name = null;
      const severe = /(stark|sehr|verletz|fremdkörper|trüb|blut)/i.test(safeMatch(text));
      return `**Nächste Schritte:**  
1) ${severe ? '**Heute noch**' : '**Zeitnah**'} zum Tierarzt (Hornhaut kann schmerzhaft sein).  
2) Nicht reiben; wenn möglich Halskragen.  
3) Foto/Video hilft bei der Einschätzung.  
Ich bin bei dir – du machst das richtig. 💛`;
    },
    photo: () => `📸 Danke fürs Foto. Bei Trübung, starker Rötung oder sichtbarer Verletzung bitte **früher** zum Tierarzt.`
  },

  // 13) Ohrentzündung
  {
    id: 'ear',
    emergency: false,
    match: (t, lang) => {
      const s = safeMatch(t); const l = safeLang(lang);
      return l === 'en' ? /(ear|otitis|shaking head|scratching ear|ear discharge)/.test(s)
                        : /(ohr|ohren|ohrenentzündung|kopfschütteln|kratzt ohr|ohr ausfluss)/.test(s);
    },
    start: () =>
`👂 **Ohr – wir gehen behutsam vor.**  

**Sofort hilfreich:**  
• Keine Wattestäbchen tief ins Ohr.  
• Ohr trocken halten, Kratzen vermeiden.

**Fragen:** Rötung/Schwellung/Geruch? Schmerz? Seit wann? (Foto möglich)`,
    step: (text, s) => {
      if (s?.state) s.state.name = null;
      const severe = /(stark|eitrig|geruch|sehr rot|schmerz)/i.test(safeMatch(text));
      return `**Nächste Schritte:**  
1) ${severe ? '**Heute noch**' : '**Zeitnah**'} Tierarzt für Reinigung/Medikation.  
2) Bis dahin Kratzen vermeiden, Ohr trocken halten.  
3) Keine Hausmittel tief ins Ohr.  
Du machst das gut – ich bleibe bei dir. 💛`;
    },
    photo: () => `📸 Danke fürs Foto. Bei gelblichem, dickem Ausfluss oder starkem Geruch bitte **heute** abklären lassen.`
  },

  // 14) Zecke/Stich/Allergie
  {
    id: 'tick',
    emergency: false,
    match: (t, lang) => {
      const s = safeMatch(t); const l = safeLang(lang);
      return l === 'en' ? /(tick|bee sting|wasp sting|allergic reaction|hives)/.test(s)
                        : /(zecke|stich|wespe|biene|allergie|quaddeln)/.test(s);
    },
    start: () =>
`🐝 **Zecke/Stich – ruhig bleiben, wir kümmern uns.**  

**Sofort:**  
• Zecke mit Karte/Zange **hautnah greifen** und langsam ziehen (keine Öle).  
• Stich **kühlen** und Ruhe geben.

**Fragen:** Gesicht/Zunge geschwollen? Atemprobleme? Seit wann? (Foto möglich)`,
    step: (text, s) => {
      if (s?.state) s.state.name = null;
      const t = safeMatch(text);
      const face = /(gesicht|zunge|augenlid|maul)/.test(t);
      const breath = /(atemnot|keucht|schlecht luft|luftnot)/.test(t);
      return `**Nächste Schritte:**  
1) Kühlen, Ruhe.  
2) ${face || breath ? '**Sofort Tierarzt/Notdienst (Allergieschock!).**' : 'Beobachten; starke Schwellung/Schwäche → Tierarzt.'}  
3) Nach Zecke: Stelle täglich sichten; Fieber/Trägheit → abklären.  
Ich bin bei dir – Schritt für Schritt. 💛`;
    },
    photo: () => `📸 Danke fürs Foto. Markiere die Stelle 1× täglich – wenn die Rötung deutlich wächst oder dein Liebling matt wirkt, bitte abklären lassen.`
  },

  // 15) Husten/Atemwege
  {
    id: 'cough',
    emergency: false,
    match: (t, lang) => {
      const s = safeMatch(t); const l = safeLang(lang);
      return l === 'en' ? /(cough|kennel cough|trachea|honking|breath|breathing|wheez)/.test(s)
                        : /(husten|zwingerhusten|trachea|würgen|atem|pfeift|keucht)/.test(s);
    },
    start: () =>
`🌬️ **Husten/Atemwege – wir gehen behutsam vor.**  

**Fragen:**  
1) Seit wann? Fieber?  
2) Husten trocken/feucht? Würgen?  
3) Atemnot (Maul offen, blaue Zunge), Kollaps? (ja/nein)`,
    step: (text, s) => {
      if (s?.state) s.state.name = null;
      const distress = /(atemnot|keucht|maul offen|blaue zunge|kollabiert)/i.test(safeMatch(text));
      return `**Einschätzung & Schritte:**  
1) ${distress ? '**Akut: sofort**' : '**Zeitnah**'} Tierarzt, besonders bei Atemnot.  
2) Ruhe, Zugluft vermeiden, **Geschirr** statt Halsband.  
3) Trinken anbieten, Anstrengung vermeiden.  
Ich bleibe bei dir – du machst das gut. 💛`;
    }
  },

  // 16) Appetitlosigkeit
  {
    id: 'anorexia',
    emergency: false,
    match: (t, lang) => {
      const s = safeMatch(t); const l = safeLang(lang);
      return l === 'en' ? /(no appetite|not eating|refuses food|stopped eating)/.test(s)
                        : /(appetitlos|frisst nicht|frisst kaum|futter verweigert)/.test(s);
    },
    start: () =>
`🍗 **Frisst nicht – wir schauen gemeinsam.**  

**Fragen:**  
1) Seit wann?  
2) Trinkt normal? (ja/nein)  
3) Begleitend: Erbrechen/Durchfall/Fieber/Schmerz?`,
    step: (text, s) => {
      if (s?.state) s.state.name = null;
      const t = safeMatch(text);
      const long  = /(tage|seit.*tag|woche)/.test(t);
      const alarm = /(erbricht|durchfall|fieber|schmerz|apathisch)/.test(t);
      return `**Schritte:**  
1) Wasser anbieten, Futter leicht erwärmen, sehr kleine Portionen.  
2) ${alarm || long ? '**Heute noch Tierarzt.**' : '**Wenn keine Besserung <24–48 h → Tierarzt.**'}  
3) Beobachten: Trinken, Urin, Schmerzzeichen.  
Ich bin hier für dich – Schritt für Schritt. 💛`;
    }
  },

  // 17) Verstopfung
  {
    id: 'constipation',
    emergency: false,
    match: (t, lang) => {
      const s = safeMatch(t); const l = safeLang(lang);
      return l === 'en' ? /(constipation|hard stool|straining to poop)/.test(s)
                        : /(verstopfung|harte(s|r)? kot|drückt ohne erfolg)/.test(s);
    },
    start: () =>
`🚻 **Verstopfung – ruhig bleiben, wir lösen das.**  

**Fragen:**  
1) Seit wann?  
2) Frisst/Trinkt normal? (ja/nein)  
3) Schmerz, Aufblähung, Erbrechen? (ja/nein)`,
    step: (text, s) => {
      if (s?.state) s.state.name = null;
      const t = safeMatch(text);
      const long  = /(tage|seit.*tag|woche)/.test(t);
      const alarm = /(starke schmerzen|aufgebläht|erbricht)/.test(t);
      return `**Schritte:**  
1) Wasser anbieten, kurze entspannte Spaziergänge.  
2) Leichte Kost, ggf. Morosuppe.  
3) ${alarm || long ? '**Tierarzt (Darmverschluss ausschließen).**' : '**Wenn keine Besserung 24–48 h → Tierarzt.**'}  
Ich begleite dich – du machst das gut. 💛`;
    }
  },

  // 18) Zahn/Zahnfleisch/Zahnbruch
  {
    id: 'tooth',
    emergency: false,
    match: (t, lang) => {
      const s = safeMatch(t); const l = safeLang(lang);
      return l === 'en' ? /(tooth|teeth|gum|broken tooth|tooth pain)/.test(s)
                        : /(zahn|zähne|zahnfleisch|zahnbruch|zahnschmerz)/.test(s);
    },
    start: () =>
`🦷 **Zahn/Zahnfleisch – wir gehen es sanft an.**  

**Fragen:**  
1) Abgebrochener Zahn sichtbar? (ja/nein)  
2) Blutung oder starker Geruch aus dem Maul? (ja/nein)  
3) Frisst dein Liebling schlechter? (ja/nein)`,
    step: (text, s) => {
      if (s?.state) s.state.name = null;
      const t = safeMatch(text);
      const broken    = /(abgebrochen|bruch|splitter)/.test(t);
      const bleedSmell= /(blutet|geruch)/.test(t);
      return `**Schritte:**  
1) Weiche Kost anbieten; bitte nichts Hartes kauen lassen.  
2) ${broken || bleedSmell ? '**Heute noch**' : '**Zeitnah**'} Tierarzt/Zahnröntgen.  
3) Bei Schmerzen/Schwellung bitte schneller Termin.  
Ich bin bei dir – Schritt für Schritt. 💛`;
    }
  }
];






