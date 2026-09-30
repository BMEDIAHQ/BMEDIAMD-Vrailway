// commands/send.js
import { isOwner } from "../checks/isOwner.js";
import {
  ensureDailyReset,
  formatCoins,
  getUserById,
  parsePositiveAmount,
  readAviatorState,
  writeAviatorState,
  visibleUserId,
} from "../handlers/aviatorStore.js";

export default {
  name: "send",
  aliases: ["credit", "addcoins"],
  category: "OWNER",
  description: "Owner-only: credit a user wallet by user ID.",
  usage: "send <amount> <userId>",

  async execute(ctx) {
    const { sock, m, from, args = [] } = ctx;

    if (!isOwner(m, sock)) {
      return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });
    }

    const amount = parsePositiveAmount(args[0]);
    const targetId = String(args[1] || "").trim();

    if (!amount || !targetId) {
      return sock.sendMessage(
        from,
        { text: "❌ Usage: send <amount> <userId>\nExample: send 100 U1000" },
        { quoted: m }
      );
    }

    const state = ensureDailyReset(await readAviatorState());
    const target = getUserById(state, targetId);

    if (!target) {
      return sock.sendMessage(from, { text: "❌ User ID not found." }, { quoted: m });
    }

    target.wallet = Math.round((target.wallet + amount) * 100) / 100;
    target.totalCredited = Math.round((target.totalCredited + amount) * 100) / 100;

    await writeAviatorState(state);
    return sock.sendMessage(
      from,
      {
        text:
          `✅ Credited *${formatCoins(amount)}* coins to *${visibleUserId(target.id)}*.\n` +
          `👛 New wallet: *${formatCoins(target.wallet)}*`,
      },
      { quoted: m }
    );
  },
};
