// commands/8ball.js (ESM)

// Magic 8-ball

// Usage: <prefix>8ball <question>

function getText(m) {

  return (

    m?.message?.conversation ||

    m?.message?.extendedTextMessage?.text ||

    m?.message?.imageMessage?.caption ||

    m?.message?.videoMessage?.caption ||

    ""

  ).trim();

}

export default {

  name: "8ball",

  aliases: ["eightball", "magic8", "8b"],

  category: "FUN",

  description: "Ask the magic 8-ball a question.",

  async execute(ctx) {

    const { sock, m, from, args = [] } = ctx;

    const question = args.join(" ").trim();

    if (!question) {

      return sock.sendMessage(

        from,

        { text: "Usage: 8ball <question>\nExample: 8ball Will I be rich?" },

        { quoted: m }

      );

    }

    const answers = [

      "✅ Yes, definitely.",

      "✅ It is certain.",

      "✅ Without a doubt.",

      "✅ You may rely on it.",

      "✅ Signs point to yes.",

      "🤔 Ask again later.",

      "🤔 Better not tell you now.",

      "🤔 Cannot predict now.",

      "🤔 Concentrate and ask again.",

      "😐 Maybe.",

      "❌ Don't count on it.",

      "❌ My reply is no.",

      "❌ Very doubtful.",

      "❌ Outlook not so good.",

      "❌ No way.",

      "🔥 Absolutely!",

      "🫩 Hmm… not sure.",

      "💯 Most likely.",

      "🧊 Unlikely.",

      "⚠️ If you work for it.",

    ];

    const pick = answers[Math.floor(Math.random() * answers.length)];

    return sock.sendMessage(

      from,

      {

        text:

          `🎱 *MAGIC 8-BALL*\n\n` +

          `❓ Question:\n${question}\n\n` +

          `🔮 Answer:\n*${pick}*`,

      },

      { quoted: m }

    );

  },

};