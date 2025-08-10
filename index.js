# app.py
"""
Seelenpfote – MaxPack v2 (final, pure Python)
=============================================
Ein-Datei-Variante für schnellen Rollout + lokales Testen ohne Telegram.

Quickstart
----------
1) Lokal testen (ohne Telegram, keine Zusatz-Installation nötig):
   python app.py --cli        # interaktive Konsole
   python app.py --selftest   # integrierte Regressionstests

2) Telegram-Bot (optional, wenn Bibliothek & Token vorhanden):
   pip install python-telegram-bot==21.4 pydantic==2.* langid
   export TELEGRAM_BOT_TOKEN=...  # Railway: Variable setzen
   python app.py --telegram   # erzwingt Telegram-Modus

3) Railway (empfohlen als reine Python-App):
   requirements.txt:
     python-telegram-bot==21.4
     pydantic==2.*
     langid
   Start Command:
     python app.py --telegram

Wichtig
-------
- Startet automatisch im CLI-Fallback, wenn `python-telegram-bot` fehlt oder kein Token gesetzt ist.
- Robustes State-Management → keine Wiederholungs-Loops (z. B. bei „kein Erbrechen“).
- DE/EN mit Auto-Erkennung + /de /en Override.
- Erste-Hilfe-Blöcke modular erweiterbar.
"""
from __future__ import annotations
import os
import re
import time
import json
import argparse
from dataclasses import dataclass, field, asdict
from typing import Dict, Optional, List, Tuple

try:
    import langid  # optional, für bessere Erkennung
    _HAS_LANGID = True
except Exception:
    _HAS_LANGID = False

# ====== Utilities: language detection ==========================================================

def detect_lang(text: str) -> str:
    t = (text or "").strip()
    if not t:
        return "de"  # Default DE für Seelenpfote
    if _HAS_LANGID:
        code, _ = langid.classify(t)
        return "de" if code.startswith("de") else "en"
    # Fallback Heuristik
    de_markers = [" und ", " nicht", " kein", " keine", " danke", " pfote", " hund", " katze", " seit ", " schmerz"]
    has_umlaut = bool(re.search(r"[äöüÄÖÜß]", t))
    score = sum(m in t.lower() for m in de_markers) + (2 if has_umlaut else 0)
    return "de" if score >= 1 else "en"

# ====== Domain: Structured state ==============================================================

@dataclass
class UserFacts:
    species: Optional[str] = None  # dog/cat
    age_years: Optional[float] = None
    weight_kg: Optional[float] = None
    since_when: Optional[str] = None  # free text

@dataclass
class Symptoms:
    pain: Optional[bool] = None
    fever: Optional[bool] = None
    vomiting: Optional[bool] = None
    behavior_changed: Optional[bool] = None

@dataclass
class ConversationState:
    lang: str = "de"
    facts: UserFacts = field(default_factory=UserFacts)
    symptoms: Symptoms = field(default_factory=Symptoms)
    main_issue: Optional[str] = None  # e.g., "humpeln", "durchfall", "vergiftung", "hitzschlag"
    last_blocks: List[str] = field(default_factory=list)  # zuletzt ausgespielte Hilfe-Blöcke (IDs)
    asked_slots: List[str] = field(default_factory=list)  # bereits abgefragte Fragen-IDs
    completed: bool = False
    last_prompt_signature: Optional[str] = None  # gegen Dubletten
    updated_at: float = field(default_factory=lambda: time.time())

    def to_json(self) -> str:
        return json.dumps(asdict(self), ensure_ascii=False)

    @staticmethod
    def from_json(s: str) -> "ConversationState":
        d = json.loads(s)
        st = ConversationState()
        st.lang = d.get("lang", "de")
        st.facts = UserFacts(**d.get("facts", {}))
        st.symptoms = Symptoms(**d.get("symptoms", {}))
        st.main_issue = d.get("main_issue")
        st.last_blocks = d.get("last_blocks", [])
        st.asked_slots = d.get("asked_slots", [])
        st.completed = d.get("completed", False)
        st.last_prompt_signature = d.get("last_prompt_signature")
        st.updated_at = d.get("updated_at", time.time())
        return st

