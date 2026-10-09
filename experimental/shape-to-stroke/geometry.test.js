"use strict";
const fs=require("node:fs"),vm=require("node:vm"),test=require("node:test"),assert=require("node:assert/strict");
function evaluate(source) {
  const c=vm.createContext({});
  for(const f of ["circular.jsxinc","outlines.jsxinc","geometry.jsxinc"])vm.runInContext(fs.readFileSync(__dirname+"/"+f,"utf8"),c);
  return JSON.parse(JSON.stringify(vm.runInContext(source,c)));
}
function near(a,b) { assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`); }
test("parametric rectangle uses butt cap and preserves full length",()=>{
  const m=evaluate("PedroStrokeGeometry.rectangle([200,20],[10,30],0)");
  assert.deepEqual(m.vertices,[[-90,30],[110,30]]); assert.equal(m.width,20);assert.equal(m.cap,1);
});
test("parametric vertical capsule subtracts round caps from center path",()=>{
  const m=evaluate("PedroStrokeGeometry.rectangle([20,200],[10,30],10)");
  assert.deepEqual(m.vertices,[[10,-60],[10,120]]); assert.equal(m.totalLength,200); assert.equal(m.pathLength,180);assert.equal(m.cap,2);
});
for(const rounded of [false,true]) for(const angle of [0,30,90,145,225,270]) {
  test(`${rounded?"capsule":"rectangle"} rotated ${angle}° with translated coordinates`,()=>{
    const m=evaluate(`PedroStrokeGeometry.recognize(PedroStrokeGeometry.fixture(200,20,${rounded},${angle},[123,-45]))`);
    near(m.width,20);near(m.totalLength,200);near(m.pathLength,rounded?180:200);
    assert.equal(m.cap,rounded?2:1);assert.deepEqual(m.center,[123,-45]);
  });
}
test("reversed winding preserves reconstruction",()=>{
  const m=evaluate(`var s=PedroStrokeGeometry.fixture(200,20,true,37,[0,0]);var t=s.inTangents;s.vertices.reverse();s.inTangents=s.outTangents.reverse();s.outTangents=t.reverse();PedroStrokeGeometry.recognize(s);`);
  near(m.width,20);near(m.pathLength,180);
});
test("native-style capsule with duplicate zero-length corner edges is recognized",()=>{
  const m=evaluate(`var s=PedroStrokeGeometry.fixture(200,20,true,0,[0,0]);s.vertices.splice(2,0,s.vertices[2]);s.inTangents.splice(2,0,s.inTangents[2]);s.inTangents[3]=[0,0];s.outTangents.splice(2,0,[0,0]);PedroStrokeGeometry.recognize(s);`);
  near(m.pathLength,180);
});
for(const [name,source,regex] of [
  ["square","PedroStrokeGeometry.rectangle([20,20],[0,0],0)",/axis/],
  ["circle","PedroStrokeGeometry.rectangle([20,20],[0,0],10)",/axis/],
  ["intermediate roundness","PedroStrokeGeometry.rectangle([200,20],[0,0],5)",/corner radius/],
  ["non-finite","PedroStrokeGeometry.rectangle([Infinity,20],[0,0],0)",/non-finite/],
  ["negative size","PedroStrokeGeometry.rectangle([-2,20],[0,0],0)",/size/],
  ["open path","var s=PedroStrokeGeometry.fixture(200,20,false,0,[0,0]);s.closed=false;PedroStrokeGeometry.recognize(s)",/closed/],
  ["trapezoid","var s=PedroStrokeGeometry.fixture(200,20,false,0,[0,0]);s.vertices[1][0]-=10;PedroStrokeGeometry.recognize(s)",/orthogonal/],
  ["crossed quadrilateral","var s=PedroStrokeGeometry.fixture(200,20,false,0,[0,0]);var t=s.vertices[1];s.vertices[1]=s.vertices[2];s.vertices[2]=t;PedroStrokeGeometry.recognize(s)",/orthogonal/],
  ["unequal sides","var s=PedroStrokeGeometry.fixture(200,20,true,0,[0,0]);s.vertices[1][0]-=10;PedroStrokeGeometry.recognize(s)",/equal/],
  ["bulging capsule","var s=PedroStrokeGeometry.fixture(200,20,true,0,[0,0]);s.outTangents[1][0]*=2;PedroStrokeGeometry.recognize(s)",/tolerance/],
  ["variable width","var s=PedroStrokeGeometry.fixture(200,20,true,0,[0,0]);s.vertices[3][1]+=5;PedroStrokeGeometry.recognize(s)",/parallel/],
  ["missing tangents","var s=PedroStrokeGeometry.fixture(200,20,false,0,[0,0]);s.inTangents.pop();PedroStrokeGeometry.recognize(s)",/arrays/],
  ["NaN vertex","var s=PedroStrokeGeometry.fixture(200,20,true,0,[0,0]);s.vertices[0][0]=NaN;PedroStrokeGeometry.recognize(s)",/non-finite/]
]) test(`reject ${name}`,()=>assert.throws(()=>evaluate(source),regex));
test("multiple cyclic traversals are rejected",()=>{
  assert.throws(()=>evaluate(`var s=PedroStrokeGeometry.fixture(200,20,true,0,[0,0]);s.vertices=s.vertices.concat(s.vertices);s.inTangents=s.inTangents.concat(s.inTangents);s.outTangents=s.outTangents.concat(s.outTangents);PedroStrokeGeometry.recognize(s)`),/two straight/);
});
