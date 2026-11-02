/* Free-form daily stop notes, linked to menu availability. */
(function(root){
'use strict';const W=root.Waiter;
const sections=['Салаты','Горячее','Закуски и хлеб','Супы','Десерты','Бар','Настойки','Другое'];
function validate(notes){if(!notes||typeof notes!=='object'||Array.isArray(notes))throw Error('Некорректные заметки стопа.');for(const [section,text] of Object.entries(notes))if(!sections.includes(section)||typeof text!=='string'||text.length>3000)throw Error('Заметка раздела — до 3000 символов.');return notes;}
function parse(notes){validate(notes);const entries={},unknown=[];for(const section of sections){for(const raw of (notes[section]||'').split(/[,;\n]+/)){let q=raw.trim().replace(/^[-•]\s*/,'').replace(/\s+стоп$/i,'');if(!q)continue;const amount=q.match(/^(.*?)\s*(?:[-—–:]\s*|\s+)(\d{1,5})\s*(?:шт|порций|шотов)?$/i);let qty=null;if(amount){q=amount[1].trim();qty=+amount[2];if(qty>10000){unknown.push(raw.trim());continue;}}
 const found=W.resolve(q);if(!found.dish||found.dish==='marbled-steak'){unknown.push(raw.trim());continue;}
 const id=found.dish,existing=entries[id];if(!existing||qty===null||existing.qty!==null&&qty<existing.qty)entries[id]={qty,signature:qty===null?'stop':String(qty)};
 }}return {entries,unknown};}
function apply(state,notes){const result=parse(notes);W.daily(state);const old=state.stock.notesEntries||{};
 if(!state.stock.notes){state.stock.items={};state.stock.revisions={};state.stock.epoch++;}
 for(const id of Object.keys(old))if(!result.entries[id])W.setStock(state,id,'unknown');
 for(const [id,entry] of Object.entries(result.entries))if(old[id]?.signature!==entry.signature)W.setStock(state,id,entry.qty===null||entry.qty===0?'stop':'limited',entry.qty);
 state.stock.notes=W.clone(notes);state.stock.notesEntries=result.entries;return result;
}
root.StopNotes={sections,validate,parse,apply};
})(globalThis);
