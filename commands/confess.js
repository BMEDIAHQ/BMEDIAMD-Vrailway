
// commands/confess.js (ESM)
// Send a message to group admins (anonymous for confess)
import { getGroupAdmins } from "./_utils.js";

function getSender(m){ return m?.key?.participant || m?.participant || m?.sender || null; }
function tagOf(jid){ return `@${String(jid||"").split("@")[0].split(":")[0]}`; }

export default {
  name: "confess",
  aliases: [],
  category: "GROUP",
  description: "Send confess to admins.",
  async execute(ctx) {
    const { sock, m, from, args=[] } = ctx;
    if (!from?.endsWith("@g.us")) return sock.sendMessage(from, { text:"Group only." }, { quoted:m });
    const sender = getSender(m);
    const body = args.join(" ").trim();
    if (!body) return sock.sendMessage(from, { text:"Usage: confess <message>" }, { quoted:m });

    const { admins } = await getGroupAdmins(sock, from);
    const adminList = Array.from(admins || []);
    if (!adminList.length) return sock.sendMessage(from, { text:"No admins found." }, { quoted:m });

    const isAnon = "confess" === "confess";
    const header = `📩 *CONFESSION*\n`;
    const meta = isAnon ? "From: Anonymous\n" : `From: ${tagOf(sender)}\n`;
    const text = `${header}${meta}\n${body}`;

    for (const a of adminList) {
      await sock.sendMessage(a, { text, mentions: isAnon ? [] : [sender] }).catch(()=>{});
    }
    return sock.sendMessage(from, { text: "✅ Sent to admins." }, { quoted:m });
  }
};
