import { ensureDataFile, readJson } from "./_db.js";import { isGroup, normalizeDigits } from "./_utils.js";
const FILE=ensureDataFile("warnings.json",{});
function getTarget(m,args){const mentioned=m?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]; if(mentioned) return mentioned; const d=normalizeDigits(args?.[0]||""); return d?`${d}@s.whatsapp.net`:"";}
export default {name:"warnings",aliases:["warns"],category:"GROUP",description:"Check warnings for a user.",
async execute(ctx){const {sock,m,from,args}=ctx; if(!isGroup(from)) return sock.sendMessage(from,{text:"Groups only."},{quoted:m});
const target=getTarget(m,args); if(!target) return sock.sendMessage(from,{text:"Mention a user or provide number."},{quoted:m});
const db=readJson(FILE,{}); const n=db?.[from]?.[target]||0;
return sock.sendMessage(from,{text:`Warnings for @${target.split("@")[0]}: ${n}`,mentions:[target]},{quoted:m});}};