# ====== NLU: extract entities/intents with negation handling ===================================

NEG_DE = r"(?:(?:kein|keine|keinen|nicht)\s+)"
NEG_EN = r"(?:(?:no|not)\s+)"

def parse_message(text: str, lang: str) -> Dict:
    t = text.strip()
    lower = t.lower()
    out = {"facts": {}, "symptoms": {}, "main_issue": None}

    # Species
    if re.search(r"\b(hund|dog)\b", lower):
        out["facts"]["species"] = "dog"
    if re.search(r"\b(katze|cat)\b", lower):
        out["facts"]["species"] = "cat"

    # Weight (simple extraction like "9.5 kg")
    m = re.search(r"(\d+[\.,]?\d*)\s*(kg|kilogramm|kilograms|kilo)\b", lower)
    if m:
        out["facts"]["weight_kg"] = float(m.group(1).replace(",", "."))

    # Age (years as number)
    m = re.search(r"(\d+[\.,]?\d*)\s*(jahre|year|years|yo|y/o)\b", lower)
    if m:
        out["facts"]["age_years"] = float(m.group(1).replace(",", "."))

    # Since when (very simple): phrases like "seit ..." / "since ..."
    if lang == "de":
        m = re.search(r"seit\s+([^\n\r]+)$", lower)
    else:
        m = re.search(r"since\s+([^\n\r]+)$", lower)
    if m:
        out["facts"]["since_when"] = m.group(1).strip()

    # Symptoms with negation
    patterns_de = {
        "vomiting": (rf"\b(erbrechen|brechen|übergeben)\b", rf"\b{NEG_DE}(erbrechen|brechen|übergeben)\b"),
        "fever": (rf"\b(fieber|temperatur)\b", rf"\b{NEG_DE}(fieber|temperatur)\b"),
        "pain": (rf"\b(schmerz|schmerzen|tut\s+weh|weh)\b", rf"\b{NEG_DE}(schmerz|schmerzen|tut\s+weh|weh)\b"),
        "behavior_changed": (rf"\b(verhalten)\s*(?:geändert|anders)\b", rf"\b{NEG_DE}verhalten\b"),
    }
    patterns_en = {
        "vomiting": (rf"\b(vomit|vomiting|throwing\s*up)\b", rf"\b{NEG_EN}(vomit|vomiting|throwing\s*up)\b"),
        "fever": (rf"\b(fever|temperature)\b", rf"\b{NEG_EN}(fever|temperature)\b"),
        "pain": (rf"\b(pain|hurts|ache)\b", rf"\b{NEG_EN}(pain|hurts|ache)\b"),
        "behavior_changed": (rf"\b(behavior|behaviour)\s*(changed|different)\b", rf"\b{NEG_EN}(behavior|behaviour)\b"),
    }
    pats = patterns_de if lang == "de" else patterns_en
    for key, (pos, neg) in pats.items():
        if re.search(neg, lower):
            out["symptoms"][key] = False
        elif re.search(pos, lower):
            out["symptoms"][key] = True

    # Main issue detection
    issues_de = {
        "humpeln": r"\b(humpelt|lahmt|lahmheit)\b",
        "durchfall": r"\b(durchfall|diarrhö|diarrhoe)\b",
        "vergiftung": r"\b(vergiftung|gift|giftig|xylitol|schokolade)\b",
        "hitzschlag": r"\b(hitzschlag|überhitzung|überhitzt)\b",
        "pfote_entzündet": r"\b(pfote).*(entzündet|entzündung)|entzündung.*(pfote)\b",
        "erbrechen": r"\b(erbrechen|brechen|übergeben)\b",
        "schnittwunde": r"\b(schnitt|schnittwunde|verletzung|wunde)\b",
        "ohrentzündung": r"\b(ohr|ohren).*(entzündung|entzündet)\b",
    }
    issues_en = {
        "limping": r"\b(limp|limping|lame)\b",
        "diarrhea": r"\b(diarrhea|diarrhoea)\b",
        "poisoning": r"\b(poison|toxin|xylitol|chocolate)\b",
        "heatstroke": r"\b(heatstroke|overheat|overheated)\b",
        "paw_inflamed": r"\b(paw).*(inflamed|infection)|inflammation.*(paw)\b",
        "vomiting": r"\b(vomit|vomiting|throwing\s*up)\b",
        "cut_wound": r"\b(cut|laceration|wound|injury)\b",
        "ear_infection": r"\b(ear|ears).*(infection|inflamed)\b",
    }
    issues = issues_de if lang == "de" else issues_en
    for code, pat in issues.items():
        if re.search(pat, lower):
            out["main_issue"] = code
            break

    return out

