"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");
const root = path.join(__dirname, "..");
function context() {
  const c = vm.createContext({});
  for (const file of ["tests/ae-mock.js", "src/core.jsxinc"]) vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"),c);
  return c;
}
function evaluate(code) { return JSON.parse(JSON.stringify(vm.runInContext(code,context()))); }
test("spacing affects selected keys only and preserves untouched keys", () => {
  assert.deepEqual(evaluate(`var p=makeProperty([1,2,3,4],[10,20,30,40],[1,3]); PedroAE.space(fixture([p]),12,false,false); p.keys.map(function(k){return [k.time,k.value,k.selected];});`),[[1,10,true],[1.5,30,true],[2,20,false],[4,40,false]]);
});
test("all-keys mode retains the original spacing-tool scope explicitly", () => {
  assert.deepEqual(evaluate(`var p=makeProperty([1,2,3],[10,20,30],[]); PedroAE.space(fixture([p]),6,false,true); p.keys.map(function(k){return k.time;});`),[1,1.25,1.5]);
});
test("collision cancels all properties before any mutation", () => {
  assert.deepEqual(evaluate(`var a=makeProperty([1,3],[10,30],[1,2]); var b=makeProperty([1,2,3],[10,20,30],[1,3]); var error=""; try{PedroAE.space(fixture([a,b]),24,false,false);}catch(e){error=e.message;} [a.keys.map(function(k){return k.time;}),b.keys.map(function(k){return k.time;}),error.indexOf("overwrite")>=0,app.groups];`),[[1,3],[1,2,3],true,0]);
});
test("current-time spacing supports a single selected key", () => {
  assert.deepEqual(evaluate(`var p=makeProperty([1],[10],[1]); var c=fixture([p]); c.time=5; PedroAE.space(c,2,true,false); [p.keyTime(1),app.groups];`),[5,0]);
});
test("29.97 fps uses exact composition frame duration", () => {
  const times=evaluate(`var p=makeProperty([1,3],[10,30],[1,2]); PedroAE.space(fixture([p],29.97),10,false,false); [p.keyTime(1),p.keyTime(2)];`);
  assert.ok(Math.abs(times[1]-(1+10/29.97))<1e-12);
});
for (const invalid of ["2abc","0","-1","1.5","NaN","Infinity",""]) test(`reject interval ${JSON.stringify(invalid)}`,()=>{
  assert.throws(()=>evaluate(`PedroAE.frameInterval(${JSON.stringify(invalid)});`),/whole number/);
});
for (const flag of ["roving","auto","continuous"]) test(`timing preflight rejects ${flag}`,()=>{
  assert.throws(()=>evaluate(`var p=makeProperty([1,3],[10,30],[1,2],true); p.keys[0].${flag}=true; PedroAE.space(fixture([p]),2,false,false);`),/Disable/);
});
test("disabled expressions are rejected too",()=>{
  assert.throws(()=>evaluate(`var p=makeProperty([1,3],[10,30],[1,2]); p.expression="value"; PedroAE.space(fixture([p]),2,false,false);`),/expressions/);
});
test("step supports 3 selected keys without index drift and pre-samples the original",()=>{
  const result=evaluate(`var p=makeProperty([0,1,2],[0,1,4],[1,2,3]); PedroAE.step(fixture([p]),12,false); [p.keys.map(function(k){return [k.time,k.value];}),p.sampleCounts,app.groups];`);
  assert.deepEqual(result,[[[0,0],[0.5,0.25],[1,1],[1.5,2.25],[2,4]],[3,3],0]);
});
test("step never overwrites an existing unselected sample key",()=>{
  assert.deepEqual(evaluate(`var p=makeProperty([0,0.5,1],[0,99,1],[1,3]); PedroAE.step(fixture([p]),6,false); p.keys.map(function(k){return [k.time,k.value];});`),[[0,0],[0.25,0.0625],[0.5,99],[0.75,0.5625],[1,1]]);
});
test("hold mode changes only keys inside the selected intervals",()=>{
  assert.deepEqual(evaluate(`var p=makeProperty([-1,0,1,2],[8,0,1,9],[2,3]); PedroAE.step(fixture([p]),12,true); p.keys.map(function(k){return [k.time,k.outType];});`),[[-1,1],[0,3],[0.5,3],[1,1],[2,1]]);
});
test("copy restores interpolation after an ease setter and preserves labels/tangents",()=>{
  assert.deepEqual(evaluate(`var p=makeProperty([0,1],[[0,0],[10,10]],[1,2],true); p.keys[0].label=7; p.keys[0].outTangent=[3,2]; var data=PedroAE.snapshot(p); PedroAE.write(p,data); PedroAE.verify(p,data); [p.keys[0].outType,p.keys[0].label,p.keys[0].outTangent];`),[1,7,[3,2]]);
});
test("failure on a later property restores earlier properties and closes Undo",()=>{
  assert.deepEqual(evaluate(`var a=makeProperty([1,3],[10,30],[1,2]); var b=makeProperty([1,3],[20,40],[1,2]); var original=b.setValueAtKey, once=true; b.setValueAtKey=function(i,v){if(once){once=false;throw new Error("injected");}original.call(this,i,v);}; try{PedroAE.space(fixture([a,b]),6,false,false);}catch(e){} [a.keys.map(function(k){return k.time;}),b.keys.map(function(k){return k.time;}),app.groups];`),[[1,3],[1,3],0]);
});
test("HOLD-only text keys preserve zero ease influence without constructing invalid easing",()=>{
  assert.deepEqual(evaluate(`var p=makeProperty([0,1],["A","B"],[1,2]); p.propertyValueType=PropertyValueType.TEXT_DOCUMENT; for(var i=0;i<2;i++){p.keys[i].inType=3;p.keys[i].outType=3;p.keys[i].inEase=[[0,0]];p.keys[i].outEase=[[0,0]];} PedroAE.space(fixture([p]),12,false,false); [p.keyTime(2),p.keyValue(2),p.keys[1].inEase];`),[0.5,"B",[[0,0]]]);
});
test("spatial APIs follow value type rather than AE's unreliable isSpatial flag",()=>{
  assert.deepEqual(evaluate(`var p=makeProperty([0,1],[10,20],[1,2]); p.isSpatial=true; p.keyInSpatialTangent=function(){throw new Error("should not be called");}; PedroAE.space(fixture([p]),12,false,false); p.keyTime(2);`),0.5);
});
