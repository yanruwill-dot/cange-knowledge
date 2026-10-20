'use strict';
const $=s=>document.querySelector(s);
const KEY='cange-knowledge-v1';
CATEGORIES.push(['strategy','门店与经营策略','◈']);
let sourceScope='all',page=1;
const PAGE_SIZE=12;
const manualArticles=typeof MANUAL_ARTICLES==='undefined'?[]:MANUAL_ARTICLES;
if(manualArticles.length)LEARNING_PATH.splice(0,LEARNING_PATH.length,
 ['认识岗位分工','manual-basic-008','从岗位职责理解协作与交接'],
 ['走通收购流程','manual-basic-018','学习车源进入门店的标准步骤'],
 ['理解检测标准','manual-basic-019','核对车辆检测与事故认定内容'],
 ['掌握销售流程','manual-basic-024','从接待、介绍到试驾与交车'],
 ['做好线索跟进','manual-basic-038','学习客户线索管理与分配'],
 ['建立售后服务意识','manual-basic-030','把交付之后的服务安排清楚'],
 ['用数据复盘经营','manual-basic-042','学习看板指标和转化分析']);
const emptyState=()=>({saved:[],read:[],notes:{},custom:[]});
let state=emptyState(),storageAvailable=true,view='home',category='all',query='',currentId=null,toastTimer;
function normalize(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('备份格式不正确');
 const strings=a=>Array.isArray(a)?[...new Set(a.filter(x=>typeof x==='string'&&x.length<100))]:[];
 const notes={};if(raw.notes&&typeof raw.notes==='object'&&!Array.isArray(raw.notes))for(const [k,v] of Object.entries(raw.notes)){if(typeof v==='string'&&v.length<=50000&&/^[a-zA-Z0-9_-]+$/.test(k))notes[k]=v;}
 const custom=[];if(Array.isArray(raw.custom))for(const a of raw.custom){if(a&&typeof a.id==='string'&&/^custom-[a-zA-Z0-9_-]+$/.test(a.id)&&typeof a.title==='string'&&typeof a.body==='string'&&a.body.length<=500000&&!custom.some(x=>x.id===a.id)){custom.push({id:a.id,title:a.title.slice(0,150),body:a.body,desc:a.body.replace(/[#*\n]/g,' ').slice(0,65),cat:'custom',type:'我的资料',minutes:Math.max(1,Math.ceil(a.body.length/400))});}}
 return{saved:strings(raw.saved),read:strings(raw.read),notes,custom};
}
try{const raw=localStorage.getItem(KEY);if(raw)state=normalize(JSON.parse(raw));}catch(e){storageAvailable=false;}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2800);}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));storageAvailable=true;return true;}catch(e){storageAvailable=false;toast('浏览器存储不可用或空间不足，请立即导出备份');return false;}}
const all=()=>[...manualArticles,...KNOWLEDGE,...state.custom];
const getArticle=id=>all().find(a=>a.id===id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const catName=id=>id==='custom'?'我的资料':CATEGORIES.find(c=>c[0]===id)?.[1]||'知识';
const catIcon=id=>CATEGORIES.find(c=>c[0]===id)?.[2]||'▤';
const SEARCH_ALIASES={purchase:'验车 检测 收车 采购',sales:'销售 成交 话术 咨询',delivery:'交车 交付 费用',service:'售后 回访 客诉',marketing:'获客 拍摄 视频 内容 线索',team:'新人 培训 晨会 团队',data:'数据 经营 看板 库存',risk:'风险 记录 规范'};
const blockText=b=>b.type==='table'?b.rows.flat().map(c=>typeof c==='string'?c:c.text||'').join(' '):b.text||'';
const searchable=a=>[(a.blocks||[]).map(blockText).join(' '),a.source?.chapter||'',a.title,a.desc,SEARCH_ALIASES[a.cat]||'',catName(a.cat),a.body||'',...(a.sections||[]).flat(),...(a.checks||[])].join(' ').toLowerCase();
function matches(a){return(category==='all'||a.cat===category)&&query.toLowerCase().trim().split(/\s+/).every(q=>searchable(a).includes(q))&&(view!=='saved'||state.saved.includes(a.id))&&(view!=='manual'||a.source)&&(sourceScope==='all'||sourceScope==='manual'&&a.source||sourceScope==='examples'&&!a.source&&!a.id.startsWith('custom-')||sourceScope==='custom'&&a.id.startsWith('custom-'));}
function updateCounts(){
 $('#manual-count').textContent=manualArticles.length;$('#category-stat').textContent=String(CATEGORIES.length).padStart(2,'0');$('#nav-count').textContent=all().length;$('#total-stat').textContent=String(all().length).padStart(2,'0');$('#saved-count').textContent=state.saved.filter(getArticle).length;$('#read-stat').textContent=String(state.read.filter(getArticle).length).padStart(2,'0');
 const progress=Math.round(LEARNING_PATH.filter(d=>state.read.includes(d[1])).length/7*100);$('#path-percent').textContent=progress+'%';$('#path-progress').style.width=progress+'%';
}
function render(){
 updateCounts();$('#home-intro').hidden=view!=='home';$('#manual-welcome').hidden=view!=='home';$('#category-tiles').hidden=view!=='home';$('#source-tabs').hidden=view==='path'||view==='manual';$('#pagination').hidden=view==='path'||view==='manual';$('.view-switch').hidden=view==='path'||view==='manual';$('#search-form').hidden=view==='path';$('#filters').hidden=view==='path';$('.view-switch').hidden=view==='path'||view==='manual';
 const title=view==='home'?'每个业务问题，都有一个起点':view==='saved'?'我的收藏':view==='path'?'新人入门 · 7 天学习路径':view==='manual'?'运营手册 · 完整目录':category==='all'?'全部知识':catName(category);
 $('#section-title').textContent=title;$('#crumb').textContent=view==='home'?'知识库首页':title;
 $('#source-tabs').innerHTML=[['all','全部知识'],['manual','运营手册'],['examples','入门示例'],...(state.custom.length?[['custom','我的资料']]:[])].map(([id,label])=>`<button data-source="${id}" class="${sourceScope===id?'active':''}" aria-pressed="${sourceScope===id}">${label}</button>`).join('');
 document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
 document.querySelectorAll('[data-category]').forEach(el=>{el.classList.toggle('active',el.dataset.category===category);el.setAttribute('aria-pressed',String(el.dataset.category===category));});
 if(view==='path'){
  $('#result-status').textContent='建议学习安排 · 以实际掌握情况为准，完成阅读后可标为已读';
  $('#results').innerHTML=LEARNING_PATH.map((d,i)=>`<button class="day-card" data-open="${d[1]}"><span class="day-num">0${i+1}</span><div><h3>${d[0]}</h3><p>第 ${i+1} 天 · ${d[2]}</p></div><span class="day-state">${state.read.includes(d[1])?'✓ 已完成':'开始学习 ↗'}</span></button>`).join('');return;
 }
 const items=all().filter(matches);
 $('#result-status').textContent=`共 ${items.length} 篇内容${query?' · 搜索“'+query+'”':''} · 手册原文与入门示例分开标注`;
 if(view==='manual'){renderDirectory(items);return;}
 const pages=Math.max(1,Math.ceil(items.length/PAGE_SIZE));page=Math.min(page,pages);
 const visible=items.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
 $('#results').innerHTML=visible.length?visible.map(articleCard).join(''):`<div class="empty"><strong>${view==='saved'?'还没有符合条件的收藏':'没有找到相关内容'}</strong><br>试试其他关键词，或切换内容来源。<button id="clear-filters">清除搜索与筛选 →</button></div>`;
 $('#pagination').innerHTML=items.length>PAGE_SIZE?`<button data-page="${page-1}" ${page===1?'disabled':''}>← 上一页</button><span>第 ${page} / ${pages} 页 · 共 ${items.length} 篇</span><button data-page="${page+1}" ${page===pages?'disabled':''}>下一页 →</button>`:'';
}
function articleCard(a){return `<article class="article-card ${a.source?'manual-card':''}"><button class="article-open" data-open="${esc(a.id)}"><div class="card-meta"><span class="category-icon" aria-hidden="true">${catIcon(a.cat)}</span><span class="card-type">${a.source?'手册原文 · '+esc(a.source.part):esc(a.type)}</span></div><h3>${esc(a.title)}</h3><p>${esc(a.desc)}</p></button><div class="card-bottom"><span>${catName(a.cat)}</span><span>${a.minutes} 分钟</span>${state.read.includes(a.id)?'<span class="read-badge">已读</span>':''}<button data-save="${esc(a.id)}" class="${state.saved.includes(a.id)?'saved':''}" aria-label="${state.saved.includes(a.id)?'取消收藏':'收藏'}：${esc(a.title)}" aria-pressed="${state.saved.includes(a.id)}">${state.saved.includes(a.id)?'★':'☆'}</button></div></article>`;}
function renderDirectory(items){
 const groups=new Map();for(const a of items){const key=a.source.part==='基础运营篇'?a.source.part+' / '+a.source.chapter:a.source.part+' / '+catName(a.cat);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(a);}
 $('#results').innerHTML=groups.size?[...groups].map(([name,articles],i)=>`<details class="chapter-group" ${query||i===0?'open':''}><summary><span class="chapter-number">${String(i+1).padStart(2,'0')}</span><strong>${esc(name)}</strong><span>${articles.length} 篇</span></summary><div>${articles.map(a=>`<button class="directory-link" data-open="${esc(a.id)}"><span>${esc(a.title)}</span><small>${a.minutes} 分钟 ${state.read.includes(a.id)?'· 已读':'↗'}</small></button>`).join('')}</div></details>`).join(''):'<div class="empty">没有找到相关章节，请换一个关键词。</div>';

}
function pageHash(){return '#'+view+(category!=='all'?'/'+category:'')+(sourceScope!=='all'?'?source='+sourceScope:'');}
function navigate(next,cat='all',push=true){view=next;category=cat;query='';page=1;if(next==='manual')sourceScope='all';$('#search').value='';$('.sidebar').classList.remove('open');if(push)history.pushState(null,'',pageHash());render();if(push)window.scrollTo({top:0,behavior:'auto'});}
function toggleSave(id){if(state.saved.includes(id))state.saved=state.saved.filter(x=>x!==id);else state.saved.push(id);persist();render();if(currentId===id)updateReaderTools();}
function updateReaderTools(){const saved=state.saved.includes(currentId),read=state.read.includes(currentId);$('#save-article').textContent=saved?'★ 已收藏':'☆ 收藏';$('#save-article').setAttribute('aria-pressed',saved);$('#mark-read').textContent=read?'✓ 已读 · 点击撤销':'✓ 标为已读';$('#mark-read').setAttribute('aria-pressed',read);}
function openArticle(id,updateHash=true){
 const a=getArticle(id);if(!a)return;currentId=id;
 $('#reader-title').textContent=a.title;$('#reader-category').textContent=catName(a.cat);
 $('#reader-meta').textContent=`${a.source?a.source.part:a.type} · 约 ${a.minutes} 分钟阅读`;
 $('#reader-source').hidden=!a.source;
 $('#reader-source').innerHTML=a.source?`<span>原文收录</span><p>来源：《${esc(a.source.title)}》电子版<br>${esc(a.source.part)} · ${esc(a.source.chapter)}<br>用户提供 · 原文件标注“周小勇”</p><small>保留原文内容；案例、数据与制度条款请结合实际核验。${a.id==='manual-basic-055'?'本节为模板名称清单，原文件未附这些模板文件。':''}</small>`:'';
 if(a.blocks){$('#reader-body').innerHTML=a.blocks.map((b,i)=>{const name=a.title.replace(/^原文第\d+篇[：:]/,'');if(i<2&&b.type==='heading'&&(b.text===name||b.text===a.source.chapter))return '';return renderBlock(b,i);}).join('');}
 else if(a.body){$('#reader-body').innerHTML=`<div style="white-space:pre-wrap">${esc(a.body)}</div><div class="article-origin">你导入的个人资料 · 仅保存在当前浏览器</div>`;}
 else{$('#reader-body').innerHTML=a.sections.map((s,i)=>`<h3 id="section-${i}">${esc(s[0])}</h3><p>${esc(s[1])}</p>`).join('')+`<h3 id="section-actions">行动清单</h3><ul>${a.checks.map(c=>`<li>${esc(c)}</li>`).join('')}</ul><div class="article-origin">原创入门示例 · 待结合门店实际审核完善。</div>`;}
 const headings=[...$('#reader-body').querySelectorAll('h3,h4')];
 $('#reader-toc').innerHTML=`<details ${window.matchMedia('(max-width:760px)').matches?'':'open'}><summary>本篇目录 <span>${headings.length} 节</span></summary><nav>${headings.length?headings.map(h=>`<button data-section="${h.id}">${esc(h.textContent)}</button>`).join(''):'<p>本篇可直接顺序阅读。</p>'}</nav></details><div class="toc-end">读完后标记「已读」<br>收藏与笔记会自动保存</div>`;
 const peers=a.source?manualArticles:KNOWLEDGE;const idx=peers.findIndex(x=>x.id===a.id);
 $('#reader-next').innerHTML=idx<0?'':[(idx>0?`<button data-open="${peers[idx-1].id}"><small>← 上一篇</small><span>${esc(peers[idx-1].title)}</span></button>`:'<div></div>'),(idx<peers.length-1?`<button data-open="${peers[idx+1].id}"><small>下一篇 →</small><span>${esc(peers[idx+1].title)}</span></button>`:'<div></div>')].join('');
 $('#note').value=state.notes[id]||'';$('#note-status').textContent='仅保存到当前浏览器，不会公开';updateReaderTools();
 if(!$('#reader').open)$('#reader').showModal();$('#reader').scrollTop=0;$('#reading-progress-bar').style.width='0%';
 if(updateHash)history.pushState(null,'','#article/'+encodeURIComponent(id));
}
function renderBlock(b,i){
 if(b.type==='paragraph'&&b.text.length<55&&!/[。；！]$/.test(b.text)&&(/^(?:[0-9]{1,2}[.．、]|第[一二三四五六七八九十0-9]+条|场景[一二三四五六七八九十0-9]+[：:])/.test(b.text)||b.text.length<30&&/^[（(][0-9]+[）)]/.test(b.text)&&!/[：:]/.test(b.text))){return `<${/^[（(]/.test(b.text)?'h4':'h3'} id="section-${i}">${esc(b.text)}</${/^[（(]/.test(b.text)?'h4':'h3'}>`;}
 if(b.type==='heading'){const tag=b.level>3?'h4':'h3';return `<${tag} id="section-${i}">${esc(b.text)}</${tag}>`;}
 if(b.type==='table'){return `<div class="table-scroll" tabindex="0" role="region" aria-label="原文表格"><table><tbody>${b.rows.map((row,r)=>`<tr>${row.map(cell=>{const c=typeof cell==='string'?{text:cell}:cell;const tag=r===0?'th':'td';return `<${tag}${c.colspan>1?' colspan="'+Number(c.colspan)+'"':''}${c.rowspan>1?' rowspan="'+Number(c.rowspan)+'"':''}>${esc(c.text||'').replace(/\n/g,'<br>')}</${tag}>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;}
 return `<p>${esc(b.text||'').replace(/\n/g,'<br>')}</p>`;
}

function closeReader(){$('#reader').close();currentId=null;history.replaceState(null,'',pageHash());}
function articleText(a){return[a.title,...(a.blocks||[]).map(blockText),...(a.sections||[]).flat(),...(a.checks||[]),a.body||''].join('\n\n');}
function download(name,text,type){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function downloadCsv(name,rows){download(name,'\ufeff'+rows.map(row=>row.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\r\n'),'text/csv;charset=utf-8');toast('已生成表格，请查看浏览器下载');}
$('#category-nav').innerHTML=CATEGORIES.map(c=>`<button class="nav-item category-nav-item" data-category="${c[0]}"><i>${c[2]}</i>${c[1]}</button>`).join('');
function renderFilters(){$('#filters').innerHTML=[['all','全部内容'],...CATEGORIES,...(state.custom.length?[['custom','我的资料']]:[])].map(c=>`<button data-category="${c[0]}">${c[1]}</button>`).join('');}
renderFilters();
document.addEventListener('click',e=>{const b=e.target.closest('button,a');if(!b)return;if(b.dataset.view){e.preventDefault();sourceScope='all';navigate(b.dataset.view);}if(b.dataset.category){if(b.closest('#category-tiles'))sourceScope='manual';navigate(view==='saved'?'saved':view==='manual'?'manual':'library',b.dataset.category);}if(b.dataset.source){sourceScope=b.dataset.source;page=1;history.replaceState(null,'',pageHash());render();}if(b.dataset.page){page=Number(b.dataset.page);render();$('#section-title').scrollIntoView({block:'start'});}if(b.dataset.section){document.getElementById(b.dataset.section)?.scrollIntoView({behavior:'smooth',block:'start'});}if(b.dataset.font){$('#reader-body').style.fontSize=b.dataset.font+'px';document.querySelectorAll('[data-font]').forEach(el=>el.classList.toggle('active',el===b));}if(b.dataset.open)openArticle(b.dataset.open);if(b.dataset.save)toggleSave(b.dataset.save);if(b.dataset.close)$('#'+b.dataset.close).close();if(b.id==='clear-filters'){sourceScope='all';navigate(view==='saved'&&!query&&category==='all'?'library':view);}});
$('.brand').onclick=e=>{e.preventDefault();sourceScope='all';navigate('home');};$('.mobile-menu').onclick=()=>{$('.sidebar').classList.toggle('open');};
$('#start-library').onclick=()=>{navigate('library');$('#search').focus();};$('#start-path').onclick=$('#rail-path').onclick=()=>navigate('path');
$('#search').oninput=e=>{query=e.target.value;page=1;if(view==='home')view='library';render();};$('#search-form').onsubmit=e=>{e.preventDefault();query=$('#search').value;page=1;render();};
$('#grid-view').onclick=()=>{$('#results').classList.remove('list-mode');$('#grid-view').classList.add('selected');$('#list-view').classList.remove('selected');};$('#list-view').onclick=()=>{$('#results').classList.add('list-mode');$('#list-view').classList.add('selected');$('#grid-view').classList.remove('selected');};
$('#reader-close').onclick=closeReader;$('#reader').addEventListener('cancel',e=>{e.preventDefault();closeReader();});$('#save-article').onclick=()=>toggleSave(currentId);$('#mark-read').onclick=()=>{if(state.read.includes(currentId))state.read=state.read.filter(x=>x!==currentId);else state.read.push(currentId);persist();updateReaderTools();render();};
$('#note').oninput=e=>{state.notes[currentId]=e.target.value;$('#note-status').textContent=persist()?'✓ 已保存在当前浏览器':'未能保存，请先复制笔记或导出备份';};
$('#copy-link').onclick=async()=>{if(currentId?.startsWith('custom-')){toast('个人资料只在当前浏览器可见，请导出备份分享');return;}try{await navigator.clipboard.writeText(location.href);toast('文章链接已复制，可直接打开');}catch(e){toast('复制未获允许，请复制浏览器地址栏');}};
$('#copy-article').onclick=async()=>{try{await navigator.clipboard.writeText(articleText(getArticle(currentId)));toast('正文已复制');}catch(e){toast('浏览器未允许复制，请选中正文手动复制');}};
const info=()=>$('#info-dialog').showModal();$('#about-open').onclick=$('#footer-about').onclick=info;$('#scope-link').onclick=e=>{e.preventDefault();info();};
$('#import-open').onclick=()=>{$('#import-status').textContent='';$('#import-file').value='';$('#import-dialog').showModal();};
$('#export').onclick=()=>{download('灿哥说车-个人备份-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({schema:1,...state},null,2),'application/json');toast('备份已生成，包含收藏、笔记和导入资料');};
$('#import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1024*1024)throw Error('文件超过 1 MB，请拆分后导入');const text=await file.text();if(/\.json$/i.test(file.name)){const raw=JSON.parse(text);if(raw.schema!==1||!Array.isArray(raw.custom)||!Array.isArray(raw.saved)||!Array.isArray(raw.read)||!raw.notes||typeof raw.notes!=='object')throw Error('请选择本站导出的 JSON 备份');const incoming=normalize(raw);const custom=new Map(state.custom.map(a=>[a.id,a]));for(const a of incoming.custom)if(!custom.has(a.id))custom.set(a.id,a);state={saved:[...new Set([...state.saved,...incoming.saved])],read:[...new Set([...state.read,...incoming.read])],notes:{...incoming.notes,...state.notes},custom:[...custom.values()]};}else if(/\.(txt|md)$/i.test(file.name)){if(!text.trim())throw Error('文件没有可导入的文字');if(state.custom.some(a=>a.body===text))throw Error('相同内容已导入，无需重复');const a={id:'custom-'+crypto.randomUUID(),title:file.name.replace(/\.[^.]+$/,'').slice(0,150),body:text,desc:text.replace(/[#*\n]/g,' ').slice(0,65),cat:'custom',type:'我的资料',minutes:Math.max(1,Math.ceil(text.length/400))};state.custom.push(a);}else throw Error('仅支持 TXT、Markdown 和本站 JSON 备份');const saved=persist();renderFilters();navigate('library',state.custom.length?'custom':'all');$('#import-status').textContent=saved?'✓ 导入成功，资料仅在当前浏览器可见。':'已载入但未能持久保存，请立即导出备份。';toast(saved?'资料已导入':'资料已载入，请导出备份');}catch(err){$('#import-status').textContent=err.message;}finally{e.target.value='';}};
$('#download-checklist').onclick=()=>downloadCsv('灿哥说车-验车记录清单.csv',[['车辆识别代号','检查日期','检查人','检查项目','观察结果','待复核事项'],...['车辆与资料一致性','外观与漆面','车内状态','功能检查','专业检测记录','钥匙及随车物品'].map(x=>['','','',x,'',''])]);
$('#download-followup').onclick=()=>downloadCsv('灿哥说车-客户跟进记录.csv',[['客户代号','咨询渠道','用车需求','预算范围','当前状态','负责人','下次联系时间','下一步动作'],['','','','','待回应','','','']]);
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();if(view==='path')navigate('library');$('#search').focus();}if(e.key==='Escape')$('.sidebar').classList.remove('open');});
document.addEventListener('click',e=>{if($('.sidebar').classList.contains('open')&&!e.target.closest('.sidebar,.mobile-menu'))$('.sidebar').classList.remove('open');});
$('#reader').addEventListener('scroll',()=>{const el=$('#reader');$('#reading-progress-bar').style.width=Math.min(100,el.scrollTop/Math.max(1,el.scrollHeight-el.clientHeight)*100)+'%';});
$('#category-tiles').innerHTML=CATEGORIES.map(c=>`<button data-category="${c[0]}"><span class="category-tile-icon">${c[2]}</span><strong>${c[1]}</strong><small>${manualArticles.filter(a=>a.cat===c[0]).length} 篇手册内容 <b>↗</b></small></button>`).join('');
$('#year').textContent=new Date().getFullYear();render();
function route(){const [routePath,routeQuery='']=location.hash.slice(1).split('?');const parts=routePath.split('/');const sourceParam=new URLSearchParams(routeQuery).get('source');sourceScope=['manual','examples','custom'].includes(sourceParam)?sourceParam:'all';if(parts[0]==='article'){try{const id=decodeURIComponent(parts[1]||'');if(getArticle(id))openArticle(id,false);else{navigate('library','all',false);toast('这篇资料不存在，或仅保存在另一台设备');}}catch(e){toast('文章链接无效');}return;}if($('#reader').open)$('#reader').close();currentId=null;const allowed=['home','library','path','saved','manual'];const cat=CATEGORIES.some(c=>c[0]===parts[1])||parts[1]==='custom'?parts[1]:'all';navigate(allowed.includes(parts[0])?parts[0]:'home',cat,false);}
window.addEventListener('popstate',route);window.addEventListener('hashchange',route);route();
if(!storageAvailable)toast('本地记录暂时无法读取，请检查浏览器存储权限');
