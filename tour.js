const $ = id => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const tour = $('tour'), stage = $('stage'), A = $('A'), B = $('B'), rail = $('rail'), card = $('card');
const introPoster = document.querySelector('.hero .poster');
const count = $('count'), nameEl = $('name'), line = $('line'), facts = $('facts');
let currentStop = 0, busy = false, nextTarget = 0;
const roomButtons = [];
const paths = ROOMS.map((_,i)=>'assets/scroll/'+i+'.mp4?v=120fps2x');
const reversePaths = ROOMS.map((_,i)=>'assets/reverse/'+i+'.mp4?v=120fps2x');
const preparedVideos = new Map();

// Unlike the previous version, do NOT fetch all media before revealing the page.
function createVideo(path) {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto';
  v.src = path; v.style.opacity = '0';
  return v;
}
function transitionVideo(path) {
  const v = preparedVideos.get(path) || createVideo(path);
  preparedVideos.delete(path);
  $('flyWrap').appendChild(v);
  return v;
}
function preloadNear(index) {
  const near = [paths[index],paths[index+1],paths[index+2],reversePaths[index-1],reversePaths[index-2],reversePaths[index-3]].filter(Boolean);
  near.forEach(path=>{
    if (!preparedVideos.has(path)) {
      const video=createVideo(path);
      video.load();
      preparedVideos.set(path,video);
    }
  });
  for (const [path,video] of preparedVideos) {
    if (near.includes(path)) continue;
    video.removeAttribute('src');
    video.load();
    preparedVideos.delete(path);
  }
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
// Each interpolated 60 fps clip is decoded into individual canvas frames.
// A room selection plays only the transition into that room at 2x speed.
// Displayed frames are limited by the device refresh rate.
const TOUR_PLAYBACK_RATE = 2;
function playFrameSequence(path) {
  return new Promise(resolve => {
    const video = transitionVideo(path);
    const canvas = document.createElement('canvas');
    canvas.className = 'tour-frames';
    const context = canvas.getContext('2d', {alpha:false});
    if (!context) { video.remove(); resolve(); return; }
    let finished = false, frameRequest = 0, started = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(frameRequest);
      clearTimeout(watchdog);
      video.pause();
      video.remove();
      canvas.remove();
      resolve();
    };
    const watchdog = setTimeout(finish, 60000);
    video.addEventListener('ended', finish, {once:true});
    video.addEventListener('error', () => {
      console.error('Tour frame source failed:', path, video.error);
      finish();
    }, {once:true});
    const startPlayback = () => {
      if (finished) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.style.opacity = '0';
      $('flyWrap').appendChild(canvas);
      video.playbackRate = TOUR_PLAYBACK_RATE;
      const draw = () => {
        if (finished) return;
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          if (!started) {
            started = true;
            stage.classList.add('is-playing');
            stage.classList.remove('at-intro');
            card.style.opacity = '0';
            requestAnimationFrame(() => { canvas.style.opacity = '1'; });
          }
        }
        frameRequest = requestAnimationFrame(draw);
      };
      draw();
      video.play().catch(error => {
        console.error('Tour frame playback failed:', error);
        finish();
      });
    };
    if (video.error) finish();
    else if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) startPlayback();
    else video.addEventListener('loadeddata', startPlayback, {once:true});
  });
}

async function navigateTo(index) {
  nextTarget=Math.max(0,Math.min(ROOMS.length,index));
  if(busy)return;
  busy=true;
  while(currentStop!==nextTarget){
    const target=nextTarget;
    if(reduceMotion){displayRoom(target);continue;}
    // Play only the clip that arrives at the selected room.
    const path=target>currentStop ? paths[target-1] : reversePaths[target];
    await playFrameSequence(path);
    displayRoom(target);
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
// Scroll gestures control the frame-driven tour while it is centered.
// At first and last room, scrolling outward resumes normal page scrolling.
let lastWheelGesture=0, touchStartY=null;
function inTour(){
  const r=tour.getBoundingClientRect();
  return r.top<innerHeight*.25 && r.bottom>innerHeight*.75;
}
function scrollStep(direction){
  if(!inTour())return false;
  if(busy)return true;
  const destination=currentStop+direction;
  if(destination<0 || destination>ROOMS.length)return false;
  navigateTo(destination);
  return true;
}
window.addEventListener('wheel',event=>{
  if(!inTour())return;
  const direction=Math.sign(event.deltaY);
  if(!direction)return;
  const canCapture=busy || (direction>0&&currentStop<ROOMS.length)||(direction<0&&currentStop>0);
  if(!canCapture)return;
  event.preventDefault();
  const now=performance.now();
  if(!busy && now-lastWheelGesture>450)scrollStep(direction);
  lastWheelGesture=now;
},{passive:false});
tour.addEventListener('touchstart',event=>{
  if(event.target.closest('button,a,.room-picker'))return;
  touchStartY=event.touches[0]?.clientY??null;
},{passive:true});
tour.addEventListener('touchmove',event=>{
  if(touchStartY===null||!inTour())return;
  const direction=Math.sign(touchStartY-(event.touches[0]?.clientY??touchStartY));
  if(busy||(direction>0&&currentStop<ROOMS.length)||(direction<0&&currentStop>0))
    event.preventDefault();
},{passive:false});
tour.addEventListener('touchend',event=>{
  if(touchStartY===null)return;
  const delta=touchStartY-(event.changedTouches[0]?.clientY??touchStartY);
  touchStartY=null;
  if(Math.abs(delta)>40)scrollStep(Math.sign(delta));
},{passive:true});
window.addEventListener('keydown',event=>{
  if(!inTour() || event.target.closest('button,a,input,textarea,select'))return;
  const direction=['ArrowDown','PageDown',' '].includes(event.key)?1:
    ['ArrowUp','PageUp'].includes(event.key)?-1:0;
  if(direction && (busy || (direction>0&&currentStop<ROOMS.length)||(direction<0&&currentStop>0))){
    event.preventDefault();scrollStep(direction);
  }
});
stage.setAttribute('aria-label','Scroll to explore the rooms frame by frame');
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
