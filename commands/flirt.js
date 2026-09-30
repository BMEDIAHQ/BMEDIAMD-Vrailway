// commands/pickupline.js
// Random pickup line via David Cyril API

async function fetchJson(url) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "user-agent": "BMEDIA-MD/PickupLine",
      accept: "application/json",
    },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`API error: ${res.status} ${res.statusText}${txt ? ` - ${txt.slice(0, 120)}` : ""}`);
  }

  return res.json();
}

export default {
  name: "flirt",
  aliases: ["pickupline", "rizzline"],
  category: "FUN",
  description: "Get a random pickup line.",
  usage: "pickupline",

  async execute(ctx) {
    const { sock, m, from } = ctx;

    try {
      const endpoint = "https://apis.davidcyril.name.ng/pickupline?apikey";
      const data = await fetchJson(endpoint);

      if (!data?.success || data?.status !== 200 || !data?.pickupline) {
        throw new Error("Failed to fetch pickup line.");
      }

      const line = String(data.pickupline || "").trim();
      if (!line) {
        throw new Error("Pickup line is empty.");
      }

      return sock.sendMessage(
        from,
        { text: `💘 *Pickup Line* 💘\n\n${line}` },
        { quoted: m }
      );
    } catch (e) {
      return sock.sendMessage(
        from,
        { text: `❌ ${e?.message || e}` },
        { quoted: m }
      );
    }
  },
};
