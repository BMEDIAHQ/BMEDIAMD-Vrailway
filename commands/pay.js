export default {

  name: "pay",

  aliases: ["card", "matercard", "payment", "paymentmethod"],

  category: "MARKETING",

  description: "My payment Methods",

  async execute(ctx) {

    const { sock, from, m } = ctx;

    await sock.sendMessage(

      from,

      {

        image: { url: "https://files.catbox.moe/99avoj.jpg" },

        caption: `         *PAYMENT METHODS*

╒════════════════━━╾∘
│ *MTN MOBILE MONEY*
│ Number: *679261475*
│ Name: *BASTIEN*
├────────────────━━╾∘
│ *ORANGE MONEY*
│ Number:689660487
│ Name: 
├────────────────━━╾∘
│ *MINIPAY*
│ Number: +237679261475
╘════════════════━━╾∘
> _BMEDIA-MD_
`,

      },

      { quoted: m }

    );

  },

};