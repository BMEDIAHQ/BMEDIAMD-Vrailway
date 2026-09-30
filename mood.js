// commands/mood.js (ESM)

// Mood detector (simple NLP heuristic)

// Usage:

//   <prefix>mood <text>

//   reply a message with: <prefix>mood

function getText(m) {

  return (

    m?.message?.conversation ||

    m?.message?.extendedTextMessage?.text ||

    m?.message?.imageMessage?.caption ||

    m?.message?.videoMessage?.caption ||

    ""

  ).trim();

}

function getQuotedText(m) {

  const q = m?.message?.extendedTextMessage?.contextInfo?.quotedMessage;

  if (!q) return "";

  return (

    q?.conversation ||

    q?.extendedTextMessage?.text ||

    q?.imageMessage?.caption ||

    q?.videoMessage?.caption ||

    ""

  ).trim();

}

function analyzeMood(text) {

  const t = String(text || "").toLowerCase();

  const buckets = [

    {

      name: "HAPPY",

      emoji: "😄",

      tips: ["Keep the vibe going ✨", "Share the joy with someone 💛"],

      words: ["happy", "glad", "joy", "excited", "amazing", "great", "good", "awesome", "blessed", "love", "nice"],

    },

    {

      name: "SAD",

      emoji: "😔",

      tips: ["Take it easy today 🌿", "Talk to someone you trust 🤝"],

      words: ["sad", "down", "cry", "hurt", "lonely", "depressed", "broken", "pain", "miss", "tears"],

    },

    {

      name: "ANGRY",

      emoji: "😡",

      tips: ["Breathe and slow down 🫁", "Walk away for a minute 🚶‍♂️"],

      words: ["angry", "mad", "annoyed", "furious", "hate", "irritated", "pissed", "rage", "stupid"],

    },

    {

      name: "ANXIOUS",

      emoji: "😰",

      tips: ["Try grounding: 5-4-3-2-1 👣", "Take small steps, not big jumps 🧩"],

      words: ["anxious", "worried", "panic", "nervous", "stress", "stressed", "fear", "scared", "overthink", "pressure"],

    },

    {

      name: "TIRED",

      emoji: "🥱",

      tips: ["Hydrate and rest if you can 💧", "Short nap = reset 🔄"],

      words: ["tired", "sleepy", "exhausted", "drained", "fatigue", "burnout", "lazy", "weak"],

    },

    {

      name: "CONFUSED",

      emoji: "🤯",

      tips: ["Write it down and simplify 📝", "Ask one clear question at a time 🎯"],

      words: ["confused", "lost", "what", "why", "how", "idk", "don't know", "unsure", "mixed up"],

    },

    {

      name: "MOTIVATED",

      emoji: "🔥",

      tips: ["Go do the hardest part first 🏁", "Momentum beats motivation 🚀"],

      words: ["motivated", "focused", "ready", "grind", "work", "productive", "discipline", "goal", "hustle"],

    },

    {

      name: "ROMANTIC",

      emoji: "😍",

      tips: ["Say it with confidence 💌", "Small gestures go far 🌹"],

      words: ["crush", "love", "babe", "baby", "darling", "sweetheart", "kiss", "dating", "relationship"],

    },

  ];

  let best = { score: 0, bucket: null };

  for (const b of buckets) {

    let score = 0;

    for (const w of b.words) {

      if (w.includes(" ")) {

        if (t.includes(w)) score += 2;

      } else {

        // word boundary-ish

        const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");

        if (re.test(t)) score += 2;

      }

    }

    // extra cues

    if (b.name === "HAPPY" && /(:\)|😊|😄|😍|😂)/.test(text)) score += 1;

    if (b.name === "SAD" && /(😔|😭|💔)/.test(text)) score += 1;

    if (b.name === "ANGRY" && /(😡|🤬|!!+)/.test(text)) score += 1;

    if (b.name === "TIRED" && /(🥱|😴)/.test(text)) score += 1;

    if (score > best.score) best = { score, bucket: b };

  }

  // If nothing matched, guess "NEUTRAL"

  if (!best.bucket || best.score === 0) {

    return {

      name: "NEUTRAL",

      emoji: "🙂",

      confidence: 35,

      tip: "You seem calm/neutral. Want to share more?",

    };

  }

  // confidence scale

  const confidence = Math.min(95, 40 + best.score * 10);

  const tip = best.bucket.tips[Math.floor(Math.random() * best.bucket.tips.length)];

  return {

    name: best.bucket.name,

    emoji: best.bucket.emoji,

    confidence,

    tip,

  };

}

export default {

  name: "mood",

  aliases: ["moodcheck", "emotion", "feel"],

  category: "FUN",

  description: "Detect mood from text (reply a message or provide text).",

  async execute(ctx) {

    const { sock, m, from, args = [] } = ctx;

    const input = args.join(" ").trim();

    const quoted = getQuotedText(m);

    const text = input || quoted || getText(m);

    if (!text) {

      return sock.sendMessage(

        from,

        { text: "Usage: mood <text>\nOr reply a message with: mood" },

        { quoted: m }

      );

    }

    const res = analyzeMood(text);

    const msg =

      `🧠 *Mood Detector*\n\n` +

      `📌 Mood: ${res.emoji} *${res.name}*\n` +

      `📊 Confidence: *${res.confidence}%*\n` +

      `💡 Tip: ${res.tip}`;

    return sock.sendMessage(from, { text: msg }, { quoted: m });

  },

};