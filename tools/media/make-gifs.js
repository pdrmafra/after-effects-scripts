"use strict";
// Regenerates the illustrative GIFs in docs/media: SVG frames -> headless Chrome/Edge -> ffmpeg.
// Needs Node 22+ (built-in WebSocket), ffmpeg and Chrome, Chromium or Edge. Usage: npm run media [-- name...]
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),{spawn,execFileSync}=require("node:child_process");
const scenes=[require("./shape-to-stroke"),require("./transform-to-null"),require("./keyframe-tools")];
const target=path.join(__dirname,"../../docs/media");

function findBrowser() {
  const candidates=[process.env.BROWSER,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome","/usr/bin/chromium","/usr/bin/chromium-browser","/usr/bin/microsoft-edge"];
  const found=candidates.find(p=>p && fs.existsSync(p));
  if(!found)throw new Error("Chrome, Chromium or Edge not found. Set BROWSER to its executable.");
  return found;
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// One browser for every frame: launching it per frame is far slower and can deadlock on profiles.
async function render(scene,svgs,dir) {
  const port=9300+Math.floor(Math.random()*500);
  const browser=spawn(findBrowser(),["--headless=new","--disable-gpu","--hide-scrollbars","--no-first-run",`--remote-debugging-port=${port}`,
    `--user-data-dir=${path.join(dir,"profile")}`,`--window-size=${scene.width},${scene.height}`,"about:blank"],{stdio:"ignore"});
  try {
    let page;
    for(let i=0;i<75 && !page;i++){try{page=(await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t=>t.type==="page");}catch(e){}if(!page)await sleep(200);}
    if(!page)throw new Error("The browser did not start its debugging endpoint.");
    const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((ok,fail)=>{ws.onopen=ok;ws.onerror=fail;});
    let id=0;const pending=new Map();
    ws.onmessage=m=>{const d=JSON.parse(m.data);if(d.id && pending.has(d.id)){pending.get(d.id)(d);pending.delete(d.id);}};
    const send=(method,params={})=>new Promise((ok,fail)=>{const i=++id;pending.set(i,d=>d.error ? fail(new Error(method+": "+d.error.message)) : ok(d.result));ws.send(JSON.stringify({id:i,method,params}));});
    await send("Emulation.setDeviceMetricsOverride",{width:scene.width,height:scene.height,deviceScaleFactor:1,mobile:false});
    await send("Page.navigate",{url:"data:text/html,<html><body style='margin:0'></body></html>"});await sleep(300);
    for(let i=0;i<svgs.length;i++) {
      await send("Runtime.evaluate",{expression:`document.body.innerHTML=${JSON.stringify(svgs[i])};new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`,awaitPromise:true});
      const shot=await send("Page.captureScreenshot",{format:"png",clip:{x:0,y:0,width:scene.width,height:scene.height,scale:1}});
      fs.writeFileSync(path.join(dir,`f${String(i).padStart(3,"0")}.png`),Buffer.from(shot.data,"base64"));
    }
    ws.close();
  } finally { browser.kill(); }
}

async function main() {
  const wanted=process.argv.slice(2),selected=wanted.length ? scenes.filter(s=>wanted.includes(s.name)) : scenes;
  if(!selected.length)throw new Error("Unknown scene. Available: "+scenes.map(s=>s.name).join(", "));
  execFileSync("ffmpeg",["-hide_banner","-version"],{stdio:"ignore"});
  fs.mkdirSync(target,{recursive:true});
  for(const scene of selected) {
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),`gif-${scene.name}-`));
    try {
      const svgs=scene.frames();
      await render(scene,svgs,dir);
      const frames=path.join(dir,"f%03d.png"),palette=path.join(dir,"palette.png"),gif=path.join(target,scene.name+".gif");
      execFileSync("ffmpeg",["-hide_banner","-loglevel","error","-y","-framerate",String(scene.fps),"-i",frames,"-vf","palettegen=max_colors=96:stats_mode=full",palette]);
      execFileSync("ffmpeg",["-hide_banner","-loglevel","error","-y","-framerate",String(scene.fps),"-i",frames,"-i",palette,"-lavfi","paletteuse=dither=sierra2_4a","-loop","0",gif]);
      console.log(`Wrote ${path.relative(process.cwd(),gif)} (${svgs.length} frames, ${Math.round(fs.statSync(gif).size/1024)} KB)`);
    } finally { fs.rmSync(dir,{recursive:true,force:true}); }
  }
}
main().catch(error=>{console.error(error.message);process.exit(1);});
