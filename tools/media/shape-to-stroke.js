"use strict";
// Shape to Stroke: outline -> path through the middle -> stroke fills the shape -> hold -> back.
// Geometry comes from the tool's own recognizers and ICONS test shapes.
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const {seg,font}=require("./common");
function frames() {
const dir=path.join(__dirname,"../../experimental/shape-to-stroke");
const c=vm.createContext({});for(const f of ["circular.jsxinc","outlines.jsxinc","geometry.jsxinc","fixtures.jsxinc"])vm.runInContext(fs.readFileSync(path.join(dir,f),"utf8"),c);
const want=["House","Wi-Fi","Smiley"];
const entries=vm.runInContext("PedroStrokeFixtures.catalog()",c).filter(e=>want.includes(e.options.icon));
const fmt=p=>p[0].toFixed(2)+" "+p[1].toFixed(2);
function d(s){const n=s.vertices.length,lim=s.closed?n:n-1;let r="M"+fmt(s.vertices[0]);for(let i=0;i<lim;i++){const j=(i+1)%n,a=s.vertices[i],b=s.vertices[j],o=s.outTangents[i],q=s.inTangents[j];r+=" C"+fmt([a[0]+o[0],a[1]+o[1]])+" "+fmt([b[0]+q[0],b[1]+q[1]])+" "+fmt(b);}return r+(s.closed?" Z":"");}
const icons=want.map(name=>({name,parts:[]}));
for(const e of entries){c.entry=e;const g=vm.runInContext("entry.options.extraPath ? PedroStrokeOutlines.compound([entry.options.data,entry.options.extraPath],1) : PedroStrokeGeometry.recognize(entry.options.data)",c);c.model=g;const center=vm.runInContext("PedroStrokeCircular.path(model,false)",c);
 icons.find(i=>i.name===e.options.icon).parts.push({fill:d(e.options.data)+(e.options.extraPath?" "+d(e.options.extraPath):""),stroke:d(center),vertices:center.vertices,g});}
const W=800,H=450,fps=25,dur=7.0,frames=Math.round(fps*dur);
// Timeline (s): path draws 1.3-2.4, vertices 2.2-2.5, stroke grows 2.9-3.8, hold to 6.0, return 6.0-6.8.
const back=t=>seg(t,6.0,6.8);
const captions=[
  ["A filled shape is only an outline","#1490bb",t=>Math.max(1-seg(t,1.2,1.5),seg(t,6.2,6.6))],
  ["It finds the path running through the middle","#1d1d1f",t=>seg(t,1.3,1.6)*(1-seg(t,2.8,3.1))],
  ["…and gives it a stroke that fills the shape","#c2410c",t=>seg(t,2.9,3.2)*(1-seg(t,6.0,6.4))]];
const svgs=[];
for(let f=0;f<frames;f++){
  const t=f/fps,ret=back(t);
  const centerDraw=seg(t,1.3,2.4),centerAlpha=1-ret,dots=seg(t,2.2,2.5)*(1-ret),grow=seg(t,2.9,3.8)*(1-ret);
  let body="";
  icons.forEach((icon,k)=>{
    body+=`<g transform="translate(${160+k*240} 245)">`;
    body+=icon.parts.map(q=>`<path d="${q.fill}" fill="#1ab3e6" opacity="0.16"/>`).join("");
    body+=icon.parts.map(q=>q.g.width*grow<0.05?"":`<path d="${q.stroke}" fill="none" stroke="#c2410c" opacity="0.92" stroke-width="${(q.g.width*grow).toFixed(3)}" stroke-linecap="${q.g.cap===2?"round":"butt"}" stroke-linejoin="miter" stroke-miterlimit="${q.g.miterLimit||4}"/>`).join("");
    body+=icon.parts.map(q=>`<path d="${q.fill}" fill="none" stroke="#1490bb" stroke-width="1.6" stroke-linejoin="round"/>`).join("");
    if(centerDraw>0.001 && centerAlpha>0.001)body+=icon.parts.map(q=>`<path d="${q.stroke}" pathLength="100" fill="none" stroke="#1d1d1f" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="100 100" stroke-dashoffset="${(100*(1-centerDraw)).toFixed(3)}" opacity="${centerAlpha.toFixed(3)}"/>`).join("");
    if(dots>0.001)body+=icon.parts.map(q=>q.vertices.map(v=>`<rect x="${(v[0]-3).toFixed(2)}" y="${(v[1]-3).toFixed(2)}" width="6" height="6" fill="#ffffff" stroke="#1d1d1f" stroke-width="1.4" opacity="${dots.toFixed(3)}"/>`).join("")).join("");
    body+=`</g>`;
  });
  const caps=captions.map(([text,color,alpha])=>{const o=alpha(t);return o>0.001?`<text x="40" y="92" ${font} font-size="20" fill="${color}" opacity="${o.toFixed(3)}">${text}</text>`:"";}).join("");
  svgs.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#f6f5f2"/>
<text x="40" y="58" ${font} font-size="26" font-weight="600" fill="#1d1d1f">Shape to Stroke</text>${caps}
${body}</svg>`);
}
return svgs;
}
module.exports={name:"shape-to-stroke",width:800,height:450,fps:25,frames};
