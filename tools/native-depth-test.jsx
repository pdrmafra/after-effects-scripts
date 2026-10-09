// Optional integration test: AE frame export -> local Python -> 16-bit PNG import.
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
        "    depthTest={setOutputRoot:function(folder){OUTPUT_ROOT=folder;},exportFrames:exportWorkAreaFrames,generateStatic:generateDepth,generateSequence:generateDepthSequence,importStatic:importDepthMap,importSequence:importDepthSequence};"));
    var folder=new Folder(Folder.temp.fsName+"/pedro-native-depth-"+new Date().getTime());
    if(!folder.create())throw new Error("Cannot create test folder.");
    depthTest.setOutputRoot(folder);
    var frames=new Folder(folder.fsName+"/source"); frames.create();
    var oldActive=app.project.activeItem, oldSelection=app.project.selection, owned=[], comp=null;
    var lines=[], failed=0;
    function test(name,action){try{action();lines.push("PASS "+name);}catch(error){failed++;lines.push("FAIL "+name+": "+error.toString());}}
    var options={encoder:"vits",inputSize:112,clipLow:0,clipHigh:100,gamma:1,blur:0,temporalSmoothing:0,invert:false,sequenceBackend:"batch"};
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
        var exported;
        test("AE exports two synthetic work-area PNG frames",function(){
            exported=depthTest.exportFrames(comp,frames,{text:""},{update:function(){}},null);
            if(exported.frameCount!==2)throw new Error("Wrong exported frame count.");
        });
        test("AE static generation and import",function(){
            var output=depthTest.generateStatic(new File(frames.fsName+"/frame_000001.png"),options);
            var footage=depthTest.importStatic(output,true); owned.push(footage);
            if(!footage.file.exists||comp.numLayers!==2)throw new Error("Static import failed.");
        });
        test("AE batch generation and sequence import at 24 fps",function(){
            var out=new Folder(folder.fsName+"/batch");out.create();options.sequenceBackend="batch";
            var first=depthTest.generateSequence(frames,out,options,24,null,2);
            var footage=depthTest.importSequence(first,comp,true,0); owned.push(footage);
            if(Math.abs(footage.frameRate-24)>0.00001)throw new Error("Wrong imported fps.");
        });
        test("AE VDA generation and sequence import at 24 fps",function(){
            var out=new Folder(folder.fsName+"/vda");out.create();options.sequenceBackend="vda";
            var first=depthTest.generateSequence(frames,out,options,24,null,2);
            var footage=depthTest.importSequence(first,comp,true,0); owned.push(footage);
            if(Math.abs(footage.frameRate-24)>0.00001)throw new Error("Wrong imported fps.");
        });
    }finally{
        if(comp)comp.remove();
        for(var i=owned.length-1;i>=0;i--)if(owned[i].usedIn.length===0)owned[i].remove();
        for(i=0;i<oldSelection.length;i++)try{oldSelection[i].selected=true;}catch(error){}
        if(oldActive instanceof CompItem)oldActive.openInViewer();
        app.endUndoGroup();
    }
    lines.unshift("AE "+app.version+" / failed="+failed+" / outputs="+folder.fsName);
    var report=new File(root.fsName+"/native-depth-results.txt");report.encoding="UTF-8";
    report.open("w");try{report.write(lines.join("\n"));}finally{report.close();}
    return lines.join("\n");
}());
