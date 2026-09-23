(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const labels = {study:'공부 노트',reading:'읽은 논문',publication:'참여 논문'};
  let state={profile:null,entries:[],projects:[]}, owner=false, localMode=false, filter='all', selected=null, editing=null, deleting=null, dirty=false, saving=false, returnFocus=null, toastTimer;
  const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  const safeLink=value=>{try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.href:null;}catch{return null;}};
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
  async function api(path,method='GET',body){
    const response=await fetch(path,{method,headers:body?{'Content-Type':'application/json','X-Archive-Request':'1'}:undefined,body:body?JSON.stringify(body):undefined});
    let value;try{value=await response.json();}catch{throw new Error('서버 응답을 읽지 못했어요. 잠시 후 다시 시도해 주세요.');}
    if(!response.ok)throw new Error(value.error||'처리하지 못했어요. 다시 시도해 주세요.');
    return value;
  }
  function ownerUI(){document.querySelectorAll('.owner-only').forEach(el=>el.hidden=!owner);$('sign-in').hidden=owner;$('sign-out').hidden=!owner||localMode;['edit-profile','new-entry','new-project'].forEach(id=>$(id).disabled=!state.profile);}
  function openDialog(dialog){returnFocus=document.activeElement;dialog.showModal();document.body.classList.add('modal-open');}
  function closeDialog(dialog){dialog.close();if(!document.querySelector('dialog[open]'))document.body.classList.remove('modal-open');}
  function renderProfile(){
    const p=state.profile;if(!p)return;
    const words=p.name.trim().split(/\s+/);const last=words.pop();
    $('profile-name').replaceChildren();
    if(words.length)$('profile-name').append(document.createTextNode(words.join(' ')),document.createElement('br'));
    $('profile-name').append(node('em','',last+'.'));
    $('profile-affiliation').textContent=p.affiliation;
    $('profile-bio').textContent=p.bio;
    $('profile-interests').replaceChildren(...p.interests.map(tag=>node('span','',tag)));
    $('footer-name').textContent=p.name;
    document.title=p.name+' — Personal archive';
  }
  function renderEntries(){
    const entries=state.entries.filter(e=>filter==='all'||e.category===filter);
    $('entries').replaceChildren();
    if(!entries.length){
      const empty=node('div','empty-state');
      empty.append(node('span','empty-index','01'),node('h3','',filter==='all'?'아직 비어 있는 첫 페이지.':labels[filter]+'의 첫 페이지.'));
      const descriptions={study:'배운 것과 이해한 것을 나의 언어로 남겨요.',reading:'읽은 논문과 그 안에서 발견한 질문들을 모아요.',publication:'함께한 연구와 참여한 논문을 소개해요.',all:'공부한 것, 읽은 논문, 함께한 연구.\n차곡차곡 쌓여갈 생각들을 위한 자리예요.'};
      const p=node('p','',descriptions[filter]);p.style.whiteSpace='pre-line';empty.append(p);
      if(owner){const button=node('button','subtle-button','첫 기록 남기기 ↗');button.type='button';button.addEventListener('click',()=>openEditor('entries'));empty.append(button);}
      $('entries').append(empty);
    }
    entries.forEach(entry=>{
      const button=node('button','entry-row');button.type='button';button.setAttribute('aria-label',entry.title+' 읽기');
      const content=node('div');const meta=node('div','entry-meta');meta.append(node('span','entry-category',labels[entry.category]),node('time','',entry.date.replaceAll('-','.')));content.append(meta,node('h3','',entry.title));
      if(entry.summary)content.append(node('p','',entry.summary));
      if(entry.tags.length){const tags=node('div','entry-tags');tags.append(...entry.tags.map(tag=>node('span','','#'+tag)));content.append(tags);}
      button.append(content,node('span','entry-arrow','↗'));button.addEventListener('click',()=>readEntry(entry.id));$('entries').append(button);
    });
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
  function render(){renderProfile();renderEntries();renderProjects();ownerUI();}
  async function load(){
    const [content,session]=await Promise.allSettled([api('/api/content'),api('/api/session')]);
    owner=session.status==='fulfilled'&&session.value.canEdit;
    localMode=session.status==='fulfilled'&&session.value.local;
    if(content.status==='fulfilled'){state=content.value;render();}else{
      const error=node('div','error-state');error.append(node('p','','기록을 불러오지 못했어요.'),node('small','','잠시 후 다시 연결해 주세요.'));const retry=node('button','subtle-button','다시 불러오기 ↻');retry.type='button';retry.addEventListener('click',load);error.append(retry);$('entries').replaceChildren(error);ownerUI();
    }
  }
  function readEntry(id){
    selected=state.entries.find(e=>e.id===id);if(!selected)return;
    $('reader-meta').textContent=labels[selected.category]+' / '+selected.date.replaceAll('-','.');$('reader-title').textContent=selected.title;$('reader-summary').textContent=selected.summary;$('reader-summary').hidden=!selected.summary;$('reader-body').textContent=selected.body;
    const url=safeLink(selected.sourceUrl);$('reader-source').hidden=!url;if(url)$('reader-source').href=url;else $('reader-source').removeAttribute('href');
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
    }else{
      $('editor-title').textContent='나의 소개';const p=state.profile;editing.revision=p.revision;fields.append(field('name','이름',p.name,{required:true,max:80}),field('affiliation','소속·한 줄 소개',p.affiliation,{optional:true,max:150}),field('bio','소개글',p.bio,{optional:true,multiline:true,max:2000}),field('interests','관심 분야',p.interests.join(', '),{optional:true,max:500,placeholder:'쉼표로 구분해 주세요'}));
    }
    openDialog($('editor'));
  }
  function cancelEditor(){if(saving)return;if(dirty&&!window.confirm('저장하지 않은 내용을 닫을까요?'))return;dirty=false;closeDialog($('editor'));}
  $('editor-form').addEventListener('input',()=>dirty=true);
  $('editor-form').addEventListener('submit',async event=>{
    event.preventDefault();if(saving)return;saving=true;$('form-error').hidden=true;$('save-button').disabled=true;$('save-button').textContent='저장 중…';
    const values=Object.fromEntries(new FormData($('editor-form')));values.revision=editing.revision;
    for(const key of ['tags','interests'])if(key in values)values[key]=values[key].split(',').map(v=>v.trim()).filter(Boolean);
    try{
      const result=await api(editing.kind==='profile'?'/api/profile':`/api/${editing.kind}/${editing.id}`,'PUT',values);
      if(editing.kind==='profile')state.profile=result;else{const collection=state[editing.kind];const index=collection.findIndex(item=>item.id===result.id);if(index>=0)collection[index]=result;else collection.unshift(result);if(editing.kind==='entries')collection.sort((a,b)=>b.date.localeCompare(a.date));}
      dirty=false;closeDialog($('editor'));render();toast('저장했어요.');
    }catch(error){$('form-error').textContent=error.message;$('form-error').hidden=false;}
    finally{saving=false;$('save-button').disabled=false;$('save-button').textContent='저장하기 ↗';}
  });
  function confirmDelete(kind,value){deleting={kind,value};$('confirm-title').textContent=kind==='entries'?'이 기록을 삭제할까요?':'이 사이트 링크를 삭제할까요?';$('delete-error').hidden=true;openDialog($('confirm-dialog'));}
  $('confirm-delete').addEventListener('click',async()=>{
    const button=$('confirm-delete');button.disabled=true;
    try{await api(`/api/${deleting.kind}/${deleting.value.id}`,'DELETE',{revision:deleting.value.revision});state[deleting.kind]=state[deleting.kind].filter(item=>item.id!==deleting.value.id);closeDialog($('confirm-dialog'));if($('reader').open)closeDialog($('reader'));render();toast('삭제했어요.');}catch(error){$('delete-error').textContent=error.message;$('delete-error').hidden=false;}finally{button.disabled=false;}
  });
  $('cancel-delete').addEventListener('click',()=>closeDialog($('confirm-dialog')));
  document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;document.querySelectorAll('.filter').forEach(other=>{other.classList.toggle('active',other===button);other.setAttribute('aria-pressed',String(other===button));});renderEntries();}));
  $('new-entry').addEventListener('click',()=>openEditor('entries'));$('new-project').addEventListener('click',()=>openEditor('projects'));$('edit-profile').addEventListener('click',()=>openEditor('profile'));$('edit-entry').addEventListener('click',()=>openEditor('entries',selected));$('delete-entry').addEventListener('click',()=>confirmDelete('entries',selected));
  document.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click',()=>{const dialog=button.closest('dialog');if(dialog.id==='editor')cancelEditor();else closeDialog(dialog);}));
  document.querySelector('.cancel-editor').addEventListener('click',cancelEditor);
  document.querySelectorAll('dialog').forEach(dialog=>{dialog.addEventListener('cancel',event=>{if(dialog.id==='editor'){event.preventDefault();cancelEditor();}});dialog.addEventListener('close',()=>{if(!document.querySelector('dialog[open]')){document.body.classList.remove('modal-open');returnFocus?.focus();}});});
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  $('year').textContent=String(new Date().getFullYear());
  $('sign-in').addEventListener('click',()=>{$('login-error').hidden=true;openDialog($('login-dialog'));});
  $('login-form').addEventListener('submit',async event=>{
    event.preventDefault();const button=$('login-submit');button.disabled=true;$('login-error').hidden=true;
    try{await api('/api/login','POST',{key:$('login-key').value});owner=true;$('login-key').value='';closeDialog($('login-dialog'));render();toast('편집 모드로 전환했어요.');}
    catch(error){$('login-error').textContent=error.message;$('login-error').hidden=false;}
    finally{button.disabled=false;}
  });
  $('sign-out').addEventListener('click',async()=>{try{await api('/api/logout','POST',{});owner=false;render();toast('로그아웃했어요.');}catch(error){toast(error.message);}});
  load();
})();
