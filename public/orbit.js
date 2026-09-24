(() => {
  'use strict';
  const orbit=document.getElementById('orbit');
  if(!orbit)return;
  const items=[...orbit.querySelectorAll('[data-orbit-index]')];
  const path=document.getElementById('orbit-path');
  const width=1016,height=533;
  let rotation=0,gesture=null,frame=0,suppressUntil=0;
  // Read the artwork's fixed centreline. Rotation never rewrites its visible outline.
  const points=[...path.getAttribute('d').matchAll(/[ML]([\d.-]+) ([\d.-]+)/g)].map(match=>({x:Number(match[1]),y:Number(match[2])}));
  points.forEach((point,i)=>{const previous=points[i-1];point.distance=previous?previous.distance+Math.hypot(point.x-previous.x,point.y-previous.y):0;});
  const length=points.at(-1).distance,spacing=length/items.length;
  // Preserve the reference's initial placements and their arc-length gaps at every curvature.
  const anchors=path.dataset.homeProgress.split(',').map(progress=>Number(progress)*length);
  const wrap=value=>((value%length)+length)%length;
  function atDistance(value){
    const distance=wrap(value);let low=0,high=points.length-1;
    while(high-low>1){const mid=(low+high)>>1;if(points[mid].distance<=distance)low=mid;else high=mid;}
    const a=points[low],b=points[high],t=(distance-a.distance)/(b.distance-a.distance);
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
  }
  function render(){
    items.forEach((item,i)=>{
      const p=atDistance(anchors[i]+rotation);
      item.style.left=p.x/width*100+'%';item.style.top=p.y/height*100+'%';
      // This is a position rule, not a DEV-specific label style.
      item.classList.toggle('label-upper-left',p.x<190&&p.y>235&&p.y<375);
    });
    orbit.dataset.rotation=String(Math.round(rotation/length*36000)/100);
  }
  function turn(amount){
    cancelAnimationFrame(frame);
    const from=rotation,to=rotation+amount;
    if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){rotation=to;render();return;}
    const start=performance.now();
    function animate(now){const t=Math.min((now-start)/260,1);rotation=from+(to-from)*(1-(1-t)**3);render();if(t<1)frame=requestAnimationFrame(animate);}
    frame=requestAnimationFrame(animate);
  }
  function pointerDistance(event){
    const bounds=orbit.getBoundingClientRect();
    const x=(event.clientX-bounds.left)/bounds.width*width,y=(event.clientY-bounds.top)/bounds.height*height;
    let best=Infinity,distance=0;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y;
      const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy)));
      const error=(x-a.x-dx*t)**2+(y-a.y-dy*t)**2;
      if(error<best){best=error;distance=a.distance+(b.distance-a.distance)*t;}
    }
    return distance;
  }
  orbit.addEventListener('dragstart',event=>event.preventDefault());
  orbit.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest('.orbit-controls,.rabbit')||event.isPrimary===false)return;
    cancelAnimationFrame(frame);
    gesture={id:event.pointerId,x:event.clientX,y:event.clientY,previous:pointerDistance(event),dragged:false,pointerType:event.pointerType};
    suppressUntil=0;
  });
  orbit.addEventListener('pointermove',event=>{
    if(!gesture||gesture.id!==event.pointerId)return;
    if(!gesture.dragged){
      const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
      if(Math.hypot(dx,dy)<8)return;
      // Let vertical touch gestures scroll the mobile page.
      if(gesture.pointerType==='touch'&&Math.abs(dy)>Math.abs(dx)){gesture=null;return;}
      gesture.dragged=true;orbit.classList.add('dragging');orbit.setPointerCapture?.(event.pointerId);
    }
    event.preventDefault();
    const distance=pointerDistance(event);let delta=distance-gesture.previous;
    if(Math.abs(delta)>length/2)delta-=Math.sign(delta)*length;
    rotation+=delta;gesture.previous=distance;render();
  });
  function finish(event){
    if(!gesture||gesture.id!==event.pointerId)return;
    if(gesture.dragged)suppressUntil=performance.now()+400;
    gesture=null;orbit.classList.remove('dragging');
    if(orbit.hasPointerCapture?.(event.pointerId))orbit.releasePointerCapture(event.pointerId);
  }
  orbit.addEventListener('pointerup',finish);
  orbit.addEventListener('pointercancel',finish);
  orbit.addEventListener('lostpointercapture',finish);
  orbit.addEventListener('pointerleave',event=>{if(gesture&&!gesture.dragged)finish(event);});
  orbit.addEventListener('click',event=>{
    if(event.detail!==0&&performance.now()<suppressUntil){event.preventDefault();event.stopPropagation();}
  },true);
  orbit.addEventListener('wheel',event=>{
    if(event.ctrlKey||event.target.closest('.rabbit'))return;
    event.preventDefault();cancelAnimationFrame(frame);
    const delta=(Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY)*(event.deltaMode===1?16:event.deltaMode===2?240:1);
    rotation+=Math.max(-120,Math.min(120,delta*.65));render();
  },{passive:false});
  orbit.addEventListener('keydown',event=>{
    if(event.target.closest('.rabbit'))return;
    if(!['ArrowLeft','ArrowRight','Home'].includes(event.key))return;
    event.preventDefault();turn(event.key==='Home'?-rotation:event.key==='ArrowLeft'?-spacing:spacing);
  });
  document.getElementById('orbit-prev').addEventListener('click',()=>turn(-spacing));
  document.getElementById('orbit-next').addEventListener('click',()=>turn(spacing));
  render();
})();
