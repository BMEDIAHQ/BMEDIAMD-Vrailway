import { Buffer } from "buffer";

function qtext(m){const q=m?.message?.extendedTextMessage?.contextInfo?.quotedMessage;return q?.conversation||q?.extendedTextMessage?.text||""}
function safe(n){return String(n||"").replace(/[\\/:*?"<>|]/g,"_").replace(/^\.+/,"").trim().slice(0,120)}
function box(t,a){return [`╭─〔 ${t} 〕`,...a.map((x,i)=>`${i===a.length-1?"╰":"├"}◦ ${x}`),"","> POWERED BY BMEDIA"].join("\n")}

export default {
 name:"js",aliases:[],category:"TOOLS",description:"Create a .js file from text.",
 async execute(ctx){
  const {sock,m,from}=ctx; const qt=qtext(m).trim(); const raw=String(ctx?.args?.join?.(" ")||"").trim();
  let name="",body="";
  if(qt){name=safe(raw)||"bmedia";body=qt;}
  else if(raw){const p=raw.search(/\s/);if(p<0){name=safe(raw);}else{name=safe(raw.slice(0,p));body=raw.slice(p).trimStart();}}
  if(!name)name="bmedia"; if(!name.toLowerCase().endsWith(".js"))name+=".js";
  if(!body)return sock.sendMessage(from,{text:box("*JS*",["Reply to text: .js filename","Or: .js filename <content>","Default: bmedia.js"])},{quoted:m});
  return sock.sendMessage(from,{document:Buffer.from(body),fileName:name,mimetype:"text/javascript"},{quoted:m});
 }
};
