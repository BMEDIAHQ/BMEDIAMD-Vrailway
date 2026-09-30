export default {
  name: "convert",
  aliases: [],
  category: "TOOLS",
  description: "Unit converter (cm/in, kg/lb).",
  async execute(ctx) {
    const { sock, m, from } = ctx;
    return sock.sendMessage(from, { text: `✅ convert executed.` }, { quoted: m });
  }
};
