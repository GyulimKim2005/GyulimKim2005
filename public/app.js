(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const labels = {study:'공부 노트',reading:'읽기 기록',publication:'참여 논문',thoughts:'생각',daily:'일상'};
  let state={profile:null,entries:[],projects:[],library:[],topics:[],cvitems:[]}, owner=false, localMode=false, aiReady=false, filter='all', selected=null, editing=null, deleting=null, dirty=false, saving=false, returnFocus=null, toastTimer;
  const pages={about:['About me','A LITTLE ABOUT ME',''],interests:['Interests','THINGS I LOVE','관심 있는 것, 좋아하는 것.'],dev:['Dev','THINGS I’VE BUILT',''],archive:['Archive','PERSONAL ARCHIVE',''],library:['Library','MY READING ROOM','읽은 논문, 글, 책. 공부와 여가 사이의 책장.'],cv:['CV','CURRICULUM VITAE','']};
  let page=location.pathname.replace(/^\/|\/$/g,''),query=new URLSearchParams(location.search).get('q')||'';
  if(!pages[page])page='';
  const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  const safeLink=value=>{try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.href:null;}catch{return null;}};
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
  async function api(path,method='GET',body){
    const response=await fetch(path,{method,headers:body?{'Content-Type':'application/json','X-Archive-Request':'1'}:undefined,body:body?JSON.stringify(body):undefined});
    let value;try{value=await response.json();}catch{throw new Error('서버 응답을 읽지 못했어요. 잠시 후 다시 시도해 주세요.');}
    if(!response.ok)throw new Error(value.error||'처리하지 못했어요. 다시 시도해 주세요.');
    return value;
  }
  function ownerUI(){
    document.querySelectorAll('.owner-only').forEach(el=>el.hidden=!owner);
    $('edit-profile').hidden=!owner||!['about','interests','cv'].includes(page);
    $('sign-in').hidden=owner;$('sign-out').hidden=!owner||localMode;
    ['edit-profile','new-entry','new-project','new-book','new-topic','new-cvitem'].forEach(id=>$(id).disabled=!state.profile);
    $('profile-name').setAttribute('aria-description',owner?'내 기록 관리':'관리자 로그인');
    if(owner){$('profile-name').removeAttribute('aria-haspopup');$('profile-name').removeAttribute('aria-controls');}
    else{$('profile-name').setAttribute('aria-haspopup','dialog');$('profile-name').setAttribute('aria-controls','login-dialog');}
  }
  function openDialog(dialog){returnFocus=document.activeElement;dialog.showModal();document.body.classList.add('modal-open');}
  function closeDialog(dialog){dialog.close();if(!document.querySelector('dialog[open]'))document.body.classList.remove('modal-open');}
  function renderProfile(){
    const p=state.profile;if(!p)return;
    $('profile-name').textContent=p.name;
    $('inner-name').textContent=p.name;
    $('profile-affiliation').textContent=p.affiliation;
    $('about-affiliation').textContent=p.affiliation;
    $('profile-bio').textContent=p.bio;
    $('profile-interests').replaceChildren(...p.interests.map(tag=>node('span','',tag)));
    $('interests-body').textContent=p.interestsText||'';
    $('interests-empty').hidden=!!(p.interests.length||p.interestsText);
    $('cv-body').textContent=p.cv||'';
    $('cv-empty').hidden=!!(p.cv||p.cvUrl||state.entries.some(e=>e.category==='publication'));
    const cvUrl=safeLink(p.cvUrl);$('cv-link').hidden=!cvUrl;if(cvUrl)$('cv-link').href=cvUrl;else $('cv-link').removeAttribute('href');
    for(const id of ['home-photo','about-photo']){const img=$(id),url=safeLink(p.photoUrl);img.hidden=!url;img.alt=p.name;if(url&&img.src!==url)img.src=url;else if(!url)img.removeAttribute('src');}
    document.title=(page?pages[page][0]+' — ':'')+p.name;
  }
  const sortedEntries=()=>[...state.entries].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));
  const sortNames={recent:'최신순',oldest:'오래된순',title:'제목순'};
  let previewSort='recent';
  try{const saved=localStorage.getItem('gyulim-home-sort');if(Object.hasOwn(sortNames,saved))previewSort=saved;}catch{}
  $('recent-sort').value=previewSort;
  $('recent-sort').addEventListener('change',()=>{
    previewSort=Object.hasOwn(sortNames,$('recent-sort').value)?$('recent-sort').value:'recent';
    try{localStorage.setItem('gyulim-home-sort',previewSort);}catch{}
    if(state.profile)renderRecent();
    $('recent-posts').scrollTop=0;
  });
  function entryButton(entry,cls='entry-row'){
    const button=node('button',cls);button.type='button';button.setAttribute('aria-label',entry.title+' 읽기');
    const content=node('div'),meta=node('div','entry-meta'),time=node('time','',entry.date.replaceAll('-','.'));time.dateTime=entry.date;
    meta.append(node('span','entry-category',labels[entry.category]),time);content.append(meta,node('h3','',entry.title));
    if(entry.summary)content.append(node('p','',entry.summary));
    if(cls==='entry-row'&&entry.tags.length){const tags=node('div','entry-tags');tags.append(...entry.tags.map(tag=>node('span','','#'+tag)));content.append(tags);}
    button.append(content);if(cls==='entry-row')button.append(node('span','entry-arrow','↗'));
    button.addEventListener('click',()=>readEntry(entry.id));return button;
  }
  function recentPlaceholder(message=''){
    const placeholder=node('div','recent-card recent-placeholder');
    if(message)placeholder.append(node('p','sr-only',message));else placeholder.setAttribute('aria-hidden','true');
    return placeholder;
  }
  function renderRecent(){
    const ordered=sortedEntries();
    if(previewSort==='oldest')ordered.reverse();
    if(previewSort==='title')ordered.sort((a,b)=>a.title.localeCompare(b.title,'ko',{numeric:true,sensitivity:'base'}));
    const latest=ordered.slice(0,5);$('recent-posts').replaceChildren(...latest.map(e=>entryButton(e,'recent-card')));
    $('recent-posts').setAttribute('aria-label',sortNames[previewSort]+' 게시글 최대 5개, 영역 안에서 스크롤');
    for(let i=latest.length;i<5;i++)$('recent-posts').append(recentPlaceholder(i===0?'아직 등록한 기록이 없어요.':''));
    $('publication-list').replaceChildren(...sortedEntries().filter(e=>e.category==='publication').map(e=>entryButton(e)));
    $('publication-list').hidden=!state.entries.some(e=>e.category==='publication');
  }
  function renderEntries(){
    const term=query.trim().toLocaleLowerCase();
    const entries=sortedEntries().filter(e=>(filter==='all'||e.category===filter)&&(!term||[e.title,e.summary,e.body,...e.tags].join(' ').toLocaleLowerCase().includes(term)));
    $('search-status').hidden=!term;$('search-status').replaceChildren();
    if(term){$('search-status').append(document.createTextNode('“'+query+'” 검색 결과 · '+entries.length+'개'));const clear=node('button','subtle-button','검색 지우기 ×');clear.type='button';clear.addEventListener('click',()=>navigate('/archive'));$('search-status').append(clear);}
    $('entries').replaceChildren();
    if(!entries.length){
      const empty=node('div','empty-state');
      empty.append(node('span','empty-index','01'),node('h3','',term?'검색 결과가 없어요.':filter==='all'?'아직 비어 있는 첫 페이지.':labels[filter]+'의 첫 페이지.'));
      const descriptions={study:'배운 것과 이해한 것을 나의 언어로 남겨요.',reading:'읽은 것과 그 안에서 발견한 질문들을 모아요.',publication:'함께한 연구와 참여한 논문을 소개해요.',thoughts:'오래 붙잡아 두고 싶은 생각들을 남겨요.',daily:'지나가는 하루의 장면들을 남겨요.',all:'공부한 것, 읽은 것, 일상에서 만난 생각.\n차곡차곡 쌓여갈 기록을 위한 자리예요.'};
      const p=node('p','',term?'다른 검색어로 찾아보세요.':descriptions[filter]);p.style.whiteSpace='pre-line';empty.append(p);
      if(owner){const button=node('button','subtle-button','첫 기록 남기기 ↗');button.type='button';button.addEventListener('click',()=>openEditor('entries'));empty.append(button);}
      $('entries').append(empty);
    }
    entries.forEach(entry=>$('entries').append(entryButton(entry)));
    $('record-count').textContent=entries.length+'개의 기록';document.querySelector('[data-count="all"]').textContent=String(state.entries.length);
  }
  function renderProjects(){
    $('project-list').replaceChildren();
    if(!state.projects.length){const empty=node('div','project-empty');const text=node('div');text.append(node('h3','','내가 만든 것들의 자리.'),node('p','','웹사이트와 작은 프로젝트를 이곳에 모아요.'));empty.append(text,node('span','','↗'));$('project-list').append(empty);}
    state.projects.forEach(project=>{
      const card=node('article','project-card');card.append(node('span','project-label',project.label),node('h3','',project.title));if(project.description)card.append(node('p','',project.description));
      const link=node('a','project-link');link.href=safeLink(project.url)||'#';link.target='_blank';link.rel='noopener noreferrer';link.append(node('span','','사이트 열기'),node('span','','↗'));card.append(link);
      if(owner){const controls=node('div','project-controls');const edit=node('button','subtle-button','수정');edit.type='button';edit.setAttribute('aria-label',project.title+' 수정');edit.addEventListener('click',()=>openEditor('projects',project));const remove=node('button','subtle-button danger','삭제');remove.type='button';remove.setAttribute('aria-label',project.title+' 삭제');remove.addEventListener('click',()=>confirmDelete('projects',project));controls.append(edit,remove);card.append(controls);}
      $('project-list').append(card);
    });
  }
  function render(){renderProfile();renderEntries();renderRecent();renderProjects();ownerUI();window.Spaces?.render();}
  function renderRoute(focus=false){
    const pathname=location.pathname.replace(/^\/|\/$/g,'');page=pages[pathname]?pathname:'';query=new URLSearchParams(location.search).get('q')||'';
    filter=page==='library'?'reading':'all';
    $('home').hidden=!!page;$('inner-page').hidden=!page;
    for(const id of ['about-page','interests-page','cv-page','library-page'])$(id).hidden=id!==page+'-page';
    $('archive').hidden=page!=='archive';$('projects').hidden=page!=='dev';
    document.querySelector('.filters').hidden=page==='library';
    document.querySelectorAll('.filter').forEach(button=>{const active=button.dataset.filter===filter;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    document.querySelectorAll('.inner-header [data-route]').forEach(link=>{if(link.getAttribute('href')==='/'+page)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    if(page){const [title,kicker,description]=pages[page];$('page-title').textContent=title;$('page-kicker').textContent=kicker;$('page-description').textContent=description;}
    $('archive-caption').textContent=page==='library'?'읽은 논문과 읽기 기록.':'공부하고 읽고 기록한 것들.';
    $('search-input').value=query;if(state.profile)render();else ownerUI();
    if(focus){if(page)$('page-title').focus({preventScroll:true});else $('profile-name').focus({preventScroll:true});window.scrollTo?.(0,0);}
  }
  function navigate(url){history.pushState({},'',url);renderRoute(true);}
  document.addEventListener('click',event=>{const link=event.target.closest('a[data-route]');if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();navigate(link.getAttribute('href'));});
  window.addEventListener('popstate',()=>renderRoute(true));
  $('search-form').addEventListener('submit',event=>{event.preventDefault();const term=$('search-input').value.trim();navigate('/archive'+(term?'?q='+encodeURIComponent(term):''));});
  async function load(){
    const [content,session]=await Promise.allSettled([api('/api/content'),api('/api/session')]);
    owner=session.status==='fulfilled'&&session.value.canEdit;
    localMode=session.status==='fulfilled'&&session.value.local;
    aiReady=session.status==='fulfilled'&&session.value.aiReady;
    if(content.status==='fulfilled'){state=content.value;render();}else{
      for(const id of ['entries','recent-posts']){const error=node('div',id==='recent-posts'?'recent-card recent-error':'error-state');error.append(node('p',id==='recent-posts'?'sr-only':'','기록을 불러오지 못했어요.'));const retry=node('button','subtle-button',id==='recent-posts'?'↻':'다시 불러오기 ↻');retry.setAttribute('aria-label','기록 다시 불러오기');retry.title='기록 다시 불러오기';retry.type='button';retry.addEventListener('click',load);error.append(retry);$(id).replaceChildren(error);if(id==='recent-posts')for(let i=1;i<5;i++)$(id).append(recentPlaceholder());}ownerUI();
    }
  }
  function readEntry(id){
    selected=state.entries.find(e=>e.id===id);if(!selected)return;
    $('reader-meta').textContent=labels[selected.category]+' / '+selected.date.replaceAll('-','.');$('reader-title').textContent=selected.title;$('reader-summary').textContent=selected.summary;$('reader-summary').hidden=!selected.summary;$('reader-body').textContent=selected.body;
    const url=safeLink(selected.sourceUrl);$('reader-source').hidden=!url;if(url)$('reader-source').href=url;else $('reader-source').removeAttribute('href');
    window.Spaces?.readRelated(selected.id);
    ownerUI();openDialog($('reader'));
  }
  function field(name,label,value='',options={}){
    const wrapper=node('label','field');const title=node('span','field-label',label);if(options.optional)title.append(node('small','','선택'));wrapper.append(title);
    let input;
    if(options.choices){input=node('select');for(const [val,title]of Object.entries(options.choices)){const option=node('option','',title);option.value=val;input.append(option);}}
    else input=node(options.multiline?'textarea':'input',options.body?'body-input':'');
    input.name=name;input.value=value??'';if(!options.choices&&!options.multiline)input.type=options.type||'text';if(options.max)input.maxLength=options.max;input.required=!!options.required;if(options.placeholder)input.placeholder=options.placeholder;wrapper.append(input);return wrapper;
  }
  function openEditor(kind,value=null){
    if(!owner)return;
    if($('reader').open)closeDialog($('reader'));
    editing={kind,id:value?.id||crypto.randomUUID(),revision:value?.revision??null};dirty=false;$('form-error').hidden=true;$('editor-fields').replaceChildren();$('save-button').disabled=false;$('save-button').textContent='저장하기 ↗';
    const fields=$('editor-fields');const today=new Date();const localDate=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
    if(kind==='entries'){
      $('editor-title').textContent=value?'기록 수정':'새로운 기록';
      const row=node('div','form-row');row.append(field('category','분류',value?.category||(filter==='all'?'study':filter),{choices:labels}),field('date','날짜',value?.date||localDate,{type:'date',required:true}));fields.append(row,field('title','제목',value?.title,{required:true,max:200,placeholder:'어떤 생각을 남길까요?'}),field('summary','한 줄 메모',value?.summary,{optional:true,max:500}),field('body','본문',value?.body,{multiline:true,body:true,required:true,max:100000,placeholder:'오늘의 공부와 생각을 자유롭게 남겨 보세요.'}),field('tags','태그',value?.tags.join(', '),{optional:true,max:500,placeholder:'쉼표로 구분해 주세요'}),field('sourceUrl','논문·참고 자료 링크',value?.sourceUrl,{optional:true,type:'url',max:2048,placeholder:'https://'}));
    }else if(kind==='projects'){
      $('editor-title').textContent=value?'사이트 링크 수정':'만든 사이트 추가';fields.append(field('title','사이트 이름',value?.title,{required:true,max:150}),field('url','사이트 주소',value?.url,{required:true,type:'url',max:2048,placeholder:'https://'}),field('description','소개',value?.description,{optional:true,multiline:true,max:1000}),field('label','분류',value?.label||'WEBSITE',{optional:true,max:40,placeholder:'WEBSITE, SIDE PROJECT, EXPERIMENT…'}));
    }else if(window.Spaces?.editorFields(kind,value,fields)){
      // Collection-specific fields share the same save and conflict handling.
    }else{
      $('editor-title').textContent='나의 소개 · 관심사 · CV';const p=state.profile;editing.revision=p.revision;fields.append(field('name','이름',p.name,{required:true,max:80}),field('affiliation','소속·한 줄 소개',p.affiliation,{optional:true,max:150}),field('photoUrl','프로필 사진 주소',p.photoUrl,{optional:true,type:'url',max:2048,placeholder:'https://'}),field('bio','자기소개',p.bio,{optional:true,multiline:true,max:2000}),field('interests','관심 분야',p.interests.join(', '),{optional:true,max:500,placeholder:'쉼표로 구분해 주세요'}),field('interestsText','관심사 · 취미 이야기',p.interestsText,{optional:true,multiline:true,max:10000}),field('cv','CV에 덧붙일 소개',p.cv,{optional:true,multiline:true,max:20000}),field('cvUrl','CV 문서 링크',p.cvUrl,{optional:true,type:'url',max:2048,placeholder:'https://'}));
    }
    openDialog($('editor'));
  }
  function cancelEditor(){if(saving)return;if(dirty&&!window.confirm('저장하지 않은 내용을 닫을까요?'))return;dirty=false;closeDialog($('editor'));}
  $('editor-form').addEventListener('input',()=>dirty=true);
  $('editor-form').addEventListener('submit',async event=>{
    event.preventDefault();if(saving)return;saving=true;$('form-error').hidden=true;$('save-button').disabled=true;$('save-button').textContent='저장 중…';
    const values=Object.fromEntries(new FormData($('editor-form')));values.revision=editing.revision;
    if(['library','topics'].includes(editing.kind))values.entryIds=new FormData($('editor-form')).getAll('entryIds');
    for(const key of ['tags','interests'])if(key in values)values[key]=values[key].split(',').map(v=>v.trim()).filter(Boolean);
    try{
      const result=await api(editing.kind==='profile'?'/api/profile':`/api/${editing.kind}/${editing.id}`,'PUT',values);
      if(editing.kind==='profile')state.profile=result;else{const collection=state[editing.kind];const index=collection.findIndex(item=>item.id===result.id);if(index>=0)collection[index]=result;else collection.unshift(result);if(editing.kind==='entries')collection.sort((a,b)=>b.date.localeCompare(a.date));}
      dirty=false;closeDialog($('editor'));render();toast('저장했어요.');
    }catch(error){$('form-error').textContent=error.message;$('form-error').hidden=false;}
    finally{saving=false;$('save-button').disabled=false;$('save-button').textContent='저장하기 ↗';}
  });
  function confirmDelete(kind,value){deleting={kind,value};$('confirm-title').textContent=({entries:'이 기록을 삭제할까요?',projects:'이 사이트 링크를 삭제할까요?',library:'서재에서 이 자료를 삭제할까요?',topics:'이 관심사를 삭제할까요?',cvitems:'이 이력을 삭제할까요?'})[kind];$('delete-error').hidden=true;openDialog($('confirm-dialog'));}
  $('confirm-delete').addEventListener('click',async()=>{
    const button=$('confirm-delete');button.disabled=true;
    try{await api(`/api/${deleting.kind}/${deleting.value.id}`,'DELETE',{revision:deleting.value.revision});state[deleting.kind]=state[deleting.kind].filter(item=>item.id!==deleting.value.id);closeDialog($('confirm-dialog'));if($('reader').open)closeDialog($('reader'));if($('detail-dialog').open)closeDialog($('detail-dialog'));await load();toast('삭제했어요.');}catch(error){$('delete-error').textContent=error.message;$('delete-error').hidden=false;}finally{button.disabled=false;}
  });
  $('cancel-delete').addEventListener('click',()=>closeDialog($('confirm-dialog')));
  document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;document.querySelectorAll('.filter').forEach(other=>{other.classList.toggle('active',other===button);other.setAttribute('aria-pressed',String(other===button));});renderEntries();}));
  $('new-entry').addEventListener('click',()=>openEditor('entries'));$('new-project').addEventListener('click',()=>openEditor('projects'));$('edit-profile').addEventListener('click',()=>openEditor('profile'));$('edit-entry').addEventListener('click',()=>openEditor('entries',selected));$('delete-entry').addEventListener('click',()=>confirmDelete('entries',selected));
  for(const id of ['home-photo','about-photo'])$(id).addEventListener('error',()=>$(id).hidden=true);
  document.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click',()=>{const dialog=button.closest('dialog');if(dialog.id==='editor')cancelEditor();else closeDialog(dialog);}));
  document.querySelector('.cancel-editor').addEventListener('click',cancelEditor);
  document.querySelectorAll('dialog').forEach(dialog=>{dialog.addEventListener('cancel',event=>{if(dialog.id==='editor'){event.preventDefault();cancelEditor();}});dialog.addEventListener('close',()=>{if(!document.querySelector('dialog[open]')){document.body.classList.remove('modal-open');returnFocus?.focus();}});});
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  function openLogin(){
    $('login-error').hidden=true;
    openDialog($('login-dialog'));
    $('login-key').focus();
  }
  $('sign-in').addEventListener('click',openLogin);
  $('profile-name').addEventListener('click',()=>{if(owner)navigate('/archive');else openLogin();});
  $('login-form').addEventListener('submit',async event=>{
    event.preventDefault();const button=$('login-submit');button.disabled=true;$('login-error').hidden=true;
    try{await api('/api/login','POST',{key:$('login-key').value});owner=true;$('login-key').value='';closeDialog($('login-dialog'));await load();toast('편집 모드로 전환했어요.');}
    catch(error){$('login-error').textContent=error.message;$('login-error').hidden=false;}
    finally{button.disabled=false;}
  });
  $('sign-out').addEventListener('click',async()=>{try{await api('/api/logout','POST',{});owner=false;render();toast('로그아웃했어요.');}catch(error){toast(error.message);}});
  window.ArchiveUI={get state(){return state;},get owner(){return owner;},get aiReady(){return aiReady;},get page(){return page;},$,node,field,safeLink,api,toast,openDialog,closeDialog,openEditor,confirmDelete,readEntry,navigate};
  renderRoute();load();
})();
