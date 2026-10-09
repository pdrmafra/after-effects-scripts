// A deliberately small AE mock; native integration tests remain necessary.
var PropertyType = { PROPERTY: 1, INDEXED_GROUP: 2, NAMED_GROUP: 3 };
var PropertyValueType = { OneD: 1, TwoD: 2, ThreeD: 3, COLOR: 4, TwoD_SPATIAL: 5, ThreeD_SPATIAL: 6, SHAPE: 7, TEXT_DOCUMENT: 8 };
var KeyframeInterpolationType = { LINEAR: 1, BEZIER: 2, HOLD: 3 };
var AutoOrientType = { NO_AUTO_ORIENT: 0 };
function CompItem() {}
function AVLayer() {}
function Shape() {}
function KeyframeEase(speed, influence) {
    if (influence < 0.1 || influence > 100) throw new Error("Invalid ease influence");
    this.speed = speed; this.influence = influence;
}
var app = { groups: 0, beginUndoGroup: function () { this.groups++; }, endUndoGroup: function () { this.groups--; } };
function alert(message) { throw new Error(message); }
function makeProperty(times, values, selected, spatial) {
    var p = { name: "Test Property", propertyType: 1, propertyValueType: spatial ? 5 : 1,
        propertyDepth: 1, isSpatial: !!spatial, canSetExpression: true, expression: "", keys: [], sampleCounts: [] };
    var layer = { locked: false, name: "Test Layer" };
    p.propertyGroup = function () { return layer; };
    p.isInterpolationTypeValid = function (type) { return this.propertyValueType === PropertyValueType.TEXT_DOCUMENT ? type === KeyframeInterpolationType.HOLD : true; };
    function key(time, value) {
        return { time: time, value: value, selected: false, inType: 1, outType: 1,
            inEase: [[0,33.333333]], outEase: [[0,33.333333]], continuous: false, auto: false,
            inTangent: spatial ? [0,0] : undefined, outTangent: spatial ? [0,0] : undefined,
            spatialContinuous: false, spatialAuto: false, roving: false, label: 0 };
    }
    for (var i = 0; i < times.length; i++) {
        var k = key(times[i], values[i]);
        k.selected = selected.indexOf(i+1) !== -1;
        p.keys.push(k);
    }
    Object.defineProperty(p, "numKeys", { get: function () { return this.keys.length; } });
    Object.defineProperty(p, "selectedKeys", { get: function () {
        var result = []; for (var i=0;i<this.keys.length;i++) if (this.keys[i].selected) result.push(i+1); return result;
    } });
    Object.defineProperty(p, "value", { get: function () { return this.keys.length ? this.keys[0].value : this.staticValue; } });
    var readers = { keyTime: "time", keyValue: "value", keySelected: "selected", keyInInterpolationType: "inType", keyOutInterpolationType: "outType", keyTemporalContinuous: "continuous", keyTemporalAutoBezier: "auto", keyInSpatialTangent: "inTangent", keyOutSpatialTangent: "outTangent", keySpatialContinuous: "spatialContinuous", keySpatialAutoBezier: "spatialAuto", keyRoving: "roving", keyLabel: "label" };
    Object.keys(readers).forEach(function (method) { p[method] = function (i) { return this.keys[i-1][readers[method]]; }; });
    p.keyInTemporalEase = function (i) { return this.keys[i-1].inEase.map(function (e) { return { speed:e[0], influence:e[1] }; }); };
    p.keyOutTemporalEase = function (i) { return this.keys[i-1].outEase.map(function (e) { return { speed:e[0], influence:e[1] }; }); };
    p.removeKey = function (i) { this.keys.splice(i-1,1); };
    p.addKey = function (t) {
        for (var i=0;i<this.keys.length;i++) if (Math.abs(this.keys[i].time-t)<1e-8) return i+1;
        var added=key(t,0);
        if(this.propertyValueType===PropertyValueType.TEXT_DOCUMENT) {
            added.inType=3;added.outType=3;added.inEase=[[0,0]];added.outEase=[[0,0]];
        }
        this.keys.push(added); this.keys.sort(function(a,b) { return a.time-b.time; });
        for (i=0;i<this.keys.length;i++) if (this.keys[i].time===t) return i+1;
    };
    p.setValueAtKey = function (i,v) { this.keys[i-1].value=v; };
    p.setValue = function (v) { this.staticValue=v; };
    p.setInterpolationTypeAtKey = function (i,a,b) { this.keys[i-1].inType=a; this.keys[i-1].outType=b; };
    p.setTemporalEaseAtKey = function (i,a,b) {
        this.keys[i-1].inEase=a.map(function(e) { return [e.speed,e.influence]; });
        this.keys[i-1].outEase=b.map(function(e) { return [e.speed,e.influence]; });
        this.keys[i-1].inType=2; this.keys[i-1].outType=2;
    };
    var writers = { setTemporalContinuousAtKey: "continuous", setTemporalAutoBezierAtKey: "auto", setSpatialContinuousAtKey: "spatialContinuous", setSpatialAutoBezierAtKey: "spatialAuto", setRovingAtKey: "roving", setSelectedAtKey: "selected", setLabelAtKey: "label" };
    Object.keys(writers).forEach(function(method) { p[method]=function(i,v) { this.keys[i-1][writers[method]]=v; }; });
    p.setSpatialTangentsAtKey=function(i,a,b) { this.keys[i-1].inTangent=a; this.keys[i-1].outTangent=b; };
    p.valueAtTime=function(t) { this.sampleCounts.push(this.numKeys); return t*t; };
    return p;
}
function fixture(properties, fps) { return { selectedProperties: properties, time: 0, frameDuration: 1/(fps || 24) }; }
