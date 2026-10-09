// Creates and removes only its own synthetic comps. Run only with tool approval.
(function () {
    #include "circular.jsxinc"
    #include "outlines.jsxinc"
    #include "geometry.jsxinc"
    #include "host.jsxinc"
    #include "settings.jsxinc"
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
            assert(c.numLayers===2 && !f.layer.enabled && !f.layer.selected && copy.selected,"Original not retained disabled / replacement not selected");
            assert(PedroStrokeHost.contentsAt(f.layer,f.chain).property(1).matchName===match,"Original path replaced");
            var out=PedroStrokeHost.contentsAt(copy,f.chain),stroke=out.property(2);
            assert(stroke.property("ADBE Vector Stroke Line Cap").value===(row[2]?2:1),"Wrong cap");
            assert(near(stroke.property("ADBE Vector Stroke Opacity").value,73),"Opacity lost");
            assert(copy.property("ADBE Transform Group").property("ADBE Position").numKeys===2,"Layer animation lost");
            assert(copy.parent===f.layer.parent && copy.inPoint===f.layer.inPoint && copy.outPoint===f.layer.outPoint,"Timing/parent mismatch");
            f.layer.enabled=false;
            c.saveFrameToPng(0,new File(outputDir.fsName+"/"+row[0]+"-after.png"));
        });})(cases[ci]);
        var curveRows=[["circular-ring","Ring compound path"],["even-odd-ring","Even-odd same-winding ring"],
            ["thin-ring","Thin 2-unit ring"],["quarter-arc","Quarter arc band"],["three-quarter-arc","Three-quarter arc"],
            ["oblique-arc","Reversed oblique arc"],["nested-mirrored-arc","Nested mirrored half arc"]];
        curveRows=curveRows.concat([["square-frame","Square frame"],["rectangle-frame","Rectangle frame"],["triangle-frame","Triangle frame"],
            ["diamond-frame","Diamond frame"],["pentagon-frame","Pentagon frame"],["hexagon-frame","Hexagon frame"],["octagon-frame","Octagon frame"],
            ["irregular-frame","Irregular convex frame"],["concave-frame","Concave L frame"],["star-frame","Star frame"],
            ["rounded-frame","Rounded rectangle frame"],["capsule-frame","Capsule frame"],["swapped-triangle-frame","Swapped reversed triangle frame"],
            ["even-odd-square-frame","Even-odd square frame"],["redundant-frame","Redundant collinear frame vertex"],["handles-frame","Collinear cubic handles frame"],
            ["nested-square-frame","Nested mirrored square frame"],["v-connector","V connector"],["z-connector","Z connector"],["u-connector","U connector"],
            ["zigzag-connector","Reversed zigzag connector"],["l-connector","L-shaped outline"],["round-quarter-arc","Round-ended quarter arc"],
            ["round-three-quarter-arc","Round-ended three-quarter arc"],["reverse-round-arc","Reversed round-ended arc"],
            ["acute-triangle-frame","Acute triangle frame"],["thin-square-frame","Thin 2-unit square frame"]]);
        function entryNamed(name) {var entries=PedroStrokeFixtures.catalog();for(var i=0;i<entries.length;i++)if(entries[i].name===name)return entries[i];throw new Error("Missing fixture: "+name);}
        for(ci=0;ci<curveRows.length;ci++)(function(row){test(row[0]+" curved geometry / style / render pair",function(){
            var c=fresh(),f=PedroStrokeFixtures.fromCase(c,entryNamed(row[1])),g=PedroStrokeHost.snapshot(f.layer).geometry;
            f.layer.property("ADBE Transform Group").property("ADBE Position").setValue([240,180]);
            c.saveFrameToPng(0,new File(outputDir.fsName+"/"+row[0]+"-before.png"));
            var copy=PedroStrokeHost.create(c,[f.layer],{})[0],out=PedroStrokeHost.contentsAt(copy,f.chain),s=out.property(1).property("ADBE Vector Shape").value;
            assert(s.closed===!!g.closed && s.vertices.length===g.vertices.length,"Wrong curved topology");
            assert(near(out.property(2).property("ADBE Vector Stroke Width").value,g.width),"Wrong circular thickness");
            assert(near(out.property(2).property("ADBE Vector Stroke Opacity").value,73),"Curved opacity lost");
            assert(out.property(2).property("ADBE Vector Stroke Line Cap").value===g.cap,"Wrong cap");
            if(g.join)assert(out.property(2).property("ADBE Vector Stroke Line Join").value===g.join && out.property(2).property("ADBE Vector Stroke Miter Limit").value>=g.miterLimit-0.0001,"Wrong polygon corner style");
            assert(!f.layer.enabled && copy.selected,"Wrong conversion state");
            c.saveFrameToPng(0,new File(outputDir.fsName+"/"+row[0]+"-after.png"));
        });})(curveRows[ci]);
        for(var curvedType=0;curvedType<2;curvedType++)(function(isRing){test((isRing ? "ring" : "arc")+" reverse handles / linear animated trim",function(){
            var c=fresh(),f=PedroStrokeFixtures.fromCase(c,entryNamed(isRing ? "Ring compound path" : "Three-quarter arc"));
            f.layer.property("ADBE Transform Group").property("ADBE Position").setValue([240,180]);c.time=0.5;
            var expected=PedroStrokeCircular.path(PedroStrokeHost.snapshot(f.layer).geometry,true);
            var copy=PedroStrokeHost.create(c,[f.layer],{reverse:true,animate:true,frames:12})[0];
            var out=PedroStrokeHost.contentsAt(copy,f.chain),s=out.property(1).property("ADBE Vector Shape").value;
            assert(s.closed===isRing && s.vertices.length===expected.vertices.length,"Wrong animated curve topology");
            for(var vi=0;vi<s.vertices.length;vi++)for(var d=0;d<2;d++)assert(near(s.vertices[vi][d],expected.vertices[vi][d]) && near(s.inTangents[vi][d],expected.inTangents[vi][d]) && near(s.outTangents[vi][d],expected.outTangents[vi][d]),"Reverse point / handle mismatch");
            var end=out.property(3).property("ADBE Vector Trim End");assert(end.numKeys===2 && near(end.valueAtTime(0.75,false),50),"Curved trim motion mismatch");
            for(var fi=0;fi<5;fi++)c.saveFrameToPng(0.5+fi*0.125,new File(outputDir.fsName+"/motion-"+(isRing ? "ring" : "arc")+"-"+fi+".png"));
        });})(curvedType===0);
        var motionRows=[["frame","Star frame"],["rounded-frame","Rounded rectangle frame"],["connector","Z connector"],["round-arc","Round-ended three-quarter arc"]];
        for(var mi=0;mi<motionRows.length;mi++)(function(row){test(row[0]+" reverse / draw-on / seam / metadata",function(){
            var c=fresh(),f=PedroStrokeFixtures.fromCase(c,entryNamed(row[1]));f.layer.property("ADBE Transform Group").property("ADBE Position").setValue([240,180]);c.time=0.5;
            var before=PedroStrokeHost.snapshot(f.layer).geometry,expected=PedroStrokeCircular.path(before,true),copy=PedroStrokeHost.create(c,[f.layer],{reverse:true,animate:true,frames:12})[0];
            var out=PedroStrokeHost.contentsAt(copy,f.chain),s=out.property(1).property("ADBE Vector Shape").value;
            assert(s.closed===!!before.closed && s.vertices.length===expected.vertices.length,"Wrong topology");
            for(var vi=0;vi<s.vertices.length;vi++)for(var d=0;d<2;d++)assert(near(s.vertices[vi][d],expected.vertices[vi][d]) && near(s.inTangents[vi][d],expected.inTangents[vi][d]) && near(s.outTangents[vi][d],expected.outTangents[vi][d]),"Reverse verification failed");
            var end=out.property(3).property("ADBE Vector Trim End");assert(end.numKeys===2 && near(end.keyTime(1),0.5) && near(end.keyTime(2),1) && near(end.valueAtTime(0.75,false),50),"Wrong linear draw-on");
            for(var fi=0;fi<5;fi++)c.saveFrameToPng(0.5+fi*0.125,new File(outputDir.fsName+"/motion-"+row[0]+"-"+fi+".png"));
        });})(motionRows[mi]);
        test("reverse / draw-on / keep disabled",function(){
            var c=fresh(),f=PedroStrokeFixtures.source(c,"Source",false,true,0,false);c.time=0.5;
            var model=PedroStrokeHost.snapshot(f.layer).geometry;
            var copy=PedroStrokeHost.create(c,[f.layer],{reverse:true,animate:true,frames:12,originalAction:"disable"})[0];
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
            rejects(function(){PedroStrokeHost.create(c,[a.layer,b.layer],{animate:true,frames:"2abc",originalAction:"disable"});});
            assert(c.numLayers===2 && a.layer.enabled && b.layer.enabled,"Batch changed");
        });
        test("draw-on outside visible layer is rejected",function(){
            var c=fresh(),f=PedroStrokeFixtures.source(c,"Source",true,false,0,false);c.time=3.9;
            rejects(function(){PedroStrokeHost.create(c,[f.layer],{animate:true,frames:12});});assert(c.numLayers===1,"Out-of-range created copy");
        });
        test("explicit delete removes originals only after complete batch conversion",function(){
            var c=fresh(),a=PedroStrokeFixtures.source(c,"First",true,false,0,false),b=PedroStrokeFixtures.source(c,"Second",false,true,30,false);
            var ids=[a.layer.id,b.layer.id],copies=PedroStrokeHost.create(c,[a.layer,b.layer],{originalAction:"delete"});
            assert(c.numLayers===2 && copies.length===2,"Wrong replacement count");
            for(var i=1;i<=c.numLayers;i++) assert(c.layer(i).id!==ids[0] && c.layer(i).id!==ids[1] && c.layer(i).selected,"Original retained or replacement not selected");
            for(i=0;i<copies.length;i++) assert(PedroStrokeHost.contentsAt(copies[i],i===0 ? a.chain : b.chain).property(1).property("ADBE Vector Shape").value.vertices.length===2,"Replacement path invalid");
        });
        test("delete blocks parent dependency without mutation",function(){
            var c=fresh(),f=PedroStrokeFixtures.source(c,"Parent",true,false,0,false),child=c.layers.addShape();
            child.parent=f.layer;
            rejects(function(){PedroStrokeHost.create(c,[f.layer],{originalAction:"delete"});});
            assert(c.numLayers===2 && f.layer.enabled && child.parent===f.layer,"Parent dependency mutated");
        });
        test("mixed ring / arc Delete verifies both curved replacements before removing originals",function(){
            var c=fresh(),a=PedroStrokeFixtures.fromCase(c,entryNamed("Ring compound path")),b=PedroStrokeFixtures.fromCase(c,entryNamed("Three-quarter arc"));
            var ids=[a.layer.id,b.layer.id],chains=[a.chain,b.chain],copies=PedroStrokeHost.create(c,[a.layer,b.layer],{originalAction:"delete",reverse:true});
            assert(c.numLayers===2 && copies.length===2,"Wrong curved replacement count");
            for(var i=0;i<2;i++) {
                assert(copies[i].id!==ids[0] && copies[i].id!==ids[1] && copies[i].selected,"Curved original not deleted");
                var s=PedroStrokeHost.contentsAt(copies[i],chains[i]).property(1).property("ADBE Vector Shape").value;
                assert(s.closed===(i===0) && s.vertices.length===4,"Wrong curved Delete geometry");
            }
        });
        test("frame / connector / round arc batch Delete preserves joins, caps and selection",function(){
            var c=fresh(),names=["Triangle frame","Z connector","Round-ended quarter arc"],sources=[],ids=[],chains=[],models=[];
            for(var i=0;i<names.length;i++){var f=PedroStrokeFixtures.fromCase(c,entryNamed(names[i]));sources.push(f.layer);ids.push(f.layer.id);chains.push(f.chain);models.push(PedroStrokeHost.snapshot(f.layer).geometry);}
            var copies=PedroStrokeHost.create(c,sources,{originalAction:"delete",reverse:true});assert(c.numLayers===3 && copies.length===3,"Wrong Delete batch size");
            for(i=0;i<copies.length;i++) {
                for(var j=0;j<ids.length;j++)assert(copies[i].id!==ids[j],"Original retained");
                var out=PedroStrokeHost.contentsAt(copies[i],chains[i]);assert(copies[i].selected && out.property(1).property("ADBE Vector Shape").value.closed===!!models[i].closed,"Topology / selection changed");
                assert(out.property(2).property("ADBE Vector Stroke Line Cap").value===models[i].cap,"Cap lost on Delete");
                if(models[i].join)assert(out.property(2).property("ADBE Vector Stroke Miter Limit").value>=models[i].miterLimit-0.0001,"Miter lost on Delete");
            }
        });
        var entries=PedroStrokeFixtures.catalog();
        for(var ei=0;ei<entries.length;ei++) (function(entry){test("catalog "+(entry.expected ? "READY " : "SKIP ")+entry.name,function(){
            var c=fresh(),f=PedroStrokeFixtures.fromCase(c,entry),before=c.numLayers;
            var results=PedroStrokeHost.analyze([f.layer]);
            assert(results[0].ok===entry.expected,"Unexpected classification: "+(results[0].reason || "accepted"));
            if(entry.expected) {
                var copy=PedroStrokeHost.create(c,[f.layer],{originalAction:"disable"})[0];
                assert(c.numLayers===before+1 && !f.layer.enabled && copy.selected,"Wrong successful conversion state");
            } else {
                rejects(function(){PedroStrokeHost.create(c,[f.layer],{originalAction:"delete"});});
                assert(c.numLayers===before && f.layer.enabled,"Rejected case mutated");
            }
        });})(entries[ei]);
        test("expanded demo: 48 READY / 25 SKIP layers",function(){
            var demo=PedroStrokeFixtures.demo();
            for(var di=0;di<demo.comps.length;di++)owned.push(demo.comps[di]);
            assert(demo.comps[0].numLayers===48 && demo.comps[1].numLayers===25,"Wrong demo counts");
            demo.comps[0].saveFrameToPng(0,new File(outputDir.fsName+"/fixtures-ready.png"));
            demo.comps[1].saveFrameToPng(0,new File(outputDir.fsName+"/fixtures-skip.png"));
        });
        test("native option persistence in isolated test namespace / cleanup",function(){
            var section="PedroMafra.ShapeToStroke.Tests",key="options_v1",prefSection="Settings_"+section;
            var existed=app.settings.haveSetting(section,key),previous=existed ? app.settings.getSetting(section,key) : null;
            var api={haveSetting:function(s,k){return app.settings.haveSetting(section,k);},getSetting:function(s,k){return app.settings.getSetting(section,k);},saveSetting:function(s,k,v){app.settings.saveSetting(section,k,v);}};
            try {
                assert(PedroStrokeSettings.write({originalAction:"delete",animate:true,reverse:true},api),"Preference write failed");
                var saved=PedroStrokeSettings.read(api);assert(saved.originalAction==="delete" && saved.animate && saved.reverse,"Preference read mismatch");
            } finally {
                if(existed)app.settings.saveSetting(section,key,previous);
                else {
                    assert(app.preferences.havePref(prefSection,key),"Test preference backend not found; no unrelated preference was removed");
                    app.preferences.deletePref(prefSection,key);
                    assert(!app.settings.haveSetting(section,key),"Test preference cleanup failed");
                }
            }
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
