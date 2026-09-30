export default {

  name: "freefb",

  aliases: ["hackedfb", "crackedfb", "unlimitedfb", "offlinefb", "ffb"],

  category: "CRACKED SOFTWARES",

  description: "get access to Facebook and watch videos on free mode WITH ORANGE CAMEROON 🇨🇲🇨🇲🇨🇲.",

  async execute(ctx) {

    const { sock, from, m } = ctx;

    await sock.sendMessage(

      from,

      {

        image: { url: "https://files.catbox.moe/r7r2hx.jpg" },

        caption: `*HACKED FACEBOOK*

 *WATCH VIDEOS WITH UNLIMITED INTERNET*

 *Works with ORANGE CMR 🇨🇲🇨🇲🇨🇲*
No Third party app needed 

_FAST and STABLE_

*• PRICE: 2,000XAF*
> nO nEGOTIATIONS

CONTACT: https://wa.me/+237679261475

> _BMEDIA-MD_
`,

      },

      { quoted: m }

    );

  },

};