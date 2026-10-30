'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const LEGACY = 'hm3-stiftkarten-v1';
  const SETTINGS_KEY = 'hm3-stiftkarten-v2';
  const APP_VERSION='2026-10-30.18';
  const OFFLINE_CACHE='hm3-stiftkarten-v18-20261030';
  const OFFLINE_FILES=['./','./index.html','./style.css','./app.js','./cards.json','./proofs.json','./version.json','./manifest.webmanifest','./assets/mathjax-tex-svg.js','./assets/icon-180.png','./assets/icon-192.png','./assets/icon-512.png'];
  let checkingUpdates=false,lastUpdateCheck=0;
  const memory = {sketches:new Map(),attempts:[],sessions:[]};
  const clone = v => JSON.parse(JSON.stringify(v));
  const dateString = ts => new Date(ts).toLocaleDateString('de-DE');
  const safeText = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const now = () => Date.now();
  let cards=[],proofs=[],proofById=new Map(),originalCards=new Map(),byId=new Map(),db=null,storageError=false,version=0,editingCardId=null;
  let data={progress:{},cardPrefs:{},settings:{pencilOnly:true,sheetStyle:'grid',sheetHeight:800},sessionId:null,recordingActive:false,lastRecordingId:null,recordingTouchedCards:[],quiz:null,proofStudy:null};
  let recordingTouchedCards=new Set(),recordingNamingId=null;
  let selected={mode:'due',topic:'all',type:'all',current:null,seen:new Set(),history:[],revealed:false};
  let ink={tool:'pen',color:'#182231',width:2.7,strokes:[],active:null,erasing:false,undo:[],redo:[],erasedBefore:null,pointerId:null,cardId:null};
  const pen=$('inkCanvas'),ctx=pen.getContext('2d',{alpha:true});
  const eraserOverlay=$('eraserOverlay'),eraserCtx=eraserOverlay.getContext('2d',{alpha:true});
  let railTouch=null;
  let appRefreshing=false;
  let inkMode='auto';
  let logicalWidth=1000,logicalHeight=1000,cssWidth=800,cssHeight=800,scale=1;
  let noteLoads=0,saveQueue=Promise.resolve(),noticeTimeout=null,mathQueue=Promise.resolve();
  const status=(msg,error=false)=>{const el=$('saveStatus');el.textContent=error?msg:'';el.hidden=!error;el.classList.toggle('is-warning',error);};
  function notice(msg){const el=$('notice');el.textContent=msg;el.classList.add('is-visible');clearTimeout(noticeTimeout);noticeTimeout=setTimeout(()=>el.classList.remove('is-visible'),2600);}

  function loadData(){try{const current=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'null');const old=JSON.parse(localStorage.getItem(LEGACY)||'null');if(current){data={...data,...current,settings:{...data.settings,...current.settings},cardPrefs:current.cardPrefs||{}};if(current.recordingActive===undefined){data.recordingActive=false;data.sessionId=null;data.recordingTouchedCards=[];}recordingTouchedCards=new Set(data.recordingTouchedCards||[]);}else if(old){data.progress=old.progress||{};data.settings.sheetStyle=old.settings?.paperStyle||'grid';data.settings.sheetHeight=old.settings?.paperHeight||800;data.settings.pencilOnly=old.settings?.penOnly??true;}}
    catch(e){console.warn('Settings read',e);storageError=true;}}
  function storeData(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(data));if(!storageError)status('');return true;}catch(e){console.warn('Settings save',e);storageError=true;status('Speichern fehlgeschlagen – exportieren!',true);return false;}}
  function openDB(){return new Promise(resolve=>{if(!window.indexedDB)return resolve(null);let req;try{req=indexedDB.open('hm3-stiftkarten-notes',2);}catch{return resolve(null);}
    req.onupgradeneeded=()=>{const d=req.result;for(const name of ['sketches','attempts','sessions'])if(!d.objectStoreNames.contains(name))d.createObjectStore(name);};req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);req.onblocked=()=>resolve(null);
  });}
  function idb(store,method,key,value){if(!db)return Promise.reject(new Error('indexedDB unavailable'));return new Promise((resolve,reject)=>{try{const tx=db.transaction(store,method==='get'||method==='getAll'||method==='keys'?'readonly':'readwrite'),obj=tx.objectStore(store);let request;
    if(method==='get')request=obj.get(key);else if(method==='put')request=obj.put(value,key);else if(method==='delete')request=obj.delete(key);else if(method==='keys')request=obj.getAllKeys();else request=obj.getAll();
    if(method==='put'||method==='delete'){tx.oncomplete=()=>resolve(true);}else request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('IDB operation failed'));tx.onerror=()=>reject(tx.error||new Error('IDB transaction failed'));
  }catch(e){reject(e)}});}
  async function readRecord(store,key){if(!db){if(store==='sketches'){if(memory.sketches.has(key))return clone(memory.sketches.get(key));try{return JSON.parse(localStorage.getItem('hm3-note-'+key)||'null');}catch{return null;}}return memory[store].find(x=>x.id===key)||null;}
    try{return await idb(store,'get',key);}catch(e){storageError=true;status('Speicherproblem – Backup erstellen',true);return null;}}
  async function writeRecord(store,key,value){if(!db){if(store==='sketches'){memory.sketches.set(key,clone(value));try{localStorage.setItem('hm3-note-'+key,JSON.stringify(value));return true;}catch{return false;}}const arr=memory[store];const i=arr.findIndex(x=>x.id===key);if(i>=0)arr[i]=clone(value);else arr.push(clone(value));try{localStorage.setItem('hm3-fallback-'+store,JSON.stringify(arr));return true;}catch{return false;}}
    try{await idb(store,'put',key,value);return true;}catch(e){console.warn('Save failed',e);storageError=true;status('Speicherproblem – Backup erstellen',true);return false;}}
  async function listRecords(store){if(!db){if(store==='sketches')return [...memory.sketches].map(([id,strokes])=>({id,strokes}));return clone(memory[store]);}
    try{return await idb(store,'getAll');}catch(e){storageError=true;status('Datenbankproblem – Backup erstellen',true);return [];}}
  async function getAllSketches(){const result={};if(db){try{const [keys,all]=await Promise.all([idb('sketches','keys'),idb('sketches','getAll')]);keys.forEach((k,i)=>result[k]=all[i]);}catch(e){storageError=true;status('Backup nicht möglich: Notizen konnten nicht gelesen werden',true);throw e;}}else{
      for(const [id,strokes] of memory.sketches)result[id]=strokes;
      // Also include retired cards and every proof-step notebook after reload.
      // The previous fallback searched only currently active card IDs.
      const keys=[];
      if(typeof localStorage.length==='number'&&typeof localStorage.key==='function'){
        for(let i=0;i<localStorage.length;i++){
          const k=localStorage.key(i);
          if(k&&k.startsWith('hm3-note-'))keys.push(k);
        }
      }else for(const c of cards)keys.push('hm3-note-'+c.id);
      for(const key of keys){
        const id=key.slice('hm3-note-'.length);
        if(Object.prototype.hasOwnProperty.call(result,id))continue;
        const raw=localStorage.getItem(key);if(raw===null)continue;
        let strokes;
        try{strokes=JSON.parse(raw);}catch(e){throw Error('Beschädigtes Notizblatt im Ersatzspeicher: '+id);}
        if(!Array.isArray(strokes))throw Error('Ungültiges Notizblatt im Ersatzspeicher: '+id);
        result[id]=strokes;
      }
    }return result;}
  // Ensure every edit is serialized before changing cards or creating a snapshot.
  function saveInk(){const id=ink.cardId;if(!id)return Promise.resolve();
    if(data.recordingActive&&data.sessionId&&ink.strokes.some(stroke=>stroke.recordingId===data.sessionId&&!stroke.archivedAttemptId)){recordingTouchedCards.add(id);data.recordingTouchedCards=[...recordingTouchedCards];storeData();}
    const snapshot=ink.strokes.slice();$('noteStatus').textContent='Speichert …';
    saveQueue=saveQueue.catch(()=>{}).then(async()=>{const ok=await writeRecord('sketches',id,snapshot);if(ink.cardId===id)$('noteStatus').textContent=ok?'Gespeichert':'Speichern fehlgeschlagen';if(!ok){storageError=true;status('Notiz nicht gespeichert – exportieren!',true);}});return saveQueue;
  }
  async function loadInk(cardId){const token=++noteLoads;ink.cardId=cardId;ink.strokes=[];ink.active=null;ink.erasing=false;ink.erasedInGesture=false;ink.eraserTrail=[];ink.eraserTip=null;ink.lastEraserPoint=null;ink.undo=[];ink.redo=[];renderInk();renderEraserOverlay();$('noteStatus').textContent='Lade Notizen …';await saveQueue.catch(()=>{});const strokes=await readRecord('sketches',cardId);if(noteLoads!==token)return;ink.strokes=Array.isArray(strokes)?strokes:[];renderInk();$('noteStatus').textContent=ink.strokes.length?'Gespeichert':'Leeres Blatt';}

  async function fetchCards(){let response;try{response=await fetch('cards.json',{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);response=await response.json();}catch(e){console.warn('Deck load',e);throw Error('Karten konnten nicht geladen werden. Bitte Verbindung prüfen oder App erneut öffnen.');}
    if(!Array.isArray(response))throw Error('Ungültige Kartendatei');const seen=new Set();const originals=response.map(c=>{if(!c.id||seen.has(c.id)||!c.Frage||!c.Antwort)throw Error('Ungültige oder doppelte Karten-ID: '+c.id);seen.add(c.id);return {id:String(c.id),Frage:String(c.Frage),Antwort:String(c.Antwort),Hintergrund:String(c.Hintergrund||''),Beispiel:String(c.Beispiel||''),Bereich:String(c.Bereich||'Sonstige'),Typ:String(c.Typ||'Theorie'),Quelle:String(c.Quelle||'')} });originalCards=new Map(originals.map(c=>[c.id,c]));rebuildCards();}
  function prefFor(id){return data.cardPrefs?.[id]||{};}
  function rebuildCards(){cards=[...originalCards.values()].map(c=>{const p=prefFor(c.id);return {...c,Frage:typeof p.Frage==='string'&&p.Frage.trim()?p.Frage:c.Frage,Antwort:typeof p.Antwort==='string'&&p.Antwort.trim()?p.Antwort:c.Antwort,favorite:!!p.favorite,disabled:!!p.disabled};});byId=new Map(cards.map(c=>[c.id,c]));}
  function mutatePref(id,patch){const p={...prefFor(id),...patch};if(!data.cardPrefs)data.cardPrefs={};if(!p.favorite&&!p.disabled&&!('Frage'in p)&&!('Antwort'in p)&&!('sheetHeight'in p))delete data.cardPrefs[id];else data.cardPrefs[id]=p;storeData();rebuildCards();updateStats();}
  function quickActions(){const c=byId.get(selected.current);if(!c)return;const fav=$('cardFavoriteBtn');fav.textContent=c.favorite?'★':'☆';fav.classList.toggle('is-favorite',c.favorite);fav.setAttribute('aria-pressed',String(c.favorite));fav.setAttribute('aria-label',c.favorite?'Favorit entfernen':'Als Favorit markieren');fav.title=c.favorite?'Favorit entfernen':'Als Favorit markieren';const dis=$('cardDisableBtn');dis.disabled=!!data.quiz?.active;dis.textContent=c.disabled?'Aktivieren':'Deaktivieren';dis.classList.toggle('is-disabled',c.disabled);dis.title=c.disabled?'Karte wieder in den Lerndurchgang aufnehmen':'Karte aus normalen Lerndurchgängen nehmen';}
  async function changeFavorite(id){const c=byId.get(id);if(!c)return;mutatePref(id,{favorite:!c.favorite});if(selected.current===id){quickActions();if(selected.mode==='favorites'&&!byId.get(id).favorite){selected.seen.add(id);await advance();}}renderLibraryIfOpen();}
  async function changeDisabled(id){const c=byId.get(id);if(!c)return;if(selected.current===id){await finishInk();await saveQueue.catch(()=>{});}mutatePref(id,{disabled:!c.disabled});if(selected.current===id&&byId.get(id).disabled){selected.seen.add(id);await advance();}else if(selected.current===id)quickActions();else if(!selected.current&&!byId.get(id).disabled)await advance();renderLibraryIfOpen();}
  function renderLibraryIfOpen(){if($('libraryDialog').open)renderLibrary();}
  function renderLibrary(){const q=$('librarySearch').value.trim().toLocaleLowerCase('de'),mode=$('libraryFilter').value;const shown=cards.filter(c=>(mode==='all'||(mode==='active'&&!c.disabled)||(mode==='disabled'&&c.disabled)||(mode==='favorite'&&c.favorite))&&(!q||[c.Frage,c.Antwort,c.Bereich,c.Typ,c.Quelle].some(s=>s.toLocaleLowerCase('de').includes(q))));$('libraryCount').textContent=`${shown.length} von ${cards.length} Karten · ${cards.filter(c=>c.disabled).length} deaktiviert · ${cards.filter(c=>c.favorite).length} Favoriten`;
    const frag=document.createDocumentFragment();for(const c of shown){const row=document.createElement('div');row.className='library-item'+(c.disabled?' is-disabled':'');const main=document.createElement('div');main.className='library-item-main';const meta=document.createElement('div');meta.className='library-item-meta';meta.textContent=`${c.Bereich} · ${c.Typ}${c.Quelle?' · '+c.Quelle:''}${prefFor(c.id).Frage!==undefined?' · Bearbeitet':''}`;const question=document.createElement('div');question.className='library-item-question';question.textContent=c.Frage;const preview=document.createElement('details');preview.className='library-preview';const summary=document.createElement('summary');summary.textContent='Musterlösung ansehen';const answer=document.createElement('div');answer.className='library-preview-answer';answer.textContent=c.Antwort;preview.append(summary,answer);preview.addEventListener('toggle',()=>{if(preview.open&&window.MathJax?.typesetPromise){mathQueue=mathQueue.catch(()=>{}).then(()=>window.MathJax.typesetPromise([answer]).catch(console.warn));}});main.append(meta,question,preview);const actions=document.createElement('div');actions.className='library-item-actions';const make=(label,fn,extra='')=>{const b=document.createElement('button');b.type='button';b.className='button '+extra;b.textContent=label;b.addEventListener('click',fn);actions.appendChild(b);return b;};const star=make(c.favorite?'★':'☆',()=>changeFavorite(c.id),'library-star'+(c.favorite?' is-favorite':''));star.setAttribute('aria-label',c.favorite?'Favorit entfernen':'Favorit setzen');star.title=star.getAttribute('aria-label');make(c.disabled?'Aktivieren':'Deaktivieren',()=>changeDisabled(c.id));make('Bearbeiten',()=>openEditor(c.id));make('Öffnen',async()=>{$('libraryDialog').close();await showCard(c.id);});row.append(main,actions);frag.appendChild(row);}const list=$('libraryList');list.replaceChildren(frag);if(!shown.length)list.textContent='Keine passenden Karten gefunden.';}
  function openEditor(id){const c=byId.get(id);if(!c)return;editingCardId=id;$('editorHint').textContent=c.Bereich+' · '+c.Typ;$('editQuestion').value=c.Frage;$('editAnswer').value=c.Antwort;$('resetCardBtn').disabled=!('Frage'in prefFor(id))&&!('Antwort'in prefFor(id));$('editorDialog').showModal();}
  function closeEditor(){$('editorDialog').close();editingCardId=null;}
  function syncEditedCard(id){const c=byId.get(id);if(selected.current===id){$('cardQuestion').textContent=c.Frage;$('cardAnswer').textContent=c.Antwort;quickActions();math();}renderLibraryIfOpen();}
  function saveEditor(e){e.preventDefault();if(!editingCardId)return;const id=editingCardId,question=$('editQuestion').value.trim(),answer=$('editAnswer').value.trim();if(!question||!answer){notice('Frage und Musterlösung dürfen nicht leer sein.');return;}mutatePref(id,{Frage:question,Antwort:answer});syncEditedCard(id);closeEditor();notice('Karte bearbeitet und lokal gespeichert.');}
  function resetEditor(){const id=editingCardId,original=originalCards.get(id);if(!id||!original)return;if(!confirm('Eigene Textänderungen an dieser Karte zurücksetzen? Notizen und Bewertungen bleiben erhalten.'))return;const p={...prefFor(id)};delete p.Frage;delete p.Antwort;delete data.cardPrefs[id];if(Object.keys(p).length)data.cardPrefs[id]=p;storeData();rebuildCards();syncEditedCard(id);closeEditor();notice('Originaltext wiederhergestellt.');}

  function due(c){const p=data.progress[c.id];return !p||!p.next||p.next<=now();}
  function filtered(){return cards.filter(c=>!c.disabled&&(selected.topic==='all'||c.Bereich===selected.topic)&&(selected.type==='all'||c.Typ===selected.type)&&(selected.mode!=='favorites'||c.favorite));}
  function shuffle(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function eligible(){return shuffle(filtered().filter(c=>!selected.seen.has(c.id)&&(selected.mode==='all'||due(c))));}
  function updateStats(){const a=cards.filter(c=>!c.disabled).length,d=cards.filter(c=>!c.disabled&&due(c)).length;const rows=data.recordingActive?memory.attempts.filter(e=>e.sessionId===data.sessionId):[];
    $('statAll').textContent=a;$('statDue').textContent=d;$('statSession').textContent=rows.length;$('statWrong').textContent=rows.filter(e=>e.rating==='wrong').length;}
  function updateFilters(){for(const t of [...new Set(cards.map(c=>c.Bereich))])$('topicFilter').add(new Option(t,t));for(const t of [...new Set(cards.map(c=>c.Typ))])$('typeFilter').add(new Option(t,t));}
  // V17: Five independent, rigorous proof stages, each with its own local ink sheet.
  async function fetchProofs(){
    let items;
    try{
      const response=await fetch('proofs.json',{cache:'no-store'});
      if(!response.ok)throw Error('HTTP '+response.status);
      items=await response.json();
    }catch(e){console.warn('Proof catalog load',e);throw Error('Beweiskatalog konnte nicht geladen werden. Bitte App aktualisieren.');}
    if(!Array.isArray(items)||items.length===0)throw Error('Ungültiger Beweiskatalog');
    const seen=new Set(),parts=['Problem','Behauptung','Voraussetzungen','Ansatz','Durchführung'];
    for(const p of items){
      if(typeof p.id!=='string'||seen.has(p.id)||!p.title||!p.source||!p.scope||!Array.isArray(p.intro)||p.intro.length!==2||p.intro.some(i=>!i.title||!i.body)||!Array.isArray(p.steps)||p.steps.length!==5||
         p.steps.some((s,i)=>s.title!==parts[i]||typeof s.task!=='string'||typeof s.answer!=='string'||!s.answer.trim()))
        throw Error('Ungültiger Beweiseintrag: '+p.id);
      seen.add(p.id);
    }
    proofs=items;proofById=new Map(items.map(p=>[p.id,p]));
  }
  function proofNoteId(p,step){return 'hm3-proof-note-'+p.id+'-'+step;}
  function chooseProof(){
    if(data.quiz?.active){notice('Zuerst Abfrage beenden.');return;}
    if(data.recordingActive){notice('Zuerst Aufnahme stoppen.');return;}
    const select=$('proofSelect');select.replaceChildren();
    for(const p of proofs){
      const option=document.createElement('option');
      option.value=p.id;
      option.textContent=p.title+' · '+p.source;
      select.append(option);
    }
    if(data.proofStudy?.active)select.value=data.proofStudy.id;
    $('proofSelectDialog').showModal();
  }
  function proofMath(){
    const nodes=[$('proofStepTask'),$('proofStepAnswer'),$('proofIntroBody')];
    mathQueue=mathQueue.catch(()=>{}).then(async()=>{
      if(!window.MathJax?.typesetPromise)return;
      try{window.MathJax.typesetClear?.(nodes);await window.MathJax.typesetPromise(nodes);}
      catch(e){console.warn('Proof MathJax',e);}
    });
  }
  function updateProofChrome(){
    const s=data.proofStudy,active=!!s?.active;
    document.body.classList.toggle('proof-active',active);
    document.body.classList.toggle('proof-intro',active&&s.phase==='intro');
    $('proofToolbar').classList.toggle('is-hidden',!active);
    $('proofPanel').classList.toggle('is-hidden',!active);
    if(active){
      const p=proofById.get(s.id);
      $('proofToolbarTitle').textContent=p?.title||'Beweis';
      $('proofToolbarProgress').textContent=s.phase==='intro'?'Vorbereitung '+((s.introIndex||0)+1)+' / 2':(s.step+1)+' / 5';
    }
  }
  async function displayProof(){
    const state=data.proofStudy;if(!state?.active)return;
    const p=proofById.get(state.id);
    if(!p){data.proofStudy=null;storeData();updateProofChrome();await advance();return;}
    if(ink.pointerId!==null){notice('Pencil zuerst abheben.');return;}
    await finishInk();await saveQueue.catch(()=>{});
    if(!state.phase)state.phase='steps';
    updateProofChrome();
    $('workspace').classList.remove('is-hidden');
    $('emptyState').classList.add('is-hidden');
    $('quizSummary').classList.add('is-hidden');
    $('proofSource').textContent=p.source;
    $('proofScope').textContent=p.scope;
    const intro=state.phase==='intro';
    $('proofIntro').classList.toggle('is-hidden',!intro);
    $('proofPrevBtn').disabled=intro?state.introIndex===0:false;
    if(intro){
      const page=p.intro[state.introIndex];
      $('proofIntroTitle').textContent=page.title;
      $('proofIntroBody').textContent=page.body;
      $('proofNextBtn').textContent=state.introIndex===p.intro.length-1?'Beweis beginnen':'Weiter';
      selected.current=null;selected.revealed=false;
      proofMath();return;
    }
    const step=p.steps[state.step],noteId=proofNoteId(p,state.step);
    selected.current=noteId;selected.revealed=false;
    $('proofStepHeading').textContent=step.title;
    $('proofStepTask').textContent=step.task;
    $('proofStepAnswer').textContent=step.answer;
    $('proofStepAnswer').classList.toggle('is-hidden',!state.revealed);
    $('proofRevealBtn').textContent=state.revealed?'Antwort ausblenden':'Schritt aufdecken';
    $('proofRevealBtn').setAttribute('aria-expanded',String(!!state.revealed));
    $('proofNextBtn').textContent=state.step===4?'Beweis abschließen':'Weiter';
    const chips=$('proofSteps');chips.replaceChildren();
    for(let i=0;i<5;i++){
      const el=document.createElement('div');
      el.className='proof-step-chip'+(i===state.step?' is-current':i<state.step?' is-done':'');
      el.textContent=p.steps[i].title;chips.append(el);
    }
    configureSheet();await loadInk(noteId);proofMath();
  }
  async function beginProof(e){
    e.preventDefault();
    if(data.quiz?.active||data.recordingActive)return;
    if(ink.pointerId!==null){notice('Pencil zuerst abheben.');return;}
    const id=$('proofSelect').value;
    if(!proofById.has(id))return;
    await finishInk();await saveQueue.catch(()=>{});
    data.proofStudy={active:true,id,phase:'intro',introIndex:0,step:0,revealed:false};
    storeData();$('proofSelectDialog').close();
    await displayProof();
  }
  function revealProof(){
    const s=data.proofStudy;if(!s?.active||s.phase==='intro')return;
    s.revealed=!s.revealed;storeData();
    $('proofStepAnswer').classList.toggle('is-hidden',!s.revealed);
    $('proofRevealBtn').textContent=s.revealed?'Antwort ausblenden':'Schritt aufdecken';
    $('proofRevealBtn').setAttribute('aria-expanded',String(!!s.revealed));
    if(s.revealed)proofMath();
  }
  async function moveProof(delta){
    const state=data.proofStudy;if(!state?.active)return;
    if(ink.pointerId!==null){notice('Pencil zuerst abheben.');return;}
    if(state.phase==='intro'){
      if(delta<0){
        if(state.introIndex===0)return;
        state.introIndex-=1;
      }else if(state.introIndex<1)state.introIndex+=1;
      else{state.phase='steps';state.step=0;state.revealed=false;}
      storeData();await displayProof();return;
    }
    if(delta===1&&state.step===4){await exitProof();return;}
    if(delta<0&&state.step===0){
      await finishInk();await saveQueue.catch(()=>{});
      state.phase='intro';state.introIndex=1;state.revealed=false;
      storeData();await displayProof();return;
    }
    const next=Math.min(4,Math.max(0,state.step+delta));
    if(next===state.step)return;
    await finishInk();await saveQueue.catch(()=>{});
    state.step=next;state.revealed=false;storeData();await displayProof();
  }
  async function exitProof(){
    if(!data.proofStudy?.active)return;
    if(ink.pointerId!==null){notice('Pencil zuerst abheben.');return;}
    await finishInk();await saveQueue.catch(()=>{});
    data.proofStudy=null;storeData();selected.current=null;
    updateProofChrome();selected.seen.clear();selected.history=[];
    await advance();
  }
  // V16: independent randomized quiz with immutable initial pool.
  // Cumulative results belong to original question IDs, never to the current review batch.
  function quizCount(){
    const topics=new Set([...document.querySelectorAll('[data-quiz-topic]:checked')].map(e=>e.value));
    const types=new Set([...document.querySelectorAll('[data-quiz-type]:checked')].map(e=>e.value));
    return cards.filter(c=>!c.disabled&&topics.has(c.Bereich)&&types.has(c.Typ)).length;
  }
  function quizCheckbox(container,attribute,value){
    const label=document.createElement('label');label.className='quiz-check';
    const check=document.createElement('input');check.type='checkbox';check.value=value;
    check.checked=true;check.setAttribute(attribute,'');check.addEventListener('change',updateQuizCount);
    const textNode=document.createElement('span');textNode.textContent=value;
    label.append(check,textNode);container.append(label);
  }
  function quizSelectUI(){
    $('quizTopics').replaceChildren();$('quizTypes').replaceChildren();
    const topics=[...new Set(cards.filter(c=>!c.disabled).map(c=>c.Bereich))];
    const types=[...new Set(cards.filter(c=>!c.disabled).map(c=>c.Typ))];
    topics.forEach(t=>quizCheckbox($('quizTopics'),'data-quiz-topic',t));
    types.forEach(t=>quizCheckbox($('quizTypes'),'data-quiz-type',t));
    updateQuizCount();
  }
  function updateQuizCount(){
    const count=quizCount();
    $('quizSetupCount').textContent=count+' Fragen';
    $('quizBeginBtn').disabled=count===0;
  }
  async function beginQuiz(e){
    e.preventDefault();
    if(data.proofStudy?.active)return;
    if(data.quiz?.active)return;
    if(ink.pointerId!==null){notice('Pencil zuerst abheben.');return;}
    const topics=[...document.querySelectorAll('[data-quiz-topic]:checked')].map(x=>x.value);
    const types=[...document.querySelectorAll('[data-quiz-type]:checked')].map(x=>x.value);
    const initialIds=cards.filter(c=>!c.disabled&&topics.includes(c.Bereich)&&types.includes(c.Typ)).map(c=>c.id);
    if(!initialIds.length)return;
    await finishInk();await saveQueue.catch(()=>{});
    data.quiz={active:true,stage:'cards',initialIds,results:{},queue:shuffle(initialIds),index:0,round:1,topics,types,startedAt:new Date().toISOString()};
    storeData();$('quizSetupDialog').close();updateQuizChrome();await advance();
  }
  function updateQuizChrome(){
    const q=data.quiz;
    const active=!!q?.active;
    document.body.classList.toggle('quiz-active',active);
    document.body.classList.toggle('quiz-results',active&&q.stage==='results');
    $('quizToolbar').classList.toggle('is-hidden',!active);
    if(!active){$('quizSummary').classList.add('is-hidden');return;}
    $('quizRoundLabel').textContent='Runde '+q.round;
    $('quizProgress').textContent=q.stage==='results'?q.queue.length+' / '+q.queue.length:Math.min(q.index+1,q.queue.length)+' / '+q.queue.length;
    if(q.stage!=='results')$('quizSummary').classList.add('is-hidden');
  }
  async function quizRate(rating){
    const q=data.quiz;
    if(!q?.active||q.stage!=='cards'||q.index>=q.queue.length)return;
    const id=q.queue[q.index];
    if(selected.current!==id)return;
    await finishInk();await saveQueue.catch(()=>{});
    q.results[id]=rating;
    planNext(id,rating);
    q.index+=1;storeData();
    await advance();
  }
  async function quizFinish(){
    const q=data.quiz;if(!q?.active)return;
    await finishInk();await saveQueue.catch(()=>{});
    await archiveDraftIfNeeded();
    q.stage='results';storeData();
    updateQuizChrome();
    $('workspace').classList.add('is-hidden');
    $('emptyState').classList.add('is-hidden');
    const counts={good:0,partial:0,wrong:0};
    for(const id of q.initialIds){const key=q.results[id];if(key in counts)counts[key]+=1;}
    $('quizSummaryTitle').textContent='Runde '+q.round+' · '+q.initialIds.length+' Fragen';
    $('quizGood').textContent=counts.good;
    $('quizPartial').textContent=counts.partial;
    $('quizWrong').textContent=counts.wrong;
    $('quizRepeatWrong').disabled=!counts.wrong;
    $('quizRepeatPartial').disabled=!counts.partial;
    $('quizRepeatAll').disabled=!q.initialIds.length;
    $('quizSummary').classList.remove('is-hidden');
  }
  async function repeatQuiz(which){
    const q=data.quiz;if(!q?.active||q.stage!=='results')return;
    const ids=q.initialIds.filter(id=>which==='all'||q.results[id]===which);
    if(!ids.length)return;
    q.queue=shuffle(ids);q.index=0;q.round+=1;q.stage='cards';
    storeData();$('quizSummary').classList.add('is-hidden');updateQuizChrome();await advance();
  }
  async function exitQuiz(){
    if(!data.quiz?.active)return;
    if(ink.pointerId!==null){notice('Pencil zuerst abheben.');return;}
    await finishInk();await saveQueue.catch(()=>{});
    if(!confirm('Abfrage beenden?'))return;
    await archiveDraftIfNeeded();
    data.quiz=null;storeData();
    selected.seen.clear();selected.history=[];
    updateQuizChrome();await advance();
  }
  function math(){const nodes=[$('cardQuestion'),...(selected.revealed?[$('cardAnswer'),$('cardBackground'),$('cardExample')]:[])];mathQueue=mathQueue.catch(()=>{}).then(async()=>{if(!window.MathJax?.typesetPromise)return;try{window.MathJax.typesetClear?.(nodes);await window.MathJax.typesetPromise(nodes);}catch(e){console.warn('MathJax',e)}});}
  async function showCard(id){await finishInk();await saveQueue.catch(()=>{});if(selected.current&&selected.current!==id)await archiveDraftIfNeeded();selected.current=id;selected.revealed=false;const card=byId.get(id);if(!card)return showEmpty();$('workspace').classList.remove('is-hidden');$('emptyState').classList.add('is-hidden');
    $('cardTopic').textContent=`${card.Bereich} · ${card.Typ}`;$('cardSource').textContent=card.Quelle?`Quelle: ${card.Quelle}`:'';$('cardQuestion').textContent=card.Frage;$('cardAnswer').textContent=card.Antwort;
    $('cardBackground').textContent=card.Hintergrund||'';
    $('cardExample').textContent=card.Beispiel||'';
    $('cardBackgroundSection').hidden=!card.Hintergrund;
    $('cardExampleSection').hidden=!card.Beispiel;
    $('cardBackgroundSection').open=false;$('cardExampleSection').open=false;
    $('showSolutionBtn').textContent='Musterlösung anzeigen';$('showSolutionBtn').setAttribute('aria-expanded','false');$('solutionContent').classList.add('is-hidden');$('positionLabel').textContent=`${filtered().length} Karten im Filter`;$('prevBtn').disabled=!!data.quiz?.active||!selected.history.length;quickActions();configureSheet();await loadInk(id);math();}
  function showEmpty(){selected.current=null;$('workspace').classList.add('is-hidden');$('emptyState').classList.remove('is-hidden');updateStats();}
  async function advance(){if(data.proofStudy?.active){await displayProof();return;}if(data.quiz?.active){
      const q=data.quiz;
      if(q.stage==='results'||q.index>=q.queue.length){await quizFinish();return;}
      updateQuizChrome();await showCard(q.queue[q.index]);return;
    }
    const next=eligible()[0];if(next)await showCard(next.id);else{await finishInk();await saveQueue.catch(()=>{});await archiveDraftIfNeeded();showEmpty();}updateStats();}
  async function nextCard(skipped=false){if(!selected.current)return;
    if(data.quiz?.active){if(skipped){await finishInk();await saveQueue.catch(()=>{});await snapshotAttempt('skip');await quizRate('wrong');}return;}
    const id=selected.current;await finishInk();await saveQueue.catch(()=>{});if(skipped){await snapshotAttempt('skip');}selected.seen.add(id);selected.history.push(id);await advance();}
  async function goBack(){if(!selected.history.length)return;await finishInk();await saveQueue.catch(()=>{});const previous=selected.history.pop();selected.seen.delete(previous);await showCard(previous);updateStats();}
  function planNext(id,rating){const old=data.progress[id]||{reps:0,interval:0,streak:0},DAY=86400000;let iv;
    if(rating==='wrong'){iv=10/1440;old.streak=0;}else if(rating==='partial'){iv=old.interval>=1?Math.max(1,Math.round(old.interval*1.2)):1;old.streak=0;}else{iv=old.interval>=1?Math.max(3,Math.round(old.interval*2.2)):3;old.streak=(old.streak||0)+1;}
    old.reps=(old.reps||0)+1;old.last=now();old.interval=iv;old.next=old.last+iv*DAY;old.lastRating=rating;data.progress[id]=old;storeData();}
  function uuid(prefix){return prefix+'-'+new Date().toISOString().replace(/[-:.TZ]/g,'')+'-'+Math.random().toString(36).slice(2,9);}
  // Nur ausdrücklich gestartete Aufnahmen archivieren Versuche für die Kontrolle.
  async function snapshotAttempt(rating){
    if(!data.recordingActive||!data.sessionId)return true;
    const c=byId.get(selected.current);if(!c)return false;
    const currentStrokes=ink.strokes.filter(stroke=>stroke.recordingId===data.sessionId&&!stroke.archivedAttemptId);
    const rec={id:uuid('attempt'),sessionId:data.sessionId,cardId:c.id,Frage:c.Frage,Antwort:c.Antwort,Bereich:c.Bereich,Typ:c.Typ,Quelle:c.Quelle,rating,at:new Date().toISOString(),strokes:clone(currentStrokes),height:cardSheetHeight(c.id)};
    const saved=await writeRecord('attempts',rec.id,rec);
    if(saved){
      if(db)memory.attempts.push(rec);
      for(const stroke of currentStrokes)stroke.archivedAttemptId=rec.id;
      if(currentStrokes.length)await saveInk();
      await saveQueue.catch(()=>{});
      recordingTouchedCards.delete(c.id);data.recordingTouchedCards=[...recordingTouchedCards];storeData();
    }
    return saved;
  }
  async function archiveDraftIfNeeded(){
    if(!data.recordingActive||!data.sessionId||!selected.current||!recordingTouchedCards.has(selected.current))return;
    await finishInk();await saveQueue.catch(()=>{});
    if(ink.strokes.some(stroke=>stroke.recordingId===data.sessionId&&!stroke.archivedAttemptId))return snapshotAttempt('draft');
    recordingTouchedCards.delete(selected.current);data.recordingTouchedCards=[...recordingTouchedCards];storeData();
  }
  async function archivePendingDrafts(){
    if(!data.recordingActive||!data.sessionId)return true;
    // Nach einem iPad-Neustart kann die letzte Skizze auf einer anderen Karte
    // liegen. Diese offenen Zeichnungen aus dem aktuellen Aufnahmelauf retten.
    for(const cardId of [...recordingTouchedCards]){
      const card=byId.get(cardId);
      if(!card)continue;
      const strokes=(await readRecord('sketches',cardId))||[];
      const fresh=Array.isArray(strokes)?strokes.filter(stroke=>stroke.recordingId===data.sessionId&&!stroke.archivedAttemptId):[];
      if(fresh.length){
        const rec={id:uuid('attempt'),sessionId:data.sessionId,cardId:card.id,Frage:card.Frage,Antwort:card.Antwort,Bereich:card.Bereich,Typ:card.Typ,Quelle:card.Quelle,rating:'draft',at:new Date().toISOString(),strokes:clone(fresh),height:cardSheetHeight(cardId)};
        if(!await writeRecord('attempts',rec.id,rec))return false;
        if(db)memory.attempts.push(rec);
        for(const stroke of fresh)stroke.archivedAttemptId=rec.id;
        if(!await writeRecord('sketches',cardId,strokes))return false;
      }
      recordingTouchedCards.delete(cardId);
      data.recordingTouchedCards=[...recordingTouchedCards];storeData();
    }
    return true;
  }
  let acting=false;
  async function grade(rating){
    if(acting||!selected.current||!selected.revealed)return;
    acting=true;
    try{
      await finishInk();await saveQueue.catch(()=>{});
      if(!await snapshotAttempt(rating)){notice('Aufnahme konnte nicht gespeichert werden. Bitte Backup erstellen.');return;}
      if(data.quiz?.active){await quizRate(rating);}else{planNext(selected.current,rating);await nextCard(false);}
    }finally{acting=false;}
  }
  function updateRecordingUI(){
    const active=!!data.recordingActive;
    $('recordingStartBtn').disabled=active;
    $('recordingStopBtn').disabled=!active;
    const rec=$('recordingStatus');
    rec.hidden=!active;
    rec.textContent=active?'● Aufnahme läuft':'';
    $('exportSessionBtn').disabled=active||!data.lastRecordingId;
    $('exportSessionBtn2').disabled=active||!data.lastRecordingId;
    $('exportSessionBtn').textContent=active?'Aufnahme läuft …':'Letzte Aufnahme exportieren';
  }
  async function startRecording(){
    if(data.recordingActive)return;
    await finishInk();await saveQueue.catch(()=>{});
    const session={id:uuid('session'),name:'Unbenannte Aufnahme',recording:true,startedAt:new Date().toISOString(),endedAt:null};
    if(!await writeRecord('sessions',session.id,session)){notice('Aufnahme konnte nicht gespeichert werden.');return;}
    data.sessionId=session.id;data.recordingActive=true;recordingTouchedCards.clear();data.recordingTouchedCards=[];
    storeData();updateRecordingUI();updateStats();
    notice('Aufnahme gestartet. Neue Stiftstriche werden jetzt für die Kontrolle gespeichert.');
  }
  async function stopRecording(){
    if(!data.recordingActive)return;
    if(ink.pointerId!==null){notice('Zum Beenden der Aufnahme zuerst den Pencil abheben.');return;}
    await finishInk();await saveQueue.catch(()=>{});await archiveDraftIfNeeded();
    if(!await archivePendingDrafts()){notice('Einige Entwürfe konnten nicht gespeichert werden. Aufnahme bleibt aktiv.');return;}
    const id=data.sessionId,session=await readRecord('sessions',id);
    if(!session){notice('Aufnahme nicht gefunden. Bitte Backup erstellen.');return;}
    session.endedAt=new Date().toISOString();
    if(!await writeRecord('sessions',id,session)){notice('Aufnahme konnte nicht beendet werden.');return;}
    data.recordingActive=false;data.lastRecordingId=id;data.sessionId=null;
    recordingTouchedCards.clear();data.recordingTouchedCards=[];
    storeData();updateRecordingUI();updateStats();
    recordingNamingId=id;
    $('recordingNameInput').value='HM3 Aufnahme '+new Date().toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    $('recordingNameDialog').showModal();
  }
  async function saveRecordingName(exportAfter=false){
    const id=recordingNamingId;if(!id)return;
    const session=await readRecord('sessions',id);if(!session)return;
    session.name=$('recordingNameInput').value.trim()||'Unbenannte Aufnahme';
    if(!await writeRecord('sessions',id,session)){notice('Name konnte nicht gespeichert werden.');return;}
    $('recordingNameDialog').close();recordingNamingId=null;
    await sessionList();notice('Aufnahme „'+session.name+'“ lokal gespeichert.');
    if(exportAfter)await exportSession(id);
  }
  async function updateSessionInfo(){updateRecordingUI();updateStats();}

  // Das Schreibblatt gehört zur Karte; das Ändern einer Karte verändert keine andere.
  function cardSheetHeight(id=selected.current){const n=Number(data.cardPrefs?.[id]?.sheetHeight);return Number.isFinite(n)&&n>=520?Math.min(n,4000):(Number(data.settings.sheetHeight)||800);}
  function configureSheet(){const h=cardSheetHeight(),style=data.settings.sheetStyle||'grid';$('sheetHeight').value=[520,800,1250,1850].includes(h)?String(h):'custom';$('sheetStyle').value=style;$('sheet').style.height=h+'px';$('sheet').className='sheet sheet-'+style;$('sheetLengthInfo').textContent=h+' px · pro Karte';$('extendSheetBtn').disabled=!selected.current||h>=4000;pen.style.touchAction='none';$('sheet').style.touchAction='none';resizeInk();}
  async function setCardSheetHeight(height){if(!selected.current)return;const h=Math.min(4000,Math.max(520,Math.round(height)));await finishInk();await saveQueue.catch(()=>{});const id=selected.current;data.cardPrefs[id]={...prefFor(id),sheetHeight:h};storeData();configureSheet();notice('Blattlänge gespeichert – deine bisherigen Skizzen bleiben erhalten.');}
  function resizeInk(){const r=pen.getBoundingClientRect();if(!r.width||!r.height)return;cssWidth=r.width;cssHeight=r.height;scale=cssWidth/1000;logicalHeight=cssHeight/scale;
    // Supersampling: deutlich feinere Kantenglättung als das bisherige DPR-Limit 2.
    // Auf sehr langen Blättern wird die Pixeldichte begrenzt, damit iPadOS
    // die Canvas-Speichergrenze nicht erreicht.
    const target=Math.max(devicePixelRatio||1,3);
    const density=Math.min(target,Math.sqrt(12000000/(cssWidth*cssHeight)));
    const dpr=Math.max(1,density);
    pen.width=Math.round(cssWidth*dpr);pen.height=Math.round(cssHeight*dpr);
    // Eraser preview is temporary UI: CSS-pixel resolution is enough.
    // High-DPI for BOTH canvases previously consumed up to 128 MB on iPad.
    eraserOverlay.width=Math.round(cssWidth);eraserOverlay.height=Math.round(cssHeight);
    ctx.setTransform(dpr*scale,0,0,dpr*scale,0,0);
    eraserCtx.setTransform(scale,0,0,scale,0,0);
    renderInk();renderEraserOverlay();
  }
  function coord(e,r=pen.getBoundingClientRect()){return {x:Math.max(0,Math.min(1000,(e.clientX-r.left)/scale)),y:Math.max(0,Math.min(logicalHeight,(e.clientY-r.top)/scale))};}
  const mid=(a,b)=>({x:(a.x+b.x)*0.5,y:(a.y+b.y)*0.5});
  function strokePath(c,s){
    const p=s.points||[];if(!p.length)return;
    c.lineWidth=s.width||2;c.strokeStyle=s.color||'#182231';c.fillStyle=c.strokeStyle;
    c.lineJoin='round';c.lineCap='round';
    if(p.length===1){c.beginPath();c.arc(p[0].x,p[0].y,(s.width||2)/2,0,Math.PI*2);c.fill();return;}
    c.beginPath();c.moveTo(p[0].x,p[0].y);
    const start=mid(p[0],p[1]);c.lineTo(start.x,start.y);
    for(let i=1;i<p.length-1;i++){
      const next=mid(p[i],p[i+1]);
      c.quadraticCurveTo(p[i].x,p[i].y,next.x,next.y);
    }
    c.lineTo(p[p.length-1].x,p[p.length-1].y);
    c.stroke();
  }
  function renderInk(){ctx.clearRect(0,0,1000,logicalHeight);for(const s of ink.strokes)strokePath(ctx,s);if(ink.active)strokePath(ctx,ink.active);}
  // Nur den neuen Teil der geglätteten Kurve zeichnen (keine vollständige
  // Neuberechnung aller vorherigen Stiftstriche pro Apple-Pencil-Bewegung).
  function drawSmoothSegment(points,s){
    const n=points.length;if(n<2)return;
    ctx.strokeStyle=s.color;ctx.lineWidth=s.width;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();
    if(n===2){const m=mid(points[0],points[1]);ctx.moveTo(points[0].x,points[0].y);ctx.lineTo(m.x,m.y);}
    else{
      const a=points[n-3],b=points[n-2],d=points[n-1];
      const m=mid(a,b),next=mid(b,d);
      ctx.moveTo(m.x,m.y);ctx.quadraticCurveTo(b.x,b.y,next.x,next.y);
    }
    ctx.stroke();
  }
  function distPointSegment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy,t=den?Math.min(1,Math.max(0,((p.x-a.x)*dx+(p.y-a.y)*dy)/den)):0;return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));}
  // Ganzstrich-Radierer: jeder Stiftkontakt bleibt ein eigener Stroke, selbst
  // wenn die Wege sich schneiden. Ein Radierzug kann mehrere Strokes kreuzen.
  function segmentCross(a,b,c,d){
    const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
    const ab1=cross(a,b,c),ab2=cross(a,b,d);
    const cd1=cross(c,d,a),cd2=cross(c,d,b);
    if(Math.abs(ab1)<1e-8&&Math.abs(ab2)<1e-8&&Math.abs(cd1)<1e-8&&Math.abs(cd2)<1e-8){
      return Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))&&
             Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))<=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y));
    }
    return ((ab1>=0&&ab2<=0)||(ab1<=0&&ab2>=0))&&
           ((cd1>=0&&cd2<=0)||(cd1<=0&&cd2>=0));
  }
  function segmentsDistance(a,b,c,d){
    if(segmentCross(a,b,c,d))return 0;
    return Math.min(distPointSegment(a,c,d),distPointSegment(b,c,d),
                    distPointSegment(c,a,b),distPointSegment(d,a,b));
  }
  // Bounding boxes are computed once per immutable Pencil stroke.
  // This keeps erasing smooth even on long study sheets.
  const strokeBounds=new WeakMap();
  function boundsForStroke(stroke){
    const saved=strokeBounds.get(stroke);if(saved)return saved;
    const pts=stroke.points||[];
    let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
    for(const p of pts){if(p.x<left)left=p.x;if(p.x>right)right=p.x;if(p.y<top)top=p.y;if(p.y>bottom)bottom=p.y;}
    const bounds={left,right,top,bottom};
    strokeBounds.set(stroke,bounds);return bounds;
  }
  function eraserHitsStroke(from,to,stroke,radius){
    const points=stroke.points||[];
    if(!points.length)return false;
    const reach=radius+(stroke.width||2)*.5;
    const minX=Math.min(from.x,to.x)-reach,maxX=Math.max(from.x,to.x)+reach;
    const minY=Math.min(from.y,to.y)-reach,maxY=Math.max(from.y,to.y)+reach;
    const bounds=boundsForStroke(stroke);
    if(bounds.right<minX||bounds.left>maxX||bounds.bottom<minY||bounds.top>maxY)return false;
    // Ignore strokes whose bounding boxes never reach the current eraser path.
    if(points.length===1)return distPointSegment(points[0],from,to)<=reach;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];
      if(Math.max(a.x,b.x)<minX||Math.min(a.x,b.x)>maxX||
         Math.max(a.y,b.y)<minY||Math.min(a.y,b.y)>maxY)continue;
      if(segmentsDistance(from,to,a,b)<=reach)return true;
    }
    return false;
  }
  function eraseSweep(from,to){
    const radius=8/scale; // 8 CSS px brush radius, independent of zoom.
    let removed=0;
    for(let i=ink.strokes.length-1;i>=0;i--){
      if(eraserHitsStroke(from,to,ink.strokes[i],radius)){
        ink.strokes.splice(i,1);removed++;
      }
    }
    if(removed){ink.erasedInGesture=true;renderInk();}
    return removed;
  }
  function renderEraserOverlay(){
    eraserCtx.clearRect(0,0,1000,logicalHeight);
    if(ink.tool!=='eraser'||inkMode==='scroll')return;
    const points=ink.eraserTrail||[];
    const tip=ink.eraserTip||points[points.length-1];
    if(!tip)return;
    if(points.length>1){
      eraserCtx.save();
      eraserCtx.strokeStyle='rgba(226,113,45,.64)';
      eraserCtx.lineWidth=7/scale;
      eraserCtx.lineCap='round';eraserCtx.lineJoin='round';
      eraserCtx.beginPath();eraserCtx.moveTo(points[0].x,points[0].y);
      for(let i=1;i<points.length;i++)eraserCtx.lineTo(points[i].x,points[i].y);
      eraserCtx.stroke();eraserCtx.restore();
    }
    // Eraser cursor: small tilted two-tone rubber icon at the Pencil tip.
    eraserCtx.save();
    eraserCtx.translate(tip.x,tip.y);
    eraserCtx.rotate(-Math.PI/5);
    const w=22/scale,h=14/scale;
    eraserCtx.fillStyle='rgba(255,255,255,.95)';
    eraserCtx.fillRect(-w/2-1/scale,-h/2-1/scale,w+2/scale,h+2/scale);
    eraserCtx.fillStyle='#df7835';eraserCtx.fillRect(-w/2,-h/2,w*.62,h);
    eraserCtx.fillStyle='#f2c2a0';eraserCtx.fillRect(w*.12,-h/2,w*.38,h);
    eraserCtx.strokeStyle='#9e4d22';eraserCtx.lineWidth=1.5/scale;
    eraserCtx.strokeRect(-w/2,-h/2,w,h);
    eraserCtx.restore();
  }
  function finishInk(){
    if(!ink.active&&!ink.erasing)return Promise.resolve();
    let changed=false;
    if(ink.active){ink.strokes.push(ink.active);ink.active=null;changed=true;}
    if(ink.erasing){
      ink.erasing=false;
      changed=changed||ink.strokes.length!==(ink.erasedBefore?.length||0);
      ink.erasedBefore=null;ink.erasedInGesture=false;
      ink.eraserTrail=[];ink.eraserTip=null;ink.lastEraserPoint=null;
      renderEraserOverlay();
    }
    if(changed){renderInk();return saveInk();}
    return Promise.resolve();
  }
  // V11: Schreibfläche wird bei Scrollpositionen nicht mehr umpositioniert.
  // Auto und Schreiben sperren ausschließlich die native Seitennavigation.
  // Stift: zeichnen; Finger auf dem Blatt: ignorieren; Finger auf Buttons: klicken.
  // Alle Scrollbuttons links führen ausschließlich programmgesteuertes Scrollen aus.
  let pageLocked=false;
  function refreshInkModeUI(){
    for(const [id,mode] of [['inkAutoBtn','auto'],['inkModeBtn','write'],['inkScrollBtn','scroll']]){
      const btn=$(id),active=inkMode===mode;
      btn.classList.toggle('is-selected',active);btn.setAttribute('aria-pressed',String(active));
    }
    document.body.classList.toggle('ink-scroll',inkMode==='scroll');

    const action='none';
    pen.style.touchAction=action;$('sheet').style.touchAction=action;
  }
  function lockPage(){
    if(pageLocked)return;
    // Kein position:fixed, kein top:-scrollY! Gerade das erzeugte bei
    // gescrollter Seite versetzte y-Werte und lange vertikale Phantomstriche.
    document.documentElement.classList.add('ink-locked');
    document.body.classList.add('ink-locked');
    pageLocked=true;
  }
  function unlockPage(){
    if(!pageLocked)return;
    document.documentElement.classList.remove('ink-locked');
    document.body.classList.remove('ink-locked');
    pageLocked=false;
  }
  function setInkMode(mode){
    if(!['auto','write','scroll'].includes(mode))return;
    if(ink.pointerId!==null)endStroke(ink.pointerId,ink.inputSource);
    inkMode=mode;
    lockPage();
    data.settings.inputMode=mode;storeData();refreshInkModeUI();
  }
  function beginStroke(point,id,source){
    if(!selected.current||inkMode==='scroll'||ink.pointerId!==null)return false;
    // Auch wenn ein Pencil erst nach programmgesteuertem Scrollen aufsetzt:
    // keine Änderung des Layouts während des Kontakts.
    ink.strokeRect=pen.getBoundingClientRect();
    ink.pointerId=id;ink.inputSource=source;
    ink.undo.push(ink.strokes.slice());if(ink.undo.length>35)ink.undo.shift();ink.redo=[];
    if(ink.tool==='eraser'){
      ink.erasing=true;ink.erasedInGesture=false;ink.erasedBefore=ink.strokes.slice();
      ink.eraserTrail=[point];ink.eraserTip=point;ink.lastEraserPoint=point;
      eraseSweep(point,point);renderEraserOverlay();
    }else{
      ink.active={color:ink.color,width:ink.width/scale,points:[point],recordingId:data.recordingActive?data.sessionId:null};
      ctx.fillStyle=ink.color;ctx.beginPath();ctx.arc(point.x,point.y,ink.active.width/2,0,Math.PI*2);ctx.fill();
    }
    return true;
  }
  function continueStroke(point,id,source){
    if(ink.pointerId!==id||ink.inputSource!==source)return;
    if(ink.erasing){
      const prev=ink.lastEraserPoint||point;
      eraseSweep(prev,point);
      ink.eraserTrail.push(point);if(ink.eraserTrail.length>500)ink.eraserTrail.shift();ink.eraserTip=point;ink.lastEraserPoint=point;
      renderEraserOverlay();return;
    }
    if(!ink.active)return;
    const last=ink.active.points[ink.active.points.length-1];
    if(last.x===point.x&&last.y===point.y)return;
    ink.active.points.push(point);drawSmoothSegment(ink.active.points,ink.active);
  }
  function endStroke(id,source){
    if(ink.pointerId!==id||ink.inputSource!==source)return;
    ink.pointerId=null;ink.inputSource=null;ink.strokeRect=null;
    finishInk();
    // Auto bleibt zwischen den Kontakten gesperrt; keine Palm-Scroll-Störung.
  }
  function scrollSheet(direction){
    if(ink.pointerId!==null)endStroke(ink.pointerId,ink.inputSource);
    const doc=document.scrollingElement||document.documentElement;
    const distance=Math.max(230,Math.round((window.innerHeight||700)*0.68));
    const target=Math.max(0,Math.min(Math.max(0,doc.scrollHeight-(window.innerHeight||700)),(doc.scrollTop||0)+direction*distance));
    // Scrollen ist sogar mit overflow:hidden möglich, wenn JS scrollTop setzt.
    doc.scrollTop=target;
    // Safari/Web-App: direkte Fenster-Navigation synchronisiert den Viewport.
    if(typeof window.scrollTo==='function')window.scrollTo(0,target);
    updateScrollRail();
  }
  const isStylus=t=>t.touchType==='stylus';
  pen.addEventListener('touchstart',e=>{
    if(inkMode==='scroll'||!selected.current)return;
    const stylus=Array.from(e.changedTouches||[]).find(isStylus);
    // Finger/Handballen auf dem gesamten Blatt erzeugen niemals Bewegung.
    if(e.cancelable)e.preventDefault();
    if(!stylus)return;
    const rect=pen.getBoundingClientRect();
    beginStroke(coord(stylus,rect),'touch-'+stylus.identifier,'touch');
  },{passive:false});
  pen.addEventListener('touchmove',e=>{
    if(inkMode==='scroll')return;
    if(e.cancelable)e.preventDefault();
    if(ink.inputSource!=='touch')return;
    const t=Array.from(e.changedTouches||[]).find(t=>'touch-'+t.identifier===ink.pointerId);
    if(t)continueStroke(coord(t,ink.strokeRect||pen.getBoundingClientRect()),ink.pointerId,'touch');
  },{passive:false});
  for(const name of ['touchend','touchcancel'])pen.addEventListener(name,e=>{
    if(ink.inputSource!=='touch')return;
    const t=Array.from(e.changedTouches||[]).find(t=>'touch-'+t.identifier===ink.pointerId);
    if(t)endStroke(ink.pointerId,'touch');
  },{passive:false});
  pen.addEventListener('pointerdown',e=>{
    if(inkMode==='scroll'||!selected.current)return;
    if(e.pointerType!=='pen')return; // Auto und Schreiben sind immer Pencil-only.
    if(e.cancelable)e.preventDefault();
    const rect=pen.getBoundingClientRect();
    if(!beginStroke(coord(e,rect),e.pointerId,'pointer'))return;
    try{pen.setPointerCapture(e.pointerId);}catch{}
  });
  pen.addEventListener('pointermove',e=>{
    if(ink.pointerId===null&&ink.tool==='eraser'&&e.pointerType==='pen'&&inkMode!=='scroll'){
      ink.eraserTip=coord(e);renderEraserOverlay();return;
    }
    if(ink.pointerId!==e.pointerId||ink.inputSource!=='pointer')return;
    if(e.cancelable)e.preventDefault();
    const rect=ink.strokeRect||pen.getBoundingClientRect();
    for(const ev of e.getCoalescedEvents?.()||[e])continueStroke(coord(ev,rect),e.pointerId,'pointer');
  });
  for(const name of ['pointerup','pointercancel'])pen.addEventListener(name,e=>endStroke(e.pointerId,'pointer'));
  pen.addEventListener('pointerleave',()=>{if(ink.pointerId===null){ink.eraserTip=null;renderEraserOverlay();}});
  pen.addEventListener('lostpointercapture',()=>{if(ink.inputSource==='pointer')endStroke(ink.pointerId,'pointer');});
  // Ein Touchstart auf normalen Bedienelementen bleibt klickbar; nur Dragging
  // sperren. In geöffneten Dialogen Listen/Editoren trotzdem frei scrollen.
  const inDialog=e=>!!e.target?.closest?.('dialog[open]');
  document.addEventListener('touchmove',e=>{
    if(pageLocked&&!inDialog(e)&&e.cancelable)e.preventDefault();
  },{passive:false,capture:true});
  document.addEventListener('gesturestart',e=>{
    if(pageLocked&&!inDialog(e)&&e.cancelable)e.preventDefault();
  },{passive:false});
  document.addEventListener('wheel',e=>{
    if(pageLocked&&!inDialog(e)&&e.cancelable)e.preventDefault();
  },{passive:false,capture:true});
  $('inkAutoBtn').addEventListener('click',()=>setInkMode('auto'));
  $('inkModeBtn').addEventListener('click',()=>setInkMode('write'));
  $('inkScrollBtn').addEventListener('click',()=>setInkMode('scroll'));
  $('scrollUpBtn').addEventListener('click',()=>scrollSheet(-1));
  $('scrollDownBtn').addEventListener('click',()=>scrollSheet(1));
  // V18: unsichtbare Touch-Scrollzone: die linken 20% des Viewports.
  // Alle Touchstarts außerhalb der Zone bleiben ohne Scrollwirkung.
  // Ein Pencilstrich bleibt geschützt: während des Kontakts nicht scrollen.
  const LEFT_SCROLL_RATIO=.20;
  let edgeScroll=null;
  const isFinger=t=>t.touchType!=='stylus';
  document.addEventListener('touchstart',e=>{
    if(inDialog(e)||ink.pointerId!==null)return;
    const finger=Array.from(e.changedTouches||[]).find(t=>isFinger(t)&&t.clientX<=(window.innerWidth||document.documentElement.clientWidth)*LEFT_SCROLL_RATIO);
    if(finger)edgeScroll={id:finger.identifier,lastY:finger.clientY,startY:finger.clientY,moved:false};
  },{passive:true,capture:true});
  document.addEventListener('touchmove',e=>{
    if(!edgeScroll||ink.pointerId!==null||inDialog(e))return;
    const finger=Array.from(e.changedTouches||[]).find(t=>t.identifier===edgeScroll.id&&isFinger(t));
    if(!finger)return;
    if(!edgeScroll.moved&&Math.abs(finger.clientY-edgeScroll.startY)<5)return;
    const delta=edgeScroll.lastY-finger.clientY;
    edgeScroll.lastY=finger.clientY;edgeScroll.moved=true;
    if(e.cancelable)e.preventDefault();
    if(!delta)return;
    const doc=document.scrollingElement||document.documentElement;
    const limit=Math.max(0,doc.scrollHeight-(window.innerHeight||700));
    const top=Math.min(limit,Math.max(0,(doc.scrollTop||0)+delta));
    doc.scrollTop=top;
    if(typeof window.scrollTo==='function')window.scrollTo(0,top);
  },{passive:false,capture:true});
  for(const name of ['touchend','touchcancel'])document.addEventListener(name,e=>{
    if(edgeScroll&&Array.from(e.changedTouches||[]).some(t=>t.identifier===edgeScroll.id))edgeScroll=null;
  },{passive:true,capture:true});
  function updateScrollRail(){} // kept for older arrow-button handler
  // Startet mit dauerhaftem Pencil-only-Lock. Keine Layoutverschiebung!
  inkMode='auto';lockPage();refreshInkModeUI();
  function tool(t){ink.tool=t;ink.eraserTip=null;ink.eraserTrail=[];renderEraserOverlay();for(const [id,val] of [['penBtn','pen'],['eraserBtn','eraser']]){$(id).classList.toggle('is-active',t===val);$(id).setAttribute('aria-pressed',t===val?'true':'false');}}
  function undo(){if(!ink.undo.length)return;ink.redo.push(ink.strokes.slice());ink.strokes=ink.undo.pop();renderInk();saveInk();}
  function redo(){if(!ink.redo.length)return;ink.undo.push(ink.strokes.slice());ink.strokes=ink.redo.pop();renderInk();saveInk();}

  function imageForAttempt(a){
    const strokes=a.strokes||[];
    if(!strokes.length)return Promise.resolve(null);
    let maxY=0;
    for(const stroke of strokes)for(const point of stroke.points||[])if(point.y>maxY)maxY=point.y;
    // Only export written content plus margin. Long, extended sheets must not
    // lose their lower rows because of the former fixed 9500-pixel cap.
    const logicalH=Math.max(480,maxY+100);
    let w=Math.min(1600,Math.floor(Math.sqrt(12000000*1000/logicalH)),Math.floor(8900*1000/logicalH));
    w=Math.max(600,w);
    const sc=w/1000,h=Math.ceil(logicalH*sc);
    if(w*h>16000000)throw Error('Skizze ist zu groß für einen sicheren PNG-Export');
    const c=document.createElement('canvas');c.width=w;c.height=h;
    const x=c.getContext('2d');
    if(!x)throw Error('PNG-Zeichenfläche konnte nicht erstellt werden');
    x.fillStyle='#fff';x.fillRect(0,0,w,h);
    x.strokeStyle='#e9edf1';x.lineWidth=1;
    const grid=Math.max(16,Math.round(22*sc));
    for(let i=0;i<w;i+=grid){x.beginPath();x.moveTo(i,0);x.lineTo(i,h);x.stroke();}
    for(let i=0;i<h;i+=grid){x.beginPath();x.moveTo(0,i);x.lineTo(w,i);x.stroke();}
    x.scale(sc,sc);
    for(const stroke of strokes)strokePath(x,stroke);
    return new Promise((resolve,reject)=>c.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG-Erstellung fehlgeschlagen')),'image/png'));
  }
  function filenameFor(a,i){return `skizzen/${String(i+1).padStart(3,'0')}_${a.cardId.replace(/[^a-zA-Z0-9_-]/g,'_')}.png`;}
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  const encoder=new TextEncoder();const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let j=0;j<8;j++)c=c&1?(c>>>1)^0xedb88320:c>>>1;return c>>>0;});
  function checksum(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
  function u16(d,o,n){d.setUint16(o,n,true);}function u32(d,o,n){d.setUint32(o,n>>>0,true);}
  // ZIP STORE: no CDN or compression library; PNG already compressed, works offline.
  async function zip(entries){let parts=[],central=[],offset=0;for(const [name,value] of entries){const n=encoder.encode(name),bytes=value instanceof Uint8Array?value:new Uint8Array(await value.arrayBuffer()),crc=checksum(bytes);const local=new Uint8Array(30+n.length),v=new DataView(local.buffer);u32(v,0,0x04034b50);u16(v,4,20);u16(v,6,0x0800);u16(v,8,0);u32(v,14,crc);u32(v,18,bytes.length);u32(v,22,bytes.length);u16(v,26,n.length);local.set(n,30);parts.push(local,bytes);
    const dir=new Uint8Array(46+n.length),dv=new DataView(dir.buffer);u32(dv,0,0x02014b50);u16(dv,4,20);u16(dv,6,20);u16(dv,8,0x0800);u16(dv,10,0);u32(dv,16,crc);u32(dv,20,bytes.length);u32(dv,24,bytes.length);u16(dv,28,n.length);u32(dv,42,offset);dir.set(n,46);central.push(dir);offset+=local.length+bytes.length;}
    const dirsize=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);u32(e,0,0x06054b50);u16(e,8,entries.length);u16(e,10,entries.length);u32(e,12,dirsize);u32(e,16,offset);return new Blob([...parts,...central,end],{type:'application/zip'});}
  function ratingLabel(r){return {wrong:'Nicht gewusst',partial:'Teilweise',good:'Gewusst',skip:'Übersprungen',draft:'Noch offen'}[r]||r;}
  function reportHTML(attempts,images,session){const rows=attempts.map((a,i)=>`<section><header><strong>${i+1}. ${safeText(a.Bereich)} · ${safeText(a.Typ)}</strong><span>${safeText(ratingLabel(a.rating))} · ${safeText(new Date(a.at).toLocaleString('de-DE'))}</span></header><h2>${safeText(a.Frage)}</h2><p class="source">${safeText(a.Quelle)}</p>${images[i]?`<img src="${safeText(images[i])}" alt="Handschriftliche Lösung ${i+1}">`:'<p class="none">Keine Handschrift zu diesem Versuch gespeichert.</p>'}<details><summary>Musterantwort (als LaTeX-Text)</summary><pre>${safeText(a.Antwort)}</pre></details></section>`).join('');return `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>HM3 – Aufnahme</title><style>body{font:15px/1.6 system-ui,Arial;color:#1c2b3a;max-width:900px;margin:36px auto;padding:0 16px}h1{margin-bottom:4px}small,.source,.none{color:#657387}section{page-break-inside:avoid;border:1px solid #ddd;border-radius:8px;margin:22px 0;padding:20px}section header{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}section header span{color:#536577}h2{font-size:18px}img{max-width:100%;border:1px solid #eee}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}details{margin-top:15px}</style><h1>${safeText(session.name||'HM3-Aufnahme')}</h1><small>Beginn: ${safeText(new Date(session.startedAt).toLocaleString('de-DE'))} · ${attempts.length} Versuche · Einschätzung durch Lernenden</small><p>Die folgenden Skizzen sind unveränderte handschriftliche Antworten. Die Musterlösung wurde nicht automatisch bewertet.</p>${rows}</html>`;}
  let exporting=false;
  async function exportSession(sessionId=data.lastRecordingId){if(exporting)return;if(!sessionId){notice('Es gibt noch keine gespeicherte Aufnahme.');return;}exporting=true;$('exportSessionBtn').disabled=true;try{await finishInk();await saveQueue.catch(()=>{});const ses=await readRecord('sessions',sessionId);if(!ses)throw Error('Aufnahme nicht gefunden');const attempts=(await listRecords('attempts')).filter(x=>x.sessionId===sessionId).sort((a,b)=>a.at.localeCompare(b.at));
    if(data.recordingActive&&sessionId===data.sessionId&&selected.current){const c=byId.get(selected.current),fresh=ink.strokes.filter(stroke=>stroke.recordingId===sessionId&&!stroke.archivedAttemptId);if(fresh.length)attempts.push({id:'draft',sessionId,cardId:c.id,Frage:c.Frage,Antwort:c.Antwort,Bereich:c.Bereich,Typ:c.Typ,Quelle:c.Quelle,rating:'draft',at:new Date().toISOString(),strokes:clone(fresh),height:cardSheetHeight(c.id)});}
    if(!attempts.length){notice('In dieser Aufnahme sind noch keine Lösungen vorhanden.');return;}const files=[],images=[];
    for(let i=0;i<attempts.length;i++){const b=await imageForAttempt(attempts[i]);if(b){const path=filenameFor(attempts[i],i);files.push([path,b]);images.push(path);}else images.push(null);}
    const result={format:'hm3-study-session',version:2,exportedAt:new Date().toISOString(),session:ses,attempts:attempts.map((a,i)=>({...a,sketchImage:images[i]})),cardsInDeck:cards.length,notesIncluded:'Als PNG-Bilder und editierbare Strichdaten in JSON'};
    const entries=[['LERNDURCHGANG.html',encoder.encode(reportHTML(attempts,images,ses))],['lerndurchgang.json',encoder.encode(JSON.stringify(result,null,2))],['HINWEIS.txt',encoder.encode('HM3 Stiftkarten: Im Ordner skizzen liegen PNG-Bilder deiner handschriftlichen Lösungen. Lade diese ZIP-Datei bei ChatGPT hoch und bitte um die Prüfung aller Aufgaben. Die App führt keine automatische Bewertung aus.\n')],...files];
    const filename=(ses.name||'HM3-Aufnahme').replace(/[^a-zA-Z0-9 _-]/g,'').trim().replace(/\s+/g,'_').slice(0,55)||'HM3-Aufnahme';download(await zip(entries),filename+'_'+sessionId.slice(-7)+'.zip');notice(`Durchgang exportiert: ${attempts.length} Versuche, ${files.length} Skizzen.`);
  }catch(e){console.error('ZIP export',e);notice('Export fehlgeschlagen: '+e.message);}finally{exporting=false;updateRecordingUI();}}
  async function exportBackup(){
    if(ink.pointerId!==null){notice('Zum Sichern zuerst den Pencil abheben.');return;}
    try{
      await finishInk();await saveQueue.catch(()=>{});
      if(storageError&&db)throw Error('Speicherfehler erkannt – bitte zuerst die Datenbank prüfen');
      const sketches=await getAllSketches();
      const attempts=db?await idb('attempts','getAll'):await listRecords('attempts');
      const sessions=db?await idb('sessions','getAll'):await listRecords('sessions');
      const payload={app:'HM3 Stiftkarten',version:2,exportedAt:new Date().toISOString(),data,sketches,attempts,sessions};
      download(new Blob([JSON.stringify(payload)],{type:'application/json'}),'HM3-Gesamtbackup-'+new Date().toISOString().slice(0,10)+'.json');
      notice('Vollständiges Gesamtbackup erstellt.');
    }catch(e){console.error('Backup export',e);status('Backup unvollständig – nicht gespeichert',true);notice('Backup fehlgeschlagen: '+e.message);}
  }
  async function importBackup(file){try{const input=JSON.parse(await file.text());if(input.app!=='HM3 Stiftkarten')throw Error('Keine HM3-Datensicherung');
    if(input.version!==1&&input.version!==2)throw Error('Unbekannte Backup-Version');
    const rawSketches=input.version===1?(input.notes||{}):(input.sketches||{});
    if(!input.data||typeof input.data!=='object'||Array.isArray(input.data)||!rawSketches||typeof rawSketches!=='object'||Array.isArray(rawSketches)||Object.values(rawSketches).some(x=>!Array.isArray(x)))
      throw Error('Backup unvollständig oder beschädigt – vorhandene Daten bleiben erhalten');
    if(input.version===2&&(!Array.isArray(input.attempts)||!Array.isArray(input.sessions)||
      input.attempts.some(x=>!x||typeof x.id!=='string')||input.sessions.some(x=>!x||typeof x.id!=='string')))
      throw Error('Aufnahme-Archive unvollständig – vorhandene Daten bleiben erhalten');
    if(!confirm('Backup wiederherstellen? Bestehende Bewertungen und Notizen werden überschrieben. Erstelle vorher ein eigenes Backup.'))return;
    await finishInk();await saveQueue.catch(()=>{});let sketches,attempts=[],sessions=[];if(input.version===1){sketches=input.notes||{};data={...data,progress:input.data?.progress||{},cardPrefs:{},settings:{...data.settings,pencilOnly:input.data?.settings?.penOnly??true,sheetStyle:input.data?.settings?.paperStyle||'grid',sheetHeight:input.data?.settings?.paperHeight||800}};}else if(input.version===2){sketches=input.sketches||{};attempts=input.attempts||[];sessions=input.sessions||[];data={...data,...input.data,cardPrefs:input.data?.cardPrefs||{},settings:{...data.settings,...(input.data?.settings||{})}};}else throw Error('Unbekannte Backup-Version');
    if(db){for(const store of ['sketches','attempts','sessions'])await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}else{memory.sketches.clear();memory.attempts=[];memory.sessions=[];
      // Alte Fallback-Archive dürfen nach einem Restore nicht wieder auftauchen.
      for(const key of ['hm3-fallback-attempts','hm3-fallback-sessions'])localStorage.removeItem(key);
      for(const c of cards)localStorage.removeItem('hm3-note-'+c.id);
    }
    for(const [id,strokes] of Object.entries(sketches))if(Array.isArray(strokes)&&!await writeRecord('sketches',id,strokes))throw Error('Notiz konnte nicht gespeichert werden: '+id);
    memory.attempts=[];for(const entry of attempts){if(!entry||typeof entry.id!=='string'||!await writeRecord('attempts',entry.id,entry))throw Error('Versuch konnte nicht gespeichert werden');if(db)memory.attempts.push(entry);}
    memory.sessions=[];for(const entry of sessions){if(!entry||typeof entry.id!=='string'||!await writeRecord('sessions',entry.id,entry))throw Error('Aufnahme konnte nicht gespeichert werden');if(db)memory.sessions.push(entry);}
    if(!data.recordingActive){data.sessionId=null;data.recordingTouchedCards=[];}recordingTouchedCards=new Set(data.recordingTouchedCards||[]);storeData();rebuildCards();renderLibraryIfOpen();selected.seen.clear();selected.history=[];configureSheet();await advance();await updateSessionInfo();$('settingsDialog').close();notice('Backup wiederhergestellt.');
  }catch(e){console.error(e);notice('Import fehlgeschlagen: '+e.message);}}
  async function deleteRecording(id){
    const record=await readRecord('sessions',id);
    if(!record||data.recordingActive&&data.sessionId===id)return;
    if(!confirm('Aufnahme „'+(record.name||'Unbenannt')+'“ und alle zugehörigen Kontrollversuche wirklich löschen? Deine normalen Pencil-Notizen und Bewertungen bleiben erhalten.'))return;
    const affected=memory.attempts.filter(x=>x.sessionId===id);
    try{
      if(db){
        for(const attempt of affected)await idb('attempts','delete',attempt.id);
        await idb('sessions','delete',id);
      }else{
        const attempts=memory.attempts.filter(x=>x.sessionId!==id);
        const sessions=memory.sessions.filter(x=>x.id!==id);
        localStorage.setItem('hm3-fallback-attempts',JSON.stringify(attempts));
        localStorage.setItem('hm3-fallback-sessions',JSON.stringify(sessions));
        memory.sessions=sessions;
      }
      memory.attempts=memory.attempts.filter(x=>x.sessionId!==id);
      if(data.lastRecordingId===id){
        const remaining=(await listRecords('sessions')).filter(x=>x.endedAt).sort((x,y)=>y.startedAt.localeCompare(x.startedAt));
        data.lastRecordingId=remaining[0]?.id||null;
      }
      storeData();await sessionList();updateRecordingUI();notice('Aufnahme und '+affected.length+' Kontrollversuche gelöscht.');
    }catch(e){console.error('Recording delete',e);status('Löschen unvollständig – Backup erstellen',true);notice('Aufnahme konnte nicht vollständig gelöscht werden.');}
  }
  async function sessionList(){
    const list=(await listRecords('sessions')).sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
    $('sessionList').replaceChildren();
    for(const ses of list){
      const entries=memory.attempts.filter(a=>a.sessionId===ses.id);
      const row=document.createElement('div'),info=document.createElement('div'),buttons=document.createElement('div');
      info.className='recording-row-info';buttons.className='recording-row-actions';
      const title=document.createElement('strong');title.textContent=ses.name||(ses.recording?'Unbenannte Aufnahme':'Früherer Lerndurchgang');
      const meta=document.createElement('small');meta.textContent=dateString(ses.startedAt)+' · '+entries.length+' Versuche'+(ses.endedAt?'':' · läuft');
      info.append(title,meta);
      const exportBtn=document.createElement('button');exportBtn.className='button';exportBtn.textContent='ZIP exportieren';exportBtn.disabled=!entries.length;exportBtn.onclick=()=>exportSession(ses.id);
      const deleteBtn=document.createElement('button');
      deleteBtn.className='button recording-delete';
      deleteBtn.textContent='Löschen';deleteBtn.setAttribute('aria-label','Aufnahme '+(ses.name||'Unbenannt')+' löschen');
      deleteBtn.disabled=data.recordingActive&&data.sessionId===ses.id;
      deleteBtn.addEventListener('click',()=>deleteRecording(ses.id));
      buttons.append(exportBtn,deleteBtn);row.append(info,buttons);$('sessionList').append(row);
    }
    if(!list.length)$('sessionList').textContent='Noch keine Aufnahmen vorhanden.';
  }
  // Offline-Paket ist die vollständige App-Shell; Lernstände bleiben ausschließlich
  // in IndexedDB/localStorage und werden NIE in den App-Cache geschrieben.
  let offlinePrepared=false;
  function setNetworkState(){
    const el=$('networkStatus');if(!el)return;
    const online=navigator.onLine;
    el.classList.toggle('is-offline',!online);
    el.classList.remove('is-warning');
    el.textContent=online?(offlinePrepared?'Online · Offline bereit':'Online · Offline wird vorbereitet'):(offlinePrepared?'Offline · Lernen möglich':'Offline · Daten prüfen');
  }
  async function prepareOffline(showMessage=false){
    const label=$('offlineSaveStatus');
    try{
      if(!('caches' in window))throw Error('Offline-Speicher ist in diesem Browser nicht verfügbar.');
      const cache=await caches.open(OFFLINE_CACHE);
      if(navigator.onLine){
        if(showMessage)label.textContent='Speichere die App-Dateien einschließlich Formeln und Karten …';
        await cache.addAll(OFFLINE_FILES);
      }
      const found=await Promise.all(OFFLINE_FILES.map(file=>caches.match(new URL(file,location.href),{ignoreSearch:true})));
      offlinePrepared=found.every(Boolean);
      if(showMessage)label.textContent=offlinePrepared?'Offline-Dateien vollständig gespeichert. Du kannst nun ohne WLAN lernen.':'Einige Dateien fehlen noch. Bitte bei Internetverbindung erneut versuchen.';
      setNetworkState();
      return offlinePrepared;
    }catch(error){
      console.warn('Offline cache',error);offlinePrepared=false;
      setNetworkState();
      if(showMessage)label.textContent='Offline-Sicherung fehlgeschlagen: '+error.message;
      return false;
    }
  }
  async function checkForUpdates(force=false){
    if(!navigator.onLine||checkingUpdates||(!force&&now()-lastUpdateCheck<30*60*1000))return;
    checkingUpdates=true;lastUpdateCheck=now();
    try{
      const response=await fetch('./version.json?check='+Date.now(),{cache:'no-store'});
      if(!response.ok)throw Error('Versionsprüfung: HTTP '+response.status);
      const available=await response.json();
      if(available.version&&available.version!==APP_VERSION){
        const button=$('updateAppBtn');
        button.textContent='Neue Version laden';
        button.classList.add('is-update-ready');
        $('networkStatus').textContent='Online · Update verfügbar';
        // Nur Hintergrund-Download. Während einer Stiftskizze NIEMALS automatisch reloaden.
        if('serviceWorker' in navigator){
          const registration=await navigator.serviceWorker.getRegistration();
          await registration?.update();
        }
      }
    }catch(error){
      // Kein Fehler für den Lernmodus: offline weiterarbeiten ist wichtiger.
      console.info('Updateprüfung später erneut',error);
    }finally{checkingUpdates=false;}
  }
  // Update erzwingen, ohne IndexedDB, Stiftstriche oder Selbstbewertungen zu löschen.
  async function refreshApp(){
    if(appRefreshing)return;
    if(ink.pointerId!==null){notice('Zum Aktualisieren zuerst den Pencil abheben.');return;}
    if(!navigator.onLine){notice('Offline: Zum Aktualisieren bitte Internet verbinden.');return;}
    const button=$('updateAppBtn');appRefreshing=true;button.disabled=true;button.textContent='Prüfe Update …';
    try{
      await finishInk();await saveQueue.catch(()=>{});
      if(storageError||!storeData())throw new Error('Speicherung nicht bestätigt. Bitte zuerst ein Gesamtbackup erstellen.');
      if('serviceWorker' in navigator){
        const reg=await navigator.serviceWorker.getRegistration();
        if(reg){
          await reg.update();
          if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
          if(reg.installing||reg.waiting){
            await Promise.race([
              new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true})),
              new Promise(resolve=>setTimeout(resolve,3000))
            ]);
          }
        }
      }
      // Nur zwischengespeicherte App-Dateien löschen, nie die persönlichen Notizen.
      if('caches' in window){
        const keys=await caches.keys();
        for(const key of keys.filter(k=>k.startsWith('hm3-stiftkarten-'))){
          const cache=await caches.open(key);
          await Promise.all(['./','./index.html','./app.js','./style.css','./cards.json','./proofs.json','./manifest.webmanifest'].map(p=>cache.delete(new URL(p,location.href),{ignoreSearch:true})));
        }
      }
      const url=new URL(location.href);url.searchParams.set('updated',String(Date.now()));window.location.replace(url.href);
    }catch(e){console.error('App update',e);notice('Aktualisierung fehlgeschlagen: '+e.message);}
    finally{appRefreshing=false;button.disabled=false;button.textContent='App aktualisieren';}
  }
  function listeners(){
    $('proofStartBtn').onclick=chooseProof;
    $('proofSwitchBtn').onclick=chooseProof;
    $('proofExitBtn').onclick=exitProof;
    $('proofSelectClose').onclick=()=>$('proofSelectDialog').close();
    $('proofSelectForm').onsubmit=beginProof;
    $('proofRevealBtn').onclick=revealProof;
    $('proofPrevBtn').onclick=()=>moveProof(-1);
    $('proofNextBtn').onclick=()=>moveProof(1);
    for(const id of ['cardBackgroundSection','cardExampleSection']){
      $(id).addEventListener('toggle',()=>{if($(id).open)math();});
    }
    $('quizStartBtn').onclick=()=>{quizSelectUI();$('quizSetupDialog').showModal();};
    $('quizSetupClose').onclick=()=>$('quizSetupDialog').close();
    $('quizSetupForm').onsubmit=beginQuiz;
    $('quizExitBtn').onclick=exitQuiz;$('quizSummaryExit').onclick=exitQuiz;
    $('quizRepeatAll').onclick=()=>repeatQuiz('all');
    $('quizRepeatWrong').onclick=()=>repeatQuiz('wrong');
    $('quizRepeatPartial').onclick=()=>repeatQuiz('partial');
    document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',async()=>{selected.mode=b.dataset.mode;selected.seen.clear();selected.history=[];document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('is-active',x===b));await advance();}));
    $('topicFilter').addEventListener('change',async e=>{selected.topic=e.target.value;selected.seen.clear();selected.history=[];await advance();});$('typeFilter').addEventListener('change',async e=>{selected.type=e.target.value;selected.seen.clear();selected.history=[];await advance();});$('prevBtn').onclick=goBack;$('skipBtn').onclick=()=>nextCard(true);$('showAllBtn').onclick=async()=>{selected.mode='all';selected.seen.clear();selected.history=[];document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('is-active',b.dataset.mode==='all'));await advance();};
    $('showSolutionBtn').onclick=()=>{selected.revealed=!selected.revealed;$('solutionContent').classList.toggle('is-hidden',!selected.revealed);$('showSolutionBtn').textContent=selected.revealed?'Musterlösung ausblenden':'Musterlösung anzeigen';$('showSolutionBtn').setAttribute('aria-expanded',String(selected.revealed));if(selected.revealed)math();};
    document.querySelectorAll('[data-rating]').forEach(b=>b.onclick=()=>grade(b.dataset.rating));$('recordingStartBtn').onclick=startRecording;$('recordingStopBtn').onclick=stopRecording;$('recordingsBtn').onclick=async()=>{await sessionList();$('settingsDialog').showModal();};$('recordingNameForm').onsubmit=e=>{e.preventDefault();void saveRecordingName(false);};$('saveAndExportRecordingBtn').onclick=()=>{void saveRecordingName(true);};$('recordingNameDialog').addEventListener('cancel',e=>{e.preventDefault();void saveRecordingName(false);});$('exportSessionBtn').onclick=()=>exportSession();$('exportSessionBtn2').onclick=()=>exportSession();$('footerExport').onclick=()=>exportSession();
    $('penBtn').onclick=()=>tool('pen');$('eraserBtn').onclick=()=>tool('eraser');document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{ink.color=b.dataset.color;document.querySelectorAll('[data-color]').forEach(x=>x.classList.toggle('is-active',x===b));tool('pen');});$('strokeWidth').onchange=e=>ink.width=Number(e.target.value);$('undoBtn').onclick=undo;$('redoBtn').onclick=redo;
    $('clearBtn').onclick=()=>{if(!ink.strokes.length)return;if(!confirm('Alle Striche auf diesem Blatt löschen? Frühere exportierte Versuche bleiben bestehen.'))return;ink.undo.push(ink.strokes.slice());ink.strokes=[];ink.redo=[];renderInk();saveInk();};
    $('offlineSaveBtn').onclick=async()=>{const b=$('offlineSaveBtn');b.disabled=true;try{await prepareOffline(true);}finally{b.disabled=false;}};
    $('sheetStyle').onchange=e=>{data.settings.sheetStyle=e.target.value;storeData();configureSheet();};$('sheetHeight').onchange=e=>{const h=Number(e.target.value);if(Number.isFinite(h))setCardSheetHeight(h);};$('extendSheetBtn').onclick=()=>setCardSheetHeight(cardSheetHeight()+400);$('updateAppBtn').onclick=refreshApp;
    $('cardFavoriteBtn').onclick=()=>selected.current&&changeFavorite(selected.current);$('cardDisableBtn').onclick=()=>selected.current&&changeDisabled(selected.current);$('cardEditBtn').onclick=()=>selected.current&&openEditor(selected.current);
    $('libraryBtn').onclick=()=>{renderLibrary();$('libraryDialog').showModal();};$('closeLibraryBtn').onclick=()=>$('libraryDialog').close();$('librarySearch').oninput=renderLibrary;$('libraryFilter').onchange=renderLibrary;
    $('editCardForm').onsubmit=saveEditor;$('closeEditorBtn').onclick=closeEditor;$('resetCardBtn').onclick=resetEditor;$('editorDialog').addEventListener('close',()=>editingCardId=null);
    $('settingsBtn').onclick=async()=>{$('pencilOnly').checked=!!data.settings.pencilOnly;await sessionList();$('settingsDialog').showModal();};$('closeSettingsBtn').onclick=()=>$('settingsDialog').close();$('pencilOnly').onchange=e=>{data.settings.pencilOnly=e.target.checked;storeData();configureSheet();};$('exportBackupBtn').onclick=exportBackup;$('importBackup').onchange=e=>{if(e.target.files?.[0])importBackup(e.target.files[0]);e.target.value='';};
    window.addEventListener('resize',resizeInk);document.addEventListener('visibilitychange',()=>{if(document.hidden)finishInk();});document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select'))return;if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();e.shiftKey?redo():undo();}});
  }
  async function init(){try{$('appVersion').textContent='App V'+APP_VERSION.split('.').slice(2).join('.');status('Lade Karten …');loadData();db=await openDB();if(!db){storageError=true;status('Speicher eingeschränkt – Backup wichtig',true);try{memory.attempts=JSON.parse(localStorage.getItem('hm3-fallback-attempts')||'[]');memory.sessions=JSON.parse(localStorage.getItem('hm3-fallback-sessions')||'[]');}catch{}}
    await fetchCards();await fetchProofs();memory.attempts=await listRecords('attempts');if(data.recordingActive&&data.sessionId){const old=await readRecord('sessions',data.sessionId);if(!old||old.endedAt){data.recordingActive=false;data.sessionId=null;data.recordingTouchedCards=[];storeData();}}updateFilters();listeners();configureSheet();
     if(data.quiz?.active){
       const q=data.quiz;
       if(!Array.isArray(q.initialIds)||!Array.isArray(q.queue)||q.queue.some(id=>!byId.has(id))){
         data.quiz=null;storeData();
       }
     }
     if(data.proofStudy?.active){
       if(!proofById.has(data.proofStudy.id)||!Number.isInteger(data.proofStudy.step)||
          data.proofStudy.step<0||data.proofStudy.step>4||(data.proofStudy.phase==='intro'&&(!Number.isInteger(data.proofStudy.introIndex)||data.proofStudy.introIndex<0||data.proofStudy.introIndex>1))||data.quiz?.active||data.recordingActive){
         data.proofStudy=null;storeData();
       }
     }
     updateQuizChrome();updateProofChrome();await advance();await updateSessionInfo();if(!storageError)status('');
  }catch(e){console.error(e);status('Start fehlgeschlagen',true);$('cardQuestion').textContent=e.message;}}
  init();
  // Automatische Hintergrund-Prüfung, sobald die PWA geöffnet oder wieder online ist.
  window.addEventListener('load',()=>{setNetworkState();void prepareOffline(false);void checkForUpdates(true);});
  window.addEventListener('online',()=>{setNetworkState();void prepareOffline(false);void checkForUpdates(true);});
  window.addEventListener('offline',()=>setNetworkState());
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&navigator.onLine)void checkForUpdates(false);
  });
})();