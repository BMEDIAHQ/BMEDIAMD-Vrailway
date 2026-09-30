import { isOwner } from "../checks/isOwner.js";

// ✅ HELPER: Recursively unwrap the message to find the real content

// This fixes issues where replies are hidden inside 'ephemeralMessage' or 'viewOnceMessage'

function getMessageContent(m) {

  if (!m?.message) return null;

  const msg = m.message;

  return (

    msg.ephemeralMessage?.message ||

    msg.viewOnceMessage?.message ||

    msg.viewOnceMessageV2?.message ||

    msg.documentWithCaptionMessage?.message ||

    msg

  );

}

function getContextInfo(m) {

  const msg = getMessageContent(m);

  return (

    msg?.extendedTextMessage?.contextInfo ||

    msg?.imageMessage?.contextInfo ||

    msg?.videoMessage?.contextInfo ||

    null

  );

}

function getMentionedJids(m) {

  return getContextInfo(m)?.mentionedJid || [];

}

function getQuotedParticipant(m) {

  return getContextInfo(m)?.participant || null;

}

function getSender(m) {

  return m?.sender || m?.key?.participant || m?.participant || m?.key?.remoteJid || null;

}

const bare = (id) => String(id || "").split("@")[0].split(":")[0];

const tagOf = (jid) => `@${bare(jid)}`;

function toUserJid(input) {

  const d = String(input || "").trim().replace(/[^\d]/g, "");

  if (!d) return null;

  return `${d}@s.whatsapp.net`;

}

// ✅ FIX: Never convert a LID (Link ID) to a fake phone number

function senderToPhoneJid(sender) {

  if (!sender || String(sender).includes("@lid")) return null;

  const n = bare(sender);

  // Basic phone validation (7-15 digits)

  if (!/^\d{7,15}$/.test(n)) return null;

  return `${n}@s.whatsapp.net`;

}

function tryResolvePhoneJidFromParticipants(participants = [], target) {

  if (!target) return null;

  const targetRaw = String(target);

  

  // 1. Look for exact match

  const exact = participants.find(p => p.id === targetRaw || p.id?.user === bare(targetRaw));

  if (exact && !exact.id.includes("@lid")) return exact.id;

  // 2. If target is LID, look for matching Phone JID in the group map

  // Note: Baileys metadata often separates LIDs and Phone JIDs. 

  // We try to find a participant that looks like a phone JID if we only have a LID.

  // (This is best-effort as Baileys v6+ handles this differently)

  for (const p of participants) {

    const id = p.id || p; // handle legacy/modern structure

    if (typeof id === "string" && id.endsWith("@s.whatsapp.net")) {

       // If we had a way to map LID -> Phone here we would. 

       // For now, we return the ID if it matches the bare number (unlikely for LIDs)

    }

  }

  return null;

}

export default {

  name: "getpp",

  aliases: ["getpfp", "gpp"],

  category: "OWNER",

  description: "Owner-only: Fetch and send a user's profile picture.",

  async execute(ctx) {

    const { sock, m, from, args = [] } = ctx;

    const sender = getSender(m);

    if (!sender) return;

    // 1. Owner Check

    if (!isOwner(m, sock)) {

      return sock.sendMessage(

        from,

        { text: `❌ Owner only.`, mentions: [sender] },

        { quoted: m }

      );

    }

    // 2. Resolve Inputs

    const mentioned = getMentionedJids(m);

    const replied = getQuotedParticipant(m);

    const arg0 = String(args?.[0] || "").trim();

    const typed = arg0 ? toUserJid(arg0) : null;

    // Bot's real JID (Phone based)

    const botJid = sock.user?.id ? `${bare(sock.user.id)}@s.whatsapp.net` : null;

    // 3. Determine Target Priority

    // Priority: Mention > Reply > Typed > Sender (if Group) > Chat Partner (if Private)

    let targetJid = mentioned?.[0] || replied || typed;

    if (!targetJid) {

      if (from?.endsWith("@g.us")) {

        // In Groups: Default to the sender of the command

        targetJid = sender;

      } else {

        // In Private Chat / Message Yourself

        const isSelf = (bare(from) === bare(botJid)) || from.includes("@lid");

        targetJid = isSelf ? botJid : from;

      }

    }

    // 4. Post-Processing & LID Cleanup

    // If we somehow still have a LID (e.g. replied to a LID participant), try to fix it.

    if (targetJid && targetJid.includes("@lid")) {

       // If the LID belongs to the bot, swap it immediately

       if (botJid && bare(targetJid) === bare(sock.user?.lid)) {

          targetJid = botJid;

       }

    }

    try {

      let url = null;

      let finalJid = targetJid;

      // Attempt A: Direct Fetch

      // Use senderToPhoneJid to ensure we don't query a raw LID unless necessary

      const cleanJid = senderToPhoneJid(finalJid) || finalJid;

      

      try {

        url = await sock.profilePictureUrl(cleanJid, "image");

        if (url) finalJid = cleanJid;

      } catch {

        url = null;

      }

      // Attempt B: Group Metadata Resolution (For LIDs in groups)

      if (!url && from?.endsWith("@g.us")) {

        try {

          const meta = await sock.groupMetadata(from);

          // Try to find the phone JID corresponding to the target

          const participants = meta?.participants || [];

          

          // If target is a LID, we try to find the matching phone JID in participants

          // (Note: This depends on if Baileys exposes the mapping. Usually we just retry with the raw ID)

          const resolved = participants.find(p => p.id === targetJid || p.id === cleanJid);

          

          if (resolved) {

             // Sometimes fetching with the group-participant ID works better

             try {

                url = await sock.profilePictureUrl(resolved.id, "image");

                if(url) finalJid = resolved.id;

             } catch {}

          }

        } catch { /* ignore */ }

      }

      // Attempt C: Fallback to Bot if everything failed and it looks like a self-query

      if (!url && (!targetJid || targetJid.includes("@lid"))) {

         try {

            url = await sock.profilePictureUrl(botJid, "image");

            if(url) finalJid = botJid;

         } catch {}

      }

      const targetTag = tagOf(finalJid);

      if (!url) {

        return sock.sendMessage(

          from,

          {

            text: `❌ No profile picture found for ${targetTag}.`,

            mentions: [finalJid],

          },

          { quoted: m }

        );

      }

      return sock.sendMessage(

        from,

        {

          image: { url },

          caption: `✅ Profile picture of ${targetTag}`,

          mentions: [finalJid],

        },

        { quoted: m }

      );

    } catch (e) {

      console.error(e);

      return sock.sendMessage(

        from,

        { text: `❌ Error: ${e?.message || e}` },

        { quoted: m }

      );

    }

  },

};