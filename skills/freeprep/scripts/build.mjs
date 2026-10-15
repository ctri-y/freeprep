#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const args=process.argv.slice(2),source=args[0],outFlag=args.indexOf('--out');
if(!source || outFlag<0 || !args[outFlag+1]) {
  console.error('Usage: node build.mjs course.json --out dist/index.html');
  process.exit(2);
}
const input=path.resolve(source),output=path.resolve(args[outFlag+1]);
const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const engine=path.join(skill,'assets/html-player');
const data=JSON.parse(fs.readFileSync(input,'utf8'));
if(data.schema_version!==1 || !data.meta?.id || !data.pages?.length || !Array.isArray(data.questions)) throw Error('Invalid course: expected schema_version 1, meta.id, pages and questions');
const ids=data.pages.map(p=>p.id);
if(ids.length!==new Set(ids).size) throw Error('Duplicate page ID');
if(data.pages.some(p=>!data.meta.modules[p.module])) throw Error('Unknown module');
const supported=new Set(['chart','numberline','table','map','demo','compound','image']);
function checkDiagram(f) {
  if(!f || !supported.has(f.type)) throw Error(`Unsupported diagram: ${f?.type}`);
  if(f.type==='compound') f.parts.forEach(checkDiagram);
}
for(const page of data.pages) checkDiagram(page.diagram);
for(const q of data.questions) if(q.solution_diagram) checkDiagram(q.solution_diagram);
// Namespace notes by stable course ID. Rebuilds preserve them; different courses don't collide.
data.meta.storage=`freeprep:${data.meta.id}:draft:`;
data.meta.inkStorage=`freeprep:${data.meta.id}:ink:`;
data.meta.notesFormat=`freeprep-notes:${data.meta.id}`;
data.assets??={}; data.sourceScans??={}; data.hints??={};
for(const [id,a] of Object.entries(data.assets)) {
  if(!a.file) throw Error(`Asset ${id}: expected a local file`);
  const file=path.resolve(path.dirname(input),a.file),ext=path.extname(file).toLowerCase();
  const mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'}[ext];
  if(!mime) throw Error(`Asset ${id}: use PNG, JPEG or WebP; create SVG diagrams in the renderer`);
  data.assets[id]={label:a.label,source:a.source,src:`data:${mime};base64,${fs.readFileSync(file).toString('base64')}`};
}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=name=>fs.readFileSync(path.join(engine,name),'utf8');
const css=read('base.css')+'\n'+read('extra.css')+'\n'+read('public.css');
const js=['diagrams.js','annotations.js','solutions.js','app.js'].map(read).join('\n');
const values={TITLE:escape(data.meta.title),DESCRIPTION:escape(data.meta.scope),STYLE:css,DATA:JSON.stringify(data).replace(/</g,'\\u003c'),APP:js};
const notice='<!--\nFreePrep HTML player license; course content retains its own rights.\n\n'+fs.readFileSync(path.join(skill,'LICENSE.txt'),'utf8').trim()+'\n-->\n';
const html=notice+read('template.html').replace(/\/\*(TITLE|DESCRIPTION|STYLE|DATA|APP)\*\//g,(_,key)=>values[key]);
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,html);
const siblings={
  'storyboard.json':{meta:data.meta,pages:data.pages},
  'sources.json':data.sources,
};
for(const [name,value] of Object.entries(siblings)) fs.writeFileSync(path.join(path.dirname(output),name),JSON.stringify(value,null,2)+'\n');
const teacher=[`# ${data.meta.title} · 教师解析\n`];
for(const q of data.questions) {
  teacher.push(`## ${q.id} · ${q.title}\n\n${q.question}\n\n${q.citation_label}\n\n答案：${q.answer}\n\n推理：${q.reasoning}\n`);
  if(q.solution) teacher.push(`已知：${q.solution.known}\n\n所求：${q.solution.goal}\n\n`+q.solution.steps.map((s,i)=>`${i+1}. ${s.formula}\n\n   ${s.why}`).join('\n\n')+`\n\n核对：${q.solution.check}\n\n易错：${q.solution.pitfalls}\n`);
}
fs.writeFileSync(path.join(path.dirname(output),'teacher-solutions.md'),teacher.join('\n'));
console.log(`Built ${data.pages.length} pages / ${data.questions.length} questions → ${output}`);
