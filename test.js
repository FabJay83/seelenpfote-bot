const cases = require('./cases.js'); // Passe ggf. den Pfad an

// Beispiel: Teste den Humpel-Fall
const userInput = "Mein Hund humpelt seit heute";
const lang = "de"; // oder "en"

// Richtigen Fall finden
const found = cases.find(c => c.match(userInput, lang));
if (found) {
  let session = {};
  let reply = found.start();
  console.log('Bot:', reply);

  // Simuliere Dialog
  if (found.step) {
    // Beispielantworten für die Dialogschritte
    const answers = [
      "seit heute",      // Seit wann?
      "gar nicht",       // Belastung
      "ja",              // Schwellung
      "nein",            // Unfall
      "nein"             // Notfall
    ];
    for (let ans of answers) {
      reply = found.step(ans, session);
      console.log('User:', ans);
      console.log('Bot:', reply);
      if (!found.step || !reply) break;
    }
  }
} else {
  console.log("Kein passender Fall gefunden.");
