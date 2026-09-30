import { ensureDataFile, readJson, writeJson } from "./_db.js";
import { isGroup, getGroupAdmins, isBotAdmin, isSenderAdmin, normalizeDigits } from "./_utils.js";
const FILE=ensureDataFile("warnings.json",{});
function getTarget(m,args){const mentioned=m?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]; if(mentioned) return mentioned; const d=normalizeDigits(args?.[0]||""); return d?`${d}@s.whatsapp.net`:"";}
export default {name:"resetwarn",aliases:["rw"],category:"GROUP",description:"Reset warnings (admins only).",
async execute(ctx){const {sock,m,from,sender,args}=ctx; if(!isGroup(from)) return sock.sendMessage(from,{text:"Groups only."},{quoted:m});
const {admins}=await getGroupAdmins(sock,from); if(!isSenderAdmin(sender,admins)) return sock.sendMessage(from,{text:"Admins only."},{quoted:m});
if(!isBotAdmin(sock,admins)) return sock.sendMessage(from,{text:"Make the bot admin first."},{quoted:m});
const target=getTarget(m,args); if(!target) return sock.sendMessage(from,{text:"Mention a user or provide number."},{quoted:m});
const db=readJson(FILE,{}); db[from] ||= {}; db[from][target]=0; writeJson(FILE,db);
return sock.sendMessage(from,{text:`✅ Warnings reset for @${target.split("@")[0]}`,mentions:[target]},{quoted:m});}};
