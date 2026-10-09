"use strict";
const fs=require("node:fs"),vm=require("node:vm"),test=require("node:test"),assert=require("node:assert/strict");
function run(source) {
  const c=vm.createContext({});for(const f of ["circular.jsxinc","outlines.jsxinc","geometry.jsxinc","fixtures.jsxinc"])vm.runInContext(fs.readFileSync(__dirname+"/"+f,"utf8"),c);
  return JSON.parse(JSON.stringify(vm.runInContext(source,c)));
}
function near(a,b){assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);}
for(const count of [3,4,5,6,8,12])for(const width of [2,10,20])test(`uniform ${count}-gon frame, width ${width}`,()=>{
  const [m,points]=run(`var points=PedroStrokeFixtures.regular(${count},85),f=PedroStrokeFixtures.polygonFrame(points,${width});[PedroStrokeOutlines.compound([f.data,f.extraPath],1),points];`);
  near(m.width,width);assert.equal(m.closed,true);assert.equal(m.join,1);assert.ok(m.miterLimit>=4);assert.equal(m.vertices.length,count);
  for(let i=0;i<count;i++)for(let d=0;d<2;d++)near(m.vertices[i][d],points[i][d]);
});
for(const radius of [15,30,40])test(`rounded frame radius ${radius}, explicit recovered tangents`,()=>{
  const m=run(`var f=PedroStrokeFixtures.roundedFrame(200,100,${radius},12);PedroStrokeOutlines.frame([f.data,f.extraPath],1);`);
  near(m.width,12);assert.equal(m.closed,true);assert.equal(m.vertices.length,8);assert.ok(m.outTangents.some(p=>Math.hypot(...p)>0));
});
for(let first=0;first<8;first++)test(`connector arbitrary contour start ${first} and winding`,()=>{
  for(const reverse of [false,true]) {
    const m=run(`var s=PedroStrokeFixtures.connector([[-85,-60],[85,-60],[-85,60],[85,60]],12);for(var i=0;i<${first};i++)for(var f=0;f<3;f++){var key=["vertices","inTangents","outTangents"][f];s[key].push(s[key].shift());}if(${reverse})s=PedroStrokeFixtures.reverse(s);PedroStrokeGeometry.recognize(s);`);
    near(m.width,12);assert.equal(m.closed,false);assert.equal(m.vertices.length,4);assert.equal(m.cap,1);
  }
});
test("frame matches a cyclic inner contour start without moving outer seam",()=>{
  const [m,expected]=run(`var points=PedroStrokeFixtures.regular(6,85),f=PedroStrokeFixtures.polygonFrame(points,10);for(var k=0;k<3;k++)for(var i=0;i<3;i++){var key=["vertices","inTangents","outTangents"][i];f.extraPath[key].push(f.extraPath[key].shift());}[PedroStrokeOutlines.frame([f.data,f.extraPath],1),points[0]];`);
  near(m.vertices[0][0],expected[0]);near(m.vertices[0][1],expected[1]);
});
test("normalization does not mutate source arrays or bowed/reversing handles",()=>{
  const [before,after,clean]=run(`var s=PedroStrokeFixtures.straight([[-100,-10],[100,-10],[100,10],[-100,10]]);s.outTangents[0]=[50,0];s.inTangents[1]=[-50,0];var original=PedroStrokeCircular.path(s,false),clean=PedroStrokeOutlines.normalize(s);[original,s,clean];`);
  assert.deepEqual(before,after);assert.deepEqual(clean.outTangents[0],[0,0]);
  const bowed=run(`var s=PedroStrokeFixtures.straight([[-100,-10],[100,-10],[100,10],[-100,10]]);s.outTangents[0]=[50,1];PedroStrokeOutlines.normalize(s);`);
  assert.deepEqual(bowed.outTangents[0],[50,1]);
  const reversing=run(`var s=PedroStrokeFixtures.straight([[-100,-10],[100,-10],[100,10],[-100,10]]);s.outTangents[0]=[210,0];PedroStrokeOutlines.normalize(s);`);
  assert.deepEqual(reversing.outTangents[0],[210,0]);
});
test("independently subdivided straight sides normalize to matching frame edges",()=>{
  const m=run(`var f=PedroStrokeFixtures.polygonFrame([[-100,-50],[100,-50],[100,50],[-100,50]],14);f.data.vertices.splice(1,0,[0,-57]);f.data.inTangents.splice(1,0,[0,0]);f.data.outTangents.splice(1,0,[0,0]);PedroStrokeOutlines.frame([f.data,f.extraPath],1);`);
  near(m.width,14);assert.equal(m.vertices.length,4);
});
test("nonzero same-winding is refused; even-odd hollow polygon is supported",()=>{
  const expr="var f=PedroStrokeFixtures.polygonFrame(PedroStrokeFixtures.regular(3,85),10);f.extraPath=PedroStrokeFixtures.reverse(f.extraPath);";
  assert.throws(()=>run(expr+"PedroStrokeOutlines.frame([f.data,f.extraPath],1);"),/solid interior/);
  near(run(expr+"PedroStrokeOutlines.frame([f.data,f.extraPath],2);").width,10);
});
test("huge, malformed, open and traversed frame geometry cannot be emitted",()=>{
  for(const edit of ["f.data.closed=false;","f.data.vertices[0][0]=Infinity;","f.extraPath.inTangents.pop();","for(var key in f.data)if(key!==\"closed\")f.data[key]=f.data[key].concat(f.data[key]);"])
    assert.throws(()=>run(`var f=PedroStrokeFixtures.polygonFrame(PedroStrokeFixtures.regular(4,85),10);${edit}PedroStrokeOutlines.frame([f.data,f.extraPath],1);`));
});
test("connector with crossed / backtracking centerline is rejected",()=>{
  assert.throws(()=>run("PedroStrokeOutlines.openBand(PedroStrokeFixtures.connector([[-80,-60],[80,60],[-80,60],[80,-60]],12));"));
});
for(const sweep of [Math.PI/3,Math.PI/2,Math.PI,3*Math.PI/2,-Math.PI/2,-3*Math.PI/2])test(`rounded arc constant radius/caps ${sweep}`,()=>{
  const m=run(`PedroStrokeGeometry.recognize(PedroStrokeFixtures.roundBand(85,55,.2,${sweep}));`);
  near(m.width,30);near(m.pathLength,Math.abs(sweep)*70);assert.equal(m.cap,2);assert.equal(m.closed,false);
  for(const p of m.vertices)near(Math.hypot(...p),70);
});
test("rounded arc seam inside an end cap remains recognizable",()=>{
  for(let first=0;first<8;first++){
    const m=run(`var s=PedroStrokeFixtures.roundBand(85,55,.2,Math.PI);for(var i=0;i<${first};i++)for(var f=0;f<3;f++){var key=["vertices","inTangents","outTangents"][f];s[key].push(s[key].shift());}PedroStrokeGeometry.recognize(s);`);
    near(m.width,30);assert.equal(m.cap,2);
  }
});
