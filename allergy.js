/* Ingredient exclusions use restaurant recipes; they are not an allergy clearance. */
(function(root){
'use strict';
const W=root.Waiter;
const rules=[
 ['lactose','лактоза',/^лактоз\S*$/, /лактоз[а-я]*/gi],
 ['soy','соя',/^(соя|сои|сою|соев\S*(?: соус)?|соус соев\S*)$/, /со(?:я|и|ю|ей)(?=$|[^а-я])|соев[а-я]*(?:\s+соус[а-я]*)?|\bsoy\b|мисо(?:[ -]паста)?|терияки|тофу|эдамаме|шою/gi],
 ['green-onion','зелёный лук',/^(зелен\S* лук\S*|лук\S* зелен\S*|зел лук|лук зел)$/, /зелен[а-я]*\s+лук[а-я]*|лук[а-я]*\s+зелен[а-я]*/gi],
 ['onion','лук',/^(лук|лука|лук\S* репчат\S*|репчат\S* лук\S*)$/, /лук[а-я]*|шалот|порей/gi],
 ['garlic','чеснок',/^чеснок\S*$/, /чесно[а-я]*/gi],
 ['milk','молоко / молочные продукты',/^(молок\S*|молоч\S*(?: продукт\S*)?|сыр|сливки)$/, /лактоз[а-я]*|молок[а-я]*|молочн[а-я]*|сливк[а-я]*|сливочн[а-я]*|сметан[а-я]*|сыр[а-я]*|пармезан[а-я]*|маскарпоне|кремет[а-я]*|брынз[а-я]*|фет(?:а|ы|е|у|ой)(?=$|[^а-я])|йогурт[а-я]*|морожен[а-я]*|казеин[а-я]*|сыворот[а-я]*|кефир[а-я]*|ряжен[а-я]*|творог[а-я]*|творож[а-я]*/gi],
 ['eggs','яйца',/^(яйц\S*|яич\S*|желт\S*|белок)$/, /яйц[а-я]*|яич[а-я]*|желт[а-я]*|белок|белк[а-я]*|меланж|майонез[а-я]*/gi],
 ['fish','рыба',/^(рыб\S*)$/, /рыб[а-я]*|фиш[ -]?соус|анчоус[а-я]*|муксун[а-я]*|омул[а-я]*|нельм[а-я]*|осетр[а-я]*|судак[а-я]*|щук[а-я]*|щуч[а-я]*|лосос[а-я]*|семг[а-я]*|икр[а-я]*/gi],
 ['crustaceans','креветки / ракообразные',/^(крев\S*|ракообраз\S*|краб\S*)$/, /кревет[а-я]*|краб[а-я]*|ракообраз[а-я]*|лангуст[а-я]*|омар[а-я]*/gi],
 ['molluscs','моллюски',/^(моллюск\S*|устриц\S*|каракатиц\S*)$/, /моллюск[а-я]*|устриц[а-я]*|каракатиц[а-я]*|миди[а-я]*|кальмар[а-я]*|осьминог[а-я]*/gi],
 ['gluten','глютен / пшеница',/^(глютен\S*|пшениц\S*|пшенич\S*)$/, /пшен[а-я]*|семол[а-я]*|рожь|ржи|ржан[а-я]*|ячмен[а-я]*|булгур[а-я]*|кускус|сухар[а-я]*|гренк[а-я]*|хлеб[а-я]*|фет[т]?учин[а-я]*|спагетти|лапш[а-я]*|овес|овсян[а-я]*|полб[а-я]*|спельт[а-я]*|солод[а-я]*|сейтан/gi],
 ['nuts','орехи',/^(орех\S*|миндал[а-я]*|фундук[а-я]*|фисташ[а-я]*|кешью|пекан|макадами[а-я]*|грецк[а-я]* орех[а-я]*|кедров[а-я]* орех[а-я]*)$/, /орех[а-я]*|миндал[а-я]*|фундук[а-я]*|фисташ[а-я]*|кешью|пекан|макадами[а-я]*|кедров[а-я]*/gi],
 ['peanuts','арахис',/^арахис\S*$/, /арахис[а-я]*/gi],
 ['sesame','кунжут',/^кунжут\S*$/, /кунжут[а-я]*|тахини/gi],
 ['mustard','горчица',/^горчиц\S*$/, /горчиц[а-я]*|горчич[а-я]*/gi],
 ['celery','сельдерей',/^сельдер\S*$/, /сельдер[а-я]*/gi],
 ['pepper','перец',/^пер(?:ец|ца|цем|ц[а-я]*)$/, /перец|перца|перцем|перч[а-я]*|паприк[а-я]*|чили|табаско/gi],
 ['cucumber','огурец',/^огур[а-я]*$/, /огур[а-я]*/gi],
 ['tomato','томаты',/^(томат[а-я]*|помидор[а-я]*)$/, /томат[а-я]*|помидор[а-я]*/gi],
 ['mushroom','грибы',/^гриб[а-я]*$/, /гриб[а-я]*|грузд[а-я]*|вешен[а-я]*|эринг[а-я]*|шампиньон[а-я]*|трюфел[а-я]*/gi],
 ['dill','укроп',/^укроп[а-я]*$/, /укроп[а-я]*/gi],
 ['coriander','кинза / кориандр',/^(кинз[а-я]*|кориандр[а-я]*)$/, /кинз[а-я]*|кориандр[а-я]*/gi],
 ['lupin','люпин',/^люпин[а-я]*$/, /люпин[а-я]*/gi],
 ['sulphites','сульфиты',/^(сульфит[а-я]*|диоксид серы|двуокись серы|е ?22[0-8]|e ?22[0-8])$/, /сульфит[а-я]*|диоксид[а-я]* серы|двуокись серы|[еe] ?22[0-8](?=$|[^0-9])/gi],
 ['citrus','цитрусовые',/^(цитрус[а-я]*|лимон[а-я]*|апельсин[а-я]*|мандарин[а-я]*|лайм[а-я]*|грейпфрут[а-я]*)$/, /цитрус[а-я]*|лимон[а-я]*|апельсин[а-я]*|мандарин[а-я]*|лайм[а-я]*|грейпфрут[а-я]*|кумкват[а-я]*|помело|юдзу/gi],
 ['strawberry','клубника / земляника',/^(клубник[а-я]*|клубнич[а-я]*|земляник[а-я]*)$/, /клубни[а-я]*|земляни[а-я]*/gi],
 ['cocoa','какао / шоколад',/^(какао|шоколад[а-я]*)$/, /какао|шоколад[а-я]*/gi],
 ['kiwi','киви',/^киви$/, /киви/gi],
 ['legumes','бобовые',/^(бобов[а-я]*|горох[а-я]*|горош[а-я]*|нут|чечевиц[а-я]*|фасол[а-я]*)$/, /бобов[а-я]*|горох[а-я]*|горош[а-я]*|нут(?:а|ом|овый)?(?=$|[^а-я])|хумус|чечевиц[а-я]*|фасол[а-я]*|соев[а-я]*|соя|тофу|эдамаме|арахис[а-я]*|люпин[а-я]*/gi],
 ['honey','мёд',/^мед(?:а)?$/, /мед(?:а|ом|овый|овая|овое)?(?=$|[^а-я])/gi]
];
function parse(text){
 if(typeof text!=='string'||text.length>300)throw Error('Исключения — до 300 символов.');
 const raw=text.toLowerCase().replace(/ё/g,'е').replace(/аллерги[яию]\s*(?:на)?\s*/g,'').replace(/исключить\s*/g,'').replace(/без\s+/g,'').split(/[,;\n/+]|\s+и\s+/).map(x=>W.norm(x)).filter(Boolean);
 const result=[];
 for(const token of raw){const rule=rules.find(r=>r[2].test(token));const entry=rule?{key:rule[0],label:rule[1],known:true}:{key:'custom:'+token,label:token,known:false};if(!result.some(r=>r.key===entry.key))result.push(entry);}
 return result;
}
function recipe(d){return [d.name,d.ingredients,d.description,d.preparation,d.serving,...(d.say||[])].filter(Boolean).join('\n').toLowerCase().replace(/ё/g,'е');}
function assess(d,restrictions){
 const text=recipe(d),found=[],uncertain=[];
 for(const restriction of restrictions){
  const rule=rules.find(r=>r[0]===(restriction.key==='lactose'?'milk':restriction.key));let matches=[];
  if(rule){const re=new RegExp(rule[3].source,rule[3].flags);matches=[...text.matchAll(re)].filter(m=>m.index===0||!/[а-яa-z]/.test(text[m.index-1])).map(m=>m[0]);}
  else {const tokens=restriction.label.split(' ').filter(Boolean);if(tokens.length&&tokens.every(t=>W.norm(text).split(' ').some(w=>w===t||(t.length>=4&&w.startsWith(t)))))matches=[restriction.label];else uncertain.push('Не найдено точного совпадения для «'+restriction.label+'»; проверь состав.');}
  if(restriction.key==='lactose'&&/лактоз[а-я]*/.test(text))matches.push(...text.match(/лактоз[а-я]*/g));
  if(restriction.key==='sulphites'&&!matches.length&&/(вино|винн[а-я]*|игрист[а-я]*|изюм|кураг[а-я]*|чернослив|сухофрукт[а-я]*)/.test(text))uncertain.push('Вино или сухофрукты: наличие сульфитов нужно проверить по этикетке.');
  if(matches.length)found.push({key:restriction.key,label:restriction.label,evidence:[...new Set(matches)].slice(0,4)});
  if(restriction.key==='green-onion'&&!matches.length&&/(?:^|[^а-я])лук(?:а|ом|ов[а-я]*)?(?:$|[^а-я])/.test(text)&&!/(репчат|красн|севок|шалот)/.test(text))uncertain.push('В скрипте указан лук без уточнения вида.');
 }
 const missing=!d.ingredients||/(полный|полная|полного|полную).{0,55}(не указан|не привед|не предостав|не подтвержд)|рецептур.{0,45}не привед|состав.{0,40}(не указан|не привед|обрывается)|расхожд|уточни.{0,25}(зелень|начинку|состав)|отличаются/i.test([d.ingredients,...(d.notes||[])].join(' '));
 if(missing)uncertain.push('Состав неполный или есть расхождения в скрипте.');
 return {status:found.length?'contains':uncertain.length?'unknown':'not_listed',found,uncertain:[...new Set(uncertain)]};
}
function categoryQuery(query){const q=W.norm(query);if(/салат|^сал$/.test(q))return 'Салаты';if(/суп|бульон|уха|похлеб/.test(q))return 'Супы';if(/десерт|сладк/.test(q))return 'Десерты';if(/горяч/.test(q))return 'hot';if(/закуск/.test(q))return 'cold';if(/напит|чай|кофе/.test(q))return 'drink';return '';}
function recommend(state,text,category='',query=''){
 const restrictions=parse(text),scope=category||categoryQuery(query),found=W.resolve(query.replace(/[?]/g,''));
 const list=W.items.filter(d=>!['gift','event'].includes(d.category)&&(!scope||d.section===scope||d.category===scope));
 const result={restrictions,not_listed:[],unknown:[],contains:[],stopped:0};
 for(const d of list){if(!scope&&query&&W.commandType(query)!=='order'&&found.dish&&d.category!==W.byId[found.dish].category)continue;if(W.stockStatus(state,d.id).status==='stop'){result.stopped++;continue;}const assessment=assess(d,restrictions);result[assessment.status].push({dish:d,assessment});}
 return result;
}
function orderChecks(order){const restrictions=parse(order.exclusionsText||'');if(!restrictions.length)return [];return order.items.map(row=>({row,dish:W.byId[row.dish],assessment:row.dish?assess(W.byId[row.dish],restrictions):{status:'unknown',found:[],uncertain:['Блюдо не распознано.']}}));}
root.Allergy={parse,assess,recommend,orderChecks,categoryQuery,catalog:rules.map(r=>({key:r[0],label:r[1]}))};
})(globalThis);