# ====== Knowledge blocks (DE/EN) ===============================================================

FIRST_AID = {
    "de": {
        "erbrechen": {
            "title": "🤢 Erbrechen",
            "lines": [
                "6–12 h Futterpause, Wasser anbieten.",
                "Dann kleine, leicht verdauliche Portionen.",
                "Häufig/blutig/Fieber/Apathie/Welpe/Senior → Tierarzt.",
            ],
        },
        "wunde_humpeln": {
            "title": "🩹 Wunde / Humpeln",
            "lines": [
                "Sanft reinigen (lauwarmes Wasser), *Druck bei Blutung*.",
                "Lecken verhindern (Body/Kragen), Ruhigstellen.",
                "Sichtbarer Fremdkörper? Nur oberflächlich entfernen; tiefe/verschmutzte Wunden → Tierarzt.",
                "Deutliche Lahmheit/Schwellung >24–48 h → Tierarzt.",
            ],
        },
        "pfote_entzündet": {
            "title": "🐾 Entzündete Pfote",
            "lines": [
                "Pfote 1–2×/Tag mit lauwarmem Wasser/Salzlösung spülen.",
                "Sanft trocknen, trocken halten; Lecken verhindern (Kragen/Body).",
                "Prüfe: Fremdkörper zwischen Ballen, Risse, Dorn, heißer Asphalt.",
                "Starke Rötung/Eiter/Schmerz >24–48 h → Tierarzt (ggf. Antibiotika).",
            ],
        },
        "durchfall": {
            "title": "💩 Durchfall",
            "lines": [
                "Wasser anbieten; 6–12 h Futterpause, danach Schonkost (Huhn/Reis o. spezielle Diät).",
                "Blutig/anhaltend >24–48 h/Welpe/Senior → Tierarzt.",
            ],
        },
        "hitzschlag": {
            "title": "🥵 Hitzschlag – Notfall",
            "lines": [
                "Sofort in den Schatten/kühlen Raum; anbieten zu trinken.",
                "Körper langsam mit *kühlem* (nicht eiskaltem) Wasser kühlen; Luftzug/Ventilator.",
                "Schnellstmöglich Tierarzt (lebensbedrohlich).",
            ],
        },
        "ohrentzündung": {
            "title": "👂 Ohrenentzündung",
            "lines": [
                "Nicht mit Wattestäbchen! Nur äußerlich reinigen (vom Tierarzt empfohlenen Reiniger).",
                "Geruch, Rötung, Kopfschütteln, Schmerz → zeitnah Tierarzt.",
            ],
        },
        "schnittwunde": {
            "title": "🧷 Schnittwunde",
            "lines": [
                "Wunde vorsichtig mit Wasser spülen, sauberes Tuch → Druck bei Blutung.",
                "Tiefe, klaffende, verschmutzte Wunde → Tierarzt (Nähen/Antibiotika).",
            ],
        },
    },
    "en": {
        "vomiting": {
            "title": "🤢 Vomiting",
            "lines": [
                "Withhold food 6–12 h; offer water.",
                "Then small, easily digestible meals.",
                "Frequent/bloody/fever/lethargy/puppy/senior → Vet.",
            ],
        },
        "limping_wound": {
            "title": "🩹 Wound / Limping",
            "lines": [
                "Rinse gently (lukewarm water), *pressure if bleeding*.",
                "Prevent licking (cone/shirt); rest.",
                "Visible foreign body? Remove only superficial; deep/dirty → Vet.",
                "Marked lameness/swelling >24–48 h → Vet.",
            ],
        },
        "paw_inflamed": {
            "title": "🐾 Inflamed Paw",
            "lines": [
                "Rinse paw 1–2×/day with lukewarm water/saline.",
                "Dry gently; keep dry; prevent licking (cone/shirt).",
                "Check between pads for debris, cuts, thorns, hot asphalt burns.",
                "Severe redness/pus/pain >24–48 h → Vet (possible antibiotics).",
            ],
        },
        "diarrhea": {
            "title": "💩 Diarrhea",
            "lines": [
                "Offer water; 6–12 h fast, then bland diet (boiled chicken/rice or vet diet).",
                "Bloody/persistent >24–48 h/puppy/senior → Vet.",
            ],
        },
        "heatstroke": {
            "title": "🥵 Heatstroke – Emergency",
            "lines": [
                "Move to shade/cool area; offer water.",
                "Cool body gradually with *cool* (not ice-cold) water; airflow/fan.",
                "Go to vet ASAP (life-threatening).",
            ],
        },
        "ear_infection": {
            "title": "👂 Ear infection",
            "lines": [
                "No cotton swabs. Clean only outer ear with vet-approved cleanser.",
                "Odor, redness, head-shaking, pain → see a vet soon.",
            ],
        },
        "cut_wound": {
            "title": "🧷 Cut wound",
            "lines": [
                "Rinse with water; clean cloth → pressure if bleeding.",
                "Deep/gaping/dirty wounds → Vet (stitches/antibiotics).",
            ],
        },
    },
}

