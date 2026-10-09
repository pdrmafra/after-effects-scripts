const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");
const source=fs.readFileSync(path.join(__dirname,"../depth-map/jsx/DepthMapStatic.jsx"),"utf8");
function helpers(){
  const c=vm.createContext({});
  vm.runInContext(`function File(s){this.fsName=String(s);this.parent={fsName:"/tool/jsx",parent:{fsName:"/tool"}};}var $={fileName:"/tool/jsx/DepthMapStatic.jsx"};`,c);
  vm.runInContext(source.replace("    createWindow().show();","    depthTest={shellQuote:shellQuote,parseNumberField:parseNumberField,buildCommand:buildCommand,buildSequenceCommand:buildSequenceCommand};"),c);
  return c;
}
test("depth launcher is valid JavaScript",()=>{assert.doesNotThrow(()=>new vm.Script(source));});
test("shell quoting keeps spaces, apostrophes and shell metacharacters literal",()=>{
  const c=helpers();
  const input="/tmp/Pedro's file $(touch danger).png";
  c.input=input;
  assert.equal(vm.runInContext("depthTest.shellQuote(input)",c),"'/tmp/Pedro'\\''s file $(touch danger).png'");
});
test("UI does not silently accept malformed numeric fields",()=>{
  const c=helpers();
  assert.ok(Number.isNaN(vm.runInContext('depthTest.parseNumberField({text:"2abc"},2)',c)));
  assert.equal(vm.runInContext('depthTest.parseNumberField({text:"1,5"},2)',c),1.5);
});
test("sequence launcher checks completion marker and exact frame count",()=>{
  assert.match(source,/!completed\.exists \|\| frames\.length !== expectedFrames/);
  assert.doesNotMatch(source,/Folder\.temp/);
  assert.match(source,/isSequence && sequenceBackend === "vda" && !vdaCheckpointFile\.exists/);
});
