// One document-wide ink layer. Each stroke follows the content block it marks.
function createPageInk({pageId,navigate,pageNumber,pageCount}) {
  const canvas=document.querySelector('#page-ink');
  const toolbar=document.querySelector('#ink-toolbar');
  const opener=document.querySelector('#ink-open');
  const contexts=new Map();
  let mode='browse', color='#205fba', opened=false, busy=false;
  let current=null, pointerId=null, frame=0, pixelWidth=0, pixelHeight=0;
  toolbar.innerHTML=`<span class="ink-label">整页批注</span><button id="ink-browse" title="浏览和操作页面 (Esc)">浏览</button><button id="ink-pen" title="画笔 (B)">画笔</button><button id="ink-eraser">橡皮</button><span class="ink-separator"></span><button class="ink-color" data-color="#205fba" aria-label="蓝色画笔" style="--swatch:#205fba"></button><button class="ink-color" data-color="#bd5059" aria-label="红色画笔" style="--swatch:#bd5059"></button><span class="ink-separator"></span><button id="ink-undo">撤销</button><button id="ink-clear">清除本页</button><span class="ink-separator"></span><button id="ink-previous" aria-label="批注时上一页">←</button><button id="ink-next" aria-label="批注时下一页">→</button><button id="ink-close" aria-label="收起批注工具">×</button>`;
  function page() {
    const id=pageId();
    if(!contexts.has(id)) {
      let strokes=[];
      try {const saved=JSON.parse(localStorage.getItem(DATA.meta.inkStorage+id)||'null');if(Array.isArray(saved))strokes=saved.filter(s=>s&&typeof s.anchor==='string'&&Array.isArray(s.points)&&s.points.length&&s.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)));}catch{}
      contexts.set(id,{strokes,history:[]});
    }
    return contexts.get(id);
  }
  function save() {try{localStorage.setItem(DATA.meta.inkStorage+pageId(),JSON.stringify(page().strokes));}catch{}}
  function remember() {const p=page();p.history.push(JSON.stringify(p.strokes));if(p.history.length>25)p.history.shift();}
  function tagAnchors() {
    const anchors=[['.header','header'],['#module-nav','nav'],['.bottom','footer'],['#stage > .eyebrow','kicker'],['.page-heading','heading'],['.core','core'],['.reveal-row','reveal'],['.takeaway','takeaway'],['.figure-body','figure'],['.figure-caption','caption'],['.practice-label','question-label'],['.practice-stem','question'],['.response','response'],['.exercise-actions','actions'],['.hint','hint'],['.answer','answer'],['.source','source'],['.hero h1','hero-title'],['.hero-sub','hero-subtitle'],['.hero-actions','hero-actions'],['.hero-art','hero-figure'],['.hero-foot','hero-contents']];
    for(const [selector,key] of anchors) {const el=document.querySelector(selector);if(el)el.dataset.inkAnchor=key;}
    document.querySelectorAll('#stage .steps .step').forEach((el,i)=>el.dataset.inkAnchor='step-'+i);
  }
  function boxFor(key) {
    if(key==='page')return {left:0,top:0,width:Math.max(1,document.documentElement.clientWidth),height:1};
    const el=document.querySelector('[data-ink-anchor="'+CSS.escape(key)+'"]');
    if(!el)return null;
    const r=el.getBoundingClientRect();
    return {left:r.left+scrollX,top:r.top+scrollY,width:Math.max(1,r.width),height:Math.max(1,r.height)};
  }
  function anchorAt(e) {
    for(const el of document.elementsFromPoint(e.clientX,e.clientY)) {
      if(el===canvas||toolbar.contains(el))continue;
      const anchor=el.closest('[data-ink-anchor]');
      if(anchor)return anchor.dataset.inkAnchor;
    }
    return 'page';
  }
  function worldPoints(stroke) {
    const r=boxFor(stroke.anchor);if(!r)return [];
    return stroke.points.map(([x,y])=>[r.left+x*r.width,r.top+y*r.height]);
  }
  function paint(stroke,tail=false) {
    let points=worldPoints(stroke);if(!points.length)return;
    if(tail)points=points.slice(-2);
    const ctx=canvas.getContext('2d');ctx.strokeStyle=stroke.color;ctx.fillStyle=stroke.color;ctx.lineWidth=stroke.width;ctx.lineCap='round';ctx.lineJoin='round';
    if(points.length===1){ctx.beginPath();ctx.arc(...points[0],stroke.width/2,0,Math.PI*2);ctx.fill();return;}
    ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
  }
  function repaint() {
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,pixelWidth,pixelHeight);
    for(const stroke of page().strokes)paint(stroke);
    if(current?.stroke)paint(current.stroke);
  }
  function layout() {
    frame=0;if(matchMedia('print').matches)return;
    tagAnchors();
    const shell=document.querySelector('.shell'),r=shell.getBoundingClientRect();
    const width=document.documentElement.clientWidth,height=Math.max(innerHeight,Math.ceil(r.bottom+scrollY));
    const dpr=Math.min(devicePixelRatio||1,2);
    canvas.style.width=width+'px';canvas.style.height=height+'px';
    if(pixelWidth!==width||pixelHeight!==height||canvas.width!==Math.round(width*dpr)) {
      pixelWidth=width;pixelHeight=height;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.getContext('2d').setTransform(dpr,0,0,dpr,0,0);
    }
    repaint();sync();
  }
  function schedule() {if(!frame)frame=requestAnimationFrame(layout);}
  function sync() {
    toolbar.hidden=!opened;
    canvas.classList.toggle('enabled',mode!=='browse'&&!busy);
    canvas.classList.toggle('erasing',mode==='eraser');
    opener.classList.toggle('active',opened);opener.setAttribute('aria-expanded',String(opened));
    for(const name of ['browse','pen','eraser']) {const b=document.querySelector('#ink-'+name);b.classList.toggle('on',mode===name);b.setAttribute('aria-pressed',String(mode===name));}
    toolbar.querySelectorAll('[data-color]').forEach(b=>{const selected=b.dataset.color===color;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
    document.querySelector('#ink-undo').disabled=!page().history.length;
    document.querySelector('#ink-clear').disabled=!page().strokes.length;
    document.querySelector('#ink-previous').disabled=pageNumber()===0;
    document.querySelector('#ink-next').disabled=pageNumber()===pageCount()-1;
  }
  function finish() {
    if(current?.stroke&&current.stroke.points.length) {
      remember();page().strokes.push(current.stroke);save();
    } else if(current?.changed)save();
    current=null;
    if(pointerId!==null&&canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);
    pointerId=null;sync();
  }
  function setMode(next) {finish();mode=next;sync();}
  function point(e) {
    const r=boxFor(current.stroke.anchor);if(!r)return;
    const x=(e.clientX+scrollX-r.left)/r.width,y=(e.clientY+scrollY-r.top)/r.height;
    current.stroke.points.push([x,y]);paint(current.stroke,true);
  }
  function distance(x,y,a,b) {
    const dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;
    const t=len?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/len)):0;
    return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
  }
  function erase(e) {
    const x=e.clientX+scrollX,y=e.clientY+scrollY,p=page();
    const kept=p.strokes.filter(s=>{const pts=worldPoints(s);return !pts.some((a,i)=>distance(x,y,a,pts[i+1]||a)<12);});
    if(kept.length!==p.strokes.length) {
      if(!current.changed)remember();current.changed=true;p.strokes=kept;repaint();
    }
  }
  canvas.addEventListener('pointerdown',e=>{
    if(mode==='browse'||busy||e.button!==0)return;
    e.preventDefault();canvas.focus({preventScroll:true});finish();pointerId=e.pointerId;canvas.setPointerCapture(pointerId);
    if(mode==='pen') {current={stroke:{anchor:anchorAt(e),color,width:Number(document.querySelector("#ink-size")?.value||2.8),points:[]}};point(e);}
    else {current={changed:false};erase(e);}
  });
  canvas.addEventListener('pointermove',e=>{
    if(!current)return;e.preventDefault();
    if(current.stroke){const events=e.getCoalescedEvents?.()||[];for(const ev of events.length?events:[e])point(ev);}
    else erase(e);
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{if(current)finish();});
  opener.onclick=()=>{opened=!opened;setMode(opened?'pen':'browse');};
  document.querySelector('#ink-close').onclick=()=>{opened=false;setMode('browse');};
  for(const name of ['browse','pen','eraser'])document.querySelector('#ink-'+name).onclick=()=>setMode(name);
  toolbar.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{color=b.dataset.color;setMode('pen');});
  document.querySelector('#ink-undo').onclick=()=>{finish();const p=page();if(p.history.length){p.strokes=JSON.parse(p.history.pop());save();repaint();sync();}};
  document.querySelector('#ink-clear').onclick=()=>{finish();if(page().strokes.length){remember();page().strokes=[];save();repaint();sync();}};
  document.querySelector('#ink-previous').onclick=()=>navigate(-1);
  document.querySelector('#ink-next').onclick=()=>navigate(1);
  window.addEventListener('keydown',e=>{
    if(e.ctrlKey||e.metaKey||e.altKey||document.querySelector('#modal').open||/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))return;
    if(e.key==='Escape'&&opened) {e.preventDefault();if(mode==='browse')opened=false;setMode('browse');}
    if(e.key.toLowerCase()==='b') {e.preventDefault();opened=true;setMode(mode==='pen'?'browse':'pen');}
  });
  new ResizeObserver(schedule).observe(document.querySelector('.shell'));
  window.addEventListener('resize',schedule);
  window.addEventListener('afterprint',schedule);
  sync();
  return {canvas,finish,update:schedule,repaint:layout,
    dump(){
      finish();const out={};
      for(const [id,p] of contexts)out[id]=p.strokes;
      try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith(DATA.meta.inkStorage)){const id=k.slice(DATA.meta.inkStorage.length);if(!(id in out))out[id]=JSON.parse(localStorage.getItem(k)||'[]');}}}catch{}
      return out;
    },
    restore(all){
      finish();if(!all||typeof all!=='object'||Array.isArray(all))throw new Error('批注结构无效。');
      const accepted=[];
      for(const [id,strokes] of Object.entries(all)){
        if(!PAGES.some(p=>p.id===id)||!Array.isArray(strokes)||strokes.length>10000)throw new Error('批注页或笔画格式无效。');
        for(const s of strokes)if(!s||typeof s.anchor!=='string'||!Array.isArray(s.points)||s.points.length>100000||!s.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))||!['#205fba','#bd5059'].includes(s.color)||!Number.isFinite(s.width)||s.width<1||s.width>12)throw new Error('批注笔画无效。');
        accepted.push([id,strokes]);
      }
      for(const[id,strokes]of accepted){contexts.set(id,{strokes,history:[]});try{localStorage.setItem(DATA.meta.inkStorage+id,JSON.stringify(strokes));}catch{}}
      layout();
    },
    setBusy(value){finish();busy=value;sync();},get mode(){return mode;},get strokes(){return page().strokes;}};
}
