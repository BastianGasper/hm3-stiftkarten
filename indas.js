(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'indas-study-v1';
  const DAY = 86400000;
  const state = {
    prefs: {}, typed: {}, strokes: {}, imported: [], recordings: [],
    activeRecording: null, round: null, mode: 'type', lecture: 'all',
    filter: 'all', query: '', shuffle: false, roundSize: 0, completedRounds: []
  };
  const R = window.InDaSRounds;
  if (!R) throw new Error("InDaS Lernstapel-Modul fehlt.");
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
      if (!Array.isArray(state.completedRounds)) state.completedRounds = [];
      state.roundSize = Math.max(0,Math.floor(Number(state.roundSize)||0));
      state.round = R.migrate(state.round);
      summaryVisible = !!state.round?.summaryVisible;
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
  function current() { return state.round?.pass ? byId(state.round.pass.ids[state.round.pass.index]) : null; }
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
    // A genuinely new stack starts from scratch; recorded attempts/history survive.
    ink?.finish();
    const selected = ids || available().map(c => c.id);
    const ordered = state.shuffle && !ids ? shuffle([...selected]) : [...selected];
    const order = !ids && state.roundSize > 0 ? ordered.slice(0,state.roundSize) : ordered;
    state.typed = {};
    state.strokes = {};
    state.round = R.create(order, now());
    summaryVisible = false;
    ink?.newCard();
    persist();
    render();
  }
  function askForNewStack() {
    const active = state.round && !state.round.completedAt &&
      (R.stats(state.round)?.asked > 0 || state.activeRecording?.attempts?.length);
    if(active && !confirm('Den bisherigen Lernstapel wirklich verlassen und eine neue Abfrage beginnen? Die Bewertungen des aktuellen Stapels werden dann zurückgesetzt. Bereits gespeicherte Aufnahmen bleiben erhalten.')) return false;
    startRound();
    return true;
  }
  function startRepeat(ids) {
    if(!state.round || state.round.completedAt)return;
    ink?.finish();
    // Every repeat pass is independently randomized, regardless of the initial shuffle option.
    const selected = R.startPass(state.round, shuffle([...ids]), now());
    if(!selected.length) {notify('Keine Karten mehr in dieser Auswahl.'); return;}
    // Each repeat attempt gets an empty input sheet, but the root ratings stay.
    for(const id of selected) {delete state.typed[id]; delete state.strokes[id];}
    summaryVisible = false;
    state.round.summaryVisible = false;
    ink?.newCard();
    persist();
    render();
    $('studyPanel').scrollIntoView({block:'start',behavior:'auto'});
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
    const total=state.round.ids.length;
    const pass=state.round.pass;
    const counts=R.stats(state.round);
    const grades=Object.values(state.round.grades);
    const done=counts.passDone;
    $('currentCategory').textContent=card.category;
    $('currentSource').textContent=card.source||'Lecture notes';
    $('cardSubject').textContent=card.category.replace(/^VL\d\d\s*[–-]\s*/,'');
    $('cardPosition').textContent='Karte '+(pass.index+1)+' von '+pass.ids.length+' · Stapel '+total;
    $('percentDone').textContent=counts.good+' / '+total+' dauerhaft gewusst';
    $('progressFill').style.width=100*done/Math.max(pass.ids.length,1)+'%';
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
    $('prevCard').disabled=pass.index===0;
    $('nextCard').disabled=pass.index===pass.ids.length-1;
    $('ratedCount').textContent=counts.asked;
    $('goodCount').textContent=grades.filter(x=>x==='good').length;
    $('partialCount').textContent=grades.filter(x=>x==='partial').length;
    $('wrongCount').textContent=grades.filter(x=>x==='wrong').length;
    $('remainingCount').textContent=counts.outstanding.length;
  }

  function showSummary() {
    if(!state.round?.ids?.length) {notify('Keine Karten in dieser Abfrage.');return;}
    ink?.finish();
    summaryVisible=true;
    state.round.summaryVisible=true;
    persist();
    render();
    $('roundSummary').scrollIntoView({block:'start',behavior:'auto'});
  }

  function renderSummary() {
    const round=state.round;
    const tally=R.stats(round);
    if(!tally)return;
    const {groups,total,asked,good,partial,wrong,skipped,unseen,outstanding,review,percent,completed}=tally;
    const set=(id,value)=>$(id).textContent=String(value);
    set('summaryPercent',percent+'%');set('sumTotal',total);set('sumAsked',asked);
    set('sumGood',good);set('sumPartial',partial);set('sumWrong',wrong);
    set('sumSkipped',skipped);set('sumRemaining',unseen);set('sumOpen',outstanding.length);
    const continueCount=tally.unreviewedPass.length||outstanding.length;
    set('actionRemaining',continueCount);set('actionWrong',wrong);
    set('actionPartial',partial);set('actionAsked',review.length);
    const due=allCards().filter(c=>!state.prefs[c.id]?.disabled&&(!state.prefs[c.id]?.nextDue||state.prefs[c.id].nextDue<=Date.now())).length;
    set('actionDue',due);
    $('summaryTitle').textContent=completed
      ? 'Lernstapel abgeschlossen · '+total+' Karten'
      : 'Lernstapel mit '+total+' Karten · Durchlauf '+round.passNumber;
    $('summaryContinue').disabled=completed||continueCount===0;
    $('summaryRetryWrong').disabled=completed||!wrong;
    $('summaryRetryPartial').disabled=completed||!partial;
    $('summaryRetryAsked').disabled=completed||!review.length;
    $('summaryDue').disabled=!due;
    $('summaryFinalize').disabled=completed;
    $('summaryFinalize').textContent=completed?'✓ Lernstapel abgeschlossen':'✓ Lernstapel abschließen';
    $('summaryRestart').textContent=completed?'⟲ Neuen Durchgang mit diesen Karten':'⟲ Von vorne (Neustart)';
    const arc=n=>Math.round(n/Math.max(total,1)*10000)/100;
    const a=arc(good),p=arc(partial),w=arc(wrong),sk=arc(skipped);
    $('summaryDonut').style.background='conic-gradient(#20b797 0% '+a+'%, #eba044 '+a+'% '+(a+p)+'%, #e34d53 '+(a+p)+'% '+(a+p+w)+'%, #aab3bf '+(a+p+w)+'% '+(a+p+w+sk)+'%, #e9edf2 '+(a+p+w+sk)+'% 100%)';
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
        const desc=document.createElement('div');
        const title=document.createElement('strong');title.textContent=card.question;
        const meta=document.createElement('small');meta.textContent=card.category+' · '+card.source;
        desc.append(title,meta);
        const button=document.createElement('button');button.className='btn compact';button.textContent='Ansehen';
        button.onclick=()=>{
          $('previewQuestion').textContent=card.question;
          $('previewAnswer').textContent=card.answer;
          $('previewSource').textContent=card.category+' · '+card.source;
          $('summaryPreviewDialog').showModal();
        };
        item.append(desc,button);root.append(item);
      }
    }
  }
  function finalizeStack() {
    if(!state.round||state.round.completedAt)return;
    if(!confirm('Diesen Lernstapel wirklich abschließen? Die aktuelle Gesamtstatistik wird gespeichert. Wiederholungen sind danach nur mit einem neuen Stapel möglich.'))return;
    ink?.finish();
    state.round.completedAt=now();
    state.round.summaryVisible=true;
    const tally=R.stats(state.round);
    state.completedRounds.unshift({
      startedAt:state.round.startedAt,completedAt:state.round.completedAt,
      ids:[...state.round.ids],grades:{...state.round.grades},
      total:tally.total,good:tally.good,partial:tally.partial,
      wrong:tally.wrong,skipped:tally.skipped,unseen:tally.unseen
    });
    state.completedRounds=state.completedRounds.slice(0,100);
    summaryVisible=true;
    persist();render();
    notify('Gesamtstapel mit '+tally.total+' Karten abgeschlossen.');
  }
  function showSolution() {
    const show = $('solutionPanel').hidden;
    $('solutionPanel').hidden = !show;
    $('revealBtn').textContent = show ? 'Antwort ausblenden' : '◉ Antwort ansehen';
    $('revealBtn').setAttribute('aria-expanded',String(show));
  }
  function changeCard(direction) {
    if(!state.round?.pass)return;
    ink?.finish();
    const pass=state.round.pass;
    pass.index=Math.min(pass.ids.length-1,Math.max(0,pass.index+direction));
    ink?.newCard();
    persist();render();
  }
  function grade(value) {
    const card=current();
    if(!card||!['wrong','partial','good','skipped'].includes(value)||state.round.completedAt)return;
    ink?.finish();
    const p=pref(card.id);
    const before=state.round.grades[card.id];
    const result=R.mark(state.round,card.id,value);
    if(!result.accepted)return;
    if(value!=='skipped'){
      p.lastGrade=value;p.lastReviewed=now();p.reviews=(p.reviews||0)+1;
      p.streak=value==='good'?(p.streak||0)+1:0;
      const days=value==='wrong'?0:value==='partial'?1:Math.min(30,Math.max(2,2**p.streak));
      p.nextDue=Date.now()+days*DAY;
    }
    if(state.activeRecording){
      state.activeRecording.attempts.push({
        cardId:card.id,category:card.category,source:card.source,
        question:card.question,modelAnswer:card.answer,inputMode:state.mode,
        typedAnswer:state.typed[card.id]||'',
        strokes:JSON.parse(JSON.stringify(state.strokes[card.id]||[])),
        grade:value,answeredAt:now(),
        poolId:state.round.startedAt,passNumber:state.round.passNumber
      });
    }
    persist();
    if(result.passFinished){showSummary();return;}
    ink?.newCard();
    persist();render();
    if(before&&before!==value)notify('Karte im Gesamtstapel aktualisiert.');
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
      open.onclick=()=>{$('previewQuestion').textContent=card.question;$('previewAnswer').textContent=card.answer;$('previewSource').textContent=card.category+' · '+card.source;$('summaryPreviewDialog').showModal();};
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
      persist(); updateCategories(); if(!state.round?.ids?.length)startRound();else render();
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
        state.round=R.migrate(state.round);
        state.round.pass.ids=state.round.pass.ids.filter(id=>byId(id));
        state.round.pass.index=Math.min(state.round.pass.index,Math.max(0,state.round.pass.ids.length-1));
        if(!state.round.pass.ids.length&&state.round.ids.length){
          state.round.pass={ids:[...state.round.ids],index:0,completed:{},startedAt:now()};
        }
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
    $('lectureSelect').onchange=e=>{state.lecture=e.target.value;persist();notify('Auswahl vorgemerkt. Mit „Neuen Lernstapel starten“ übernehmen.');};
    $('studyFilter').onchange=e=>{state.filter=e.target.value;persist();notify('Filter für den nächsten Lernstapel vorgemerkt.');};
    $('searchBox').oninput=e=>{state.query=e.target.value;persist();};
    $('shuffleCheck').checked=state.shuffle;
    $('shuffleCheck').onchange=e=>{state.shuffle=e.target.checked;persist();};
    $('studyFilter').value=state.filter;
    $('searchBox').value=state.query;
    $('roundSize').value=state.roundSize ? String(state.roundSize) : '';
    $('roundSize').onchange=e=>{
      state.roundSize=Math.max(0,Math.floor(Number(e.target.value)||0));
      persist();
      notify('Kartenanzahl für den nächsten Lernstapel vorgemerkt.');
    };
    $('newRoundBtn').onclick=askForNewStack;
    $('finishRoundBtn').onclick=showSummary;
    $('skipCard').onclick=()=>grade('skipped');
    const repeat=kind=>startRepeat(R.stats(state.round)?.groups[kind]||[]);
    $('summaryContinue').onclick=()=>{
      const tally=R.stats(state.round);
      if(!tally||state.round.completedAt)return;
      if(tally.unreviewedPass.length){
        const pending=new Set(tally.unreviewedPass);
        const index=state.round.pass.ids.findIndex(id=>pending.has(id));
        if(index<0)return;
        ink?.finish();
        state.round.pass.index=index;
        state.round.summaryVisible=false;
        summaryVisible=false;
        ink?.newCard();
        persist();render();
        $('studyPanel').scrollIntoView({block:'start',behavior:'auto'});
      }else{
        startRepeat(tally.outstanding);
      }
    };
    $('summaryRetryWrong').onclick=()=>repeat('wrong');
    $('summaryRetryPartial').onclick=()=>repeat('partial');
    $('summaryRetryAsked').onclick=()=>startRepeat(R.stats(state.round)?.review||[]);
    $('summaryRestart').onclick=()=>{
      if(!state.round?.ids?.length)return;
      if(!state.round.completedAt && !confirm('Den bisherigen Lernfortschritt dieses Stapels wirklich zurücksetzen und alle '+state.round.ids.length+' Karten erneut beginnen?'))return;
      startRound([...state.round.ids]);
    };
    $('summaryDue').onclick=()=>{
      if(!state.round?.completedAt && !confirm('Den aktuellen Lernstapel verlassen und mit den weltweit fälligen Karten neu anfangen?'))return;
      state.filter='due';$('studyFilter').value='due';state.lecture='all';$('lectureSelect').value='all';
      state.query='';$('searchBox').value='';startRound();
    };
    $('summaryReturn').onclick=()=>{displayLibrary();$('libraryDialog').showModal();};
    $('summaryFinalize').onclick=finalizeStack;
    $('resetFilters').onclick=()=>{state.lecture='all';state.filter='all';state.query='';$('lectureSelect').value='all';$('studyFilter').value='all';$('searchBox').value='';askForNewStack();};
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