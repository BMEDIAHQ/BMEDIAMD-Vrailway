// commands/addmeta.js (ESM)
// BMEDIA-MD - Add current Meta AI bot to the current group.
//
// Important:
// - Uses the current Meta AI bot JID: 867051314767696@bot
// - Makes ONE add attempt only to avoid triggering WhatsApp rate limits.
// - If the installed Baileys build exposes aiGroupAddBot(), that method is preferred.
// - Otherwise falls back to groupParticipantsUpdate().
//
// Whether Meta AI can be added is still controlled server-side by WhatsApp/Meta.

const META_AI_JID = "867051314767696@bot";

function box(title, lines) {
  return [
    `╭─〔 ${title} 〕`,
    ...lines.map((x, i) => `${i === lines.length - 1 ? "╰" : "├"}◦ ${x}`),
    "",
    "> POWERED BY BMEDIA"
  ].join("\n");
}

function errText(e) {
  return String(
    e?.data?.text ||
    e?.data?.error ||
    e?.message ||
    e ||
    "Unknown error"
  );
}

function getStatus(result) {
  if (Array.isArray(result)) return String(result?.[0]?.status ?? "");
  return String(result?.status ?? result?.attrs?.status ?? "");
}

export default {
  name: "addmeta",
  aliases: ["metaai", "addmetaai"],
  category: "GROUP",
  description: "Add Meta AI to the current WhatsApp group.",

  async execute({ sock, m, from }) {
    if (!String(from || "").endsWith("@g.us")) {
      return sock.sendMessage(
        from,
        {
          text: box("*ADDMETA*", [
            "Use this command inside the target WhatsApp group."
          ])
        },
        { quoted: m }
      );
    }

    try {
      const metadata = await sock.groupMetadata(from);

      // If Meta AI is already present, do not hit the server again.
      const alreadyThere = Array.isArray(metadata?.participants) &&
        metadata.participants.some(p => {
          const ids = [p?.id, p?.jid, p?.lid, p?.phoneNumber]
            .filter(Boolean)
            .map(String);
          return ids.includes(META_AI_JID);
        });

      if (alreadyThere) {
        return sock.sendMessage(
          from,
          {
            text: box("*META AI*", [
              "Meta AI is already in this group."
            ])
          },
          { quoted: m }
        );
      }

      // Newer/enhanced Baileys builds may expose the dedicated AI-group method.
      if (typeof sock.aiGroupAddBot === "function") {
        try {
          await sock.aiGroupAddBot(from);

          return sock.sendMessage(
            from,
            {
              text: box("*META AI*", [
                "Meta AI added successfully.",
                `JID: ${META_AI_JID}`
              ])
            },
            { quoted: m }
          );
        } catch (e) {
          const msg = errText(e);

          if (/rate-overlimit|429/i.test(msg)) {
            return sock.sendMessage(
              from,
              {
                text: box("*ADDMETA RATE LIMIT*", [
                  "WhatsApp temporarily rate-limited this action.",
                  "Wait before trying again.",
                  "Do not spam the command."
                ])
              },
              { quoted: m }
            );
          }

          // Continue to the standard Baileys fallback below.
        }
      }

      // Standard Baileys fallback.
      // ONE request only — do not loop through old/legacy JIDs.
      const result = await sock.groupParticipantsUpdate(
        from,
        [META_AI_JID],
        "add"
      );

      const status = getStatus(result);

      if (status === "200" || status === "") {
        // Re-check metadata so we do not falsely claim success.
        try {
          const updated = await sock.groupMetadata(from);
          const present = Array.isArray(updated?.participants) &&
            updated.participants.some(p => {
              const ids = [p?.id, p?.jid, p?.lid, p?.phoneNumber]
                .filter(Boolean)
                .map(String);
              return ids.includes(META_AI_JID);
            });

          if (present) {
            return sock.sendMessage(
              from,
              {
                text: box("*META AI*", [
                  "Meta AI added successfully.",
                  `JID: ${META_AI_JID}`
                ])
              },
              { quoted: m }
            );
          }
        } catch {}

        return sock.sendMessage(
          from,
          {
            text: box("*ADDMETA*", [
              "WhatsApp accepted the add request,",
              "but Meta AI was not confirmed in the group.",
              "Your account/group may not have Meta AI group access yet."
            ])
          },
          { quoted: m }
        );
      }

      return sock.sendMessage(
        from,
        {
          text: box("*ADDMETA FAILED*", [
            `WhatsApp status: ${status || "unknown"}`,
            "Meta AI group membership may not be enabled for this account/group."
          ])
        },
        { quoted: m }
      );

    } catch (e) {
      const msg = errText(e);

      if (/rate-overlimit|429/i.test(msg)) {
        return sock.sendMessage(
          from,
          {
            text: box("*ADDMETA RATE LIMIT*", [
              "WhatsApp temporarily rate-limited this action.",
              "Wait before trying again.",
              "This command now makes only one add request."
            ])
          },
          { quoted: m }
        );
      }

      return sock.sendMessage(
        from,
        {
          text: box("*ADDMETA ERROR*", [
            msg.slice(0, 500)
          ])
        },
        { quoted: m }
      );
    }
  }
};
