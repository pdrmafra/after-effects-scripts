// Transform to Null: own Position animation -> null takes it, layer is parented -> same motion -> extra Y motion on top.
"use strict";
const {seg,lin,ease,font}=require("./common");
function frames() {
const W=800,H=450,fps=25,dur=11.8,frames=Math.round(fps*dur);
const BLUE="#1ab3e6",ORANGE="#c2410c",INK="#1d1d1f",MUTED="#8a8a90";
// Animation clock a (0-1), three passes; the playhead returns to zero between them.
function clock(t){
  if(t<2.7)return ease(lin(t,0.4,2.6));if(t<3.0)return 1-seg(t,2.7,2.95);if(t<5.2)return 0;
  if(t<7.5)return ease(lin(t,5.2,7.4));if(t<7.8)return 1-seg(t,7.5,7.75);return ease(lin(t,8.4,11.2));}
const P=a=>[130+540*a,272-30*Math.sin(Math.PI*a)];
const trackX=a=>300+a*440,rowY=i=>346+i*26;
const diamond=(x,y,color,o=1,s=1)=>`<rect x="${(x-5*s).toFixed(1)}" y="${(y-5*s).toFixed(1)}" width="${(10*s).toFixed(1)}" height="${(10*s).toFixed(1)}" transform="rotate(45 ${x.toFixed(1)} ${y.toFixed(1)})" fill="${color}" opacity="${o.toFixed(3)}"/>`;
const captions=[["A layer with its own Position animation",INK,t=>1-seg(t,2.65,2.9)],
 ["It moves that animation to a new null and parents the layer to it",ORANGE,t=>seg(t,2.8,3.1)*(1-seg(t,5.1,5.35))],
 ["Same motion, now carried by the null",INK,t=>seg(t,5.2,5.5)*(1-seg(t,7.5,7.75))],
 ["…so the layer can get its own motion on top",BLUE,t=>seg(t,7.6,7.9)]];
function layerRow(y,name,icon,parent,parentO){
  let s=`<rect x="40" y="${(y-12).toFixed(1)}" width="720" height="24" rx="5" fill="#ffffff"/>${icon}<text x="66" y="${(y+5).toFixed(1)}" ${font} font-size="14" font-weight="600" fill="${INK}">${name}</text>`;
  s+=`<circle cx="172" cy="${y.toFixed(1)}" r="5" fill="none" stroke="${MUTED}" stroke-width="1.4"/><circle cx="172" cy="${y.toFixed(1)}" r="1.6" fill="${MUTED}"/>`;
  s+=`<rect x="182" y="${(y-9).toFixed(1)}" width="94" height="18" rx="4" fill="#f1f0ec"/>`;
  s+=parent.map(([text,color,o])=>o>0.001?`<text x="189" y="${(y+4).toFixed(1)}" ${font} font-size="12" fill="${color}" opacity="${o.toFixed(3)}">${text}</text>`:"").join("");
  return s;}
function propRow(y,o=1){return `<g opacity="${o.toFixed(3)}"><rect x="40" y="${(y-12).toFixed(1)}" width="720" height="24" rx="5" fill="#fbfaf8"/><circle cx="74" cy="${y.toFixed(1)}" r="4.5" fill="none" stroke="${INK}" stroke-width="1.3"/><path d="M74 ${(y-2.5).toFixed(1)}V${y.toFixed(1)}H76" fill="none" stroke="${INK}" stroke-width="1.1"/><text x="86" y="${(y+4.5).toFixed(1)}" ${font} font-size="13" fill="${INK}">Position</text></g>`;}
const svgs=[];
for(let f=0;f<frames;f++){
  const t=f/fps,a=clock(t),alpha=seg(t,0,0.3)*(1-seg(t,11.4,11.8));
  const nullIn=seg(t,3.0,3.4),rowsIn=seg(t,3.1,3.6),keysUp=seg(t,3.7,4.4),parented=seg(t,3.35,3.65),flash=Math.sin(Math.PI*lin(t,3.35,4.15)),extraIn=seg(t,7.8,8.3);
  const hop=t>=8.4?95*Math.abs(Math.sin(2*Math.PI*a))*extraIn:0;
  const p=P(a),card=[p[0],p[1]-hop];
  let s=`<rect width="${W}" height="${H}" fill="#f6f5f2"/><g opacity="${alpha.toFixed(3)}">`;
  s+=`<text x="40" y="58" ${font} font-size="26" font-weight="600" fill="${INK}">Transform to Null</text>`;
  s+=captions.map(([text,color,o])=>{const v=o(t);return v>0.001?`<text x="40" y="92" ${font} font-size="20" fill="${color}" opacity="${v.toFixed(3)}">${text}</text>`:"";}).join("");
  // Scene.
  let d="M"+P(0).map(v=>v.toFixed(1)).join(" ");for(let i=1;i<=40;i++)d+=" L"+P(i/40).map(v=>v.toFixed(1)).join(" ");
  s+=`<path d="${d}" fill="none" stroke="${MUTED}" stroke-width="1.5" stroke-dasharray="3 6" opacity="0.6"/>`;
  if(parented>0.001 && hop>1)s+=`<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${card[0].toFixed(1)}" y2="${card[1].toFixed(1)}" stroke="${ORANGE}" stroke-width="1.6" stroke-dasharray="4 4" opacity="${parented.toFixed(3)}"/>`;
  s+=`<g transform="translate(${card[0].toFixed(2)} ${card[1].toFixed(2)})"><rect x="-30" y="-30" width="60" height="60" rx="12" fill="${BLUE}"/><rect x="-18" y="-6" width="36" height="12" rx="6" fill="#ffffff" opacity="0.9"/></g>`;
  if(nullIn>0.001){const sc=0.6+0.4*nullIn;s+=`<g transform="translate(${p[0].toFixed(2)} ${p[1].toFixed(2)}) scale(${sc.toFixed(3)})" opacity="${nullIn.toFixed(3)}"><rect x="-17" y="-17" width="34" height="34" fill="none" stroke="${ORANGE}" stroke-width="2.4"/><path d="M-7 0H7M0 -7V7" stroke="${ORANGE}" stroke-width="2"/></g>`;}
  // Timeline: header, CTRL_Card + Position (new), Card + Position.
  s+=`<text x="182" y="324" ${font} font-size="11" fill="${MUTED}">Parent</text><line x1="290" y1="328" x2="760" y2="328" stroke="${MUTED}" stroke-width="1" opacity="0.5"/>`;
  for(let i=0;i<=10;i++)s+=`<line x1="${trackX(i/10)}" y1="328" x2="${trackX(i/10)}" y2="${i%5?332:336}" stroke="${MUTED}" stroke-width="1"/>`;
  const shift=2*rowsIn,cardY=rowY(shift),cardPosY=rowY(1+shift),ctrlY=rowY(0),ctrlPosY=rowY(1);
  if(rowsIn>0.001)s+=`<g opacity="${rowsIn.toFixed(3)}">`+layerRow(ctrlY,"CTRL_Card",`<rect x="48" y="${ctrlY-6}" width="12" height="12" fill="none" stroke="${ORANGE}" stroke-width="2"/>`,[["None",MUTED,1]])+propRow(ctrlPosY)+`</g>`;
  s+=layerRow(cardY,"Card",`<rect x="48" y="${(cardY-6).toFixed(1)}" width="12" height="12" rx="3" fill="${BLUE}"/>`,[["None",MUTED,1-parented],["CTRL_Card",ORANGE,parented]])+propRow(cardPosY);
  // The script parents the layer automatically as the null appears: a brief highlight marks the change.
  if(flash>0.001)s+=`<rect x="180" y="${(cardY-11).toFixed(1)}" width="98" height="22" rx="5" fill="none" stroke="${ORANGE}" stroke-width="2" opacity="${(0.9*flash).toFixed(3)}"/>`;
  // Original Position keys travel from Card > Position to CTRL_Card > Position.
  const keyY=cardPosY+(ctrlPosY-cardPosY)*keysUp;
  for(const k of [0,0.5,1])s+=diamond(trackX(k),keyY,keysUp>0.5?ORANGE:INK);
  if(extraIn>0.001)for(const k of [0,0.25,0.5,0.75,1])s+=diamond(trackX(k),cardPosY,BLUE,extraIn,0.6+0.4*extraIn);
  s+=`<line x1="${trackX(a).toFixed(1)}" y1="324" x2="${trackX(a).toFixed(1)}" y2="${(rowY(3)+12).toFixed(1)}" stroke="${INK}" stroke-width="1.5"/><path d="M${(trackX(a)-6).toFixed(1)} 320 h12 l-6 8 z" fill="${INK}"/>`;
  s+=`</g>`;
  svgs.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s}</svg>`);
}
return svgs;
}
module.exports={name:"transform-to-null",width:800,height:450,fps:25,frames};
