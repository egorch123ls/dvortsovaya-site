const {test}=require('node:test');const assert=require('node:assert/strict');
require('../data.js');require('../engine.js');require('../allergy.js');require('../storage.js');
const W=Waiter,A=Allergy,ids=entries=>entries.map(e=>e.dish.id);
test('soy includes soy sauce in salad dressing and chicken marinade',()=>{
 const r=A.recommend(W.newState(),'соя','Салаты');
 assert.ok(ids(r.contains).includes('5e30e7d68b'));assert.ok(ids(r.contains).includes('0a30d26be2'));
 assert.ok(r.contains.every(x=>x.assessment.found.some(f=>f.evidence.some(e=>/соев/.test(e)))));
 assert.ok(ids(r.not_listed).includes('olivier-omul'));assert.ok(ids(r.not_listed).includes('e55b292258'));
 assert.ok(ids(r.contains).includes('salad-tongue'));assert.ok(ids(r.unknown).includes('f6e82917cb'));
 assert.ok(!ids(r.not_listed).includes('5e30e7d68b'));
 for(const ingredient of ['Соя', 'соевый соус', 'мисо-паста', 'тофу', 'терияки'])assert.equal(A.assess({name:'Тест',ingredients:ingredient},A.parse('соя')).status,'contains');
 assert.equal(A.parse('соевый соус')[0].key,'soy');assert.equal(A.parse('аллергия на сою')[0].key,'soy');
});
test('green onion is checked in garnish and soup emulsion, without equating all onions',()=>{
 const terms=A.parse('зелёный лук');
 for(const id of ['olivier-omul','rye-chowder','ukha-oil'])assert.equal(A.assess(W.byId[id],terms).status,'contains');
 const dish={name:'Тест',ingredients:'Красный лук, картофель.',notes:[]};
 assert.equal(A.assess(dish,terms).status,'not_listed');assert.equal(A.assess(dish,A.parse('лук')).status,'contains');
 assert.equal(A.assess({name:'Салат',ingredients:'Луковый хлеб, масло.'},terms).status,'unknown');
});
test('multiple restrictions combine, query selects salads and stops are excluded',()=>{
 const state=W.newState(),r=A.recommend(state,'соя, зелёный лук','','хочу салат');
 assert.equal(r.restrictions.length,2);assert.ok(ids(r.contains).includes('olivier-omul'));assert.ok(ids(r.contains).includes('0a30d26be2'));
 for(const group of ['not_listed','unknown','contains'])assert.ok(r[group].every(e=>e.dish.section==='Салаты'));
 W.stockCommand(state,'оливье стоп');const after=A.recommend(state,'соя','Салаты');assert.ok(!ids(after.not_listed).includes('olivier-omul'));assert.equal(after.stopped,1);
});
test('unrecognized exclusions and incomplete recipes never become confirmed candidates',()=>{
 assert.equal(A.assess(W.byId['olivier-omul'],A.parse('сойа')).status,'unknown');
 assert.equal(A.assess({name:'Тест',ingredients:'Мясо, соус.',notes:['Полный состав соуса не указан.']},A.parse('соя')).status,'unknown');
 assert.throws(()=>A.parse('а'.repeat(301)));
 assert.deepEqual(A.parse('соя; сою; соевый соус').map(x=>x.key),['soy']);
 const synthetic={name:'Тест',ingredients:'Фетучини, томаты.'};assert.equal(A.assess(synthetic,A.parse('молоко')).status,'not_listed');
});
test('order exclusions persist across edit and migration, and warn on conflicting dishes',()=>{
 const s=W.newState(),order=W.saveOrder(s,'1: цез с цып 2: оливье',null,{exclusionsText:'соя, зелёный лук'});
 assert.equal(A.orderChecks(order).filter(x=>x.assessment.status==='contains').length,2);
 W.saveOrder(s,'1: цез с цып',order.id);assert.equal(s.orders[0].exclusionsText,'соя, зелёный лук');
 const restored=W.migrateState(JSON.parse(JSON.stringify(s)));assert.equal(restored.orders[0].exclusionsText,'соя, зелёный лук');
 W.saveOrder(s,'1: цез с цып',order.id,{exclusionsText:''});assert.equal(A.orderChecks(s.orders[0]).length,0);
 assert.equal(W.saveOrder(s,'1: рыбник').exclusionsText,'','new order does not inherit previous guest restrictions');
 const before=W.clone(s);assert.throws(()=>W.saveOrder(s,'1: рыбник',null,{exclusionsText:'x'.repeat(301)}));assert.deepEqual(s,before);
});

