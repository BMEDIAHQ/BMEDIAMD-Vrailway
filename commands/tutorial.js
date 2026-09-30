// commands/tutorial.js (ESM)

// Command that sends the tutorial button (tb6-style)

// Usage: <prefix>tutorial

import { sendTutorialButtons } from "../assets/tutorialButtons.js";

export default {

  name: "tutorial",

  aliases: ["yt", "youtube", "tut"],

  category: "INFO",

  description: "Show a button linking to the YouTube tutorial channel.",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    return sendTutorialButtons(sock, m, from);

  },

};