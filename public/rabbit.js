(() => {
  const rabbit=document.getElementById('pet-rabbit'),counter=document.getElementById('pet-count'),petals=document.getElementById('petals');
  if(!rabbit)return;
  let count=0,held=false,pointer=null,last=null,distance=0,lastPet=0;
  try{const stored=Number(localStorage.getItem('gyulim-rabbit-pets'));if(Number.isSafeInteger(stored)&&stored>0)count=stored;}catch{}
  function pet(){
    count=Math.min(count+1,Number.MAX_SAFE_INTEGER);counter.textContent=count.toLocaleString()+'번 쓰다듬었어요';
    try{localStorage.setItem('gyulim-rabbit-pets',String(count));}catch{}
    rabbit.classList.remove('petted');void rabbit.offsetWidth;rabbit.classList.add('petted');
    if(petals.children.length>36)return;
    for(let i=0;i<6;i++){
      const petal=document.createElement('i');petal.className='petal';
      petal.style.setProperty('--dx',(Math.random()*150-75)+'px');petal.style.setProperty('--dy',(-35-Math.random()*90)+'px');
      petal.style.setProperty('--spin',(Math.random()*240-120)+'deg');petal.style.setProperty('--delay',(i*45)+'ms');
      petals.append(petal);setTimeout(()=>petal.remove(),1600);
    }
  }
  function start(){if(held)return;held=true;counter.hidden=false;pet();lastPet=performance.now();}
  function stop(){held=false;pointer=null;last=null;distance=0;counter.hidden=true;rabbit.classList.remove('petted');}
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
