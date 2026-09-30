
// commands/define.js (ESM)
// define <word> (dictionaryapi.dev)
export default {
  name: "define",
  aliases: ["dict"],
  category: "TOOLS",
  description: "Define a word.",
  async execute(ctx) {
    const { sock, m, from, args=[] } = ctx;
    const word = (args[0] || "").trim();
    if (!word) return sock.sendMessage(from, { text:"Usage: define <word>" }, { quoted:m });

    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      const data = await res.json().catch(()=>null);
      const meaning = data?.[0]?.meanings?.[0];
      const def = meaning?.definitions?.[0]?.definition || "";
      if (!def) return sock.sendMessage(from, { text:"No definition found." }, { quoted:m });

      return sock.sendMessage(from, { text: `📚 *${word}*\n(${meaning.partOfSpeech || "-"})\n\n• ${def}` }, { quoted:m });
    } catch (e) {
      return sock.sendMessage(from, { text:`❌ define error: ${e?.message || e}` }, { quoted:m });
    }
  },
};
