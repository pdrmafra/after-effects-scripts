"use strict";
const fs=require("node:fs"),vm=require("node:vm"),test=require("node:test"),assert=require("node:assert/strict");
function evaluate(source) {
  const c=vm.createContext({});vm.runInContext(fs.readFileSync(__dirname+"/settings.jsxinc","utf8"),c);
  return JSON.parse(JSON.stringify(vm.runInContext(source,c)));
}
const defaults={originalAction:"disable",animate:false};
for(const action of ["disable","delete"])for(const animate of [false,true])test(`settings roundtrip ${action}/${animate}`,()=>{
  const result=evaluate(`var store={},api={haveSetting:function(s,k){return (s+"/"+k) in store;},getSetting:function(s,k){return store[s+"/"+k];},saveSetting:function(s,k,v){store[s+"/"+k]=v;}};PedroStrokeSettings.write({originalAction:"${action}",animate:${animate}},api);PedroStrokeSettings.read(api);`);
  assert.deepEqual(result,{originalAction:action,animate});
});
for(const reverse of ["0","1"])test(`v1 record with removed Reverse field ${reverse} keeps the other choices`,()=>{
  assert.deepEqual(evaluate(`PedroStrokeSettings.decode("v1|delete|1|${reverse}")`),{originalAction:"delete",animate:true});
});
for(const bad of [null,"","v2|delete|1|1","v2|delete","v2|delete|true","v1|delete|1","v1|delete|true|0","v1|unknown|0|0","v1|delete|1|1|extra","v1|delete|1|1\n","v2|delete|1\n"])test(`settings invalid record ${JSON.stringify(bad)} falls back safely`,()=>assert.deepEqual(evaluate(`PedroStrokeSettings.decode(${JSON.stringify(bad)})`),defaults));
test("missing preference / unavailable API uses non-destructive defaults",()=>{
  assert.deepEqual(evaluate("PedroStrokeSettings.read({haveSetting:function(){return false;}})"),defaults);
  assert.deepEqual(evaluate("PedroStrokeSettings.read({haveSetting:function(){throw new Error('unavailable');}})"),defaults);
});
test("settings write failure is nonfatal and reported only to console",()=>assert.equal(evaluate("PedroStrokeSettings.write({originalAction:'delete'}, {saveSetting:function(){throw new Error('unavailable');}})"),false));
