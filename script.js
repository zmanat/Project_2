'use strict';
const scenes = {
  dawn: {src:'assets/dawn-river-v1.webp', time:'07:10 · РАССВЕТ', caption:'Туман над рекой. Впереди — целый день.', alt:'Рассвет над тихой рекой, садовая калитка и дом среди осенних деревьев'},
  evening: {src:'assets/house-concept-v1.webp', time:'18:20 · ЗАКАТ', caption:'Когда солнце задерживается в листве.', alt:'Дом в осеннем саду в тёплом свете заката'},
  night: {src:'assets/night-garden-v1.webp', time:'21:30 · НОЧЬ', caption:'Огоньки в саду знают дорогу домой.', alt:'Ночной сад с подсвеченной дорожкой, тёплыми окнами дома и звёздами'}
};
const tabs = [...document.querySelectorAll('[data-scene]')];
function chooseScene(tab) {
  const data=scenes[tab.dataset.scene];
  tabs.forEach(t=>{t.setAttribute('aria-selected', String(t===tab));t.tabIndex=t===tab?0:-1;});
  const img=document.getElementById('garden-image');
  img.src=data.src;img.alt=data.alt;
  document.getElementById('garden-time').textContent=data.time;
  document.getElementById('garden-caption').textContent=data.caption;
  document.getElementById('garden-panel').setAttribute('aria-labelledby',tab.id);
}
tabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>chooseScene(tab));
  tab.addEventListener('keydown',e=>{
    let next;
    if(e.key==='ArrowRight') next=(index+1)%tabs.length;
    if(e.key==='ArrowLeft') next=(index+tabs.length-1)%tabs.length;
    if(e.key==='Home') next=0;
    if(e.key==='End') next=tabs.length-1;
    if(next!==undefined){e.preventDefault();tabs[next].focus();chooseScene(tabs[next]);}
  });
});
const room=document.getElementById('room');
const timeToggle=document.getElementById('time-toggle');
const clockHotspot=document.getElementById('clock-hotspot');
const status=document.getElementById('scene-status');
const dialog=document.getElementById('phone-dialog');
let ringTimeout;
let audioContext;
let soundOn=false;
let masterBus;
let audioReady=false;
let dayBus;
let nightBus;
function tone(frequency,duration,volume=.04){
  if(!soundOn||!audioContext)return;
  const osc=audioContext.createOscillator(),gain=audioContext.createGain();
  osc.type='sine';osc.frequency.value=frequency;
  gain.gain.setValueAtTime(volume,audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.0001,audioContext.currentTime+duration);
  osc.connect(gain);gain.connect(audioContext.destination);osc.start();osc.stop(audioContext.currentTime+duration);
}
function ringPhone(){
  clearTimeout(ringTimeout);room.classList.remove('ringing');
  void room.offsetWidth;room.classList.add('ringing');
  tone(740,.5);setTimeout(()=>tone(980,.4),160);
  ringTimeout=setTimeout(()=>room.classList.remove('ringing'),2000);
}
function openPhone(roomName=''){
  const selected=document.getElementById('selected-room');
  selected.hidden=typeof roomName!=='string'||!roomName;
  selected.textContent=selected.hidden?'':'Вас интересует комната «'+roomName+'».';
  ringPhone();if(!dialog.open)dialog.showModal();
}
function toggleTime(){
  const night=room.classList.toggle('is-night');room.classList.add('clock-running');
  timeToggle.setAttribute('aria-pressed',String(night));clockHotspot.setAttribute('aria-pressed',String(night));
  timeToggle.textContent=night?'Вернуть день':'Зажечь вечер';
  clockHotspot.setAttribute('aria-label',night?'Часы: сменить ночь на день':'Часы: зажечь вечерний сад и свет в комнате');
  document.getElementById('scene-label').textContent=night?'Вечер при свечах':'Солнечный день';
  status.textContent=night?'В саду загорелись фонари и гирлянды, в комнате — свечи и лампы.':'За окном снова день. Маятник качается.';
  updateAmbience();
}
timeToggle.addEventListener('click',toggleTime);clockHotspot.addEventListener('click',toggleTime);
document.getElementById('phone-hotspot').addEventListener('click',openPhone);
document.getElementById('mobile-phone').addEventListener('click',openPhone);
document.querySelectorAll('a[href="#contact"]').forEach(link=>link.addEventListener('click',event=>{
  event.preventDefault();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  room.scrollIntoView({behavior:reduced?'instant':'smooth',block:'center'});
  history.replaceState(null,'','#contact');
  setTimeout(ringPhone,reduced?50:700);
}));
document.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
// Local licensed field recordings. Nothing plays until an explicit user gesture.
async function setupNature(){
  const buffers=await Promise.all(['birds.mp3','crickets.mp3'].map(async file=>{
    const response=await fetch('assets/audio/'+file);
    if(!response.ok)throw new Error('Audio unavailable');
    return audioContext.decodeAudioData(await response.arrayBuffer());
  }));
  masterBus=audioContext.createGain();masterBus.gain.value=Number(document.getElementById('volume').value)/100;
  masterBus.connect(audioContext.destination);
  [dayBus,nightBus]=buffers.map(buffer=>{
    const bus=audioContext.createGain();bus.gain.value=0;bus.connect(masterBus);
    const source=audioContext.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(bus);source.start();
    return bus;
  });
  audioReady=true;
}
function updateAmbience(){
  const night=room.classList.contains('is-night');
  const audible=soundOn&&!document.hidden;
  if(audioReady){
    const now=audioContext.currentTime;
    dayBus.gain.setTargetAtTime(audible&&!night?1:0,now,.45);
    nightBus.gain.setTargetAtTime(audible&&night?1:0,now,.45);
  }
  document.getElementById('sound-toggle').textContent=!soundOn?'Звуки сада':night?'Сверчки · вкл.':'Птицы · вкл.';
  document.getElementById('volume-control').hidden=!soundOn;
  syncZoomButtons();
}
document.getElementById('sound-toggle').addEventListener('click',async function(){
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio){status.textContent='Звук недоступен в этом браузере.';return;}
  this.disabled=true;this.textContent='Загружаем звуки…';
  try{
    if(!audioContext)audioContext=new Audio();
    await audioContext.resume();
    if(!audioReady)await setupNature();
    soundOn=!soundOn;this.setAttribute('aria-pressed',String(soundOn));
    status.textContent=soundOn?'Звуки сада включены: днём птицы, ночью сверчки.':'Звуки сада выключены.';
  }catch(error){status.textContent='Не удалось включить записи. Попробуйте ещё раз.';}
  finally{this.disabled=false;updateAmbience();}
});
document.getElementById('volume').addEventListener('input',function(){
  document.getElementById('volume-value').textContent=this.value+'%';
  if(masterBus)masterBus.gain.setTargetAtTime(Number(this.value)/100,audioContext.currentTime,.08);
});
document.addEventListener('visibilitychange',updateAmbience);

