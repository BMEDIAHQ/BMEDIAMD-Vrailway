import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import WebP from "node-webpmux";

const MAX_VIDEO_SECONDS = 8;
const PACK_NAME = "BMEDIA-MD";
const PACK_AUTHOR = "BMEDIA";
const tmp = ext => path.join(os.tmpdir(), `bmedia_${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`);
const quoted = m => m?.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;

function box(title, lines) {
  return [
    `╭─〔 ${title} 〕`,
    ...lines.map((x, i) => `${i === lines.length - 1 ? "╰" : "├"}◦ ${x}`),
    "",
    "> POWERED BY BMEDIA"
  ].join("\n");
}

async function toBuffer(stream){const a=[];for await(const c of stream)a.push(Buffer.from(c));return Buffer.concat(a);}

function run(args){
  return new Promise((resolve,reject)=>{
    const esc=args.map(v=>`'${String(v).replace(/'/g, `'\\''`)}'`).join(" ");
    const p=spawn("bash",["-lc",`ulimit -c 0; exec ffmpeg ${esc}`],{stdio:["ignore","ignore","pipe"]});
    const e=[]; p.stderr.on("data",c=>e.push(Buffer.from(c))); p.on("error",reject);
    p.on("close",code=>code===0?resolve():reject(new Error(Buffer.concat(e).toString().trim()||`ffmpeg exited ${code}`)));
  });
}

function exif(){
  const json=Buffer.from(JSON.stringify({
    "sticker-pack-id":"bmedia-md",
    "sticker-pack-name":PACK_NAME,
    "sticker-pack-publisher":PACK_AUTHOR,
    emojis:[""]
  }));
  const h=Buffer.from([0x49,0x49,0x2a,0,8,0,0,0,1,0,0x41,0x57,7,0,0,0,0,0,0x16,0,0,0]);
  h.writeUIntLE(json.length,14,4);
  return Buffer.concat([h,json]);
}

async function brand(buf){
  const img=new WebP.Image();
  await img.load(buf);
  img.exif=exif();
  return img.save(null);
}

export default {
  name:"sticker", aliases:["s","st"], category:"TOOLS",
  description:"Convert an image or video up to 8 seconds into a BMEDIA-MD sticker.",
  async execute({sock,m,from}){
    const q=quoted(m);
    if(!q) return sock.sendMessage(from,{text:box("*STICKER*",["Reply to an image or video.","Video maximum: 8 seconds."])},{quoted:m});
    let input="",output="";
    try{
      let type,msg,stream;
      if(q.imageMessage){type="image";msg=q.imageMessage;stream=await downloadContentFromMessage(msg,"image");}
      else if(q.videoMessage){type="video";msg=q.videoMessage;stream=await downloadContentFromMessage(msg,"video");}
      else return sock.sendMessage(from,{text:box("*STICKER*",["Reply to an image or video only."])},{quoted:m});

      const sec=Number(msg.seconds||0);
      if(type==="video" && sec>MAX_VIDEO_SECONDS)
        return sock.sendMessage(from,{text:box("*STICKER*",[`Video length: ${sec}s`,`Maximum allowed: ${MAX_VIDEO_SECONDS}s.`])},{quoted:m});

      const buf=await toBuffer(stream);
      input=tmp(type==="video"?"mp4":"jpg"); output=tmp("webp"); fs.writeFileSync(input,buf);
      const base="scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000";
      const args=type==="video"
        ?["-y","-i",input,"-t","8","-vf",`${base},fps=15`,"-an","-c:v","libwebp","-q:v","70","-compression_level","4","-loop","0","-vsync","0",output]
        :["-y","-i",input,"-vf",base,"-frames:v","1","-c:v","libwebp","-q:v","80","-compression_level","4",output];
      await run(args);
      const raw=fs.readFileSync(output);
      if(raw.length<100)throw new Error("Sticker conversion produced empty output.");
      const branded=await brand(raw);
      return sock.sendMessage(from,{sticker:branded},{quoted:m});
    }catch(e){
      return sock.sendMessage(from,{text:box("*STICKER ERROR*",[String(e?.message||e).slice(0,700)])},{quoted:m});
    }finally{
      if(input)try{fs.unlinkSync(input)}catch{}
      if(output)try{fs.unlinkSync(output)}catch{}
    }
  }
};
