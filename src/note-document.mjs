// Versioned, HTML-free study documents. Used by both the API and the editor.
export const NOTE_VERSION=1;
const nodeTypes=new Set(['doc','text','paragraph','heading','bulletList','orderedList','listItem','blockquote','codeBlock','hardBreak','horizontalRule','image','table','tableRow','tableCell','tableHeader','inlineMath','blockMath']);
const markTypes=new Set(['bold','italic','underline','strike','code','link','highlight','textStyle','subscript','superscript']);
const fail=message=>{const error=new Error(message);error.status=400;throw error;};
const url=value=>{try{const u=new URL(value);return ['https:','http:','mailto:'].includes(u.protocol)?u.href:'';}catch{return '';}};
const color=value=>typeof value==='string'&&/^(#[\da-f]{3,8}|rgba?\([\d\s,.%]+\))$/i.test(value)?value:null;
const str=(value,max=2000)=>typeof value==='string'?value.slice(0,max):'';
export function validateNoteDocument(input){
  if(!input||input.type!=='doc'||JSON.stringify(input).length>2000000)fail('노트는 이미지 포함 2MB까지 저장할 수 있어요.');
  let count=0;
  function visit(value,depth=0){
    if(!value||typeof value!=='object'||!nodeTypes.has(value.type)||++count>20000||depth>30)fail('노트 구조를 확인해 주세요.');
    const out={type:value.type},a=value.attrs||{},attrs={};
    if(value.type==='text'){if(typeof value.text!=='string'||!value.text.length)fail('빈 텍스트가 포함되어 있어요.');out.text=value.text;}
    if(['paragraph','heading'].includes(value.type)&&['left','center','right','justify'].includes(a.textAlign))attrs.textAlign=a.textAlign;
    if(value.type==='heading')attrs.level=[1,2,3].includes(a.level)?a.level:2;
    if(value.type==='orderedList')attrs.start=Number.isInteger(a.start)&&a.start>0&&a.start<10000?a.start:1;
    if(value.type==='codeBlock')attrs.language=str(a.language,40)||null;
    if(value.type==='image'){
      const source=str(a.src,350000);
      if(!(/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(source)||/^https?:/.test(url(source))))fail('이미지는 PNG·JPG·WebP 또는 웹 주소를 사용해 주세요.');
      attrs.src=source;attrs.alt=str(a.alt,300);attrs.title=str(a.title,300)||null;
      attrs.width=['25%','50%','75%','100%'].includes(a.width)?a.width:'100%';
    }
    if(['inlineMath','blockMath'].includes(value.type)){
      if(typeof a.latex!=='string'||!a.latex.trim()||a.latex.length>10000)fail('수식 내용을 확인해 주세요.');
      attrs.latex=a.latex;
    }
    if(['tableCell','tableHeader'].includes(value.type)){
      for(const key of ['colspan','rowspan']){attrs[key]=Number.isInteger(a[key])&&a[key]>0&&a[key]<=30?a[key]:1;}
      attrs.colwidth=Array.isArray(a.colwidth)&&a.colwidth.length<=30?a.colwidth.map(n=>Number.isInteger(n)&&n>=40&&n<=2000?n:120):null;
    }
    if(Object.keys(attrs).length)out.attrs=attrs;
    if(value.marks){
      if(!Array.isArray(value.marks)||value.marks.length>12)fail('글자 서식을 확인해 주세요.');
      out.marks=value.marks.map(mark=>{
        if(!markTypes.has(mark?.type))fail('지원하지 않는 글자 서식이에요.');
        const m={type:mark.type},a=mark.attrs||{};
        if(mark.type==='link'){const href=url(a.href);if(!href)fail('링크 주소를 확인해 주세요.');m.attrs={href,target:'_blank',rel:'noopener noreferrer nofollow'};}
        if(mark.type==='highlight')m.attrs={color:color(a.color)||'#fff0ad'};
        if(mark.type==='textStyle'){
          m.attrs={};if(color(a.color))m.attrs.color=color(a.color);
          if(['12px','14px','16px','18px','20px','24px','28px','32px'].includes(a.fontSize))m.attrs.fontSize=a.fontSize;
        }
        return m;
      });
    }
    if(value.content){if(!Array.isArray(value.content))fail('본문 구조를 확인해 주세요.');out.content=value.content.map(v=>visit(v,depth+1));}
    const children=out.content||[],types=children.map(n=>n.type);
    const inline=t=>['text','hardBreak','inlineMath'].includes(t);
    const block=t=>['paragraph','heading','bulletList','orderedList','blockquote','codeBlock','horizontalRule','image','table','blockMath'].includes(t);
    if(['text','hardBreak','horizontalRule','image','inlineMath','blockMath'].includes(out.type)&&children.length)fail('잘못된 본문 구조예요.');
    if(['paragraph','heading'].includes(out.type)&&!types.every(inline))fail('문단 구조를 확인해 주세요.');
    if(out.type==='codeBlock'&&!types.every(t=>t==='text'))fail('코드 블록 구조를 확인해 주세요.');
    if(['doc','blockquote','tableCell','tableHeader'].includes(out.type)&&(!children.length||!types.every(block)))fail('본문에 문단이 필요해요.');
    if(out.type==='listItem'&&(types[0]!=='paragraph'||!types.slice(1).every(block)))fail('목록 구조를 확인해 주세요.');
    if(['bulletList','orderedList'].includes(out.type)&&(!children.length||!types.every(t=>t==='listItem')))fail('목록 구조를 확인해 주세요.');
    if(out.type==='table'&&(!children.length||children.length>100||!types.every(t=>t==='tableRow')))fail('표는 100행까지 만들 수 있어요.');
    if(out.type==='tableRow'&&(!children.length||children.length>30||!types.every(t=>['tableCell','tableHeader'].includes(t))))fail('표는 30열까지 만들 수 있어요.');
    return out;
  }
  return visit(input);
}
export function noteText(doc){
  function text(n){if(n.type==='text')return n.text;if(['inlineMath','blockMath'].includes(n.type))return n.attrs?.latex||'';if(n.type==='image')return '[이미지] '+(n.attrs?.alt||'');if(n.type==='hardBreak')return '\n';return (n.content||[]).map(text).join(['doc','table','tableRow','bulletList','orderedList','blockquote','listItem'].includes(n.type)?'\n':'');}
  return text(doc).trim();
}
export function plainDocument(body=''){return {type:'doc',content:body.split('\n').map(line=>({type:'paragraph',...(line?{content:[{type:'text',text:line}]}:{})}))};}