# Map main_issue -> block IDs per language
ISSUE_TO_BLOCK = {
    "de": {
        "erbrechen": "erbrechen",
        "durchfall": "durchfall",
        "hitzschlag": "hitzschlag",
        "ohrentzündung": "ohrentzündung",
        "schnittwunde": "schnittwunde",
        "humpeln": "wunde_humpeln",
        "pfote_entzündet": "pfote_entzündet",
    },
    "en": {
        "vomiting": "vomiting",
        "diarrhea": "diarrhea",
        "heatstroke": "heatstroke",
        "ear_infection": "ear_infection",
        "cut_wound": "cut_wound",
        "limping": "limping_wound",
        "paw_inflamed": "paw_inflamed",
    },
}

# ====== Prompt builders =========================================================================

def join_lines(lines: List[str]) -> str:
    return "\n• " + "\n• ".join(lines)

def render_block(lang: str, block_id: str) -> str:
    block = FIRST_AID[lang][block_id]
    return f"{block['title']}{join_lines(block['lines'])}"

def info_summary(lang: str, st: ConversationState) -> str:
    if lang == "de":
        parts = []
        if st.facts.since_when:
            parts.append(f"Seit: {st.facts.since_when}")
        if st.facts.weight_kg:
            parts.append(f"Gewicht: {st.facts.weight_kg:g} kg")
        if st.facts.age_years:
            parts.append(f"Alter (ca.): {st.facts.age_years:g}")
        if not parts:
            return ""
        return "Danke. Ich habe verstanden:\n• " + "\n• ".join(parts)
    else:
        parts = []
        if st.facts.since_when:
            parts.append(f"Since: {st.facts.since_when}")
        if st.facts.weight_kg:
            parts.append(f"Weight: {st.facts.weight_kg:g} kg")
        if st.facts.age_years:
            parts.append(f"Age (approx.): {st.facts.age_years:g}")
        if not parts:
            return ""
        return "Thanks. I got this:\n• " + "\n• ".join(parts)

