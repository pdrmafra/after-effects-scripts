// Deliberately creates and leaves one synthetic demo comp. Never saves the project.
(function () {
    #include "geometry.jsxinc"
    #include "host.jsxinc"
    #include "fixtures.jsxinc"
    if(!app.project) {alert("Open a project first. Save a copy before testing.");return;}
    var comp=null;
    app.beginUndoGroup("Shape to Stroke — Synthetic Demo");
    try {
        comp=app.project.items.addComp("Shape to Stroke DEMO "+new Date().getTime(),1280,960,1,4,24);
        var cases=[["01 READY - Native rectangle",true,false,0,false],["02 READY - Native capsule",true,true,0,false],
            ["03 READY - Bezier rectangle 30deg",false,false,30,false],["04 READY - Bezier capsule 20deg",false,true,20,false],
            ["05 READY - Vertical Bezier rectangle",false,false,90,false],["06 READY - Nested scaled capsule",false,true,0,true]];
        for(var i=0;i<cases.length;i++) {
            var row=cases[i],f=PedroStrokeFixtures.source(comp,row[0],row[1],row[2],row[3],row[4]);
            f.layer.property("ADBE Transform Group").property("ADBE Position").setValue([i<3 ? 320 : 960,180+(i%3)*270]);
            f.layer.selected=false;
        }
        var bad=PedroStrokeFixtures.source(comp,"07 SKIP - Intermediate roundness",true,true,0,false);
        PedroStrokeHost.contentsAt(bad.layer,bad.chain).property(1).property("ADBE Vector Rect Roundness").setValue(5);
        bad.layer.property("ADBE Transform Group").property("ADBE Position").setValue([640,900]);bad.layer.selected=false;
        comp.time=0;comp.openInViewer();
        alert("Created a synthetic demo comp with six supported examples and one negative fixture.\nSelect one READY layer and run Shape-to-Stroke.jsx.\nChoose Keep disabled + Animate Trim Paths to inspect motion.\nUndo removes this demo comp; your existing comps were not edited.");
    } catch(e) {if(comp) {try{comp.remove();}catch(cleanup){}}alert(e.toString());}
    finally {app.endUndoGroup();}
}());
