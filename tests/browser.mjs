import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const results=path.join(root,'test-results');
fs.mkdirSync(results,{recursive:true});
const data=JSON.parse(fs.readFileSync(path.join(root,'examples/motion/course.json'),'utf8'));
const browser=await chromium.launch({headless:true,...(process.env.FREEPREP_BROWSER_CHANNEL?{channel:process.env.FREEPREP_BROWSER_CHANNEL}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const navigate=async id=>{await page.evaluate(id=>go(PAGES.findIndex(p=>p.id===id)),id);};
try {
  await page.goto(pathToFileURL(path.join(root,'dist/index.html')).href);
  await page.waitForSelector('#stage h1');
  await page.context().setOffline(true);
  await page.reload();
  await page.waitForSelector('#stage h1');
  // Rapid requests resolve to the latest destination with usable controls.
  await page.evaluate(async()=>{go(1);go(2);await go(3);});
  assert.equal(await page.evaluate(()=>PAGES[index].id),'Q01');
  assert.equal(await page.evaluate(()=>stage.inert||stage.hasAttribute('aria-busy')),false);
  assert.equal(await page.locator('.answer').count(),0);
  await page.locator('#response').fill('先画位置，再计算。');
  await page.locator('#hint-toggle').click();
  assert.equal(await page.locator('.answer-result').count(),0);
  await page.locator('#review-next').click();
  assert.equal(await page.locator('.answer').count(),1);
  assert.equal(await page.locator('.answer-result').count(),0);
  await page.locator('#review-next').click();
  assert.equal(await page.locator('.answer-result').count(),1);
  await page.locator('#review-next').click();
  await page.locator('#source-open').click();
  assert.match(await page.locator('#modal-content').innerText(),/原创/);
  assert.equal(await page.locator('#modal-content a').count(),0);
  await page.locator('#modal-close').click();
  // Full-page ink works over the header, outside any exercise response area.
  await page.locator('#ink-open').click();
  await page.mouse.move(420,38);await page.mouse.down();await page.mouse.move(535,58,{steps:8});await page.mouse.up();
  assert.equal(await page.evaluate(()=>pageInk.strokes.length),1);
  await page.locator('#ink-browse').click();
  await page.locator('#ink-undo').click();
  assert.equal(await page.evaluate(()=>pageInk.strokes.length),0);
  await page.locator('#ink-pen').click();
  await page.mouse.move(420,40);await page.mouse.down();await page.mouse.move(540,60,{steps:8});await page.mouse.up();
  await page.locator('#ink-browse').click();
  const download=page.waitForEvent('download');
  await page.locator('#ink-export').click();
  await (await download).saveAs(path.join(results,'roundtrip-notes.json'));
  const exported=JSON.parse(fs.readFileSync(path.join(results,'roundtrip-notes.json'),'utf8'));
  assert.equal(exported.drafts.Q01,'先画位置，再计算。');
  assert.equal(exported.ink.Q01.length,1);
  await page.reload();await page.waitForSelector('#stage h1');
  assert.equal(await page.locator('#response').inputValue(),'先画位置，再计算。');
  assert.equal(await page.evaluate(()=>pageInk.strokes.length),1);
  await page.locator('#ink-open').click();await page.locator('#ink-browse').click();
  await page.locator('#ink-clear').click();
  await page.locator('#ink-file').setInputFiles(path.join(results,'roundtrip-notes.json'));
  await page.waitForSelector('#modal[open]');
  assert.equal(await page.locator('#modal-title').innerText(),'批注已导入');
  await page.locator('#modal-close').click();
  assert.equal(await page.evaluate(()=>pageInk.strokes.length),1);
  const foreign={...exported,format:'freeprep-notes:another-course'};
  await page.locator('#ink-file').setInputFiles({name:'foreign.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(foreign))});
  await page.waitForSelector('#modal[open]');
  assert.equal(await page.locator('#modal-title').innerText(),'无法导入');
  await page.locator('#modal-close').click();
  assert.equal(await page.evaluate(()=>pageInk.strokes.length),1);
  await page.locator('#ink-clear').click();await page.locator('#ink-close').click();
  // Search reaches a specific question; solution control opens the matching page.
  await page.locator('#directory-open').click();await page.locator('#search').fill('Q02');
  assert.ok(await page.locator('.directory-item').count()>0);
  await page.locator('#modal-close').click();
  await navigate('Q02');await page.locator('#review-next').click();await page.locator('#solution-open').click();
  await page.waitForFunction(()=>PAGES[index].id==='SOL-Q02'&&!stage.inert);
  assert.equal(await page.locator('.solution-calculation .step').count(),4);
  await page.locator('#solution-step').click();
  assert.equal(await page.locator('.solution-calculation .step').count(),0);
  await page.locator('#solution-step').click();
  assert.equal(await page.locator('.solution-calculation .step').count(),1);
  // Every page, reveal state, axis direction, SVG value and mobile width.
  for(const p of data.pages) {
    await navigate(p.id);
    if(p.kind==='teaching') {
      for(let i=0;i<data.lessons[p.id].steps.length;i++)await page.locator('#reveal-next').click();
    }
    const defects=await page.locator('#stage svg').evaluateAll(svgs=>svgs.flatMap(svg=>{
      const result=[];
      if(/NaN|Infinity|undefined/.test(svg.outerHTML)) result.push('non-finite SVG');
      for(const g of svg.querySelectorAll('[data-axis]')) {
        const line=g.querySelector('line');
        if(!line?.hasAttribute('marker-end')) result.push('missing arrow');
        if(g.dataset.axis==='y' && !(+line.getAttribute('y2')<+line.getAttribute('y1')))result.push('y points down');
        if(g.dataset.axis==='x' && !(+line.getAttribute('x2')>+line.getAttribute('x1')))result.push('x points left');
      }
      return result;
    }));
    assert.deepEqual(defects,[],p.id);
    await page.waitForTimeout(450);
    await page.screenshot({path:path.join(results,p.id+'.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`mobile ${p.id}`);
    await page.setViewportSize({width:1440,height:1000});
  }
  await navigate('T05');
  for(const a of [-2,2])for(const v0 of [0,4]) {
    await page.evaluate(({a,v0})=>{pageState().lab={a,v0};render();},{a,v0});
    assert.match(await page.locator('.diagram-equation').innerText(),new RegExp(`v = ${v0+4*a} m/s`));
  }
  // Printing always rebuilds from initial question diagrams, even after reviews.
  await page.evaluate(()=>{window.print=()=>{};printHandout();});
  assert.equal(await page.locator('.print-page').count(),2);
  assert.equal(await page.locator('#print-view .answer, #print-view [data-reveal=solution], #print-view .solution-calculation').count(),0);
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('.shell').isVisible(),false);
  assert.equal(await page.locator('#print-view').isVisible(),true);
  await page.pdf({path:path.join(results,'student-handout.pdf'),format:'A4',printBackground:true});
  await page.emulateMedia({media:'screen',reducedMotion:'reduce'});
  await navigate('T04');
  assert.equal(await page.evaluate(()=>stage.inert),false);
  await page.locator('#reveal-next').click();await page.locator('#reveal-next').click();
  await page.waitForTimeout(450);
  await page.screenshot({path:path.join(results,'preview.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(results,'report.json'),JSON.stringify({pages:data.pages.length,questions:data.questions.length,offline:true,fadeQueue:true,wholePageInk:true,notesRoundtrip:true,foreignNotesRejected:true,studentPrint:true,axes:true,mobile:true,errors},null,2));
  console.log(`Browser checks passed: ${data.pages.length} pages; offline, fades, ink, notes, SVG, mobile and student print.`);
} finally {
  await browser.close();
}
