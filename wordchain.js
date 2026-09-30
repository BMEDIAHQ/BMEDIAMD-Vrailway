
// commands/wordchain.js (ESM)
// wordchain start | wordchain <word> | wordchain end
import { ensureDataFile, readJson, writeJson } from "./_db.js";
import { getStoredPrefix } from "../control/getPrefix.js";

const FILE = ensureDataFile("wordchain.json", {});

export default {
  name: "wordchain",
  aliases: ["wc"],
  category: "FUN",
  description: "Word chain game.",
  async execute(ctx){
    const { sock, m, from, args=[] } = ctx;
  const prefix = await getStoredPrefix();
      
    const sub = String(args[0]||"").toLowerCase();
    const db = readJson(FILE, {}) || {};
    db[from] ||= null;

    if (sub === "start") {
      db[from] = { last: "", used: [] };
      writeJson(FILE, db);
      return sock.sendMessage(from, { text:`🔗 WordChain started!\nSend a word: ${prefix}wordchain apple` }, { quoted:m });
    }
    if (sub === "end") {
      db[from] = null; writeJson(FILE, db);
      return sock.sendMessage(from, { text:"✅ WordChain ended." }, { quoted:m });
    }

    const game = db[from];
    if (!game) return sock.sendMessage(from, { text:`No game. Start: ${prefix}wordchain start` }, { quoted:m });

    const word = String(args[0]||"").toLowerCase().replace(/[^a-z]/g,"");
    if (!word || word.length < 2) return sock.sendMessage(from, { text:`Usage: ${prefix}wordchain <word>` }, { quoted:m });

    if (game.used.includes(word)) return sock.sendMessage(from, { text:"Word already used." }, { quoted:m });

    if (game.last && word[0] !== game.last.slice(-1)) {
      return sock.sendMessage(from, { text:`❌ Must start with *${game.last.slice(-1)}*` }, { quoted:m });
    }

    game.used.push(word);
    game.last = word;
    db[from] = game; writeJson(FILE, db);

    return sock.sendMessage(from, { text:`✅ OK! Next word must start with *${word.slice(-1)}*.\nUsed: ${game.used.length}` }, { quoted:m });
  }
};