def next_questions(lang: str, st: ConversationState) -> List[Tuple[str,str]]:
    """Return list of (slot_id, text) questions still needed.
    slot_id ensures we don't repeat a question.
    """
    q = []
    if st.symptoms.pain is None and "ask_pain" not in st.asked_slots:
        q.append(("ask_pain", "Hat er Schmerzen? (ja/nein)" if lang=="de" else "Is there pain? (yes/no)"))
    if st.symptoms.fever is None and "ask_fever" not in st.asked_slots:
        q.append(("ask_fever", "Fieber? (ja/nein)" if lang=="de" else "Fever? (yes/no)"))
    if st.symptoms.vomiting is None and "ask_vomit" not in st.asked_slots:
        q.append(("ask_vomit", "Erbrechen? (ja/nein)" if lang=="de" else "Vomiting? (yes/no)"))
    if st.symptoms.behavior_changed is None and "ask_behavior" not in st.asked_slots:
        q.append(("ask_behavior", "Verhalten verändert? (ja/nein)" if lang=="de" else "Behavior changed? (yes/no)"))
    if st.facts.age_years is None and "ask_age" not in st.asked_slots:
        q.append(("ask_age", "Wie alt (in Jahren ca.)?" if lang=="de" else "Approx. age (years)?"))
    if st.facts.weight_kg is None and "ask_weight" not in st.asked_slots:
        q.append(("ask_weight", "Gewicht in kg?" if lang=="de" else "Weight in kg?"))
    if st.facts.since_when is None and "ask_since" not in st.asked_slots:
        q.append(("ask_since", "Seit wann besteht das Problem?" if lang=="de" else "Since when?"))
    return q

# ====== Core dialog policy ======================================================================

def apply_updates(st: ConversationState, upd: Dict) -> None:
    # facts
    f = upd.get("facts", {})
    for k, v in f.items():
        setattr(st.facts, k, v)
    # symptoms
    s = upd.get("symptoms", {})
    for k, v in s.items():
        setattr(st.symptoms, k, v)
    # main issue
    if upd.get("main_issue"):
        st.main_issue = upd["main_issue"]


