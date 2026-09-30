// commands/evl.js
import { isOwner } from "../checks/isOwner.js";
import util from "util";

async function actionExecute(ctx) {
  const { sock, m, from, args } = ctx;
  
  // Join all arguments into one string to prevent "Unexpected token" errors
  const code = args.join(" ");

  if (!code) {
    return sock.sendMessage(from, { text: "❌ Provide code to execute." }, { quoted: m });
  }

  try {
    // We use a cleaner eval approach that directly returns the result
    let evaled = await eval(`(async () => { 
      try {
        ${code} 
      } catch (err) {
        return "Execution Error: " + err.message;
      }
    })()`);
    
    // If the code returns nothing (like a sendMessage), evaled is undefined.
    if (typeof evaled === "undefined") return;

    if (typeof evaled !== "string") {
      evaled = util.inspect(evaled, { depth: 0 });
    }

    return sock.sendMessage(from, { text: `✅ *Result:*\n\`\`\`${evaled}\`\`\`` }, { quoted: m });
  } catch (e) {
    return sock.sendMessage(from, { text: `❌ *Syntax Error:*\n\`\`\`${e.message}\`\`\`` }, { quoted: m });
  }
}

export default {
  name: "evl",
  aliases: ["e", "run"],
  category: "OWNER",
  description: "Direct code execution.",
  usage: "evl <code>",

  async execute(ctx) {
    const { sock, m, from, args = [] } = ctx;

    if (!isOwner(m, sock)) {
      return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });
    }

    // Pass everything AFTER the command name to the execution function
    return actionExecute(ctx);
  },
};