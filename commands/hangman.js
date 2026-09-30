
// commands/hangman.js (ESM)
// hangman start | hangman <letter> | hangman end
import { ensureDataFile, readJson, writeJson } from "./_db.js";
import { getStoredPrefix } from "../control/getPrefix.js";

const FILE = ensureDataFile("hangman.json", {});

const words = ["CAMEROON","BMEDIA","ATASA","WHATSAPP","BAILEYS","JAVASCRIPT","TERMUX","VPS","NETWORK","SECURITY"];

function mask(word, guessed){
  return word.split("").map(ch => guessed.has(ch) ? ch : "•").join(" ");
}

export default {
  name: "hangman",
  aliases: ["hm"],
  category: "FUN",
  description: "Hangman game.",
  async execute(ctx){
    const { sock, m, from, args=[] } = ctx;

const prefix = await getStoredPrefix();

    const sub = String(args[0]||"").toLowerCase();
    const db = readJson(FILE, {}) || {};
    db[from] ||= null;

    if (sub === "start") {
      const word = words[Math.floor(Math.random()*words.length)];
      db[from] = { word, guessed: [], wrong: 0 };
      writeJson(FILE, db);
      return sock.sendMessage(from, { text:`🪢 Hangman started!\n\n${mask(word,new Set())}\n\nWrong: 0/6\nType: ${prefix}hangman a` }, { quoted:m });
    }
    if (sub === "end") {
      db[from] = null; writeJson(FILE, db);
      return sock.sendMessage(from, { text:"✅ Hangman ended." }, { quoted:m });
    }

    const game = db[from];
    if (!game) return sock.sendMessage(from, { text:`No game. Start with: ${prefix}hangman start` }, { quoted:m });

    const letter = String(args[0]||"").toUpperCase();
    if (!/^[A-Z]$/.test(letter)) return sock.sendMessage(from, { text:`Type one letter: ${prefix}hangman a` }, { quoted:m });

    const guessed = new Set(game.guessed);
    if (guessed.has(letter)) return sock.sendMessage(from, { text:"Already guessed." }, { quoted:m });

    guessed.add(letter);
    game.guessed = Array.from(guessed);

    if (!game.word.includes(letter)) game.wrong += 1;

    const masked = mask(game.word, guessed);
    if (!masked.includes("•")) {
      db[from] = null; writeJson(FILE, db);
      return sock.sendMessage(from, { text:`🏆 You won!\n\n${game.word}` }, { quoted:m });
    }
    if (game.wrong >= 6) {
      db[from] = null; writeJson(FILE, db);
      return sock.sendMessage(from, { text:`💀 Game over!\nWord: ${game.word}` }, { quoted:m });
    }

    db[from] = game; writeJson(FILE, db);
    return sock.sendMessage(from, { text:`${masked}\n\nWrong: ${game.wrong}/6` }, { quoted:m });
  }
};
