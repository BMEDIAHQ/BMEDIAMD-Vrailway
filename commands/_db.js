import fs from "fs";import path from "path";
export function ensureDataFile(relPath, defaultValue){const dataDir=path.resolve(process.cwd(),"data");if(!fs.existsSync(dataDir))fs.mkdirSync(dataDir,{recursive:true});
const file=path.join(dataDir,relPath);if(!fs.existsSync(file))fs.writeFileSync(file,JSON.stringify(defaultValue,null,2));return file;}
export function readJson(file,fallback={}){try{return JSON.parse(fs.readFileSync(file,'utf8')||'');}catch{return fallback;}}
export function writeJson(file,obj){fs.writeFileSync(file,JSON.stringify(obj,null,2));}
