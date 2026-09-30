
// commands/triviasa.js (ESM)
// Show last trivia answer
import { ensureDataFile, readJson } from "./_db.js";
import { getStoredPrefix } from "../control/getPrefix.js";

const FILE = ensureDataFile("trivia.json", {});

export default {
  name: "triviasa",
  aliases: ["triviaa", "quizanswer"],
  category: "FUN",
  description: "Show trivia answer.",
  async execute(ctx){
    const { sock, m, from } = ctx;
      
const prefix = await getStoredPrefix();

    const db = readJson(FILE, {}) || {};
    const t = db[from];
    if (!t) return sock.sendMessage(from, { text:`No trivia stored. Run: ${prefix}trivia` }, { quoted:m });
    return sock.sendMessage(from, { text:`✅ Answer: *${t.correct}*` }, { quoted:m });
  }
};