test('thirty supported groups recognize expanded exclusions and compound ingredients',()=>{
 assert.equal(A.catalog.length,30);
 for(const [query,ingredient] of [['лактоза','Сметана'],['молоко','Сыворотка'],['люпин','Люпиновая мука'],['сульфиты','E220'],['цитрусовые','Кумкват'],['клубника','Земляничное пюре'],['какао','Шоколадный крем'],['киви','Киви'],['бобовые','Бланшированный горошек'],['глютен','Овсяная мука'],['миндаль','Миндальная мука']]){
  const terms=A.parse(query);assert.equal(terms[0].known,true,query);
  assert.equal(A.assess({name:'Тест',ingredients:ingredient},terms).status,'contains',query);
 }
 assert.equal(A.parse('лактоза')[0].key,'lactose');assert.equal(A.parse('молоко')[0].key,'milk');
 assert.equal(A.assess({name:'Вино',ingredients:'Виноград'},A.parse('сульфиты')).status,'unknown');
 assert.equal(A.assess({name:'Молоко безлактозное',ingredients:'Безлактозное коровье молоко'},A.parse('молоко')).status,'contains');
});

test('guest numbers without colon support newlines, edits and preserve quantities and steak weights',()=>{
 const plain=W.parseOrder('1 рыбник, бифштекс\n2 рыбник цез с крев');
 const colon=W.parseOrder('1: рыбник, бифштекс 2: рыбник цез с крев');
 assert.deepEqual(plain.items,colon.items);assert.equal(plain.persons,2);
 assert.equal(W.commandType('1 рыбник\n2 цез с крев'),'order');
 assert.equal(W.commandType('исправить 1 рыбник\n2 цез с крев'),'order');
 assert.equal(W.parseOrder('1\nрыбник\n2\nцез с крев').items.length,2);
 assert.equal(W.parseOrder('1 рыбник\n2: цез с крев').items.length,2);
 const weight=W.parseOrder('1 стейк 190\n2 2x рыбник');
 assert.equal(weight.items[0].weight,190);assert.equal(weight.items[1].qty,2);
 assert.equal(W.parseOrder('1 рыбник\n2 x рыбник').persons,1);
 assert.equal(W.commandType('ростбиф 6'),'stock');assert.equal(W.commandType('стейк 190 гоу'),'steaks');
 assert.throws(()=>W.parseOrder('1 рыбник\n1 чиз'));
 assert.throws(()=>W.parseOrder('1 рыбник\n2'));
});
test('current honey correction excludes tatin and retains sea buckthorn tea',()=>{
 const terms=A.parse('мёд');assert.equal(A.assess(W.byId['57dcced6b5'],terms).status,'contains');assert.equal(A.assess(W.byId['tea-seabuckthorn'],terms).status,'not_listed');
 const r=A.recommend(W.newState(),'мёд');assert.ok(ids(r.contains).includes('57dcced6b5'));assert.ok(ids(r.not_listed).includes('tea-seabuckthorn'));assert.ok(!ids(r.contains).includes('tea-seabuckthorn'));
 const order=W.saveOrder(W.newState(),'1 татин 2 ч облепиха',null,{exclusionsText:'мёд'});const checks=A.orderChecks(order);assert.equal(checks.filter(r=>r.assessment.status==='contains').length,1);assert.equal(checks.find(r=>r.assessment.status==='contains').dish.id,'57dcced6b5');
});
