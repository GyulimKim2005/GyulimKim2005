import {Editor} from '@tiptap/core';
import {noteExtensions} from './note-extensions.js';
import {validateNoteDocument,noteText,plainDocument,NOTE_VERSION} from './note-document.mjs';
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const button=(label,action,title=label)=>{const b=el('button','note-tool',label);b.type='button';b.title=title;b.setAttribute('aria-label',title);b.addEventListener('click',action);return b;};
const css=document.createElement('link');css.rel='stylesheet';css.href='/study/vendor/katex/katex.min.css';document.head.append(css);
const errorMessage=error=>error?.message||'처리하지 못했어요. 다시 시도해 주세요.';

async function compressedImage(file){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('PNG·JPG·WebP 이미지를 선택해 주세요.');
  if(file.size>15000000)throw new Error('원본 이미지 한 장은 15MB까지 넣을 수 있어요.');
  const image=await createImageBitmap(file);try{
    const canvas=document.createElement('canvas'),scale=Math.min(1,1800/Math.max(image.width,image.height));canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    let data=canvas.toDataURL('image/webp',.84);for(let q=.72;data.length>340000&&q>=.36;q-=.12)data=canvas.toDataURL('image/webp',q);
    if(data.length>340000)throw new Error('이미지가 너무 커요. 필요한 부분을 잘라 넣어 주세요.');return data;
  }finally{image.close();}
}

