// commands/deposit.js
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
  name: "deposit",
  aliases: ["dep"],
  category: "ECONOMY",
  description: "Move wallet coins into bank.",
  usage: "deposit <amount>",

  async execute(ctx) {
    const { sock, m, from, args = [] } = ctx;
    const amount = parsePositiveAmount(args[0]);
    if (!amount) {
      return sock.sendMessage(from, { text: "❌ Usage: deposit <amount>" }, { quoted: m });
    }

    const jid = getSenderJid(m);
    const state = ensureDailyReset(await readAviatorState());
    const user = getUser(state, jid);

    if (user.wallet < amount) {
      await writeAviatorState(state);
      return sock.sendMessage(
        from,
        { text: `❌ Not enough in wallet.\n👛 Wallet: *${formatCoins(user.wallet)}*` },
        { quoted: m }
      );
    }

    user.wallet = Math.round((user.wallet - amount) * 100) / 100;
    user.bank = Math.round((user.bank + amount) * 100) / 100;
    user.totalDeposited = Math.round((user.totalDeposited + amount) * 100) / 100;

    await writeAviatorState(state);
    return sock.sendMessage(
      from,
      {
        text:
          `✅ Deposited *${formatCoins(amount)}* coins.\n\n` +
          `👛 Wallet: *${formatCoins(user.wallet)}*\n` +
          `🏦 Bank: *${formatCoins(user.bank)}*`,
      },
      { quoted: m }
    );
  },
};
