import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={};
vm.createContext(context);
vm.runInContext(fs.readFileSync('data.js','utf8')+'\n'+fs.readFileSync('manual-data.js','utf8')+'\nthis.articles=MANUAL_ARTICLES;this.samples=KNOWLEDGE;this.categories=CATEGORIES;',context);
const articles=context.articles;
assert(articles.length>=100,'The complete manual should contain more than 100 readable sections.');
const ids=new Set();const cats=new Set([...context.categories.map(c=>c[0]),'strategy']);let tables=0,characters=0;
for(const a of [...articles,...context.samples]){assert(!ids.has(a.id),`Duplicate article ID ${a.id}`);ids.add(a.id);assert(cats.has(a.cat),`Unmapped category ${a.cat}`);}
for(const a of articles){
 assert(a.title?.trim(),`${a.id} missing title`);assert(a.desc?.trim(),`${a.id} missing preview`);assert(a.source?.part&&a.source?.chapter,`${a.id} missing attribution`);assert(a.blocks.length,`${a.id} missing full content`);
 for(const b of a.blocks){
  assert(['paragraph','heading','table'].includes(b.type),`Unknown block type ${b.type}`);
  if(b.type==='table'){tables++;assert(b.rows.length);for(const row of b.rows){assert(row.length);for(const c of row){assert(typeof c.text==='string');characters+=c.text.length;if(c.colspan)assert(Number.isInteger(c.colspan)&&c.colspan>0);if(c.rowspan)assert(Number.isInteger(c.rowspan)&&c.rowspan>0);}}}
  else{assert(typeof b.text==='string'&&b.text.trim(),`Empty text in ${a.id}`);characters+=b.text.length;}
 }
}
assert.equal(tables,6,'All six original tables must be included.');
assert(characters>190000,'Manual body unexpectedly truncated.');
const html=fs.readFileSync('index.html','utf8');
const htmlIds=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(htmlIds).size,htmlIds.length,'Duplicate UI element IDs');
for(const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)){if(!m[1].startsWith('http'))assert(fs.existsSync(m[1]),`Missing asset ${m[1]}`);}
for(const source of ['app.js','data.js','manual-data.js'])new vm.Script(fs.readFileSync(source,'utf8'));
assert(!fs.readFileSync('manual-data.js','utf8').includes('/Users/'),'Local source paths must not leak into published data.');
console.log(JSON.stringify({status:'PASS',manualArticles:articles.length,totalArticles:ids.size,tables,bodyCharacters:characters,categories:[...new Set(articles.map(a=>a.cat))]},null,2));
