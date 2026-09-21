/* Shared, dependency-free menu and service logic. No network or paid API. */
(function(root){
'use strict';
const data=root.MENU_DATA, items=data.items, byId=Object.fromEntries(items.map(d=>[d.id,d]));
const clone=x=>JSON.parse(JSON.stringify(x));
function norm(s){return String(s).toLowerCase().replace(/ё/g,'е').replace(/([а-яa-z])(\d)/g,'$1 $2').replace(/[^а-яa-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}
const words=s=>norm(s).split(' ').filter(x=>x&&x!=='с').map(x=>x==='ч'?'чай':x);
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
   for(const w of qw){let pick=-1,low=99;for(let j=0;j<aw.length;j++){if(used.has(j))continue;let c=w===aw[j]?0:aw[j].startsWith(w)&&w.length>=2?.12:99;if(w.length>=4&&Math.abs(w.length-aw[j].length)<=2){const edit=distance(w,aw[j]);if(edit<=(w.length>=7?2:1))c=Math.min(c,.65+edit*.2)}if(c===99&&w.length>=4&&aw[j].length>w.length){const edit=distance(w,aw[j].slice(0,w.length));if(edit===1)c=1.1}if(c<low){low=c;pick=j}}
    if(pick<0||low>2){ok=false;break}used.add(pick);score+=low;
   }if(ok)best=Math.min(best,score+.008*(aw.length-qw.length));
  }if(best<3)candidates.push({id:d.id,score:best});
 }
 candidates.sort((a,b)=>a.score-b.score);
 if(candidates.length){const first=candidates[0],near=candidates.filter(c=>c.score<=first.score+.11);result=near.length===1?{dish:first.id,choices:[],cost:first.score+.1}:{dish:null,choices:near.slice(0,8).map(c=>c.id),cost:2};}
 if(memo.size>3000)memo.clear();memo.set(q,result);return result;
}
function segment(text,guest){
 const tokens=String(text).trim().split(/\s+/).filter(Boolean),cache=new Map();if(tokens.length>160)throw Error('Слишком много слов у одной персоны. Раздели блюда запятыми.');
 function solve(i){if(i===tokens.length)return {cost:0,rows:[]};if(cache.has(i))return cache.get(i);let best=null;
  for(let end=Math.min(tokens.length,i+12);end>i;end--){let phrase=tokens.slice(i,end).join(' '),qty=1;const m=phrase.match(/^(\d{1,2})\s*[xх×]\s*(.*)$/i);if(m){qty=+m[1];phrase=m[2]}if(!qty||qty>50)continue;
   const found=resolve(phrase);if(!found.dish)continue;const rest=solve(end);const cost=rest.cost+.6+found.cost;
   if(!best||cost<best.cost)best={cost,rows:[{guest,query:phrase,dish:found.dish,qty,...(found.weight?{weight:found.weight}:{})},...rest.rows]};
  }
  const rest=solve(i+1),bad={cost:rest.cost+6,rows:[{guest,query:tokens[i],dish:null,qty:1},...rest.rows]};if(!best||bad.cost<best.cost)best=bad;cache.set(i,best);return best;
 }
 const raw=solve(0).rows,rows=[];for(const r of raw){if(!r.dish&&rows.length&&!rows[rows.length-1].dish)rows[rows.length-1].query+=' '+r.query;else rows.push(r)}for(const row of rows)if(!row.dish)row.choices=resolve(row.query).choices;return rows;
}
function parseOrder(text){
 if(typeof text!=='string'||text.length>6000)throw Error('Заказ слишком длинный. Максимум 6000 символов.');
 const matches=[...text.matchAll(/(?:^|\s)(\d{1,3})\s*:/g)];if(!matches.length)throw Error('Напиши по персонам: 1: рыбник 2: салат с уткой');
 let rows=[],persons=0;const seen=new Set();for(let i=0;i<matches.length;i++){const g=+matches[i][1];if(g<1||g>50||seen.has(g))throw Error('Номера персон — от 1 до 50, каждый номер один раз.');seen.add(g);persons=Math.max(persons,g);const start=matches[i].index+matches[i][0].length,end=i+1<matches.length?matches[i+1].index:text.length;const part=text.slice(start,end).trim();if(!part)throw Error('У персоны '+g+' не указаны блюда.');for(const chunk of part.split(/[,;\n]+/).filter(x=>x.trim()))rows.push(...segment(chunk,g));}
 const explicit=text.slice(0,matches[0].index).match(/(?:персон[аы]?\s*(\d+)|(\d+)\s*персон)/i);if(explicit){const n=+(explicit[1]||explicit[2]);if(n<persons||n>50)throw Error('Число персон не соответствует номерам.');persons=n}
 if(rows.length>100)throw Error('В заказе слишком много позиций.');return {persons,items:rows,raw:text,status:'active',created:Date.now()};
}
function day(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Yekaterinburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function emptyStock(epoch=0){return {date:day(),items:{},revisions:{},epoch,steaks:{updated:false,weights:{},revisions:{},epoch:0}}}
function newState(){return {schema:2,revision:0,orders:[],nextId:1,current:null,rush:false,waits:clone(data.config),stock:emptyStock()}}
function validRange(value){return value===null||(Array.isArray(value)&&value.length===2&&value.every(n=>Number.isFinite(n)&&n>=0&&n<=240)&&value[0]<=value[1])}
function migrateState(input){
 if(!input||![1,2].includes(input.schema)||!Array.isArray(input.orders)||!input.stock?.steaks||!input.waits)throw Error('Файл не похож на сохранённую смену.');
 const state=clone(input);state.schema=2;state.revision=Number.isSafeInteger(state.revision)?state.revision:0;
 if(state.orders.length>5000)throw Error('Слишком много заказов в файле.');
 for(const mode of ['normal','rush']){if(!state.waits[mode]||typeof state.waits[mode]!=='object')throw Error('Нет настроек ожидания.');for(const cat of Object.keys(data.config[mode])){if(state.waits[mode][cat]===undefined)state.waits[mode][cat]=clone(data.config[mode][cat]);if(!validRange(state.waits[mode][cat]))throw Error('Некорректное время ожидания.')}}
 const ids=new Set();for(const o of state.orders){if(!Number.isSafeInteger(o.id)||o.id<1||ids.has(o.id)||!Number.isInteger(o.persons)||o.persons<1||o.persons>50||!Array.isArray(o.items)||o.items.length>100||!['active','delivered','closed'].includes(o.status)||typeof o.raw!=='string')throw Error('Повреждён заказ в файле.');ids.add(o.id);for(const r of o.items){if(!Number.isInteger(r.guest)||r.guest<1||r.guest>o.persons||!Number.isInteger(r.qty)||r.qty<1||r.qty>50||typeof r.query!=='string'||(r.dish!==null&&!byId[r.dish])||(r.weight!==undefined&&(!Number.isInteger(r.weight)||r.weight<1||r.weight>3000)))throw Error('Некорректная позиция заказа.');}}
 state.nextId=Math.max(Number.isSafeInteger(state.nextId)?state.nextId:1,1,...state.orders.map(o=>o.id+1));if(!ids.has(state.current))state.current=null;state.rush=!!state.rush;
 if(typeof state.stock.date!=='string'||!state.stock.items||typeof state.stock.items!=='object')throw Error('Повреждён стоп/гоу.');state.stock.revisions??={};state.stock.epoch??=0;
 for(const [id,s] of Object.entries(state.stock.items)){if(!byId[id]||!s||!['go','stop','limited'].includes(s.status)||(s.qty!==undefined&&s.qty!==null&&(!Number.isInteger(s.qty)||s.qty<0||s.qty>10000)))throw Error('Некорректный остаток.');if(Number.isInteger(s.qty))s.status=s.qty>0?'limited':'stop';if(s.status==='limited'&&!(s.qty>0))s.status='stop';}
 const steaks=state.stock.steaks;if(!steaks.weights||typeof steaks.weights!=='object')throw Error('Повреждены граммовки.');for(const [g,count] of Object.entries(steaks.weights))if(!/^\d{1,4}$/.test(g)||+g<1||+g>3000||!Number.isInteger(count)||count<1||count>1000)throw Error('Некорректная граммовка.');steaks.revisions??={};steaks.epoch??=0;
 for(const o of state.orders){for(const r of o.reservations||[])if(!r||!/^\d{1,4}$/.test(r.weight)||typeof r.date!=='string'||!Number.isInteger(r.epoch)||!Number.isInteger(r.revision))throw Error('Повреждено списание стейка.');for(const r of o.itemReservations||[])if(!r||!byId[r.dish]||!Number.isInteger(r.qty)||r.qty<1||typeof r.date!=='string'||!Number.isInteger(r.epoch)||!Number.isInteger(r.revision))throw Error('Повреждено списание остатка.');}
 daily(state);return state;
}
function daily(state){if(state.stock.date!==day())state.stock=emptyStock((state.stock.epoch||0)+1);state.stock.revisions??={};state.stock.epoch??=0;}
function duration(d,state){if(d.wait_override)return d.wait_override;return state.waits[state.rush?'rush':'normal'][d.category]||null}

const rank={cold:0,starter:0,oyster:0,soup:1,hot:2,dessert:3};
function plan(order,state){
 const queues=[],bread=[],drinks=[],unknown=[],special=[],say=[];
 for(let guest=1;guest<=order.persons;guest++){
  const food=[];
  for(const row of order.items.filter(i=>i.guest===guest)){
   const dish=byId[row.dish];if(!dish){unknown.push(row);continue}
   for(const text of dish.say||[])if(!say.includes(text))say.push(text);
   if(dish.category==='drink'){drinks.push(row);continue}
   if(['gift','event'].includes(dish.category)){special.push(row);continue}
   if(dish.category==='bread'){bread.push(row);continue}
   food.push(row);
  }
  // Stable category ordering; each individual serving gets its own course.
  food.sort((a,b)=>(rank[byId[a.dish].category]??0)-(rank[byId[b.dish].category]??0));
  const queue=food.flatMap(row=>Array.from({length:row.qty},()=>[{...row,qty:1}]));
  if(bread.some(row=>row.guest===guest)&&(!food[0]||(rank[byId[food[0].dish].category]??0)>0))queue.unshift([]);
  queues.push(queue);
 }
 const count=Math.max(bread.length?1:0,...queues.map(queue=>queue.length)),courses=[];
 for(let n=0;n<count;n++){
  const rows=queues.flatMap(queue=>queue[n]||[]),shared=n===0?bread:[];
  const times=[...rows,...shared].map(row=>duration(byId[row.dish],state)),known=times.filter(Boolean);
  courses.push({number:n+1,items:rows,shared,wait:known.length?[Math.max(...known.map(t=>t[0])),Math.max(...known.map(t=>t[1]))]:null,complete:times.every(Boolean)&&!unknown.length,finishedGuests:queues.flatMap((queue,i)=>n>0&&!queue[n]?[i+1]:[])});
 }
 const missing=Array.from({length:order.persons},(_,i)=>i+1).filter(g=>!order.items.some(r=>r.guest===g));
 const drinkTimes=drinks.map(r=>duration(byId[r.dish],state));
 const drinkWait=drinks.length&&drinkTimes.every(Boolean)?[Math.max(...drinkTimes.map(t=>t[0])),Math.max(...drinkTimes.map(t=>t[1]))]:null;
 return {courses,drinks,unknown,special,say,missing,drinkWait};
}
function formatWait(t){return t?(t[0]===t[1]?t[0]:t[0]+'–'+t[1])+' мин':'время не задано'}
function name(row){return (byId[row.dish]?.name||'Не распознано: '+row.query)+(row.weight?' · '+row.weight+' г':'')+(row.qty>1?' ×'+row.qty:'')}
function stockStatus(state,id,weight){daily(state);if(id==='marbled-steak'){const s=state.stock.steaks;return !s.updated?{status:'unknown'}:{status:(weight?s.weights[weight]>0:Object.values(s.weights).some(n=>n>0))?'go':'stop'}}return state.stock.items[id]||{status:'unknown'}}
function stockLabel(s){if(s.status==='limited')return 'Ограничение · осталось '+s.qty;if(s.status==='stop')return 'В стопе'+(s.qty===0?' · осталось 0':'');if(s.status==='go')return 'В наличии · без ограничений';return 'На сегодня не отмечено'}
function setStock(state,id,status,qty){
 daily(state);if(!byId[id]||id==='marbled-steak')throw Error('Выбери блюдо; стейки заполняются граммовками.');if(!['go','stop','limited','unknown'].includes(status))throw Error('Неизвестный статус.');
 if(qty!==undefined&&qty!==null&&(!Number.isInteger(qty)||qty<0||qty>10000))throw Error('Остаток — целое число от 0 до 10000.');
 if(status==='limited'&&!Number.isInteger(qty))throw Error('Для ограничения укажи количество.');
 state.stock.revisions[id]=(state.stock.revisions[id]||0)+1;
 if(status==='unknown'){delete state.stock.items[id];return}
 if(Number.isInteger(qty))state.stock.items[id]={status:qty>0?'limited':'stop',qty};
 else state.stock.items[id]=status==='stop'?{status:'stop',qty:0}:{status:'go',qty:null};
}
function adjustStock(state,id,delta){daily(state);const value=state.stock.items[id];if(!value||!Number.isInteger(value.qty))throw Error('Сначала задай ограничение числом.');setStock(state,id,'limited',Math.max(0,value.qty+delta));}
function clearStock(state,list){daily(state);for(const [id,value] of Object.entries(state.stock.items))if(list==='all'||(list==='stop'?value.status!=='go':value.status==='go'))setStock(state,id,'unknown');}

function steakCommand(state,text){
 const q=norm(text);daily(state);const s=state.stock.steaks;
 if(['0','стейк 0','стейки 0'].includes(q)){state.stock.steaks={updated:true,weights:{},revisions:{},epoch:s.epoch+1};return 'Стейки очищены.'}
 if(/[0-9][.,][0-9]/.test(text))throw Error('Граммовка должна быть целым числом.');
 const tokens=q.split(' '),allowed=['стейк','стейки','гоу','го','есть','стоп','не','нет','забрала','забрал','забрали','убрать','г','гр','грамм'],grams=tokens.filter(x=>/^\d+$/.test(x));
 if(!grams.length||grams.some(n=>+n<1||+n>3000))throw Error('Укажи граммовки: стейк 190 189 340 гоу. Или 0.');if(tokens.some(x=>!allowed.includes(x)&&!/^\d+$/.test(x)))throw Error('Для стейков нужны только граммовки и статус.');
 const stop=tokens.some(x=>['стоп','забрала','забрал','забрали','нет','убрать'].includes(x))&&!q.includes('не стоп'),counts={};for(const g of grams)counts[+g]=(counts[+g]||0)+1;
 for(const [g,count] of Object.entries(counts)){s.revisions[g]=(s.revisions[g]||0)+1;if(stop)delete s.weights[g];else s.weights[g]=count}s.updated=true;return (stop?'Убраны: ':'Добавлены: ')+Object.keys(counts).join(', ')+' г.';
}

function reconcile(state,order,previous){daily(state);const s=state.stock.steaks,old=clone(previous?.reservations||[]),kept=[],pending=[],warnings=[];for(const row of order.items){if(row.dish!=='marbled-steak')continue;if(!row.weight){warnings.push('Стейк: укажи граммовку — ничего не списано.');continue}for(let n=0;n<row.qty;n++){const i=old.findIndex(x=>x.weight===String(row.weight));if(i>=0)kept.push(old.splice(i,1)[0]);else pending.push(String(row.weight))}}
 for(const r of old)if(r.date===day()&&r.epoch===s.epoch&&r.revision===(s.revisions[r.weight]||0))s.weights[r.weight]=(s.weights[r.weight]||0)+1;
 for(const g of pending){if(s.weights[g]>0){if(--s.weights[g]===0)delete s.weights[g];kept.push({weight:g,date:day(),epoch:s.epoch,revision:s.revisions[g]||0})}else warnings.push('Стейк '+g+' г: '+(s.updated?'нет в гоу':'граммовки на сегодня не заполнены')+' — не списан.')}
 order.reservations=kept;order.warnings=[...new Set(warnings)];
}
function reconcileItems(state,order,previous){
 daily(state);const stock=state.stock,old=clone(previous?.itemReservations||[]),kept=[],requested=new Map();
 for(const row of order.items)if(row.dish&&row.dish!=='marbled-steak')requested.set(row.dish,(requested.get(row.dish)||0)+row.qty);
 for(const [id,amount] of requested){let need=amount;for(const r of old.filter(r=>r.dish===id)){const count=Math.min(need,r.qty);if(count){kept.push({...r,qty:count});r.qty-=count;need-=count}}requested.set(id,need)}
 for(const r of old)if(r.qty>0&&r.date===stock.date&&r.epoch===stock.epoch&&r.revision===(stock.revisions[r.dish]||0)){const v=stock.items[r.dish];if(v&&Number.isInteger(v.qty)){v.qty+=r.qty;v.status='limited'}}
 for(const [id,amount] of requested){if(!amount)continue;const v=stock.items[id];if(!v||v.status==='go')continue;
  const available=Number.isInteger(v.qty)?v.qty:0,take=Math.min(available,amount);if(take){v.qty-=take;v.status=v.qty?'limited':'stop';kept.push({dish:id,qty:take,date:stock.date,epoch:stock.epoch,revision:stock.revisions[id]||0})}
  if(take<amount)order.warnings.push(byId[id].name+': не хватает '+(amount-take)+' порц. — заказ сохранён с предупреждением.');
 }
 order.itemReservations=kept;
}
function saveOrder(state,text,editId=null){
 const next=clone(state),o=parseOrder(text),prev=editId?next.orders.find(o=>o.id===editId):null;
 if(editId&&(!prev||prev.status!=='active'))throw Error('Для исправления выбери активный заказ.');reconcile(next,o,prev);reconcileItems(next,o,prev);o.id=prev?prev.id:next.nextId++;
 if(prev)next.orders[next.orders.indexOf(prev)]=o;else next.orders.push(o);next.current=o.id;Object.assign(state,next);return o;
}
function setOrderStatus(state,id,status){const order=state.orders.find(o=>o.id===id);if(!order)throw Error('Заказ не найден.');if(status==='delivered'&&order.status==='active')order.status=status;else if(status==='closed'&&order.status==='delivered')order.status=status;else if(order.status!==status)throw Error('Сначала отметь «Заказ отдал».');}
function clearOrders(state){state.orders=[];state.current=null;}
function stockCommand(state,text,defaultStatus=null){
 if(typeof text!=='string'||text.length>6000)throw Error('Список слишком длинный.');const copy=clone(state);daily(copy);let messages=[];
 for(const line of text.split(/[;\n]+/).filter(x=>x.trim())){
  let q=norm(line);if(/^стейки?(?: |$)/.test(q)){messages.push(steakCommand(copy,line));continue}let status=defaultStatus,qty,query=q;
  if(/[0-9][.,][0-9]/.test(line))throw Error('Остаток должен быть целым числом.');
  if(/без огран/.test(q)){status='go';qty=null;query=q.replace(/без огран\S*/,'').trim()}
  else if(q.includes('не стоп')){status='go';query=q.replace('не стоп','').trim()}
  else{const prefix=q.match(/^(стоп|гоу|го|есть|нет)\s+(.+)$/),suffix=q.match(/^(.+)\s+(стоп|гоу|го|есть|нет)$/);if(prefix||suffix){const token=prefix?prefix[1]:suffix[2];status=['стоп','нет'].includes(token)?'stop':'go';query=prefix?prefix[2]:suffix[1]}
   const number=query.match(/^(.+?)\s+(\d+)(?:\s+(?:шот(?:а|ов)?|порц(?:ии|ий|ия)?|шт))?$/);if(number){qty=+number[2];status=qty?'limited':'stop';query=number[1]}
  }
  if(!status)throw Error('Напиши «ры стоп», «ры не стоп» или «ростбиф — 6».');let ids;
  if(['парик','пароконвектомат'].includes(query))ids=['57dcced6b5','214af081b8'];
  else if(['пицца вся','вся пицца','пицца','пи','п'].includes(query))ids=items.filter(d=>d.is_pizza).map(d=>d.id);
  else if(['фритюр','фри','фрит'].includes(query))throw Error('Картофеля фри нет в актуальном PDF. Стоп/гоу для него не изменён.');
  else{const found=resolve(query);if(found.dish)ids=[found.dish];else{const rows=segment(query,1);if(rows.some(r=>!r.dish)||!rows.length)throw Error('Не удалось однозначно распознать: '+query);ids=rows.map(r=>r.dish)}}
  if(Number.isInteger(qty)&&ids.length>1)throw Error('Укажи количество для каждого блюда отдельной строкой.');
  for(const id of new Set(ids)){setStock(copy,id,status,qty);messages.push(byId[id].name+' — '+stockLabel(stockStatus(copy,id)))}
 }if(!messages.length)throw Error('Напиши хотя бы одну позицию.');state.stock=copy.stock;return messages;
}
function commandType(text){const q=norm(text);if(/\d\s*:/.test(text))return 'order';if(['старт повыш','стоп повыш'].includes(q))return 'rush';if(text.includes('?'))return 'lookup';if(/^стейки?\s+/.test(q)&&/\d/.test(q))return 'steaks';if(/(?:^| )(?:стоп|гоу|го|есть|нет)(?: |$)|без огран|забрала|забрал/.test(q)||/\s\d+(?: (?:шот(?:а|ов)?|шт|порц(?:ии|ий|ия)?))?$/.test(q))return 'stock';return 'lookup'}
function orderWarnings(order,state){const warnings=[...(order.warnings||[])];for(const row of order.items){if(!row.dish||row.dish==='marbled-steak')continue;const stock=stockStatus(state,row.dish);const accounted=(order.itemReservations||[]).some(r=>r.dish===row.dish);if(stock.status==='stop'&&!accounted)warnings.push('В СТОПЕ: '+byId[row.dish].name)}return [...new Set(warnings)]}
function chooseDish(state,orderId,index,dish){if(!byId[dish])throw Error('Блюдо не найдено.');const previous=state.orders.find(o=>o.id===orderId);if(!previous||previous.status!=='active'||previous.items[index]?.dish!==null)throw Error('Позиция уже уточнена.');const next=clone(state),order=clone(previous);order.items[index]={...order.items[index],dish,query:byId[dish].name,choices:[]};order.raw=Array.from({length:order.persons},(_,i)=>(i+1)+': '+order.items.filter(r=>r.guest===i+1).map(r=>(r.qty>1?r.qty+'х ':'')+(r.weight?'стейк '+r.weight:r.dish?byId[r.dish].name:r.query)).join(', ')).join('\n');reconcile(next,order,previous);reconcileItems(next,order,previous);next.orders[next.orders.findIndex(o=>o.id===orderId)]=order;Object.assign(state,next);return order}

root.Waiter={data,items,byId,clone,norm,resolve,parseOrder,plan,duration,formatWait,name,day,newState,migrateState,daily,stockStatus,stockLabel,setStock,adjustStock,clearStock,steakCommand,saveOrder,stockCommand,reconcile,setOrderStatus,clearOrders,commandType,orderWarnings,chooseDish};
})(globalThis);
