const $ = id => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const tour = $('tour'), stage = $('stage'), A = $('A'), B = $('B');
const card = $('card'), thero = $('thero'), rail = $('rail');
const heroVid = $('heroVid'), filmVid = $('filmVid');
const forwardPaths = ROOMS.map((_, i) => `assets/scroll/${i}.mp4`);
const reversePaths = ROOMS.map((_, i) => `assets/reverse/${i}.mp4`);
const assetPaths = [
  'assets/hero-poster.jpg', 'assets/film-poster.jpg',
  ...ROOMS.map(room => room.img),
  'assets/hero-loop.mp4', 'assets/film.mp4',
  ...forwardPaths, ...reversePaths
];
const loadedAssets = new Map(), received = new Map(), totals = new Map();
const loader = $('loader'), loaderBar = $('loaderBar'), loaderCount = $('loaderCount');
let currentStop = 0, playing = false, activeVideo = null;
let lastWheelAt = 0, touchStartY = null;

function videoFor(path) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.dataset.path = path;
  $('flyWrap').appendChild(video);
  return video;
}
const forwardVideos = forwardPaths.map(videoFor);
const reverseVideos = reversePaths.map(videoFor);

function updateLoading() {
  const total = [...totals.values()].reduce((a, b) => a + b, 0);
  const done = [...received.values()].reduce((a, b) => a + b, 0);
  const percent = Math.min(99, Math.floor((total ? done / total : loadedAssets.size / assetPaths.length) * 100));
  loaderBar.style.width = `${percent}%`;
  loaderCount.textContent = `${percent}% · ${loadedAssets.size} of ${assetPaths.length} assets`;
}

async function fetchAsset(path) {
  if (loadedAssets.has(path)) return loadedAssets.get(path);
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  const size = Number(response.headers.get('content-length')) || 0;
  totals.set(path, size);
  let blob;
  if (response.body && size) {
    const reader = response.body.getReader(), chunks = [];
    let count = 0;
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      chunks.push(value);
      count += value.byteLength;
      received.set(path, count);
      updateLoading();
    }
    blob = new Blob(chunks, {type: path.endsWith('.mp4') ? 'video/mp4' : (response.headers.get('content-type') || 'application/octet-stream')});
  } else {
    blob = await response.blob();
    received.set(path, blob.size);
    totals.set(path, blob.size);
  }
  if (path.endsWith('.mp4') && blob.type !== 'video/mp4') blob = blob.slice(0, blob.size, 'video/mp4');
  const url = URL.createObjectURL(blob);
  if (!path.endsWith('.mp4')) {
    const image = new Image();
    image.src = url;
    await image.decode();
  }
  loadedAssets.set(path, url);
  updateLoading();
  return url;
}

function loadVideo(video) {
  if (video._ready) return video._ready;
  video._ready = new Promise((resolve, reject) => {
    video.addEventListener('loadeddata', resolve, {once:true});
    video.addEventListener('error', () => reject(new Error(`${video.dataset.path} could not decode`)), {once:true});
    video.src = loadedAssets.get(video.dataset.path);
    video.load();
  });
  return video._ready;
}

function prepareAdjacent() {
  const needed = new Set();
  if (currentStop < ROOMS.length) needed.add(forwardVideos[currentStop]);
  if (currentStop > 0) needed.add(reverseVideos[currentStop - 1]);
  [...forwardVideos, ...reverseVideos].forEach(video => {
    if (needed.has(video) || !video._ready || video.readyState < 2) return;
    video.pause();
    video.removeAttribute('src');
    video.load();
    video._ready = null;
  });
  if (currentStop < ROOMS.length) loadVideo(forwardVideos[currentStop]).catch(() => {});
  if (currentStop > 0) loadVideo(reverseVideos[currentStop - 1]).catch(() => {});
}

