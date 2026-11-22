(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'indas-study-v1';
  const DAY = 86400000;
  const state = {
    prefs: {}, typed: {}, strokes: {}, imported: [], recordings: [],
    activeRecording: null, round: null, mode: 'type', lecture: 'all',
    filter: 'all', query: '', shuffle: false
  };
  let cards = [];
  let ink = null;
  let summaryVisible = false;
  let toastTimer = 0;
  const notify = message => {
    const el = $('notice'); el.textContent = message;
    el.classList.add('visible'); clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('visible'), 3000);
  };
  const clean = html => new DOMParser().parseFromString(String(html ?? ''), 'text/html').body.textContent || '';
  const now = () => new Date().toISOString();
  const dateLabel = value => new Date(value).toLocaleString('de-DE', {dateStyle:'medium',timeStyle:'short'});
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      $('autosaveText').textContent = 'Lokal gespeichert';
    } catch (err) {
      $('autosaveText').textContent = 'Speichern fehlgeschlagen';
      notify('Lokaler Speicher voll. Bitte ein Backup exportieren.');
    }
  }
  function restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      for (const key of Object.keys(state)) if (data[key] !== undefined) state[key] = data[key];
      if (!['type','hand'].includes(state.mode)) state.mode = 'type';
      if (!Array.isArray(state.imported)) state.imported = [];
      if (!Array.isArray(state.recordings)) state.recordings = [];
      if (!state.prefs || typeof state.prefs !== 'object') state.prefs = {};
    } catch (err) { notify('Der letzte Lernstand konnte nicht gelesen werden.'); }
  }
  function normalize(card, index, prefix) {
    const question = clean(card.question ?? card.front ?? card.Frage ?? '').trim();
    const rawAnswer = clean(card.answer ?? card.back ?? card.Antwort ?? '').trim();
    const source = rawAnswer.match(/\[(VL\d\d),\s*slide\s+([^\]]+)\]\s*$/i);
    return {
      id: card.id || prefix + '-' + index,
      question, answer: source ? rawAnswer.slice(0, source.index).trim() : rawAnswer,
      category: Array.isArray(card.categories) ? card.categories[0] || 'Importiert' : card.category || 'Importiert',
      source: source ? source[1] + ' · Slide ' + source[2] : String(card.source || ''),
    };
  }
  function allCards() { return cards.concat(state.imported.map((c,i) => normalize(c, i, 'custom'))); }
  function byId(id) { return allCards().find(c => c.id === id); }
  function pref(id) { return state.prefs[id] || (state.prefs[id] = {}); }
  function current() { return state.round ? byId(state.round.ids[state.round.index]) : null; }
  function available() {
    let pool = allCards().filter(c => !state.prefs[c.id]?.disabled);
    if (state.lecture !== 'all') pool = pool.filter(c => c.category === state.lecture);
    if (state.filter === 'favorites') pool = pool.filter(c => !!state.prefs[c.id]?.favorite);
    if (state.filter === 'wrong') pool = pool.filter(c => state.prefs[c.id]?.lastGrade === 'wrong');
    if (state.filter === 'due') pool = pool.filter(c => !state.prefs[c.id]?.nextDue || state.prefs[c.id].nextDue <= Date.now());
    if (state.query.trim()) {
      const query = state.query.toLocaleLowerCase('en');
      pool = pool.filter(c => (c.question + ' ' + c.answer + ' ' + c.category).toLocaleLowerCase('en').includes(query));
    }
    return pool;
  }
  function shuffle(values) {
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  }
  function startRound(ids) {
    // A new learning round always starts with empty writing and typing fields.
    // Recorded attempts contain independent snapshots and are not affected.
    ink?.finish();
    const selected = ids || available().map(c => c.id);
    const order = state.shuffle && !ids ? shuffle([...selected]) : [...selected];
    state.typed = {};
    state.strokes = {};
    state.round = {ids:order,index:0,grades:{},startedAt:now()};
    summaryVisible = false;
    ink?.newCard();
    persist();
    render();
  }
  function updateCategories() {
    const selected = state.lecture;
    const select = $('lectureSelect');
    const categories = [...new Set(allCards().map(c => c.category))];
    select.replaceChildren(new Option('Alle Vorlesungen','all'));
    for (const category of categories) select.add(new Option(category,category));
    state.lecture = categories.includes(selected) ? selected : 'all';
    select.value = state.lecture;
    $('totalCards').textContent = allCards().length.toLocaleString('de-DE');
  }
  function applyMode() {
    const hand = state.mode === 'hand';
    $('typingArea').hidden = hand;
    $('handwritingArea').hidden = !hand;
    $('typingBtn').classList.toggle('is-active',!hand);
    $('handwritingBtn').classList.toggle('is-active',hand);
    $('typingBtn').setAttribute('aria-pressed',String(!hand));
    $('handwritingBtn').setAttribute('aria-pressed',String(hand));
    ink?.setEnabled(hand && !summaryVisible && !!current());
  }
  function render() {
    const card=current();
    $('studyPanel').hidden = !card || summaryVisible;
    $('roundSummary').hidden = !summaryVisible;
    $('emptyState').hidden = !!card || summaryVisible;
    $('recordIndicator').hidden = !state.activeRecording;
    $('recordStart').disabled = !!state.activeRecording;
    $('recordStop').disabled = !state.activeRecording;
    applyMode();
    if(summaryVisible) { renderSummary(); return; }
    if(!card) { $('remainingCount').textContent='0'; return; }
    const ids=state.round.ids;
    const grades=Object.values(state.round.grades);
    const done=grades.length;
    $('currentCategory').textContent=card.category;
    $('currentSource').textContent=card.source||'Lecture notes';
    $('cardSubject').textContent=card.category.replace(/^VL\d\d\s*[–-]\s*/,'');
    $('cardPosition').textContent='Karte '+(state.round.index+1)+' von '+ids.length;
    $('percentDone').textContent=Math.round(100*done/Math.max(ids.length,1))+'% bewertet';
    $('progressFill').style.width=100*done/Math.max(ids.length,1)+'%';
    $('questionText').textContent=card.question;
    $('solutionText').textContent=card.answer;
    $('solutionPanel').hidden=true;
    $('revealBtn').textContent='◉ Antwort ansehen';
    $('revealBtn').setAttribute('aria-expanded','false');
    $('typedAnswer').value=state.typed[card.id]||'';
    $('favoriteBtn').textContent=state.prefs[card.id]?.favorite?'★':'☆';
    $('favoriteBtn').classList.toggle('selected',!!state.prefs[card.id]?.favorite);
    $('excludeBtn').textContent=state.prefs[card.id]?.disabled?'⊕':'⊘';
    $('excludeBtn').title=state.prefs[card.id]?.disabled?'Aktivieren':'Deaktivieren';
    $('prevCard').disabled=state.round.index===0;
    $('nextCard').disabled=state.round.index===ids.length-1;
    $('ratedCount').textContent=done;
    $('goodCount').textContent=grades.filter(x=>x==='good').length;
    $('partialCount').textContent=grades.filter(x=>x==='partial').length;
    $('wrongCount').textContent=grades.filter(x=>x==='wrong').length;
    $('remainingCount').textContent=Math.max(0,ids.length-done);
    ink?.newCard();
  }

  function showSummary() {
    if(!state.round?.ids?.length) {notify('Keine Karten in dieser Abfrage.');return;}
    ink?.finish();
    summaryVisible=true;
    persist();
    render();
    $('roundSummary').scrollIntoView({block:'start',behavior:'auto'});
  }

  function renderSummary() {
    const ids=state.round?.ids||[];
    const grades=state.round?.grades||{};
    const groups={good:[],partial:[],wrong:[],skipped:[]};
    for(const id of ids)if(groups[grades[id]])groups[grades[id]].push(id);
    const asked=Object.values(groups).reduce((sum,a)=>sum+a.length,0);
    const remain=ids.length-asked;
    const percent=asked?Math.round(groups.good.length/asked*100):0;
    const set=(id,n)=>$(id).textContent=String(n);
    set('summaryPercent',percent+'%');set('sumAsked',asked);set('sumGood',groups.good.length);
    set('sumPartial',groups.partial.length);set('sumWrong',groups.wrong.length);
    set('sumSkipped',groups.skipped.length);set('sumRemaining',remain);
    set('actionRemaining',remain);set('actionWrong',groups.wrong.length);
    set('actionPartial',groups.partial.length);set('actionAsked',asked);
    const due=allCards().filter(c=>!state.prefs[c.id]?.disabled && (!state.prefs[c.id]?.nextDue||state.prefs[c.id].nextDue<=Date.now())).length;
    set('actionDue',due);
    $('summaryContinue').disabled=remain===0;
    $('summaryRetryWrong').disabled=!groups.wrong.length;
    $('summaryRetryPartial').disabled=!groups.partial.length;
    $('summaryRetryAsked').disabled=asked===0;
    $('summaryDue').disabled=due===0;
    const a=groups.good.length,p=groups.partial.length,w=groups.wrong.length,s=groups.skipped.length;
    const arc=(n)=>Math.round(n/Math.max(asked,1)*100*100)/100;
    $('summaryDonut').style.background='conic-gradient(#20b797 0% '+arc(a)+'%, #eba044 '+arc(a)+'% '+arc(a+p)+'%, #e34d53 '+arc(a+p)+'% '+arc(a+p+w)+'%, #aab3bf '+arc(a+p+w)+'% '+arc(a+p+w+s)+'%, #e9edf2 '+arc(a+p+w+s)+'% 100%)';
    const definitions=[
      ['good','breakdownGood','breakdownGoodCount'],
      ['partial','breakdownPartial','breakdownPartialCount'],
      ['wrong','breakdownWrong','breakdownWrongCount'],
      ['skipped','breakdownSkip','breakdownSkipCount']
    ];
    for(const [kind,target,countId] of definitions){
      set(countId,groups[kind].length);
      const root=$(target);root.replaceChildren();
      if(!groups[kind].length){const empty=document.createElement('p');empty.className='breakdown-empty';empty.textContent='Keine Karten in dieser Kategorie.';root.append(empty);continue;}
      for(const id of groups[kind]){
        const card=byId(id);if(!card)continue;
        const item=document.createElement('div');item.className='breakdown-row';
        const text=document.createElement('div');
        const title=document.createElement('strong');title.textContent=card.question;
        const meta=document.createElement('small');meta.textContent=card.category+' · '+card.source;
        text.append(title,meta);
        const button=document.createElement('button');button.className='btn compact';button.textContent='Karte öffnen';
        button.onclick=()=>{
          const index=state.round.ids.indexOf(id);
          summaryVisible=false;
          state.round.index=index;
          ink?.newCard();
          persist();render();
          $('studyPanel').scrollIntoView({block:'start'});
        };
        item.append(text,button);root.append(item);
      }
    }
  }
  function showSolution() {
    const show = $('solutionPanel').hidden;
    $('solutionPanel').hidden = !show;
    $('revealBtn').textContent = show ? 'Antwort ausblenden' : '◉ Antwort ansehen';
    $('revealBtn').setAttribute('aria-expanded',String(show));
  }
  function changeCard(direction) {
    if(!state.round)return;
    ink?.finish();
    state.round.index=Math.min(state.round.ids.length-1,Math.max(0,state.round.index+direction));
    persist();render();
  }
  function grade(value) {
    const card=current();
    if(!card||!['wrong','partial','good','skipped'].includes(value))return;
    ink?.finish();
    const p=pref(card.id);
    const oldGrade=state.round.grades[card.id];
    state.round.grades[card.id]=value;
    if(value!=='skipped'){
      p.lastGrade=value;p.lastReviewed=now();p.reviews=(p.reviews||0)+1;
      p.streak=value==='good'?(p.streak||0)+1:0;
      const days=value==='wrong'?0:value==='partial'?1:Math.min(30,Math.max(2,2**p.streak));
      p.nextDue=Date.now()+(days*DAY);
    }
    if(state.activeRecording){
      const snapshot={
        cardId:card.id,category:card.category,source:card.source,
        question:card.question,modelAnswer:card.answer,inputMode:state.mode,
        typedAnswer:state.typed[card.id]||'',
        strokes:JSON.parse(JSON.stringify(state.strokes[card.id]||[])),
        grade:value,answeredAt:now()
      };
      state.activeRecording.attempts.push(snapshot);
    }
    persist();
    if(Object.keys(state.round.grades).length===state.round.ids.length){showSummary();return;}
    let next=state.round.ids.findIndex((id,index)=>index>state.round.index&&!state.round.grades[id]);
    if(next<0)next=state.round.ids.findIndex(id=>!state.round.grades[id]);
    if(next>=0)state.round.index=next;
    persist();render();
    if(oldGrade)notify('Bewertung aktualisiert.');
  }
  
  function download(name, content, mime='application/json') {
    const blob = new Blob([content], {type:mime + ';charset=utf-8'});
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url),2000);
  }
  function filename(value) { return String(value || 'InDaS').replace(/[^\w\u00c0-\u024f-]+/g,'_').slice(0,65); }
  function saveRecord(downloadIt) {
    const rec=state.activeRecording; if (!rec) return;
    rec.title = $('recordName').value.trim() || 'InDaS – '+new Date().toLocaleDateString('de-DE');
    rec.finishedAt = now();
    state.recordings.unshift(rec);
    state.activeRecording = null;
    $('finishDialog').close(); persist(); render();
    if(downloadIt) downloadRecording(rec);
    notify('Aufnahme mit '+rec.attempts.length+' Antworten gespeichert.');
  }
  function drawingSVG(strokes) {
    if(!strokes?.length)return '';
    const points=[];
    const paths=strokes.map(s=>{
      const values=(s.points||[]).map(p=>Array.isArray(p)?{x:Number(p[0]),y:Number(p[1])}:{x:Number(p.x),y:Number(p.y)});
      points.push(...values);
      const coords=values.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
      return '<polyline points="'+escapeHTML(coords)+'" fill="none" stroke="'+escapeHTML(s.color||'#273249')+'" stroke-width="'+(Number(s.width)||2.5)+'" stroke-linecap="round" stroke-linejoin="round"/>';
    }).join('');
    const legacy=strokes.some(s=>(s.points||[]).some(p=>Array.isArray(p)));
    const width=legacy?1100:1000;
    const height=legacy?430:Math.max(430,Math.ceil(points.reduce((m,p)=>Math.max(m,p.y),0)+35));
    return '<svg viewBox="0 0 '+width+' '+height+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;background:#fff;border:1px solid #ddd;border-radius:8px">'+paths+'</svg>';
  }
  function downloadRecording(rec) {
    const articles=rec.attempts.map((a,i)=>'<article><small>'+escapeHTML(a.category)+' · '+escapeHTML(a.source)+' · '+escapeHTML(a.answeredAt)+'</small><h2>'+(i+1)+'. '+escapeHTML(a.question)+'</h2><h3>Eigene Antwort · '+escapeHTML(a.grade)+'</h3><pre>'+escapeHTML(a.typedAnswer)+'</pre>'+drawingSVG(a.strokes)+'<details><summary>Musterantwort</summary><p>'+escapeHTML(a.modelAnswer)+'</p></details></article>').join('');
    const report='<!doctype html><html lang="de"><meta charset="utf-8"><title>'+escapeHTML(rec.title)+'</title><style>body{font:16px/1.5 system-ui;max-width:950px;margin:25px auto;padding:15px;color:#263247}article{page-break-inside:avoid;border-top:2px solid #d9e0e9;padding:20px 0}small{color:#738097}pre{white-space:pre-wrap;font:inherit;background:#f4f6f9;padding:12px;border-radius:8px}summary{cursor:pointer}h3{font-size:1rem}</style><h1>'+escapeHTML(rec.title)+'</h1><p>Aufnahme '+escapeHTML(rec.startedAt)+' bis '+escapeHTML(rec.finishedAt||now())+' · '+rec.attempts.length+' Versuche</p>'+articles+'</html>';
    download(filename(rec.title)+'.html',report,'text/html');
  }
  function displayRecordings() {
    const root=$('recordingsList'); root.replaceChildren();
    if (!state.recordings.length) {root.textContent='Noch keine abgeschlossenen Aufnahmen.';return;}
    for(const rec of state.recordings) {
      const row=document.createElement('div');row.className='recording-row';
      const desc=document.createElement('div'),title=document.createElement('strong'),small=document.createElement('small');
      title.textContent=rec.title;small.textContent=dateLabel(rec.startedAt)+' · '+rec.attempts.length+' Antworten';
      desc.append(title,small);
      const actions=document.createElement('div');
      const htmlBtn=document.createElement('button');htmlBtn.className='btn';htmlBtn.textContent='Bericht';htmlBtn.onclick=()=>downloadRecording(rec);
      const jsonBtn=document.createElement('button');jsonBtn.className='btn';jsonBtn.textContent='JSON';jsonBtn.onclick=()=>download(filename(rec.title)+'.json',JSON.stringify(rec,null,2));
      actions.append(htmlBtn,jsonBtn);row.append(desc,actions);root.append(row);
    }
  }
  function displayLibrary() {
    const search=$('librarySearch').value.trim().toLowerCase();
    const matched=allCards().filter(c=>!search||(c.question+' '+c.answer+' '+c.category).toLowerCase().includes(search));
    $('libraryCount').textContent=matched.length+' von '+allCards().length+' Karten';
    const root=$('libraryList');root.replaceChildren();
    for(const card of matched) {
      const row=document.createElement('div');row.className='library-row';
      const desc=document.createElement('div'),title=document.createElement('strong'),small=document.createElement('small');
      title.textContent=card.question;small.textContent=card.category+' · '+card.source;
      desc.append(title,small);
      const controls=document.createElement('div');
      const open=document.createElement('button');open.className='btn';open.textContent='Öffnen';
      open.onclick=()=>{state.lecture='all';state.filter='all';state.query='';$('lectureSelect').value='all';$('studyFilter').value='all';$('searchBox').value='';startRound([card.id]);$('libraryDialog').close();};
      const fav=document.createElement('button');fav.className='btn';fav.textContent=state.prefs[card.id]?.favorite?'★':'☆';
      fav.onclick=()=>{pref(card.id).favorite=!pref(card.id).favorite;persist();displayLibrary();};
      const disable=document.createElement('button');disable.className='btn';disable.textContent=state.prefs[card.id]?.disabled?'Aktivieren':'Deaktivieren';
      disable.onclick=()=>{pref(card.id).disabled=!pref(card.id).disabled;persist();displayLibrary();};
      controls.append(open,fav,disable);row.append(desc,controls);root.append(row);
    }
  }
  function parseCSV(text) {
    let output=[],field='',row=[],quoted=false;
    for(let i=0;i<text.length;i++) {
      const c=text[i];
      if (c==='"' && quoted && text[i+1]==='"') {field+='"';i++;}
      else if(c==='"') quoted=!quoted;
      else if(c===','&&!quoted){row.push(field);field='';}
      else if((c==='\n'||c==='\r')&&!quoted) {
        if(c==='\r'&&text[i+1]==='\n')i++;
        row.push(field);if(row.some(x=>x.trim())) output.push(row);row=[];field='';
      } else field+=c;
    }
    row.push(field);if(row.some(x=>x.trim()))output.push(row);
    if(output.length&&/^(question|front|frage)$/i.test(output[0][0].trim()))output.shift();
    return output.map(row=>row.length>=3&&/^\d+$/.test(row[0].trim())?row.slice(1):row).filter(row=>row.length>=2)
      .map(row=>({question:row[0],answer:row[1],categories:['Importiert']}));
  }
  async function importCards(file) {
    try {
      const text=await file.text();
      let incoming=file.name.toLowerCase().endsWith('.csv')?parseCSV(text):JSON.parse(text);
      if (!Array.isArray(incoming)) {
        if (Array.isArray(incoming.cards)) incoming=incoming.cards;
        else throw Error('Datei enthält keine Kartenliste.');
      }
      const oldQuestions=new Set(allCards().map(c=>c.question.trim().toLowerCase()));
      let count=0;
      for(const card of incoming) {
        const item=normalize(card,count,'custom');
        if (!item.question||!item.answer||oldQuestions.has(item.question.toLowerCase()))continue;
        oldQuestions.add(item.question.toLowerCase());
        state.imported.push({...card,id:'custom-'+Date.now()+'-'+(count++),categories:[item.category]});
      }
      persist(); updateCategories(); startRound();
      $('importStatus').textContent=count+' Karten importiert ('+(incoming.length-count)+' übersprungen).';
      notify(count+' Karteikarten importiert.');
    } catch(err){$('importStatus').textContent='Importfehler: '+err.message;}
  }
  function setup() {
    restore();
    fetch('./indas-cards.json',{cache:'no-store'}).then(response=>{
      if(!response.ok)throw Error('HTTP '+response.status);
      return response.json();
    }).then(data=>{
      cards=data.map((card,i)=>normalize(card,i,'lecture')).filter(c=>c.question&&c.answer);
      updateCategories();
      if(state.round && Array.isArray(state.round.ids)) {
        state.round.ids=state.round.ids.filter(id=>byId(id));
        state.round.index=Math.min(state.round.index,Math.max(0,state.round.ids.length-1));
      }
      if(!state.round?.ids?.length)startRound();else render();
    }).catch(err=>{notify('Karteikarten konnten nicht geladen werden: '+err.message);$('questionText').textContent='Bitte die Seite neu laden.';});
    $('typingBtn').onclick=()=>{state.mode='type';persist();applyMode();};
    $('handwritingBtn').onclick=()=>{state.mode='hand';persist();applyMode();};
    $('typedAnswer').addEventListener('input',event=>{const card=current();if(card){state.typed[card.id]=event.target.value;persist();}});
    ink=new window.InDaSInk({
      canvas:$('drawingCanvas'),overlay:$('eraserOverlay'),sheet:$('inkSheet'),
      getCardId:()=>current()?.id||null,
      getStrokes:()=>{const card=current();return card?(state.strokes[card.id] ||= []):[];},
      setStrokes:strokes=>{const card=current();if(card)state.strokes[card.id]=strokes;},
      onChange:persist
    });
    $('inkAutoBtn').onclick=()=>ink.setMode('auto');
    $('inkModeBtn').onclick=()=>ink.setMode('write');
    $('inkScrollBtn').onclick=()=>ink.setMode('scroll');
    $('inkUpBtn').onclick=()=>ink.scrollPage(-1);
    $('inkDownBtn').onclick=()=>ink.scrollPage(1);
    $('penBtn').onclick=()=>ink.setTool('pen');
    $('eraserBtn').onclick=()=>ink.setTool('eraser');
    $('penUndo').onclick=()=>ink.undo();
    $('penRedo').onclick=()=>ink.redo();
    $('penClear').onclick=()=>{if(current()&&confirm('Handschrift auf dieser Karte löschen?'))ink.clear();};
    $('inkColor').onchange=e=>{ink.color=e.target.value;ink.setTool('pen');};
    $('inkWidth').onchange=e=>ink.width=Number(e.target.value);
    $('revealBtn').onclick=showSolution;
    document.querySelectorAll('[data-grade]').forEach(button=>button.onclick=()=>grade(button.dataset.grade));
    $('prevCard').onclick=()=>changeCard(-1);$('nextCard').onclick=()=>changeCard(1);
    $('favoriteBtn').onclick=()=>{const card=current();if(!card)return;pref(card.id).favorite=!pref(card.id).favorite;persist();render();};
    $('excludeBtn').onclick=()=>{const card=current();if(!card)return;pref(card.id).disabled=!pref(card.id).disabled;persist();render();};
    $('lectureSelect').onchange=e=>{state.lecture=e.target.value;startRound();};
    $('studyFilter').onchange=e=>{state.filter=e.target.value;startRound();};
    $('searchBox').oninput=e=>{state.query=e.target.value;startRound();};
    $('shuffleCheck').checked=state.shuffle;
    $('shuffleCheck').onchange=e=>{state.shuffle=e.target.checked;startRound();};
    $('studyFilter').value=state.filter;
    $('searchBox').value=state.query;
    $('newRoundBtn').onclick=()=>startRound();
    $('finishRoundBtn').onclick=showSummary;
    $('skipCard').onclick=()=>grade('skipped');
    const repeat=kind=>{const ids=state.round?.ids.filter(id=>state.round.grades[id]===kind)||[];if(ids.length)startRound(ids);};
    $('summaryContinue').onclick=()=>{const ids=state.round?.ids.filter(id=>!state.round.grades[id])||[];if(ids.length)startRound(ids);};
    $('summaryRetryWrong').onclick=()=>repeat('wrong');
    $('summaryRetryPartial').onclick=()=>repeat('partial');
    $('summaryRetryAsked').onclick=()=>{const ids=state.round?.ids.filter(id=>!!state.round.grades[id])||[];if(ids.length)startRound(ids);};
    $('summaryRestart').onclick=()=>{const ids=[...(state.round?.ids||[])];startRound(ids);};
    $('summaryDue').onclick=()=>{state.filter='due';$('studyFilter').value='due';state.lecture='all';$('lectureSelect').value='all';state.query='';$('searchBox').value='';startRound();};
    $('summaryReturn').onclick=()=>{summaryVisible=false;render();$('studyPanel').scrollIntoView({block:'start'});};
    $('resetFilters').onclick=()=>{state.lecture='all';state.filter='all';state.query='';$('lectureSelect').value='all';$('studyFilter').value='all';$('searchBox').value='';startRound();};
    $('recordStart').onclick=()=>{
      if(state.activeRecording)return;
      state.activeRecording={id:'record-'+Date.now(),startedAt:now(),attempts:[],title:'',category:state.lecture};
      persist();render();notify('Aufnahme läuft. Bewertete Karten werden archiviert.');
    };
    $('recordStop').onclick=()=>{if(state.activeRecording){$('recordName').value='InDaS – '+new Date().toLocaleDateString('de-DE');$('finishDialog').showModal();}};
    $('saveRecording').onclick=()=>saveRecord(false);
    $('saveAndExportRecording').onclick=()=>saveRecord(true);
    $('cancelRecordingFinish').onclick=()=>$('finishDialog').close();
    $('recordingsBtn').onclick=()=>{displayRecordings();$('recordingsDialog').showModal();};
    $('libraryBtn').onclick=()=>{displayLibrary();$('libraryDialog').showModal();};
    $('librarySearch').oninput=displayLibrary;
    $('backupBtn').onclick=()=>$('backupDialog').showModal();
    document.querySelectorAll('[data-close]').forEach(button=>button.onclick=() => $(button.dataset.close).close());
    $('backupExport').onclick=()=>download('InDaS_Gesamtbackup_'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({app:'indas-study',version:1,savedAt:now(),state},null,2));
    $('backupImport').onchange=async event=>{
      const file=event.target.files?.[0];if(!file)return;
      try {
        const data=JSON.parse(await file.text());
        if(data.app!=='indas-study'||!data.state||!Array.isArray(data.state.recordings))throw Error('Kein InDaS-Backup.');
        if(!confirm('Alle aktuellen InDaS-Lerndaten durch dieses Backup ersetzen?'))return;
        for(const key of Object.keys(state))if(data.state[key]!==undefined)state[key]=data.state[key];
        persist();updateCategories();render();notify('InDaS-Backup wiederhergestellt.');
      }catch(err){notify('Backup ungültig: '+err.message);}
      event.target.value='';
    };
    $('cardsImport').onchange=async event=>{const file=event.target.files?.[0];if(file)await importCards(file);event.target.value='';};

  }
  window.addEventListener('DOMContentLoaded',setup);
})();