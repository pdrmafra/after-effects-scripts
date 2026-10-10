"use strict";
// Keyframe Tools: the real panel icons press in turn while a small timeline shows each action.
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const {seg,font}=require("./common");

// Load the panel's own icon data and drawing code, without building a panel.
function panelIcons() {
  const c=vm.createContext({thisObj:{}});
  vm.runInContext("var kbar=null;function Panel(){};function Window(){};var app={settings:{haveSetting:function(){return false;}}};",c);
  vm.runInContext(fs.readFileSync(path.join(__dirname,"../../src/keyframe-tools.jsxinc"),"utf8").replace("KeyframeTools.start(thisObj);",""),c);
  return vm.runInContext("KeyframeTools",c);
}
function iconSvg(K,name,w,h,state) {
  const col=v=>`rgb(${v.slice(0,3).map(x=>Math.round(x*255)).join(",")})`;
  let d="",parts="";
  const g={BrushType:{},PenType:{},newPath(){d="";},rectPath(x,y,ww,hh){d+=`M${x} ${y}h${ww}v${hh}h${-ww}Z`;},moveTo(x,y){d+=`M${x} ${y}`;},lineTo(x,y){d+=`L${x} ${y}`;},closePath(){d+="Z";},
    newBrush(t,c){return c;},newPen(t,c,wd){return {c,wd};},fillPath(b){parts+=`<path d="${d}" fill="${col(b)}"/>`;},strokePath(p){parts+=`<path d="${d}" fill="none" stroke="${col(p.c)}" stroke-width="${p.wd}"/>`;}};
  K.drawButton({graphics:g,size:[w,h]},K.icons[name],state);
  return parts;
}

const W=800,H=450,fps=25,dur=16.4;
const INK="#1d1d1f",MUTED="#8a8a90",BLUE="#1ab3e6",ORANGE="#c2410c";
// Actions: when the button is pressed, which N the field shows, and the caption.
const ACTIONS=[
  {name:"keys-in",at:1.0,n:2,text:"Keys to layer in: the first key moves to the layer's in point"},
  {name:"keys-out",at:3.4,n:2,text:"Keys to layer out: the last key moves to the layer's last frame"},
  {name:"space",at:5.8,n:2,text:"Space: the selected keys end up N frames apart"},
  {name:"step",at:8.2,n:1,text:"Step: a new key every N frames between them"},
  {name:"keep",at:10.6,n:2,text:"Keep: every Nth key stays, the ones between go"},
  {name:"trim-both",at:13.0,n:2,text:"Trim: the layer starts and ends on its keys"}];
const ORDER=["space","step","keep","keys-in","keys-out","trim-in","trim-out","trim-both"];

