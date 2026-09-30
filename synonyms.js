
// commands/synonyms.js (ESM)
// synonyms <word> (Datamuse)
export default {
  name: "synonyms",
  aliases: ["syn"],
  category: "TOOLS",
  description: "Get synonyms.",
  async execute(ctx) {
    const { sock, m, from, args=[] } = ctx;
    const word = (args[0] || "").trim();
    if (!word) return sock.sendMessage(from, { text:"Usage: synonyms <word>" }, { quoted:m });

    try {
      const res = await fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(word)}&max=15`);
      const data = await res.json().catch(()=>[]);
      const words = (data || []).map(x => x.word).filter(Boolean);
      if (!words.length) return sock.sendMessage(from, { text:"No synonyms found." }, { quoted:m });

      return sock.sendMessage(from, { text: `🔁 Synonyms for *${word}*:\n\n${words.join(", ")}` }, { quoted:m });
    } catch (e) {
      return sock.sendMessage(from, { text:`❌ synonyms error: ${e?.message || e}` }, { quoted:m });
    }
  },
};
