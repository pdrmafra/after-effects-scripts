const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");
const source=fs.readFileSync(path.join(__dirname,"../depth-map/jsx/DepthMapStatic.jsx"),"utf8");
const EXPOSED="depthTest={shellQuote:shellQuote,buildCommand:buildCommand,buildSequenceCommand:buildSequenceCommand,planFromSelection:planFromSelection,buildLaunchCommand:buildLaunchCommand,parseSequenceProgress:parseSequenceProgress,createStillJob:createStillJob,getProjectFolder:getProjectFolder,resultMessage:resultMessage,applyDepthReveal:applyDepthReveal,applyParallax:applyParallax,setOutputRoot:function(f){OUTPUT_ROOT=f;}};";
function helpers(){
  const c=vm.createContext({});
  vm.runInContext(`var disk={};
    function File(s){this.fsName=String(s);this.name=this.fsName.split("/").pop();this.displayName=this.name;this.parent={fsName:"/tool/jsx",parent:{fsName:"/tool"}};}
    Object.defineProperty(File.prototype,"exists",{get:function(){return !!disk[this.fsName];}});
    File.prototype.remove=function(){delete disk[this.fsName];return true;};
    File.prototype.open=function(){return true;};File.prototype.read=function(){return disk[this.fsName]||"";};File.prototype.close=function(){};
    function Folder(s){File.call(this,s);} Folder.prototype=Object.create(File.prototype);
    function FootageItem(file,still){this.file=file;this.mainSource=new FileSource(still);}
    function FileSource(still){this.isStill=still;}
    function CompItem(){}
    function KeyframeEase(speed,influence){this.speed=speed;this.influence=influence;}
    function fakeProperty(){return {values:[],keys:[],eases:0,setValue:function(v){this.values.push(v);},setValueAtTime:function(t,v){this.keys.push([t,v]);},get numKeys(){return this.keys.length;},setTemporalEaseAtKey:function(){this.eases++;}};}
    function fakeLayer(index){var effects=[];return {index:index,enabled:true,guideLayer:true,effects:effects,property:function(n){return {canAddProperty:function(m){return true;},addProperty:function(m){var props=[fakeProperty(),fakeProperty(),fakeProperty(),fakeProperty(),fakeProperty(),fakeProperty()];var e={matchName:m,props:props,property:function(i){return props[i-1];}};effects.push(e);return e;}};}};}
    function FolderItem(name){this.name=name;}
    var processes={}, nextPid=100, calls=[], imported=[], undo=[];
    var system={callSystem:function(cmd){calls.push(cmd);
      var m=cmd.match(/^nohup .* > '([^']+)' 2>&1 < \\/dev\\/null & echo \\$!$/); if(m){var pid=nextPid++;processes[pid]={log:m[1],cmd:cmd};return pid+"\\n";}
      m=cmd.match(/^kill -0 (\\d+)/); if(m)return processes[m[1]]?"running\\n":"";
      m=cmd.match(/^kill (-9 )?(\\d+)/); if(m){delete processes[m[2]];return "";}
      return "";}};
    var app={beginUndoGroup:function(n){undo.push("begin "+n);},endUndoGroup:function(){undo.push("end");}};
    var $={fileName:"/tool/jsx/DepthMapStatic.jsx",sleep:function(){}};`,c);
  vm.runInContext(source.replace("    createWindow().show();","    "+EXPOSED)
    .replace("function importDepthMap(depthFile, comp, sourceLayer, importAsGuideLayer) {","function importDepthMap(depthFile, comp, sourceLayer, importAsGuideLayer) { imported.push([depthFile.name, sourceLayer.name, importAsGuideLayer]); return {name: depthFile.name}; }\n    function unusedOriginalImport(depthFile, comp, sourceLayer, importAsGuideLayer) {"),c);
  return c;
}
function plan(c,layers){c.layers=layers;return vm.runInContext("depthTest.planFromSelection({selectedLayers:layers})",c);}
function still(c,name,exists){return vm.runInContext(`({name:${JSON.stringify(name)},source:new FootageItem({name:${JSON.stringify(name)},displayName:${JSON.stringify(name)},fsName:"/img/"+${JSON.stringify(name)},exists:${exists!==false}},true)})`,c);}
function stillJob(c,names){
  c.layers=names.map(n=>still(c,n));
  vm.runInContext(`depthTest.setOutputRoot(new Folder("/out")); var reports=[]; var job=depthTest.createStillJob({name:"Comp"},layers,{inputSize:518,guideLayer:true},function(t,f){reports.push([t,f]);});`,c);
}
const run=(c,code)=>vm.runInContext(code,c);
// Simulates the Python process finishing: writes its output PNG and exits.
function finishProcess(c){run(c,`for(var p in processes){var out=processes[p].cmd.match(/--output '([^']+)'/)[1];disk[out]="png";disk[processes[p].log]="log";delete processes[p];}`);}

