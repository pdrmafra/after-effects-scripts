"use strict";
const fs=require("node:fs"),vm=require("node:vm"),test=require("node:test"),assert=require("node:assert/strict");
function context() {const c=vm.createContext({});for(const f of ["geometry.jsxinc","fixtures.jsxinc"])vm.runInContext(fs.readFileSync(__dirname+"/"+f,"utf8"),c);return c;}
const entries=vm.runInContext("PedroStrokeFixtures.catalog()",context());
test("catalog exposes twelve READY and eleven SKIP cases with unique names",()=>{
  assert.equal(entries.filter(e=>e.expected).length,12);assert.equal(entries.filter(e=>!e.expected).length,11);assert.equal(new Set(entries.map(e=>e.name)).size,23);
});
for(let i=0;i<entries.length;i++)test(`fixture catalog: ${entries[i].name}`,()=>{
  const c=context();
  const run=()=>vm.runInContext(`var e=PedroStrokeFixtures.catalog()[${i}];e.parametric ? PedroStrokeGeometry.rectangle(e.options.size || [200,20],e.options.center || [10,-5],typeof e.options.roundness==="number" ? e.options.roundness : (e.rounded ? Math.min.apply(Math,e.options.size || [200,20])/2 : 0)) : PedroStrokeGeometry.recognize(e.options.data || PedroStrokeGeometry.fixture(200,20,e.rounded,e.angle,[10,-5]));`,c);
  if(entries[i].expected) {const result=run();assert.ok(result.width>0 && result.pathLength>0);}
  else assert.throws(run);
});
