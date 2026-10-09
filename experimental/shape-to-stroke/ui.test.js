"use strict";
const fs=require("node:fs"),vm=require("node:vm"),test=require("node:test"),assert=require("node:assert/strict");
function run(mode) {
  const c=vm.createContext({mode});
  vm.runInContext(`
var widgets=[],calls=[],alerts=[],closed=null;
function CompItem(){this.selectedLayers=["source"];}
var app={project:{activeItem:new CompItem()}};
function alert(message){alerts.push(message);}
function Control(type,text,properties){this.type=type;this.text=text;this.properties=properties;this.value=false;this.selection={index:0};widgets.push(this);}
Control.prototype.add=function(type,bounds,text,properties){var p=new Control(type,text,properties);return p;};
Control.prototype.close=function(code){closed=code;};
Control.prototype.center=function(){};
Control.prototype.show=function(){
var drop=widgets.filter(function(w){return w.type==="dropdownlist";})[0];
if(typeof drop.selection==="number")drop.selection={index:drop.selection};
if(mode==="delete"){drop.selection.index=1;widgets.filter(function(w){return w.type==="checkbox";}).forEach(function(w){w.value=true;});}
if(mode!=="cancel")widgets.filter(function(w){return w.text==="Create";})[0].onClick();};
function Window(type,title){return new Control(type,title);}
var PedroStrokeHost={create:function(comp,layers,options){calls.push(options);if(mode==="fail")throw new Error("unsupported");}};
`,c);
  vm.runInContext(fs.readFileSync(__dirname+"/ui.jsxinc","utf8"),c);
  return JSON.parse(JSON.stringify(vm.runInContext("({widgets:widgets.map(function(w){return {type:w.type,text:w.text,properties:w.properties};}),calls:calls,alerts:alerts,closed:closed})",c)));
}
test("dialog exposes only original action, animated trim, reverse, Create and Cancel",()=>{
  const r=run("cancel");
  assert.deepEqual(r.widgets.filter(w=>w.type==="dropdownlist").map(w=>w.text),[["Keep disabled","Delete"]]);
  assert.deepEqual(r.widgets.filter(w=>w.type==="checkbox").map(w=>w.text),["Animate Trim Paths","Reverse"]);
  assert.deepEqual(r.widgets.filter(w=>w.type==="button").map(w=>w.text),["Create","Cancel"]);
  assert.equal(r.widgets.filter(w=>w.type==="edittext").length,0);assert.equal(r.calls.length,0);
});
test("default creates disabled-original replacement, without animated trim or success prompt",()=>{
  const r=run("create");assert.deepEqual(r.calls,[{reverse:false,animate:false,frames:12,originalAction:"disable"}]);assert.equal(r.closed,1);assert.deepEqual(r.alerts,[]);
});
test("explicit delete / animated trim / reverse are passed correctly",()=>{
  const r=run("delete");assert.deepEqual(r.calls,[{reverse:true,animate:true,frames:12,originalAction:"delete"}]);assert.equal(r.closed,1);assert.deepEqual(r.alerts,[]);
});
test("failure keeps dialog open and reports the error",()=>{
  const r=run("fail");assert.equal(r.closed,null);assert.equal(r.alerts.length,1);assert.match(r.alerts[0],/unsupported/);
});
