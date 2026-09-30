export default {

  name: "pair",

  aliases: ["getbot"],

  category: "GET BOT ",

  description: "Get the bot connectedto your account bot.",

  async execute(ctx) {

    const { sock, from, m } = ctx;

    await sock.sendMessage(

      from,

      {

        image: { url: "https://files.catbox.moe/7j0eb4.jpg" },

        caption: `WhatsApp BOT deployment available.

*$1 MONTHLY*

_fast and stable_

Contact: https://wa.me/+237679261475`,

      },

      { quoted: m }

    );

  },

};