test("depth launcher is valid JavaScript",()=>{assert.doesNotThrow(()=>new vm.Script(source));});
test("shell quoting keeps spaces, apostrophes and shell metacharacters literal",()=>{
  const c=helpers();
  c.input="/tmp/Pedro's file $(touch danger).png";
  assert.equal(run(c,"depthTest.shellQuote(input)"),"'/tmp/Pedro'\\''s file $(touch danger).png'");
});
test("selection decides the mode: stills become depth images, nothing or other layers become a sequence",()=>{
  const c=helpers();
  assert.equal(plan(c,[]).mode,"sequence");
  assert.equal(plan(c,[{name:"Video",source:run(c,"new FootageItem({name:'a.mov',exists:true},false)")}]).mode,"sequence");
  assert.equal(plan(c,[{name:"Solid",source:null}]).mode,"sequence");
  const two=plan(c,[still(c,"a.png"),still(c,"b.jpg")]);
  assert.equal(two.mode,"still");
  assert.equal(two.layers.length,2);
});
test("selection refuses mixed layers, missing files and unreadable image types",()=>{
  const c=helpers();
  assert.match(plan(c,[still(c,"a.png"),{name:"Solid",source:null}]).error,/only still images/);
  assert.match(plan(c,[still(c,"a.png",false)]).error,/missing/);
  assert.match(plan(c,[still(c,"art.psd")]).error,/PNG, JPEG or TIFF/);
});
test("commands use the Small model, chosen quality and Video Depth Anything for sequences",()=>{
  const c=helpers();
  assert.match(run(c,'depthTest.buildCommand(new File("/in.png"),new File("/out.png"),{inputSize:1022})'),/generate_depth\.py' --input '\/in\.png' --output '\/out\.png' --encoder 'vits' --input-size 1022 --device auto$/);
  assert.match(run(c,'depthTest.buildSequenceCommand(new File("/src"),new File("/dst"),{inputSize:518},24)'),/generate_vda_sequence\.py' .*--input-size 518 --device auto --fps 24$/);
});
test("Python is started detached, with its output in a log, so After Effects is not blocked",()=>{
  const c=helpers();
  assert.equal(run(c,`depthTest.buildLaunchCommand("'py' 'x.py'",new File("/o/it's.log"))`),"nohup 'py' 'x.py' > '/o/it'\\''s.log' 2>&1 < /dev/null & echo $!");
  assert.doesNotMatch(source,/callSystem\(command \+ " 2>&1"\)/);
});
test("sequence progress is read from the model log",()=>{
  const c=helpers();
  const p=t=>{c.t=t;return run(c,"depthTest.parseSequenceProgress(t)");};
  assert.equal(p("xFormers not available\n").phase,"starting");
  assert.deepEqual({...p("\r  0%|   | 0/5 [00:00<?\r 40%|██ | 2/5 [00:10<00:15")},{phase:"model",done:2,total:5});
  assert.deepEqual({...p("100%|█| 5/5 [00:20<00:00]\n1/96 /out/a.png\n40/96 /out/b.png\n")},{phase:"writing",done:40,total:96});
});
test("still job runs one image at a time, then imports all in one Undo",()=>{
  const c=helpers(); stillJob(c,["a.png","b.png"]);
  assert.equal(run(c,"job.tick()"),true);                  // launches the first image
  assert.equal(run(c,"Object.keys(processes).length"),1);
  assert.equal(run(c,"job.tick()"),true);                  // still running
  finishProcess(c);
  run(c,"job.tick(); job.tick();");                        // collects it, launches the second
  assert.match(run(c,"reports[reports.length-1][0]"),/2 of 2/);
  finishProcess(c);
  run(c,"while(job.tick()){}");
  assert.equal(run(c,"job.result.status"),"done");
  assert.deepEqual(JSON.parse(run(c,"JSON.stringify(imported.map(function(i){return i[1];}))")),["a.png","b.png"]);
  assert.deepEqual(JSON.parse(run(c,"JSON.stringify(undo)")),["begin Generate Depth Map","end"]);
  assert.equal(run(c,"Object.keys(disk).filter(function(k){return /\\.log$/.test(k);}).length"),0);  // logs cleaned
});
test("Cancel stops Python, deletes this run's files and imports nothing",()=>{
  const c=helpers(); stillJob(c,["a.png","b.png"]);
  run(c,"job.tick();"); finishProcess(c); run(c,"job.tick(); job.tick();");  // first done, second running
  assert.equal(run(c,"Object.keys(disk).filter(function(k){return /\\.png$/.test(k);}).length"),1);
  run(c,"job.cancel(); while(job.tick()){}");
  assert.equal(run(c,"job.result.status"),"cancelled");
  assert.equal(run(c,"Object.keys(processes).length"),0);
  assert.ok(run(c,"calls.some(function(x){return /^kill \\d+/.test(x);})"));
  assert.equal(run(c,"Object.keys(disk).length"),0);
  assert.equal(run(c,"imported.length"),0);
});
test("a failed image reports the end of the Python log and leaves no files",()=>{
  const c=helpers(); stillJob(c,["a.png"]);
  run(c,`job.tick(); for(var p in processes){disk[processes[p].log]="Traceback\\nERROR: out of memory\\n";delete processes[p];} while(job.tick()){}`);
  assert.equal(run(c,"job.result.status"),"error");
  assert.match(run(c,"job.result.message"),/out of memory/);
  assert.equal(run(c,"Object.keys(disk).length"),0);
});
test("imports go to one Depth Maps folder at the top of the Project panel, reused if it exists",()=>{
  const c=helpers();
  run(c,`var rootItems=[{name:"Footage"},new FolderItem("Comps")], added=0;
    app.project={rootFolder:{get numItems(){return rootItems.length;},item:function(i){return rootItems[i-1];}},
      items:{addFolder:function(n){added++;var f=new FolderItem(n);rootItems.push(f);return f;}}};`);
  const first=run(c,"depthTest.getProjectFolder()");
  assert.equal(first.name,"Depth Maps");
  assert.equal(run(c,"depthTest.getProjectFolder()"),first);
  assert.equal(run(c,"added"),1);
  assert.equal((source.match(/footage\.parentFolder = getProjectFolder\(\);/g)||[]).length,2);
});
test("the window closes itself after a successful run, then says what was made",()=>{
  assert.match(source,/if \(result\.status === "done"\) \{\s*win\.close\(\);\s*alert\(message/);
});
test("final messages say what happened and how long it took",()=>{
  const c=helpers();
  assert.equal(run(c,'depthTest.resultMessage({status:"done",message:"Imported 2 depth maps."},"still",3200)'),"Depth map done in 3 s.\n\nImported 2 depth maps.");
  assert.equal(run(c,'depthTest.resultMessage({status:"done",message:"x"},"sequence",65000)'),"Depth sequence done in 1 min 05 s.\n\nx");
  assert.match(run(c,'depthTest.resultMessage({status:"error",message:"ERROR: out of memory"},"sequence",1000)'),/^Depth sequence failed\. Nothing was imported\.\n\nERROR: out of memory$/);
});
test("Depth Reveal: Gradient Wipe reads the depth layer, near areas appear first over one second",()=>{
  const c=helpers();
  run(c,"var image=fakeLayer(2), depth=fakeLayer(1); depthTest.applyDepthReveal(image,depth,2,1/24);");
  assert.equal(run(c,"image.effects[0].matchName"),"ADBE Gradient Wipe");
  assert.equal(run(c,"image.effects[0].name"),"Depth Reveal");
  assert.deepEqual(JSON.parse(run(c,"JSON.stringify(image.effects[0].props[0].keys)")),[[2,100],[3,0]]);
  assert.equal(run(c,"image.effects[0].props[0].eases"),2);
  assert.deepEqual(JSON.parse(run(c,"JSON.stringify([image.effects[0].props[1].values,image.effects[0].props[2].values,image.effects[0].props[3].values])")),[[25],[1],[3]]);
  assert.deepEqual(JSON.parse(run(c,"JSON.stringify([depth.enabled,depth.guideLayer])")),[false,false]);  // hidden control layer
});
test("percent controls that scripts see as 0..1 get fractions (Transition Softness)",()=>{
  const c=helpers();
  run(c,"var image2=fakeLayer(2), depth2=fakeLayer(1), real=image2.property('ADBE Effect Parade'), add=real.addProperty; real.addProperty=function(m){var e=add(m);e.props[1].hasMax=true;e.props[1].maxValue=1;return e;}; image2.property=function(){return real;}; depthTest.applyDepthReveal(image2,depth2,0,1/24);");
  assert.deepEqual(JSON.parse(run(c,"JSON.stringify(image2.effects[0].props[1].values)")),[0.25]);
  assert.deepEqual(JSON.parse(run(c,"JSON.stringify(image2.effects[0].props[0].keys)")),[[0,100],[1,0]]);
});
test("a failure while adding to the comp says to use Undo instead of claiming nothing was imported",()=>{
  const c=helpers();
  assert.match(run(c,'depthTest.resultMessage({status:"error",message:"x",partial:true},"still",1000)'),/failed while adding it to the comp\. Press Undo/);
});
test("Parallax: Displacement Map reads the depth layer and moves horizontally only, over three seconds",()=>{
  const c=helpers();
  run(c,"var image=fakeLayer(3), depth=fakeLayer(2); depthTest.applyParallax(image,depth,0,1/24,2000);");
  assert.equal(run(c,"image.effects[0].matchName"),"ADBE Displacement Map");
  assert.deepEqual(JSON.parse(run(c,"JSON.stringify(image.effects[0].props[2].keys)")),[[0,-30],[3,30]]);
  assert.deepEqual(JSON.parse(run(c,"JSON.stringify([image.effects[0].props[0].values,image.effects[0].props[4].values,image.effects[0].props[5].values])")),[[2],[0],[2]]);
  assert.equal(run(c,"depth.enabled"),false);
});
test("Parallax is refused for sequences before anything runs",()=>{
  assert.match(source,/effect === "parallax" && plan\.mode !== "still"\) \{\s*alert\("Parallax works on still images only/);
});
test("sequence launcher checks completion marker and exact frame count",()=>{
  assert.match(source,/!firstFrame\.exists \|\| !completed\.exists \|\| frames\.length !== frameCount/);
  assert.doesNotMatch(source,/Folder\.temp/);
  assert.doesNotMatch(source,/Choose Image|File\.openDialog/);
});
