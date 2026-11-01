import { Renderer, tilesReady } from './renderer.js?v=performance2';
import { fishPreview, drawGuides, spritesReady } from './sprites.js?v=arcade5';
import { AudioManager } from './audio.js?v=supplies1';
import { readControls } from './controls.js?v=balance2';
const $=id=>document.getElementById(id),socket=io({autoConnect:true}),audio=new AudioManager(),renderer=new Renderer($('game'),$('minimap'));
function setText(id,value){const element=$(id),text=String(value);if(element.textContent!==text)element.textContent=text;}
const descriptions={clown:['FAST FINS','Q: Clear nearby monsters with a tidal wave.'],puffer:['HEAVY ARMOR','Q: Blast nearby monsters with sharp spines.'],lion:['FAST SHOTS','Q: Damage and slow monsters with venom.'],angler:['BIG MAGIC','Q: Heal friends. Clear a wide circle of monsters.']};
let config,state,preview,selected='clown',me=null,host=false,lastEvent=0,seenDepth=0,bannerTimer,toastTimer,paused=false,busy=false,leaving=false;
const keys=new Set(),mouse={x:0,y:0,active:false,down:false},touch={x:0,y:0,fire:false,special:false,revive:false};
const contextSpoken=new Set();
let touchDevice=matchMedia('(pointer:coarse)').matches;
try{$('player-name').value=localStorage.getItem('tidebound-name')||'';}catch{}
function updateSound(){$('sound-label').textContent=audio.enabled?'SOUND ON':'SOUND OFF';$('sound-btn').setAttribute('aria-label',audio.enabled?'Mute sound':'Enable sound');}
updateSound();
function toast(message,timeout=3000){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);if(timeout)toastTimer=setTimeout(()=>$('toast').classList.remove('show'),timeout);}
function error(message){$('connection-error').textContent=message;setBusy(false);}
function setBusy(value){busy=value;for(const id of ['solo-btn','create-btn'])$(id).disabled=value;$('join-form').querySelector('button').disabled=value;}
function createPreviewCanvas(kind){const canvas=document.createElement('canvas');fishPreview(canvas,kind);return canvas;}
function renderSelection(){
  for(const [kind,c]of Object.entries(config.classes)){
    const button=document.createElement('button');button.type='button';button.className='class-card'+(selected===kind?' selected':'');button.dataset.kind=kind;button.setAttribute('aria-pressed',String(selected===kind));
    button.append(createPreviewCanvas(kind));const text=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=c.name;small.textContent=descriptions[kind][0];text.append(strong,small);button.append(text);
    button.addEventListener('click',async()=>{select(kind);await audio.unlock();audio.say(`class-${kind}`,2,3);});$('class-list').append(button);
  }
}
function select(kind){selected=kind;for(const button of $('class-list').children){const active=button.dataset.kind===kind;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));}$('special-name').textContent=config.classes[kind].special.toUpperCase();$('special-description').textContent=descriptions[kind][1];if(!me){$('fish-name').textContent=config.classes[kind].name.toUpperCase();$('health-number').textContent=`${config.classes[kind].hp} / ${config.classes[kind].hp}`;}audio.tone(390,.06,'triangle',.04);}
function playerData(){const name=$('player-name').value.trim()||'Little Fish';localStorage.setItem('tidebound-name',name);return {name,kind:selected};}
async function enter(event,extra){
  if(busy||!config)return;if(!socket.connected){error('Connecting to the ocean… please try again in a moment.');return;}
  setBusy(true);$('connection-error').textContent='';await audio.unlock();socket.timeout(8000).emit(event,{...playerData(),...extra},(err,res)=>{
    setBusy(false);if(err){error('The ocean took too long to answer. Try again.');return;}if(res.error){error(res.error);return;}
    me=res.id;host=res.host;lastEvent=0;seenDepth=0;leaving=false;paused=false;contextSpoken.clear();audio.stopVoice();if(event==='create'&&!extra.solo)audio.say('crew-created',3,0);document.querySelector('.site-wrap').classList.add('playing');window.scrollTo({top:0});
    $('attract').hidden=true;$('selection-panel').hidden=true;$('crew-panel').hidden=false;$('game-hud').hidden=false;$('controls-tail').hidden=true;$('pause-btn').hidden=false;
    $('big-code').textContent=res.code;$('small-code').textContent=res.code;
    renderer.positions.clear();renderer.camera={x:7.5,y:6.5};$('game').focus({preventScroll:true});if(touchDevice)$('viewport').scrollIntoView({behavior:'smooth',block:'start'});
  });
}
$('solo-btn').onclick=()=>enter('create',{solo:true});$('create-btn').onclick=()=>enter('create',{solo:false});
$('join-form').onsubmit=e=>{e.preventDefault();const code=$('room-input').value.trim();if(code.length!==5){error('Enter the five-character code from your captain.');return;}enter('join',{code});};
$('room-input').addEventListener('input',()=>{$('room-input').value=$('room-input').value.toUpperCase().replace(/[^A-Z0-9]/g,'');});
$('start-btn').onclick=()=>socket.emit('start');$('retry-btn').onclick=()=>{audio.stopVoice();contextSpoken.clear();seenDepth=0;socket.emit('restart');};
function returnHome(){socket.emit('leave');leaving=true;me=null;state=null;host=false;seenDepth=0;audio.active=false;audio.stopVoice();paused=false;keys.clear();mouse.down=false;document.querySelector('.site-wrap').classList.remove('playing');for(const id of ['lobby-overlay','end-overlay','crew-panel','touch-controls','down-message','depth-banner','pause-btn'])$(id).hidden=true;$('selection-panel').hidden=false;$('attract').hidden=false;$('controls-tail').hidden=false;$('mode-label').textContent='CHOOSE YOUR FISH';$('depth-label').textContent='DEPTH 01 / 06';$('keys-count').textContent='00';$('shells-count').textContent='03';$('objective-label').textContent='YOUR MISSION';$('objective-text').textContent='Find any EXIT. Keep moving.';$('game-hud').hidden=false;$('score').textContent='000000';$('health-fill').style.width='100%';$('health-fill').style.background='#9dff65';$('health-hint').textContent='EAT FOOD TO STAY ALIVE';select(selected);renderer.setState(preview,null,true);clearTimeout(bannerTimer);}
$('leave-btn').onclick=returnHome;$('end-home-btn').onclick=returnHome;
async function copyInvite(){if(!state)return;const url=new URL(location.href);url.searchParams.set('crew',state.code);try{await navigator.clipboard.writeText(url.href);toast('INVITE LINK COPIED. THE CREW AWAITS.');}catch{toast(`CREW CODE: ${state.code}`,6000);}}
$('copy-code').onclick=copyInvite;$('invite-btn').onclick=copyInvite;
$('sound-btn').onclick=()=>{audio.toggle();updateSound();};
function showHelp(){keys.clear();mouse.down=false;$('help-dialog').showModal();}
$('help-btn').onclick=showHelp;$('close-help').onclick=()=>$('help-dialog').close();$('help-done').onclick=()=>$('help-dialog').close();
$('help-dialog').addEventListener('click',e=>{if(e.target===$('help-dialog')){const b=$('help-dialog').getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)$('help-dialog').close();}});
$('fullscreen-btn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.site-wrap').requestFullscreen();}catch{toast('FULLSCREEN IS UNAVAILABLE IN THIS BROWSER.');}};
document.addEventListener('fullscreenchange',()=>{const active=Boolean(document.fullscreenElement);$('fullscreen-btn').textContent=active?'EXIT FULLSCREEN':'FULLSCREEN';$('fullscreen-btn').setAttribute('aria-label',active?'Exit fullscreen':'Enter fullscreen');$('fullscreen-btn').setAttribute('aria-pressed',String(active));});
function pause(){if(!state||!['playing','paused'].includes(state.status))return;if(state.players.length>1){toast('THE OCEAN KEEPS MOVING IN CO-OP.');return;}socket.emit('pause');}
$('pause-btn').onclick=pause;
function banner(kicker,title,subtitle,duration=2800){clearTimeout(bannerTimer);$('banner-kicker').textContent=kicker;$('banner-title').textContent=title;$('banner-subtitle').textContent=subtitle;$('depth-banner').hidden=false;if(duration)bannerTimer=setTimeout(()=>$('depth-banner').hidden=true,duration);}
function updateCrew(s){
  const list=$('crew-list');if(list.dataset.ids!==s.players.map(p=>p.id).join(',')){
    list.replaceChildren();$('lobby-fish').replaceChildren();
    for(const p of s.players){const row=document.createElement('div');row.className='crew-member';row.dataset.player=p.id;row.append(createPreviewCanvas(p.kind));const info=document.createElement('div'),name=document.createElement('strong'),role=document.createElement('small'),hp=document.createElement('div'),fill=document.createElement('i');name.textContent=p.name+(p.id===me?' · YOU':'');role.textContent=config.classes[p.kind].name.toUpperCase();hp.className='crew-hp';hp.append(fill);info.append(name,role,hp);row.append(info);list.append(row);const person=document.createElement('div');person.className='lobby-person';person.append(createPreviewCanvas(p.kind),document.createTextNode(p.name));$('lobby-fish').append(person);}
    list.dataset.ids=s.players.map(p=>p.id).join(',');
  }
  for(const p of s.players){const row=[...list.children].find(r=>r.dataset.player===p.id);row.classList.toggle('downed',p.hp<=0);row.querySelector('.crew-hp i').style.width=`${Math.round(p.hp/p.maxHp*100)}%`;}
  setText('crew-size',`${s.players.length}/4`);
}
function handleEvent(e){
  renderer.event(e);const mine=e.player===me;
  switch(e.type){
    case 'start':toast('FIND AN EXIT. EAT FOOD. KEEP MOVING.',6500);break;
    case 'shot':if(mine)audio.play('blast',.13,.16);break;
    case 'hurt':if(mine)audio.play('hurt',.4,.5);break;
    case 'pickup':if(mine){audio.pickup(e.item);audio.say({food:'food',shell:'magic',key:'key',pearl:'treasure'}[e.item],e.item==='pearl'?0:1,18,true);if(e.item==='food'){toast('FOOD: +48 HEALTH');}if(e.item==='shell')toast('MAGIC: +1 CHARGE. PRESS Q.');if(e.item==='key')toast('KEY FOUND! SWIM INTO A GATE TO OPEN IT.');}break;
    case 'unlock':audio.pickup('key');audio.say('gate',2);toast('GATE UNLOCKED. ONE SHARED KEY USED.');break;
    case 'needKey':if(mine){audio.say('need-key',2);toast('YOU NEED A GOLD KEY.');}break;
    case 'emptyMagic':if(mine){audio.say('empty-magic',2);toast('NO MAGIC. FIND A BLUE POTION.');}break;
    case 'burst':audio.play('burst',.55,.3);if(mine)audio.say('special',2,20);break;
    case 'nest':audio.play('nest',.4,.15);audio.say('nest-destroyed',1,20);break;
    case 'portal':audio.say('nests-cleared',2);toast(e.sealed?'NESTS CLEARED. DEFEAT THE KING.':'NESTS CLEARED. FIND AN EXIT.',4000);break;
    case 'clear':audio.play('portal',.65);audio.say('level-clear',4,0);banner(`DEPTH ${String(e.depth).padStart(2,'0')} CLEARED`,'THE CURRENT CALLS.','Descending in a moment…',2900);break;
    case 'down':audio.say(mine?'down-self':'down-ally',4);toast(mine?'YOU’RE DOWN. STAY CLOSE TO YOUR CREW.':'A CREWMATE IS DOWN. HOLD E NEARBY TO REVIVE.',5000);break;
    case 'revive':audio.pickup('shell');audio.say('revive',4);toast('BACK IN THE CURRENT.');break;
    case 'kingDown':audio.play('nest',.7);audio.say('boss-down',4);toast('THE DROWNED KING HAS FALLEN. REACH THE EXIT.',6000);break;
    case 'victory':audio.stopVoice();audio.say('victory',5,0);break;
    case 'defeat':audio.stopVoice();audio.say('defeat',5,0);break;
  }
}
socket.on('state',s=>{
  if(!me||leaving)return;const old=state;state=s;renderer.setState(s,me);audio.active=s.status==='playing';
  const p=s.players.find(p=>p.id===me);if(!p)return;if(!old||old.depth!==s.depth){renderer.camera={x:p.x,y:p.y};renderer.positions.clear();}
  $('lobby-overlay').hidden=s.status!=='lobby';$('start-btn').hidden=!host;$('waiting-host').hidden=host;
  $('end-overlay').hidden=!['victory','defeat'].includes(s.status);$('touch-controls').hidden=!touchDevice||s.status!=='playing';$('down-message').hidden=p.hp>0||s.status!=='playing';
  setText('mode-label',s.status==='lobby'?'CREW ASSEMBLY':s.players.length>1?'CO-OP EXPEDITION':'SOLO EXPEDITION');setText('depth-label',`DEPTH ${String(s.depth).padStart(2,'0')} / 06`);
  setText('health-number',`${Math.ceil(p.hp)} / ${p.maxHp}`);setText('fish-name',config.classes[p.kind].name.toUpperCase());$('health-fill').style.width=`${Math.round(p.hp/p.maxHp*100)}%`;$('health-fill').style.background=p.hp<p.maxHp*.25?'#ff6753':'#9dff65';setText('health-hint',p.hp<=0?'DOWN! A FRIEND CAN REVIVE YOU':p.hp<p.maxHp*.25?'HEALTH LOW! FIND FOOD!':'EAT FOOD TO STAY ALIVE');
  setText('score',String(s.score).padStart(6,'0'));setText('keys-count',String(s.keys).padStart(2,'0'));setText('shells-count',String(p.shells).padStart(2,'0'));
  const king=s.enemies.find(e=>e.type==='king');setText('objective-label',king?'DEFEAT THE KING':'FIND AN EXIT');setText('objective-text',king?`${Math.ceil(king.hp)} HEALTH`:`${s.nests.length} NESTS SPAWNING`);
  setText('location-label',s.level.name.toUpperCase());setText('canvas-hint',king?'THE KING IS WATCHING.':'THE DEEP IS HUNGRY.');
  updateCrew(s);
  if(old&&s.players.some(p=>!old.players.some(q=>q.id===p.id)))audio.say('crew-joined',2,8);
  if(seenDepth!==s.depth&&s.status==='playing'){
    audio.stopVoice();
    seenDepth=s.depth;contextSpoken.clear();banner(`DEPTH ${String(s.depth).padStart(2,'0')}`,s.level.name,s.level.subtitle,3200);audio.say(s.depth===1?'welcome':s.depth===6?'boss':`level-${s.depth}`,3,0);$('depth-progress').replaceChildren();for(let n=1;n<=6;n++){const el=document.createElement('span');el.className='depth-pip'+(n<s.depth?' complete':n===s.depth?' current':'');el.title=`Depth ${n}: ${config.levels[n-1].name}`;$('depth-progress').append(el);}
  }
  if(s.status==='playing'&&p.hp>0&&!s.transition){
    if(p.hp<p.maxHp*.12)audio.say('critical',4,20);else if(p.hp<p.maxHp*.25)audio.say('low',3,24);
    const nearby=(e,r)=>Math.hypot(p.x-e.x,p.y-e.y)<r;
    const context=s.enemies.some(e=>e.type==='reaper'&&nearby(e,6))?'reaper':s.enemies.some(e=>e.type==='lobster'&&nearby(e,7))?'lobber':s.enemies.some(e=>e.type==='squid'&&nearby(e,5))?'shade':s.exitOpen&&s.exits.some(e=>nearby(e,3))?'exit-near':s.nests.some(e=>nearby(e,4))?'nest-near':null;
    if(context&&!contextSpoken.has(context))audio.say(context,context==='reaper'?3:2,30).then(spoken=>{if(spoken)contextSpoken.add(context);});
  }
  if(lastEvent===0&&s.status==='lobby')lastEvent=s.events.at(-1)?.id||0;
  for(const e of s.events)if(e.id>lastEvent){handleEvent(e);lastEvent=e.id;}
  if(s.status==='paused'&&!paused){paused=true;banner('SOLO EXPEDITION','CURRENT HELD.','Press Escape or Resume to keep swimming.',0);setText('pause-btn','RESUME');}
  if(s.status==='playing'&&paused){paused=false;$('depth-banner').hidden=true;setText('pause-btn','PAUSE');}
  $('pause-btn').hidden=s.status==='lobby'||s.status==='defeat'||s.status==='victory';
  if(['victory','defeat'].includes(s.status)){
    $('depth-banner').hidden=true;const win=s.status==='victory';setText('end-kicker',win?'THE CURSE IS BROKEN':'EXPEDITION LOST');setText('end-title',win?'Small fish. Big legends.':'The deep was hungry.');setText('end-description',win?'Six depths conquered. The Drowned King defeated. The ocean is yours again.':`Your crew reached depth ${s.depth}: ${s.level.name}. Every legend begins with another dive.`);setText('end-score',s.score.toLocaleString());setText('end-kills',s.kills);$('retry-btn').hidden=!host;
  }
  if(['defeat','victory'].includes(old?.status)&&s.status==='playing')renderer.positions.clear();
});
socket.on('host',()=>{host=true;toast('YOU ARE NOW THE CREW CAPTAIN.');$('start-btn').hidden=false;$('waiting-host').hidden=true;$('retry-btn').hidden=false;});
socket.on('disconnect',()=>{keys.clear();mouse.down=false;if(me)banner('CONNECTION LOST','ADRIFT.','Reconnecting to the ocean…',0);});
socket.on('connect',()=>{if(me&&!socket.recovered){const code=state?.code,kind=state?.players.find(p=>p.id===me)?.kind;if(code){socket.timeout(5000).emit('resume',{code,token:sessionStorage.getItem('tidebound-token')},(err,res)=>{if(err||res?.error){returnHome();error('Connection restored. Start a new dive or rejoin your crew.');}else{me=res.id;host=res.host;lastEvent=state?.events.at(-1)?.id||0;$('depth-banner').hidden=true;toast('BACK IN THE CURRENT.');}});}}});
socket.on('session',data=>{sessionStorage.setItem('tidebound-token',data.token);});
socket.on('connect_error',()=>{if(!me)error('Unable to reach the ocean. Retrying…');});

