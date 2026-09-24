(() => {
  'use strict';
  const UI=window.ArchiveUI;if(!UI)return;
  const {$,node,field,safeLink}=UI;
  const types={paper:'PAPER',article:'ARTICLE',book:'BOOK'},purposes={study:'STUDY',leisure:'LEISURE'};
  const sections={education:'Education',research:'Research',experience:'Experience',award:'Awards',skill:'Skills'};
  let typeFilter='all',purposeFilter='all',activeTopic=null,searching=false;
  const button=(text,action,cls='subtle-button')=>{const b=node('button',cls,text);b.type='button';b.addEventListener('click',action);return b;};
  function external(text,url,cls='text-link'){const a=node('a',cls,text);a.href=safeLink(url)||'#';a.target='_blank';a.rel='noopener noreferrer';return a;}
  function edit(kind,value){if($('detail-dialog').open)UI.closeDialog($('detail-dialog'));UI.openEditor(kind,value);}
  function controls(kind,item){const div=node('div','item-controls');if(UI.owner)div.append(button('수정',()=>edit(kind,item)),button('삭제',()=>UI.confirmDelete(kind,item),'subtle-button danger'));return div;}
  function relatedEntries(container,ids){
    container.replaceChildren();const entries=UI.state.entries.filter(e=>ids.includes(e.id));container.hidden=!entries.length;
    if(entries.length)container.append(node('h3','','연결된 아카이브'));
    for(const entry of entries)container.append(button(entry.title+' ↗',()=>{if($('detail-dialog').open)UI.closeDialog($('detail-dialog'));UI.readEntry(entry.id);},'related-link'));
  }
  function relationFields(value){
    const box=node('fieldset','relation-fields');box.append(node('legend','','연결할 아카이브 글'));
    if(!UI.state.entries.length)box.append(node('p','quiet-empty','아카이브에 기록을 남기면 여기서 연결할 수 있어요.'));
    const list=node('div','relation-options');
    for(const entry of UI.state.entries){const label=node('label'),check=node('input');check.type='checkbox';check.name='entryIds';check.value=entry.id;check.checked=(value?.entryIds||[]).includes(entry.id);label.append(check,node('span','',entry.title));list.append(label);}
    box.append(list);return box;
  }
  function editorFields(kind,value,fields){
    if(kind==='library'){
      $('editor-title').textContent=value?.id?'서재 기록 수정':'서재에 추가';
      const row=node('div','form-row');row.append(field('type','자료 종류',value?.type||'book',{choices:types}),field('purpose','읽기 목적',value?.purpose||'study',{choices:purposes}));
      fields.append(row,field('title','제목',value?.title,{required:true,max:200}),field('creator','저자 · 작성자',value?.creator,{optional:true,max:200}),field('url','책 · 원문 링크',value?.url,{required:true,type:'url',max:2048,placeholder:'https://'}),field('review','짧은 감상평',value?.review,{optional:true,multiline:true,max:5000}),field('tags','태그',value?.tags?.join(', '),{optional:true,max:500,placeholder:'쉼표로 구분해 주세요'}),relationFields(value));return true;
    }
    if(kind==='topics'){
      $('editor-title').textContent=value?.id?'관심사 수정':'새로운 관심사';
      const blocked=new Set(value?.id?[value.id]:[]);let changed=true;
      while(changed){changed=false;for(const topic of UI.state.topics)if(blocked.has(topic.parentId)&&!blocked.has(topic.id)){blocked.add(topic.id);changed=true;}}
      const parents={'':'중심에서 시작'};for(const topic of UI.state.topics)if(!blocked.has(topic.id))parents[topic.id]=topic.title;
      fields.append(field('title','관심사 이름',value?.title,{required:true,max:60}),field('parentId','상위 관심사',value?.parentId||'',{choices:parents}),field('note','이야기',value?.note,{optional:true,multiline:true,max:3000}),relationFields(value));return true;
    }
    if(kind==='cvitems'){
      $('editor-title').textContent=value?.id?'이력 수정':'이력 추가';
      const row=node('div','form-row');row.append(field('section','분류',value?.section||'education',{choices:sections}),field('period','기간',value?.period,{optional:true,max:100,placeholder:'2024 — Present'}));
      fields.append(row,field('title','학교 · 기관 · 프로젝트 이름',value?.title,{required:true,max:200}),field('subtitle','직책 · 전공 · 역할',value?.subtitle,{optional:true,max:200}),field('body','상세 내용',value?.body,{optional:true,multiline:true,max:5000}),field('url','관련 링크',value?.url,{optional:true,type:'url',max:2048}),field('order','표시 순서',value?.order??0,{type:'number',optional:true,placeholder:'작을수록 먼저 표시'}));return true;
    }
    return false;
  }
  function libraryItems(){
    const saved=UI.state.library||[];
    // Previously written reading records remain discoverable until explicitly added to the shelf.
    const legacy=UI.state.entries.filter(e=>e.category==='reading'&&!saved.some(b=>b.entryIds.includes(e.id))).map(e=>({id:'legacy-'+e.id,title:e.title,creator:'',type:'paper',purpose:'study',review:e.summary||e.body,url:e.sourceUrl,entryIds:[e.id],tags:e.tags,createdAt:e.createdAt,legacy:true}));
    return [...saved,...legacy].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  }
  function renderShelf(){
    const term=$('library-query').value.trim().toLocaleLowerCase(),all=libraryItems();
    const books=all.filter(b=>(typeFilter==='all'||b.type===typeFilter)&&(purposeFilter==='all'||b.purpose===purposeFilter)&&(!term||[b.title,b.creator,b.review,...b.tags].join(' ').toLocaleLowerCase().includes(term)));
    $('shelf-count').textContent=books.length+' READINGS';$('bookshelf').replaceChildren();
    if(!books.length){const empty=node('div',all.length?'empty-shelf':'empty-shelf template-copy');empty.append(node('span','','MY READING ROOM'),node('p','',all.length?'조건에 맞는 읽을거리가 없어요.':'읽은 논문, 글, 책이 꽂힐 자리예요.'));$('bookshelf').append(empty);return;}
    for(let start=0;start<books.length;start+=9){const shelf=node('div','shelf-row');
      books.slice(start,start+9).forEach((book,i)=>{const b=button('',()=>readBook(book),'book-spine');b.setAttribute('aria-label',book.title+' — '+types[book.type]+', 감상평 읽기');b.dataset.type=book.type;b.style.setProperty('--book-height',(205+(book.title.length*7%45))+'px');b.append(node('span','spine-type',types[book.type]),node('span','spine-title',book.title),node('span','spine-purpose',purposes[book.purpose]));shelf.append(b);});$('bookshelf').append(shelf);
    }
  }
  function readBook(book){
    if($('reader').open)UI.closeDialog($('reader'));
    $('detail-meta').textContent=types[book.type]+' / '+purposes[book.purpose];$('detail-title').textContent=book.title;$('detail-creator').textContent=book.creator;
    $('detail-review').textContent=book.review||'아직 남긴 감상평이 없어요.';
    $('detail-review').classList.toggle('template-copy',!book.review);
    const url=safeLink(book.url);$('detail-link').hidden=!url;if(url)$('detail-link').href=url;else $('detail-link').removeAttribute('href');
    relatedEntries($('detail-related'),book.entryIds);$('detail-controls').replaceChildren();
    if(UI.owner){if(book.legacy)$('detail-controls').append(button('책장에 별도로 등록',()=>edit('library',{...book,id:undefined,revision:null})));else $('detail-controls').append(controls('library',book));}
    UI.openDialog($('detail-dialog'));
  }
  function readRelated(entryId){
    const box=$('reader-related');box.replaceChildren();const books=(UI.state.library||[]).filter(b=>b.entryIds.includes(entryId)),topics=(UI.state.topics||[]).filter(t=>t.entryIds.includes(entryId));box.hidden=!books.length&&!topics.length;
    if(books.length||topics.length)box.append(node('h3','','함께 연결된 것들'));
    books.forEach(book=>box.append(button('LIBRARY / '+book.title+' ↗',()=>readBook(book),'related-link')));
    topics.forEach(topic=>box.append(button('INTERESTS / '+topic.title+' ↗',()=>{UI.closeDialog($('reader'));UI.navigate('/interests');showTopic(topic.id);$('topic-detail').scrollIntoView?.({block:'nearest'});},'related-link')));
  }
  function renderMap(){
    const topics=UI.state.topics||[],map=$('mindmap');map.replaceChildren();
    const children=id=>topics.filter(t=>(t.parentId||'')===id),roots=children('');
    const leaves=topic=>Math.max(1,children(topic.id).reduce((sum,t)=>sum+leaves(t),0));
    const depths=topic=>1+Math.max(0,...children(topic.id).map(depths));
    const depth=Math.max(1,...roots.map(depths));const centerX=Math.max(420,depth*200+130),width=centerX*2;
    const left=roots.filter((_,i)=>i%2===0),right=roots.filter((_,i)=>i%2!==0);
    const span=list=>list.reduce((sum,t)=>sum+leaves(t)*100,0),height=Math.max(480,span(left)+100,span(right)+100),centerY=height/2;
    map.style.width=width+'px';map.style.height=height+'px';
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('mindmap-lines');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);map.append(svg);
    function edge(x,y,px,py){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',`M${px} ${py} C${(px+x)/2} ${py},${(px+x)/2} ${y},${x} ${y}`);svg.append(path);}
    function place(topic,direction,level,top,parent){const area=leaves(topic)*100,x=centerX+direction*level*200,y=top+area/2;edge(x,y,parent.x,parent.y);
      const b=button('',()=>showTopic(topic.id),'mindmap-node');b.dataset.topicId=topic.id;b.style.left=x+'px';b.style.top=y+'px';b.append(node('span','',topic.title),node('small','',topic.entryIds.length+'개의 기록'));map.append(b);
      let cursor=top;for(const child of children(topic.id)){place(child,direction,level+1,cursor,{x,y});cursor+=leaves(child)*100;}}
    for(const [list,direction]of [[left,-1],[right,1]]){let cursor=(height-span(list))/2;for(const topic of list){place(topic,direction,1,cursor,{x:centerX,y:centerY});cursor+=leaves(topic)*100;}}
    const root=node('div','mindmap-root',UI.state.profile?.name||'Gyulim Kim');root.style.left=centerX+'px';root.style.top=centerY+'px';map.append(root);
    if(!topics.length){const empty=node('p','map-empty template-copy','첫 관심사를 추가해서 지도를 펼쳐 보세요.');empty.style.left=centerX+'px';empty.style.top=(centerY+85)+'px';map.append(empty);}
    const scroller=map.parentElement;if(scroller.clientWidth&&!scroller.dataset.positioned){scroller.scrollLeft=(width-scroller.clientWidth)/2;scroller.dataset.positioned='true';}
    if(activeTopic&&topics.some(t=>t.id===activeTopic))showTopic(activeTopic);else {$('topic-detail').hidden=true;activeTopic=null;}
  }
  function showTopic(id){
    const topic=UI.state.topics.find(t=>t.id===id);if(!topic)return;activeTopic=id;
    document.querySelectorAll('.mindmap-node').forEach(b=>b.classList.toggle('selected',b.dataset.topicId===id));
    const detail=$('topic-detail');detail.hidden=false;detail.replaceChildren();const header=node('div','section-heading');header.append(node('h2','',topic.title),controls('topics',topic));detail.append(header,node('p','prose',topic.note||''));const related=node('div','related-block');relatedEntries(related,topic.entryIds);detail.append(related);
    if(!topic.entryIds.length)detail.append(node('p','quiet-empty template-copy','아직 연결된 아카이브 글이 없어요.'));
  }
  function renderResume(){
    $('resume-name').textContent=UI.state.profile?.name||'Gyulim Kim';$('resume-affiliation').textContent=UI.state.profile?.affiliation||'';
    const container=$('resume-sections');container.replaceChildren();
    for(const [key,label]of Object.entries(sections)){
      const items=(UI.state.cvitems||[]).filter(i=>i.section===key).sort((a,b)=>a.order-b.order||b.createdAt.localeCompare(a.createdAt));
      const section=node('section','resume-section'),content=node('div','resume-rows');section.append(node('h3','',label),content);
      if(!items.length)content.append(node('p','resume-empty template-copy','아직 등록한 항목이 없어요.'));
      for(const item of items){const row=node('article','resume-row'),copy=node('div');row.append(node('p','resume-period',item.period),copy);copy.append(node('h4','',item.title),node('p','resume-subtitle',item.subtitle));if(item.body)copy.append(node('p','prose',item.body));if(item.url)copy.append(external('관련 링크 ↗',item.url));if(UI.owner)copy.append(controls('cvitems',item));content.append(row);}
      container.append(section);
    }
    $('cv-empty').hidden=true;
  }
  function render(){renderShelf();renderMap();renderResume();$('interests-empty').hidden=!!(UI.state.topics.length||UI.state.profile.interests.length||UI.state.profile.interestsText);if(!searching&&!$('discover-results').childElementCount)$('discover-status').textContent=UI.aiReady?'AI 웹 검색 사용 시 연결한 API에 사용량 요금이 발생해요.':'AI 웹 검색은 연결 대기 중이에요. 서재 등록과 일반 검색은 바로 사용할 수 있어요.';}
  $('new-book').addEventListener('click',()=>UI.openEditor('library'));$('new-topic').addEventListener('click',()=>UI.openEditor('topics'));$('new-cvitem').addEventListener('click',()=>UI.openEditor('cvitems'));
  $('print-cv').addEventListener('click',()=>window.print());$('library-query').addEventListener('input',renderShelf);
  for(const [selector,key]of [['[data-book-type]','bookType'],['[data-book-purpose]','bookPurpose']])document.querySelectorAll(selector).forEach(b=>b.addEventListener('click',()=>{if(key==='bookType')typeFilter=b.dataset[key];else purposeFilter=b.dataset[key];document.querySelectorAll(selector).forEach(other=>other.setAttribute('aria-pressed',String(other===b)));renderShelf();}));
  $('discover-form').addEventListener('submit',async event=>{
    event.preventDefault();if(searching||!UI.owner)return;
    if(!UI.aiReady){$('discover-status').textContent='AI 웹 검색을 사용하려면 서버에 API 키를 연결해야 해요. 아직 유료 검색은 실행되지 않았어요.';return;}
    searching=true;$('discover-submit').disabled=true;$('discover-results').replaceChildren();$('discover-status').textContent='웹에서 출처를 확인하며 읽을거리를 찾고 있어요…';
    const purpose=$('discover-purpose').value;
    try{const result=await UI.api('/api/discover','POST',{query:$('discover-query').value.trim(),type:$('discover-type').value,purpose});
      $('discover-status').textContent=result.results.length?'출처를 열어 확인한 뒤 서재에 담아 보세요.':'출처가 확인되는 자료를 찾지 못했어요. 검색어를 바꿔 보세요.';
      for(const item of result.results){const card=node('article','discovery-card');card.append(node('span','eyebrow',types[item.type]),node('h3','',item.title),node('p','detail-creator',item.creator),node('p','',item.reason),external('출처 · '+item.sourceTitle+' ↗',item.url));const add=button('서재에 담기 ＋',()=>edit('library',{title:item.title,creator:item.creator,type:item.type,purpose,url:item.url,review:'',tags:[],entryIds:[]}));card.append(add);$('discover-results').append(card);}
    }catch(error){$('discover-status').textContent=error.message;}finally{searching=false;$('discover-submit').disabled=false;}
  });
  window.Spaces={render,editorFields,readRelated};
  if(UI.state.profile)render();
})();