const stoveToggle=document.getElementById('stove-toggle');
const stoveHotspot=document.getElementById('stove-hotspot');
function toggleStove(){
  const open=room.classList.toggle('stove-open');
  [stoveToggle,stoveHotspot].forEach(button=>button.setAttribute('aria-pressed',String(open)));
  const label=open?'Закрыть печь':'Открыть печь';
  stoveToggle.textContent=label;stoveHotspot.querySelector('span').textContent=label;
  stoveHotspot.setAttribute('aria-label',open?'Закрыть дверцу печи':'Открыть дверцу печи и увидеть огонь');
  status.textContent=open?'Дверца печи открыта. Внутри горят дрова.':'Дверца печи закрыта.';
  syncZoomButtons();
}
stoveToggle.addEventListener('click',toggleStove);
stoveHotspot.addEventListener('click',toggleStove);

// All views share the same scene, including its day/night and stove state.
const zoomDialog=document.getElementById('room-zoom-dialog');
const roomHome=document.getElementById('room-home');
const zoomStage=document.getElementById('zoom-stage');
const volumeControl=document.getElementById('volume-control');
function syncZoomButtons(){
  document.querySelectorAll('[data-action]').forEach(button=>{
    const original=document.getElementById(button.dataset.action);
    if(original.hasAttribute('aria-pressed'))button.setAttribute('aria-pressed',original.getAttribute('aria-pressed'));
  });
}
function setZoom(){
  const value=document.getElementById('zoom-range').value;
  zoomStage.style.width=value+'%';
  document.getElementById('zoom-value').textContent=value+'%';
}
document.getElementById('zoom-open').addEventListener('click',()=>{
  roomHome.style.minHeight=room.getBoundingClientRect().height+'px';
  zoomStage.append(room);
  zoomDialog.querySelector('.zoom-controls').after(volumeControl);
  zoomDialog.showModal();setZoom();syncZoomButtons();
});
zoomDialog.addEventListener('close',()=>{
  roomHome.append(room);roomHome.before(volumeControl);roomHome.style.minHeight='';
  document.getElementById('zoom-open').focus({preventScroll:true});
});
document.getElementById('zoom-range').addEventListener('input',setZoom);
document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>document.getElementById(button.dataset.action).click()));
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>document.getElementById(button.dataset.close).close()));
document.querySelectorAll('[data-room]').forEach(button=>button.addEventListener('click',()=>openPhone(button.dataset.room)));

