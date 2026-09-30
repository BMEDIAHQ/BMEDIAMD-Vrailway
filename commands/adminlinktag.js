// commands/adminlinktag.js (ESM)

// Always replies with:

// - Admin status (ADMIN / NOT ADMIN)

// - Link status (LINK DETECTED / NO LINK)

// - Tags the sender (same tagging style as tagme)

//

// Usage: <prefix>adminlinktag

export default {

  name: "adminlinktag",

  aliases: ["altag", "admintaglink"],

  category: "GROUP",

  description: "Show admin + link status and tag yourself.",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    if (!from?.endsWith("@g.us")) {

      return sock.sendMessage(from, { text: "This command works in groups only." }, { quoted: m });

    }

    const sender = m?.key?.participant || m?.participant || m?.sender;

    if (!sender) {

      return sock.sendMessage(from, { text: "Couldn't detect your ID. Try again." }, { quoted: m });

    }

    // ---- Admin check ----

    const bare = (id) => String(id || "").split("@")[0].split(":")[0];

    let isAdmin = false;

    try {

      const meta = await sock.groupMetadata(from);

      const senderBare = bare(sender);

      const me = (meta.participants || []).find((p) => bare(p.id) === senderBare);

      isAdmin = Boolean(me?.admin); // admin or superadmin

    } catch {

      // If we can't read metadata, treat as not admin (but still reply)

      isAdmin = false;

    }

    // ---- Link detection ----

    const text =

      m?.message?.conversation ||

      m?.message?.extendedTextMessage?.text ||

      m?.message?.imageMessage?.caption ||

      m?.message?.videoMessage?.caption ||

      "";

    const hasLink =

      /\b(chat\.whatsapp\.com\/[0-9A-Za-z]{10,})\b/i.test(text) ||

      /\b((?:https?:\/\/)?(?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,})(?:\/[^\s]*)?\b/i.test(text) ||

      /facebook\.me/i.test(text) ||

      /ayoba\.me/i.test(text);

    // ---- Tag (same style as tagme) ----

    const tag = `@${sender.split("@")[0].split(":")[0]}`;

    return sock.sendMessage(

      from,

      {

        text:

          `👤 Status Check\n` +

          `• Admin: ${isAdmin ? "✅ ADMIN" : "❌ NOT ADMIN"}\n` +

          `• Link: ${hasLink ? " 🔗 LINK DETECTED" : "✅ NO LINK"}\n\n` +

          `${tag}`,

        mentions: [sender],

      },

      { quoted: m }

    );

  },

};