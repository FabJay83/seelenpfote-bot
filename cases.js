// cases.js
// Enthält alle Notfallfälle für Seelenpfote Bot

module.exports = {
  "durchfall": {
    intro: "💩 Durchfall – Erste Einschätzung:",
    steps: [
      "Frisches Wasser anbieten, Flüssigkeitsverlust ausgleichen.",
      "Leichte, magenschonende Kost (z. B. gekochter Reis, Huhn) für 1–2 Tage.",
      "Kein Fett, keine Milchprodukte.",
      "Beobachten: Blut im Kot, Erbrechen, Schwäche → Tierarzt."
    ],
    questions: [
      "Seit wann besteht der Durchfall?",
      "Frisst und trinkt dein Tier noch?",
      "Zeigt er/sie weitere Symptome (Fieber, Erbrechen)?"
    ]
  },

  "erbricht": {
    intro: "🤮 Erbrechen – Erste Einschätzung:",
    steps: [
      "12 Stunden Futterpause, Wasser anbieten.",
      "Langsam Schonkost einführen.",
      "Bei wiederholtem Erbrechen oder Blut → Tierarzt."
    ],
    questions: [
      "Seit wann erbricht dein Tier?",
      "Frisst und trinkt es?",
      "Farbe oder Aussehen des Erbrochenen?"
    ]
  },

  "humpelt": {
    intro: "🚶‍♂️ Humpeln – Erste Einschätzung:",
    steps: [
      "Ruhig halten, Schonung.",
      "Pfote/Bein auf Verletzungen prüfen.",
      "Schwellung oder starke Schmerzen → Tierarzt."
    ],
    questions: [
      "Seit wann humpelt dein Tier?",
      "Belastet es das Bein gar nicht?",
      "Siehst du eine Verletzung?"
    ]
  },

  "pfote entzündet": {
    intro: "🐾 Entzündete Pfote – Erste Einschätzung:",
    steps: [
      "Pfote mit lauwarmem Wasser oder isotoner Kochsalzlösung spülen.",
      "Sanft trocken tupfen, nicht reiben. Kein Alkohol/Peroxid.",
      "Lecken verhindern (Socken/Schuh oder Halskragen).",
      "10–15 Min. kühlen (kein Eis direkt).",
      "Beobachten: starke Schwellung, Eiter, starker Schmerz, Fieber, Lahmheit >24h → Tierarzt."
    ],
    questions: [
      "Seit wann besteht das Problem?",
      "Lahmt er stark oder gar nicht?",
      "Siehst du einen Schnitt oder Fremdkörper?"
    ]
  },

  "blutung": {
    intro: "🩸 Blutung – Erste Einschätzung:",
    steps: [
      "Direkten Druck mit sauberem Tuch ausüben.",
      "Falls möglich Verband anlegen.",
      "Starke Blutung oder nicht zu stoppen → Tierarzt."
    ],
    questions: [
      "Wo blutet es?",
      "Seit wann?",
      "Wie stark ist die Blutung?"
    ]
  },

  "zecke": {
    intro: "🪳 Zecke/Stich – Erste Einschätzung:",
    steps: [
      "Zecke mit Zange nahe der Haut greifen, langsam ziehen.",
      "Kein Öl oder Kleber verwenden.",
      "Stich kühlen.",
      "Beobachten: Schwellung, Schwäche, Fieber → Tierarzt."
    ],
    questions: [
      "Gesicht/Zunge geschwollen?",
      "Atemprobleme?",
      "Seit wann?"
    ]
  },

  "ohr/auge": {
    intro: "👂👁 Ohr/Auge – Erste Einschätzung:",
    steps: [
      "Ohr: sanft reinigen, kein Wattestäbchen tief einführen.",
      "Auge: mit sauberem Wasser spülen, nicht reiben.",
      "Rötung, Eiter, Schmerz → Tierarzt."
    ],
    questions: [
      "Seit wann besteht das Problem?",
      "Ist das Auge/Ohr stark gerötet?",
      "Eiter oder Blut vorhanden?"
    ]
  },

  "husten": {
    intro: "😷 Husten – Erste Einschätzung:",
    steps: [
      "Ruhig halten, Stress vermeiden.",
      "Warme, zugfreie Umgebung.",
      "Husten mit Atemnot oder blutig → Tierarzt."
    ],
    questions: [
      "Seit wann hustet dein Tier?",
      "Gibt es Auswurf?",
      "Atemprobleme vorhanden?"
    ]
  },

  "appetitlosigkeit": {
    intro: "🍽 Appetitlosigkeit – Erste Einschätzung:",
    steps: [
      "Frisches Wasser anbieten.",
      "Leckereien oder Schonkost probieren.",
      "Keine Besserung >24h → Tierarzt."
    ],
    questions: [
      "Seit wann frisst dein Tier nicht?",
      "Trinkt es noch?",
      "Begleitsymptome (Fieber, Erbrechen, Durchfall)?"
    ]
  },

  "harn": {
    intro: "🚻 Harnprobleme – Erste Einschätzung:",
    steps: [
      "Beobachten, ob Urinabsatz möglich ist.",
      "Häufiges, schmerzhaftes Urinieren ohne Menge → Tierarzt (Notfall)."
    ],
    questions: [
      "Seit wann besteht das Problem?",
      "Blut im Urin?",
      "Schmerzen beim Urinieren?"
    ]
  },

  "verstopfung": {
    intro: "🚫 Verstopfung – Erste Einschätzung:",
    steps: [
      "Frisches Wasser anbieten.",
      "Ballaststoffreiche Kost (Kürbis, Gemüse) falls geeignet.",
      "Länger als 2 Tage ohne Kotabsatz → Tierarzt."
    ],
    questions: [
      "Seit wann kein Kotabsatz?",
      "Frisst und trinkt dein Tier?",
      "Zeigt es Schmerzen?"
    ]
  },

  "zahn/bruch": {
    intro: "🦷 Zahn/Bruch – Erste Einschätzung:",
    steps: [
      "Maul nur vorsichtig prüfen.",
      "Keine harten Futterstücke geben.",
      "Starke Schmerzen oder Blutung → Tierarzt."
    ],
    questions: [
      "Seit wann besteht das Problem?",
      "Frisst dein Tier?",
      "Starke Blutung oder Bruch sichtbar?"
    ]
  },

  "hitzschlag": {
    intro: "☀️ Hitzschlag – Erste Einschätzung:",
    steps: [
      "Sofort in kühlen, schattigen Ort bringen.",
      "Körper mit feuchten Tüchern kühlen (kein Eiswasser).",
      "Frisches Wasser anbieten.",
      "Schnellstmöglich Tierarzt aufsuchen."
    ],
    questions: [
      "Seit wann besteht der Verdacht?",
      "Ist das Tier bei Bewusstsein?",
      "Atmet es normal?"
    ]
  }
};
