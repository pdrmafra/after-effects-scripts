// Shape to Stroke 0.0.3-prototype — Pedro Mafra
// MIT License. Local experimental build; not part of the public beta.
(function () {
// Pure ES3 geometry. No AE objects, mutations or external dependencies.
var PedroStrokeGeometry = (function () {
    var EPS = 0.000001, K = 0.5522847498307936;
    function fail(message) { throw new Error(message); }
    function point(p) {
        if (!p || p.length !== 2 || typeof p[0] !== "number" || typeof p[1] !== "number" || !isFinite(p[0]) || !isFinite(p[1])) fail("Invalid/non-finite 2D geometry.");
        return [p[0], p[1]];
    }
    function add(a,b) { return [a[0]+b[0],a[1]+b[1]]; }
    function sub(a,b) { return [a[0]-b[0],a[1]-b[1]]; }
    function mul(a,s) { return [a[0]*s,a[1]*s]; }
    function dot(a,b) { return a[0]*b[0]+a[1]*b[1]; }
    function cross(a,b) { return a[0]*b[1]-a[1]*b[0]; }
    function length(a) { return Math.sqrt(dot(a,a)); }
    function unit(a) { var n=length(a); if(n<EPS) fail("Degenerate edge."); return mul(a,1/n); }
    function direction(a) { a=unit(a); return a[0]<-EPS || (Math.abs(a[0])<=EPS && a[1]<0) ? mul(a,-1) : a; }
    function model(center,axis,total,width,cap,kind,error) {
        if(width<=EPS || total/width<1.2) fail("Nearly square/circular geometry has no unambiguous long axis (minimum ratio 1.2).");
        var span=total-(cap===2 ? width : 0);
        return { kind:kind, vertices:[sub(center,mul(axis,span/2)),add(center,mul(axis,span/2))], width:width, cap:cap,
            totalLength:total, pathLength:span, fitError:error || 0, axis:axis, center:center };
    }
    function rectangle(size,center,roundness) {
        point(size); point(center);
        if(size[0]<=EPS || size[1]<=EPS || typeof roundness!=="number" || !isFinite(roundness) || roundness<0) fail("Invalid rectangle size/roundness.");
        var minor=Math.min(size[0],size[1]), major=Math.max(size[0],size[1]), cap=1;
        if(roundness>EPS) {
            if(roundness<minor/2-EPS) fail("Intermediate corner radius cannot be reproduced by a single uniform stroke.");
            cap=2;
        }
        return model(center,size[0]>=size[1] ? [1,0] : [0,1],major,minor,cap,cap===2 ? "parametric capsule" : "parametric rectangle",0);
    }
    function normalize(s) {
        if(!s || !s.closed) fail("Expected a closed filled path.");
        var n=s.vertices && s.vertices.length;
        if(!n || n<4 || n>32 || !s.inTangents || !s.outTangents || s.inTangents.length!==n || s.outTangents.length!==n) fail("Expected 4–32 vertices with matching tangent arrays.");
        var result={vertices:[],inTangents:[],outTangents:[],closed:true};
        for(var i=0;i<n;i++) {
            result.vertices.push(point(s.vertices[i])); result.inTangents.push(point(s.inTangents[i])); result.outTangents.push(point(s.outTangents[i]));
        }
        return result;
    }
    function straight(s,i) {
        var j=(i+1)%s.vertices.length;
        // Deliberately strict: collinear cubic handles are deferred, not silently treated as lines.
        return length(s.outTangents[i])<EPS && length(s.inTangents[j])<EPS;
    }
    function polygonRectangle(s) {
        if(s.vertices.length!==4) return null;
        var edges=[],i;
        for(i=0;i<4;i++) { if(!straight(s,i)) return null; edges.push(sub(s.vertices[(i+1)%4],s.vertices[i])); }
        var lens=[];
        for(i=0;i<4;i++) { lens.push(length(edges[i])); if(lens[i]<EPS) fail("Degenerate rectangle."); }
        for(i=0;i<4;i++) {
            if(Math.abs(dot(unit(edges[i]),unit(edges[(i+1)%4])))>0.00001) fail("Four-point path is not an orthogonal rectangle.");
        }
        if(length(add(edges[0],edges[2]))>EPS*Math.max(1,lens[0]) || length(add(edges[1],edges[3]))>EPS*Math.max(1,lens[1])) fail("Opposite rectangle edges do not match.");
        var center=mul(add(s.vertices[0],s.vertices[2]),0.5), axis=direction(lens[0]>=lens[1] ? edges[0] : edges[1]);
        return model(center,axis,Math.max(lens[0],lens[1]),Math.min(lens[0],lens[1]),1,"Bezier rectangle",0);
    }
    function cubic(p0,p1,p2,p3,t) {
        var u=1-t;
        return add(add(mul(p0,u*u*u),mul(p1,3*u*u*t)),add(mul(p2,3*u*t*t),mul(p3,t*t*t)));
    }
    function samples(s) {
        var result=[];
        for(var i=0;i<s.vertices.length;i++) {
            var j=(i+1)%s.vertices.length, p0=s.vertices[i], p3=s.vertices[j];
            if(straight(s,i)) result.push(p0);
            else {
                var p1=add(p0,s.outTangents[i]),p2=add(p3,s.inTangents[j]);
                for(var k=0;k<32;k++) result.push(cubic(p0,p1,p2,p3,k/32));
            }
        }
        return result;
    }
    function capsule(s) {
        var sides=[];
        for(var i=0;i<s.vertices.length;i++) {
            var j=(i+1)%s.vertices.length, edge=sub(s.vertices[j],s.vertices[i]);
            if(straight(s,i) && length(edge)>EPS) sides.push({a:s.vertices[i],b:s.vertices[j],edge:edge});
        }
        if(sides.length!==2) fail("Capsule needs exactly two straight sides and curved end caps.");
        var a=sides[0],b=sides[1],axis=direction(a.edge),normal=[-axis[1],axis[0]];
        var span=length(a.edge), scale=Math.max(1,span,length(b.edge)), strict=scale*0.00001;
        if(dot(unit(a.edge),unit(b.edge))>-0.99999 || Math.abs(span-length(b.edge))>strict) fail("Capsule sides are not opposite, parallel and equal.");
        var ca=mul(add(a.a,a.b),0.5),cb=mul(add(b.a,b.b),0.5);
        if(Math.abs(dot(sub(ca,cb),axis))>strict) fail("Capsule sides are not aligned.");
        var width=Math.abs(dot(sub(ca,cb),normal)), center=mul(add(ca,cb),0.5);
        if(width<EPS) fail("Capsule has zero width.");
        var tolerance=Math.max(0.01,width*0.001), radius=width/2, pts=samples(s), error=0;
        // A sampled fit, NOT a proof of arbitrary cubic equivalence.
        for(i=0;i<pts.length;i++) {
            var local=sub(pts[i],center),x=dot(local,axis),y=dot(local,normal),dx=Math.max(0,Math.abs(x)-span/2);
            var distance=Math.abs(Math.sqrt(dx*dx+y*y)-radius);
            error=Math.max(error,distance);
            if(distance>tolerance) fail("Curved outline does not fit a uniform capsule within tolerance.");
        }
        // Reject doubled/traversed/concave outlines using signed area and convexity.
        var area=0, turn=0;
        for(i=0;i<pts.length;i++) {
            var q=pts[i],next=pts[(i+1)%pts.length],after=pts[(i+2)%pts.length];
            area+=cross(sub(q,center),sub(next,center));
            var c=cross(sub(next,q),sub(after,next));
            if(Math.abs(c)>EPS) { if(turn && c*turn<0) fail("Capsule outline folds or is concave."); turn=c; }
        }
        var expected=span*width+Math.PI*radius*radius;
        if(Math.abs(Math.abs(area)/2-expected)>expected*0.005) fail("Capsule area/topology does not match.");
        return model(center,axis,span+width,width,2,"Bezier capsule (sampled fit)",error);
    }
    function recognize(s) { s=normalize(s); return polygonRectangle(s) || capsule(s); }
    // Synthetic fixtures: these are not evidence of Figma/Illustrator export compatibility.
    function fixture(width,height,rounded,angle,center) {
        var x=width/2,y=height/2,r=height/2,k=r*K, s;
        if(width<=height || height<=0) fail("Fixture requires width > height > 0.");
        if(rounded) s={vertices:[[-x+r,-y],[x-r,-y],[x,0],[x-r,y],[-x+r,y],[-x,0]],
            inTangents:[[-k,0],[0,0],[0,-k],[k,0],[0,0],[0,k]],
            outTangents:[[0,0],[k,0],[0,k],[0,0],[-k,0],[0,-k]],closed:true};
        else s={vertices:[[-x,-y],[x,-y],[x,y],[-x,y]],inTangents:[[0,0],[0,0],[0,0],[0,0]],outTangents:[[0,0],[0,0],[0,0],[0,0]],closed:true};
        var radians=angle*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians);
        function rotate(p) { return [p[0]*cos-p[1]*sin,p[0]*sin+p[1]*cos]; }
        for(var i=0;i<s.vertices.length;i++) { s.vertices[i]=add(rotate(s.vertices[i]),center); s.inTangents[i]=rotate(s.inTangents[i]); s.outTangents[i]=rotate(s.outTangents[i]); }
        return s;
    }
    return { rectangle:rectangle, recognize:recognize, fixture:fixture };
}());

// Conservative AE adapter. Snapshot -> recognition -> preflight -> duplicate-only edits.
var PedroStrokeHost = (function () {
    function fail(message) { throw new Error(message); }
    function expressions(p) {
        if(p.propertyType===PropertyType.PROPERTY) {
            if(p.canSetExpression && p.expression) fail("Expressions on the source layer are not supported.");
        } else for(var i=1;i<=p.numProperties;i++) expressions(p.property(i));
    }
    function staticTree(p) {
        if(p.propertyType===PropertyType.PROPERTY) {
            if(p.numKeys>0) fail("Animated shape geometry, group transforms or styles are not supported.");
        } else for(var i=1;i<=p.numProperties;i++) staticTree(p.property(i));
    }
    function leaf(contents,chain) {
        var groups=[],paths=[],fills=[];
        for(var i=1;i<=contents.numProperties;i++) {
            var p=contents.property(i),m=p.matchName;
            if(p.enabled===false) fail("Disabled shape attributes are not supported.");
            if(m==="ADBE Vector Group") groups.push(p);
            else if(m==="ADBE Vector Shape - Rect" || m==="ADBE Vector Shape - Group") paths.push(p);
            else if(m==="ADBE Vector Graphic - Fill") fills.push(p);
            else fail("Unsupported shape attribute: "+p.name+" ("+m+").");
        }
        if(groups.length===1 && !paths.length && !fills.length) {
            var group=groups[0],blend=group.property("ADBE Vector Blend Mode");
            if(blend && blend.value!==1) fail("Non-normal group blend mode is not supported.");
            return leaf(group.property("ADBE Vectors Group"),chain.concat([group.propertyIndex]));
        }
        if(groups.length || paths.length!==1 || fills.length!==1) fail("Select a layer with exactly one path and one solid fill, optionally inside a single nested group chain.");
        var fillBlend=fills[0].property("ADBE Vector Blend Mode");
        if(fillBlend && fillBlend.value!==1) fail("Non-normal fill blend mode is not supported.");
        return {chain:chain,path:paths[0],fill:fills[0]};
    }
    function snapshot(layer) {
        if(!layer || layer.matchName!=="ADBE Vector Layer") fail("Select a shape layer.");
        if(layer.locked || layer.threeDLayer || layer.adjustmentLayer || !layer.enabled) fail("Source must be an enabled, unlocked, non-adjustment 2D shape layer.");
        if(layer.blendingMode!==BlendingMode.NORMAL) fail("Only normal layer blending is supported.");
        if(layer.hasTrackMatte || layer.isTrackMatte) fail("Track matte layers are not supported.");
        if(layer.property("ADBE Effect Parade").numProperties || layer.property("ADBE Mask Parade").numProperties) fail("Layers with effects or masks are not supported.");
        var styles=layer.property("ADBE Layer Styles");
        if(styles) for(var si=1;si<=styles.numProperties;si++) {
            var style=styles.property(si);
            if(style.propertyType!==PropertyType.PROPERTY && style.enabled===true) fail("Enabled layer styles are not supported.");
        }
        expressions(layer);
        var contents=layer.property("ADBE Root Vectors Group");
        staticTree(contents);
        var found=leaf(contents,[]),source=found.path,geometry;
        if(source.matchName==="ADBE Vector Shape - Rect") geometry=PedroStrokeGeometry.rectangle(
            source.property("ADBE Vector Rect Size").value,source.property("ADBE Vector Rect Position").value,source.property("ADBE Vector Rect Roundness").value);
        else geometry=PedroStrokeGeometry.recognize(source.property("ADBE Vector Shape").value);
        return {layer:layer,chain:found.chain,geometry:geometry,color:found.fill.property("ADBE Vector Fill Color").value,
            opacity:found.fill.property("ADBE Vector Fill Opacity").value,enabled:layer.enabled,name:layer.name};
    }
    function analyze(layers) {
        var result=[];
        for(var i=0;i<layers.length;i++) {
            try { result.push({ok:true,plan:snapshot(layers[i]),name:layers[i].name}); }
            catch(error) { result.push({ok:false,name:layers[i].name,reason:error.toString()}); }
        }
        return result;
    }
    function contentsAt(layer,chain) {
        var c=layer.property("ADBE Root Vectors Group");
        for(var i=0;i<chain.length;i++) c=c.property(chain[i]).property("ADBE Vectors Group");
        return c;
    }
    function shape(vertices) {
        var s=new Shape();s.vertices=vertices;s.inTangents=[[0,0],[0,0]];s.outTangents=[[0,0],[0,0]];s.closed=false;return s;
    }
    function unique(comp,base) {
        var name=base,n=2,exists=true;
        while(exists) {
            exists=false;
            for(var i=1;i<=comp.numLayers;i++) if(comp.layer(i).name===name) {exists=true;break;}
            if(exists) name=base+" "+n++;
        }
        return name;
    }
    function write(copy,plan,options,comp) {
        var c=contentsAt(copy,plan.chain);
        for(var i=c.numProperties;i>=1;i--) c.property(i).remove();
        var path=c.addProperty("ADBE Vector Shape - Group");path.name="Recovered Centerline";
        var vertices=plan.geometry.vertices;
        if(options.reverse) vertices=[vertices[1],vertices[0]];
        path.property("ADBE Vector Shape").setValue(shape(vertices));
        // Indexed groups invalidate property handles after addProperty: reacquire each time.
        var stroke=contentsAt(copy,plan.chain).addProperty("ADBE Vector Graphic - Stroke");
        stroke.property("ADBE Vector Stroke Width").setValue(plan.geometry.width);
        stroke.property("ADBE Vector Stroke Color").setValue(plan.color);
        stroke.property("ADBE Vector Stroke Opacity").setValue(plan.opacity);
        stroke.property("ADBE Vector Stroke Line Cap").setValue(plan.geometry.cap);
        var trim=contentsAt(copy,plan.chain).addProperty("ADBE Vector Filter - Trim");
        var end=trim.property("ADBE Vector Trim End");
        if(options.animate) {
            end.setValueAtTime(comp.time,0);end.setValueAtTime(comp.time+options.frames*comp.frameDuration,100);
            end.setInterpolationTypeAtKey(1,KeyframeInterpolationType.LINEAR,KeyframeInterpolationType.LINEAR);
            end.setInterpolationTypeAtKey(2,KeyframeInterpolationType.LINEAR,KeyframeInterpolationType.LINEAR);
        } else end.setValue(100);
        c=contentsAt(copy,plan.chain);
        var check=c.property(1).property("ADBE Vector Shape").value;
        var actualWidth=c.property(2).property("ADBE Vector Stroke Width").value;
        if(check.closed || check.vertices.length!==2 || c.numProperties!==3 || Math.abs(actualWidth-plan.geometry.width)>Math.max(0.0001,plan.geometry.width*0.00001)) fail("Generated geometry verification failed.");
        for(i=0;i<2;i++) for(var d=0;d<2;d++) if(Math.abs(check.vertices[i][d]-vertices[i][d])>Math.max(0.0001,Math.abs(vertices[i][d])*0.00001)) fail("Generated path point verification failed.");
        copy.name=unique(comp,plan.name+" [Centerline]");
        copy.comment="Shape to Stroke prototype; original action: "+options.originalAction+". "+plan.geometry.kind+"; local sampled fit error "+plan.geometry.fitError;
    }
    function create(comp,layers,options) {
        if(!layers.length || layers.length>25) fail("Select 1–25 source layers.");
        options=options || {};
        var action=options.originalAction || "disable";
        if(action!=="disable" && action!=="delete") fail("Original action must be disable or delete.");
        options={originalAction:action,reverse:options.reverse,animate:options.animate,frames:options.frames};
        if(options.animate && (!/^[1-9][0-9]*$/.test(String(options.frames)) || Number(options.frames)>10000)) fail("Draw-on duration must be 1–10000 whole frames.");
        var results=analyze(layers),plans=[],i;
        for(i=0;i<results.length;i++) {
            if(!results[i].ok) fail(results[i].name+": "+results[i].reason+"\nNo copies were created. Select only supported layers.");
            var plan=results[i].plan;
            if(plan.layer.containingComp!==comp) fail("Every source layer must belong to the target composition.");
            for(var prior=0;prior<plans.length;prior++) if(plans[prior].layer===plan.layer) fail("Duplicate source layer in the conversion request.");
            if(action==="delete") for(var li=1;li<=comp.numLayers;li++) {
                if(comp.layer(li).parent===plan.layer) fail("Cannot delete "+plan.name+": it parents another layer. Keep disabled instead.");
            }
            if(options.animate && (comp.time<plan.layer.inPoint || comp.time+Number(options.frames)*comp.frameDuration>Math.min(comp.duration,plan.layer.outPoint))) fail("Draw-on keys must fit within the visible source layer and composition.");
            plans.push(plan);
        }
        var selection=comp.selectedLayers,copies=[],recovery=[],deletionStarted=false,succeeded=false;
        app.beginUndoGroup("Shape to Stroke");
        try {
            for(i=0;i<plans.length;i++) {
                var copy=plans[i].layer.duplicate();copies.push(copy);
                write(copy,plans[i],options,comp);
            }
            if(action==="delete") {
                // Only remove exact captured originals after ALL replacements passed verification.
                // After the first deletion, preserve replacements on failure; automatic cleanup
                // could otherwise destroy the only remaining copy of an already deleted source.
                deletionStarted=true;
                for(i=plans.length-1;i>=0;i--) plans[i].layer.remove();
            } else for(i=0;i<plans.length;i++) plans[i].layer.enabled=false;
            succeeded=true;
        } catch(error) {
            if(deletionStarted) fail(error.toString()+"\nOriginal deletion incomplete. Replacements were kept; use Undo immediately.");
            for(i=copies.length-1;i>=0;i--) {try{copies[i].remove();}catch(e){recovery.push(e.toString());}}
            for(i=0;i<plans.length;i++) {try{plans[i].layer.enabled=plans[i].enabled;}catch(e){recovery.push(e.toString());}}
            if(recovery.length) fail(error.toString()+"\nRecovery incomplete. Undo immediately: "+recovery.join("; "));
            throw error;
        } finally {
            // Restore selection on failure; select replacements on success, not hidden sources.
            for(i=0;i<selection.length;i++) {try{selection[i].selected=true;}catch(e){}}
            if(succeeded) for(i=0;i<plans.length;i++) {try{plans[i].layer.selected=false;}catch(e){}}
            for(i=0;i<copies.length;i++) {try{copies[i].selected=succeeded || deletionStarted;}catch(e){}}
            app.endUndoGroup();
        }
        return copies;
    }
    return {snapshot:snapshot,analyze:analyze,create:create,contentsAt:contentsAt};
}());

// Stores options only, never project content. One strict record avoids partial writes.
var PedroStrokeSettings = (function () {
    var section="PedroMafra.ShapeToStroke",key="options_v1";
    function defaults() {return {originalAction:"disable",animate:false,reverse:false};}
    function decode(value) {
        if(typeof value!=="string" || !/^v1\|(disable|delete)\|[01]\|[01]$/.test(value)) return defaults();
        var fields=value.split("|");
        return {originalAction:fields[1],animate:fields[2]==="1",reverse:fields[3]==="1"};
    }
    function read(api) {
        try {api=api || app.settings;return api.haveSetting(section,key) ? decode(api.getSetting(section,key)) : defaults();}
        catch(e) {return defaults();}
    }
    function write(options,api) {
        try {
            api=api || app.settings;
            var value="v1|"+(options.originalAction==="delete" ? "delete" : "disable")+"|"+(options.animate ? "1" : "0")+"|"+(options.reverse ? "1" : "0");
            api.saveSetting(section,key,value);return true;
        } catch(e) {
            // Saving a preference must not turn a successful layer edit into a reported failure.
            try{$.writeln("Shape to Stroke: options could not be saved: "+e.toString());}catch(ignore){}
            return false;
        }
    }
    return {read:read,write:write,decode:decode};
}());

function showStrokePrototype() {
    var comp=app.project && app.project.activeItem;
    if(!(comp instanceof CompItem)) {alert("Open a composition and select source shape layers.");return;}
    var win=new Window("dialog","Shape to Stroke");
    var saved=PedroStrokeSettings.read();
    win.orientation="column";win.alignChildren=["fill","top"];
    var original=win.add("group");
    original.add("statictext",undefined,"Original:");
    var action=original.add("dropdownlist",undefined,["Keep disabled","Delete"]);action.selection=saved.originalAction==="delete" ? 1 : 0;
    var animate=win.add("checkbox",undefined,"Animate Trim Paths");
    animate.value=saved.animate;
    var reverse=win.add("checkbox",undefined,"Reverse");
    reverse.value=saved.reverse;
    var buttons=win.add("group");buttons.alignment="right";
    var create=buttons.add("button",undefined,"Create",{name:"ok"});
    buttons.add("button",undefined,"Cancel",{name:"cancel"});
    create.onClick=function(){
        try {
            var options={reverse:reverse.value,animate:animate.value,frames:12,originalAction:action.selection.index===1 ? "delete" : "disable"};
            PedroStrokeHost.create(comp,comp.selectedLayers,options);
            PedroStrokeSettings.write(options);
            win.close(1);
        } catch(e) {alert(e.toString());}
    };
    win.center();win.show();
}
showStrokePrototype();

}());
