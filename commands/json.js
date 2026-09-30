import { Buffer } from "buffer";

function qtext(m){const q=m?.message?.extendedTextMessage?.contextInfo?.quotedMessage;return q?.conversation||q?.extendedTextMessage?.text||""}
function safe(n){return String(n||"").replace(/[\\/:*?"<>|]/g,"_").replace(/^\.+/,"").trim().slice(0,120)}
function box(t,a){return [`╭─〔 ${t} 〕`,...a.map((x,i)=>`${i===a.length-1?"╰":"├"}◦ ${x}`),"","> POWERED BY BMEDIA"].join("\n")}

export default {
 name:"json",aliases:[],category:"TOOLS",description:"Create a .json file from text.",
 async execute(ctx){
  const {sock,m,from}=ctx; const qt=qtext(m).trim(); const raw=String(ctx?.args?.join?.(" ")||"").trim();
  let name="",body="";
  if(qt){name=safe(raw)||"bmedia";body=qt;}
  else if(raw){const p=raw.search(/\s/);if(p<0){name=safe(raw);}else{name=safe(raw.slice(0,p));body=raw.slice(p).trimStart();}}
  if(!name)name="bmedia"; if(!name.toLowerCase().endsWith(".json"))name+=".json";
  if(!body)return sock.sendMessage(from,{text:box("*JSON*",["Reply to text: .json filename","Or: .json filename <content>","Default: bmedia.json"])},{quoted:m});
  return sock.sendMessage(from,{document:Buffer.from(body),fileName:name,mimetype:"application/json"},{quoted:m});
 }
};
