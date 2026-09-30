
// commands/guess.js (ESM)
// guess start | guess <number> | guess end
import { ensureDataFile, readJson, writeJson } from "./_db.js";
import { getStoredPrefix } from "../control/getPrefix.js";


const FILE = ensureDataFile("guess.json", {});

export default {
  name: "guess",
  aliases: ["guessnum"],
  category: "FUN",
  description: "Number guessing game.",
  async execute(ctx){
    const { sock, m, from, args=[] } = ctx;

const prefix = await getStoredPrefix();

    const sub = String(args[0]||"").toLowerCase();
    const db = readJson(FILE, {}) || {};
    db[from] ||= null;

    if (sub === "start") {
      const secret = Math.floor(Math.random()*100)+1;
      db[from] = { secret, tries: 0 };
        
      writeJson(FILE, db);
      return sock.sendMessage(from, { text:`🎯 Guess game started! Guess number 1-100.\nUse: ${prefix}guess 50` }, { quoted:m });
    }
    if (sub === "end") {
      db[from] = null; writeJson(FILE, db);
      return sock.sendMessage(from, { text:"✅ Guess game ended." }, { quoted:m });
    }

    const game = db[from];
    if (!game) return sock.sendMessage(from, { text:"No game. Start with: guess start" }, { quoted:m });

    const n = Number(args[0]);
    if (!Number.isFinite(n)) return sock.sendMessage(from, { text:`Use: ${prefix}guess <number>` }, { quoted:m });

    game.tries += 1;
    if (n === game.secret) {
      db[from] = null; writeJson(FILE, db);
      return sock.sendMessage(from, { text:`🏆 Correct! ${n} in ${game.tries} tries.` }, { quoted:m });
    }
    db[from] = game; writeJson(FILE, db);
    return sock.sendMessage(from, { text: n < game.secret ? "📈 Higher!" : "📉 Lower!" }, { quoted:m });
  }
};