export function mount({textarea,form,entry,id,onDirty,onRevision}){
  const dialog=form.closest('dialog');dialog.classList.add('study-editor');
  const old=textarea.parentElement,field=el('div','field study-body-field');field.append(...old.childNodes);old.replaceWith(field);
  const originalRequired=textarea.required;textarea.required=false;textarea.hidden=true;
  const root=el('div','note-workspace'),toolbar=el('div','note-toolbar'),surface=el('div','note-surface'),footer=el('div','note-status'),status=el('span','','작성 중'),count=el('span'),message=el('p','note-error');message.hidden=true;message.setAttribute('role','alert');
  footer.append(status,count);root.append(toolbar,surface,message,footer);field.append(root);
  const draftKey='gyulim-study-draft:'+(entry?.id||'new');let editor,changed=false,timer,revision=entry?.revision??null,pendingImages=0,destroyed=false,mathLoading=false,savingNote=false;
  const showError=error=>{message.textContent=errorMessage(error);message.hidden=false;};
  function sync(){textarea.value=noteText(editor.getJSON());count.textContent=textarea.value.length.toLocaleString()+'자';}
  function draft(){
    clearTimeout(timer);if(!changed||destroyed||savingNote)return;
    try{localStorage.setItem(draftKey,JSON.stringify({version:1,id,revision,updatedAt:new Date().toISOString(),fields:Object.fromEntries(new FormData(form)),bodyDoc:editor.getJSON()}));status.textContent='이 기기에 임시 저장됨 · '+new Intl.DateTimeFormat('ko',{hour:'2-digit',minute:'2-digit'}).format(new Date());}
    catch{status.textContent='임시 저장 공간이 부족해요 · 저장하기를 눌러 주세요';}
  }
  function markChanged(){changed=true;onDirty();status.textContent='작성 중…';clearTimeout(timer);timer=setTimeout(draft,600);}
  const formInput=()=>markChanged();form.addEventListener('input',formInput);form.addEventListener('change',formInput);
  const saveKey=event=>{if(!event.defaultPrevented&&!event.isComposing&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();form.requestSubmit();}};form.addEventListener('keydown',saveKey);
  const unload=()=>draft();window.addEventListener('beforeunload',unload);
  async function openMath(target={}){
    if(mathLoading)return;mathLoading=true;const selection=editor.state.selection;
    try{const {editEquation}=await import('./math-input.js');if(destroyed)return;
      editEquation({latex:target.node?.attrs.latex||'',display:target.node?target.node.type.name==='blockMath':true,parent:dialog,
        onApply(latex,display){
          const node={type:display?'blockMath':'inlineMath',attrs:{latex}};
          if(target.node){editor.chain().focus().insertContentAt({from:target.pos,to:target.pos+target.node.nodeSize},node).run();}
          else editor.chain().focus().setTextSelection(selection).insertContent(node).run();
          // Leave a text caret after the inserted formula, so the next action
          // cannot accidentally replace the selected atomic math node.
          let found=null,distance=Infinity;const origin=target.pos??selection.from;
          editor.state.doc.descendants((item,pos)=>{if(item.type.name===node.type&&item.attrs.latex===latex&&Math.abs(pos-origin)<distance){found={pos,size:item.nodeSize};distance=Math.abs(pos-origin);}});
          if(found){const after=found.pos+found.size;
            if(display){const next=editor.state.doc.nodeAt(after);if(next?.isTextblock)editor.commands.setTextSelection(after+1);else editor.chain().insertContentAt(after,{type:'paragraph'}).setTextSelection(after+1).run();}
            else editor.commands.setTextSelection(after);
          }
        },onClose:()=>editor.commands.focus()});
    }catch(error){showError(error);}finally{mathLoading=false;}
  }
  async function addFiles(files){
    const images=[...files].filter(file=>file.type.startsWith('image/'));if(!images.length)return;
    pendingImages++;status.textContent='이미지 준비 중…';message.hidden=true;
    try{for(const file of images){const src=await compressedImage(file);if(destroyed)return;editor.chain().focus().setImage({src,alt:file.name.replace(/\.[^.]+$/,'')}).run();}sync();markChanged();}
    catch(error){showError(error);}finally{pendingImages--;}
  }
  editor=new Editor({element:surface,extensions:noteExtensions(openMath),content:entry?.bodyDoc||plainDocument(textarea.value),
    editorProps:{attributes:{class:'note-prose',role:'textbox','aria-label':'본문','aria-multiline':'true',spellcheck:'false'},
      handlePaste(view,event){const files=event.clipboardData?.files;if(files?.length){event.preventDefault();void addFiles(files);return true;}return false;},
      handleDrop(view,event){if(event.dataTransfer?.files.length){event.preventDefault();void addFiles(event.dataTransfer.files);return true;}return false;},
      handleKeyDown(view,event){if(event.altKey&&event.key==='='){event.preventDefault();void openMath();return true;}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();form.requestSubmit();return true;}return false;}
    },onUpdate(){sync();markChanged();refreshTools();},onSelectionUpdate(){refreshTools();}
  });
  const activeTools=[];
  function tool(label,command,active,title=label){const b=button(label,()=>command(editor.chain().focus()).run(),title);if(active)activeTools.push([b,active]);toolbar.append(b);return b;}
  function select(label,choices,change){const s=el('select','note-select');s.setAttribute('aria-label',label);s.title=label;for(const [value,name]of choices){const o=el('option','',name);o.value=value;s.append(o);}s.addEventListener('change',()=>change(s.value));toolbar.append(s);return s;}
  const format=select('문단 스타일',[['p','본문'],['1','제목 1'],['2','제목 2'],['3','제목 3']],value=>value==='p'?editor.chain().focus().setParagraph().run():editor.chain().focus().toggleHeading({level:Number(value)}).run());
  const size=select('글자 크기',[['','기본 크기'],...['12','14','16','18','20','24','28','32'].map(n=>[n+'px',n])],value=>value?editor.chain().focus().setFontSize(value).run():editor.chain().focus().unsetFontSize().run());
  tool('B',c=>c.toggleBold(),()=>editor.isActive('bold'),'굵게 (Ctrl+B)');tool('I',c=>c.toggleItalic(),()=>editor.isActive('italic'),'기울임 (Ctrl+I)');tool('U',c=>c.toggleUnderline(),()=>editor.isActive('underline'),'밑줄 (Ctrl+U)');tool('S̶',c=>c.toggleStrike(),()=>editor.isActive('strike'),'취소선');
  select('글자 색',[['','글자색'],['#222222','검정'],['#4169e1','로얄블루'],['#b3294a','빨강'],['#28765a','초록']],value=>value?editor.chain().focus().setColor(value).run():editor.chain().focus().unsetColor().run());
  select('형광펜',[['','형광펜'],['#fff0ad','노랑'],['#e3eafe','파랑'],['#f9dde7','분홍'],['remove','없애기']],value=>value==='remove'?editor.chain().focus().unsetHighlight().run():value&&editor.chain().focus().setHighlight({color:value}).run());
  tool('x²',c=>c.toggleSuperscript(),()=>editor.isActive('superscript'),'위 첨자');tool('x₂',c=>c.toggleSubscript(),()=>editor.isActive('subscript'),'아래 첨자');
  const math=button('∑ 수식',()=>openMath(),'수식 넣기 (Alt+=)');math.classList.add('note-math-tool');toolbar.append(math);
  tool('• 목록',c=>c.toggleBulletList(),()=>editor.isActive('bulletList'),'글머리 목록');tool('1. 목록',c=>c.toggleOrderedList(),()=>editor.isActive('orderedList'),'번호 목록');
  tool('“ 인용',c=>c.toggleBlockquote(),()=>editor.isActive('blockquote'),'인용');tool('</>',c=>c.toggleCodeBlock(),()=>editor.isActive('codeBlock'),'코드 블록');tool('─',c=>c.setHorizontalRule(),null,'구분선');
  select('문단 정렬',[['left','왼쪽 정렬'],['center','가운데 정렬'],['right','오른쪽 정렬'],['justify','양쪽 정렬']],value=>editor.chain().focus().setTextAlign(value).run());
  toolbar.append(button('링크',()=>linkDialog(editor,dialog)),button('표',()=>tableDialog(editor,dialog)));
  const imageInput=el('input');imageInput.type='file';imageInput.accept='image/png,image/jpeg,image/webp';imageInput.multiple=true;imageInput.hidden=true;imageInput.onchange=()=>{void addFiles(imageInput.files);imageInput.value='';};root.append(imageInput);
  toolbar.append(button('이미지',()=>imageInput.click(),'이미지 파일 넣기 · 붙여넣기도 가능'));
  tool('서식 지우기',c=>c.unsetAllMarks().clearNodes());
  const undo=tool('↶',c=>c.undo(),null,'실행 취소 (Ctrl+Z)'),redo=tool('↷',c=>c.redo(),null,'다시 실행 (Ctrl+Shift+Z)');
  const tableTools=el('div','note-context-tools');tableTools.setAttribute('aria-label','표 편집');
  for(const [label,command]of [['행 추가','addRowAfter'],['열 추가','addColumnAfter'],['행 삭제','deleteRow'],['열 삭제','deleteColumn'],['셀 병합','mergeCells'],['셀 나누기','splitCell'],['표 삭제','deleteTable']])tableTools.append(button(label,()=>editor.chain().focus()[command]().run()));
  const imageTools=el('div','note-context-tools');imageTools.setAttribute('aria-label','이미지 크기');imageTools.append(el('span','','이미지 크기'));
  for(const width of ['25%','50%','75%','100%'])imageTools.append(button(width,()=>editor.chain().focus().updateAttributes('image',{width}).run()));
  imageTools.append(button('이미지 삭제',()=>editor.chain().focus().deleteSelection().run()));
  toolbar.after(tableTools,imageTools);
  function refreshTools(){if(!editor||!undo)return;for(const [b,test]of activeTools)b.setAttribute('aria-pressed',String(test()));undo.disabled=!editor.can().undo();redo.disabled=!editor.can().redo();format.value=editor.isActive('heading')?String(editor.getAttributes('heading').level):'p';size.value=editor.getAttributes('textStyle').fontSize||'';tableTools.hidden=!editor.isActive('table');imageTools.hidden=!editor.isActive('image');}
  sync();refreshTools();
  try{
    const saved=JSON.parse(localStorage.getItem(draftKey)||'null');
    if(saved?.version===1&&saved.bodyDoc){
      const banner=el('div','note-draft-banner');banner.append(el('span','','저장하지 않은 임시 노트가 있어요.'));
      banner.append(button('복구',()=>{
        try{const doc=validateNoteDocument(saved.bodyDoc);for(const [key,value]of Object.entries(saved.fields||{})){const input=form.elements.namedItem(key);if(input&&typeof value==='string')input.value=value;}revision=saved.revision;onRevision(revision);editor.commands.setContent(doc);sync();markChanged();banner.remove();}catch(error){showError(error);}
      }),button('버리기',()=>{localStorage.removeItem(draftKey);banner.remove();}));root.before(banner);
    }
  }catch{}
  function collect(){
    if(pendingImages)throw new Error('이미지 준비가 끝난 뒤 저장해 주세요.');
    const bodyDoc=validateNoteDocument(editor.getJSON()),body=noteText(bodyDoc);if(!body)throw new Error('본문이나 수식을 입력해 주세요.');if(body.length>100000)throw new Error('노트 본문은 10만 자까지 저장할 수 있어요.');
    return {body,bodyDoc,bodyVersion:NOTE_VERSION};
  }
  let pausedControls=[];
  function setSaving(value){if(destroyed)return;editor.setEditable(!value,false);if(value){draft();savingNote=true;pausedControls=[...form.querySelectorAll('input,select,textarea,button')].filter(control=>!control.disabled);pausedControls.forEach(control=>control.disabled=true);}else{savingNote=false;pausedControls.forEach(control=>control.disabled=false);pausedControls=[];refreshTools();}}
  return {collect,setSaving,saved(){changed=false;clearTimeout(timer);try{localStorage.removeItem(draftKey);}catch{}status.textContent='저장됨';},destroy(){setSaving(false);draft();destroyed=true;clearTimeout(timer);window.removeEventListener('beforeunload',unload);form.removeEventListener('input',formInput);form.removeEventListener('change',formInput);form.removeEventListener('keydown',saveKey);editor.destroy();textarea.required=originalRequired;textarea.hidden=false;dialog.classList.remove('study-editor');},flush:draft};
}

