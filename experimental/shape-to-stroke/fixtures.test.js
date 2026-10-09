"use strict";
const fs=require("node:fs"),vm=require("node:vm"),test=require("node:test"),assert=require("node:assert/strict");
function context() {const c=vm.createContext({});for(const f of ["circular.jsxinc","outlines.jsxinc","geometry.jsxinc","fixtures.jsxinc"])vm.runInContext(fs.readFileSync(__dirname+"/"+f,"utf8"),c);return c;}
const entries=vm.runInContext("PedroStrokeFixtures.catalog()",context());
test("catalog exposes 48 READY and 25 SKIP cases with unique names",()=>{
  assert.equal(entries.filter(e=>e.expected).length,48);assert.equal(entries.filter(e=>!e.expected).length,25);assert.equal(new Set(entries.map(e=>e.name)).size,73);
});
for(let i=0;i<entries.length;i++)test(`fixture catalog: ${entries[i].name}`,()=>{
  const c=context();
  const run=()=>vm.runInContext(`var e=PedroStrokeFixtures.catalog()[${i}];e.parametric ? PedroStrokeGeometry.rectangle(e.options.size || [200,20],e.options.center || [10,-5],typeof e.options.roundness==="number" ? e.options.roundness : (e.rounded ? Math.min.apply(Math,e.options.size || [200,20])/2 : 0)) : e.options.extraPath ? PedroStrokeOutlines.compound([e.options.data,e.options.extraPath],e.options.fillRule || 1) : PedroStrokeGeometry.recognize(e.options.data || PedroStrokeGeometry.fixture(200,20,e.rounded,e.angle,[10,-5]));`,c);
  if(entries[i].expected) {const result=run();assert.ok(result.width>0 && result.pathLength>0);}
  else assert.throws(run);
});
