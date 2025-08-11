// Empathische Fälle – nur Text, keine OpenAI-Abhängigkeit

module.exports = [
  {
    id: 'heat',
    emergency: true,
    match: (t) => /(hitzschlag|überhitz|hot car|heatstroke)/i.test(t),
    start: () =>
`⚠️ **Gefahr eines Hitzschlags!**  
Bitte bring dein Tier sofort in den Schatten oder einen kühlen Raum.  
💧 Feuchte Bauch, Leisten und Pfoten mit *kühlem* (nicht eiskaltem) Wasser.  
🐾 Biete kleine Mengen Wasser an.  
🚑 Ruf sofort beim Tierarzt an und kündige dich an.`
  },
  {
    id: 'bleeding',
    emergency: true,
    match: (t) => /(starke.*blut|heavy.*bleed)/i.test(t),
    start: () =>
`⚠️ **Starke Blutung!**  
🩹 Druckverband anlegen und **nicht** abnehmen für 5–10 Minuten.  
🐾 Tier ruhig und warm halten.  
🚑 Sofort zum Tierarzt fahren.`
  },
  {
    id: 'vomit',
    emergency: false,
    match: (t) => /(erbrech|vomit|kotz)/i.test(t),
    start: () =>
`Ohje 😔, das klingt nach Bauchweh.  
Bitte beantworte mir kurz:  
1) Wie oft hat dein Tier erbrochen?  
2) Hält es Wasser bei sich?  
3) Wirkt es müde oder normal?`
  },
  {
    id: 'diarrhea',
    emergency: false,
    match: (t) => /(durchfall|diarrh)/i.test(t),
    start: () =>
`💩 Durchfall kann viele Ursachen haben.  
Magst du mir sagen:  
1) Seit wann besteht es?  
2) Trinkt dein Tier normal?  
3) Ist Blut oder Schleim im Kot?`
  },
  {
    id: 'paw',
    emergency: false,
    match: (t) => /(pfote|paw|ballen)/i.test(t),
    start: () =>
`🐾 Eine verletzte Pfote ist unangenehm.  
Bitte prüfe:  
- Ist etwas drin (Splitter, Glas)?  
- Lahmt dein Tier stark?  
- Seit wann besteht es?  
💛 Tipp: Pfote mit lauwarmem Wasser spülen und trocken halten.`
  }
];






