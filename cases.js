// cases.js — Empathische, dialogorientierte Fälle (CommonJS, ohne OpenAI)

const safeMatch = (t) => (typeof t === 'string' ? t.toLowerCase() : '');
const safeLang  = (l) => (l === 'en' ? 'en' : 'de');

// Hilfsfunktion für Ja/Nein
const yes = (t) => /ja|yes/i.test(t);
const no  = (t) => /nein|no/i.test(t);

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

  // ===================== DIALOG-FÄLLE =====================

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
Seit wann besteht das Problem? (z.B. heute, seit 2 Tagen, seit 1 Woche)`,
    step: (text, s) => {
      if (!s.paw_since) {
        s.paw_since = text.trim().toLowerCase();
        return `Wie sieht die Pfote aus? **Rötung, Schwellung, Wunde, Eiter?** (kurz beschreiben oder "nein")`;
      }
      if (!s.paw_symptom) {
        s.paw_symptom = text.trim().toLowerCase();
        return `Leckt oder knabbert dein Hund an der Pfote? (ja/nein)`;
      }
      if (typeof s.paw_lick === 'undefined') {
        if (yes(text)) s.paw_lick = true;
        else if (no(text)) s.paw_lick = false;
        else return `Bitte antworte mit "ja" oder "nein": Leckt oder knabbert dein Hund an der Pfote?`;
        return `Hat sich das Problem **plötzlich verschlimmert** oder hat dein Hund **Fieber**? (ja/nein)`;
      }
      if (typeof s.paw_emergency === 'undefined') {
        if (yes(text)) s.paw_emergency = true;
        else if (no(text)) s.paw_emergency = false;
        else return `Bitte antworte mit "ja" oder "nein": Plötzliche Verschlimmerung oder Fieber?`;
        if (s.paw_emergency) {
          return `⚠️ Die Symptome sprechen für einen Notfall (plötzliche Verschlimmerung oder Fieber). Bitte gehe **umgehend zum Tierarzt!**`;
        }
        let akut = /heute|gestern|1 tag|seit 1 tag|today|yesterday|1 day/.test(s.paw_since);
        let antwort = '';
        if (akut) {
          antwort += `🐾 **Akutes Pfotenproblem – das kannst du tun:**\n`;
          antwort += `• Mit lauwarmem Wasser/NaCl spülen, sanft trocken tupfen.\n`;
          antwort += `• Lecken verhindern (Socke/Schuh/Body), kurze Ruhe.\n`;
          antwort += `• 10–15 Min. kühlen (Tuch, kein Eis direkt).\n`;
          if (s.paw_symptom && s.paw_symptom !== 'nein') {
            antwort += `• Beobachte die Stelle gut und schütze sie vor Lecken.\n`;
          }
          antwort += `\nWenn das Problem länger als 2 Tage anhält oder sich verschlimmert, suche bitte einen Tierarzt auf.\nGute Besserung! 🐶🍀`;
        } else {
          antwort += `🐾 **Pfotenproblem seit mehreren Tagen – das solltest du tun:**\n`;
          antwort += `• Schone deinen Hund, verhindere Lecken und Kauen.\n`;
          antwort += `• Kühle die Pfote 2–3x täglich (mit Tuch, kein Eis direkt).\n`;
          if (s.paw_symptom && s.paw_symptom !== 'nein') {
            antwort += `• Da eine Auffälligkeit sichtbar ist, beobachte die Stelle gut und schütze sie vor Lecken.\n`;
          }
          antwort += `• Da das Problem bereits länger besteht, empfehle ich dir, zeitnah einen Tierarzt aufzusuchen.\n`;
          antwort += `Falls sich das Problem verschlimmert, Schwellungen, starke Schmerzen oder Fieber auftreten, geh bitte sofort zum Tierarzt!\nGute Besserung! 🐶🍀`;
        }
        return antwort;
      }
    }
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
Seit wann hat dein Hund Durchfall?`,
    step: (text, s) => {
      if (!s.dia_since) {
        s.dia_since = text.trim().toLowerCase();
        return `Trinkt dein Hund normal? (ja/nein)`;
      }
      if (typeof s.dia_drink === 'undefined') {
        if (yes(text)) s.dia_drink = true;
        else if (no(text)) s.dia_drink = false;
        else return `Bitte antworte mit "ja" oder "nein": Trinkt dein Hund normal?`;
        return `Ist Blut oder Schleim im Kot? (ja/nein)`;
      }
      if (typeof s.dia_blood === 'undefined') {
        if (yes(text)) s.dia_blood = true;
        else if (no(text)) s.dia_blood = false;
        else return `Bitte antworte mit "ja" oder "nein": Ist Blut oder Schleim im Kot?`;
        return `Wirkt dein Hund müde oder abgeschlagen? (ja/nein)`;
      }
      if (typeof s.dia_tired === 'undefined') {
        if (yes(text)) s.dia_tired = true;
        else if (no(text)) s.dia_tired = false;
        else return `Bitte antworte mit "ja" oder "nein": Wirkt dein Hund müde oder abgeschlagen?`;
        // Notfall
        if (!s.dia_drink || s.dia_blood || s.dia_tired) {
          return `⚠️ Dein Hund zeigt Anzeichen für einen schwereren Verlauf (trinkt nicht, Blut/Schleim, müde). Bitte kontaktiere **zeitnah einen Tierarzt!**`;
        }
        let akut = /heute|gestern|1 tag|seit 1 tag|today|yesterday|1 day/.test(s.dia_since);
        let antwort = '';
        if (akut) {
          antwort += `💧 **Akuter Durchfall – das kannst du tun:**\n`;
          antwort += `• 6–12 h Futterpause (Wasser anbieten).\n`;
          antwort += `• Danach kleine Portionen Schonkost (Reis+Huhn/Morosuppe).\n`;
          antwort += `• Optional: Elektrolytlösung (Tierbedarf).\n`;
          antwort += `\nWenn der Durchfall länger als 2 Tage anhält, Blut/Schleim auftritt oder dein Hund müde wird, suche bitte einen Tierarzt auf.\nGute Besserung! 🐶🍀`;
        } else {
          antwort += `💧 **Durchfall seit mehreren Tagen – das solltest du tun:**\n`;
          antwort += `• Weiter Schonkost geben, viel Wasser anbieten.\n`;
          antwort += `• Da der Durchfall schon länger besteht, empfehle ich dir, zeitnah einen Tierarzt aufzusuchen.\n`;
          antwort += `Falls dein Hund müde wirkt, Blut im Kot ist oder nicht trinkt, geh bitte sofort zum Tierarzt!\nGute Besserung! 🐶🍀`;
        }
        return antwort;
      }
    }
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
Wie oft hat dein Hund in den letzten 12 Stunden erbrochen?`,
    step: (text, s) => {
      if (!s.vom_count) {
        s.vom_count = text.trim().toLowerCase();
        return `Bleibt Wasser drin, wenn dein Hund trinkt? (ja/nein)`;
      }
      if (typeof s.vom_water === 'undefined') {
        if (yes(text)) s.vom_water = true;
        else if (no(text)) s.vom_water = false;
        else return `Bitte antworte mit "ja" oder "nein": Bleibt Wasser drin?`;
        return `Wirkt dein Hund müde oder abgeschlagen? (ja/nein)`;
      }
      if (typeof s.vom_tired === 'undefined') {
        if (yes(text)) s.vom_tired = true;
        else if (no(text)) s.vom_tired = false;
        else return `Bitte antworte mit "ja" oder "nein": Wirkt dein Hund müde oder abgeschlagen?`;
        return `Ist Blut im Erbrochenen sichtbar? (ja/nein)`;
      }
      if (typeof s.vom_blood === 'undefined') {
        if (yes(text)) s.vom_blood = true;
        else if (no(text)) s.vom_blood = false;
        else return `Bitte antworte mit "ja" oder "nein": Ist Blut im Erbrochenen sichtbar?`;
        // Notfall
        if (!s.vom_water || s.vom_blood || s.vom_tired) {
          return `⚠️ Dein Hund zeigt Anzeichen für einen schwereren Verlauf (Wasser bleibt nicht drin, Blut, müde). Bitte kontaktiere **zeitnah einen Tierarzt!**`;
        }
        let antwort = '';
        antwort += `🤢 **Erbrechen – das kannst du tun:**\n`;
        antwort += `• 6–12 h Futterpause (Wasser in kleinen Schlucken, häufiger).\n`;
        antwort += `• Danach Miniportionen Schonkost (Huhn/Reis/Morosuppe).\n`;
        antwort += `\nWenn das Erbrechen länger als 24h anhält, dein Hund müde wird oder Wasser nicht drin bleibt, suche bitte einen Tierarzt auf.\nGute Besserung! 🐶🍀`;
        return antwort;
      }
    }
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
`🚶 **Humpeln – wir schauen gemeinsam, wie wir helfen können.**
Darf ich fragen: **Seit wann humpelt dein Hund?** (z.B. heute, seit 2 Tagen, seit 1 Woche)`,
    step: (text, s) => {
      if (!s.limp_since) {
        s.limp_since = text.trim().toLowerCase();
        return `Wie stark ist das Humpeln? **Belastet dein Hund das Bein gar nicht, nur leicht oder normal?**`;
      }
      if (!s.limp_weight) {
        s.limp_weight = text.trim().toLowerCase();
        return `Ist eine **Schwellung, Wunde oder Verletzung** sichtbar? (ja/nein)`;
      }
      if (typeof s.limp_swelling === 'undefined') {
        if (yes(text)) s.limp_swelling = true;
        else if (no(text)) s.limp_swelling = false;
        else return `Bitte antworte mit "ja" oder "nein": Ist eine Schwellung, Wunde oder Verletzung sichtbar?`;
        return `Gab es einen **Unfall oder Sturz**? (ja/nein)`;
      }
      if (typeof s.limp_accident === 'undefined') {
        if (yes(text)) s.limp_accident = true;
        else if (no(text)) s.limp_accident = false;
        else return `Bitte antworte mit "ja" oder "nein": Gab es einen Unfall oder Sturz?`;
        return `Hat sich das Humpeln **plötzlich verschlimmert** oder hat dein Hund **Fieber**? (ja/nein)`;
      }
      if (typeof s.limp_emergency === 'undefined') {
        if (yes(text)) s.limp_emergency = true;
        else if (no(text)) s.limp_emergency = false;
        else return `Bitte antworte mit "ja" oder "nein": Plötzliche Verschlimmerung oder Fieber?`;
        if (s.limp_emergency) {
          return `⚠️ Dein Hund zeigt Anzeichen für einen Notfall (plötzliche Verschlimmerung oder Fieber). 