def decide_and_respond(user_text: str, st: ConversationState) -> str:
    # Language detect / override
    if user_text.strip() in ("/de", "!de"):
        st.lang = "de"
        return "Sprache auf Deutsch gestellt."
    if user_text.strip() in ("/en", "!en"):
        st.lang = "en"
        return "Language set to English."

    # On first content, auto-detect
    st.lang = detect_lang(user_text) if not st.last_prompt_signature else st.lang

    # Parse + apply
    upd = parse_message(user_text, st.lang)
    apply_updates(st, upd)

    # Build a signature of what's already answered to avoid repetition
    signature = json.dumps({
        "facts": asdict(st.facts),
        "symptoms": asdict(st.symptoms),
        "main_issue": st.main_issue,
    }, sort_keys=True, ensure_ascii=False)

    # If the signature didn't change and we already responded with same signature, avoid re-sending same block
    if st.last_prompt_signature == signature:
        # Provide a gentle nudge forward
        if st.lang == "de":
            return "Alles klar. Wenn du magst, beschreibe das *Hauptproblem* (z. B. „vergiftung“, „hitzschlag“, „humpelt“, „durchfall“) oder schreib „nächste schritte“."
        else:
            return "Got it. If you like, tell me the *main issue* (e.g., poisoning, heatstroke, limping, diarrhea) or say 'next steps'."

    st.last_prompt_signature = signature

    # 1) If main issue recognized, show corresponding block once
    if st.main_issue:
        mapping = ISSUE_TO_BLOCK.get(st.lang, {})
        block_id = mapping.get(st.main_issue)
        if block_id and block_id not in st.last_blocks:
            st.last_blocks.append(block_id)
            return render_block(st.lang, block_id)

    # 2) If user explicitly asks for next steps / erste hilfe
    trigger_next = {
        "de": ["erste hilfe", "nächsten schritte", "was tun", "hilfe", "weiter"],
        "en": ["first aid", "next steps", "what to do", "help", "continue"],
    }
    if any(kw in user_text.lower() for kw in trigger_next[st.lang]):
        # Prefer paw inflamed or limping heuristics if present
        preferred = None
        if st.lang == "de" and st.main_issue == "pfote_entzündet":
            preferred = "pfote_entzündet"
        if st.lang == "en" and st.main_issue == "paw_inflamed":
            preferred = "paw_inflamed"
        if preferred:
            bid = ISSUE_TO_BLOCK[st.lang][preferred]
            if bid not in st.last_blocks:
                st.last_blocks.append(bid)
                return render_block(st.lang, bid)
        # Fallback: choose by symptoms
        if st.symptoms.vomiting is True:
            bid = ISSUE_TO_BLOCK[st.lang]["erbrechen" if st.lang=="de" else "vomiting"]
            if bid not in st.last_blocks:
                st.last_blocks.append(bid)
                return render_block(st.lang, bid)
        if (st.symptoms.pain is True) and (st.symptoms.vomiting is not True):
            bid = ISSUE_TO_BLOCK[st.lang]["humpeln" if st.lang=="de" else "limping"]
            if bid not in st.last_blocks:
                st.last_blocks.append(bid)
                return render_block(st.lang, bid)

    # 3) Ask for missing slots (but never repeat the same question)
    qs = next_questions(st.lang, st)
    if qs:
        slot_id, text = qs[0]
        st.asked_slots.append(slot_id)
        return text

    # 4) Default guidance + summary
    summary = info_summary(st.lang, st)
    if st.lang == "de":
        base = "Wenn du bereit bist, schreib einfach „erste hilfe“, „nächsten schritte“ oder beschreibe das *Hauptproblem* – ich führe dich liebevoll hindurch."
    else:
        base = "When you’re ready, type ‘first aid’, ‘next steps’, or describe the *main issue* – I’ll guide you gently."
    return (summary + "\n\n" if summary else "") + base

# ====== Telegram glue (optional at runtime) =====================================================

def telegram_available() -> bool:
    """Check if python-telegram-bot is importable in this runtime."""
    try:
        from telegram import Update  # noqa: F401
        from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, ContextTypes, filters  # noqa: F401
        return True
    except Exception:
        return False


def run_telegram():
    # Lazy import inside function; safe if library exists
    from telegram import Update
    from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, ContextTypes, filters

    TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not TOKEN:
        raise RuntimeError("Environment variable TELEGRAM_BOT_TOKEN is missing.")

    # In-memory state per chat
    STATE: Dict[int, ConversationState] = {}

    async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
        cid = update.effective_chat.id
        STATE[cid] = ConversationState()
        lang = detect_lang(update.effective_message.text or "")
        STATE[cid].lang = "de" if lang == "de" else "en"
        msg = "Hallo, ich bin Seelenpfote. Beschreibe kurz, was los ist (z. B. ‚humpelt‘, ‚durchfall‘, ‚vergiftung‘)." if STATE[cid].lang=="de" else "Hi, I’m Seelenpfote. Tell me what’s going on (e.g., ‘limping’, ‘diarrhea’, ‘poisoning’)."
        await update.message.reply_text(msg)

    async def lang_de(update: Update, context: ContextTypes.DEFAULT_TYPE):
        cid = update.effective_chat.id
        st = STATE.setdefault(cid, ConversationState())
        st.lang = "de"
        await update.message.reply_text("Sprache auf Deutsch gestellt.")

    async def lang_en(update: Update, context: ContextTypes.DEFAULT_TYPE):
        cid = update.effective_chat.id
        st = STATE.setdefault(cid, ConversationState())
        st.lang = "en"
        await update.message.reply_text("Language set to English.")

    async def msg(update: Update, context: ContextTypes.DEFAULT_TYPE):
        cid = update.effective_chat.id
        st = STATE.setdefault(cid, ConversationState())
        text = update.effective_message.text or ""
        resp = decide_and_respond(text, st)
        await update.message.reply_text(resp, disable_web_page_preview=True)

    app = ApplicationBuilder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("de", lang_de))
    app.add_handler(CommandHandler("en", lang_en))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, msg))

    print("Seelenpfote MaxPack v2 – Telegram bot running…")
    app.run_polling(allowed_updates=Update.ALL_TYPES)

