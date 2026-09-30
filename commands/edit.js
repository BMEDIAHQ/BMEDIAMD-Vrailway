import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { downloadContentFromMessage } from "@whiskeysockets/baileys";

const MODEL="@cf/black-forest-labs/flux-2-klein-4b";
function box(t,a){return [`╭─〔 ${t} 〕`,...a.map((x,i)=>`${i===a.length-1?"╰":"├"}◦ ${x}`),"","> POWERED BY BMEDIA"].join("\n")}
function q(m){return m?.message?.extendedTextMessage?.contextInfo?.quotedMessage||null}
async function buf(s){const a=[];for await(const c of s)a.push(Buffer.from(c));return Buffer.concat(a)}
function runFF(args){return new Promise((ok,no)=>{const p=spawn("ffmpeg",args,{stdio:["ignore","ignore","pipe"]});const e=[];p.stderr.on("data",c=>e.push(Buffer.from(c)));p.on("error",no);p.on("close",c=>c===0?ok():no(new Error(Buffer.concat(e).toString().trim()||`ffmpeg exited ${c}`)))})}
async function run(form){
 const id=String(process.env.CLOUDFLARE_ACCOUNT_ID||"").trim();
 const token=String(process.env.CLOUDFLARE_AI_TOKEN||"").trim();
 if(!id||!token) throw new Error("Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_AI_TOKEN in .env");
 const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${id}/ai/run/${MODEL}`,{method:"POST",headers:{Authorization:`Bearer ${token}`},body:form});
 const type=String(r.headers.get("content-type")||"");
 if(!r.ok){let x="";try{x=type.includes("json")?JSON.stringify(await r.json()):await r.text()}catch{} throw new Error(`Cloudflare ${r.status}: ${x.slice(0,500)}`)}
 if(type.startsWith("image/")) return Buffer.from(await r.arrayBuffer());
 const j=await r.json(); const b64=j?.result?.image||j?.image;
 if(!b64) throw new Error("Cloudflare returned no image.");
 return Buffer.from(String(b64).split(",").pop(),"base64");
}
export default {
 name:"edit",aliases:["imgedit","editimg"],category:"AI",description:"Edit a replied image with Cloudflare Workers AI.",
 async execute(ctx){
  const {sock,m,from}=ctx; const prompt=String(ctx?.args?.join?.(" ")||"").trim(); const quoted=q(m);
  if(!quoted?.imageMessage) return sock.sendMessage(from,{text:box("*AI IMAGE EDIT*",["Reply to an image.","Usage: .edit <instruction>","Example: .edit change the sky to sunset"])},{quoted:m});
  if(!prompt) return sock.sendMessage(from,{text:box("*AI IMAGE EDIT*",["Tell me what to change.","Example: .edit remove the background"])},{quoted:m});
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"bmedia_edit_")); const inp=path.join(dir,"in.jpg"); const out=path.join(dir,"ref.png");
  try{
   try{await sock.sendMessage(from,{react:{text:"🎨",key:m.key}})}catch{}
   const s=await downloadContentFromMessage(quoted.imageMessage,"image"); fs.writeFileSync(inp,await buf(s));
   await runFF(["-y","-loglevel","error","-i",inp,"-vf","scale='min(511,iw)':'min(511,ih)':force_original_aspect_ratio=decrease","-frames:v","1",out]);
   const ref=fs.readFileSync(out); const f=new FormData(); f.append("prompt",prompt); f.append("input_image_0",new Blob([ref],{type:"image/png"}),"reference.png"); f.append("width","1024"); f.append("height","1024");
   const image=await run(f);
   const sent=await sock.sendMessage(from,{image,caption:box("*BMEDIA AI EDIT*",[`Edit: ${prompt.slice(0,180)}`])},{quoted:m});
   try{await sock.sendMessage(from,{react:{text:"✅",key:m.key}})}catch{}
   return sent;
  }catch(e){try{await sock.sendMessage(from,{react:{text:"❌",key:m.key}})}catch{} return sock.sendMessage(from,{text:box("*AI EDIT ERROR*",[String(e?.message||e).slice(0,700)])},{quoted:m})}
  finally{try{fs.rmSync(dir,{recursive:true,force:true})}catch{}}
 }
};