function showStop(index) {
  currentStop = index;
  if (activeVideo) {
    activeVideo.pause();
    activeVideo.style.opacity = 0;
    activeVideo = null;
  }
  $('Aimg').src = loadedAssets.get(index ? ROOMS[index - 1].img : ROOMS[7].img);
  A.style.visibility = 'visible';
  A.style.transform = 'none';
  A.style.filter = 'none';
  B.style.visibility = 'hidden';
  thero.style.opacity = index === 0 ? 1 : 0;
  $('veil').style.opacity = index === 0 ? 1 : 0;
  document.querySelector('.shade').style.opacity = 1;
  card.style.opacity = index === 0 ? 0 : 1;
  card.style.transform = 'none';
  rail.style.opacity = index === 0 ? 0 : 1;
  if (index) {
    const room = ROOMS[index - 1];
    $('count').textContent = `${index} of ${ROOMS.length}`;
    $('name').textContent = room.name;
    $('line').textContent = room.line;
    $('facts').replaceChildren(...room.facts.map(fact => {
      const item = document.createElement('li');
      item.textContent = fact;
      return item;
    }));
  }
  railButtons.forEach((button, i) => button.classList.toggle('on', i + 1 === index));
  $('progress').style.width = `${index / ROOMS.length * 100}%`;
  playing = false;
  prepareAdjacent();
}

async function playTo(index) {
  if (playing || index < 0 || index > ROOMS.length || index === currentStop) return;
  if (reduceMotion || Math.abs(index - currentStop) > 1) {
    showStop(index);
    return;
  }
  playing = true;
  const forward = index > currentStop;
  const video = forward ? forwardVideos[currentStop] : reverseVideos[index];
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    showStop(index);
  };
  try {
    await loadVideo(video);
    video.pause();
    if (video.currentTime > .02) {
      video.currentTime = 0;
      await new Promise(resolve => video.addEventListener('seeked', resolve, {once:true}));
    }
    video.onended = finish;
    activeVideo = video;
    video.style.opacity = 1;
    A.style.visibility = 'hidden';
    B.style.visibility = 'hidden';
    card.style.opacity = 0;
    thero.style.opacity = 0;
    $('veil').style.opacity = 0;
    document.querySelector('.shade').style.opacity = 0;
    rail.style.opacity = 0;
    await video.play();
    setTimeout(finish, (video.duration || 6.05) * 1000 + 1000);
  } catch (error) {
    console.error('Tour playback failed', error);
    finish();
  }
}

function tourTop() { return tour.getBoundingClientRect().top + scrollY; }
function tourIsCentered() {
  const box = tour.getBoundingClientRect();
  return box.top < innerHeight * .25 && box.bottom > innerHeight * .75;
}
function alignTour() { scrollTo({top:tourTop(), behavior:reduceMotion ? 'instant' : 'smooth'}); }
function goStop(index) {
  alignTour();
  playTo(index);
}

const railButtons = ROOMS.map((room, i) => {
  const button = document.createElement('button');
  button.innerHTML = `<span class="nm">${room.name}</span><span class="dot"></span>`;
  button.setAttribute('aria-label', `Go to ${room.name}`);
  button.addEventListener('click', () => goStop(i + 1));
  rail.appendChild(button);
  return button;
});

function step(direction) {
  if (!tourIsCentered()) return false;
  if (playing) return true;
  const next = currentStop + direction;
  if (next < 0 || next > ROOMS.length) return false;
  if (Math.abs(tour.getBoundingClientRect().top) > 3) alignTour();
  else playTo(next);
  return true;
}

addEventListener('wheel', event => {
  if (!tourIsCentered()) return;
  const direction = Math.sign(event.deltaY);
  if (!direction) return;
  const canCapture = playing || (direction > 0 && currentStop < ROOMS.length) || (direction < 0 && currentStop > 0);
  if (!canCapture) return;
  event.preventDefault();
  const now = performance.now();
  const freshGesture = now - lastWheelAt > 250;
  lastWheelAt = now;
  if (freshGesture && !playing) step(direction);
}, {passive:false});

