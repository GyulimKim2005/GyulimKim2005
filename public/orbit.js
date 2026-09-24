(() => {
  'use strict';
  const orbit=document.getElementById('orbit');
  if(!orbit)return;
  const items=[...orbit.querySelectorAll('[data-orbit-index]')];
  const path=document.getElementById('orbit-path');
  // Coordinates fitted to the five icon centres in the user's 2048×1152 artwork.
  const angles=[-130.21313947,-192.06835297,-254.54367139,-303.87817211,-374.90145963];
  const width=1016,height=533,cx=500.8930192,cy=276.3526379,rx=397.64467188,ry=203.87399943,tilt=-.02065380861;
  let rotation=0,gesture=null,frame=0,suppressUntil=0;
  const radians=angle=>angle*Math.PI/180;
  const point=angle=>{const x=rx*Math.cos(radians(angle)),y=ry*Math.sin(radians(angle));return {x:cx+x*Math.cos(tilt)-y*Math.sin(tilt),y:cy+x*Math.sin(tilt)+y*Math.cos(tilt)};};
  function render(){
    items.forEach((item,i)=>{
      const p=point(angles[i]+rotation);
      item.style.left=p.x/width*100+'%';item.style.top=p.y/height*100+'%';
    });
    const points=[];
    for(let i=0;i<=100;i++){const p=point(angles[0]+rotation+(angles[4]-angles[0])*i/100);points.push((i?'L':'M')+p.x.toFixed(2)+' '+p.y.toFixed(2));}
    path.setAttribute('d',points.join(' '));
    orbit.dataset.rotation=String(Math.round(rotation*100)/100);
  }
  function turn(amount){
    cancelAnimationFrame(frame);
    const from=rotation,to=rotation+amount;
    if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){rotation=to;render();return;}
    const start=performance.now();
    function animate(now){const t=Math.min((now-start)/260,1);rotation=from+(to-from)*(1-(1-t)**3);render();if(t<1)frame=requestAnimationFrame(animate);}
    frame=requestAnimationFrame(animate);
  }
  function pointerAngle(event){
    const bounds=orbit.getBoundingClientRect();
    const x=(event.clientX-bounds.left)/bounds.width*width-cx,y=(event.clientY-bounds.top)/bounds.height*height-cy;
    return Math.atan2((-x*Math.sin(tilt)+y*Math.cos(tilt))/ry,(x*Math.cos(tilt)+y*Math.sin(tilt))/rx)*180/Math.PI;
  }
  orbit.addEventListener('dragstart',event=>event.preventDefault());
  orbit.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest('.orbit-controls,.rabbit')||event.isPrimary===false)return;
    cancelAnimationFrame(frame);
    gesture={id:event.pointerId,x:event.clientX,y:event.clientY,previous:pointerAngle(event),dragged:false,pointerType:event.pointerType};
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
    const angle=pointerAngle(event);
    rotation+=(angle-gesture.previous+540)%360-180;gesture.previous=angle;render();
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
    rotation+=Math.max(-25,Math.min(25,delta*.15));render();
  },{passive:false});
  orbit.addEventListener('keydown',event=>{
    if(event.target.closest('.rabbit'))return;
    if(!['ArrowLeft','ArrowRight','Home'].includes(event.key))return;
    event.preventDefault();turn(event.key==='Home'?-rotation:event.key==='ArrowLeft'?-55:55);
  });
  document.getElementById('orbit-prev').addEventListener('click',()=>turn(-55));
  document.getElementById('orbit-next').addEventListener('click',()=>turn(55));
  render();
})();
