/* Atomic same-origin transactions, schema migration, and recoverable local backups. */
(function(root){
'use strict';
class StateStore {
 constructor(storage,key='dvortsovaya-waiter-v1',locks=root.navigator?.locks){this.storage=storage;this.key=key;this.locks=locks;this.warning='';this.queue=Promise.resolve();this.value=this.read();}
 read(){
  let raw;
  try{raw=this.storage.getItem(this.key);if(!raw)return Waiter.newState();return Waiter.migrateState(JSON.parse(raw));}
  catch(error){
   if(raw){try{this.storage.setItem(this.key+'-damaged',raw);}catch{}}
   try{const backup=this.storage.getItem(this.key+'-backup');if(backup){const result=Waiter.migrateState(JSON.parse(backup));this.warning='Основная запись повреждена. Открыта последняя резервная копия смены.';return result;}}catch{}
   this.warning='Не удалось прочитать смену. Исходная запись сохранена для восстановления; загрузи копию из настроек.';return Waiter.newState();
  }
 }
 transaction(change){
  const run=()=>{
   const before=this.read(),next=Waiter.clone(before);Waiter.daily(next);const result=change(next);
   if(result&&typeof result.then==='function')throw Error('Изменение должно выполняться целиком.');
   const checked=Waiter.migrateState(next);checked.revision=before.revision+1;
   try{this.storage.setItem(this.key+'-backup',JSON.stringify(before));this.storage.setItem(this.key,JSON.stringify(checked));}
   catch{throw Error('Браузер не сохранил изменение. Освободи место или разреши хранение данных; прежняя смена сохранена.');}
   this.value=checked;return result;
  };
  const execute=()=>this.locks?.request?this.locks.request(this.key,run):run();
  const task=this.queue.then(execute);this.queue=task.catch(()=>{});return task;
 }
 async restore(input){const imported=Waiter.migrateState(input);await this.transaction(next=>{const rev=next.revision;Object.keys(next).forEach(k=>delete next[k]);Object.assign(next,imported,{revision:rev});});return this.value;}
}
root.StateStore=StateStore;
})(globalThis);
