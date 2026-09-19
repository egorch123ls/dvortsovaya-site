/* Shared, dependency-free menu and service logic. No network or paid API. */
(function(root){
'use strict';
const data=root.MENU_DATA, items=data.items, byId=Object.fromEntries(items.map(d=>[d.id,d]));
const clone=x=>JSON.parse(JSON.stringify(x));
function norm(s){return String(s).toLowerCase().replace(/ё/g,'е').replace(/([а-яa-z])(\d)/g,'$1 $2').replace(/[^а-яa-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}
const words=s=>norm(s).split(' ').filter(x=>x&&!['с','s','sauce','s'].includes(x));
const names=items.map(d=>({d,aliases:[d.name,...d.aliases].map(norm)}));
function distance(a,b){if(Math.abs(a.length-b.length)>3)return 99;const dp=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));for(let i=0;i<=a.length;i++)dp[i][0]=i;for(let j=0;j<=b.length;j++)dp[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1));if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])dp[i][j]=Math.min(dp[i][j],dp[i-2][j-2]+1)}return dp[a.length][b.length]}
const memo=new Map();
function resolve(input){
 const q=norm(input);if(memo.has(q))return memo.get(q);let result={dish:null,choices:[],cost:9};
 const weight=q.match(/^стейк\s+(\d{1,4})(?:\s+(?:г|гр|грамм))?$/);if(weight){if(+weight[1]>=1&&+weight[1]<=3000)return {dish:'marbled-steak',weight:+weight[1],choices:[],cost:0};return result}
 if(data.shortcuts[q]&&byId[data.shortcuts[q]])return {dish:data.shortcuts[q],choices:[],cost:0};
 if(['п','пи','пицца'].includes(q))return {dish:null,choices:items.filter(d=>d.is_pizza).map(d=>d.id),cost:1};
 const exact=names.filter(x=>x.aliases.includes(q));if(exact.length===1)return {dish:exact[0].d.id,choices:[],cost:0};if(exact.length>1)return {dish:null,choices:exact.map(x=>x.d.id),cost:1};
 const qw=words(q);if(!qw.length)return result;
 let candidates=[];
 for(const {d,aliases} of names){let best=99;
  for(const alias of aliases){const aw=words(alias);if(qw.length>aw.length)continue;const used=new Set();let score=0,ok=true;
   for(const w of qw){let pick=-1,low=99;for(let j=0;j<aw.length;j++){if(used.has(j))continue;let c=w===aw[j]?0:aw[j].startsWith(w)&&w.length>=2?.12:99;if(w.length>=4&&Math.abs(w.length-aw[j].length)<=2){const edit=distance(w,aw[j]);if(edit<=(w.length>=7?2:1))c=Math.min(c,.65+edit*.2)}if(c<low){low=c;pick=j}}
    if(pick<0||low>2){ok=false;break}used.add(pick);score+=low;
   }if(ok)best=Math.min(best,score+.008*(aw.length-qw.length));
  }if(best<3)candidates.push({id:d.id,score:best});
 }
 candidates.sort((a,b)=>a.score-b.score);
 if(candidates.length){const first=candidates[0],near=candidates.filter(c=>c.score<=first.score+.11);result=near.length===1?{dish:first.id,choices:[],cost:first.score+.1}:{dish:null,choices:near.slice(0,8).map(c=>c.id),cost:2};}
 if(memo.size>3000)memo.clear();memo.set(q,result);return result;
}
function segment(text,guest){
 const tokens=String(text).trim().split(/\s+/).filter(Boolean),cache=new Map();
 function solve(i){if(i===tokens.length)return {cost:0,rows:[]};if(cache.has(i))return cache.get(i);let best=null;
  for(let end=Math.min(tokens.length,i+12);end>i;end--){let phrase=tokens.slice(i,end).join(' '),qty=1;const m=phrase.match(/^(\d{1,2})\s*[xх×]\s*(.*)$/i);if(m){qty=+m[1];phrase=m[2]}if(!qty||qty>50)continue;
   const found=resolve(phrase);if(!found.dish)continue;const rest=solve(end);const cost=rest.cost+.6+found.cost;
   if(!best||cost<best.cost)best={cost,rows:[{guest,query:phrase,dish:found.dish,qty,...(found.weight?{weight:found.weight}:{})},...rest.rows]};
  }
  const rest=solve(i+1),bad={cost:rest.cost+6,rows:[{guest,query:tokens[i],dish:null,qty:1},...rest.rows]};if(!best||bad.cost<best.cost)best=bad;cache.set(i,best);return best;
 }
 const raw=solve(0).rows,rows=[];for(const r of raw){if(!r.dish&&rows.length&&!rows[rows.length-1].dish)rows[rows.length-1].query+=' '+r.query;else rows.push(r)}return rows;
}
function parseOrder(text){
 if(typeof text!=='string'||text.length>6000)throw Error('Заказ слишком длинный. Максимум 6000 символов.');
 const matches=[...text.matchAll(/(?:^|\s)(\d{1,3})\s*:/g)];if(!matches.length)throw Error('Напиши по персонам: 1: рыбник 2: салат с уткой');
 let rows=[],persons=0;const seen=new Set();for(let i=0;i<matches.length;i++){const g=+matches[i][1];if(g<1||g>50||seen.has(g))throw Error('Номера персон — от 1 до 50, каждый номер один раз.');seen.add(g);persons=Math.max(persons,g);const start=matches[i].index+matches[i][0].length,end=i+1<matches.length?matches[i+1].index:text.length;const part=text.slice(start,end).trim();if(!part)throw Error('У персоны '+g+' не указаны блюда.');for(const chunk of part.split(/[,;\n]+/).filter(x=>x.trim()))rows.push(...segment(chunk,g));}
 const explicit=text.slice(0,matches[0].index).match(/(?:персон[аы]?\s*(\d+)|(\d+)\s*персон)/i);if(explicit){const n=+(explicit[1]||explicit[2]);if(n<persons||n>50)throw Error('Число персон не соответствует номерам.');persons=n}
 if(rows.length>100)throw Error('В заказе слишком много позиций.');return {persons,items:rows,raw:text,status:'active',created:Date.now()};
}
function day(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Yekaterinburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function newState(){return {schema:1,orders:[],nextId:1,current:null,rush:false,waits:clone(data.config),stock:{date:day(),items:{},steaks:{updated:false,weights:{},revisions:{},epoch:0}}}}
function daily(state){if(state.stock.date!==day())state.stock={date:day(),items:{},steaks:{updated:false,weights:{},revisions:{},epoch:0}}};function duration(d,state){if(d.wait_override)return d.wait_override;return state.waits[state.rush?'rush':'normal'][d.category]||null}
const rank={cold:0,starter:0,oyster:0,soup:1,hot:2,dessert:3};
function plan(order,state){
 const queues=[],bread=[],drinks=[],unknown=[],special=[];let say=[];
 for(let g=1;g<=order.persons;g++){const groups=new Map();for(const row of order.items.filter(i=>i.guest===g)){const d=byId[row.dish];if(!d){unknown.push(row);continue}if(d.category==='drink'){drinks.push(row);continue}if(['gift','event'].includes(d.category)){special.push(row);continue}for(const s of d.say||[])if(!say.includes(s))say.push(s);if(d.category==='bread'){bread.push(row);continue}const r=rank[d.category]??0;if(!groups.has(r))groups.set(r,[]);groups.get(r).push(row)}const queue=[...groups.entries()].sort((a,b)=>a[0]-b[0]).map(x=>x[1]);if(bread.some(r=>r.guest===g)&&!groups.has(0))queue.unshift([]);queues.push(queue);}
 const count=Math.max(bread.length?1:0,...queues.map(q=>q.length)),courses=[];
 for(let n=0;n<count;n++){const rows=queues.flatMap(q=>q[n]||[]);const shared=n===0?bread:[];const times=[...rows,...shared].map(r=>duration(byId[r.dish],state));const known=times.filter(Boolean);courses.push({number:n+1,items:rows,shared,wait:known.length?[Math.max(...known.map(t=>t[0])),Math.max(...known.map(t=>t[1]))]:null,complete:times.every(Boolean)&&!unknown.length,finishedGuests:queues.flatMap((q,i)=>n>0&&!q[n]?[i+1]:[])});}
 return {courses,drinks,unknown,special,say};
}
function formatWait(t){return t?(t[0]===t[1]?t[0]:t[0]+'–'+t[1])+' мин':'время не задано'}
function name(row){return (byId[row.dish]?.name||'Не распознано: '+row.query)+(row.weight?' · '+row.weight+' г':'')+(row.qty>1?' ×'+row.qty:'')}
function stockStatus(state,id,weight){daily(state);if(id==='marbled-steak'){const s=state.stock.steaks;return !s.updated?{status:'unknown'}:{status:(weight?s.weights[weight]>0:Object.values(s.weights).some(n=>n>0))?'go':'stop'}}return state.stock.items[id]||{status:'unknown'}}
function stockLabel(s){return s.status==='stop'?'В стопе':s.status==='go'?'В наличии'+(s.qty===null?' · без ограничений':s.qty!==undefined?' · '+s.qty+' осталось':''):'На сегодня не отмечено'}
function setStock(state,id,status,qty){daily(state);if(!byId[id]||id==='marbled-steak')throw Error('Выбери блюдо; стейки заполняются граммовками.');if(!['go','stop','unknown'].includes(status))throw Error('Неизвестный статус.');if(qty!==undefined&&qty!==null&&(!Number.isInteger(qty)||qty<0||qty>10000))throw Error('Остаток — целое число от 0 до 10000.');if(status==='unknown')delete state.stock.items[id];else state.stock.items[id]={status:qty===0?'stop':status,...(qty!==undefined?{qty}:{})};}
function steakCommand(state,text){daily(state);const q=norm(text),s=state.stock.steaks;if(['0','стейк 0','стейки 0'].includes(q)){state.stock.steaks={updated:true,weights:{},revisions:{},epoch:s.epoch+1};return 'Стейки очищены.'}
 const grams=q.match(/\d+/g)||[];if(!grams.length||grams.some(n=>+n<1||+n>3000))throw Error('Укажи граммовки: стейк 190 189 340 гоу. Или 0.');if(q.replace(/\b\d+\b/g,'').replace(/стейки?|гоу|стоп|забрала|забрал|забрали|не|нет|есть|убрать|грамм|гр|г/g,'').trim())throw Error('Для стейков нужны только граммовки и статус.');
 const stop=/стоп|забрала|забрал|нет|убрать/.test(q)&&!q.includes('не стоп'),counts={};for(const g of grams)counts[+g]=(counts[+g]||0)+1;
 for(const [g,count] of Object.entries(counts)){s.revisions[g]=(s.revisions[g]||0)+1;if(stop)delete s.weights[g];else s.weights[g]=count}s.updated=true;return (stop?'Убраны: ':'Добавлены: ')+Object.keys(counts).join(', ')+' г.';
}
function reconcile(state,order,previous){daily(state);const s=state.stock.steaks,old=clone(previous?.reservations||[]),kept=[],pending=[],warnings=[];for(const row of order.items){if(row.dish!=='marbled-steak')continue;if(!row.weight){warnings.push('Стейк: укажи граммовку — ничего не списано.');continue}for(let n=0;n<row.qty;n++){const i=old.findIndex(x=>x.weight===String(row.weight));if(i>=0)kept.push(old.splice(i,1)[0]);else pending.push(String(row.weight))}}
 for(const r of old)if(r.date===day()&&r.epoch===s.epoch&&r.revision===(s.revisions[r.weight]||0))s.weights[r.weight]=(s.weights[r.weight]||0)+1;
 for(const g of pending){if(s.weights[g]>0){if(--s.weights[g]===0)delete s.weights[g];kept.push({weight:g,date:day(),epoch:s.epoch,revision:s.revisions[g]||0})}else warnings.push('Стейк '+g+' г: '+(s.updated?'нет в гоу':'граммовки на сегодня не заполнены')+' — не списан.')}
 order.reservations=kept;order.warnings=[...new Set(warnings)];
}
function saveOrder(state,text,editId=null){const o=parseOrder(text);const prev=editId?state.orders.find(o=>o.id===editId):null;if(editId&&(!prev||prev.status!=='active'))throw Error('Для исправления выбери активный заказ.');reconcile(state,o,prev);o.id=prev?prev.id:state.nextId++;if(prev)state.orders[state.orders.indexOf(prev)]=o;else state.orders.push(o);state.current=o.id;return o}
function stockCommand(state,text,defaultStatus=null){const copy=clone(state);daily(copy);let messages=[];
 for(const line of text.split(/[;\n]+/).filter(x=>x.trim())){let q=norm(line);if(q.startsWith('стейк ')){messages.push(steakCommand(copy,q));continue}let status=defaultStatus,qty,query=q;
 if(/без огран/.test(q)){status='go';qty=null;query=q.replace(/без огран\S*/,'').trim()}else if(q.includes('не стоп')){status='go';query=q.replace('не стоп','').trim()}else{const m=q.match(/^(стоп|гоу|го|есть|нет)\s+(.+)$/),n=q.match(/^(.+)\s+(стоп|гоу|го|есть|нет)$/);if(m||n){const token=m?m[1]:n[2];status=['стоп','нет'].includes(token)?'stop':'go';query=m?m[2]:n[1]}else{const num=q.match(/^(.+?)\s+(\d+)$/);if(num){qty=+num[2];status=qty?'go':'stop';query=num[1]}}}
 if(!status)throw Error('Напиши «ры стоп», «ры не стоп» или «н клубника 7».');let ids;
 if(['парик','пароконвектомат'].includes(query))ids=['57dcced6b5','214af081b8'];else if(['пицца вся','вся пицца','пицца','пи','п'].includes(query))ids=items.filter(d=>d.is_pizza).map(d=>d.id);else if(['фритюр','фри','фрит'].includes(query))throw Error('Картофеля фри нет в актуальном PDF. Стоп/гоу для него не изменён.');
 else {const found=resolve(query);if(found.dish)ids=[found.dish];else{const rows=segment(query,1);if(rows.some(r=>!r.dish))throw Error('Не удалось однозначно распознать: '+query);ids=rows.map(r=>r.dish)}}
 for(const id of new Set(ids)){setStock(copy,id,status,qty);messages.push(byId[id].name+' — '+stockLabel(stockStatus(copy,id)))}
 }if(!messages.length)throw Error('Напиши хотя бы одну позицию.');state.stock=copy.stock;return messages;
}
root.Waiter={data,items,byId,clone,norm,resolve,parseOrder,plan,duration,formatWait,name,day,newState,daily,stockStatus,stockLabel,setStock,steakCommand,saveOrder,stockCommand,reconcile};
})(globalThis);