# ====== Local CLI for fast testing ==============================================================

def run_cli():
    print("Seelenpfote MaxPack v2 (CLI). Tippe '/de' oder '/en' für Sprache. 'exit' zum Beenden.\n")
    st = ConversationState()
    while True:
        try:
            user = input("You: ")
        except EOFError:
            break
        if not user:
            continue
        if user.strip().lower() in ("exit", "quit"): break
        resp = decide_and_respond(user, st)
        print("Bot:", resp, "\n")

# ====== Minimal regression tests (invoke: python app.py --selftest) =============================

CASES = [
    {
        "name": "No vomiting loop after negation",
        "turns": [
            "Er hat eine Entzündung an seiner Pfote und humpelt",
            "Seit einer Woche. Ja, er hat Schmerzen. Kein Fieber und kein Erbrechen. Ruhiger als sonst.",
            "nächsten schritte",
            "kein erbrechen",  # should NOT re-trigger Erbrechen block
        ],
        "expect_not_contains": ["Erbrechen"],
    },
    {
        "name": "Limping block shown once (DE)",
        "turns": [
            "Er humpelt",
            "erste hilfe",
            "erste hilfe",
        ],
        "expect_contains": ["Wunde / Humpeln"],
    },
    {
        "name": "English no-vomiting negation",
        "turns": [
            "My cat is limping. No vomiting.",
            "first aid",
        ],
        "expect_not_contains": ["Vomiting"],
    },
    {
        "name": "Paw inflamed prioritized (EN)",
        "turns": [
            "His paw is inflamed",
            "next steps",
        ],
        "expect_contains": ["Inflamed Paw"],
    },
]

def selftest():
    ok = True
    for case in CASES:
        st = ConversationState()
        outputs = []
        for t in case["turns"]:
            out = decide_and_respond(t, st)
            outputs.append(out)
        full = "\n".join(outputs)
        for bad in case.get("expect_not_contains", []):
            if bad in full:
                ok = False
                print(f"[FAIL] {case['name']} – found forbidden text: {bad}\n---\n{full}\n---")
        for good in case.get("expect_contains", []):
            if good not in full:
                ok = False
                print(f"[FAIL] {case['name']} – missing expected text: {good}\n---\n{full}\n---")
    if ok:
        print("All selftests passed.")

# ====== Main ====================================================================================

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--cli", action="store_true", help="Run local CLI tester")
    ap.add_argument("--selftest", action="store_true", help="Run built-in regression checks")
    ap.add_argument("--telegram", action="store_true", help="Force Telegram mode (errors if library/token missing)")
    args = ap.parse_args()

    # Priority: explicit selftest/cli → then telegram if available → otherwise CLI fallback
    if args.selftest:
        selftest()
    elif args.cli:
        run_cli()
    else:
        token = os.environ.get("TELEGRAM_BOT_TOKEN")
        if (args.telegram or (token and telegram_available())):
            try:
                run_telegram()
            except Exception as e:
                print(f"[WARN] Telegram mode failed ({e}). Falling back to CLI…")
                run_cli()
        else:
            print("[INFO] Telegram library or token not available – starting CLI mode.")
            run_cli()














