const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require.resolve('../app-export.js'), 'utf8');
function setup(ios = false) {
  const elements = {};
  const order = [];
  const el = id => elements[id] ||= { value:'', style:{}, dataset:{}, listeners:{}, classList:{add(){}},
    addEventListener(type, callback){this.listeners[type]=callback;}, removeAttribute(){}, appendChild(){},
    remove(){}, click(){order.push('download');} };
  const context = { console, Blob, TextEncoder, Uint8Array, DataView,
    navigator:{userAgent:ios?'iPhone':'Desktop',platform:'',maxTouchPoints:0},
    URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},
    document:{getElementById:el,createElement:()=>el('link'),body:el('body')},
    window:{listeners:{},setTimeout(){},addEventListener(type,callback){(this.listeners[type] ||= []).push(callback);}},
    normalizeIndonesianName:s=>s, cleanValue:s=>s||'', initIcons(){}, contacts:[], skippedRows:0,
  };
  for (const name of ['eventNameInput','nameFormatInput','sourceInput','categoryInput','noteInput','downloadBtn','excelFile','fileChip','previewBody','previewTable','emptyState','statusBadge','validCountBox','phoneCountBox','emailCountBox','skippedCountBox','heroEvent','heroSource','heroCategory']) context[name]=el(name);
  vm.createContext(context);
  vm.runInContext(source,context);
  context.contacts=[{fullName:'Test Person',phone:'081234567',note:'Two attendees'}];
  context.eventNameInput.value='Original campaign';
  context.window.ContactImporterBackend={sync:async snapshot=>{order.push('sync');return {ok:true};}};
  return {context,elements,order,el};
}
const tick = () => new Promise(resolve=>setImmediate(resolve));
for (const ios of [false,true]) test(`${ios?'iOS ZIP':'VCF'} download starts first, then saves exported snapshot`,async()=>{
  const a=setup(ios);let saved;
  a.context.window.ContactImporterBackend.sync=async snapshot=>{a.order.push('sync');saved=snapshot;return {ok:true};};
  a.context.downloadVCF();await tick();
  assert.deepEqual(a.order,['download','sync']);
  assert.equal(saved.settings.event,'Original campaign');
  assert.equal(saved.contacts[0].note,'Two attendees');
  assert.equal(a.elements.exportSyncStatus.dataset.state,'success');
  assert.equal(a.elements.link.download,ios?'Original_campaign.zip':'Original_campaign.vcf');
});
test('failed save retries original batch after workspace edits without redownloading',async()=>{
  const a=setup();let saved;
  a.context.window.ContactImporterBackend.sync=async()=>({ok:false,error:'Offline'});
  a.context.downloadVCF();await tick();
  assert.equal(a.elements.retryExportSync.hidden,false);
  a.context.contacts[0].fullName='Changed';a.context.eventNameInput.value='Another campaign';
  a.context.downloadVCF();assert.equal(a.order.length,1);
  a.context.window.ContactImporterBackend.sync=async snapshot=>{saved=snapshot;return {ok:true};};
  a.elements.retryExportSync.listeners.click();await tick();
  assert.equal(saved.contacts[0].fullName,'Test Person');
  assert.equal(saved.settings.event,'Original campaign');
  assert.equal(a.elements.exportSyncStatus.dataset.state,'success');
  assert.equal(a.order.length,1);
});
test('repeated clicks while saving cannot issue duplicate downloads',async()=>{
  const a=setup();let finish;
  a.context.window.ContactImporterBackend.sync=()=>new Promise(resolve=>finish=resolve);
  a.context.downloadVCF();a.context.downloadVCF();
  assert.equal(a.order.length,1);assert.equal(a.context.downloadBtn.disabled,true);
  let warned=false;a.context.window.listeners.beforeunload.forEach(callback=>callback({preventDefault(){warned=true;}}));
  assert.equal(warned,true);
  finish({ok:true});await tick();assert.equal(a.context.downloadBtn.disabled,false);
});
test('empty export never sends contacts',()=>{
  const a=setup();a.context.contacts=[];a.context.downloadVCF();assert.deepEqual(a.order,[]);
});

function backendSetup(reply) {
  const source=fs.readFileSync(require.resolve('../google-sheets-backend.js'),'utf8');
  const serializer=source.slice(source.indexOf('  function backendContact('),source.indexOf('  function makeRequestId('));
  const sync=source.slice(source.indexOf('  let syncInProgress'),source.indexOf('  function uniqueSharedValue('));
  const sent=[];let refreshed=0;
  const context={console:{error(){}},contacts:[{fullName:'Current',phone:'9'}],MAX_CLIENT_BATCH:1,
    currentMarketingSettings:()=>({event:'Current campaign'}),setButtonsBusy(){},setBackendStatus(){},setStatus(){},syncMeta:{},
    makeRequestId:()=> 'test',postAction:async(action,payload)=>{sent.push(payload);return reply(payload);},
    refreshCampaignHistory:async()=>{refreshed++;}};
  vm.createContext(context);vm.runInContext(serializer+sync,context);
  return {context,sent,refreshed:()=>refreshed};
}
test('backend sync persists exported metadata and both note formats, then refreshes History',async()=>{
  const a=backendSetup(payload=>({accepted:payload.contacts.length,inserted:1}));
  const result=await a.context.syncCurrentContacts({settings:{event:'Downloaded campaign',nameFormat:'name',note:'Batch'},contacts:[{fullName:'One',phone:'1',note:'Mapped note'},{fullName:'Two',email:'two@example.com',notes:'Saved note'}]});
  assert.equal(result.ok,true);assert.equal(result.accepted,2);assert.equal(a.refreshed(),1);
  assert.equal(a.sent[0].contacts[0].notes,'Mapped note');assert.equal(a.sent[1].contacts[0].notes,'Saved note');
  assert.equal(a.sent[0].contacts[0].event,'Downloaded campaign');assert.equal(a.sent[0].contacts[0].batchNote,'Batch');
});
test('partial backend acknowledgement returns failure rather than reporting campaign saved',async()=>{
  const a=backendSetup(()=>({accepted:0}));
  const result=await a.context.syncCurrentContacts();
  assert.equal(result.ok,false);assert.equal(a.refreshed(),0);
});
