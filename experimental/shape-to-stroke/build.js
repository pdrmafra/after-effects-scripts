"use strict";
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const files=["geometry.jsxinc","host.jsxinc","ui.jsxinc"];
const built="// Shape to Stroke 0.0.1-prototype — Pedro Mafra\n// MIT License. Local experimental build; not part of the public beta.\n(function () {\n"+files.map(f=>fs.readFileSync(path.join(__dirname,f),"utf8")).join("\n")+"\n}());\n";
new vm.Script(built,{filename:"Shape-to-Stroke.jsx"});
const target=path.join(__dirname,"Shape-to-Stroke.jsx");
if(process.argv.includes("--check")) {
  if(fs.readFileSync(target,"utf8")!==built) throw new Error("Stale experimental build.");
} else fs.writeFileSync(target,built);
console.log("Shape-to-Stroke prototype "+(process.argv.includes("--check")?"checked":"built"));