addEventListener('touchstart', event => {
  touchStartY = event.touches[0]?.clientY ?? null;
}, {passive:true});
addEventListener('touchmove', event => {
  if (touchStartY === null || !tourIsCentered()) return;
  const direction = Math.sign(touchStartY - event.touches[0].clientY);
  if (playing || (direction > 0 && currentStop < ROOMS.length) || (direction < 0 && currentStop > 0)) event.preventDefault();
}, {passive:false});
addEventListener('touchend', event => {
  if (touchStartY === null) return;
  const moved = touchStartY - (event.changedTouches[0]?.clientY ?? touchStartY);
  touchStartY = null;
  if (Math.abs(moved) > 40) step(Math.sign(moved));
}, {passive:true});
addEventListener('keydown', event => {
  if (!tourIsCentered() || /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
  const direction = ['ArrowDown','PageDown',' '].includes(event.key) ? 1 : ['ArrowUp','PageUp'].includes(event.key) ? -1 : 0;
  if (direction && step(direction)) event.preventDefault();
});

addEventListener('scroll', () => $('nav').classList.toggle('solid', scrollY > innerHeight * .6), {passive:true});
const heroObserver = new IntersectionObserver(([entry]) => {
  if (reduceMotion || !heroVid.src) return;
  if (entry.isIntersecting) heroVid.play().catch(() => {});
  else heroVid.pause();
}, {threshold:.05});
heroObserver.observe(document.querySelector('.hero'));
const bookingForm = $('bookingForm');
bookingForm.elements.date.min = new Date().toLocaleDateString('en-CA', {timeZone:'America/Los_Angeles'});
bookingForm.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(bookingForm);
  const subject = encodeURIComponent('Real estate flythrough demo request');
  const body = encodeURIComponent(`Hello BMON,\n\nI'd like to request a demo call.\n\nName: ${data.get('name')}\nEmail: ${data.get('email')}\nPreferred date: ${data.get('date')}\nPreferred time: ${data.get('time')} Pacific\n\nPlease confirm availability.\n`);
  location.href = `mailto:support@bmon.ai?subject=${subject}&body=${body}`;
});

async function prepareTour() {
  $('loaderRetry').hidden = true;
  $('loaderMessage').textContent = 'Downloading the full experience';
  try {
    await Promise.all(assetPaths.map(fetchAsset));
    document.querySelector('.poster').src = loadedAssets.get('assets/hero-poster.jpg');
    heroVid.poster = loadedAssets.get('assets/hero-poster.jpg');
    heroVid.src = loadedAssets.get('assets/hero-loop.mp4');
    filmVid.poster = loadedAssets.get('assets/film-poster.jpg');
    filmVid.src = loadedAssets.get('assets/film.mp4');
    await Promise.all([loadVideo(forwardVideos[0]), document.fonts.ready]);
    showStop(0);
    if (!reduceMotion && document.querySelector('.hero').getBoundingClientRect().bottom > 0) heroVid.play().catch(() => {});
    loaderBar.style.width = '100%';
    loaderCount.textContent = `100% · ${assetPaths.length} of ${assetPaths.length} assets`;
    $('loaderMessage').textContent = 'Your tour is ready';
    document.body.classList.remove('loading');
    loader.classList.add('done');
    setTimeout(() => loader.remove(), 600);
    const chatWidget = document.createElement('script');
    chatWidget.src = 'https://widgets.leadconnectorhq.com/loader.js';
    chatWidget.dataset.resourcesUrl = 'https://widgets.leadconnectorhq.com/chat-widget/loader.js';
    chatWidget.dataset.widgetId = '6ac7e9f2b17ff091c6e93d95';
    $('ai-widget-slot').appendChild(chatWidget);
  } catch (error) {
    $('loaderMessage').textContent = `Download failed: ${error.message}`;
    $('loaderRetry').hidden = false;
  }
}
$('loaderRetry').addEventListener('click', prepareTour);
prepareTour();
