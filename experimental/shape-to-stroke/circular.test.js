"use strict";
const fs=require("node:fs"),vm=require("node:vm"),test=require("node:test"),assert=require("node:assert/strict");
function run(source) {
  const c=vm.createContext({});
  for(const f of ["circular.jsxinc","outlines.jsxinc","geometry.jsxinc","fixtures.jsxinc"]) vm.runInContext(fs.readFileSync(__dirname+"/"+f,"utf8"),c);
  return JSON.parse(JSON.stringify(vm.runInContext(source,c)));
}
function near(a,b){assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);}
for(const sweep of [Math.PI/6,Math.PI/2,Math.PI,1.5*Math.PI,-Math.PI/3,-1.5*Math.PI])test(`arc reconstructs exact radius / width / sweep ${sweep}`,()=>{
  const m=run(`PedroStrokeCircular.arc(PedroStrokeFixtures.translate(PedroStrokeFixtures.band(85,55,0.27,${sweep}),[12,-8]));`);
  near(m.width,30);near(m.center[0],12);near(m.center[1],-8);near(m.pathLength,Math.abs(sweep)*70);
  assert.equal(m.closed,false);assert.equal(m.cap,1);
  for(const p of m.vertices)near(Math.hypot(p[0]-12,p[1]+8),70);
});
test("ring preserves outer first vertex and selects outer contour irrespective of order",()=>{
  const m=run(`PedroStrokeCircular.ring([PedroStrokeFixtures.ellipse(110,110),PedroStrokeFixtures.reverse(PedroStrokeFixtures.ellipse(160,160))],1);`);
  near(m.width,25);near(m.pathLength,2*Math.PI*67.5);assert.equal(m.closed,true);near(m.vertices[0][0],-67.5);near(m.vertices[0][1],0);
});
for(const type of ["ring","arc","line"])test(`reverse swaps handles, preserves closed seam and is an involution: ${type}`,()=>{
  const expr=type==="ring" ? "PedroStrokeCircular.ring([PedroStrokeFixtures.ellipse(160,160),PedroStrokeFixtures.reverse(PedroStrokeFixtures.ellipse(110,110))],1)" : type==="arc" ? "PedroStrokeCircular.arc(PedroStrokeFixtures.band(85,55,.2,Math.PI))" : "PedroStrokeGeometry.rectangle([200,20],[0,0],0)";
  const [forward,reverse,twice]=run(`var m=${expr};var f=PedroStrokeCircular.path(m,false),r=PedroStrokeCircular.path(m,true);[f,r,PedroStrokeCircular.path(r,true)];`);
  assert.deepEqual(twice,forward);
  assert.deepEqual(reverse.vertices[0],forward.vertices[forward.closed ? 0 : forward.vertices.length-1]);
  assert.deepEqual(reverse.inTangents[0],forward.outTangents[forward.closed ? 0 : forward.vertices.length-1]);
});
test("reject doubled ring traversal even with circular vertices and handles",()=>{
  assert.throws(()=>run(`var a=PedroStrokeFixtures.ellipse(160,160);for(var key in a)if(key!=="closed")a[key]=a[key].concat(a[key]);PedroStrokeCircular.ring([a,PedroStrokeFixtures.reverse(PedroStrokeFixtures.ellipse(110,110))],1);`),/topology/);
});
test("reject distorted circular handles",()=>{
  assert.throws(()=>run(`var a=PedroStrokeFixtures.ellipse(160,160);a.outTangents[0][0]*=1.01;PedroStrokeCircular.ring([a,PedroStrokeFixtures.reverse(PedroStrokeFixtures.ellipse(110,110))],1);`));
});
test("reject unknown fill rule, open inner contour and invalid coordinates",()=>{
  for(const alteration of ["var rule=9;","var rule=1;b.closed=false;","var rule=1;b.vertices[0][0]=NaN;"])
    assert.throws(()=>run(`var a=PedroStrokeFixtures.ellipse(160,160),b=PedroStrokeFixtures.reverse(PedroStrokeFixtures.ellipse(110,110));${alteration}PedroStrokeCircular.ring([a,b],rule);`));
});
test("finite coordinates causing arithmetic overflow are rejected",()=>{
  assert.throws(()=>run(`PedroStrokeCircular.ring([PedroStrokeFixtures.ellipse(1e308,1e308),PedroStrokeFixtures.reverse(PedroStrokeFixtures.ellipse(8e307,8e307))],1);`),/non-finite/);
});
