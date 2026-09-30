// commands/coinflip.js (ESM)

// Flip a coin

// Usage: <prefix>coinflip

export default {

  name: "coinflip",

  aliases: ["flip", "coin", "cf"],

  category: "FUN",

  description: "Flip a coin (Heads or Tails).",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    const res = Math.random() < 0.5 ? "🪙 HEADS" : "🪙 TAILS";

    return sock.sendMessage(

      from,

      { text: `🎲 *COIN FLIP*\n\nResult: *${res}*` },

      { quoted: m }

    );

  },

};