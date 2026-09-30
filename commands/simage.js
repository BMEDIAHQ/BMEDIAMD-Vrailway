import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import WebP from "node-webpmux";

function box(title, lines) {
  return [
    `╭─〔 ${title} 〕`,
    ...lines.map((x, i) => `${i === lines.length - 1 ? "╰" : "├"}◦ ${x}`),
    "",
    "> POWERED BY BMEDIA"
  ].join("\n");
}

const quoted=m=>m?.message?.extendedTextMessage?.contextInfo?.quotedMessage||null;
async function toBuffer(s){const a=[];for await(const c of s)a.push(Buffer.from(c));return Buffer.concat(a);}

export default {
  name:"simage", aliases:["photo"], category:"TOOLS",
  description:"Convert a STATIC sticker to an image. Use asvideo for animated stickers.",
  async execute({sock,m,from}){
    const q=quoted(m);
    if(!q?.stickerMessage)
      return sock.sendMessage(from,{text:box("*SIMAGE USAGE*",["Reply to a static sticker with: simage","Use *asvideo* to convert an animated sticker to video."])},{quoted:m});
    try{
      const stream=await downloadContentFromMessage(q.stickerMessage,"sticker");
      const buf=await toBuffer(stream);
      const img=new WebP.Image(); await img.load(buf);
      if(img.hasAnim)
        return sock.sendMessage(from,{text:box("*SIMAGE*",["Animated sticker detected.","Use *asvideo* to convert animated sticker to video."])},{quoted:m});
      const staticWebp=await img.save(null);
      return sock.sendMessage(from,{image:staticWebp,caption:"converted by BMEDIA-MD"},{quoted:m});
    }catch(e){
      return sock.sendMessage(from,{text:box("*SIMAGE ERROR*",[String(e?.message||e).slice(0,700)])},{quoted:m});
    }
  }
};