function typing(){return ['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)||$('help-dialog').open;}
window.addEventListener('keydown',e=>{
  if(typing())return;if([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))e.preventDefault();
  if(e.key.toLowerCase()==='m'&&!e.repeat){audio.toggle();updateSound();return;}if(e.key==='Escape'&&!e.repeat){pause();return;}if(e.key.startsWith('Arrow'))mouse.active=false;keys.add(e.key.toLowerCase());
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();mouse.down=false;touch.fire=false;touch.x=touch.y=0;});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();mouse.down=false;touch.fire=false;socket.emit('input',{});}});
function pointMouse(e){const b=$('game').getBoundingClientRect();mouse.x=(e.clientX-b.left)*$('game').width/b.width;mouse.y=(e.clientY-b.top)*$('game').height/b.height;mouse.active=true;}
$('game').addEventListener('pointermove',e=>{if(e.pointerType!=='touch')pointMouse(e);});
$('game').addEventListener('pointerdown',e=>{if(e.button!==0||e.pointerType==='touch')return;pointMouse(e);mouse.down=true;$('game').focus({preventScroll:true});audio.unlock();});window.addEventListener('pointerup',()=>mouse.down=false);$('game').addEventListener('contextmenu',e=>e.preventDefault());
const stick=$('joystick');let stickPointer=null;
function stickMove(e){const b=stick.getBoundingClientRect(),radius=b.width/2-8,dx=e.clientX-b.left-b.width/2,dy=e.clientY-b.top-b.height/2,d=Math.max(radius,Math.hypot(dx,dy));touch.x=dx/d;touch.y=dy/d;stick.querySelector('i').style.transform=`translate(${touch.x*25}px,${touch.y*25}px)`;}
stick.addEventListener('pointerdown',e=>{e.preventDefault();stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);stickMove(e);audio.unlock();});stick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)stickMove(e);});for(const event of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(event,()=>{stickPointer=null;touch.x=touch.y=0;stick.querySelector('i').style.transform='';});
for(const [id,key]of[['touch-fire','fire'],['touch-special','special'],['touch-revive','revive']]){const el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);touch[key]=true;audio.unlock();});for(const event of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,()=>{if(key!=='special')touch[key]=false;});}
setInterval(()=>{
  if(!state||!me||state.status!=='playing'||!socket.connected)return;const p=state.players.find(p=>p.id===me);if(!p)return;
  const target=mouse.active?renderer.world(mouse.x,mouse.y):null;
  const controls=readControls(keys,touch,target?Math.atan2(target.y-p.y,target.x-p.x):null,p.angle);
  let angle=controls.angle;
  if(touch.fire){const clearShot=e=>{const steps=Math.ceil(Math.hypot(e.x-p.x,e.y-p.y)*4);for(let n=1;n<steps;n++)if(state.map[Math.floor(p.y+(e.y-p.y)*n/steps)]?.[Math.floor(p.x+(e.x-p.x)*n/steps)]!==1)return false;return true;};const targets=[...state.enemies,...state.nests].filter(e=>Math.hypot(e.x-p.x,e.y-p.y)<12&&clearShot(e)).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));if(targets.length)angle=Math.atan2(targets[0].y-p.y,targets[0].x-p.x);}
  const special=keys.has('q')||touch.special;
  angle=Math.round(angle/(Math.PI/4))*Math.PI/4;
  const input={x:controls.x,y:controls.y,angle,fire:!typing()&&(controls.fire||mouse.down),special:!typing()&&special,interact:!typing()&&(keys.has('e')||touch.revive)};
  if(special)socket.emit('input',input);else socket.volatile.emit('input',input);
  touch.special=false;
},1000/30);
function frame(t){renderer.draw(t);requestAnimationFrame(frame);}requestAnimationFrame(frame);
try{
  [config,preview]=await Promise.all([fetch('/api/config').then(r=>r.json()),fetch('/api/preview').then(r=>r.json()),spritesReady,tilesReady,document.fonts.ready]);renderSelection();drawGuides();select(selected);renderer.setState(preview,null,true);
  const invite=new URL(location.href).searchParams.get('crew');if(invite&&/^[A-Z0-9]{5}$/i.test(invite)){$('room-input').value=invite.toUpperCase();$('join-form').scrollIntoView({block:'nearest'});toast('YOUR CREW IS WAITING. CHOOSE A FISH, THEN JOIN.',6500);}
}catch{error('Could not load the dungeon. Refresh to try again.');}