Bitte gehe **umgehend zum Tierarzt!**`;
        }
        let akut = /heute|gestern|1 tag|seit 1 tag|today|yesterday|1 day/.test(s.limp_since);
        let antwort = '';
        if (akut) {
          antwort += `🚶 **Akutes Humpeln – das kannst du tun:**\n`;
          antwort += `• Sorge für Schonung: Keine Treppen oder wilden Spiele.\n`;
          antwort += `• Kühle die betroffene Pfote 10–15 Minuten, 2–3 Mal am Tag (mit einem Tuch, kein Eis direkt auf die Haut).\n`;
          antwort += `• Gehe nur kurze, ruhige Runden spazieren.\n`;
          if (s.limp_swelling) {
            antwort += `• Da eine Schwellung oder Verletzung sichtbar ist, beobachte die Stelle gut und schütze sie vor Lecken (z.B. mit einer Socke oder einem Verband).\n`;
          }
          if (s.limp_accident) {
            antwort += `• Nach einem Unfall oder Sturz ist eine tierärztliche Abklärung ratsam, auch wenn äußerlich nichts zu sehen ist.\n`;
          }
          antwort += `\nWenn das Humpeln länger als 2 Tage anhält, sich verschlimmert oder dein Hund starke Schmerzen hat, suche bitte einen Tierarzt auf.\nGute Besserung für deinen Hund! 🐶🍀`;
        } else {
          antwort += `🐾 **Humpeln seit mehreren Tagen – das solltest du tun:**\n`;
          antwort += `• Bitte schone deinen Hund weiterhin, vermeide wilde Spiele und lange Spaziergänge.\n`;
          antwort += `• Kühle die betroffene Pfote 2–3x täglich (mit Tuch, kein Eis direkt).\n`;
          if (s.limp_swelling) {
            antwort += `• Da eine Schwellung oder Verletzung sichtbar ist, beobachte die Stelle gut und schütze sie vor Lecken.\n`;
          }
          if (!s.limp_accident) {
            antwort += `• Auch ohne Unfall kann eine Entzündung, Zerrung oder ein anderes Problem vorliegen.\n`;
          }
          antwort += `• Da das Humpeln bereits länger besteht, empfehle ich dir, zeitnah einen Tierarzt aufzusuchen, um die Ursache abzuklären.\n`;
          antwort += `Falls sich das Humpeln verschlimmert, Schwellungen, starke Schmerzen oder Fieber auftreten, geh bitte sofort zum Tierarzt!\nGute Besserung für deinen Hund! 🐶🍀`;
        }
        return antwort;
      }
    }
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
Seit wann sind die Probleme am Auge?`,
    step: (text, s) => {
      if (!s.eye_since) {
        s.eye_since = text.trim().toLowerCase();
        return `Ist das Auge stark gerötet, geschwollen oder schmerzhaft? (ja/nein)`;
      }
      if (typeof s.eye_red === 'undefined') {
        if (yes(text)) s.eye_red = true;
        else if (no(text)) s.eye_red = false;
        else return `Bitte antworte mit "ja" oder "nein": Stark gerötet, geschwollen oder schmerzhaft?`;
        return `Ist das Auge lichtempfindlich oder kneift dein Hund es zu? (ja/nein)`;
      }
      if (typeof s.eye_light === 'undefined') {
        if (yes(text)) s.eye_light = true;
        else if (no(text)) s.eye_light = false;
        else return `Bitte antworte mit "ja" oder "nein": Lichtempfindlich oder kneifen?`;
        return `Ist eine Verletzung sichtbar? (ja/nein)`;
      }
      if (typeof s.eye_injury === 'undefined') {
        if (yes(text)) s.eye_injury = true;
        else if (no(text)) s.eye_injury = false;
        else return `Bitte antworte mit "ja" oder "nein": Verletzung sichtbar?`;
        // Notfall
        if (s.eye_red || s.eye_light || s.eye_injury) {
          return `⚠️ Starke Rötung, Schmerzen, Lichtempfindlichkeit oder sichtbare Verletzung am Auge – bitte lass das Auge **zeitnah beim Tierarzt** untersuchen!`;
        }
        let antwort = '';
        antwort += `👁️ **Auge – das kannst du tun:**\n`;
        antwort += `• Nicht reiben lassen (Body/Halskragen wenn vorhanden).\n`;
        antwort += `• Keine Menschen-Augentropfen verwenden.\n`;
        antwort += `• Bei Fremdkörpergefühl: sanft mit NaCl spülen.\n`;
        antwort += `\nWenn die Beschwerden länger als 1–2 Tage bestehen oder sich verschlimmern, bitte zum Tierarzt.\nGute Besserung! 🐶🍀`;
        return antwort;
      }
    }
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
Seit wann bestehen die Ohrprobleme?`,
    step: (text, s) => {
      if (!s.ear_since) {
        s.ear_since = text.trim().toLowerCase();
        return `Ist das Ohr gerötet, geschwollen oder riecht unangenehm? (ja/nein)`;
      }
      if (typeof s.ear_red === 'undefined') {
        if (yes(text)) s.ear_red = true;
        else if (no(text)) s.ear_red = false;
        else return `Bitte antworte mit "ja" oder "nein": Gerötet, geschwollen oder Geruch?`;
        return `Zeigt dein Hund Schmerzen beim Berühren des Ohrs? (ja/nein)`;
      }
      if (typeof s.ear_pain === 'undefined') {
        if (yes(text)) s.ear_pain = true;
        else if (no(text)) s.ear_pain = false;
        else return `Bitte antworte mit "ja" oder "nein": Schmerzen beim Berühren?`;
        // Notfall
        if (s.ear_red && s.ear_pain) {
          return `⚠️ Stark gerötetes, geschwollenes oder schmerzhaftes Ohr – bitte lass das Ohr **zeitnah beim Tierarzt** untersuchen!`;
        }
        let antwort = '';
        antwort += `👂 **Ohr – das kannst du tun:**\n`;
        antwort += `• Keine Wattestäbchen tief ins Ohr.\n`;
        antwort += `• Ohr trocken halten, Kratzen vermeiden.\n`;
        antwort += `\nWenn die Beschwerden länger als 2 Tage bestehen oder sich verschlimmern, bitte zum Tierarzt.\nGute Besserung! 🐶🍀`;
        return antwort;
      }
    }
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
Seit wann ist die Schwellung oder der Stich sichtbar?`,
    step: (text, s) => {
      if (!s.tick_since) {
        s.tick_since = text.trim().toLowerCase();
        return `Sind Gesicht oder Zunge geschwollen? (ja/nein)`;
      }
      if (typeof s.tick_face === 'undefined') {
        if (yes(text)) s.tick_face = true;
        else if (no(text)) s.tick_face = false;
        else return `Bitte antworte mit "ja" oder "nein": Gesicht oder Zunge geschwollen?`;
        return `Hat dein Hund Atemprobleme? (ja/nein)`;
      }
      if (typeof s.tick_breath === 'undefined') {
        if (yes(text)) s.tick_breath = true;
        else if (no(text)) s.tick_breath = false;
        else return `Bitte antworte mit "ja" oder "nein": Atemprobleme?`;
        // Notfall
        if (s.tick_face || s.tick_breath) {
          return `⚠️ Bei Schwellung von Gesicht/Zunge oder Atemnot – bitte **sofort zum Tierarzt!**`;
        }
        let antwort = '';
        antwort += `🐝 **Zecke/Stich – das kannst du tun:**\n`;
        antwort += `• Zecke hautnah greifen und langsam ziehen (keine Öle).\n`;
        antwort += `• Stich kühlen, Ruhe geben.\n`;
        antwort += `\nWenn die Schwellung größer wird oder Atemprobleme auftreten, bitte sofort zum Tierarzt.\nGute Besserung! 🐶🍀`;
        return antwort;
      }
    }
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
Seit wann hustet dein Hund?`,
    step: (text, s) => {
      if (!s.cough_since) {
        s.cough_since = text.trim().toLowerCase();
        return `Hat dein Hund Fieber? (ja/nein)`;
      }
      if (typeof s.cough_fever === 'undefined') {
        if (yes(text)) s.cough_fever = true;
        else if (no(text)) s.cough_fever = false;
        else return `Bitte antworte mit "ja" oder "nein": Fieber?`;
        return `Ist der Husten trocken oder feucht? (trocken/feucht)`;
      }
      if (!s.cough_type) {
        s.cough_type = text.trim().toLowerCase();
        return `Gab es Atemnot oder einen Kollaps? (ja/nein)`;
      }
      if (typeof s.cough_emergency === 'undefined') {
        if (yes(text)) s.cough_emergency = true;
        else if (no(text)) s.cough_emergency = false;
        else return `Bitte antworte mit "ja" oder "nein": Atemnot oder Kollaps?`;
        // Notfall
        if (s.cough_emergency) {
          return `⚠️ Bei Atemnot oder Kollaps – bitte **sofort zum Tierarzt!**`;
        }
        let antwort = '';
        antwort += `🌬️ **Husten – das kannst du tun:**\n`;
        antwort += `• Ruhe, Zugluft vermeiden, Geschirr statt Halsband.\n`;
        antwort += `• Trinken anbieten, Anstrengung vermeiden.\n`;
        if (s.cough_fever) {
          antwort += `• Bei Fieber bitte zeitnah zum Tierarzt!\n`;
        }
        antwort += `\nWenn der Husten länger als 3 Tage anhält oder sich verschlimmert, bitte zum Tierarzt.\nGute Besserung! 🐶🍀`;
        return antwort;
      }
    }
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
Seit wann frisst dein Hund nicht?`,
    step: (text, s) => {
      if (!s.ano_since) {
        s.ano_since = text.trim().toLowerCase();
        return `Trinkt dein Hund normal? (ja/nein)`;
      }
      if (typeof s.ano_drink === 'undefined') {
        if (yes(text)) s.ano_drink = true;
        else if (no(text)) s.ano_drink = false;
        else return `Bitte antworte mit "ja" oder "nein": Trinkt dein Hund normal?`;
        return `Gab es Erbrechen, Durchfall, Fieber oder Schmerzen? (ja/nein)`;
      }
      if (typeof s.ano_symptom === 'undefined') {
        if (yes(text)) s.ano_symptom = true;
        else if (no(text)) s.ano_symptom = false;
        else return `Bitte antworte mit "ja" oder "nein": Erbrechen, Durchfall, Fieber oder Schmerzen?`;
        // Notfall
        if (!s.ano_drink || s.ano_symptom) {
          return `⚠️ Dein Hund trinkt nicht oder zeigt weitere Symptome (Erbrechen, Durchfall, Fieber, Schmerzen). Bitte kontaktiere **zeitnah einen Tierarzt!**`;
        }
        let antwort = '';
        antwort += `🍗 **Appetitlosigkeit – das kannst du tun:**\n`;
        antwort += `• Wasser anbieten, Futter leicht erwärmen, sehr kleine Portionen.\n`;
        antwort += `\nWenn dein Hund länger als 2 Tage nicht frisst, trinkt oder weitere Symptome auftreten, bitte zum Tierarzt.\nGute Besserung! 🐶🍀`;
        return antwort;
      }
    }
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
Seit wann ist dein Hund verstopft?`,
    step: (text, s) => {
      if (!s.con_since) {
        s.con_since = text.trim().toLowerCase();
        return `Frisst und trinkt dein Hund normal? (ja/nein)`;
      }
      if (typeof s.con_norm === 'undefined') {
        if (yes(text)) s.con_norm = true;
        else if (no(text)) s.con_norm = false;
        else return `Bitte antworte mit "ja" oder "nein": Frisst und trinkt normal?`;
        return `Hat dein Hund Schmerzen, einen aufgeblähten Bauch oder erbricht er? (ja/nein)`;
      }
      if (typeof s.con_symptom === 'undefined') {
        if (yes(text)) s.con_symptom = true;
        else if (no(text)) s.con_symptom = false;
        else return `Bitte antworte mit "ja" oder "nein": Schmerzen, Aufblähung oder Erbrechen?`;
        // Notfall
        if (!s.con_norm || s.con_symptom) {
          return `⚠️ Dein Hund frisst/trinkt nicht oder zeigt Schmerzen, Aufblähung oder Erbrechen. Bitte kontaktiere **zeitnah einen Tierarzt!**`;
        }
        let antwort = '';
        antwort += `🚻 **Verstopfung – das kannst du tun:**\n`;
        antwort += `• Wasser anbieten, kurze entspannte Spaziergänge.\n`;
        antwort += `• Leichte Kost, ggf. Morosuppe.\n`;
        antwort += `\nWenn die Verstopfung länger als 2 Tage anhält oder weitere Symptome auftreten, bitte zum Tierarzt.\nGute Besserung! 🐶🍀`;
        return antwort;
      }
    }
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
Seit wann bestehen die Zahnprobleme?`,
    step: (text, s) => {
      if (!s.tooth_since) {
        s.tooth_since = text.trim().toLowerCase();
        return `Ist ein abgebrochener Zahn sichtbar? (ja/nein)`;
      }
      if (typeof s.tooth_broken === 'undefined') {
        if (yes(text)) s.tooth_broken = true;
        else if (no(text)) s.tooth_broken = false;
        else return `Bitte antworte mit "ja" oder "nein": Abgebrochener Zahn sichtbar?`;
        return `Gibt es Blutungen oder schlechten Geruch? (ja/nein)`;
      }
      if (typeof s.tooth_blood === 'undefined') {
        if (yes(text)) s.tooth_blood = true;
        else if (no(text)) s.tooth_blood = false;
        else return `Bitte antworte mit "ja" oder "nein": Blutung oder Geruch?`;
        return `Frisst dein Hund schlechter als sonst? (ja/nein)`;
      }
      if (typeof s.tooth_eat === 'undefined') {
        if (yes(text)) s.tooth_eat = true;
        else if (no(text)) s.tooth_eat = false;
        else return `Bitte antworte mit "ja" oder "nein": Frisst schlechter als sonst?`;
        // Notfall
        if (s.tooth_broken || s.tooth_blood || s.tooth_eat) {
          return `⚠️ Abgebrochener Zahn, Blutung, Geruch oder schlechteres Fressen – bitte lass das Gebiss **zeitnah beim Tierarzt** untersuchen!`;
        }
        let antwort = '';
        antwort += `🦷 **Zahn/Zahnfleisch – das kannst du tun:**\n`;
        antwort += `• Weiche Kost, nichts Hartes kauen lassen.\n`;
        antwort += `\nWenn die Beschwerden länger als 2 Tage bestehen oder sich verschlimmern, bitte zum Tierarzt.\nGute Besserung! 🐶🍀`;
        return antwort;
      }
    }
  }
];







