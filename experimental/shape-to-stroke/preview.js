"use strict";
// Draws the ICONS fixtures as filled originals next to the strokes the recognizers recover.
// Same geometry code as the tool, rendered as SVG: an illustration, not an After Effects render.
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const c=vm.createContext({});
for(const f of ["circular.jsxinc","outlines.jsxinc","geometry.jsxinc","fixtures.jsxinc"])vm.runInContext(fs.readFileSync(path.join(__dirname,f),"utf8"),c);
const entries=vm.runInContext("PedroStrokeFixtures.catalog()",c).filter(e=>e.options.icon);
const fmt=p=>p[0].toFixed(2)+" "+p[1].toFixed(2);
function d(s) {
  const n=s.vertices.length,limit=s.closed ? n : n-1;let r="M"+fmt(s.vertices[0]);
  for(let i=0;i<limit;i++) {
    const j=(i+1)%n,a=s.vertices[i],b=s.vertices[j],o=s.outTangents[i],q=s.inTangents[j];
    r+=" C"+fmt([a[0]+o[0],a[1]+o[1]])+" "+fmt([b[0]+q[0],b[1]+q[1]])+" "+fmt(b);
  }
  return r+(s.closed ? " Z" : "");
}
const icons=[];
for(const e of entries) {
  let icon=icons.find(i=>i.name===e.options.icon);
  if(!icon)icons.push(icon={name:e.options.icon,parts:[]});
  c.entry=e;
  const g=vm.runInContext("entry.options.extraPath ? PedroStrokeOutlines.compound([entry.options.data,entry.options.extraPath],1) : PedroStrokeGeometry.recognize(entry.options.data)",c);
  c.model=g;
  icon.parts.push({fill:d(e.options.data)+(e.options.extraPath ? " "+d(e.options.extraPath) : ""),stroke:d(vm.runInContext("PedroStrokeCircular.path(model,false)",c)),g});
}
const cell=130,gap=16,pair=2*cell+gap,columns=4,margin=28,top=70,row=cell+44;
const width=margin*2+columns*pair+(columns-1)*36,height=top+Math.ceil(icons.length/columns)*row+margin;
let body="";
icons.forEach((icon,k)=>{
  const x=margin+(k%columns)*(pair+36),y=top+Math.floor(k/columns)*row,s=cell/220;
  const at=dx=>`translate(${(x+dx+cell/2).toFixed(1)} ${(y+cell/2).toFixed(1)}) scale(${s.toFixed(4)})`;
  body+=`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="10" class="cell"/><rect x="${x+cell+gap}" y="${y}" width="${cell}" height="${cell}" rx="10" class="cell"/>`;
  body+=`<g transform="${at(0)}">${icon.parts.map(p=>`<path d="${p.fill}" class="fill"/>`).join("")}</g>`;
  body+=`<g transform="${at(cell+gap)}">${icon.parts.map(p=>`<path d="${p.stroke}" class="stroke" stroke-width="${p.g.width}" stroke-linecap="${p.g.cap===2 ? "round" : "butt"}" stroke-linejoin="miter" stroke-miterlimit="${p.g.miterLimit || 4}"/>`).join("")}</g>`;
  body+=`<text x="${x}" y="${y+cell+22}" class="label">${icon.name}</text>`;
});
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Shape to Stroke: filled icons and the editable strokes recovered from them">
<style>.bg{fill:#f7f6f3}.cell{fill:#ffffff}.fill{fill:#1ab3e6}.stroke{fill:none;stroke:#c2410c}.title{font:600 20px -apple-system,Segoe UI,Helvetica,Arial,sans-serif;fill:#1d1d1f}.sub{font:14px -apple-system,Segoe UI,Helvetica,Arial,sans-serif;fill:#6b6b70}.label{font:14px -apple-system,Segoe UI,Helvetica,Arial,sans-serif;fill:#1d1d1f}</style>
<rect width="100%" height="100%" rx="16" class="bg"/>
<text x="${margin}" y="36" class="title">Filled shapes (blue) become editable strokes (orange)</text>
<text x="${margin}" y="56" class="sub">The 16 icons of the ICONS test comp. Drawn from the tool's own geometry, not an After Effects render.</text>
${body}
</svg>
`;
const target=path.join(__dirname,"images","icons-before-after.svg");
fs.mkdirSync(path.dirname(target),{recursive:true});
fs.writeFileSync(target,svg);
console.log("Wrote "+path.relative(process.cwd(),target)+" ("+icons.length+" icons)");
