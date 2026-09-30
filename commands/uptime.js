import { humanUptime } from "./_utils.js";
export default {name:"uptime",aliases:[],category:"INFO",description:"Show bot uptime.",
async execute(ctx){const {sock,m,from}=ctx;const up=humanUptime(process.uptime()*1000);return sock.sendMessage(from,{text:`⏱️ Uptime: ${up}`},{quoted:m});}};
