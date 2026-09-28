const state = {
  projects: [],
  participants: [],
  filtered: [],
  meta: {},
  view: localStorage.getItem('constructionView') || 'table',
  selectedProject: null,
  pendingFile: null,
  pendingPreview: null,
  map: null,
  mapMarkers: [],
  googleReady: false,
  attachments: [],
  companyIndex: [],
};

const $ = (id) => document.getElementById(id);
const els = {};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
}
function normalizeText(value='') {
  return String(value)
    .toLowerCase()
    .replace(/[’`ʻ‘]/g, "'")
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/ё/g,'е')
    .replace(/[^a-zа-я0-9@+.'\-\s]/gi,' ')
    .replace(/\s+/g,' ').trim();
}
function normalizeCompany(value='') {
  return normalizeText(value)
    .replace(/\b(ооо|oao|ao|mchj|xk|aj|ak|llc|ltd|inc|corp|mas'uliyati cheklangan jamiyati|masuliyati cheklangan jamiyati|davlat muassasasi|davlat unitar korxonasi|xususiy korxona)\b/g,' ')
    .replace(/["'«»().,]/g,' ')
    .replace(/\s+/g,' ').trim();
}
function latinizeCompany(value='') {
  const map={
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ж':'j','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'x','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
  };
  return normalizeCompany(value).split('').map(ch=>map[ch] ?? ch).join('')
    .replace(/kh/g,'x').replace(/h/g,'x').replace(/yo/g,'e').replace(/yu/g,'u').replace(/ya/g,'a')
    .replace(/\s+/g,' ').trim();
}
function bigrams(value='') {
  const s=latinizeCompany(value).replace(/\s+/g,'');
  if(s.length<2) return s ? [s] : [];
  const out=[]; for(let i=0;i<s.length-1;i++) out.push(s.slice(i,i+2)); return out;
}
function diceSimilarity(a,b) {
  const aa=bigrams(a), bb=bigrams(b); if(!aa.length||!bb.length) return 0;
  const counts=new Map(); aa.forEach(g=>counts.set(g,(counts.get(g)||0)+1));
  let overlap=0; bb.forEach(g=>{const n=counts.get(g)||0;if(n){overlap++;counts.set(g,n-1);}});
  return (2*overlap)/(aa.length+bb.length);
}
function companyMatchScore(query,candidate) {
  const q=latinizeCompany(query), c=latinizeCompany(candidate); if(!q||!c) return 0;
  if(q===c) return 1;
  if(c.startsWith(q) || q.startsWith(c)) return q.length>=4 ? .96 : .86;
  if(c.includes(q) || q.includes(c)) return q.length>=4 ? .92 : .82;
  const qt=q.split(' ').filter(Boolean), ct=c.split(' ').filter(Boolean);
  const tokenHits=qt.filter(t=>ct.some(x=>x===t || (t.length>3 && (x.includes(t)||t.includes(x))))).length;
  const tokenScore=qt.length ? tokenHits/qt.length : 0;
  return Math.max(diceSimilarity(q,c), tokenScore*.88 + diceSimilarity(q,c)*.12);
}
function roleKey(value='') {
  const r=latinizeCompany(value);
  if(/zastroy|developer/.test(r)) return 'developer';
  if(/zakaz|customer|buyurt/.test(r)) return 'client';
  if(/proekt|designer|loyixa|loyiha/.test(r)) return 'designer';
  if(/podryad|contractor|genpodryad|pudrat/.test(r)) return 'contractor';
  return 'participant';
}
function projectCompaniesWithRoles(p) {
  const out=[];
  const add=(name,role)=>{if(name) out.push({name:String(name).trim(),role});};
  add(p.developer,'developer'); add(p.client,'client'); add(p.designer,'designer'); add(p.contractor,'contractor'); add(p.knownParticipants,'participant');
  (p.participantLinks||[]).forEach(x=>add(x.organization,roleKey(x.role)));
  return out.filter(x=>x.name);
}
function roleLabel(role='') {
  return ({developer:'застройщик',client:'заказчик',designer:'проектировщик',contractor:'подрядчик',participant:'участник'})[role] || 'участник';
}
function fmtNum(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return escapeHtml(value);
  return new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 1}).format(n);
}
function humanDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat('ru-RU',{year:'numeric',month:'short',day:'2-digit'}).format(d);
}
function compact(value, max=72) {
  const s = String(value || '—');
  return s.length > max ? s.slice(0,max-1)+'…' : s;
}
function projectCompanies(p) {
  return projectCompaniesWithRoles(p).map(x=>x.name);
}
function companiesForRole(p, role='all') {
  const all=projectCompaniesWithRoles(p);
  return role==='all' ? all : all.filter(x=>x.role===role);
}

function searchableProject(p) {
  return normalizeText([
    p.id,p.shaffofId,p.registryNumber,p.name,p.region,p.city,p.category,p.type,p.segment,p.address,
    p.client,p.developer,p.contractor,p.designer,p.knownParticipants,p.clientTaxId,p.designerTaxId,p.contractorTaxId,
    p.phone,p.email,p.clientPhone,p.designerPhone,p.contractorPhone,p.notes,p.nextStep,
    ...(p.participantLinks || []).flatMap(x => [x.role,x.organization,x.taxId,x.phone,x.email,x.head])
  ].filter(Boolean).join(' | '));
}
function hasContact(p) {
  return !![p.phone,p.email,p.clientPhone,p.clientEmail,p.designerPhone,p.designerEmail,p.contractorPhone,p.contractorEmail]
    .find(Boolean) || (p.participantLinks || []).some(x => x.phone || x.email);
}
function priorityRank(value='') {
  const s=normalizeText(value);
  if (s==='a' || s.includes('первая')) return 0;
  if (s==='b' || s.includes('вторая')) return 1;
  if (s.includes('резерв')) return 3;
  return 2;
}

async function bootstrap() {
  cacheEls();
  const [projects, participants, meta] = await Promise.all([
    fetch('data/projects.json').then(r => r.json()),
    fetch('data/participants.json').then(r => r.json()),
    fetch('data/meta.json').then(r => r.json()),
  ]);
  state.projects = projects.map(p => ({...p, _search: searchableProject(p), _searchFold: latinizeCompany(searchableProject(p))}));
  state.participants = participants;
  state.meta = meta;
  await refreshAttachments();
  populateFilters();
  buildCompanyIndex();
  bindEvents();
  setView(state.view, false);
  applyFilters();
  renderSidebarStats();
  maybeLoadGoogleMaps();
}

function cacheEls() {
  ['regionFilter','categoryFilter','stageFilter','priorityFilter','companyRoleFilter','companyFilter','companyMatches','onlyContacts','onlyCoords','globalSearch','sortSelect',
   'tableView','cardsView','mapView','resultCount','filterCaption','kpiStrip','sidebarStats','detailDrawer','drawerBackdrop','drawerTitle','drawerBody',
   'specModal','specProjectSelect','dropZone','specFileInput','specPreview','saveSpecBtn','attachmentsModal','attachmentsList','attachmentCount',
   'mapSettingsModal','googleMapsKey','mapCanvas','mapBanner','mapList','toast'].forEach(id => els[id]=$(id));
}

function bindEvents() {
  ['regionFilter','categoryFilter','stageFilter','priorityFilter','companyRoleFilter','companyFilter','globalSearch','sortSelect'].forEach(id => {
    els[id].addEventListener(id==='sortSelect'?'change':'input', applyFilters);
    if (id.endsWith('Filter')) els[id].addEventListener('change', applyFilters);
  });
  ['onlyContacts','onlyCoords'].forEach(id => els[id].addEventListener('change', applyFilters));
  document.querySelectorAll('.view-btn').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
  $('resetFilters').addEventListener('click', resetFilters);
  $('closeDrawer').addEventListener('click', closeDrawer);
  els.drawerBackdrop.addEventListener('click', closeDrawer);
  $('uploadSpecBtn').addEventListener('click', () => openSpecModal());
  $('attachmentsBtn').addEventListener('click', openAttachmentsModal);
  $('mapSettingsBtn').addEventListener('click', openMapSettings);
  $('saveMapKey').addEventListener('click', saveMapKey);
  document.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', () => closeModal(btn.dataset.close)));
  document.querySelectorAll('.modal').forEach(modal => modal.addEventListener('click', e => { if (e.target===modal) modal.classList.add('hidden'); }));

  els.dropZone.addEventListener('click', () => els.specFileInput.click());
  els.dropZone.addEventListener('keydown', e => { if (e.key==='Enter' || e.key===' ') els.specFileInput.click(); });
  ['dragenter','dragover'].forEach(ev => els.dropZone.addEventListener(ev, e => {e.preventDefault();els.dropZone.classList.add('dragover');}));
  ['dragleave','drop'].forEach(ev => els.dropZone.addEventListener(ev, e => {e.preventDefault();els.dropZone.classList.remove('dragover');}));
  els.dropZone.addEventListener('drop', e => handleSpecFile(e.dataTransfer.files?.[0]));
  els.specFileInput.addEventListener('change', e => handleSpecFile(e.target.files?.[0]));
  els.saveSpecBtn.addEventListener('click', savePendingAttachment);

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase()==='k') { e.preventDefault(); els.globalSearch.focus(); }
    if (e.key==='Escape') { closeDrawer(); document.querySelectorAll('.modal').forEach(m=>m.classList.add('hidden')); }
  });
}

function populateFilters() {
  const fill = (el, values) => {
    values.filter(Boolean).sort((a,b)=>String(a).localeCompare(String(b),'ru')).forEach(v => {
      const opt=document.createElement('option'); opt.value=v; opt.textContent=v; el.appendChild(opt);
    });
  };
  fill(els.regionFilter, [...new Set(state.projects.map(p=>p.region))]);
  fill(els.categoryFilter, [...new Set(state.projects.map(p=>p.category))]);
  fill(els.stageFilter, [...new Set(state.projects.map(p=>p.stage))]);
  fill(els.priorityFilter, [...new Set(state.projects.map(p=>p.priority))]);

  const companies=[...new Set(state.projects.flatMap(projectCompanies).map(x=>String(x).trim()).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,'ru')).slice(0,1400);
  const dl=$('companySuggestions');
  companies.forEach(v=>{ const o=document.createElement('option');o.value=v;dl.appendChild(o); });
}

function buildCompanyIndex() {
  const map=new Map();
  state.projects.forEach(p=>{
    projectCompaniesWithRoles(p).forEach(({name,role})=>{
      const key=latinizeCompany(name); if(!key) return;
      if(!map.has(key)) map.set(key,{name,fold:key,roles:new Set(),projectIds:new Set()});
      const row=map.get(key); row.roles.add(role); row.projectIds.add(p.id);
      if(name.length < row.name.length) row.name=name;
    });
  });
  state.companyIndex=[...map.values()].map(x=>({name:x.name,fold:x.fold,roles:[...x.roles],projectCount:x.projectIds.size}));
}
function renderCompanyMatches() {
  const box=els.companyMatches; if(!box) return;
  const q=els.companyFilter.value.trim(); if(q.length<2){box.innerHTML='';return;}
  const selectedRole=els.companyRoleFilter.value || 'all';
  const matches=state.companyIndex
    .filter(x=>selectedRole==='all'||x.roles.includes(selectedRole))
    .map(x=>({...x,score:companyMatchScore(q,x.name)}))
    .filter(x=>x.score >= (latinizeCompany(q).length<4 ? .72 : .48))
    .sort((a,b)=>b.score-a.score || b.projectCount-a.projectCount || a.name.localeCompare(b.name,'ru'))
    .slice(0,6);
  box.innerHTML=matches.map(x=>`<button type="button" class="company-match" data-company="${escapeHtml(x.name)}"><strong>${escapeHtml(x.name)} <span class="match-score">${Math.round(x.score*100)}%</span></strong><span>${x.roles.map(roleLabel).join(' · ')} · ${x.projectCount} объект(ов)</span></button>`).join('');
  box.querySelectorAll('[data-company]').forEach(btn=>btn.addEventListener('click',()=>{els.companyFilter.value=btn.dataset.company;applyFilters();els.companyFilter.focus();}));
}

function applyFilters() {
  const q=normalizeText(els.globalSearch.value);
  const qFold=latinizeCompany(els.globalSearch.value);
  const companyQ=els.companyFilter.value.trim();
  const selectedRole=els.companyRoleFilter.value || 'all';
  let rows=state.projects.filter(p => {
    if (els.regionFilter.value && p.region!==els.regionFilter.value) return false;
    if (els.categoryFilter.value && p.category!==els.categoryFilter.value) return false;
    if (els.stageFilter.value && p.stage!==els.stageFilter.value) return false;
    if (els.priorityFilter.value && p.priority!==els.priorityFilter.value) return false;
    if (els.onlyContacts.checked && !hasContact(p)) return false;
    if (els.onlyCoords.checked && !(Number.isFinite(p.lat)&&Number.isFinite(p.lng))) return false;
    if (q) {
      const tokenHit=q.split(' ').every(token => p._search.includes(token));
      const foldHit=qFold && qFold.split(' ').every(token=>p._searchFold.includes(token));
      if(!tokenHit && !foldHit) return false;
    }
    if (companyQ) {
      const candidates=companiesForRole(p,selectedRole);
      const best=candidates.reduce((m,x)=>Math.max(m,companyMatchScore(companyQ,x.name)),0);
      const threshold=latinizeCompany(companyQ).length<4 ? .72 : .48;
      if(best<threshold) return false;
    }
    return true;
  });
  rows.sort(sorter(els.sortSelect.value));
  state.filtered=rows;
  renderCompanyMatches();
  renderAll();
}

function sorter(mode) {
  if (mode==='region') return (a,b)=>String(a.region||'').localeCompare(String(b.region||''),'ru') || String(a.name).localeCompare(String(b.name),'ru');
  if (mode==='name') return (a,b)=>String(a.name).localeCompare(String(b.name),'ru');
  if (mode==='area') return (a,b)=>(Number(b.areaM2)||0)-(Number(a.areaM2)||0);
  return (a,b)=>priorityRank(a.priority)-priorityRank(b.priority) || String(a.region||'').localeCompare(String(b.region||''),'ru');
}

function renderAll() {
  els.resultCount.textContent=state.filtered.length;
  const active=[els.regionFilter.value,els.categoryFilter.value,els.companyFilter.value].filter(Boolean);
  els.filterCaption.textContent=active.length ? '· '+active.map(compact).join(' · ') : '';
  renderKpis();
  if (state.view==='table') renderTable();
  if (state.view==='cards') renderCards();
  if (state.view==='map') renderMapView();
}

function renderSidebarStats() {
  const regions=new Set(state.projects.map(p=>p.region).filter(Boolean)).size;
  const coords=state.projects.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)).length;
  const contacts=state.projects.filter(hasContact).length;
  els.sidebarStats.innerHTML = [
    [state.projects.length,'объектов'],[regions,'регионов'],[coords,'с координатами'],[contacts,'с контактами']
  ].map(x=>`<div class="mini-stat"><strong>${x[0]}</strong><span>${x[1]}</span></div>`).join('');
}

function renderKpis() {
  const rows=state.filtered;
  const regions=new Set(rows.map(p=>p.region).filter(Boolean)).size;
  const mapped=rows.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)).length;
  const contacts=rows.filter(hasContact).length;
  const first=rows.filter(p=>priorityRank(p.priority)===0).length;
  const items=[
    ['Объекты',rows.length,'из '+state.projects.length+' в базе'],
    ['Регионы',regions,'охват текущей выборки'],
    ['Первая очередь / A',first,'приоритетные для проработки'],
    ['Контакты / карта',contacts,`${mapped} объектов с координатами`],
  ];
  els.kpiStrip.innerHTML=items.map(x=>`<div class="kpi-card"><div class="kpi-label">${x[0]}</div><strong>${x[1]}</strong><div class="kpi-sub">${x[2]}</div></div>`).join('');
}

function priorityTag(p) {
  const cls=priorityRank(p.priority)===0?'accent':priorityRank(p.priority)===3?'warn':'blue';
  return `<span class="tag ${cls}">${escapeHtml(p.priority || 'Без приоритета')}</span>`;
}
function renderTable() {
  if (!state.filtered.length) return els.tableView.innerHTML='<div class="empty-state">По выбранным условиям объекты не найдены.</div>';
  const rows=state.filtered.map(p=>`<tr data-id="${escapeHtml(p.id)}">
    <td class="project-cell"><div class="project-name">${escapeHtml(p.name)}</div><div class="project-meta">${escapeHtml(p.shaffofId ? 'Shaffof #'+p.shaffofId : p.type || '')}</div></td>
    <td>${escapeHtml(p.region || p.city || '—')}</td>
    <td><span class="tag">${escapeHtml(compact(p.category || p.type,42))}</span></td>
    <td>${priorityTag(p)}</td>
    <td>${escapeHtml(compact(p.stage,44))}</td>
    <td class="company-cell">${escapeHtml(compact(p.client || p.developer,55))}</td>
    <td class="company-cell">${escapeHtml(compact(p.designer,55))}</td>
    <td class="company-cell">${escapeHtml(compact(p.contractor,55))}</td>
    <td>${p.areaM2 ? fmtNum(p.areaM2)+' м²' : '—'}</td>
    <td>${hasContact(p)?'<span class="tag accent">есть</span>':'—'}</td>
  </tr>`).join('');
  els.tableView.innerHTML=`<div class="table-shell"><div class="table-scroll"><table><thead><tr>
    <th>Объект</th><th>Регион</th><th>Сегмент</th><th>Приоритет</th><th>Стадия</th><th>Заказчик</th><th>Проектировщик</th><th>Подрядчик</th><th>Площадь</th><th>Контакт</th>
  </tr></thead><tbody>${rows}</tbody></table></div></div>`;
  els.tableView.querySelectorAll('tbody tr').forEach(tr=>tr.addEventListener('click',()=>openProject(tr.dataset.id)));
}
function renderCards() {
  if (!state.filtered.length) return els.cardsView.innerHTML='<div class="empty-state">По выбранным условиям объекты не найдены.</div>';
  els.cardsView.innerHTML=`<div class="cards-grid">${state.filtered.map(p=>`<article class="project-card" data-id="${escapeHtml(p.id)}">
    <div class="card-top"><div><h3>${escapeHtml(p.name)}</h3><div class="card-sub">${escapeHtml(p.region || p.city || '—')} · ${escapeHtml(p.category || p.type || '—')}</div></div>${priorityTag(p)}</div>
    <div class="card-companies">
      <div class="company-line"><span>Заказчик</span><strong>${escapeHtml(compact(p.client || p.developer,58))}</strong></div>
      <div class="company-line"><span>Проектировщик</span><span>${escapeHtml(compact(p.designer,58))}</span></div>
      <div class="company-line"><span>Подрядчик</span><span>${escapeHtml(compact(p.contractor,58))}</span></div>
    </div>
    <div class="card-footer"><span class="tag">${escapeHtml(compact(p.stage,42))}</span>${p.areaM2?`<span class="tag">${fmtNum(p.areaM2)} м²</span>`:''}${hasContact(p)?'<span class="tag accent">контакты</span>':''}${Number.isFinite(p.lat)?'<span class="tag blue">карта</span>':''}</div>
  </article>`).join('')}</div>`;
  els.cardsView.querySelectorAll('.project-card').forEach(c=>c.addEventListener('click',()=>openProject(c.dataset.id)));
}

function setView(view, rerender=true) {
  state.view=['table','cards','map'].includes(view)?view:'table';
  localStorage.setItem('constructionView',state.view);
  document.querySelectorAll('.view-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));
  els.tableView.classList.toggle('hidden',state.view!=='table');
  els.cardsView.classList.toggle('hidden',state.view!=='cards');
  els.mapView.classList.toggle('hidden',state.view!=='map');
  if (rerender) renderAll();
}

function openProject(id) {
  const p=state.projects.find(x=>x.id===id); if(!p) return;
  state.selectedProject=p;
  els.drawerTitle.textContent=p.name;
  const attached=state.attachments.filter(a=>a.projectId===p.id);
  const roles=(p.participantLinks||[]).map(x=>`<div class="person-row"><strong>${escapeHtml(x.role || 'Участник')} · ${escapeHtml(x.organization || '—')}</strong><div>${escapeHtml([x.head,x.phone,x.email].filter(Boolean).join(' · ') || 'Контакт не найден')}</div>${x.source?`<a href="${escapeHtml(x.source)}" target="_blank" rel="noreferrer">Источник контакта ↗</a>`:''}</div>`).join('');
  const links=[['Паспорт объекта',p.sourceProject],['Экспертиза',p.expertiseUrl],['Источник участников',p.sourceParticipants],['Сайт',p.website],['Shaffof Qurilish',p.shaffofUrl]].filter(x=>x[1]);
  els.drawerBody.innerHTML=`
    <div class="detail-tags">${priorityTag(p)}<span class="tag">${escapeHtml(p.region || p.city || '—')}</span><span class="tag">${escapeHtml(p.category || p.type || '—')}</span>${Number.isFinite(p.lat)?'<span class="tag blue">координаты есть</span>':''}</div>
    <div class="detail-grid">
      ${detailBox('Стадия',p.stage)}${detailBox('Срок сдачи',p.deadline)}
      ${detailBox('Заказчик / девелопер',p.client || p.developer)}${detailBox('ИНН заказчика',p.clientTaxId)}
      ${detailBox('Проектировщик',p.designer)}${detailBox('ИНН проектировщика',p.designerTaxId)}
      ${detailBox('Подрядчик',p.contractor)}${detailBox('ИНН подрядчика',p.contractorTaxId)}
      ${detailBox('Адрес',p.address,'wide')}${detailBox('Площадь здания',p.areaM2 ? fmtNum(p.areaM2)+' м²' : null)}${detailBox('Этажность',p.floors)}
      ${detailBox('Телефон',p.phone || p.clientPhone || p.designerPhone || p.contractorPhone)}${detailBox('Email / Telegram',p.email || p.clientEmail || p.designerEmail || p.contractorEmail)}
      ${detailBox('Потенциал поставки',p.supplyPotential,'wide')}${detailBox('Следующий шаг',p.nextStep,'wide')}
      ${detailBox('Примечание',p.notes,'wide')}
    </div>
    ${roles?`<section class="detail-section"><h3>Участники из связанной базы</h3>${roles}</section>`:''}
    <section class="detail-section"><h3>Источники</h3><div class="source-links">${links.length?links.map(x=>`<a href="${escapeHtml(x[1])}" target="_blank" rel="noreferrer">${escapeHtml(x[0])} ↗</a>`).join(''):'<span class="muted">Ссылки не указаны</span>'}</div></section>
    <section class="detail-section"><h3>Спецификации (${attached.length})</h3>${attached.length?attached.map(a=>`<div class="person-row"><strong>${escapeHtml(a.name)}</strong><div>${humanDate(a.createdAt)} · ${formatBytes(a.size)}</div><button class="link-btn" data-download-attachment="${a.id}">Открыть файл</button></div>`).join(''):'<div class="muted">Пока нет загруженных файлов.</div>'}<div style="margin-top:8px"><button id="drawerUploadSpec" class="secondary-btn">＋ Добавить спецификацию</button></div></section>
  `;
  els.drawerBody.querySelector('#drawerUploadSpec')?.addEventListener('click',()=>openSpecModal(p.id));
  els.drawerBody.querySelectorAll('[data-download-attachment]').forEach(b=>b.addEventListener('click',()=>downloadAttachment(Number(b.dataset.downloadAttachment))));
  els.drawerBackdrop.classList.remove('hidden'); els.detailDrawer.classList.add('open'); els.detailDrawer.setAttribute('aria-hidden','false');
}
function detailBox(label,value,extra='') { return `<div class="detail-box ${extra}"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value || '—')}</div></div>`; }
function closeDrawer() { els.detailDrawer.classList.remove('open');els.drawerBackdrop.classList.add('hidden');els.detailDrawer.setAttribute('aria-hidden','true'); }

function renderMapView() {
  const mappable=state.filtered.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));
  els.mapList.innerHTML=mappable.slice(0,300).map(p=>`<div class="map-list-item" data-id="${escapeHtml(p.id)}"><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.region || '—')} · ${escapeHtml(p.category || p.type || '—')}</span></div>`).join('') || '<div class="empty-state">Нет объектов с координатами.</div>';
  els.mapList.querySelectorAll('[data-id]').forEach(el=>el.addEventListener('click',()=>focusMapProject(el.dataset.id)));
  if (!state.googleReady) {
    els.mapCanvas.innerHTML='<div class="empty-state" style="margin:30px">Для интерактивной карты добавьте Google Maps API key. 331 объект уже имеет координаты из исходной базы.</div>';
    els.mapBanner.textContent=`${mappable.length} объектов из текущей выборки готовы к отображению на Google Maps`;
    return;
  }
  drawMarkers(mappable);
}

function maybeLoadGoogleMaps() {
  const key=localStorage.getItem('googleMapsApiKey');
  if (!key || window.google?.maps) { if(window.google?.maps){state.googleReady=true;} return; }
  const script=document.createElement('script');
  script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&callback=__constructionMapReady`;
  script.async=true; script.defer=true; script.onerror=()=>toast('Не удалось загрузить Google Maps. Проверьте ключ и ограничения домена.');
  window.__constructionMapReady=()=>{state.googleReady=true;if(state.view==='map')renderMapView();};
  document.head.appendChild(script);
}
function initMapIfNeeded() {
  if (state.map || !state.googleReady) return;
  state.map=new google.maps.Map(els.mapCanvas,{center:{lat:41.25,lng:64.6},zoom:6,mapTypeControl:true,streetViewControl:false,fullscreenControl:true});
}
function drawMarkers(projects) {
  initMapIfNeeded(); if(!state.map) return;
  state.mapMarkers.forEach(m=>m.setMap(null)); state.mapMarkers=[];
  const bounds=new google.maps.LatLngBounds();
  projects.slice(0,500).forEach(p=>{
    const pos={lat:p.lat,lng:p.lng};
    const marker=new google.maps.Marker({position:pos,map:state.map,title:p.name});
    marker.addListener('click',()=>openProject(p.id));
    state.mapMarkers.push(marker);bounds.extend(pos);
  });
  if(projects.length) state.map.fitBounds(bounds,60);
  els.mapBanner.textContent=`На карте: ${projects.length} объектов · клик по маркеру открывает карточку`;
}
function focusMapProject(id) {
  const p=state.projects.find(x=>x.id===id); if(!p) return;
  if(state.map && Number.isFinite(p.lat)){state.map.panTo({lat:p.lat,lng:p.lng});state.map.setZoom(15);} else openProject(id);
}
function openMapSettings(){els.googleMapsKey.value=localStorage.getItem('googleMapsApiKey')||'';els.mapSettingsModal.classList.remove('hidden');}
function saveMapKey(){const key=els.googleMapsKey.value.trim();if(!key)return toast('Введите API key');localStorage.setItem('googleMapsApiKey',key);els.mapSettingsModal.classList.add('hidden');toast('Ключ сохранён. Подключаю Google Maps…');maybeLoadGoogleMaps();}

