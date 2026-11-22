/* Apple-Pencil engine adapted from the proven HM3 Stiftkarten input handling.
 * Pen/stylus only on iPad (touchType=stylus / pointerType=pen).
 * No page repositioning while drawing; high-DPI smoothed strokes;
 * finger/palm rejection; left 20%-edge finger scrolling in write mode.
 */
(() => {
  'use strict';
  class InDaSInk {
    constructor({canvas, overlay, sheet, getCardId, getStrokes, setStrokes, onChange}) {
      Object.assign(this,{canvas,overlay,sheet,getCardId,getStrokes,onChange});
      this.ctx=canvas.getContext('2d',{alpha:true});
      this.ectx=overlay.getContext('2d',{alpha:true});
      this.enabled=false; this.mode='auto'; this.tool='pen'; this.color='#273249';this.width=2.5;
      this.pointerId=null;this.inputSource=null;this.active=null;this.erasing=false;
      this.strokeRect=null;this.eraserTrail=[];this.eraserTip=null;this.lastEraserPoint=null;
      this.undoStack=[];this.redoStack=[];this.scale=1;this.logicalHeight=430;
      this.bound=[];this._setStrokes=setStrokes;
      this.bindInput();
      if ('ResizeObserver' in window) this.observer=new ResizeObserver(()=>{if(this.enabled)this.resize();});
      this.observer?.observe(sheet);
    }
    points(stroke) {return (stroke?.points||[]).map(p=>Array.isArray(p)?{x:p[0],y:p[1]}:p);}
    mid(a,b){return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
    strokes(){return this.getStrokes()||[];}
    redraw(){
      const c=this.ctx;c.clearRect(0,0,1000,this.logicalHeight);
      for(const stroke of this.strokes())this.strokePath(c,stroke);
      if(this.active)this.strokePath(c,this.active);
    }
    strokePath(c,s){
      const p=this.points(s);if(!p.length)return;
      c.strokeStyle=s.color||'#273249';c.fillStyle=c.strokeStyle;c.lineWidth=s.width||2;
      c.lineCap='round';c.lineJoin='round';
      if(p.length===1){c.beginPath();c.arc(p[0].x,p[0].y,(s.width||2)/2,0,Math.PI*2);c.fill();return;}
      c.beginPath();c.moveTo(p[0].x,p[0].y);
      const start=this.mid(p[0],p[1]);c.lineTo(start.x,start.y);
      for(let i=1;i<p.length-1;i++){const next=this.mid(p[i],p[i+1]);c.quadraticCurveTo(p[i].x,p[i].y,next.x,next.y);}
      c.lineTo(p[p.length-1].x,p[p.length-1].y);c.stroke();
    }
    drawSmoothSegment(p,s){
      const n=p.length;if(n<2)return;
      const c=this.ctx;c.strokeStyle=s.color;c.lineWidth=s.width;c.lineCap='round';c.lineJoin='round';c.beginPath();
      if(n===2){const m=this.mid(p[0],p[1]);c.moveTo(p[0].x,p[0].y);c.lineTo(m.x,m.y);}
      else {const a=p[n-3],b=p[n-2],d=p[n-1],m=this.mid(a,b),next=this.mid(b,d);c.moveTo(m.x,m.y);c.quadraticCurveTo(b.x,b.y,next.x,next.y);}
      c.stroke();
    }
    resize(){
      const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;
      const cssWidth=r.width,cssHeight=r.height;
      this.scale=cssWidth/1000;this.logicalHeight=cssHeight/this.scale;
      const target=Math.max(window.devicePixelRatio||1,3);
      const dpr=Math.max(1,Math.min(target,Math.sqrt(12000000/(cssWidth*cssHeight))));
      this.canvas.width=Math.round(cssWidth*dpr);this.canvas.height=Math.round(cssHeight*dpr);
      this.overlay.width=Math.round(cssWidth);this.overlay.height=Math.round(cssHeight);
      this.ctx.setTransform(dpr*this.scale,0,0,dpr*this.scale,0,0);
      this.ectx.setTransform(this.scale,0,0,this.scale,0,0);
      this.redraw();this.renderEraser();
    }
    coord(e,r=this.canvas.getBoundingClientRect()){
      return {x:Math.max(0,Math.min(1000,(e.clientX-r.left)/this.scale)),
        y:Math.max(0,Math.min(this.logicalHeight,(e.clientY-r.top)/this.scale))};
    }
    snapshot(){this.undoStack.push(this.strokes().slice());if(this.undoStack.length>35)this.undoStack.shift();this.redoStack=[];}
    dist(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy,t=den?Math.min(1,Math.max(0,((p.x-a.x)*dx+(p.y-a.y)*dy)/den)):0;return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));}
    cross(a,b,c,d){const orient=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
      const x=orient(a,b,c),y=orient(a,b,d),z=orient(c,d,a),w=orient(c,d,b);
      if(Math.abs(x)<1e-8&&Math.abs(y)<1e-8&&Math.abs(z)<1e-8&&Math.abs(w)<1e-8)
        return Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x)) &&
        Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))<=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y));
      return ((x>=0&&y<=0)||(x<=0&&y>=0))&&((z>=0&&w<=0)||(z<=0&&w>=0));
    }
    segmentDistance(a,b,c,d){
      if(this.cross(a,b,c,d))return 0;
      return Math.min(this.dist(a,c,d),this.dist(b,c,d),this.dist(c,a,b),this.dist(d,a,b));
    }
    hitStroke(from,to,stroke,radius){
      const points=this.points(stroke);if(!points.length)return false;
      const reach=radius+(stroke.width||2)/2;
      const left=Math.min(from.x,to.x)-reach,right=Math.max(from.x,to.x)+reach,
      top=Math.min(from.y,to.y)-reach,bottom=Math.max(from.y,to.y)+reach;
      if(!points.some(p=>p.x>=left&&p.x<=right&&p.y>=top&&p.y<=bottom)){
        const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
        if(Math.max(...xs)<left||Math.min(...xs)>right||Math.max(...ys)<top||Math.min(...ys)>bottom)return false;
      }
      if(points.length===1)return this.dist(points[0],from,to)<=reach;
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i];
        if(Math.max(a.x,b.x)<left||Math.min(a.x,b.x)>right||Math.max(a.y,b.y)<top||Math.min(a.y,b.y)>bottom)continue;
        if(this.segmentDistance(from,to,a,b)<=reach)return true;
      }
      return false;
    }
    eraseSweep(from,to){
      const strokes=this.strokes(),radius=8/this.scale;
      let changed=false;
      for(let i=strokes.length-1;i>=0;i--)if(this.hitStroke(from,to,strokes[i],radius)){
        strokes.splice(i,1);changed=true;
      }
      if(changed)this.redraw();
      return changed;
    }
    renderEraser(){
      const c=this.ectx;c.clearRect(0,0,1000,this.logicalHeight);
      if(!this.enabled||this.mode==='scroll'||this.tool!=='eraser')return;
      const p=this.eraserTrail,tip=this.eraserTip||p[p.length-1];if(!tip)return;
      if(p.length>1){c.save();c.strokeStyle='rgba(226,113,45,.64)';c.lineWidth=7/this.scale;c.lineCap='round';c.lineJoin='round';
        c.beginPath();c.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)c.lineTo(p[i].x,p[i].y);c.stroke();c.restore();}
      c.save();c.translate(tip.x,tip.y);c.rotate(-Math.PI/5);
      const w=22/this.scale,h=14/this.scale;
      c.fillStyle='#df7835';c.fillRect(-w/2,-h/2,w*.62,h);
      c.fillStyle='#f2c2a0';c.fillRect(w*.12,-h/2,w*.38,h);
      c.strokeStyle='#9e4d22';c.lineWidth=1.5/this.scale;c.strokeRect(-w/2,-h/2,w,h);c.restore();
    }
    begin(point,id,source){
      if(!this.enabled||this.mode==='scroll'||!this.getCardId()||this.pointerId!==null)return false;
      this.strokeRect=this.canvas.getBoundingClientRect();this.pointerId=id;this.inputSource=source;this.snapshot();
      if(this.tool==='eraser'){
        this.erasing=true;this.eraserTrail=[point];this.eraserTip=point;this.lastEraserPoint=point;
        this.eraseSweep(point,point);this.renderEraser();
      }else{
        this.active={color:this.color,width:this.width/this.scale,points:[point]};
        this.ctx.fillStyle=this.color;this.ctx.beginPath();
        this.ctx.arc(point.x,point.y,this.active.width/2,0,Math.PI*2);this.ctx.fill();
      }
      return true;
    }
    move(point,id,source){
      if(!this.enabled||this.pointerId!==id||this.inputSource!==source)return;
      if(this.erasing){const prev=this.lastEraserPoint||point;
        this.eraseSweep(prev,point);this.eraserTrail.push(point);if(this.eraserTrail.length>500)this.eraserTrail.shift();
        this.eraserTip=point;this.lastEraserPoint=point;this.renderEraser();return;}
      if(!this.active)return;
      const last=this.active.points[this.active.points.length-1];
      if(last.x===point.x&&last.y===point.y)return;
      this.active.points.push(point);this.drawSmoothSegment(this.active.points,this.active);
    }
    end(id,source){
      if(this.pointerId!==id||this.inputSource!==source)return;
      this.pointerId=null;this.inputSource=null;this.strokeRect=null;
      if(this.active){this.strokes().push(this.active);this.active=null;}
      this.erasing=false;this.eraserTrail=[];this.eraserTip=null;this.lastEraserPoint=null;
      this.redraw();this.renderEraser();this.onChange();
    }
    finish(){if(this.pointerId!==null)this.end(this.pointerId,this.inputSource);}
    setMode(mode){
      if(!['auto','write','scroll'].includes(mode))return;
      this.finish();this.mode=mode;this.syncLock();
      for(const [id,value] of [['inkAutoBtn','auto'],['inkModeBtn','write'],['inkScrollBtn','scroll']]){
        const button=document.getElementById(id);
        button?.classList.toggle('is-selected',value===mode);
        button?.setAttribute('aria-pressed',String(value===mode));
      }
      this.renderEraser();
    }
    setEnabled(enabled){
      this.finish();this.enabled=!!enabled;this.syncLock();
      if(this.enabled)this.resize();
    }
    syncLock(){
      const locked=this.enabled&&this.mode!=='scroll';
      document.documentElement.classList.toggle('indas-ink-locked',locked);
      document.body.classList.toggle('indas-ink-locked',locked);
      document.body.classList.toggle('indas-ink-scroll',this.enabled&&this.mode==='scroll');
      this.canvas.style.touchAction=this.mode==='scroll'?'pan-y':'none';
    }
    setTool(tool){
      if(!['pen','eraser'].includes(tool))return;
      this.finish();this.tool=tool;this.eraserTrail=[];this.eraserTip=null;this.renderEraser();
      for(const [id,value] of [['penBtn','pen'],['eraserBtn','eraser']]){
        const button=document.getElementById(id);
        button?.classList.toggle('is-selected',value===tool);
        button?.setAttribute('aria-pressed',String(value===tool));
      }
    }
    undo(){
      this.finish();if(!this.undoStack.length)return;
      this.redoStack.push(this.strokes().slice());this.setStrokes(this.undoStack.pop());this.redraw();this.onChange();
    }
    redo(){
      this.finish();if(!this.redoStack.length)return;
      this.undoStack.push(this.strokes().slice());this.setStrokes(this.redoStack.pop());this.redraw();this.onChange();
    }
    setStrokes(strokes){this._setStrokes(strokes);}
    clear(){
      this.finish();this.snapshot();this.setStrokes([]);this.redraw();this.onChange();
    }
    newCard(){this.finish();this.undoStack=[];this.redoStack=[];if(this.enabled)this.resize();}
    scrollPage(direction){
      this.finish();
      const doc=document.scrollingElement||document.documentElement;
      const distance=Math.max(230,Math.round(window.innerHeight*.68));
      const top=Math.max(0,Math.min(Math.max(0,doc.scrollHeight-window.innerHeight),(doc.scrollTop||0)+direction*distance));
      doc.scrollTop=top;window.scrollTo(0,top);
    }
    bindInput(){
      const pen=this.canvas;
      const isStylus=t=>t.touchType==='stylus';
      pen.addEventListener('touchstart',e=>{
        if(!this.enabled||this.mode==='scroll'||!this.getCardId())return;
        if(e.cancelable)e.preventDefault();
        const touch=Array.from(e.changedTouches||[]).find(isStylus);
        if(touch)this.begin(this.coord(touch), 'touch-'+touch.identifier,'touch');
      },{passive:false});
      pen.addEventListener('touchmove',e=>{
        if(!this.enabled||this.mode==='scroll')return;
        if(e.cancelable)e.preventDefault();
        if(this.inputSource!=='touch')return;
        const touch=Array.from(e.changedTouches||[]).find(t=>'touch-'+t.identifier===this.pointerId);
        if(touch)this.move(this.coord(touch,this.strokeRect||pen.getBoundingClientRect()),this.pointerId,'touch');
      },{passive:false});
      for(const name of ['touchend','touchcancel'])pen.addEventListener(name,e=>{
        if(this.inputSource!=='touch')return;
        const touch=Array.from(e.changedTouches||[]).find(t=>'touch-'+t.identifier===this.pointerId);
        if(touch)this.end(this.pointerId,'touch');
      },{passive:false});
      pen.addEventListener('pointerdown',e=>{
        if(!this.enabled||this.mode==='scroll'||!this.getCardId())return;
        // Pointer-touch / palms never draw. Desktop mouse remains usable.
        if(e.pointerType!=='pen'&&e.pointerType!=='mouse')return;
        if(e.cancelable)e.preventDefault();
        if(!this.begin(this.coord(e),e.pointerId,'pointer'))return;
        try {pen.setPointerCapture(e.pointerId);}catch(_){}
      });
      pen.addEventListener('pointermove',e=>{
        if(this.pointerId===null&&this.tool==='eraser'&&e.pointerType==='pen'&&this.enabled&&this.mode!=='scroll'){
          this.eraserTip=this.coord(e);this.renderEraser();return;
        }
        if(this.pointerId!==e.pointerId||this.inputSource!=='pointer')return;
        if(e.cancelable)e.preventDefault();
        for(const ev of e.getCoalescedEvents?.()||[e])this.move(this.coord(ev,this.strokeRect||pen.getBoundingClientRect()),e.pointerId,'pointer');
      });
      for(const name of ['pointerup','pointercancel'])pen.addEventListener(name,e=>this.end(e.pointerId,'pointer'));
      pen.addEventListener('lostpointercapture',()=>{if(this.inputSource==='pointer')this.end(this.pointerId,'pointer');});
      pen.addEventListener('pointerleave',()=>{if(this.pointerId===null){this.eraserTip=null;this.renderEraser();}});
      const inDialog=e=>!!e.target?.closest?.('dialog[open]');
      document.addEventListener('touchmove',e=>{
        if(this.enabled&&this.mode!=='scroll'&&!inDialog(e)&&e.cancelable)e.preventDefault();
      },{passive:false,capture:true});
      document.addEventListener('gesturestart',e=>{
        if(this.enabled&&this.mode!=='scroll'&&!inDialog(e)&&e.cancelable)e.preventDefault();
      },{passive:false});
      document.addEventListener('wheel',e=>{
        if(this.enabled&&this.mode!=='scroll'&&!inDialog(e)&&e.cancelable)e.preventDefault();
      },{passive:false,capture:true});
      let edgeScroll=null;
      document.addEventListener('touchstart',e=>{
        if(!this.enabled||this.mode==='scroll'||inDialog(e)||this.pointerId!==null)return;
        const finger=Array.from(e.changedTouches||[]).find(t=>t.touchType!=='stylus'&&t.clientX<=window.innerWidth*.20);
        if(finger)edgeScroll={id:finger.identifier,lastY:finger.clientY,startY:finger.clientY,moved:false};
      },{passive:true,capture:true});
      document.addEventListener('touchmove',e=>{
        if(!edgeScroll||!this.enabled||this.mode==='scroll'||this.pointerId!==null||inDialog(e))return;
        const finger=Array.from(e.changedTouches||[]).find(t=>t.identifier===edgeScroll.id&&t.touchType!=='stylus');
        if(!finger)return;
        if(!edgeScroll.moved&&Math.abs(finger.clientY-edgeScroll.startY)<5)return;
        const delta=edgeScroll.lastY-finger.clientY;edgeScroll.lastY=finger.clientY;edgeScroll.moved=true;
        if(e.cancelable)e.preventDefault();if(!delta)return;
        const doc=document.scrollingElement||document.documentElement;
        const top=Math.max(0,Math.min(Math.max(0,doc.scrollHeight-window.innerHeight),(doc.scrollTop||0)+delta));
        doc.scrollTop=top;window.scrollTo(0,top);
      },{passive:false,capture:true});
      for(const name of ['touchend','touchcancel'])document.addEventListener(name,e=>{
        if(edgeScroll&&Array.from(e.changedTouches||[]).some(t=>t.identifier===edgeScroll.id))edgeScroll=null;
      },{passive:true,capture:true});
    }
  }
  window.InDaSInk=InDaSInk;
})();