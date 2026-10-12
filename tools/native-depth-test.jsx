// Optional integration test: background jobs (AE frame export -> local Python -> 16-bit PNG import) and Cancel.
// Requires a configured depth-map/backend/.venv and vendor directory.
// Run only with permission. Own comps/footage are removed; output stays in a unique temp folder.
(function () {
    var root=new File($.fileName).parent.parent;
    var sourceFile=new File(root.fsName+"/depth-map/jsx/DepthMapStatic.jsx");
    if(!sourceFile.open("r")) throw new Error("Cannot read Depth Map launcher.");
    var source=sourceFile.read(); sourceFile.close();
    var depthTest;
    var literal='"'+sourceFile.fsName.replace(/\\/g,"\\\\").replace(/"/g,'\\"')+'"';
    eval(source.replace("new File($.fileName)","new File("+literal+")").replace("    createWindow().show();",
        "    depthTest={setOutputRoot:function(folder){OUTPUT_ROOT=folder;},stillJob:createStillJob,sequenceJob:createSequenceJob};"));
    var folder=new Folder(Folder.temp.fsName+"/pedro-native-depth-"+new Date().getTime());
    if(!folder.create())throw new Error("Cannot create test folder.");
    depthTest.setOutputRoot(folder);
    function depthFolders(){var r=app.project.rootFolder,found=[];for(var k=1;k<=r.numItems;k++)if(r.item(k) instanceof FolderItem&&r.item(k).name==="Depth Maps")found.push(r.item(k));return found;}
    var hadDepthFolder=depthFolders().length>0;
    var oldActive=app.project.activeItem, oldSelection=app.project.selection, owned=[], comp=null;
    var lines=[], failed=0;
    // Drives a job the way the window's scheduled task does, waiting between steps.
    function drive(job,maxMs){var waited=0;while(job.tick()){$.sleep(50);waited+=50;if(waited>maxMs){job.cancel();while(job.tick())$.sleep(50);throw new Error("Job timed out.");}}return job.result;}
    function noReport(){}
    function test(name,action){try{action();lines.push("PASS "+name);}catch(error){failed++;lines.push("FAIL "+name+": "+error.toString());}}
    var options={inputSize:112,guideLayer:true,effect:"none",effectTime:0};
    function withEffect(kind){return {inputSize:112,guideLayer:true,effect:kind,effectTime:0};}
    app.beginUndoGroup("Pedro Depth Map Integration Test");
    try {
        comp=app.project.items.addComp("__PedroDepth_TEST_"+new Date().getTime(),128,96,1,1,24);
        comp.workAreaStart=0; comp.workAreaDuration=2/24;
        var layer=comp.layers.addShape(), group=layer.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        group.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect");
        var contents=layer.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
        contents.property(1).property("ADBE Vector Rect Size").setValue([60,40]);
        contents.addProperty("ADBE Vector Graphic - Fill");
        comp.openInViewer();
        var firstSourceFrame;
        test("AE background sequence job exports the work area and imports 24 fps depth",function(){
            var before=comp.numLayers, result=drive(depthTest.sequenceJob(comp,options,noReport),600000);
            if(result.status!=="done")throw new Error(result.status+": "+result.message);
            var footage=comp.layer(1).source; owned.push(footage);
            if(comp.numLayers!==before+1||Math.abs(footage.frameRate-24)>0.00001||!comp.layer(1).guideLayer)throw new Error("Wrong sequence import.");
            if(footage.parentFolder.name!=="Depth Maps"||footage.parentFolder.parentFolder!==app.project.rootFolder)throw new Error("Sequence is not in the Depth Maps project folder.");
            firstSourceFrame=new File(footage.file.parent.parent.fsName+"/source/frame_000001.png");
            if(!firstSourceFrame.exists)throw new Error("Exported source frame missing.");
        });
        test("AE static depth is parented to its image and sits exactly on it",function(){
            var still=app.project.importFile(new ImportOptions(firstSourceFrame)); owned.push(still);
            var image=comp.layers.add(still), t=image.property("ADBE Transform Group");
            t.property("ADBE Position").setValueAtTime(0,[30,20]); t.property("ADBE Position").setValueAtTime(1/24,[90,70]);
            t.property("ADBE Scale").setValue([55,70]); t.property("ADBE Rotate Z").setValue(12);
            image.property("ADBE Effect Parade").addProperty("ADBE Gaussian Blur 2");
            var before=comp.numLayers, result=drive(depthTest.stillJob(comp,[image],options,noReport),300000);
            if(result.status!=="done")throw new Error(result.status+": "+result.message);
            var depth=comp.layer(1), d=depth.property("ADBE Transform Group"), footage=depth.source; owned.push(footage);
            if(!footage.file.exists||comp.numLayers!==before+1||comp.layer(2)!==image)throw new Error("Static import failed.");
            if(footage.parentFolder.name!=="Depth Maps"||footage.parentFolder.parentFolder!==app.project.rootFolder)throw new Error("Still is not in the Depth Maps project folder.");
            var cx=String([still.width/2,still.height/2]);
            if(depth.parent!==image||d.property("ADBE Position").numKeys!==0||String(d.property("ADBE Position").value.slice(0,2))!==cx||String(d.property("ADBE Anchor Point").value.slice(0,2))!==cx||String(d.property("ADBE Scale").value.slice(0,2))!=="100,100"||d.property("ADBE Rotate Z").value!==0)throw new Error("Depth layer is not parented to the image with a neutral transform.");
            if(depth.property("ADBE Effect Parade").numProperties!==0||!depth.guideLayer)throw new Error("Depth layer kept effects or is not a guide layer.");
        });
        test("AE Depth Reveal and Parallax drive the image from its hidden depth layer",function(){
            var checks=[["reveal","Depth Reveal","Gradient Layer",1,"Transition Completion"],["parallax","Depth Parallax","Displacement Map Layer",3,"Max Horizontal Displacement"]];
            for(var k=0;k<checks.length;k++){
                var image=comp.layers.add(app.project.importFile(new ImportOptions(firstSourceFrame))); owned.push(image.source);
                var result=drive(depthTest.stillJob(comp,[image],withEffect(checks[k][0]),noReport),300000);
                if(result.status!=="done")throw new Error(checks[k][0]+": "+result.message);
                var depth=comp.layer(1); owned.push(depth.source);
                var fx=image.property("ADBE Effect Parade").property(checks[k][1]);
                if(!fx||fx.property(checks[k][0]==="reveal"?3:1).name!==checks[k][2]||fx.property(checks[k][0]==="reveal"?3:1).value!==depth.index)throw new Error(checks[k][0]+": effect does not read the depth layer.");
                if(fx.property(checks[k][3]).name!==checks[k][4]||fx.property(checks[k][3]).numKeys!==2)throw new Error(checks[k][0]+": wrong animated property.");
                if(depth.enabled||depth.parent!==image)throw new Error(checks[k][0]+": depth layer should be hidden and parented.");
            }
        });
        test("AE sequence Depth Reveal goes on an adjustment layer above everything",function(){
            var before=comp.numLayers, result=drive(depthTest.sequenceJob(comp,withEffect("reveal"),noReport),600000);
            if(result.status!=="done")throw new Error(result.message);
            var adjustment=comp.layer(1), depth=comp.layer(2); owned.push(depth.source); owned.push(adjustment.source);
            var fx=adjustment.property("ADBE Effect Parade").property("Depth Reveal");
            if(comp.numLayers!==before+2||!adjustment.adjustmentLayer||!fx||fx.property(3).value!==depth.index||depth.enabled)throw new Error("Wrong sequence reveal setup.");
        });
        test("AE Cancel during the model stops Python, deletes the run folder and imports nothing",function(){
            var before=comp.numLayers, foldersBefore=folder.getFiles().length, job=depthTest.sequenceJob(comp,options,noReport), waited=0;
            while(job.state!=="wait"&&job.tick()&&waited<60000){$.sleep(50);waited+=50;}
            if(job.state!=="wait"||!job.pid)throw new Error("Python did not start.");
            var pid=job.pid;
            job.cancel(); var result=drive(job,20000);
            if(result.status!=="cancelled")throw new Error("Expected cancelled, got "+result.status);
            if(system.callSystem("kill -0 "+pid+" 2>/dev/null && echo running").indexOf("running")>=0)throw new Error("Python still running.");
            if(comp.numLayers!==before||folder.getFiles().length!==foldersBefore)throw new Error("Cancel left layers or files.");
        });
    }finally{
        if(comp)comp.remove();
        for(var i=owned.length-1;i>=0;i--)if(owned[i].usedIn.length===0)owned[i].remove();
        if(!hadDepthFolder){var made=depthFolders();for(i=0;i<made.length;i++)if(made[i].numItems===0)made[i].remove();}
        for(i=0;i<oldSelection.length;i++)try{oldSelection[i].selected=true;}catch(error){}
        if(oldActive instanceof CompItem)oldActive.openInViewer();
        app.endUndoGroup();
    }
    lines.unshift("AE "+app.version+" / failed="+failed+" / outputs="+folder.fsName);
    var report=new File(root.fsName+"/native-depth-results.txt");report.encoding="UTF-8";
    report.open("w");try{report.write(lines.join("\n"));}finally{report.close();}
    return lines.join("\n");
}());
