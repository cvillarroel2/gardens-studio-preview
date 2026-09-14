// Exercise garden.resize with the actual vendored Three sizing methods. These
// methods can be run without a WebGL context; canvas writes are the observable
// renderbuffer invalidation seam, and viewport/projection are the invariants.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const garden=fs.readFileSync('garden.js','utf8'),three=fs.readFileSync('vendor/three.module.js','utf8');
function method(name){const prefix='this.'+name+' = function ';const start=three.indexOf(prefix);assert.ok(start>=0);const end=three.indexOf('\n\t\t};',start);return three.slice(start+('this.'+name+' = ').length,end+5)}
function rig(w,h,dpr,cap){const writes=[],views=[];const canvas={};for(const k of ['width','height'])Object.defineProperty(canvas,k,{set:v=>writes.push([k,v])});const renderer={xr:{isPresenting:false},setViewport:(...v)=>views.push(v)};const camera={updateProjectionMatrix(){}};let renders=0;
 const ctx=vm.createContext({window:{devicePixelRatio:dpr},banner:{clientWidth:w,clientHeight:h},renderer,xr:renderer.xr,canvas,camera,shadowCanvas:{},HALF_W:9.7,dprCap:cap,Math,layoutDapple(){},requestRender(){renders++},shadowsDrawnFinal:true,driftBedZ:0,console});
 vm.runInContext('let _width=427,_height=350,_pixelRatio=2;'+['setSize','setPixelRatio','setDrawingBufferSize'].map(k=>'renderer.'+k+'='+method(k)+';').join('\n'),ctx);
 const start=garden.indexOf('function resize() {'),end=garden.indexOf('\n}',start)+2;vm.runInContext(garden.slice(start,end)+'\nresize();',ctx);return {ctx,writes,views,renders};}
for(const [w,h,dpr,cap] of [[440,796,3,1.35],[427,350,3,2],[796,440,3,1.35],[390,713,1,2],[427,350,2,2]])test(`one final buffer allocation at ${w}x${h}, DPR ${dpr}, cap ${cap}`,()=>{const r=rig(w,h,dpr,cap),scale=Math.min(dpr,cap);assert.deepEqual(r.writes,[['width',Math.floor(w*scale)],['height',Math.floor(h*scale)]],'no intermediate old-size allocation');assert.deepEqual(r.views,[[0,0,w,h]]);assert.equal(r.ctx.camera.left,-9.7);assert.equal(r.ctx.camera.right,9.7);assert.ok(Math.abs(r.ctx.camera.top-9.7*h/w)<1e-12);assert.equal(r.ctx.shadowCanvas.width,Math.round(w*scale*.5));assert.equal(r.ctx.shadowCanvas.height,Math.round(h*scale*.5));assert.equal(r.renders,1)});
