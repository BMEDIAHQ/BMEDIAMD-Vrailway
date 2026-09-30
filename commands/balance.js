// commands/balance.js
import {
  ensureDailyReset,
  formatCoins,
  getSenderJid,
  getUser,
  readAviatorState,
  visibleUserId,
  writeAviatorState,
} from "../handlers/aviatorStore.js";

export default {
  name: "balance",
  aliases: ["bal"],
  category: "ECONOMY",
  description: "Show your wallet and bank balance.",

  async execute(ctx) {
    const { sock, m, from } = ctx;
    const jid = getSenderJid(m);
    const state = ensureDailyReset(await readAviatorState());
    const user = getUser(state, jid);
    await writeAviatorState(state);

    return sock.sendMessage(
      from,
      {
        text:
          "💰 *Balance*\n\n" +
          `🆔 User ID: *${visibleUserId(user.id)}*\n` +
          `👛 Wallet: *${formatCoins(user.wallet)}* coins\n` +
          `🏦 Bank: *${formatCoins(user.bank)}* coins`,
      },
      { quoted: m }
    );
  },
};
