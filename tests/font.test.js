const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");
function setup() {
  const context=vm.createContext({});
  vm.runInContext(`function CompItem(){}; var app={}; function alert(m){throw Error(m);}`,context);
  const source=fs.readFileSync(path.join(__dirname,"../src/font-inspector.jsxinc"),"utf8");
  assert.ok(source.includes("        run();"));
  vm.runInContext(source.replace("        run();","        fontTest={inspectComp:inspectComp,buildReport:buildReport,formatTime:formatTime,inspectTextDocument:inspectTextDocument};"),context);
  vm.runInContext(`function stats(){return {textLayers:0,compsInspected:0,skippedCycles:0,errors:[],usedFallback:false,rangeErrors:0,expressionLayers:0};}`,context);
  return context;
}
function evaluate(code) { return JSON.parse(JSON.stringify(vm.runInContext(code,setup()))); }
test("timestamp carries correctly into minutes and hours",()=>{
  assert.deepEqual(evaluate(`[fontTest.formatTime(59.9996),fontTest.formatTime(3599.9996),fontTest.formatTime(-0.5)];`),["00:01:00.000","01:00:00.000","-00:00:00.500"]);
});
test("mixed-font runs use canonical PostScript font names",()=>{
  assert.deepEqual(evaluate(`var map={},order=[],s=stats(); var layer={index:1,name:"Text",containingComp:{time:0}}; var td={text:"AB",characterRange:function(a,b){return {font:a?"Font-B":"Font-A",text:this.text.slice(a,b)};}}; fontTest.inspectTextDocument(td,"Comp",layer,0,"current",map,order,s); [order,s.usedFallback,s.rangeErrors,map[order[0]].occurrences[0].rangeLabel];`),[["$Font-A","$Font-B"],false,0,"0-1"]);
});
test("old AE fallback is explicitly reported",()=>{
  assert.deepEqual(evaluate(`var map={},order=[],s=stats(); fontTest.inspectTextDocument({text:"AB",font:"Font-A"},"Comp",{index:1,name:"Text",containingComp:{}},0,"current",map,order,s); [order,s.usedFallback];`),[["$Font-A"],true]);
});
test("partial character-range failures are not presented as a complete inventory",()=>{
  const result=evaluate(`var map={},order=[],s=stats(); var td={text:"AB",characterRange:function(a,b){if(a)throw Error("range unavailable");return {font:"Font-A",text:"A"};}}; fontTest.inspectTextDocument(td,"Comp",{index:1,name:"Text",containingComp:{}},0,"current",map,order,s); [s.rangeErrors,fontTest.buildReport({name:"Comp"},map,order,s)];`);
  assert.equal(result[0],1); assert.match(result[1],/inventory is incomplete/);
});
test("cyclic precomp references terminate safely",()=>{
  assert.deepEqual(evaluate(`var c=new CompItem(); c.id=1;c.name="Cycle";c.numLayers=1;c.layer=function(){return {index:1,name:"Recursive",source:c,property:function(){return null;}};};var s=stats();fontTest.inspectComp(c,c.name,{}, {}, [],s); [s.compsInspected,s.skippedCycles,s.errors.length];`),[1,1,1]);
});
