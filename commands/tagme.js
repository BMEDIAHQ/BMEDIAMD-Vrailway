// commands/tagme.js (ESM)

// Tags the user who runs the command (group only).

// Usage: <prefix>tagme

export default {

  name: "tagme",

  aliases: ["mentionme", "me"],

  category: "GROUP",

  description: "Tag yourself in a group.",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    if (!from?.endsWith("@g.us")) {

      return sock.sendMessage(from, { text: "This command works in groups only." }, { quoted: m });

    }

    // Prefer the real group participant id from the message key

    const sender = m?.key?.participant || m?.participant || m?.sender;

    if (!sender) {

      return sock.sendMessage(from, { text: "Couldn't detect your ID. Try again." }, { quoted: m });

    }

    const tag = `@${sender.split("@")[0].split(":")[0]}`;

    return sock.sendMessage(

      from,

      {

        text: `✅ ${tag}`,

        mentions: [sender],

      },

      { quoted: m }

    );

  },

};