// commands/repo.js (ESM)

// Reads REPO_URL from .env and sends it.

// Usage: !repo

export default {

  name: "repo",

  aliases: ["github", "source", "sourcecode"],

  category: "INFO",

  description: "Show the bot's GitHub repository link (from .env).",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    const url = String(process.env.REPO_URL || "").trim();

    const name = String(process.env.REPO_NAME || "GitHub Repo").trim();

    if (!url) {

      return sock.sendMessage(

        from,

        { text: "❌ REPO_URL is not set in .env" },

        { quoted: m }

      );

    }

    // Option A (simple): show link plainly (most reliable)

    // return sock.sendMessage(from, { text: `⭐ *${name}*\n${url}` }, { quoted: m });

    // Option B (tries to look like an embed): link preview without extra text spam

    // WhatsApp typically generates preview when a URL exists in the text.

    // Keep text minimal so only the preview is emphasized.

    const text = `⭐ *${name}*\n${url}\n\n *FORK AND STAR THE REPO* \n\n\n\n Deployment video is in my masters official channel`;

    return sock.sendMessage(from, { text }, { quoted: m });

  },

};