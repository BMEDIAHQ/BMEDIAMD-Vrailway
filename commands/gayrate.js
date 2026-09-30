
// commands/gayrate.js (ESM)
function getSender(m){ return m?.key?.participant || m?.participant || m?.sender || null; }
function tagOf(jid){ return `@${String(jid||"").split("@")[0].split(":")[0]}`; }
function getMentioned(m){ return m?.message?.extendedTextMessage?.contextInfo?.mentionedJid || []; }
function getQuotedParticipant(m){ return m?.message?.extendedTextMessage?.contextInfo?.participant || null; }

export default {
  name: "gayrate",
  aliases: [],
  category: "FUN",
  description: "🏳️‍🌈 *GayRate*",
  async execute(ctx) {
    const { sock, m, from } = ctx;
    const sender = ctx.sender || getSender(m);
    const target = getMentioned(m)[0] || getQuotedParticipant(m) || sender;
    const score = Math.floor(Math.random()*(101) + 0);
    return sock.sendMessage(from, {
      text: `🏳️‍🌈 *GayRate*\n\n${tagOf(target)}: *${score}%*`,
      mentions: [target]
    }, { quoted:m });
  }
};
