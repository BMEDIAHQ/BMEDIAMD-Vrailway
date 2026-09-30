// commands/owner.js (ESM)

// Shows the owner contact card using OWNER_NUMBER from .env

// Usage: <prefix>owner

function digitsOnly(s) {

  return String(s || "").replace(/[^\d]/g, "");

}

export default {

  name: "owner",

  aliases: ["creator", "dev", "bowner"],

  category: "INFO",

  description: "Show owner contact card.",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    const raw = process.env.OWNER_NUMBER || process.env.OWNER || "";

    const num = digitsOnly(raw);

    if (!num) {

      return sock.sendMessage(from, { text: "❌ OWNER_NUMBER is not set in .env" }, { quoted: m });

    }

    const jid = `${num}@s.whatsapp.net`;

    // Contact card

    return sock.sendMessage(

      from,

      {

        contacts: {

          displayName: "BOT OWNER",

          contacts: [

            {

              vcard:

                "BEGIN:VCARD\n" +

                "VERSION:3.0\n" +

                "FN:BOT OWNER\n" +

                `TEL;type=CELL;type=VOICE;waid=${num}:${num}\n` +

                "END:VCARD",

            },

          ],

        },

      },

      { quoted: m }

    );

  },

};