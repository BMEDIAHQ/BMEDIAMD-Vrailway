// commands/wallet.js
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
  name: "wallet",
  aliases: ["cash"],
  category: "ECONOMY",
  description: "Show wallet balance.",

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
          "👛 *Wallet*\n\n" +
          `🆔 User ID: *${visibleUserId(user.id)}*\n` +
          `Coins available to play: *${formatCoins(user.wallet)}*`,
      },
      { quoted: m }
    );
  },
};
