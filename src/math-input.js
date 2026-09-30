import {MathfieldElement} from 'mathlive';
import katex from 'katex';
MathfieldElement.fontsDirectory='/study/vendor/mathlive/fonts';
MathfieldElement.soundsDirectory=null;
const templates={
  '구조':[['분수','\\frac{#?}{#?}'],['제곱','{#?}^{#?}'],['아래첨자','{#?}_{#?}'],['위·아래첨자','{#?}_{#?}^{#?}'],['제곱근','\\sqrt{#?}'],['n제곱근','\\sqrt[#?]{#?}'],['괄호','\\left(#?\\right)'],['절댓값','\\left|#?\\right|'],['벡터','\\vec{#?}'],['윗줄','\\overline{#?}']],
  '연산':[['합 Σ','\\sum_{#?}^{#?}#?'],['곱 Π','\\prod_{#?}^{#?}#?'],['적분','\\int_{#?}^{#?}#?\\,d#?'],['이중적분','\\iint_{#?}#?\\,d#?'],['극한','\\lim_{#?\\to #?}#?'],['미분','\\frac{d#?}{d#?}'],['편미분','\\frac{\\partial #?}{\\partial #?}'],['로그','\\log_{#?}#?'],['경우 나누기','\\begin{cases}#? & #? \\\\ #? & #?\\end{cases}'],['연립식','\\begin{aligned}#? &= #? \\\\ #? &= #?\\end{aligned}']],
  '행렬':[['2×2','\\begin{pmatrix}#? & #? \\\\ #? & #?\\end{pmatrix}'],['3×3','\\begin{pmatrix}#? & #? & #? \\\\ #? & #? & #? \\\\ #? & #? & #?\\end{pmatrix}'],['대괄호 행렬','\\begin{bmatrix}#? & #? \\\\ #? & #?\\end{bmatrix}'],['행렬식','\\begin{vmatrix}#? & #? \\\\ #? & #?\\end{vmatrix}'],['열벡터','\\begin{pmatrix}#? \\\\ #? \\\\ #?\\end{pmatrix}']],
  '기호':[['α','\\alpha'],['β','\\beta'],['γ','\\gamma'],['δ','\\delta'],['ε','\\epsilon'],['θ','\\theta'],['λ','\\lambda'],['μ','\\mu'],['π','\\pi'],['σ','\\sigma'],['φ','\\phi'],['ω','\\omega'],['Δ','\\Delta'],['∞','\\infty'],['±','\\pm'],['×','\\times'],['·','\\cdot'],['≤','\\le'],['≥','\\ge'],['≠','\\ne'],['≈','\\approx'],['→','\\to'],['⇒','\\Rightarrow'],['∀','\\forall'],['∃','\\exists'],['∈','\\in'],['⊂','\\subset'],['∪','\\cup'],['∩','\\cap'],['∅','\\emptyset'],['ℝ','\\mathbb{R}'],['∇','\\nabla']]
};
const el=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls||'';if(text)e.textContent=text;return e;};
export function editEquation({latex='',display=true,onApply,onClose,parent=document.body}){
  const dialog=el('dialog','equation-dialog');dialog.setAttribute('aria-label','수식 편집기');
  const top=el('div','equation-heading');top.append(el('h2','','수식'));
  const close=el('button','equation-close','×');close.type='button';close.setAttribute('aria-label','수식 편집 닫기');close.onclick=()=>dialog.close();top.append(close);
  const tabs=el('div','equation-tabs'),palette=el('div','equation-palette');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','수식 모양');
  const field=new MathfieldElement();field.setAttribute('aria-label','수식 입력');field.mathVirtualKeyboardPolicy='manual';field.value=latex;field.smartFence=true;
  for(const [name,items]of Object.entries(templates)){
    const tab=el('button','',name);tab.type='button';tab.onclick=()=>{
      tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===tab)));
      palette.replaceChildren(...items.map(([label,template])=>{const b=el('button');b.type='button';b.title=label;b.setAttribute('aria-label',label);const shape=el('span','equation-shape');shape.setAttribute('aria-hidden','true');katex.render(template.replaceAll('#?','\\square'),shape,{throwOnError:false,trust:false,displayMode:false});b.append(shape,el('small','',label));b.onclick=()=>{field.focus();field.insert(template,{selectionMode:'placeholder'});sync();};return b;}));
    };tabs.append(tab);
  }
  const hint=el('p','equation-hint','모양을 고르고 빈칸을 채우세요. Tab으로 다음 빈칸으로 이동해요.');
  const source=el('details','equation-source'),sourceTitle=el('summary','','LaTeX 직접 입력');const code=el('textarea');code.setAttribute('aria-label','LaTeX 수식');code.spellcheck=false;code.value=latex;source.append(sourceTitle,code);
  function sync(){code.value=field.value;}
  field.addEventListener('input',sync);code.addEventListener('input',()=>field.value=code.value);
  const bottom=el('div','equation-actions'),mode=el('select');mode.setAttribute('aria-label','수식 배치');
  for(const [value,label]of [['block','별도 줄에 배치'],['inline','글 사이에 배치']]){const o=el('option','',label);o.value=value;mode.append(o);}mode.value=display?'block':'inline';
  const keyboard=el('button','','수학 키보드');keyboard.type='button';keyboard.onclick=()=>{field.focus();window.mathVirtualKeyboard.visible?window.mathVirtualKeyboard.hide():window.mathVirtualKeyboard.show();};
  const apply=el('button','primary-button','수식 넣기');apply.type='button';apply.onclick=()=>{const value=field.value.trim();if(!value){field.focus();return;}onApply(value.replace(/\\placeholder(?:\[[^\]]*\])?\{[^}]*\}/g,'\\square'),mode.value==='block');dialog.close();};
  bottom.append(mode,keyboard,apply);const keyboardHost=el('div','equation-keyboard');
  dialog.append(top,tabs,palette,hint,field,source,bottom,keyboardHost);parent.append(dialog);tabs.firstElementChild.click();dialog.showModal();field.menuItems=[];
  window.mathVirtualKeyboard.container=keyboardHost;
  window.mathVirtualKeyboard.layouts=window.matchMedia('(max-width:600px)').matches?[
    {label:'123',displayEditToolbar:false,rows:[['7','8','9','+','-','[backspace]'],['4','5','6','\\times','\\div','x'],['1','2','3','(',')','n'],['0','.','=','[left]','[right]','[tab]']]},
    {label:'abc',displayEditToolbar:false,rows:[['a','b','c','d','e','f'],['g','h','i','j','k','l'],['m','n','o','p','q','r'],['s','t','u','v','w','x'],['y','z','[shift]','[left]','[right]','[backspace]']]},
    {label:'αβγ',displayEditToolbar:false,rows:[['\\alpha','\\beta','\\gamma','\\delta','\\epsilon','\\theta'],['\\lambda','\\mu','\\pi','\\sigma','\\phi','\\omega'],['\\infty','\\le','\\ge','\\ne','\\in','\\to'],['[undo]','[redo]','[left]','[right]','[tab]','[backspace]']]}
  ].map(layout=>({...layout,rows:layout.rows.map(row=>row.map(key=>key==='[tab]'?{label:'⇥',tooltip:'다음 빈칸',command:'moveToNextPlaceholder',width:1}:key.startsWith('[')?{label:key,width:1}:key))})):['numeric','symbols','alphabetic','greek'];
  dialog.addEventListener('close',()=>{window.mathVirtualKeyboard.hide();window.mathVirtualKeyboard.container=document.body;dialog.remove();onClose?.();},{once:true});
  dialog.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();apply.click();}});
  field.focus();return dialog;
}
