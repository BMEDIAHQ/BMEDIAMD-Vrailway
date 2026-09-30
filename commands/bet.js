
// commands/bet.js (ESM)
// bet <amount> (just for fun, no wallet)
import { getStoredPrefix } from "../control/getPrefix.js";

export default {
  name: "bet",
  aliases: [],
  category: "FUN",
  description: "Simple betting game.",
  async execute(ctx){
    const { sock, m, from, args=[] } = ctx;
    const prefix = await getStoredPrefix();
    const amt = Number(args[0] || 0);
    if (!Number.isFinite(amt) || amt <= 0) return sock.sendMessage(from, { text:`Usage: ${prefix}bet <amount>` }, { quoted:m });

    const win = Math.random() < 0.45;
    const gain = win ? Math.floor(amt * (1.2 + Math.random())) : -amt;
    const out = win ? `🎉 You won *${gain}*` : `💸 You lost *${amt}*`;
    return sock.sendMessage(from, { text: `🎲 Bet: ${amt}\n\n${out}` }, { quoted:m });
  }
};
