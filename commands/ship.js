// commands/ship.js (ESM)

// Ship 2 RANDOM people in a group

// Usage: <prefix>ship

function getSender(m) {

  return m?.key?.participant || m?.participant || m?.sender;

}

const bare = (id) => String(id || "").split("@")[0].split(":")[0];

const tagOf = (jid) => `@${String(jid || "").split("@")[0].split(":")[0]}`;

function hashToPercent(input) {

  const str = String(input || "");

  let h = 0;

  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;

  return h % 101;

}

function commentFor(p) {

  if (p >= 90) return "💍 Soulmates loading…";

  if (p >= 75) return "😍 Strong vibes!";

  if (p >= 60) return "😊 Good match!";

  if (p >= 45) return "😅 Could work with effort.";

  if (p >= 25) return "🤝 More like friends…";

  return "💔 Eii… maybe not today.";

}

function pickTwoRandom(arr) {

  if (arr.length < 2) return [null, null];

  const i = Math.floor(Math.random() * arr.length);

  let j = Math.floor(Math.random() * arr.length);

  while (j === i) j = Math.floor(Math.random() * arr.length);

  return [arr[i], arr[j]];

}

export default {

  name: "ship",

  aliases: ["match", "love", "compat"],

  category: "FUN",

  description: "Ship 2 random people in the group.",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    if (!String(from || "").endsWith("@g.us")) {

      return sock.sendMessage(from, { text: "This command works in groups only." }, { quoted: m });

    }

    const sender = getSender(m);

    if (!sender) return;

    try {

      const meta = await sock.groupMetadata(from);

      const botBare = bare(sock?.user?.id);

      // Build candidate list from participants (exclude bot)

      const candidates = (meta.participants || [])

        .map((p) => p.id)

        .filter(Boolean)

        .filter((id) => bare(id) !== botBare);

      if (candidates.length < 2) {

        return sock.sendMessage(from, { text: "Not enough members to ship 😅" }, { quoted: m });

      }

      const [a, b] = pickTwoRandom(candidates);

      const nameA = tagOf(a);

      const nameB = tagOf(b);

      const percent = hashToPercent(`${bare(a)}::${bare(b)}::${from}`);

      const comment = commentFor(percent);

      const msg =

        `💘 *SHIP*\n\n` +

        `👤 ${nameA}  x  ${nameB}\n` +

        `❤️ Compatibility: *${percent}%*\n` +

        `🌟 ${comment}`;

      return sock.sendMessage(from, { text: msg, mentions: [a, b] }, { quoted: m });

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: `❌ Ship error: ${e?.message || e}` },

        { quoted: m }

      );

    }

  },

};