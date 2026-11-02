const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../data.js');require('../engine.js');require('../storage.js');
const W=globalThis.Waiter;
const id=q=>{const r=W.resolve(q);assert.ok(r.dish,`Unresolved: ${q}`);return r.dish};
const roast=id('голубчики'),fish=id('рыбник'),stroganoff=id('бифштекс'),caesar=id('цез с крев');

test('November photographs define active names, prices and new recipe reminders',()=>{
 for(const [query,price] of [['тар гов',690],['холодец',520],['оливье',590],['похл',640],['уха',720],['голубчики',690],['щеки',920],['медовик',520],['павлова',490],['ч облепиха',420],['ч',340],['аптекарь',540],['цез с крев',660],['стейк',690]])assert.equal(W.byId[id(query)].price,price,query);
 for(const d of W.items)assert.equal(W.resolve(d.name).dish,d.id,d.name);
 assert.match(W.byId[id('холодец')].ingredients,/чеснок/i);
 const p=W.plan(W.parseOrder('1: уха, голубчки 2: оливе, щеки, черемух'),W.newState());
 assert.equal(p.unknown.length,0);assert.ok(p.say.some(t=>/чернила каракатицы/.test(t)));assert.ok(p.say.some(t=>/при гостях/.test(t)));assert.ok(p.say.some(t=>/пикантные/.test(t)));
 assert.notEqual(id('муксун сс'),id('муксун'));
 assert.equal(W.byId[id('пир судак')].price,220);
 assert.equal(W.byId[id('пельмени')].category,'hot');
 assert.ok(!W.byId[id('пельмени')].say.some(t=>/5 пельменей/.test(t)));
});
test('retired dishes stay out of new orders while previous orders remain readable',()=>{
 for(const query of ['чиз','ростбиф','консоме','бефст','сал зел']){const r=W.resolve(query);assert.equal(r.dish,null);assert.ok(r.retired.length,query);}
 const s=W.newState();s.schema=2;s.orders=[{id:1,persons:1,items:[{guest:1,query:'чиз',dish:'7b9d617765',qty:1}],raw:'1: чиз',status:'active',created:1}];s.current=1;
 const migrated=W.migrateState(s);assert.equal(migrated.orders.length,1);assert.match(W.name(migrated.orders[0].items[0]),/Баскский/);assert.ok(W.orderWarnings(migrated.orders[0],migrated).some(t=>/Больше нет/.test(t)));
 assert.throws(()=>W.setStock(migrated,'7b9d617765','go'));
});

