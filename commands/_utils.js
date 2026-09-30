export const isGroup = (jid='') => typeof jid === 'string' && jid.endsWith('@g.us');
export function normalizeDigits(s='') { return String(s || '').replace(/[^0-9]/g, ''); }
export async function getGroupAdmins(sock, groupJid) {
  const meta = await sock.groupMetadata(groupJid);
  const admins = new Set((meta.participants||[]).filter(p=>p.admin==='admin'||p.admin==='superadmin').map(p=>p.id));
  return { meta, admins };
}
export function isBotAdmin(sock, admins) {
  const id = sock?.user?.id || '';
  const botJid = id.includes(':') ? id.split(':')[0] + '@s.whatsapp.net' : id;
  return admins.has(botJid);
}
export function isSenderAdmin(sender, admins) { return admins.has(sender); }
export function safeMathEval(expr) {
  const ok = /^[0-9\s+\-*/().]+$/.test(expr);
  if(!ok) throw new Error('Invalid characters');
  if(expr.length > 80) throw new Error('Expression too long');
  // eslint-disable-next-line no-new-func
  const fn = new Function(`return (${expr})`);
  const val = fn();
  if(!Number.isFinite(val)) throw new Error('Non-finite result');
  return val;
}
export function humanUptime(ms){
  const s = Math.floor(ms/1000);
  const d = Math.floor(s/86400);
  const h = Math.floor((s%86400)/3600);
  const m = Math.floor((s%3600)/60);
  const sec = s%60;
  const parts = [];
  if(d) parts.push(`${d}d`);
  if(h) parts.push(`${h}h`);
  if(m) parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(' ');
}
