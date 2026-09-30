// commands/bank.js

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

  name: "bank",

  aliases: ["vault"],

  category: "ECONOMY",

  description: "Show bank and wallet balance.",

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

          "🏦 *Bank*\n\n" +

          `🆔 User ID: *${visibleUserId(user.id)}*\n` +

          `👛 Wallet: *${formatCoins(user.wallet)}*\n` +

          `🏦 Bank: *${formatCoins(user.bank)}*`,

      },

      { quoted: m }

    );

  },

};