test('abbreviations and typos retain the dish type, including author teas',()=>{
 for(const [query,expected] of [
  ['фетуч с крев','0afa9a075e'],['фетуч с крив','0afa9a075e'],['фетч с крев','0afa9a075e'],
  ['фетучини с криветками','0afa9a075e'],['цез с крев','e55b292258'],
  ['ч с ч','tea-black-thyme'],['ч облепиха','tea-seabuckthorn'],['ч клюква','tea-cranberry'],
  ['ч клювеный','tea-cranberry'],['сибирский сбор','tea-siberian'],['сибиркский сбор','tea-siberian'],
  ['оливе','olivier-omul'],['сал с мук','f6e82917cb'],['черемух','birdcherry-honeycake'],
 ])assert.equal(id(query),expected,query);
 assert.notEqual(id('фетуч с крев'),caesar);
 assert.equal(W.resolve('пи маргарита').dish,null);
 assert.equal(W.resolve('неизвестное кушанье').dish,null);
 assert.equal(W.resolve('цезарь').dish,null);
 assert.ok(W.resolve('цезарь').choices.length>=2);
});
test('order segmentation keeps multiword teas and dish modifiers together',()=>{
 assert.deepEqual(W.parseOrder('1: ч облепиха 2: ч клюква 3: сибирский сбор 4: ч с ч').items.map(r=>r.dish),['tea-seabuckthorn','tea-cranberry','tea-siberian','tea-black-thyme']);
 assert.deepEqual(W.parseOrder('1: фетуч с крев 2: цез с крев').items.map(r=>r.dish),['0afa9a075e','e55b292258']);
 assert.match(W.byId['tea-siberian'].ingredients,/смородины/);
 assert.match(W.byId['tea-siberian'].ingredients,/мелисс/i);
});
test('two hot meals for one guest go into successive synchronized courses',()=>{
 const p=W.plan(W.parseOrder('1: рыбник, бифштекс\n2: рыбник цез с крев'),W.newState());
 assert.deepEqual(p.courses.map(c=>c.items.map(r=>[r.guest,r.dish])),[[[1,fish],[2,caesar]],[[1,stroganoff],[2,fish]]]);
 assert.deepEqual(p.courses[0].wait,[20,25]);
 assert.equal(p.courses.every(c=>c.items.filter(r=>r.guest===1).length===1),true);
 const repeat=W.plan(W.parseOrder('1: 2х рыбник'),W.newState());
 assert.equal(repeat.courses.length,2);
});
test('bread starts the table; soups, hot meals and desserts follow; reminders survive',()=>{
 const s=W.newState(),p=W.plan(W.parseOrder('1: фетучини с цып ремесленый хлеб\n2: цезарь с цып утиная грудка ч шок торт'),s);
 assert.deepEqual(p.courses.map(c=>c.wait),[[15,20],[20,25],[10,15]]);
 assert.equal(p.courses[0].shared.length,1);assert.equal(p.drinks.length,1);
 assert.ok(p.say.some(x=>/су[- ]?вид/i.test(x)));
 const p2=W.plan(W.parseOrder('1: ремесленыц хлеб, уха, салат с уткой\n2: уха, оливье\n3: бифштекс, капучино'),s);
 assert.equal(p2.courses.length,2);assert.ok(p2.say.some(x=>/чернила каракатицы/.test(x)));
 s.rush=true;assert.deepEqual(W.plan(W.parseOrder('1: рыбник 2: оливье'),s).courses[0].wait,[50,50]);
});
test('numeric stock is limited, adjustable and becomes stop only at zero',()=>{
 const s=W.newState();W.stockCommand(s,'голубчики - 6');
 assert.deepEqual(W.stockStatus(s,roast),{status:'limited',qty:6,go:false});
 W.adjustStock(s,roast,-1);assert.equal(s.stock.items[roast].qty,5);
 W.setStock(s,roast,'limited',0);assert.equal(s.stock.items[roast].status,'stop');
 W.stockCommand(s,'голубчики не стоп');assert.deepEqual(s.stock.items[roast],{status:'available',qty:null,go:false});
 W.stockCommand(s,'н клубника 7');assert.equal(s.stock.items['tincture-strawberry'].qty,7);
 W.stockCommand(s,'н клубника без огран');assert.equal(s.stock.items['tincture-strawberry'].qty,null);
 assert.equal(W.commandType('голубчики - 6'),'stock');assert.equal(W.commandType('голубчики??'),'lookup');
});
test('stock batches are atomic, support equipment groups and reject malformed counts',()=>{
 const s=W.newState();W.stockCommand(s,'голубчики 6');const before=W.clone(s);
 assert.throws(()=>W.stockCommand(s,'голубчики 3\nневиданное кушанье стоп'));assert.deepEqual(s,before);
 assert.throws(()=>W.stockCommand(s,'голубчики 2.5'));assert.throws(()=>W.stockCommand(s,'стейк 190.5 гоу'));
 W.stockCommand(s,'парик стоп');assert.equal(s.stock.items[id('бифштекс')].status,'stop');assert.equal(s.stock.items[id('татин')].status,'stop');
 assert.throws(()=>W.stockCommand(s,'пицца вся стоп'));assert.equal(W.items.filter(d=>d.is_pizza).length,0);
 W.clearStock(s,'stop');assert.ok(Object.values(s.stock.items).every(v=>v.status==='available'&&!v.go));
});
test('accepting and editing an order consume limited portions exactly once',()=>{
 const s=W.newState();W.stockCommand(s,'голубчики 6');const o=W.saveOrder(s,'1: 2х голубчики');
 assert.equal(s.stock.items[roast].qty,4);W.plan(o,s);assert.equal(s.stock.items[roast].qty,4);
 W.saveOrder(s,'1: 2х голубчики',o.id);assert.equal(s.stock.items[roast].qty,4);
 W.saveOrder(s,'1: голубчики',o.id);assert.equal(s.stock.items[roast].qty,5);
 W.saveOrder(s,'1: рыбник',o.id);assert.equal(s.stock.items[roast].qty,6);
 W.saveOrder(s,'1: голубчики',o.id);assert.equal(s.stock.items[roast].qty,5);
 W.stockCommand(s,'голубчики 10');W.saveOrder(s,'1: рыбник',o.id);assert.equal(s.stock.items[roast].qty,10,'manual count takes precedence over old reservations');
});
test('shortages never go negative; clearing history does not undo served stock',()=>{
 const s=W.newState();W.stockCommand(s,'голубчики 1');const o=W.saveOrder(s,'1: 2х голубчики');
 assert.equal(s.stock.items[roast].qty,0);assert.ok(o.warnings.some(t=>/не хватает 1/.test(t)));
 W.saveOrder(s,'1: 2х голубчики',o.id);assert.equal(s.stock.items[roast].qty,0);
 W.setOrderStatus(s,o.id,'delivered');W.setOrderStatus(s,o.id,'closed');
 assert.throws(()=>W.saveOrder(s,'1: рыбник',o.id));
 W.clearOrders(s);assert.equal(s.stock.items[roast].qty,0);
 assert.equal(W.saveOrder(s,'1: рыбник').id,o.id+1);
});
test('steak portions are reserved, edits are idempotent, and daily inventory expires',()=>{
 const s=W.newState();W.steakCommand(s,'стейк 190 190 340 гоу');
 const o=W.saveOrder(s,'1: стейк 190');assert.equal(s.stock.steaks.weights[190],1);
 W.saveOrder(s,'1: стейк 190',o.id);assert.equal(s.stock.steaks.weights[190],1);
 W.saveOrder(s,'1: рыбник',o.id);assert.equal(s.stock.steaks.weights[190],2);
 W.steakCommand(s,'стейк забрала 190');assert.equal(s.stock.steaks.weights[190],undefined);
 W.stockCommand(s,'голубчики 6');s.stock.date='2000-01-01';W.daily(s);
 assert.equal(Object.keys(s.stock.items).length,0);assert.equal(s.stock.steaks.updated,false);
});
test('unknown choice keeps steak shorthand editable without taking a second steak',()=>{
 const s=W.newState();W.steakCommand(s,'стейк 190 190 гоу');const o=W.saveOrder(s,'1: стейк 190, цезарь');
 const index=o.items.findIndex(r=>r.dish===null);assert.ok(index>=0);
 W.chooseDish(s,o.id,index,caesar);const chosen=s.orders[0];assert.match(chosen.raw,/стейк 190/);
 W.saveOrder(s,chosen.raw,o.id);assert.equal(s.stock.steaks.weights[190],1);
});
test('schema migration preserves old shifts and rejects invalid imports',()=>{
 const s=W.newState();W.saveOrder(s,'1: рыбник');s.schema=1;s.stock.items[roast]={status:'go',qty:6};delete s.revision;
 const result=W.migrateState(s);assert.equal(result.schema,3);assert.equal(result.orders.length,1);assert.equal(result.stock.items[roast].status,'limited');assert.equal(result.stock.items[roast].go,true);
 assert.throws(()=>W.migrateState({}));s.waits.normal.hot=[90,20];assert.throws(()=>W.migrateState(s));
 const unchanged=W.newState();assert.throws(()=>W.saveOrder(unchanged,'1: ры 1: черемух'));assert.equal(unchanged.orders.length,0);
});

