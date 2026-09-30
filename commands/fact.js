const FACTS=["Honey never spoils.", "Octopuses have three hearts.", "A day on Venus is longer than a year on Venus."];
export default {name:"fact",aliases:[],category:"FUN",description:"Random fact.",async execute(ctx){const {sock,m,from}=ctx;const f=FACTS[Math.floor(Math.random()*FACTS.length)];return sock.sendMessage(from,{text:`📚 ${f}`},{quoted:m});}};
