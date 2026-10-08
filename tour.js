const $ = id => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const tour = $('tour'), stage = $('stage'), A = $('A'), B = $('B'), rail = $('rail'), card = $('card');
const introPoster = document.querySelector('.hero .poster');
const count = $('count'), nameEl = $('name'), line = $('line'), facts = $('facts');
let currentStop = 0, busy = false, nextTarget = 0, activeVideo = null;
const roomButtons = [];
const paths = ROOMS.map((_,i)=>'assets/scroll/'+i+'.mp4');
const reversePaths = ROOMS.map((_,i)=>'assets/reverse/'+i+'.mp4');

// Unlike the previous version, do NOT fetch all media before revealing the page.
function transitionVideo(path) {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto';
  v.src = path; v.style.opacity = '0';
  $('flyWrap').appendChild(v);
  return v;
}
function preloadNear(index) {
  [paths[index],reversePaths[index-1]].filter(Boolean).forEach(path=>{
    if(!document.querySelector('link[data-tour-preload="'+path+'"]')){
      const link=document.createElement('link'); link.rel='preload'; link.as='video';
      link.href=path; link.dataset.tourPreload=path;
      // Browser support varies, but normal video streaming remains the fallback.
      document.head.appendChild(link);
    }
  });
}
function displayRoom(index) {
  currentStop=index;
  stage.classList.remove('is-playing');
  stage.classList.toggle('at-intro',index===0);
  A.style.visibility='visible';
  A.querySelector('img').src=index ? ROOMS[index-1].img : 'assets/hero-poster.jpg';
  B.style.visibility='hidden';
  card.style.opacity=index===0?'0':'1';
  const shade=document.querySelector('.shade');
  shade.style.opacity='1';
  $('veil').style.opacity=index===0?'1':'0';
  if(index){
    const room=ROOMS[index-1];
    count.textContent=index+' of '+ROOMS.length;
    nameEl.textContent=room.name;
    line.textContent=room.line;
    facts.replaceChildren(...room.facts.map(value=>{const li=document.createElement('li');li.textContent=value;return li}));
  }
  roomButtons.forEach((button,i)=>{button.classList.toggle('on',i===index);button.setAttribute('aria-current',i===index?'true':'false')});
  $('progress').style.width=(index/ROOMS.length*100)+'%';
  preloadNear(index);
}
// A frame sequence is preferred over the legacy MP4 when frames/manifest.json exists.
// Render frames at source fidelity; timestamps determine playback, not network timing.
let frameManifestPromise = null;
function frameManifest(){
  if (!frameManifestPromise) frameManifestPromise = fetch('assets/frames/manifest.json')
    .then(r=>r.ok?r.json():null).catch(()=>null);
  return frameManifestPromise;
}
function frameUrl(segment,number){
  return 'assets/frames/scroll/'+segment+'/'+String(number).padStart(4,'0')+'.webp';
}
async function playFrameSequence(segment,reverse=false){
  const manifest=await frameManifest();
  const entry=manifest?.scroll?.[segment];
  if(!entry || !entry.count) return false;
  const fps=entry.fps||100, count=entry.count;
  const canvas=document.createElement('canvas');
  canvas.width=entry.width||1280;canvas.height=entry.height||720;
  canvas.className='tour-frames';
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)return false;
  const frames=new Array(count);
  // Preload the selected movement before hiding the underlying room.
  try{
    await Promise.all(Array.from({length:count},(_,i)=>new Promise((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>{frames[i]=img;resolve()};
      img.onerror=reject;
      img.src=frameUrl(segment,i+1);
    })));
  }catch(err){
    console.warn('Frame load failed; falling back to video',err);
    return false;
  }
  $('flyWrap').appendChild(canvas);
  stage.classList.add('is-playing');
  stage.classList.remove('at-intro');
  A.style.visibility='hidden';
  card.style.opacity='0';
  let start=null;
  await new Promise(resolve=>{
    function draw(time){
      if(start===null)start=time;
      const elapsed=(time-start)/1000;
      const idx=Math.min(count-1,Math.floor(elapsed*fps));
      const image=frames[reverse?count-1-idx:idx];
      if(image)ctx.drawImage(image,0,0,canvas.width,canvas.height);
      if(idx<count-1)requestAnimationFrame(draw);
      else resolve();
    }
    requestAnimationFrame(draw);
  });
  canvas.remove();
  return true;
}
function playVideoFallback(path){
  return new Promise(resolve=>{
    const v=transitionVideo(path);
    activeVideo=v;
    let finished=false;
    const finish=()=>{
      if(finished)return;
      finished=true;
      clearTimeout(watchdog);
      v.pause();v.remove();if(activeVideo===v)activeVideo=null;resolve();
    };
    const watchdog=setTimeout(finish,15000);
    v.addEventListener('ended',finish,{once:true});
    v.addEventListener('error',finish,{once:true});
    v.addEventListener('loadeddata',()=>{
      stage.classList.add('is-playing');
      v.style.opacity='1';
      stage.classList.remove('at-intro');
      A.style.visibility='hidden';
      card.style.opacity='0';
      document.querySelector('.shade').style.opacity='0';
      v.play().catch(finish);
    },{once:true});
  });
}
async function playClip(path,segment,reverse){
  if(await playFrameSequence(segment,reverse))return;
  await playVideoFallback(path);
}

async function navigateTo(index) {
  nextTarget=Math.max(0,Math.min(ROOMS.length,index));
  if(busy)return;
  busy=true;
  while(currentStop!==nextTarget){
    const direction=Math.sign(nextTarget-currentStop);
    const following=currentStop+direction;
    if(reduceMotion){displayRoom(following);continue;}
    // Step through every intervening room to preserve spatial continuity.
    const path=direction>0 ? paths[currentStop] : reversePaths[following];
    await playClip(path, direction>0 ? currentStop : following, direction<0);
    displayRoom(following);
  }
  busy=false;
}
function goTo(index) {
  if(!tour.getBoundingClientRect().height)return;
  tour.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'});
  navigateTo(index);
}
function addRoomButton(label,image,index){
 const button=document.createElement('button');button.type='button';
 const img=document.createElement('img');img.src=image;img.alt='';img.loading='eager';
 const text=document.createElement('span');text.className='nm';text.textContent=label;
 button.append(img,text);button.setAttribute('aria-label','View '+label);
 button.addEventListener('click',()=>goTo(index));rail.appendChild(button);roomButtons.push(button);
}
// Clicking the photographic stage advances through rooms. Controls keep their own actions.
stage.addEventListener('click', event=>{
  if(busy || event.target.closest('button,a,.room-picker,.card')) return;
  const next=currentStop>=ROOMS.length ? 0 : currentStop+1;
  navigateTo(next);
});
stage.setAttribute('aria-label','Interactive property tour: click the image to advance');
addRoomButton('Overview','assets/hero-poster.jpg',0);
ROOMS.forEach((room,i)=>addRoomButton(room.name,room.img,i+1));
$('startTour').addEventListener('click',()=>goTo(1));
window.addEventListener('scroll',()=> $('nav').classList.toggle('solid',scrollY>innerHeight*.6),{passive:true});
displayRoom(0);
document.body.classList.remove('loading');
$('loader').remove();
const chatWidget=document.createElement('script');
chatWidget.src='https://widgets.leadconnectorhq.com/loader.js';
chatWidget.dataset.resourcesUrl='https://widgets.leadconnectorhq.com/chat-widget/loader.js';
chatWidget.dataset.widgetId='6ac7e9f2b17ff091c6e93d95';
$('ai-widget-slot').appendChild(chatWidget);
