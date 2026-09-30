export default {
  name: "dice",
  aliases: [],
  category: "FUN",
  description: "Roll a dice.",
  async execute(ctx) {
    const { sock, m, from } = ctx;
    return sock.sendMessage(from, { text: `✅ dice executed.` }, { quoted: m });
  }
};
