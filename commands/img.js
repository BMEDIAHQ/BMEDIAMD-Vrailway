const MODEL="@cf/black-forest-labs/flux-2-klein-4b";
function box(t,a){return [`╭─〔 ${t} 〕`,...a.map((x,i)=>`${i===a.length-1?"╰":"├"}◦ ${x}`),"","> POWERED BY BMEDIA"].join("\n")}
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
 name:"img",aliases:["imagine","imageai"],category:"AI",description:"Generate AI images with Cloudflare Workers AI.",
 async execute(ctx){
  const {sock,m,from}=ctx; const prompt=String(ctx?.args?.join?.(" ")||"").trim();
  if(!prompt) return sock.sendMessage(from,{text:box("*IMAGE AI*",["Usage: .img <prompt>","Example: .img a futuristic city at night"])},{quoted:m});
  try{
   try{await sock.sendMessage(from,{react:{text:"🎨",key:m.key}})}catch{}
   const f=new FormData(); f.append("prompt",prompt); f.append("width","1024"); f.append("height","1024");
   const image=await run(f);
   const sent=await sock.sendMessage(from,{image,caption:box("*BMEDIA IMAGE AI*",[`Prompt: ${prompt.slice(0,180)}`])},{quoted:m});
   try{await sock.sendMessage(from,{react:{text:"✅",key:m.key}})}catch{}
   return sent;
  }catch(e){try{await sock.sendMessage(from,{react:{text:"❌",key:m.key}})}catch{} return sock.sendMessage(from,{text:box("*IMAGE AI ERROR*",[String(e?.message||e).slice(0,700)])},{quoted:m})}
 }
};
