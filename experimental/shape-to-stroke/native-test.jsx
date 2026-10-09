// Creates and removes only its own synthetic comps. Run only with tool approval.
(function () {
    #include "geometry.jsxinc"
    #include "host.jsxinc"
    #include "fixtures.jsxinc"
    var owned=[],lines=[],passed=0,failed=0,oldActive=app.project.activeItem,oldSelection=app.project.selection;
    var outputDir=new File($.fileName).parent;
    function assert(ok,message) {if(!ok) throw new Error(message || "Assertion failed.");}
    function near(a,b) {return Math.abs(a-b)<0.0001;}
    function fresh() {var c=app.project.items.addComp("__PedroStroke_TEST_"+new Date().getTime()+"_"+owned.length,480,360,1,4,24);owned.push(c);return c;}
    function test(name,fn) {try{fn();passed++;lines.push("PASS "+name);}catch(e){failed++;lines.push("FAIL "+name+": "+e.toString()+" @ "+e.line);}}
    function rejects(fn) {var caught=false;try{fn();}catch(e){caught=true;}assert(caught,"Expected rejection.");}
    app.beginUndoGroup("Shape to Stroke — Native Fixtures");
    try {
        var cases=[["native-rectangle",true,false,0,false],["native-capsule",true,true,90,false],
            ["bezier-rectangle",false,false,30,false],["bezier-capsule",false,true,25,false],
            ["nested-scaled-capsule",false,true,0,true]];
        for(var ci=0;ci<cases.length;ci++) (function(row){test(row[0]+" duplicate / metadata / render pair",function(){
            var c=fresh(),f=PedroStrokeFixtures.source(c,"Source",row[1],row[2],row[3],row[4]);
            var original=PedroStrokeHost.contentsAt(f.layer,f.chain).property(1),match=original.matchName;
            var p=f.layer.property("ADBE Transform Group").property("ADBE Position");p.setValueAtTime(0,[240,180]);p.setValueAtTime(2,[245,180]);
            var plan=PedroStrokeHost.snapshot(f.layer);assert(near(plan.geometry.width,20),"Wrong width");
            c.saveFrameToPng(0,new File(outputDir.fsName+"/"+row[0]+"-before.png"));
            f.layer.selected=true;
            var copies=PedroStrokeHost.create(c,[f.layer],{}),copy=copies[0];
            assert(c.numLayers===2 && f.layer.enabled && f.layer.selected,"Original visibility/selection changed");
            assert(PedroStrokeHost.contentsAt(f.layer,f.chain).property(1).matchName===match,"Original path replaced");
            var out=PedroStrokeHost.contentsAt(copy,f.chain),stroke=out.property(2);
            assert(stroke.property("ADBE Vector Stroke Line Cap").value===(row[2]?2:1),"Wrong cap");
            assert(near(stroke.property("ADBE Vector Stroke Opacity").value,73),"Opacity lost");
            assert(copy.property("ADBE Transform Group").property("ADBE Position").numKeys===2,"Layer animation lost");
            assert(copy.parent===f.layer.parent && copy.inPoint===f.layer.inPoint && copy.outPoint===f.layer.outPoint,"Timing/parent mismatch");
            f.layer.enabled=false;
            c.saveFrameToPng(0,new File(outputDir.fsName+"/"+row[0]+"-after.png"));
        });})(cases[ci]);
        test("reverse / draw-on / explicit hide",function(){
            var c=fresh(),f=PedroStrokeFixtures.source(c,"Source",false,true,0,false);c.time=0.5;
            var model=PedroStrokeHost.snapshot(f.layer).geometry;
            var copy=PedroStrokeHost.create(c,[f.layer],{reverse:true,animate:true,frames:12,hideOriginal:true})[0];
            var out=PedroStrokeHost.contentsAt(copy,f.chain),s=out.property(1).property("ADBE Vector Shape").value;
            assert(near(s.vertices[0][0],model.vertices[1][0]),"Direction not reversed");
            var end=out.property(3).property("ADBE Vector Trim End");
            assert(end.numKeys===2 && near(end.keyTime(1),0.5) && near(end.keyTime(2),1) && near(end.valueAtTime(0.75,false),50),"Wrong motion");
            assert(!f.layer.enabled,"Original not hidden explicitly");
            for(var fi=0;fi<5;fi++) c.saveFrameToPng(0.5+fi*0.125,new File(outputDir.fsName+"/motion-"+fi+".png"));
        });
        test("analysis and unsupported batch are mutation-free",function(){
            var c=fresh(),a=PedroStrokeFixtures.source(c,"Good",true,false,0,false),b=PedroStrokeFixtures.source(c,"Bad",true,false,0,false);
            var rect=PedroStrokeHost.contentsAt(b.layer,b.chain).property(1);rect.property("ADBE Vector Rect Roundness").setValue(5);
            var result=PedroStrokeHost.analyze([a.layer,b.layer]);assert(result[0].ok && !result[1].ok,"Wrong analysis");
            rejects(function(){PedroStrokeHost.create(c,[a.layer,b.layer],{});});assert(c.numLayers===2 && a.layer.enabled && b.layer.enabled,"Preflight mutated");
        });
        test("expressions / path keys / effects are rejected",function(){
            var c=fresh(),f=PedroStrokeFixtures.source(c,"Source",true,false,0,false),rotation=f.layer.property("ADBE Transform Group").property("ADBE Rotate Z");
            rotation.expression="value";rejects(function(){PedroStrokeHost.snapshot(f.layer);});rotation.expression="";
            var rect=PedroStrokeHost.contentsAt(f.layer,f.chain).property(1).property("ADBE Vector Rect Size");
            rect.setValueAtTime(0,[200,20]);rejects(function(){PedroStrokeHost.snapshot(f.layer);});rect.removeKey(1);
            f.layer.property("ADBE Effect Parade").addProperty("ADBE Slider Control");rejects(function(){PedroStrokeHost.snapshot(f.layer);});
        });
        test("malformed duration rejects whole batch before mutation",function(){
            var c=fresh(),a=PedroStrokeFixtures.source(c,"First",true,false,0,false),b=PedroStrokeFixtures.source(c,"Second",true,false,0,false);
            rejects(function(){PedroStrokeHost.create(c,[a.layer,b.layer],{animate:true,frames:"2abc",hideOriginal:true});});
            assert(c.numLayers===2 && a.layer.enabled && b.layer.enabled,"Batch changed");
        });
        test("draw-on outside visible layer is rejected",function(){
            var c=fresh(),f=PedroStrokeFixtures.source(c,"Source",true,false,0,false);c.time=3.9;
            rejects(function(){PedroStrokeHost.create(c,[f.layer],{animate:true,frames:12});});assert(c.numLayers===1,"Out-of-range created copy");
        });
    } finally {
        for(var i=owned.length-1;i>=0;i--) {try{owned[i].remove();}catch(e){failed++;lines.push("CLEANUP FAILED "+e.toString());}}
        for(i=0;i<oldSelection.length;i++) {try{oldSelection[i].selected=true;}catch(e){}}
        if(oldActive instanceof CompItem) {try{oldActive.openInViewer();}catch(e){}}
        app.endUndoGroup();
    }
    lines.unshift("AE "+app.version+" / "+$.os+" / passed="+passed+" failed="+failed);
    var report=new File(outputDir.fsName+"/native-results.txt");report.encoding="UTF-8";
    if(!report.open("w")) throw new Error("Cannot write native report.");report.write(lines.join("\n"));report.close();
    $.writeln(lines.join("\n"));
}());
