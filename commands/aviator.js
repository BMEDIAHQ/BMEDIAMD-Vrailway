// commands/aviator.js

import {

  ensureDailyReset,

  formatCoins,

  getChatStats,

  getSenderJid,

  getUser,

  parsePositiveAmount,

  readAviatorState,

  visibleUserId,

  writeAviatorState,

  leaderboardText,

} from "../handlers/aviatorStore.js";

function sleep(ms) {

  return new Promise((resolve) => setTimeout(resolve, ms));

}

function parseAutoMultiplier(input) {

  const n = Number(String(input || "").replace(/[xX]/g, "").trim());

  if (!Number.isFinite(n) || n < 1 || n > 100) return null;

  return Math.round(n * 100) / 100;

}

// Hard for crash to pass 5x

function generateCrashMultiplier() {

  const r = Math.random();

  let x;

  if (r < 0.78) {

    // 78% chance -> between 1.00x and 5.00x

    x = 1 + Math.random() * 4;

  } else if (r < 0.93) {

    // 15% chance -> between 5.01x and 10.00x

    x = 5 + Math.random() * 5;

  } else if (r < 0.985) {

    // 5.5% chance -> between 10.01x and 25.00x

    x = 10 + Math.random() * 15;

  } else {

    // 1.5% chance -> between 25.01x and 100.00x

    x = 25 + Math.random() * 75;

  }

  if (x > 100) x = 100;

  return Math.round(x * 100) / 100;

}

export default {

  name: "aviator",

  aliases: ["av"],

  category: "GAME",

  description: "Fake Aviator game. Usage: aviator 10 2.3",

  usage: "aviator <stake> <autoCashoutX>",

  async execute(ctx) {

    const { sock, m, from, args = [] } = ctx;

    const jid = getSenderJid(m);

    if (!jid) {

      return sock.sendMessage(from, { text: "❌ Could not resolve your user." }, { quoted: m });

    }

    const stake = parsePositiveAmount(args[0]);

    const auto = parseAutoMultiplier(args[1]);

    if (!stake || !auto) {

      return sock.sendMessage(

        from,

        {

          text:

            "✈️ *Aviator Usage*\n\n" +

            "aviator 10 2.3\n\n" +

            "Meaning:\n" +

            "• minimum stake = 10 coins\n" +

            "• auto cashout range = 1x to 100x",

        },

        { quoted: m }

      );

    }

    if (stake < 10) {

      return sock.sendMessage(

        from,

        { text: "❌ Minimum stake is *10 coins*." },

        { quoted: m }

      );

    }

    const state = ensureDailyReset(await readAviatorState());

    const user = getUser(state, jid);

    const chatStats = getChatStats(state, from, jid);

    if (user.wallet < stake) {

      await writeAviatorState(state);

      return sock.sendMessage(

        from,

        {

          text:

            "❌ *Insufficient wallet balance.*\n\n" +

            `🆔 Your ID: *${visibleUserId(user.id)}*\n` +

            `👛 Wallet: *${formatCoins(user.wallet)}* coins\n\n` +

            `Claim today's free coins with: *daily*\n` +

            `Or contact the owner to credit coins using your user ID.`,

        },

        { quoted: m }

      );

    }

    const crash = generateCrashMultiplier();

    const won = auto <= crash;

    user.wallet = Math.round((user.wallet - stake) * 100) / 100;

    user.totalPlayed += 1;

    chatStats.played += 1;

    chatStats.stakeTotal = Math.round((chatStats.stakeTotal + stake) * 100) / 100;

    chatStats.lastPlayedAt = new Date().toISOString();

    await writeAviatorState(state);

    await sock.sendMessage(

      from,

      {

        text:

          "✈️ *AVIATOR STARTED*\n\n" +

          `💸 Stake: *${formatCoins(stake)}*\n` +

          `🎯 Auto Cashout: *${auto.toFixed(2)}x*\n\n` +

          "⏳ Waiting for result...",

      },

      { quoted: m }

    );

    await sleep(4000);

    let text = "";

    if (won) {

      const payout = Math.round(stake * auto * 100) / 100;

      const profit = Math.round((payout - stake) * 100) / 100;

      user.wallet = Math.round((user.wallet + payout) * 100) / 100;

      user.totalWon = Math.round((user.totalWon + profit) * 100) / 100;

      chatStats.wins += 1;

      chatStats.payoutTotal = Math.round((chatStats.payoutTotal + payout) * 100) / 100;

      chatStats.profit = Math.round((chatStats.profit + profit) * 100) / 100;

      text =

        "✅ *AVIATOR WIN*\n\n" +

        `💸 Stake: *${formatCoins(stake)}*\n` +

        `🎯 Auto Cashout: *${auto.toFixed(2)}x*\n` +

        `💥 Crash: *${crash.toFixed(2)}x*\n` +

        `🏆 Profit: *+${formatCoins(profit)}* coins\n` +

        `👛 Wallet: *${formatCoins(user.wallet)}* coins\n\n` +

        `📊 Today's chat leaderboard:\n${leaderboardText(state, from)}`;

    } else {

      user.totalLost = Math.round((user.totalLost + stake) * 100) / 100;

      chatStats.losses += 1;

      chatStats.profit = Math.round((chatStats.profit - stake) * 100) / 100;

      text =

        "❌ *AVIATOR LOST*\n\n" +

        `💸 Stake: *${formatCoins(stake)}*\n` +

        `🎯 Auto Cashout: *${auto.toFixed(2)}x*\n` +

        `💥 Crash: *${crash.toFixed(2)}x*\n` +

        `📉 Loss: *-${formatCoins(stake)}* coins\n` +

        `👛 Wallet: *${formatCoins(user.wallet)}* coins\n\n` +

        `📊 Today's chat leaderboard:\n${leaderboardText(state, from)}`;

    }

    await writeAviatorState(state);

    return sock.sendMessage(from, { text }, { quoted: m });

  },

};