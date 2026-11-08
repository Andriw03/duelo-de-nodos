const D=require('../src/logic.js'),AI=require('../src/ai.js');
const cfg=JSON.parse(process.argv[2]||'{}'); for(const k in cfg) Object.assign(AI.LEVELS[k],cfg[k]);
const lv=process.argv[3]||'normal', lv2=process.argv[4]||lv;
const lens=[];let fw=0,lim=0;const n=120;
for(let i=0;i<n;i++){const r=D.mulberry32(9000+i);let s=D.newGame(D.randomBalancedTeam(r),D.randomBalancedTeam(r),i%2);
 while(s.winner===null){const a=AI.choose(s,s.current===0?lv:lv2,r);s=D.applyAction(s,a,r).state;}
 lens.push(s.turn); if(s.winner===s.firstPlayer)fw++; if(s.winReason.startsWith('Lím'))lim++;}
lens.sort((a,b)=>a-b);console.log(JSON.stringify(cfg),lv,lv2,'p10',lens[n/10|0],'mediana',lens[n/2],'p90',lens[n*0.9|0],'1ro gana',fw+'/'+n,'límite',lim);
