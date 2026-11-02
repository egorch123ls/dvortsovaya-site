const {test}=require('node:test'),assert=require('node:assert/strict');
require('../data.js');require('../engine.js');require('../stopnotes.js');require('../allergy.js');
const W=Waiter,N=StopNotes;
test('categorized stop notes replace legacy stop/go, preserve steaks and affect recommendations and orders',()=>{
 const s=W.newState();W.stockCommand(s,'рыбник гоу');W.steakCommand(s,'стейк 190 гоу');
 const result=N.apply(s,{'Салаты':'сал с уткой, оливье','Горячее':'бифштекс'});
 assert.equal(result.unknown.length,0);assert.equal(W.stockStatus(s,W.resolve('рыбник').dish).status,'unknown');
 assert.equal(W.stockStatus(s,W.resolve('оливье').dish).status,'stop');assert.equal(s.stock.steaks.weights[190],1);
 const order=W.saveOrder(s,'1 оливье');assert.ok(W.orderWarnings(order,s).some(t=>/стоп/i.test(t)));
 assert.ok(!Allergy.recommend(s,'соя','Салаты').not_listed.some(x=>x.dish.id==='olivier-omul'));
 N.apply(s,{'Салаты':'сал с уткой'});assert.equal(W.stockStatus(s,'olivier-omul').status,'unknown');
});
test('note autosave does not restore portions consumed by orders and accepts intentional count edits',()=>{
 const s=W.newState(),id=W.resolve('рыбник').dish;N.apply(s,{'Горячее':'рыбник — 6'});
 W.saveOrder(s,'1 рыбник');assert.equal(W.stockStatus(s,id).qty,5);
 N.apply(s,{'Горячее':'рыбник — 6','Салаты':'оливье'});assert.equal(W.stockStatus(s,id).qty,5);
 N.apply(s,{'Горячее':'рыбник — 4'});assert.equal(W.stockStatus(s,id).qty,4);
 assert.equal(W.migrateState(W.clone(s)).stock.notes['Горячее'],'рыбник — 4');
 const unknown=N.apply(s,{'Горячее':'блюдо которого нет'});assert.equal(unknown.unknown.length,1);
 assert.equal(W.stockStatus(s,id).status,'unknown');
 const invalid=W.clone(s);invalid.stock.notes={'Горячее':1};assert.throws(()=>W.migrateState(invalid));
 s.stock.date='2000-01-01';W.daily(s);assert.equal(s.stock.notes,undefined);
});
test('tongue salad inherits confirmed dressing and excludes roast beef',()=>{
 const d=W.byId['salad-tongue'];assert.match(d.ingredients,/Говяжий язык/);assert.match(d.ingredients,/печёный перец/);
 assert.doesNotMatch(d.ingredients,/Ростбиф|тонкий край/i);
 for(const q of ['соя','кунжут','горчица'])assert.equal(Allergy.assess(d,Allergy.parse(q)).status,'contains');
 const duck=W.plan(W.parseOrder('1 утиная грудка'),W.newState());assert.ok(duck.say.some(s=>/технологии су-вид.*medium.*не кровь/.test(s)));
});
test('featured recommendations show two hot meals and salads, filtering stops and allergens',()=>{
 const s=W.newState(),r=Allergy.featured(s,'');assert.deepEqual(r.hot.map(x=>x.dish.id),['999668215a','cheeks-vegetables']);assert.equal(r.salads.length,2);
 StopNotes.apply(s,{'Горячее':'рыбник','Салаты':'оливье'});
 const filtered=Allergy.featured(s,'соя');for(const row of [...filtered.hot,...filtered.salads]){assert.notEqual(row.dish.id,'999668215a');assert.notEqual(row.dish.id,'olivier-omul');assert.equal(row.assessment.status,'not_listed');}
 assert.ok(!filtered.salads.some(r=>r.dish.id==='salad-tongue'));assert.ok(filtered.unknown.some(r=>r.dish.id==='cheeks-vegetables'));
});
test('single note field resolves category context, infers bar, and creates only populated groups',()=>{
 const text='Салаты: муксун\nГорячее: биштекс стоп\nНастойка клубника 7\nСупы: уха';
 const s=W.newState(),r=N.applyText(s,text);assert.equal(r.unknown.length,0);
 assert.equal(r.entries.f6e82917cb.section,'Салаты');assert.equal(r.entries['214af081b8'].section,'Горячее');
 assert.equal(r.entries['tincture-strawberry'].qty,7);assert.equal(r.entries['tincture-strawberry'].section,'Бар');assert.equal(r.entries['ukha-oil'].section,'Горячее');
 assert.equal(N.textFor(W.migrateState(W.clone(s))),text);
 W.saveOrder(s,'1 н клубника');N.applyText(s,text);assert.equal(W.stockStatus(s,'tincture-strawberry').qty,6);
 N.applyText(s,'');assert.deepEqual(s.stock.items,{});assert.equal(Object.keys(N.parseText('').entries).length,0);
 assert.equal(N.parseText('Салаты: утиная грудка').unknown.length,1,'salad context cannot stop the hot duck dish');
 assert.throws(()=>N.parseText('x'.repeat(12001)));
});
test('recommendations cover food, cocktails, nonalcoholic drinks and two wines of each color',()=>{
 const s=W.newState(),r=Allergy.featured(s);
 for(const [key] of Allergy.featuredSections)assert.equal(r[key].length,2,key);
 assert.deepEqual(r.cocktails.map(x=>x.dish.id),['cocktail-storyteller','cocktail-merchant']);
 assert.ok(r.soft.every(x=>/Безалкогольный/.test(x.dish.description)));
 assert.ok(r.red.every(x=>/Красн/.test(x.dish.wine_type)));assert.ok(r.white.every(x=>/Бел/.test(x.dish.wine_type)));
 N.applyText(s,'Настойка клубника стоп');const after=Allergy.featured(s,'лактоза');assert.ok(after.tinctures.every(x=>x.dish.id!=='tincture-strawberry'));
 assert.equal(Allergy.featured(s,'сульфиты').red.length,0);assert.ok(Allergy.featured(s,'сульфиты').unknown.some(x=>x.dish.id==='wine-chianti'));
});