function resetFilters() {
  [els.regionFilter,els.categoryFilter,els.stageFilter,els.priorityFilter,els.companyFilter,els.globalSearch].forEach(el=>el.value='');
  els.companyRoleFilter.value='all'; els.companyMatches.innerHTML='';
  els.onlyContacts.checked=false;els.onlyCoords.checked=false;els.sortSelect.value='priority';applyFilters();
}

function openSpecModal(projectId=null) {
  els.specModal.classList.remove('hidden');
  state.pendingFile=null;state.pendingPreview=null;els.specPreview.classList.add('hidden');els.specPreview.innerHTML='';els.saveSpecBtn.disabled=true;
  const list=state.projects.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'ru'));
  els.specProjectSelect.innerHTML='<option value="">Без привязки к объекту</option>'+list.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(compact(p.name,84))} · ${escapeHtml(p.region||'')}</option>`).join('');
  if(projectId) els.specProjectSelect.value=projectId;
}
function closeModal(id){$(id)?.classList.add('hidden');}
async function handleSpecFile(file) {
  if(!file)return;
  state.pendingFile=file; els.saveSpecBtn.disabled=false;
  const ext=file.name.split('.').pop().toLowerCase();
  let html=`<div class="spec-meta"><strong>${escapeHtml(file.name)}</strong> · ${formatBytes(file.size)} · ${escapeHtml(ext.toUpperCase())}</div>`;
  if(['xlsx','xls','csv'].includes(ext) && window.XLSX){
    try {
      const buf=await file.arrayBuffer();const wb=XLSX.read(buf,{type:'array'});const sheet=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(sheet,{header:1,blankrows:false,defval:''}).slice(0,20);
      state.pendingPreview={sheet:wb.SheetNames[0],rows:rows.length,columns:Math.max(0,...rows.map(r=>r.length))};
      if(rows.length){html+=`<div class="preview-scroll"><table class="preview-table"><tbody>${rows.map((r,i)=>`<tr>${r.slice(0,12).map(c=>i===0?`<th>${escapeHtml(compact(c,40))}</th>`:`<td>${escapeHtml(compact(c,50))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
    } catch(err){html+=`<div class="spec-meta">Не удалось построить предпросмотр: ${escapeHtml(err.message)}</div>`;}
  } else {
    html+=`<div class="spec-meta">Файл будет сохранён локально. Автопросмотр для этого формата появится на серверном этапе.</div>`;
  }
  els.specPreview.innerHTML=html;els.specPreview.classList.remove('hidden');
}
function formatBytes(bytes=0){if(bytes<1024)return bytes+' Б';if(bytes<1024*1024)return (bytes/1024).toFixed(1)+' КБ';return (bytes/1024/1024).toFixed(1)+' МБ';}

