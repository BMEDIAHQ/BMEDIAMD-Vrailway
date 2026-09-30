export default {
    name:"ping",
    aliases:
["p"],
    category:"INFO",
    description:"Check bot responsiveness.",
    
async execute(ctx){
    const {sock,m,from}=ctx;
    const t0=Date.now();
    const msg=await sock.sendMessage(from,{text:"Pinging…"}, {quoted:m});
const ms=Date.now()-t0;
    return sock.sendMessage(from,{text:`Pong! Response time: ${ms}ms`},{quoted:msg});}};
