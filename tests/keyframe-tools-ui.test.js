"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");
const source = fs.readFileSync(path.join(__dirname, "../src/keyframe-tools.jsxinc"), "utf8");
// ScriptUI and PedroAE stubs: records widgets, calls, alerts, drawing and the saved preference.
function run({ host = "panel", saved, kbar, fail } = {}) {
  const c = vm.createContext({ seed: saved, kbarArg: kbar, failWith: fail, hostKind: host });
  vm.runInContext(`
var widgets=[],calls=[],alerts=[],shown=false,record=seed,drawn=[];
function Graphics(){var g=this;this.BrushType={SOLID_COLOR:1};this.PenType={SOLID_COLOR:1};
  ["newPath","rectPath","moveTo","lineTo","closePath"].forEach(function(n){g[n]=function(){for(var i=0;i<arguments.length;i++)if(!isFinite(arguments[i]))throw new Error(n+" got "+arguments[i]);drawn.push(n);};});
  this.newBrush=function(t,c){if(c.length!==4)throw new Error("bad color");return {color:c};};this.newPen=function(t,c,w){if(c.length!==4||!(w>0))throw new Error("bad pen");return {color:c,width:w};};
  this.fillPath=function(b){drawn.push("fill");};this.strokePath=function(p){drawn.push("stroke");};}
function Control(type,text){this.type=type;this.text=text;this.children=[];this.graphics=new Graphics();this.size=[72,30];widgets.push(this);this.layout={layout:function(){},resize:function(){}};}
Control.prototype.add=function(type,bounds,text){return new Control(type,text);};
function Panel(){Control.call(this,"panel","host");}Panel.prototype=Object.create(Control.prototype);
function Window(type,title){Control.call(this,"window",title);}Window.prototype=Object.create(Control.prototype);
Window.prototype.center=function(){};Window.prototype.show=function(){shown=true;};
var app={settings:{haveSetting:function(){return typeof record==="string";},getSetting:function(){return record;},saveSetting:function(s,k,v){record=v;}}};
function alert(m){alerts.push(m);}
if(kbarArg)var kbar={button:{argument:kbarArg}};
function result(name){return function(){calls.push([name].concat(Array.prototype.slice.call(arguments,1)));if(failWith)throw new Error(failWith);};}
var PedroAE={comp:function(){return {frameDuration:1/24};},run:function(name,action){try{action();}catch(e){alerts.push(name+": "+e.toString());}},
  space:result("space"),step:result("step"),keepEvery:result("keepEvery"),keysToLayer:result("keysToLayer"),trimToKeys:result("trimToKeys")};
var thisObj=hostKind==="panel" ? new Panel() : {};`, c);
  vm.runInContext(source, c);
  const find = tip => `widgets.filter(function(w){return w.helpTip && w.helpTip.indexOf(${JSON.stringify(tip)})===0;})[0]`;
  return {
    click(tip) { vm.runInContext(`${find(tip)}.onClick();`, c); return this; },
    draw(tip, state) { vm.runInContext(`drawn=[];${find(tip)}.onDraw(${JSON.stringify(state || {})});`, c); return JSON.parse(vm.runInContext("JSON.stringify(drawn)", c)); },
    resize(width) { vm.runInContext(`thisObj.size=[${width},400];thisObj.onResize();`, c); return JSON.parse(vm.runInContext(`JSON.stringify(widgets.filter(function(w){return w.type==="edittext"||w.type==="iconbutton";}).map(function(w){return w.location;}))`, c)); },
    frames(text) { vm.runInContext(`widgets.filter(function(w){return w.type==="edittext";})[0].text=${JSON.stringify(text)};`, c); return this; },
    state() { return JSON.parse(JSON.stringify(vm.runInContext(`({buttons:widgets.filter(function(w){return w.type==="iconbutton";}).map(function(w){return w.helpTip.split(":")[0];}),fields:widgets.filter(function(w){return w.type==="edittext";}).map(function(w){return w.text;}),calls:calls,alerts:alerts,record:record,shown:shown})`, c))); }
  };
}
const tips = ["Space", "Step", "Keep", "Keys to layer in", "Keys to layer out", "Trim in", "Trim out", "Trim both"];
test("the compact panel has an interval field and eight icon buttons in order", () => {
  const s = run().state();
  assert.deepEqual(s.buttons, tips); assert.deepEqual(s.fields, ["2"]);
});
test("each button runs its action with N: frames for Space and Step, keys for Keep", () => {
  const ui = run().frames("4");
  for (const tip of tips) ui.click(tip);
  assert.deepEqual(ui.state().calls, [["space", "4", false, false], ["step", "4", false], ["keepEvery", "4"], ["keysToLayer", "in"], ["keysToLayer", "out"], ["trimToKeys", "in"], ["trimToKeys", "out"], ["trimToKeys", "both"]]);
  assert.equal(ui.state().record, "v2|4"); assert.deepEqual(ui.state().alerts, []);
});
test("a refused action alerts and keeps the panel open", () => {
  assert.match(run({ fail: "Select at least two keys" }).click("Step").state().alerts[0], /Select at least two keys/);
});
test("N is remembered; an invalid entry is not", () => {
  assert.deepEqual(run({ saved: "v2|6" }).state().fields, ["6"]);
  const bad = run({ saved: "v2|6" }).frames("abc").click("Space").state();
  assert.equal(bad.record, "v2|6"); assert.deepEqual(bad.calls[0], ["space", "abc", false, false]);
});
test("records from earlier versions keep their frame count", () => {
  assert.deepEqual(run({ saved: "v1|8|1|0|1" }).state().fields, ["8"]);
  assert.deepEqual(run({ saved: "v3|f|5" }).state().fields, ["5"]);
});
for (const record of [null, "", "v2|0", "v2|6|1", "v1|6|0|1", "v3|s|0.5", "v3|s|2", "v3|f|1.5", "v2|6\n"]) test(`invalid or seconds record ${JSON.stringify(record)} uses N = 2`, () => {
  assert.deepEqual(run({ saved: record }).state().fields, ["2"]);
});
test("the tiles form a column, a 3 x 3 square or a single row, never leaving one alone", () => {
  const ui = run(), shape = width => { const l = ui.resize(width); return [new Set(l.map(p => p[0])).size, new Set(l.map(p => p[1])).size]; };
  assert.deepEqual(shape(60), [1, 9]);
  assert.deepEqual(shape(120), [1, 9], "room for 2 columns still gives a column");
  assert.deepEqual(shape(170), [3, 3]);
  assert.deepEqual(shape(400), [3, 3], "room for 7 columns still gives the square");
  assert.deepEqual(shape(500), [9, 1]);
});
test("every icon draws its background and shapes in each button state", () => {
  const ui = run();
  for (const tip of tips) for (const state of [{}, { mouseOver: true }, { leftButtonPressed: true }]) {
    const drawn = ui.draw(tip, state);
    assert.equal(drawn[1], "rectPath"); assert.ok(drawn.filter(d => d === "fill" || d === "stroke").length >= 4, `${tip} drew too little`);
  }
});
test("a KBar argument runs one action directly with the saved N, without building the panel", () => {
  const s = run({ kbar: " Trim-Both ", saved: "v2|3" }).state();
  assert.deepEqual(s.calls, [["trimToKeys", "both"]]); assert.deepEqual(s.buttons, []); assert.deepEqual(s.alerts, []);
  assert.deepEqual(run({ kbar: "step", saved: "v2|3" }).state().calls, [["step", "3", false]]);
  assert.deepEqual(run({ kbar: "keep", saved: "v2|3" }).state().calls, [["keepEvery", "3"]]);
});
test("an unknown KBar argument is explained", () => {
  assert.match(run({ kbar: "round" }).state().alerts[0], /Unknown action: round/);
});
test("run as a script file it opens a floating window", () => {
  assert.equal(run({ host: "global" }).state().shown, true);
});