function dbOpen() {
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open('constructionCRM',1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('attachments'))db.createObjectStore('attachments',{keyPath:'id',autoIncrement:true});};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
async function dbAll() {const db=await dbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction('attachments','readonly');const req=tx.objectStore('attachments').getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});}
async function dbAdd(record) {const db=await dbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction('attachments','readwrite');const req=tx.objectStore('attachments').add(record);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function dbGet(id) {const db=await dbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction('attachments','readonly');const req=tx.objectStore('attachments').get(id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function dbDelete(id) {const db=await dbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction('attachments','readwrite');const req=tx.objectStore('attachments').delete(id);req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error);});}
async function refreshAttachments(){try{state.attachments=await dbAll();}catch{state.attachments=[];}if(els.attachmentCount)els.attachmentCount.textContent=state.attachments.length;}
async function savePendingAttachment(){
  if(!state.pendingFile)return;
  const file=state.pendingFile;await dbAdd({projectId:els.specProjectSelect.value||null,name:file.name,type:file.type,size:file.size,createdAt:new Date().toISOString(),preview:state.pendingPreview,blob:file});
  await refreshAttachments();els.specModal.classList.add('hidden');toast('Спецификация сохранена локально');if(state.selectedProject)openProject(state.selectedProject.id);
}
async function downloadAttachment(id){const a=await dbGet(id);if(!a)return;const url=URL.createObjectURL(a.blob);const link=document.createElement('a');link.href=url;link.download=a.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function openAttachmentsModal(){await refreshAttachments();els.attachmentsModal.classList.remove('hidden');renderAttachments();}
function renderAttachments(){
  if(!state.attachments.length){els.attachmentsList.innerHTML='<div class="empty-state">Спецификации пока не загружены.</div>';return;}
  els.attachmentsList.innerHTML=state.attachments.slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).map(a=>{const p=state.projects.find(x=>x.id===a.projectId);return `<div class="attachment-row"><div><strong>${escapeHtml(a.name)}</strong><span>${escapeHtml(p?.name || 'Без привязки')} · ${humanDate(a.createdAt)} · ${formatBytes(a.size)}</span></div><div><button class="secondary-btn" data-open="${a.id}">Открыть</button> <button class="secondary-btn" data-delete="${a.id}">Удалить</button></div></div>`;}).join('');
  els.attachmentsList.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>downloadAttachment(Number(b.dataset.open))));
  els.attachmentsList.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',async()=>{await dbDelete(Number(b.dataset.delete));await refreshAttachments();renderAttachments();}));
}
function toast(message){els.toast.textContent=message;els.toast.classList.remove('hidden');clearTimeout(toast._t);toast._t=setTimeout(()=>els.toast.classList.add('hidden'),3200);}

bootstrap().catch(err=>{
  console.error(err);
  document.body.innerHTML=`<div style="padding:40px;font-family:system-ui"><h2>Не удалось запустить приложение</h2><p>${escapeHtml(err.message)}</p><p>Откройте папку через локальный HTTP-сервер, например <code>python3 -m http.server 8080</code>.</p></div>`;
});
