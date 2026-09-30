
// commands/poll.js (ESM)
// Create a simple poll (stored in data/polls.json)
import { ensureDataFile, readJson, writeJson } from "./_db.js";

const FILE = ensureDataFile("polls.json", {});

function newId() {
  return Math.random().toString(36).slice(2, 8);
}

export default {
  name: "poll",
  aliases: ["createpoll"],
  category: "GROUP",
  description: "Create a poll. Usage: poll Question | option1 | option2 | ...",
  async execute(ctx) {
    const { sock, m, from, text="" } = ctx;

    const raw = String(text || "").trim();
    const parts = raw.split("|").map(s => s.trim()).filter(Boolean);

    // remove command itself (first word)
    const first = parts[0] || "";
    const cleaned0 = first.replace(/^\S+\s+/, "").trim();
    parts[0] = cleaned0;

    const question = parts[0];
    const options = parts.slice(1);

    if (!question || options.length < 2) {
      return sock.sendMessage(from, { text: "Usage:\npoll Question | option1 | option2 | option3" }, { quoted: m });
    }

    const db = readJson(FILE, {}) || {};
    db[from] ||= {};
    const id = newId();

    db[from][id] = { question, options, votes: {}, createdAt: Date.now() };
    writeJson(FILE, db);

    const lines = options.map((o, i) => `${i + 1}. ${o}`).join("\n");

    return sock.sendMessage(
      from,
      { text: `📊 *POLL (${id})*\n\n*${question}*\n\n${lines}\n\nVote with: vote ${id} <number>` },
      { quoted: m }
    );
  },
};
