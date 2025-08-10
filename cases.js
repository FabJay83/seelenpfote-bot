// cases.js – Minimalbeispiele (du kannst später beliebig erweitern)
module.exports = [
  // NOTFALL: Hitzschlag (sofortige Antwort)
  {
    id: 'heat',
    emergency: true,
    match: (t, lang) => {
      const s = t.toLowerCase();
      return lang === 'en'
        ? /(heatstroke|overheat|overheated|hot car|panting heavily)/.test(s)
        : /(hitzschlag|hitzeschlag|überhitz|heißes auto|starkes hecheln|überwärmt)/.test(s);
    },
    start: () =>
`⚠️ **Hitzschlag – jetzt handeln:**
1) In Schatten/kühlen Raum; Ventilator wenn möglich.
2) Mit *kühlem* (nicht eiskaltem) Wasser befeuchten – Bauch/Leisten.
3) Wasser in kleinen Mengen anbieten.
4) **Sofort Tierarzt anrufen** und Ankunft ankündigen. 
5) Bei Taumeln/Erbrechen/Kollaps: **direkt losfahren**.`,
    step: () => null
  },

  // NORMALFALL: Pfote/Wunde
  {
    id: 'paw',
    emergency: false,
    match: (t, lang) => {
      const s = t.toLowerCase();
      return lang === 'en'
        ? /(paw|pad|nail).*(inflam|red|swoll|wound|pus|cut|crack)/.test(s) || /(inflamed paw|paw wound)/.test(s)
        : /(pfote|ballen|kralle).*(entzünd|rot|schwell|wund|eiter|schnitt|riss)/.test(s) || /(pfote entzündet|pfotenwunde)/.test(s);
    },
    start: () => {
      return `Pfote/Wunde – Erste Hilfe:
• Mit lauwarmem Wasser/NaCl spülen, sanft trocken tupfen.
• Lecken verhindern (Socke/Schuh/Halskragen).
• 10–15 Min. kühlen (Tuch, kein Eis direkt).
Fragen:
1) Seit wann?
2) Lahmt stark/leicht?
3) Schnitt/Fremdkörper sichtbar? (ja/nein)
(Optional: Foto senden)`;
    },
    step: (text, s) => {
      s.state.name = null; // Case beenden
      return `Danke dir. Nächste Schritte:
1) 2–3×/Tag spülen, trocken tupfen; Lecken verhindern.
2) 10–15 Min. kühlen, 2–3×/Tag.
3) Schonung/kurze Gassi‑Runden.
4) Keine Besserung in 24–48 h oder deutliche Lahmheit → Tierarzt.`;
    },
    photo: () => `Foto erhalten, danke! Achte auf Größe, Rötung/Schwellung und ob es nässt.`
  },

  // NORMALFALL: Humpeln
  {
    id: 'limp',
    emergency: false,
    match: (t, lang) => {
      const s = t.toLowerCase();
      return lang === 'en' ? /(limp|lameness)/.test(s) : /(humpel|lahm|lahmt|belastet nicht)/.test(s);
    },
    start: () =>
`Humpeln – Erste Einschätzung:
• Ruhig halten, Schonung.
• Pfote/Bein vorsichtig auf Verletzungen prüfen.
• Schwellung oder starke Schmerzen → Tierarzt.
Fragen:
1) Seit wann?
2) Belastet er das Bein gar nicht/wenig?
3) Siehst du eine Verletzung?`,
    step: () => {
      return `Verstanden. Nächste Schritte:
1) Schonung, keine Treppen/Wildspiele.
2) 10–15 Min. kühlen, 2–3×/Tag.
3) Keine Besserung oder Nicht‑Belasten → Tierarzt binnen 24 h.`;
    }
  }
];



