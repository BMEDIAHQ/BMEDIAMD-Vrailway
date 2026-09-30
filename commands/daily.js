// commands/daily.js
import {
  DEFAULT_DAILY_REWARD,
  ensureDailyReset,
  formatCoins,
  getSenderJid,
  getUser,
  readAviatorState,
  writeAviatorState,
} from "../handlers/aviatorStore.js";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default {
  name: "daily",
  aliases: ["claim"],
  category: "ECONOMY",
  description: "Claim daily free coins.",

  async execute(ctx) {
    const { sock, m, from } = ctx;
    const jid = getSenderJid(m);
    const state = ensureDailyReset(await readAviatorState());
    const user = getUser(state, jid);
    const today = todayKey();

    if (user.lastDaily === today) {
      await writeAviatorState(state);
      return sock.sendMessage(
        from,
        {
          text:
            "⏳ You already claimed today's reward.\n\n" +
            `👛 Wallet: *${formatCoins(user.wallet)}* coins`,
        },
        { quoted: m }
      );
    }

    user.lastDaily = today;
    user.wallet = Math.round((user.wallet + DEFAULT_DAILY_REWARD) * 100) / 100;
    user.totalClaimed = Math.round((user.totalClaimed + DEFAULT_DAILY_REWARD) * 100) / 100;

    await writeAviatorState(state);
    return sock.sendMessage(
      from,
      {
        text:
          `🎁 Daily claimed: *${formatCoins(DEFAULT_DAILY_REWARD)}* coins\n\n` +
          `👛 Wallet: *${formatCoins(user.wallet)}* coins`,
      },
      { quoted: m }
    );
  },
};
