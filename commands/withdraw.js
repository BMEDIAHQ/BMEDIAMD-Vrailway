// commands/withdraw.js
import {
  ensureDailyReset,
  formatCoins,
  getSenderJid,
  getUser,
  parsePositiveAmount,
  readAviatorState,
  writeAviatorState,
} from "../handlers/aviatorStore.js";

export default {
  name: "withdraw",
  aliases: ["with"],
  category: "ECONOMY",
  description: "Move bank coins into wallet.",
  usage: "withdraw <amount>",

  async execute(ctx) {
    const { sock, m, from, args = [] } = ctx;
    const amount = parsePositiveAmount(args[0]);
    if (!amount) {
      return sock.sendMessage(from, { text: "❌ Usage: withdraw <amount>" }, { quoted: m });
    }

    const jid = getSenderJid(m);
    const state = ensureDailyReset(await readAviatorState());
    const user = getUser(state, jid);

    if (user.bank < amount) {
      await writeAviatorState(state);
      return sock.sendMessage(
        from,
        { text: `❌ Not enough in bank.\n🏦 Bank: *${formatCoins(user.bank)}*` },
        { quoted: m }
      );
    }

    user.bank = Math.round((user.bank - amount) * 100) / 100;
    user.wallet = Math.round((user.wallet + amount) * 100) / 100;
    user.totalWithdrawn = Math.round((user.totalWithdrawn + amount) * 100) / 100;

    await writeAviatorState(state);
    return sock.sendMessage(
      from,
      {
        text:
          `✅ Withdrew *${formatCoins(amount)}* coins.\n\n` +
          `👛 Wallet: *${formatCoins(user.wallet)}*\n` +
          `🏦 Bank: *${formatCoins(user.bank)}*`,
      },
      { quoted: m }
    );
  },
};