function memory(){const values=new Map();return {values,getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)}}
test('removing a stop does not promote a dish to the independent go list',()=>{
 const s=W.newState();W.stockCommand(s,'ры стоп');W.stockCommand(s,'ры не стоп');
 assert.equal(s.stock.items[fish].status,'available');assert.equal(s.stock.items[fish].go,false);
 W.stockCommand(s,'ры гоу');assert.equal(s.stock.items[fish].go,true);
 W.stockCommand(s,'ры не гоу');assert.equal(s.stock.items[fish].go,false);assert.equal(s.stock.items[fish].status,'available');
 W.stockCommand(s,'голубчики 6');W.stockCommand(s,'голубчики гоу');assert.equal(s.stock.items[roast].qty,6);assert.equal(s.stock.items[roast].go,true);
 W.clearStock(s,'go');assert.equal(s.stock.items[roast].qty,6);assert.equal(s.stock.items[roast].status,'limited');assert.equal(s.stock.items[roast].go,false);
 W.stockCommand(s,'голубчики гоу');W.clearStock(s,'stop');assert.equal(s.stock.items[roast].qty,null);assert.equal(s.stock.items[roast].go,true);
});
test('go promotion alone does not invalidate portion accounting when editing',()=>{
 const s=W.newState();W.stockCommand(s,'голубчики 6');const o=W.saveOrder(s,'1: голубчики');W.stockCommand(s,'голубчики гоу');
 W.saveOrder(s,'1: рыбник',o.id);assert.equal(s.stock.items[roast].qty,6);assert.equal(s.stock.items[roast].go,true);
});
test('storage serializes rapid changes and independent tabs read latest data',async()=>{
 const storage=memory(),a=new StateStore(storage,'test',null),b=new StateStore(storage,'test',null);
 await Promise.all([a.transaction(s=>W.saveOrder(s,'1: рыбник')),a.transaction(s=>W.saveOrder(s,'1: черемух')),b.transaction(s=>W.saveOrder(s,'1: оливье'))]);
 const s=a.read();assert.equal(s.orders.length,3);assert.equal(new Set(s.orders.map(o=>o.id)).size,3);assert.equal(s.revision,3);
});
test('failed persistence and invalid changes do not report success or damage the shift',async()=>{
 const storage=memory(),a=new StateStore(storage,'test',null);await a.transaction(s=>W.stockCommand(s,'голубчики 6'));
 const before=a.read();await assert.rejects(a.transaction(s=>{s.orders.push({});}));assert.deepEqual(a.read(),before);
 const write=storage.setItem;storage.setItem=(key,value)=>{if(key==='test')throw Error('Quota exceeded');write(key,value)};
 await assert.rejects(a.transaction(s=>W.saveOrder(s,'1: голубчики')));assert.deepEqual(a.value,before);assert.deepEqual(a.read(),before);
});
test('damaged main record recovers backup; import is validated before replacing data',async()=>{
 const storage=memory(),a=new StateStore(storage,'test',null);await a.transaction(s=>W.stockCommand(s,'голубчики 6'));await a.transaction(s=>W.saveOrder(s,'1: рыбник'));
 storage.setItem('test','{broken');const b=new StateStore(storage,'test',null);
 assert.ok(b.warning);assert.equal(b.value.stock.items[roast].qty,6);assert.equal(storage.getItem('test-damaged'),'{broken');
 await assert.rejects(b.restore({schema:999}));assert.equal(storage.getItem('test'),'{broken');
 const valid=W.newState();W.saveOrder(valid,'1: ч с ч');await b.restore(valid);assert.equal(b.value.orders[0].items[0].dish,'tea-black-thyme');
});
