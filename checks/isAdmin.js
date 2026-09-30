// checks/isAdmin.js (ESM)

/**

 * Normalize a jid:

 * - force string

 * - trim

 * - remove device part (e.g. 2376xxxx:12@s.whatsapp.net -> 2376xxxx@s.whatsapp.net)

 */

function normalizeJidLike(j) {

  if (!j) return "";

  const s = String(j).trim();

  if (!s.includes("@")) return s;

  const [user, server] = s.split("@");

  const userNoDevice = user.split(":")[0]; // remove device if present

  return `${userNoDevice}@${server}`;

}

/**

 * Bare id:

 * - only the user portion (no device, no domain)

 *   e.g. 2376xxxx:12@s.whatsapp.net -> 2376xxxx

 *        14123abcd:1@lid -> 14123abcd

 */

function bareId(j) {

  if (!j) return "";

  const s = String(j).trim();

  const left = s.includes("@") ? s.split("@")[0] : s;

  return left.split(":")[0];

}

/**

 * Returns admin role info for a user in a group.

 * @returns {Promise<{isAdmin:boolean, role:null|"admin"|"superadmin", matchedId:string|null}>}

 */

export async function getAdminInfo(sock, groupJid, userJid, cachedMeta = null) {

  try {

    if (!groupJid || !String(groupJid).endsWith("@g.us")) {

      return { isAdmin: false, role: null, matchedId: null };

    }

    if (!userJid) return { isAdmin: false, role: null, matchedId: null };

    const meta = cachedMeta || (await sock.groupMetadata(groupJid));

    const participants = meta?.participants || [];

    const uRaw = String(userJid).trim();

    const uNorm = normalizeJidLike(uRaw);

    const uBare = bareId(uRaw);

    const hit =

      participants.find((p) => p?.id === uRaw) ||

      participants.find((p) => normalizeJidLike(p?.id) === uNorm) ||

      participants.find((p) => bareId(p?.id) === uBare);

    const role = hit?.admin || null; // "admin" | "superadmin" | undefined

    const isAdmin = role === "admin" || role === "superadmin";

    return { isAdmin, role: isAdmin ? role : null, matchedId: hit?.id || null };

  } catch {

    return { isAdmin: false, role: null, matchedId: null };

  }

}

/**

 * Boolean admin check (keeps your old API).

 */

export async function isAdmin(sock, groupJid, userJid, cachedMeta = null) {

  const info = await getAdminInfo(sock, groupJid, userJid, cachedMeta);

  return info.isAdmin;

}

/**

 * Check if the bot is admin in the group.

 */

export async function isBotAdmin(sock, groupJid, cachedMeta = null) {

  const botJid = sock?.user?.id;

  if (!botJid) return false;

  return isAdmin(sock, groupJid, botJid, cachedMeta);

}