// Timeline state in comp frames (0–24): four original keys, three keys that Step adds and Keep removes.
function moveKeys(t) {
  const steps=[[1.3,null,[2,4,8,10]],[3.7,null,[13,15,19,21]],[6.1,null,[13,15,17,19]]];
  let frames=[5,7,11,13];
  for(const [at,,to] of steps){const p=seg(t,at,at+0.8);if(p<=0)break;frames=frames.map((f,i)=>f+(to[i]-f)*p);}
  return frames;
}
function frames(){
  const K=panelIcons(),out=[],total=Math.round(fps*dur);
  const fx=f=>150+f*(600/24);
  for(let f=0;f<total;f++){
    const t=f/fps,reset=seg(t,15.6,16.0),back=seg(t,16.0,16.4),scene=t<16.0?1-reset:back;
    const live=t<16.0?t:0;   // after the fade the timeline shows the starting state again
    let s=`<rect width="${W}" height="${H}" fill="#f6f5f2"/>`;
    s+=`<text x="40" y="58" ${font} font-size="26" font-weight="600" fill="${INK}">Keyframe Tools</text>`;
    const current=ACTIONS.filter(a=>live>=a.at-0.2).pop();
    const intro=1-seg(t,0.8,1.0);
    if(intro>0.001 && t<16.0)s+=`<text x="40" y="92" ${font} font-size="20" fill="${INK}" opacity="${intro.toFixed(3)}">One compact panel for keyframe timing</text>`;
    for(const a of ACTIONS){const o=seg(t,a.at-0.2,a.at)*(1-seg(t,(ACTIONS[ACTIONS.indexOf(a)+1]||{at:15.8}).at-0.2,(ACTIONS[ACTIONS.indexOf(a)+1]||{at:15.8}).at));
      if(o>0.001)s+=`<text x="40" y="92" ${font} font-size="20" fill="${ORANGE}" opacity="${o.toFixed(3)}">${a.text}</text>`;}
    if(t>=16.0)s+=`<text x="40" y="92" ${font} font-size="20" fill="${INK}" opacity="${back.toFixed(3)}">One compact panel for keyframe timing</text>`;

    // Panel at 1.5x the real size, as a single row: the N field first, then the eight buttons.
    const bw=72,bh=42,gap=6,px=(W-(9*bw+8*gap))/2,py=150,cell=i=>[px+i*(bw+gap),py];
    s+=`<rect x="${px-10}" y="${py-10}" width="${9*bw+8*gap+20}" height="${bh+20}" rx="6" fill="#232323"/>`;
    // The field only reacts when an action needs a different N.
    const shown=ACTIONS.filter(a=>live>=a.at-0.45).pop(),n=shown?shown.n:2;
    let nFlash=0;
    ACTIONS.forEach((a,i)=>{const before=i?ACTIONS[i-1].n:2;if(a.n!==before)nFlash=Math.max(nFlash,Math.sin(Math.PI*seg(live,a.at-0.7,a.at-0.15)));});
    const [fx0,fy0]=cell(0);
    s+=`<rect x="${fx0}" y="${fy0}" width="${bw}" height="${bh}" rx="2" fill="#1a1a1a" stroke="${nFlash>0.05?ORANGE:"#4a4a4a"}" stroke-width="${(1+1.5*nFlash).toFixed(2)}"/><text x="${fx0+bw/2}" y="${fy0+bh/2+6}" ${font} font-size="17" fill="#e6e6e6" text-anchor="middle">${n}</text>`;
    ORDER.forEach((name,i)=>{
      const [x,y]=cell(i+1),a=ACTIONS.find(a=>a.name===name);
      const press=a?Math.sin(Math.PI*seg(live,a.at,a.at+0.35)):0,glow=a?seg(live,a.at,a.at+0.15)*(1-seg(live,a.at+1.4,a.at+1.8)):0;
      s+=`<g transform="translate(${x} ${y})">${iconSvg(K,name,bw,bh,press>0.3?{leftButtonPressed:true}:(glow>0.3?{mouseOver:true}:{}))}</g>`;
      if(glow>0.01)s+=`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="none" stroke="${ORANGE}" stroke-width="2" opacity="${glow.toFixed(3)}"/>`;
    });

    // Timeline: ruler, layer bar and its Position keys.
    let tl=`<line x1="${fx(0)}" y1="236" x2="${fx(24)}" y2="236" stroke="${MUTED}" stroke-width="1" opacity="0.6"/>`;
    for(let k=0;k<=24;k++)tl+=`<line x1="${fx(k)}" y1="236" x2="${fx(k)}" y2="${k%5?240:244}" stroke="${MUTED}" stroke-width="1"/>`+(k%5?"":`<text x="${fx(k)}" y="228" ${font} font-size="11" fill="${MUTED}" text-anchor="middle">${k}</text>`);
    const trim=seg(live,13.3,14.1),inF=2+11*trim,outF=22-2*trim;
    tl+=`<rect x="40" y="266" width="720" height="30" rx="5" fill="#ffffff"/><text x="54" y="286" ${font} font-size="14" font-weight="600" fill="${INK}">Layer</text>`;
    // The bar spans the layer's first to last visible frame, so end keys sit exactly on its ends.
    tl+=`<rect x="${fx(inF).toFixed(1)}" y="271" width="${(fx(outF-1)-fx(inF)).toFixed(1)}" height="20" rx="3" fill="${BLUE}" opacity="0.85"/>`;
    tl+=`<rect x="40" y="304" width="720" height="30" rx="5" fill="#fbfaf8"/><text x="54" y="324" ${font} font-size="13" fill="${INK}">Position</text>`;
    const diamond=(f,color,o,sc)=>`<rect x="${(fx(f)-5.5*sc).toFixed(1)}" y="${(319-5.5*sc).toFixed(1)}" width="${(11*sc).toFixed(1)}" height="${(11*sc).toFixed(1)}" transform="rotate(45 ${fx(f).toFixed(1)} 319)" fill="${color}" opacity="${o.toFixed(3)}"/>`;
    for(const k of moveKeys(live))tl+=diamond(k,INK,1,1);
    // Step adds e–g (orange while new), Keep removes them again.
    const born=seg(live,8.5,9.0),settle=seg(live,9.2,9.8),doomed=seg(live,10.9,11.1),gone=seg(live,11.1,11.6);
    if(born>0.001 && gone<0.999)for(const k of [14,16,18]){const sc=born*(1-gone),color=doomed>0.5||settle<0.5?ORANGE:INK;tl+=diamond(k,color,1-gone,Math.max(0.05,sc));}
    s+=`<g opacity="${scene.toFixed(3)}" transform="translate(0 30)">${tl}</g>`;
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s}</svg>`);
  }
  return out;
}
module.exports={name:"keyframe-tools",width:W,height:H,fps,frames};
