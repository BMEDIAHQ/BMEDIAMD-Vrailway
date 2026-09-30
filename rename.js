import { downloadContentFromMessage } from "@whiskeysockets/baileys";
function box(t,a){return [`╭─〔 ${t} 〕`,...a.map((x,i)=>`${i===a.length-1?"╰":"├"}◦ ${x}`),"","> POWERED BY BMEDIA"].join("\n")}
async function buf(s){const a=[];for await(const c of s)a.push(Buffer.from(c));return Buffer.concat(a)}
export default {name:"rename",aliases:["renamefile"],category:"TOOLS",description:"Rename a replied document.",
async execute(ctx){const {sock,m,from}=ctx;const q=m?.message?.extendedTextMessage?.contextInfo?.quotedMessage;const d=q?.documentMessage;
const n=String(ctx?.args?.join?.(" ")||"").replace(/[\\/:*?"<>|]/g,"_").trim();
if(!d||!n)return sock.sendMessage(from,{text:box("*RENAME FILE*",["Reply to a file: .rename newname.ext"])},{quoted:m});
try{const s=await downloadContentFromMessage(d,"document");const b=await buf(s);return sock.sendMessage(from,{document:b,fileName:n,mimetype:d.mimetype||"application/octet-stream"},{quoted:m});}
catch(e){return sock.sendMessage(from,{text:box("*RENAME ERROR*",[String(e?.message||e).slice(0,600)])},{quoted:m});}}};
