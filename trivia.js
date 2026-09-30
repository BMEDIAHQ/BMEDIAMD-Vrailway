
// commands/trivia.js (ESM)
// trivia -> asks; triviaa -> shows answer
import { ensureDataFile, readJson, writeJson } from "./_db.js";
import { getStoredPrefix } from "../control/getPrefix.js";

const FILE = ensureDataFile("trivia.json", {});

function decodeHtml(s="") {
  return s.replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">");
}

export default {
  name: "trivia",
  aliases: ["quiz"],
  category: "FUN",
  description: "Trivia question.",
  async execute(ctx){
    const { sock, m, from } = ctx;
    try{
        const prefix = await getStoredPrefix();
        
      const res = await fetch("https://opentdb.com/api.php?amount=1&type=multiple");
      const data = await res.json().catch(()=>null);
      const q = data?.results?.[0];
      if (!q) return sock.sendMessage(from, { text:"❌ Trivia error." }, { quoted:m });

      const question = decodeHtml(q.question);
      const correct = decodeHtml(q.correct_answer);
      const opts = [correct, ...q.incorrect_answers.map(decodeHtml)].sort(()=>Math.random()-0.5);

      const db = readJson(FILE, {}) || {};
      db[from] = { question, correct, opts, at: Date.now() };
      writeJson(FILE, db);

      const lines = opts.map((o,i)=>`${i+1}. ${o}`).join("\n");
      return sock.sendMessage(from, { text:`🧠 *TRIVIA*\n\n${question}\n\n${lines}\n\nAnswer with: ${prefix}triviasa` }, { quoted:m });
    } catch(e){
      return sock.sendMessage(from, { text:`❌ trivia error: ${e?.message || e}` }, { quoted:m });
    }
  }
};
