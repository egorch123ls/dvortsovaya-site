/* Free-form daily stop notes, linked to menu availability. */
(function(root){
'use strict';const W=root.Waiter;
const sections=['Салаты','Горячее','Закуски и хлеб','Супы','Десерты','Бар','Настойки','Другое'];
function validate(notes){if(!notes||typeof notes!=='object'||Array.isArray(notes))throw Error('Некорректные заметки стопа.');for(const [section,text] of Object.entries(notes))if(!sections.includes(section)||typeof text!=='string'||text.length>3000)throw Error('Заметка раздела — до 3000 символов.');return notes;}
function group(d){if(d.section==='Салаты')return 'Салаты';if(['hot','soup'].includes(d.category))return 'Горячее';if(d.category==='dessert')return 'Десерты';if(d.category==='drink')return 'Бар';return 'Закуски и хлеб';}
function resolve(q,section){const typed=/^(?:настойк[аи]?|н)\s+/i.test(q)?q.replace(/^настойк[аи]?\s+/i,'н '):q;const prefix=section==='Салаты'?'салат ':section==='Настойки'?'настойка ':'';const contextual=prefix?W.resolve(prefix+typed):null;return contextual?.dish?contextual:W.resolve(typed);}
function parseRows(rows){const entries={},unknown=[];for(const {section,raw} of rows){let q=raw.trim().replace(/^[-•]\s*/,'').replace(/\s+стоп$/i,'');if(!q)continue;const amount=q.match(/^(.*?)\s*(?:[-—–:]\s*|\s+)(\d{1,5})\s*(?:шт|порций|шотов)?$/i);let qty=null;if(amount){q=amount[1].trim();qty=+amount[2];if(qty>10000){unknown.push(raw.trim());continue;}}
 const found=resolve(q,section);if(!found.dish||found.dish==='marbled-steak'){unknown.push(raw.trim());continue;}const d=W.byId[found.dish];if(section==='Салаты'&&d.section!=='Салаты'){unknown.push(raw.trim());continue;}
 const id=found.dish,existing=entries[id];if(!existing||qty===null||existing.qty!==null&&qty<existing.qty)entries[id]={qty,signature:qty===null?'stop':String(qty),section:group(d)};
 }return {entries,unknown};}
function parse(notes){validate(notes);return parseRows(sections.flatMap(section=>(notes[section]||'').split(/[,;\n]+/).map(raw=>({section,raw}))));}
function parseText(text){if(typeof text!=='string'||text.length>12000)throw Error('Стоп-лист — до 12000 символов.');const rows=[];let section='Другое';const headers={'салаты':'Салаты','салат':'Салаты','горячее':'Горячее','супы':'Супы','суп':'Супы','закуски':'Закуски и хлеб','хлеб':'Закуски и хлеб','тесто':'Закуски и хлеб','десерты':'Десерты','бар':'Бар','настойки':'Настойки','другое':'Другое'};
 for(const line of text.split(/[\n;]/)){let raw=line.trim();if(!raw)continue;const heading=raw.match(/^(салаты|салат|горячее|супы|суп|закуски|хлеб|тесто|десерты|бар|настойки|другое)(?:\s*:\s*|\s+|$)(.*)$/i);if(heading){section=headers[heading[1].toLowerCase()];raw=heading[2];}const ownSection=/^(?:настойка|н)\s/i.test(raw)?'Настойки':section;rows.push(...raw.split(',').map(raw=>({section:ownSection,raw})));}
 return parseRows(rows);
}
function applyResult(state,result,notes){W.daily(state);const old=state.stock.notesEntries||{};
 if(!state.stock.notes){state.stock.items={};state.stock.revisions={};state.stock.epoch++;}
 for(const id of Object.keys(old))if(!result.entries[id])W.setStock(state,id,'unknown');
 for(const [id,entry] of Object.entries(result.entries))if(old[id]?.signature!==entry.signature)W.setStock(state,id,entry.qty===null||entry.qty===0?'stop':'limited',entry.qty);
 state.stock.notes=W.clone(notes);state.stock.notesEntries=result.entries;return result;
}
function apply(state,notes){return applyResult(state,parse(notes),notes);}
function applyText(state,text){const result=applyResult(state,parseText(text),{});state.stock.noteText=text;return result;}
function textFor(state){return state.stock.noteText??Object.entries(state.stock.notes||{}).filter(([,text])=>text.trim()).map(([section,text])=>section+': '+text).join('\n');}
root.StopNotes={sections,validate,parse,parseText,apply,applyText,textFor,group};
})(globalThis);
