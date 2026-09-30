import {Node} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {TableKit} from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import {TextStyle,Color,FontSize} from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import katex from 'katex';

export function mathMarkup(element,latex,display=false){
  katex.render(latex,element,{displayMode:display,throwOnError:false,trust:false,strict:'ignore',maxExpand:500,maxSize:20,output:'htmlAndMathml'});
}
function mathNode(name,inline,editMath){return Node.create({
  name,group:inline?'inline':'block',inline,atom:true,selectable:true,
  addAttributes(){return {latex:{default:'',parseHTML:el=>el.getAttribute('data-latex')}};},
  parseHTML(){return [{tag:(inline?'span':'div')+'[data-note-math="'+name+'"]'}];},
  renderHTML({node}){return [inline?'span':'div',{'data-note-math':name,'data-latex':node.attrs.latex},node.attrs.latex];},
  addNodeView(){return ({node,editor,getPos})=>{
    let current=node;const dom=document.createElement(inline?'span':'div');dom.className='note-math '+(inline?'note-math-inline':'note-math-block');dom.contentEditable='false';
    const paint=()=>{mathMarkup(dom,current.attrs.latex,!inline);dom.dataset.latex=current.attrs.latex;dom.setAttribute('aria-label','수식: '+current.attrs.latex);if(editor.isEditable){dom.tabIndex=0;dom.title='수식 수정';dom.setAttribute('role','button');}};
    const open=event=>{if(!editor.isEditable||!editMath)return;event.preventDefault();event.stopPropagation();editMath({editor,pos:getPos(),node:current});};
    dom.addEventListener('click',open);dom.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key))open(event);});paint();
    return {dom,update(next){if(next.type!==current.type)return false;current=next;paint();return true;},ignoreMutation:()=>true};
  };}
});}
const NoteImage=Image.extend({addAttributes(){return {...this.parent?.(),width:{default:'100%',parseHTML:el=>el.getAttribute('data-width')||'100%',renderHTML:a=>({'data-width':a.width,style:'width:'+a.width})}};}});
export function noteExtensions(editMath){return [
  StarterKit.configure({heading:{levels:[1,2,3]},link:{openOnClick:!editMath,HTMLAttributes:{rel:'noopener noreferrer nofollow',target:'_blank'}}}),
  TableKit.configure({table:{resizable:true,cellMinWidth:60,renderWrapper:true}}),
  NoteImage.configure({allowBase64:true}),Highlight.configure({multicolor:true}),TextStyle,Color,FontSize,
  TextAlign.configure({types:['heading','paragraph']}),Subscript,Superscript,
  mathNode('inlineMath',true,editMath),mathNode('blockMath',false,editMath)
];}
