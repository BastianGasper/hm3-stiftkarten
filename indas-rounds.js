/* InDaS study-pool logic.
 * Root IDs never shrink during repetitions; a pass is just the selected subset.
 * Each card has one current rating, updated by each repeat attempt.
 * Correctly learned (green) cards stay excluded from further passes.
 */
(function (root) {
  'use strict';
  const legal=new Set(['good','partial','wrong','skipped']);
  const unique=ids=>[...new Set((Array.isArray(ids)?ids:[]).filter(x=>typeof x==='string'&&x))];
  const create=(ids,startedAt=new Date().toISOString())=>{
    const original=unique(ids);
    return {ids:original,grades:{},pass:{ids:[...original],index:0,completed:{},startedAt},passNumber:1,startedAt,completedAt:null};
  };
  function migrate(round) {
    if(!round||!Array.isArray(round.ids))return null;
    const valid=unique(round.ids),allowed=new Set(valid);
    round.ids=valid;
    const grades={};
    for(const [id,grade] of Object.entries(round.grades||{}))
      if(allowed.has(id)&&legal.has(grade))grades[id]=grade;
    round.grades=grades;
    if(!round.pass || !Array.isArray(round.pass.ids)) {
      // Existing installations stored a single set of IDs and rated cards.
      round.pass={ids:[...valid],index:Number.isInteger(round.index)?round.index:0,
        completed:{...grades},startedAt:round.startedAt||new Date().toISOString()};
      round.passNumber=1;
    }
    round.pass.ids=unique(round.pass.ids).filter(id=>allowed.has(id));
    const rated={};
    for(const [id,grade] of Object.entries(round.pass.completed||{}))
      if(round.pass.ids.includes(id)&&legal.has(grade))rated[id]=grade;
    round.pass.completed=rated;
    round.pass.index=Math.max(0,Math.min(round.pass.ids.length-1,Number.isInteger(round.pass.index)?round.pass.index:0));
    round.passNumber=Math.max(1,Number.isInteger(round.passNumber)?round.passNumber:1);
    round.completedAt=round.completedAt||null;
    return round;
  }
  function startPass(round,requested,startedAt=new Date().toISOString()){
    migrate(round);
    if(round.completedAt)throw Error('This stack has been completed');
    const allowed=new Set(round.ids);
    const ids=unique(requested).filter(id=>allowed.has(id)&&round.grades[id]!=='good');
    if(!ids.length)return [];
    round.pass={ids,index:0,completed:{},startedAt};
    round.passNumber+=1;
    return ids;
  }
  function mark(round,id,grade){
    migrate(round);
    if(round.completedAt || !round.pass.ids.includes(id) || !legal.has(grade))return {accepted:false};
    if(grade!=='skipped' || !legal.has(round.grades[id]))
      round.grades[id]=grade;
    // A skip in a later pass does not erase the previous rating.
    round.pass.completed[id]=grade;
    const index=round.pass.ids.findIndex(candidate=>!round.pass.completed[candidate]);
    if(index>=0)round.pass.index=index;
    return {accepted:true,passFinished:index<0,selected:index>=0?round.pass.ids[index]:null};
  }
  function stats(round){
    if(!round||!Array.isArray(round.ids))return null;
    migrate(round);
    const groups={good:[],partial:[],wrong:[],skipped:[],unseen:[]};
    for(const id of round.ids){
      const grade=round.grades[id];
      if(legal.has(grade))groups[grade].push(id);
      else groups.unseen.push(id);
    }
    const total=round.ids.length;
    const asked=total-groups.unseen.length;
    const outstanding=round.ids.filter(id=>round.grades[id]!=='good');
    const review=round.ids.filter(id=>round.grades[id]&&round.grades[id]!=='good');
    const currentPass=round.pass?.ids||[];
    const unreviewedPass=currentPass.filter(id=>!round.pass.completed[id]);
    return {groups,total,asked,outstanding,review,unreviewedPass,
      passCount:currentPass.length,passDone:currentPass.length-unreviewedPass.length,
      good:groups.good.length,partial:groups.partial.length,wrong:groups.wrong.length,
      skipped:groups.skipped.length,unseen:groups.unseen.length,
      percent:total?Math.round(100*groups.good.length/total):0,
      completed:!!round.completedAt};
  }
  root.InDaSRounds=Object.freeze({create,migrate,startPass,mark,stats});
})(window);
