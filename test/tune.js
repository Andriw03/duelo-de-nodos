const D = require('../src/logic.js');
const AI = require('../src/ai.js');
function play(seed, l0, l1) {
  const r = D.mulberry32(seed);
  let s = D.newGame(D.randomBalancedTeam(r), D.randomBalancedTeam(r), seed % 2);
  let steps=0;
  while (s.winner === null) { const a = AI.choose(s, s.current===0?l0:l1, r); s = D.applyAction(s, a, r).state; if(++steps>5000) throw 1; }
  return s;
}
const variants = JSON.parse(process.argv[2]);
for (const [k,v] of Object.entries(variants)) AI.LEVELS[k] = Object.assign({}, AI.LEVELS.normal, v);
const pairs = JSON.parse(process.argv[3]);
for (const [a,b] of pairs){ let w=[0,0],lim=0,t=0; const n=80;
 for(let i=0;i<n;i++){ const s1=play(5000+i,a,b); if(s1.winner===0)w[0]++; else if(s1.winner===1)w[1]++; t+=s1.turn; if(s1.winReason.startsWith('Lím'))lim++;
   const s2=play(5000+i,b,a); if(s2.winner===1)w[0]++; else if(s2.winner===0)w[1]++; t+=s2.turn; if(s2.winReason.startsWith('Lím'))lim++;}
 console.log(a,'vs',b,'=>',w[0],':',w[1],'turnos',(t/2/n).toFixed(0),'límite',lim);}
