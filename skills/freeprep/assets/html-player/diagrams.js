// SVG coordinates point downwards; world coordinates for data plots point upwards.
const C = {ink:'#102b50',blue:'#205fba',pale:'#e9f2fc',line:'#b8cbe1',muted:'#667b92',warm:'#b66c47'};
const E = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let figureSerial = 0;
function tx(x,y,value,size=18,color=C.ink,anchor='middle') {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}">${E(value)}</text>`;
}
function ln(x1,y1,x2,y2,color=C.blue,width=2,arrow=false) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ${arrow?'marker-end="url(#arrow)"':''}/>`;
}
function svg(body,label,height=420) {
  const id = `fp-arrow-${++figureSerial}`;
  return `<svg viewBox="0 0 640 ${height}" role="img" aria-label="${E(label)}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="${id}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="8" markerHeight="8" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 10 5 0 10Z" fill="context-stroke"/></marker></defs>${body.replaceAll('url(#arrow)',`url(#${id})`)}</svg>`;
}
function plot(f) {
  const {xmin=0,xmax=5,ymin=0,ymax=5} = f;
  if (![xmin,xmax,ymin,ymax].every(Number.isFinite) || xmax<=xmin || ymax<=ymin) throw Error('Invalid plot bounds');
  const L=88,R=540,T=68,B=325;
  const X=x=>L+(x-xmin)/(xmax-xmin)*(R-L),Y=y=>B-(y-ymin)/(ymax-ymin)*(B-T);
  const xt=f.xt??Array.from({length:6},(_,i)=>+(xmin+(xmax-xmin)*i/5).toFixed(2));
  const yt=f.yt??Array.from({length:6},(_,i)=>+(ymin+(ymax-ymin)*i/5).toFixed(2));
  const axisY=ymin<=0&&ymax>=0?Y(0):B,axisX=xmin<=0&&xmax>=0?X(0):L;
  let body='';
  if(f.grid!==false) {
    for(const x of xt) body+=ln(X(x),B,X(x),T,'#d9e4f1',1);
    for(const y of yt) body+=ln(L,Y(y),R,Y(y),'#d9e4f1',1);
  }
  body+=`<g data-axis="x" data-positive-direction="right">${ln(L,axisY,R+28,axisY,C.ink,2,true)}</g>`;
  body+=`<g data-axis="y" data-positive-direction="up">${ln(axisX,B,axisX,T-24,C.ink,2,true)}</g>`;
  for(const x of xt) body+=ln(X(x),axisY,X(x),axisY+5,C.ink,1)+tx(X(x),axisY+25,x,14,C.muted);
  for(const y of yt) body+=ln(axisX-5,Y(y),axisX,Y(y),C.ink,1)+tx(axisX-12,Y(y)+5,y,14,C.muted,'end');
  body+=tx(R+28,Math.min(402,axisY+59),f.xlabel||'x',16,C.ink,'end');
  body+=tx(28,28,f.ylabel||'y',16,C.ink,'start');
  return {body,X,Y,L,R,T,B};
}
function pathFor(points,p) {
  return points.map(([x,y],i)=>`${i?'L':'M'}${p.X(x)} ${p.Y(y)}`).join(' ');
}
function chartGraphic(f,level=0) {
  const p=plot(f);
  let body=p.body;
  for(const area of f.areas||[]) body+=`<path d="${pathFor(area,p)}Z" fill="${C.blue}" fill-opacity=".12"/>`;
  const series=f.series||[{points:f.points||[]}];
  for(const [i,s] of series.entries()) {
    const color=i%2?C.warm:C.blue;
    body+=`<path data-series="${i}" d="${pathFor(s.points,p)}" fill="none" stroke="${color}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/>`;
    if(s.name) body+=tx(375+i*110,48,s.name,16,color);
  }
  if(level>0 && f.revealPoints) body+=`<path data-reveal="solution" d="${pathFor(f.revealPoints,p)}" fill="none" stroke="${C.blue}" stroke-width="3.2"/>`;
  for(const label of f.labels||[]) body+=tx(p.X(label.x),p.Y(label.y),label.text,16);
  return svg(body,f.caption||`${f.ylabel||'y'} 随 ${f.xlabel||'x'} 变化`);
}
function numberline(f,level=0) {
  const x0=f.xmin??-2,x1=f.xmax??8,X=x=>95+(x-x0)/(x1-x0)*450;
  let body=ln(70,235,575,235,C.ink,2,true)+tx(575,280,f.xlabel||'x / m',18,C.ink,'end');
  for(let x=Math.ceil(x0);x<=x1;x++) body+=ln(X(x),230,X(x),240,C.ink,1)+tx(X(x),265,x,16,C.muted);
  for(const [i,point] of (f.positions||[]).entries()) body+=`<circle cx="${X(point.x)}" cy="235" r="5" fill="${C.blue}"/>`+tx(X(point.x),200-i%2*25,point.label,19,C.blue);
  if(level>0) for(const [i,route] of (f.routes||[]).entries()) body+=ln(X(route[0]),110+i*35,X(route[1]),110+i*35,i%2?C.warm:C.blue,3,true);
  return svg(body,f.caption||'一维位置与方向示意');
}
function tableGraphic(f) {
  const rows=[f.headers,...f.rows];
  return `<table class="data-table"><caption class="sr-only">${E(f.caption||'数据表')}</caption><thead><tr>${rows[0].map(s=>`<th scope="col">${E(s)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map(row=>`<tr>${row.map(s=>`<td>${E(s)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function mapGraphic(f) {
  return `<div class="fp-map">${f.items.map((item,i)=>`<div><span>${String(i+1).padStart(2,'0')}</span><strong>${E(item.title)}</strong><p>${E(item.text)}</p></div>`).join('')}</div>`;
}
function demo(f) {
  const lab=pageState().lab,v0=lab.v0??f.v0??2,a=lab.a??f.a??1,t=4;
  const points=Array.from({length:41},(_,i)=>{const t=i/10;return[t,v0+a*t];});
  const input=(key,min,max,step,value,label)=>`<label>${E(label)}<input data-lab="${key}" aria-label="${E(label)}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"><output>${value}</output></label>`;
  return chartGraphic({points,xmax:4,ymin:-8,ymax:12,xt:[0,1,2,3,4],yt:[-8,-4,0,4,8,12],xlabel:'t / s',ylabel:'v / (m·s⁻¹)'})+`<div class="lab-controls">${input('v0',0,4,1,v0,'初速度 v₀ / (m/s)')}${input('a',-2,2,.5,a,'加速度 a / (m/s²)')}<p class="diagram-equation">4 s 末：v = ${v0+a*t} m/s；Δx = ${v0*t+.5*a*t*t} m</p><p class="diagram-small">理想直线运动模型，允许反向；演示不计入独立练习。</p></div>`;
}
function graphic(f,level=0) {
  if(f.type==='chart') return chartGraphic(f,level);
  if(f.type==='numberline') return numberline(f,level);
  if(f.type==='table') return tableGraphic(f);
  if(f.type==='map') return mapGraphic(f);
  if(f.type==='demo') return demo(f);
  if(f.type==='compound') return `<div class="compound">${f.parts.map(p=>graphic(p,level)).join('')}</div>`;
  if(f.type==='image') {
    const asset=DATA.assets[f.asset];
    if(!asset) throw Error(`Missing asset: ${f.asset}`);
    return `<button class="image-zoom" data-zoom="${E(f.asset)}"><img src="${E(asset.src)}" alt="${E(f.caption||asset.label)}"></button>`;
  }
  throw Error(`Unsupported diagram type: ${f.type}`);
}
function figureHTML(d,{forceLevel,forPrint=false}={}) {
  const level=forPrint?0:forceLevel??(d.kind==='practice'?pageState(d.id).review:pageState(d.id).step);
  return `<div class="native-figure">${graphic(d.diagram,level)}</div>`;
}
const FIGURES=Object.fromEntries(DATA.pages.map(d=>[d.id,[null,d.diagram?.title||'观察与推理',d.diagram?.caption||'FreePrep 原创教学示意；未标数字的长度不作测量依据。']]));
