
// commands/vote.js (ESM)
// Vote in a poll (data/polls.json)
import { ensureDataFile, readJson, writeJson } from "./_db.js";

const FILE = ensureDataFile("polls.json", {});

function getSender(m){ return m?.key?.participant || m?.participant || m?.sender || null; }
function tagOf(jid){ return `@${String(jid||"").split("@")[0].split(":")[0]}`; }

export default {
  name: "vote",
  aliases: ["pollvote"],
  category: "GROUP",
  description: "Vote in a poll. Usage: vote <id> <optionNumber>",
  async execute(ctx) {
    const { sock, m, from, args=[] } = ctx;
    const sender = ctx.sender || getSender(m);
    const id = String(args[0] || "").trim();
    const opt = Number(args[1]);

    if (!id || !Number.isFinite(opt)) return sock.sendMessage(from, { text: "Usage: vote <pollId> <optionNumber>" }, { quoted: m });

    const db = readJson(FILE, {}) || {};
    const poll = db[from]?.[id];
    if (!poll) return sock.sendMessage(from, { text: "❌ Poll not found." }, { quoted: m });

    const idx = Math.floor(opt) - 1;
    if (idx < 0 || idx >= poll.options.length) return sock.sendMessage(from, { text: "❌ Invalid option." }, { quoted: m });

    poll.votes ||= {};
    poll.votes[sender] = idx;
    db[from][id] = poll;
    writeJson(FILE, db);

    // tally
    const counts = Array(poll.options.length).fill(0);
    for (const k of Object.keys(poll.votes)) counts[poll.votes[k]] += 1;

    const lines = poll.options.map((o, i) => `${i + 1}. ${o} — *${counts[i]}*`).join("\n");
    const tag = tagOf(sender);

    return sock.sendMessage(
      from,
      { text: `✅ ${tag} voted.\n\n📊 *POLL (${id})*\n*${poll.question}*\n\n${lines}`, mentions: [sender] },
      { quoted: m }
    );
  },
};
