import { safeMathEval } from "./_utils.js";
export default {name:"calc",aliases:["math"],category:"TOOLS",description:"Calculate a simple math expression.",
async execute(ctx){const {sock,m,from,args}=ctx;const expr=(args||[]).join(" ").trim();if(!expr)return sock.sendMessage(from,{text:"Usage: calc 2*(3+4)"},{quoted:m});
try{const val=safeMathEval(expr);return sock.sendMessage(from,{text:`🧮 ${expr} = ${val}`},{quoted:m});}catch(e){return sock.sendMessage(from,{text:`❌ Invalid expression: ${e.message}`},{quoted:m});}}};
