(() => {
  const rabbit=document.getElementById('pet-rabbit'),counter=document.getElementById('pet-count'),petals=document.getElementById('petals');
  if(!rabbit)return;
  let count=0,held=false,pointer=null,last=null,distance=0,lastPet=0;
  try{const stored=Number(localStorage.getItem('gyulim-rabbit-pets'));if(Number.isSafeInteger(stored)&&stored>0)count=stored;}catch{}
  function pet(){
    count=Math.min(count+1,Number.MAX_SAFE_INTEGER);counter.textContent=count.toLocaleString()+'번 쓰다듬었어요';
    try{localStorage.setItem('gyulim-rabbit-pets',String(count));}catch{}
    if(petals.children.length>=42)return;
    for(let i=0;i<6;i++){
      const petal=document.createElement('span');petal.className='petal';
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),outline=document.createElementNS(svg.namespaceURI,'path');
      svg.setAttribute('viewBox','0 0 28 38');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
      outline.setAttribute('d',i%2?'M13 34C8 28 3 22 3 14C3 7 7 3 11 4C13 4 14 6 15 7C16 4 19 3 22 6C29 14 22 27 13 34Z':'M13 34C5 28 1 19 4 11C6 4 11 2 15 4C20 1 25 7 24 14C25 23 18 31 13 34Z');
      svg.append(outline);petal.append(svg);
      const spread=Math.random()*170-85;
      petal.style.setProperty('--dx',spread+'px');petal.style.setProperty('--sway',(spread*.5+(i%2?18:-18))+'px');
      petal.style.setProperty('--dy',(-180-Math.random()*95)+'px');petal.style.setProperty('--size',(20+Math.random()*9)+'px');
      petal.style.setProperty('--spin',(Math.random()*220-110)+'deg');petal.style.setProperty('--delay',(i*45)+'ms');
      petals.append(petal);setTimeout(()=>petal.remove(),2700);
    }
  }
  function start(){if(held)return;held=true;counter.hidden=false;pet();lastPet=performance.now();}
  function stop(){held=false;pointer=null;last=null;distance=0;counter.hidden=true;}
  rabbit.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.isPrimary===false)return;
    event.stopPropagation();pointer=event.pointerId;last={x:event.clientX,y:event.clientY};rabbit.setPointerCapture?.(pointer);start();
  });
  rabbit.addEventListener('pointermove',event=>{
    if(!held||event.pointerId!==pointer)return;event.stopPropagation();
    distance+=Math.hypot(event.clientX-last.x,event.clientY-last.y);last={x:event.clientX,y:event.clientY};
    if(distance>=28&&performance.now()-lastPet>=160){pet();distance=0;lastPet=performance.now();}
  });
  rabbit.addEventListener('pointerup',stop);rabbit.addEventListener('pointercancel',stop);rabbit.addEventListener('lostpointercapture',stop);
  rabbit.addEventListener('keydown',event=>{if([' ','Enter'].includes(event.key)){event.preventDefault();if(!event.repeat)start();}});
  rabbit.addEventListener('keyup',event=>{if([' ','Enter'].includes(event.key)){event.preventDefault();stop();}});
  rabbit.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();});
  rabbit.addEventListener('blur',stop);window.addEventListener('blur',stop);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('popstate',stop);
})();
