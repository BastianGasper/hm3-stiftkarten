'use strict';
(function () {
  const cards = window.HM3_CARDS || [];
  const byId = Object.fromEntries(cards.map(c => [c.id, c]));
  const $ = id => document.getElementById(id);
  const todayKey = () => new Date().toLocaleDateString('sv-SE');
  const defaults = {progress:{},settings:{paperStyle:'grid',paperHeight:650,penOnly:false,keepNotes:true},day:todayKey(),dailyCount:0};
  let data;
  try {const old=JSON.parse(localStorage.getItem('hm3-stiftkarten-v1')||'null');data={...defaults,...old,settings:{...defaults.settings,...(old?.settings||{})}};}catch{data=JSON.parse(JSON.stringify(defaults));}
  if (data.day!==todayKey()) {data.day=todayKey();data.dailyCount=0;}
  const state={mode:'due',topic:'all',kind:'all',shuffled:false,skipSet:new Set(),currentId:null,prevIds:[],revealed:false,tool:'pen',color:'#172a41',width:2.7,strokes:[],undoStack:[],redo:[],pendingUndo:null,activeStroke:null,erasing:false,eraseSnapshot:null,db:null,notesCache:new Map(),noteToken:0,mathBusy:false};
  let toastTimer;
  function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('on'),2300);}
  function saveData(){try{localStorage.setItem('hm3-stiftkarten-v1',JSON.stringify(data));$('savedPill').textContent='● Lokal gespeichert';$('savedPill').classList.remove('warn');}catch(e){$('savedPill').textContent='Speicher voll – Backup erstellen';$('savedPill').classList.add('warn');console.warn(e);}}
  const now=()=>Date.now();
  function isDue(card){return !data.progress[card.id] || (data.progress[card.id].next||0)<=now();}
  function filteredCards(){return cards.filter(c=>(state.topic==='all'||c.Bereich===state.topic)&&(state.kind==='all'||c.Typ===state.kind));}
  function eligible(){let a=filteredCards().filter(c=>(state.mode==='all'||isDue(c))&&!state.skipSet.has(c.id));if(state.shuffled) a.sort((x,y)=>pseudoShuffle(x.id)-pseudoShuffle(y.id));else if(state.mode==='due')a.sort((x,y)=>(data.progress[x.id]?.next||0)-(data.progress[y.id]?.next||0));return a;}
  let seed=Math.random()*100000|0;
  function pseudoShuffle(str){let h=seed;for(let i=0;i<str.length;i++)h=Math.imul(h^str.charCodeAt(i),16777619);return (h>>>0)/4294967295;}
  function stats(){const total=cards.length;const due=cards.filter(isDue).length;const learned=Object.keys(data.progress).length;$('statTotal').textContent=total;$('statDue').textContent=due;$('statToday').textContent=data.dailyCount;$('progressFill').style.width=(100*learned/Math.max(1,total))+'%';$('progressLabel').textContent=`${learned} von ${total} Karten bearbeitet`;}
  function refreshModes(){document.querySelectorAll('.segment').forEach(b=>b.classList.toggle('active',b.dataset.mode===state.mode));}
  function renderMath(){if(!window.MathJax?.typesetPromise)return;const q=$('question'),a=$('answer');try{MathJax.typesetClear?.([q,a]);MathJax.typesetPromise([q,...(state.revealed?[a]:[])]).catch(err=>console.warn('Math rendering',err));}catch(e){console.warn(e)}}
  function showEmpty(){ $('study').classList.add('hidden');$('empty').classList.remove('hidden');$('emptyText').textContent=state.mode==='due'?'Aktuell sind keine Karten für diese Auswahl fällig. In „Alle Karten“ kannst du trotzdem üben.':'Für diese Filterauswahl sind keine weiteren Karten vorhanden.';stats(); }
  function nextCard(afterId=null){let list=eligible();if(!list.length){state.currentId=null;showEmpty();return;}
    if(state.mode==='all' && afterId){const all=filteredCards();const pos=all.findIndex(c=>c.id===afterId);const successor=[...all.slice(pos+1),...all.slice(0,pos+1)].find(c=>!state.skipSet.has(c.id));state.currentId=successor?.id||list[0].id;}else state.currentId=list[0].id;
    loadCard();
  }
  async function loadCard(){const card=byId[state.currentId];if(!card){showEmpty();return;}$('study').classList.remove('hidden');$('empty').classList.add('hidden');state.revealed=false;$('answerContent').classList.add('hidden');$('revealBtn').textContent='Musterlösung anzeigen ↓';$('cardTag').textContent=`${card.Bereich} · ${card.Typ}`;$('question').textContent=card.Frage;$('answer').textContent=card.Antwort;$('source').textContent='Quelle: '+card.Quelle;
    const options=filteredCards();$('counter').textContent=`Karte ${options.findIndex(c=>c.id===card.id)+1} / ${options.length}`;
    $('prevBtn').disabled=state.prevIds.length===0;stats();renderMath();
    const token=++state.noteToken;state.strokes=[];state.undoStack=[];state.redo=[];state.pendingUndo=null;state.activeStroke=null;redraw();$('noteState').textContent='Notizen werden geladen …';
    const notes=await fetchNote(card.id);if(token!==state.noteToken)return;state.strokes=Array.isArray(notes)?notes:[];state.undoStack=[];state.redo=[];redraw();$('noteState').textContent=state.strokes.length?`Gespeichert: ${state.strokes.length} Striche`:'Notizen werden pro Karte gespeichert';
  }
  function moveForward(){if(state.currentId)state.prevIds.push(state.currentId);state.skipSet.add(state.currentId);nextCard(state.mode==='all'?state.currentId:null);}
  function rate(kind){if(!state.revealed||!state.currentId)return;const id=state.currentId;const p=data.progress[id]||{reps:0,interval:0,streak:0};const DAY=86400000;let interval;
    if(kind==='again'){interval=10/1440;p.streak=0;}
    else if(kind==='hard'){interval=p.interval>=1?Math.max(1,Math.round(p.interval*1.2)):1;p.streak=0;}
    else{interval=p.interval>=1?Math.max(3,Math.round(p.interval*2.2)):3;p.streak=(p.streak||0)+1;}
    p.interval=interval;p.next=now()+interval*DAY;p.reps=(p.reps||0)+1;p.last=now();p.lastRating=kind;data.progress[id]=p;data.dailyCount++;saveData();
    if(!data.settings.keepNotes){deleteNote(id);state.notesCache.delete(id);}state.skipSet.add(id);state.prevIds.push(id);toast(kind==='again'?'In 10 Minuten erneut fällig':kind==='hard'?'Für morgen eingeplant':'Gut! Wiederholung eingeplant');nextCard(state.mode==='all'?id:null);
  }
  // IndexedDB: sketches are kept separate from the small progress record to avoid localStorage size limits.
  function openDB(){return new Promise(resolve=>{if(!('indexedDB'in window)){resolve(null);return;}let req;try{req=indexedDB.open('hm3-stiftkarten-notes',1);}catch{resolve(null);return;}req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('sketches'))req.result.createObjectStore('sketches');};req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);});}
  function idb(action,key,value){return new Promise(resolve=>{if(!state.db){resolve(null);return;}let trans;try{trans=state.db.transaction('sketches',action==='get'?'readonly':'readwrite');const store=trans.objectStore('sketches');let req=action==='get'?store.get(key):action==='put'?store.put(value,key):action==='delete'?store.delete(key):store.getAllKeys();req.onsuccess=()=>resolve(req.result??null);req.onerror=()=>resolve(null);}catch(e){console.warn('IDB',e);resolve(null);}});}
  async function fetchNote(id){if(state.notesCache.has(id))return structuredClone(state.notesCache.get(id));let v=await idb('get',id);if(v===null){try{v=JSON.parse(localStorage.getItem('hm3-note-'+id)||'null')}catch{}}v=Array.isArray(v)?v:[];state.notesCache.set(id,v);return structuredClone(v);}
  async function storeNote(){if(!state.currentId)return;const id=state.currentId,arr=structuredClone(state.strokes);state.notesCache.set(id,arr);$('noteState').textContent=`Gespeichert: ${arr.length} Striche`;if(state.db) await idb('put',id,arr);else{try{localStorage.setItem('hm3-note-'+id,JSON.stringify(arr))}catch{$('noteState').textContent='Speicherproblem! Bitte Backup erstellen';}}}
  async function deleteNote(id){state.notesCache.delete(id);if(state.db)await idb('delete',id);try{localStorage.removeItem('hm3-note-'+id)}catch{}}

  // Canvas: coordinates stored in units relative to the canvas width, preserving notes on rotation.
  const canvas=$('drawingCanvas'),ctx=canvas.getContext('2d');let scale=1,screenWidth=600,screenHeight=650;
  function resizeCanvas(){const r=canvas.getBoundingClientRect();if(r.width<1||r.height<1)return;const dpr=Math.min(window.devicePixelRatio||1,3);screenWidth=r.width;screenHeight=r.height;scale=screenWidth/1000;canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);ctx.setTransform(dpr*scale,0,0,dpr*scale,0,0);redraw();}
  function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/(r.width/1000),y:(e.clientY-r.top)/(r.width/1000),p:e.pressure||0.5};}
  function pathStroke(s){if(!s.points||!s.points.length)return;ctx.beginPath();ctx.strokeStyle=s.color;ctx.fillStyle=s.color;ctx.lineWidth=s.width;ctx.lineCap='round';ctx.lineJoin='round';const p=s.points;ctx.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)ctx.lineTo(p[i].x,p[i].y);if(p.length===1){ctx.arc(p[0].x,p[0].y,s.width/2,0,Math.PI*2);ctx.fill();}else ctx.stroke();}
  function redraw(){ctx.clearRect(0,0,screenWidth/scale,screenHeight/scale);for(const s of state.strokes)pathStroke(s);if(state.activeStroke)pathStroke(state.activeStroke);}
  function isPenEvent(e){return !data.settings.penOnly||e.pointerType==='pen';}
  function distSegment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y;const dot=dx*dx+dy*dy;let t=dot?((p.x-a.x)*dx+(p.y-a.y)*dy)/dot:0;t=Math.min(1,Math.max(0,t));const x=a.x+dx*t,y=a.y+dy*t;return Math.hypot(p.x-x,p.y-y);}
  function eraseAt(pt){let changed=false;for(let i=state.strokes.length-1;i>=0;i--){const s=state.strokes[i],p=s.points||[];const threshold=18/scale+(s.width||2)/2;let hit=false;for(let j=0;j<p.length;j++){if(Math.hypot(pt.x-p[j].x,pt.y-p[j].y)<threshold||j>0&&distSegment(pt,p[j-1],p[j])<threshold){hit=true;break;}}if(hit){state.strokes.splice(i,1);changed=true;}}if(changed)redraw();return changed;}
  function setTool(t){state.tool=t;$('penTool').classList.toggle('selected',t==='pen');$('eraserTool').classList.toggle('selected',t==='eraser');}
  canvas.addEventListener('pointerdown',e=>{if(!state.currentId||!isPenEvent(e))return;e.preventDefault();try{canvas.setPointerCapture(e.pointerId);}catch{}const p=point(e);state.redo=[];state.pendingUndo=structuredClone(state.strokes);
    if(state.tool==='eraser'){state.erasing=true;state.eraseSnapshot=structuredClone(state.strokes);eraseAt(p);}
    else{state.activeStroke={color:state.color,width:state.width/scale,points:[p]};redraw();}
  });
  canvas.addEventListener('pointermove',e=>{if(!isPenEvent(e))return;if(state.erasing){e.preventDefault();eraseAt(point(e));}else if(state.activeStroke){e.preventDefault();const events=e.getCoalescedEvents?.()||[e];for(const ev of events)state.activeStroke.points.push(point(ev));redraw();}});
  async function finishStroke(){let changed=false;if(state.activeStroke){state.strokes.push(state.activeStroke);state.activeStroke=null;changed=true;}if(state.erasing){state.erasing=false;changed=changed||JSON.stringify(state.eraseSnapshot)!==JSON.stringify(state.strokes);state.eraseSnapshot=null;}if(changed){if(state.pendingUndo)state.undoStack.push(state.pendingUndo);redraw();await storeNote();}state.pendingUndo=null;}
  canvas.addEventListener('pointerup',finishStroke);canvas.addEventListener('pointercancel',finishStroke);canvas.addEventListener('lostpointercapture',()=>{if(state.activeStroke||state.erasing)finishStroke();});
  function undo(){if(!state.undoStack.length)return;state.redo.push(structuredClone(state.strokes));state.strokes=state.undoStack.pop();redraw();storeNote();}
  function redo(){if(!state.redo.length)return;state.undoStack.push(structuredClone(state.strokes));state.strokes=state.redo.pop();redraw();storeNote();}
  function configurePaper(){const h=Number(data.settings.paperHeight)||650;$('paper').style.height=h+'px';$('paperHeight').value=String(h);$('paperStyle').value=data.settings.paperStyle;$('paper').className='paper paper-'+data.settings.paperStyle;requestAnimationFrame(resizeCanvas);}
  async function exportBackup(){const notes={};for(const c of cards){const note=await fetchNote(c.id);if(note.length)notes[c.id]=note;}const payload={app:'HM3 Stiftkarten',version:1,exported:new Date().toISOString(),data,notes};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`HM3-Stiftkarten-Backup-${todayKey()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Backup erstellt');}
  async function restoreBackup(file){try{const obj=JSON.parse(await file.text());if(obj.app!=='HM3 Stiftkarten'||!obj.data||typeof obj.notes!=='object')throw Error('Ungültiges Format');if(!confirm('Vorhandenen Lernfortschritt und Zeichnungen mit diesem Backup überschreiben?'))return;data={...defaults,...obj.data,settings:{...defaults.settings,...(obj.data.settings||{})}};state.notesCache.clear();for(const c of cards){const a=Array.isArray(obj.notes[c.id])?obj.notes[c.id]:[];if(a.length){state.notesCache.set(c.id,a);if(state.db)await idb('put',c.id,a);else localStorage.setItem('hm3-note-'+c.id,JSON.stringify(a));}else await deleteNote(c.id);}saveData();configurePaper();state.skipSet.clear();state.prevIds=[];nextCard();toast('Backup wiederhergestellt');$('settingsDialog').close();}catch(e){console.warn(e);toast('Datei konnte nicht importiert werden');}}
  function initControls(){
    const topics=[...new Set(cards.map(c=>c.Bereich))],types=[...new Set(cards.map(c=>c.Typ))];for(const topic of topics){const o=new Option(topic.startsWith('V')?`Vorlesung ${topic.slice(1)}`:topic,topic);$('topicFilter').add(o);}for(const type of types)$('kindFilter').add(new Option(type,type));
    document.querySelectorAll('.segment').forEach(el=>el.onclick=()=>{state.mode=el.dataset.mode;state.skipSet.clear();state.prevIds=[];refreshModes();nextCard();});
    $('topicFilter').onchange=e=>{state.topic=e.target.value;state.skipSet.clear();state.prevIds=[];nextCard();};$('kindFilter').onchange=e=>{state.kind=e.target.value;state.skipSet.clear();state.prevIds=[];nextCard();};
    $('shuffleBtn').onclick=()=>{state.shuffled=!state.shuffled;seed=Math.random()*100000|0;$('shuffleBtn').style.background=state.shuffled?'#e8f4f8':'';state.skipSet.clear();nextCard();toast(state.shuffled?'Zufällige Reihenfolge':'Standardreihenfolge');};
    $('revealBtn').onclick=()=>{state.revealed=!state.revealed;$('answerContent').classList.toggle('hidden',!state.revealed);$('revealBtn').textContent=state.revealed?'Musterlösung ausblenden ↑':'Musterlösung anzeigen ↓';renderMath();};
    $('againBtn').onclick=()=>rate('again');$('hardBtn').onclick=()=>rate('hard');$('goodBtn').onclick=()=>rate('good');
    $('skipBtn').onclick=moveForward;$('prevBtn').onclick=()=>{const id=state.prevIds.pop();if(!id)return;state.skipSet.delete(id);state.currentId=id;loadCard();};$('showAllBtn').onclick=()=>{state.mode='all';state.skipSet.clear();refreshModes();nextCard();};
    $('penTool').onclick=()=>setTool('pen');$('eraserTool').onclick=()=>setTool('eraser');document.querySelectorAll('.color-dot').forEach(b=>b.onclick=()=>{state.color=b.dataset.color;document.querySelectorAll('.color-dot').forEach(x=>x.classList.toggle('selected',x===b));setTool('pen');});$('penWidth').onchange=e=>state.width=Number(e.target.value);$('undoBtn').onclick=undo;$('redoBtn').onclick=redo;
    $('clearBtn').onclick=()=>{if(!state.strokes.length)return;if(confirm('Notizblatt für diese Karte wirklich löschen?')){state.undoStack.push(structuredClone(state.strokes));state.strokes=[];state.redo=[];redraw();storeNote();}};
    $('paperStyle').onchange=e=>{data.settings.paperStyle=e.target.value;configurePaper();saveData();};$('paperHeight').onchange=e=>{data.settings.paperHeight=Number(e.target.value);configurePaper();saveData();};
    $('settingsBtn').onclick=()=>{$('penOnly').checked=!!data.settings.penOnly;$('keepNotes').checked=!!data.settings.keepNotes;$('settingsDialog').showModal();};$('closeSettings').onclick=()=>$('settingsDialog').close();
    $('penOnly').onchange=e=>{data.settings.penOnly=e.target.checked;saveData();};$('keepNotes').onchange=e=>{data.settings.keepNotes=e.target.checked;saveData();};$('exportBtn').onclick=exportBackup;$('backupFooter').onclick=exportBackup;$('restoreInput').onchange=e=>{if(e.target.files?.[0])restoreBackup(e.target.files[0]);e.target.value='';};
    $('resetProgressBtn').onclick=()=>{if(confirm('Wirklich alle 95 Lernbewertungen zurücksetzen? Die handschriftlichen Notizen bleiben erhalten.')){data.progress={};data.dailyCount=0;state.skipSet.clear();state.prevIds=[];saveData();stats();nextCard();toast('Lernfortschritt zurückgesetzt');$('settingsDialog').close();}};
    window.addEventListener('resize',()=>requestAnimationFrame(resizeCanvas));
    document.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();}});
  }
  async function start(){state.db=await openDB();initControls();configurePaper();refreshModes();nextCard();saveData();window.addEventListener('hm3-math-ready',renderMath);}
  start();
})();