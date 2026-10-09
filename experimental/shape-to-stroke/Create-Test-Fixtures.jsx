// Deliberately creates and leaves two synthetic demo comps. Never saves the project.
(function () {
    #include "geometry.jsxinc"
    #include "host.jsxinc"
    #include "fixtures.jsxinc"
    if(!app.project) {alert("Open a project first. Save a copy before testing.");return;}
    var demo=null;
    app.beginUndoGroup("Shape to Stroke — Synthetic Demo");
    try {
        demo=PedroStrokeFixtures.demo();demo.ready.openInViewer();
    } catch(e) {if(demo)for(var i=demo.comps.length-1;i>=0;i--){try{demo.comps[i].remove();}catch(cleanup){}}alert(e.toString());}
    finally {app.endUndoGroup();}
}());