function simpleDialog(parent,title){const d=el('dialog','note-insert-dialog');d.setAttribute('aria-label',title);d.append(el('h2','',title));const actions=el('div','note-insert-actions');actions.append(button('취소',()=>d.close()));d.append(actions);parent.append(d);d.addEventListener('close',()=>d.remove(),{once:true});return {d,actions};}
function linkDialog(editor,parent){
  const {d,actions}=simpleDialog(parent,'링크'),selection=editor.state.selection,input=el('input');input.type='url';input.placeholder='https://';input.setAttribute('aria-label','링크 주소');input.value=editor.getAttributes('link').href||'';actions.before(input);
  actions.append(button('링크 없애기',()=>{editor.chain().focus().setTextSelection(selection).extendMarkRange('link').unsetLink().run();d.close();}),button('적용',()=>{
    try{const url=new URL(input.value);if(!['http:','https:','mailto:'].includes(url.protocol))throw new Error();if(selection.empty&&!editor.isActive('link'))editor.chain().focus().insertContent({type:'text',text:input.value,marks:[{type:'link',attrs:{href:url.href}}]}).run();else editor.chain().focus().setTextSelection(selection).extendMarkRange('link').setLink({href:url.href}).run();d.close();}catch{input.setCustomValidity('올바른 웹 주소를 입력해 주세요.');input.reportValidity();}
  }));input.oninput=()=>input.setCustomValidity('');d.addEventListener('close',()=>editor.commands.focus(),{once:true});d.showModal();input.focus();
}
function tableDialog(editor,parent){
  const {d,actions}=simpleDialog(parent,'표 넣기');const inputs={};for(const [name,text,value,max]of [['rows','행',3,100],['cols','열',3,30]]){const label=el('label','',text),input=el('input');input.type='number';input.min='1';input.max=String(max);input.value=String(value);input.setAttribute('aria-label',text+' 개수');label.append(input);actions.before(label);inputs[name]=input;}
  actions.append(button('표 넣기',()=>{const rows=Number(inputs.rows.value),cols=Number(inputs.cols.value);if(!Number.isInteger(rows)||!Number.isInteger(cols)||rows<1||rows>100||cols<1||cols>30)return;editor.chain().focus().insertTable({rows,cols,withHeaderRow:true}).run();d.close();}));d.addEventListener('close',()=>editor.commands.focus(),{once:true});d.showModal();
}
export function render(element,entry){
  element.replaceChildren();element.classList.add('rich-note-reader');
  const reader=new Editor({element,extensions:noteExtensions(),editable:false,content:entry.bodyDoc||plainDocument(entry.body),editorProps:{attributes:{class:'note-prose',role:'document','aria-readonly':'true'}}});
  return ()=>{reader.destroy();element.classList.remove('rich-note-reader');};
}
