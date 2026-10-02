const F=require('./fairy-shoe-rules.js');
let seed=7; const rng=()=>{seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296};
const H=F.createHouse({rng}); H.backfill(3);
const stats={days:0,grads:0,runs:0,ev:0,min:9,corr:{}};
for(let d=0;d<400;d++){
  if(H.residents.length<3) H.backfill(3);
  if(H.residents.length!==3) throw new Error('roster '+H.residents.length);
  const chores=H.dealChores();
  const assign=H.residents.map((r,i)=>({resident:r,chore:chores[i]}));
  const res=H.resolveDay(assign);
  stats.grads+=res.graduates.length; stats.ev+=res.events.length;
  if(res.events.length>2) throw new Error('>2 events');
  const ev=res.events.map(e=>e.r); if(new Set(ev).size!==ev.length) throw new Error('dup');
  for(const card of res.cards){
    const r=card.r; if(r.graduated) continue;
    // random sandbox play
    const n=1+Math.floor(rng()*20), imp=['hand','hairbrush','paddle'][Math.floor(rng()*3)], lay=['over','bottoms','briefs'][Math.floor(rng()*3)], f=Math.floor(rng()*5)-2;
    const swats=Array.from({length:n},()=>({implement:imp,layer:lay,force:f}));
    const after=['corner','lines','heldafter','warm'].filter(()=>rng()<0.4);
    const snap = rng()<0.15? F.applyReprieve(H,r,['stern','kind','reflect'][Math.floor(rng()*3)]) : F.applyCorrection(H,r,card.mod,swats,after);
    const k=snap.match?snap.match.name:'reprieve'; stats.corr[k]=(stats.corr[k]||0)+1;
    for(const s of Object.values(r.stats)) if(s<1||s>7) throw new Error('range');
    H.takeGraduates().forEach(()=>stats.grads++);
  }
  stats.runs+=F.resolveRunaways(H).length;
  stats.days++;
}
console.log(stats, 'collection',H.collection.length);
// sanity on tables
const A=(r)=>F.effectiveAttention({stats:Object.fromEntries(F.STATS.map((s,i)=>[s,r[i]]))});
for(const k of F.ROSTER_KEYS){const R=F.ROSTER[k];console.log(k,JSON.stringify(A(R.base)))}
console.log(F.matchOf(2,4,0), F.liveSeverity([{implement:'hand',layer:'bottoms',force:0}]));
