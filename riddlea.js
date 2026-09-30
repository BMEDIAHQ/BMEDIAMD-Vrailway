// commands/riddlea.js (ESM)

// Usage:

//  <prefix>riddlea               -> sends riddle + answer

//  <prefix>riddlea 2.5           -> sends riddle now, answer after 2.5 minutes (must be < 3)

// Tags the sender.

function getSender(m) {

  return m?.key?.participant || m?.participant || m?.sender;

}

function tagOf(jid) {

  return `@${String(jid || "").split("@")[0].split(":")[0]}`;

}

function parseMinutes(input) {

  if (!input) return null;

  const n = Number(String(input).replace(",", "."));

  if (!Number.isFinite(n)) return null;

  return n;

}

export default {

  name: "riddlea",

  aliases: ["rida", "riddleans"],

  category: "FUN",

  description: "Get a random riddle + answer (or delayed answer < 3 minutes).",

  async execute(ctx) {

    const { sock, m, from, args } = ctx;

    const sender = getSender(m);

    if (!sender) return;

    const tag = tagOf(sender);

    // minutes argument (optional)

    const minutes = parseMinutes(args?.[0]);

    // validate minutes if provided

    if (minutes !== null) {

      if (minutes <= 0) {

        return sock.sendMessage(

          from,

          { text: "❌ Minutes must be greater than 0.\nExample: riddlea 2.5" },

          { quoted: m }

        );

      }

      if (minutes >= 3) {

        return sock.sendMessage(

          from,

          { text: "❌ Minutes must be less than 3 (e.g. 2.9)." },

          { quoted: m }

        );

      }

    }

    try {

      const res = await fetch("https://riddles-api.vercel.app/random", {

        method: "GET",

        headers: { accept: "application/json" },

      });

      if (!res.ok) {

        return sock.sendMessage(

          from,

          { text: `❌ Riddle error: API returned HTTP ${res.status}` },

          { quoted: m }

        );

      }

      const data = await res.json().catch(() => null);

      const riddle = String(data?.riddle || "").trim();

      const answer = String(data?.answer || "").trim();

      if (!riddle) {

        return sock.sendMessage(from, { text: "❌ Riddle error: Empty riddle." }, { quoted: m });

      }

      if (!answer) {

        return sock.sendMessage(from, { text: "❌ Riddle error: Empty answer." }, { quoted: m });

      }

      // If minutes provided: send riddle now, answer later

      if (minutes !== null) {

        await sock.sendMessage(

          from,

          {

            text: `*RIDDLE:*\n\n${tag} ${riddle}\n\n⏳ Answer in *${minutes}* minute(s)...`,

            mentions: [sender],

          },

          { quoted: m }

        );

        const delayMs = Math.floor(minutes * 60 * 1000);

        setTimeout(async () => {

          try {

            // (Still only tags the original sender; avoids tagging random people)

            await sock.sendMessage(from, { text: `*ANSWER:*\n\n${answer}` });

          } catch (err) {

            console.log("[riddlea] delayed answer send error:", err?.message || err);

          }

        }, delayMs);

        return;

      }

      // No minutes: send riddle + answer immediately

      return sock.sendMessage(

        from,

        {

          text: `*RIDDLE:*\n\n${tag} ${riddle}\n\n*ANSWER:*\n\n${answer}`,

          mentions: [sender],

        },

        { quoted: m }

      );

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: `❌ Riddle error: ${e?.message || e}` },

        { quoted: m }

      );

    }

  },

};