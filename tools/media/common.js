"use strict";
// Shared helpers for the illustrative GIF scenes: easing and SVG text.
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;};
const seg=(t,a,b)=>ease((t-a)/(b-a));
const lin=(t,a,b)=>clamp((t-a)/(b-a));
const font=`font-family="-apple-system,Helvetica,Arial,sans-serif"`;
module.exports={clamp,ease,seg,lin,font};
