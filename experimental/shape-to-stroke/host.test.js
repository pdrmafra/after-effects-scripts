"use strict";
const fs=require("node:fs"),vm=require("node:vm"),test=require("node:test"),assert=require("node:assert/strict");
function setup() {
  const c=vm.createContext({});
  vm.runInContext(`
var PropertyType={PROPERTY:1,GROUP:2},BlendingMode={NORMAL:1},KeyframeInterpolationType={LINEAR:1};
function Shape() {}
var app={groups:0,beginUndoGroup:function(){this.groups++;},endUndoGroup:function(){this.groups--;}};
function P(name,value,owner) {this.matchName=name;this.name=name;this.value=value;this.owner=owner;this.propertyType=1;this.numKeys=0;this.canSetExpression=true;this.expression="";this.keys=[];}
P.prototype.setValue=function(v){if(this.owner.comp.failWrite===this.owner.sourceName && this.matchName==="ADBE Vector Stroke Width")throw new Error("injected write failure");this.value=v;};
P.prototype.setValueAtTime=function(t,v){this.keys.push([t,v]);this.numKeys=this.keys.length;};
P.prototype.setInterpolationTypeAtKey=function(){};
function G(name,owner){this.name=name;this.matchName=name;this.owner=owner;this.propertyType=2;this.items=[];this.enabled=true;}
Object.defineProperty(G.prototype,"numProperties",{get:function(){return this.items.length;}});
G.prototype.property=function(n){return typeof n==="number" ? this.items[n-1] : this.items.find(function(p){return p.matchName===n;});};
G.prototype.push=function(p){p.propertyIndex=this.items.length+1;this.items.push(p);var self=this;p.remove=function(){self.items.splice(self.items.indexOf(p),1);};return p;};
G.prototype.addProperty=function(n){var g=this.push(new G(n,this.owner)),fields;
if(n==="ADBE Vector Shape - Group")fields={"ADBE Vector Shape":null};
else if(n==="ADBE Vector Graphic - Stroke")fields={"ADBE Vector Stroke Width":1,"ADBE Vector Stroke Color":[1,1,1,1],"ADBE Vector Stroke Opacity":100,"ADBE Vector Stroke Line Cap":1};
else if(n==="ADBE Vector Filter - Trim")fields={"ADBE Vector Trim End":100};
else if(n==="ADBE Vector Shape - Rect")fields={"ADBE Vector Rect Size":[200,20],"ADBE Vector Rect Position":[0,0],"ADBE Vector Rect Roundness":0};
else if(n==="ADBE Vector Graphic - Fill")fields={"ADBE Vector Fill Color":[0.2,0.5,0.9,1],"ADBE Vector Fill Opacity":73};
if(fields)for(var key in fields)g.push(new P(key,fields[key],this.owner));return g;};
function cloneGroup(g,owner){var out=new G(g.matchName,owner);for(var i=0;i<g.items.length;i++){var p=g.items[i];out.push(p.propertyType===2?cloneGroup(p,owner):new P(p.matchName,p.value,owner));}return out;}
function Comp(){this.layers=[];this.time=0;this.duration=4;this.frameDuration=1/24;}
Object.defineProperty(Comp.prototype,"numLayers",{get:function(){return this.layers.length;}});
Object.defineProperty(Comp.prototype,"selectedLayers",{get:function(){return this.layers.filter(function(l){return l.selected;});}});
Comp.prototype.layer=function(i){return this.layers[i-1];};
function Layer(comp,name){this.comp=comp;this.containingComp=comp;this.name=name;this.sourceName=name;this.matchName="ADBE Vector Layer";this.propertyType=2;this.locked=false;this.enabled=true;this.selected=true;this.blendingMode=1;this.inPoint=0;this.outPoint=4;this.root=new G("layer",this);this.root.push(new G("ADBE Root Vectors Group",this));this.root.push(new G("ADBE Effect Parade",this));this.root.push(new G("ADBE Mask Parade",this));comp.layers.push(this);}
Object.defineProperty(Layer.prototype,"numProperties",{get:function(){return this.root.numProperties;}});
Layer.prototype.property=function(n){return this.root.property(n);};
Layer.prototype.duplicate=function(){var copy=new Layer(this.comp,this.name+" copy");copy.sourceName=this.name;copy.root=cloneGroup(this.root,copy);this.selected=false;return copy;};
Layer.prototype.remove=function(){this.comp.layers.splice(this.comp.layers.indexOf(this),1);};
function source(c,name){var l=new Layer(c,name);var root=l.property("ADBE Root Vectors Group");root.addProperty("ADBE Vector Shape - Rect");root.addProperty("ADBE Vector Graphic - Fill");return l;}
`,c);
  for(const f of ["geometry.jsxinc","host.jsxinc"])vm.runInContext(fs.readFileSync(__dirname+"/"+f,"utf8"),c);
  return source=>JSON.parse(JSON.stringify(vm.runInContext(source,c)));
}
test("analysis leaves all source state untouched",()=>{
  const run=setup();assert.deepEqual(run(`var c=new Comp(),a=source(c,"A");var r=PedroStrokeHost.analyze([a]);[r[0].ok,c.numLayers,a.enabled,a.selected,a.property("ADBE Root Vectors Group").numProperties,app.groups]`),[true,1,true,true,2,0]);
});
test("successful copies retain original geometry and default visibility",()=>{
  const run=setup();assert.deepEqual(run(`var c=new Comp(),a=source(c,"A");var copy=PedroStrokeHost.create(c,[a],{})[0];[c.numLayers,a.enabled,a.selected,copy.selected,a.property("ADBE Root Vectors Group").numProperties,copy.property("ADBE Root Vectors Group").numProperties,app.groups]`),[2,true,true,false,2,3,0]);
});
test("hide and animation require explicit options",()=>{
  const run=setup();assert.deepEqual(run(`var c=new Comp(),a=source(c,"A");c.time=0.25;var copy=PedroStrokeHost.create(c,[a],{hideOriginal:true,animate:true,frames:12})[0];[a.enabled,copy.property("ADBE Root Vectors Group").property(3).property("ADBE Vector Trim End").keys]`),[false,[[0.25,0],[0.75,100]]]);
});
test("second-copy write failure removes both copies and restores sources / selection / Undo",()=>{
  const run=setup();assert.deepEqual(run(`var c=new Comp(),a=source(c,"A"),b=source(c,"B");c.failWrite="B";var error="";try{PedroStrokeHost.create(c,[a,b],{hideOriginal:true});}catch(e){error=e.toString();}[error.indexOf("injected")>=0,c.numLayers,a.enabled,b.enabled,a.selected,b.selected,app.groups]`),[true,2,true,true,true,true,0]);
});
test("unsupported layer cancels the entire batch before edits",()=>{
  const run=setup();assert.deepEqual(run(`var c=new Comp(),a=source(c,"A"),b=source(c,"B");b.property("ADBE Root Vectors Group").addProperty("ADBE Vector Graphic - Stroke");var error=false;try{PedroStrokeHost.create(c,[a,b],{});}catch(e){error=true;}[error,c.numLayers,a.enabled,b.enabled,app.groups]`),[true,2,true,true,0]);
});
test("cross-comp and duplicate requests are rejected before mutation",()=>{
  for(const request of ["[a,a]","[a,b]"]) {
    const run=setup();assert.deepEqual(run(`var c=new Comp(),other=new Comp(),a=source(c,"A"),b=source(other,"B");var error=false;try{PedroStrokeHost.create(c,${request},{});}catch(e){error=true;}[error,c.numLayers,other.numLayers,app.groups]`),[true,1,1,0]);
  }
});