const storyPages=[
  {chapter:'I · Калитка',text:['У калитки всегда хочется замедлить шаг. Плющ обнимает старый кирпич, под ногами шуршат листья. За зелёным окном виден стол — кажется, там только что поставили чашку.','Этот дом начинается с простого чувства: здесь можно выдохнуть. Оставить спешку снаружи и ненадолго пожить в другом ритме.']},
  {chapter:'II · Тепло',text:['Утром первым просыпается свет. Он проходит между листьями, ложится на половицы и добирается до книг. Потом в гостиной слышны шаги и звон посуды.','К вечеру тепло собирается у печи. Кто-то читает, кто-то смотрит в окно. Разговор может начаться с пустяка — а может уступить место тишине. И то и другое здесь к месту.']},
  {chapter:'III · Сад',text:['Сад не заканчивается у порога. Он остаётся в ветке на столе, в тени папоротника, в прохладном воздухе из приоткрытого окна. Ночью его дорожки проступают в мягком свете огоньков.','Когда придёт время уезжать, можно унести с собой открытку. Или просто запомнить этот свет — и чувство, что несколько дней принадлежали только вам.']}
];
let storyPage=0;
function renderStory(){
  document.getElementById('story-chapter').textContent=storyPages[storyPage].chapter;
  const text=document.getElementById('story-text');text.replaceChildren(...storyPages[storyPage].text.map(value=>{const p=document.createElement('p');p.textContent=value;return p;}));
  document.getElementById('story-page').textContent=(storyPage+1)+' / 3';
  document.getElementById('story-prev').disabled=storyPage===0;
  document.getElementById('story-next').disabled=storyPage===2;
}
function openStory(){storyPage=0;renderStory();document.getElementById('story-dialog').showModal();}
document.getElementById('book-hotspot').addEventListener('click',openStory);
document.getElementById('book-open').addEventListener('click',openStory);
document.getElementById('story-prev').addEventListener('click',()=>{if(storyPage>0){storyPage--;renderStory();}});
document.getElementById('story-next').addEventListener('click',()=>{if(storyPage<2){storyPage++;renderStory();}});

// A single, soft invitation to discover the objects, without recurring flashes.
const discoveryObserver=new IntersectionObserver(entries=>{
  if(entries.some(entry=>entry.isIntersecting)){
    room.classList.add('discover');setTimeout(()=>room.classList.remove('discover'),4200);
    discoveryObserver.disconnect();
  }
},{threshold:.45});
discoveryObserver.observe(room);

let postcardRequest=0,postcardUrl;
async function renderPostcard(){
  const request=++postcardRequest;
  const key=document.getElementById('postcard-scene').value;
  const data=scenes[key],download=document.getElementById('postcard-download');
  const message=document.getElementById('postcard-status');
  download.hidden=true;message.textContent='Готовим открытку…';
  try{
    const img=new Image();img.src=data.src;await img.decode();await document.fonts.ready;
    if(request!==postcardRequest)return;
    const canvas=document.getElementById('postcard-canvas'),ctx=canvas.getContext('2d');
    ctx.fillStyle='#f2ead6';ctx.fillRect(0,0,1200,940);
    const scale=Math.max(1136/img.width,650/img.height),w=img.width*scale,h=img.height*scale;
    ctx.save();ctx.beginPath();ctx.rect(32,32,1136,650);ctx.clip();ctx.drawImage(img,32+(1136-w)/2,32+(650-h)/2,w,h);ctx.restore();
    ctx.textAlign='center';ctx.fillStyle='#405444';ctx.font='500 64px Cormorant';ctx.fillText('Дом, увитый плющом',600,770);
    ctx.font='24px Manrope';ctx.fillText(data.caption,600,825);
    ctx.font='18px Manrope';ctx.fillStyle='#68725c';ctx.fillText('САД. ДОМ. ВРЕМЯ ДЛЯ СЕБЯ.',600,890);
    canvas.setAttribute('aria-label','Открытка: '+data.alt);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(request!==postcardRequest)return;
    if(!blob)throw new Error('PNG unavailable');
    if(postcardUrl)URL.revokeObjectURL(postcardUrl);
    postcardUrl=URL.createObjectURL(blob);download.href=postcardUrl;download.download='ivy-house-'+key+'.png';download.hidden=false;
    message.textContent='Открытка готова. Сохраните её себе.';
  }catch{if(request===postcardRequest)message.textContent='Не удалось подготовить открытку. Попробуйте выбрать другое время суток.';}
}
document.getElementById('postcard-open').addEventListener('click',()=>{
  document.getElementById('postcard-scene').value=document.querySelector('[data-scene][aria-selected="true"]').dataset.scene;
  document.getElementById('postcard-dialog').showModal();renderPostcard();
});
document.getElementById('postcard-scene').addEventListener('change',renderPostcard);
