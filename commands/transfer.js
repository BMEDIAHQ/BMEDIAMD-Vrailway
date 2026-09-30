// commands/transfer.js
import {
  ensureDailyReset,
  formatCoins,
  getSenderJid,
  getUser,
  getUserById,
  parsePositiveAmount,
  readAviatorState,
  visibleUserId,
  writeAviatorState,
} from "../handlers/aviatorStore.js";

export default {
  name: "transfer",
  aliases: ["gift"],
  category: "ECONOMY",
  description: "Transfer wallet coins to another user ID.",
  usage: "transfer <amount> <userId>",

  async execute(ctx) {
    const { sock, m, from, args = [] } = ctx;

    const amount = parsePositiveAmount(args[0]);
    const targetId = String(args[1] || "").trim();

    if (!amount || !targetId) {
      return sock.sendMessage(
        from,
        { text: "❌ Usage: transfer <amount> <userId>\nExample: transfer 20 U1002" },
        { quoted: m }
      );
    }

    const senderJid = getSenderJid(m);
    const state = ensureDailyReset(await readAviatorState());
    const me = getUser(state, senderJid);
    const target = getUserById(state, targetId);

    if (!target) {
      return sock.sendMessage(from, { text: "❌ User ID not found." }, { quoted: m });
    }

    if (target.jid === me.jid) {
      return sock.sendMessage(from, { text: "❌ You cannot transfer to yourself." }, { quoted: m });
    }

    if (me.wallet < amount) {
      await writeAviatorState(state);
      return sock.sendMessage(
        from,
        { text: `❌ Insufficient wallet.\n👛 Wallet: *${formatCoins(me.wallet)}*` },
        { quoted: m }
      );
    }

    me.wallet = Math.round((me.wallet - amount) * 100) / 100;
    target.wallet = Math.round((target.wallet + amount) * 100) / 100;
    me.totalTransferredOut = Math.round((me.totalTransferredOut + amount) * 100) / 100;
    target.totalTransferredIn = Math.round((target.totalTransferredIn + amount) * 100) / 100;

    await writeAviatorState(state);
    return sock.sendMessage(
      from,
      {
        text:
          `✅ Transferred *${formatCoins(amount)}* coins to *${visibleUserId(target.id)}*.\n\n` +
          `👛 Your wallet: *${formatCoins(me.wallet)}*`,
      },
      { quoted: m }
    );
  },
};
