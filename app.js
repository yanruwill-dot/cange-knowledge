'use strict';
const $=s=>document.querySelector(s);
const KEY='cange-knowledge-v1';
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
const all=()=>[...KNOWLEDGE,...state.custom];
const getArticle=id=>all().find(a=>a.id===id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const catName=id=>id==='custom'?'我的资料':CATEGORIES.find(c=>c[0]===id)?.[1]||'知识';
const catIcon=id=>CATEGORIES.find(c=>c[0]===id)?.[2]||'▤';
const SEARCH_ALIASES={purchase:'验车 检测 收车 采购',sales:'销售 成交 话术 咨询',delivery:'交车 交付 费用',service:'售后 回访 客诉',marketing:'获客 拍摄 视频 内容 线索',team:'新人 培训 晨会 团队',data:'数据 经营 看板 库存',risk:'风险 记录 规范'};
const searchable=a=>[a.title,a.desc,SEARCH_ALIASES[a.cat]||'',catName(a.cat),a.body||'',...(a.sections||[]).flat(),...(a.checks||[])].join(' ').toLowerCase();
function matches(a){return(category==='all'||a.cat===category)&&query.toLowerCase().trim().split(/\s+/).every(q=>searchable(a).includes(q))&&(view!=='saved'||state.saved.includes(a.id));}
function updateCounts(){
 $('#nav-count').textContent=all().length;$('#total-stat').textContent=String(all().length).padStart(2,'0');$('#saved-count').textContent=state.saved.filter(getArticle).length;$('#read-stat').textContent=String(state.read.filter(getArticle).length).padStart(2,'0');
 const progress=Math.round(LEARNING_PATH.filter(d=>state.read.includes(d[1])).length/7*100);$('#path-percent').textContent=progress+'%';$('#path-progress').style.width=progress+'%';
}
function render(){
 updateCounts();$('#home-intro').hidden=view!=='home';$('#search-form').hidden=view==='path';$('#filters').hidden=view==='path';$('.view-switch').hidden=view==='path';
 const title=view==='home'?'每个业务问题，都有一个起点':view==='saved'?'我的收藏':view==='path'?'新人入门 · 7 天学习路径':category==='all'?'全部知识':catName(category);
 $('#section-title').textContent=title;$('#crumb').textContent=view==='home'?'知识库首页':title;
 document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
 document.querySelectorAll('[data-category]').forEach(el=>{el.classList.toggle('active',el.dataset.category===category);el.setAttribute('aria-pressed',String(el.dataset.category===category));});
 if(view==='path'){
  $('#result-status').textContent='建议学习安排 · 以实际掌握情况为准，完成阅读后可标为已读';
  $('#results').innerHTML=LEARNING_PATH.map((d,i)=>`<button class="day-card" data-open="${d[1]}"><span class="day-num">0${i+1}</span><div><h3>${d[0]}</h3><p>第 ${i+1} 天 · ${d[2]}</p></div><span class="day-state">${state.read.includes(d[1])?'✓ 已完成':'开始学习 ↗'}</span></button>`).join('');return;
 }
 const items=all().filter(matches);$('#result-status').textContent=`共 ${items.length} 篇内容${query?' · 搜索“'+query+'”':''} · 内置内容为原创入门示例`;
 $('#results').innerHTML=items.length?items.map(a=>`<article class="article-card"><button class="article-open" data-open="${esc(a.id)}"><div class="card-meta"><span class="category-icon" aria-hidden="true">${catIcon(a.cat)}</span><span class="card-type">${esc(a.type)}</span></div><h3>${esc(a.title)}</h3><p>${esc(a.desc)}</p></button><div class="card-bottom"><span>${catName(a.cat)}</span><span>${a.minutes} 分钟</span>${state.read.includes(a.id)?'<span class="read-badge">已读</span>':''}<button data-save="${esc(a.id)}" class="${state.saved.includes(a.id)?'saved':''}" aria-label="${state.saved.includes(a.id)?'取消收藏':'收藏'}：${esc(a.title)}" aria-pressed="${state.saved.includes(a.id)}">${state.saved.includes(a.id)?'★':'☆'}</button></div></article>`).join(''):`<div class="empty"><strong>${view==='saved'?'还没有符合条件的收藏':'没有找到相关内容'}</strong><br>${view==='saved'?'点击文章旁的星号，把有用的方法留在这里。':'换一个关键词，或清除筛选后试试。'}<button id="clear-filters">${view==='saved'&&!query&&category==='all'?'去知识库看看':'清除搜索与筛选'} →</button></div>`;
}
function pageHash(){return '#'+view+(category!=='all'?'/'+category:'');}
function navigate(next,cat='all',push=true){view=next;category=cat;query='';$('#search').value='';$('.sidebar').classList.remove('open');if(push)history.pushState(null,'',pageHash());render();}
function toggleSave(id){if(state.saved.includes(id))state.saved=state.saved.filter(x=>x!==id);else state.saved.push(id);persist();render();if(currentId===id)updateReaderTools();}
function updateReaderTools(){const saved=state.saved.includes(currentId),read=state.read.includes(currentId);$('#save-article').textContent=saved?'★ 已收藏':'☆ 收藏';$('#save-article').setAttribute('aria-pressed',saved);$('#mark-read').textContent=read?'✓ 已读 · 点击撤销':'✓ 标为已读';$('#mark-read').setAttribute('aria-pressed',read);}
function openArticle(id,updateHash=true){const a=getArticle(id);if(!a)return;currentId=id;$('#reader-title').textContent=a.title;$('#reader-category').textContent=catName(a.cat);$('#reader-meta').textContent=`${a.type} · 约 ${a.minutes} 分钟阅读`;$('#reader-body').innerHTML=a.body?`<div style="white-space:pre-wrap">${esc(a.body)}</div><div class="article-origin">你导入的个人资料 · 仅保存在当前浏览器</div>`:(a.sections.map(s=>`<h3>${esc(s[0])}</h3><p>${esc(s[1])}</p>`).join('')+`<h3>行动清单</h3><ul>${a.checks.map(c=>`<li>${esc(c)}</li>`).join('')}</ul><div class="article-origin">原创入门示例 · 待结合门店实际审核完善。本文不是原订阅知识库文档，也不替代专业检测或个案意见。</div>`);$('#note').value=state.notes[id]||'';$('#note-status').textContent='仅保存到当前浏览器，不会公开';updateReaderTools();if(!$('#reader').open)$('#reader').showModal();$('#reader').scrollTop=0;if(updateHash)history.pushState(null,'','#article/'+encodeURIComponent(id));}
function closeReader(){$('#reader').close();currentId=null;history.replaceState(null,'',pageHash());}
function articleText(a){return[a.title,...(a.sections||[]).flat(),...(a.checks||[]),a.body||''].join('\n\n');}
function download(name,text,type){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function downloadCsv(name,rows){download(name,'\ufeff'+rows.map(row=>row.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\r\n'),'text/csv;charset=utf-8');toast('已生成表格，请查看浏览器下载');}
$('#category-nav').innerHTML=CATEGORIES.map(c=>`<button class="nav-item category-nav-item" data-category="${c[0]}"><i>${c[2]}</i>${c[1]}</button>`).join('');
function renderFilters(){$('#filters').innerHTML=[['all','全部内容'],...CATEGORIES,...(state.custom.length?[['custom','我的资料']]:[])].map(c=>`<button data-category="${c[0]}">${c[1]}</button>`).join('');}
renderFilters();
document.addEventListener('click',e=>{const b=e.target.closest('button,a');if(!b)return;if(b.dataset.view){e.preventDefault();navigate(b.dataset.view);}if(b.dataset.category){navigate(view==='saved'?'saved':'library',b.dataset.category);}if(b.dataset.open)openArticle(b.dataset.open);if(b.dataset.save)toggleSave(b.dataset.save);if(b.dataset.close)$('#'+b.dataset.close).close();if(b.id==='clear-filters')navigate(view==='saved'&&!query&&category==='all'?'library':view);});
$('.brand').onclick=e=>{e.preventDefault();navigate('home');};$('.mobile-menu').onclick=()=>{$('.sidebar').classList.toggle('open');};
$('#start-library').onclick=()=>{navigate('library');$('#search').focus();};$('#start-path').onclick=$('#rail-path').onclick=()=>navigate('path');
$('#search').oninput=e=>{query=e.target.value;if(view==='home')view='library';render();};$('#search-form').onsubmit=e=>{e.preventDefault();query=$('#search').value;render();};
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
$('#year').textContent=new Date().getFullYear();render();
function route(){const parts=location.hash.slice(1).split('/');if(parts[0]==='article'){try{const id=decodeURIComponent(parts[1]||'');if(getArticle(id))openArticle(id,false);else{navigate('library','all',false);toast('这篇资料不存在，或仅保存在另一台设备');}}catch(e){toast('文章链接无效');}return;}if($('#reader').open)$('#reader').close();currentId=null;const allowed=['home','library','path','saved'];const cat=CATEGORIES.some(c=>c[0]===parts[1])||parts[1]==='custom'?parts[1]:'all';navigate(allowed.includes(parts[0])?parts[0]:'home',cat,false);}
window.addEventListener('popstate',route);window.addEventListener('hashchange',route);route();
if(!storageAvailable)toast('本地记录暂时无法读取，请检查浏览器存储权限');
