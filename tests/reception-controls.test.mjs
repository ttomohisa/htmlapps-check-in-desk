import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = process.argv.slice(2);
const verifyParity = !targets.length;
if (verifyParity) targets.push('src/index.template.html', 'dist/index.html', 'check-in-desk.html', 'dist/index.self-extract.html');
function readHtml(file) {
  const html=fs.readFileSync(path.resolve(root,file),'utf8');
  const payload=html.match(/<script id="self-extract-payload"[^>]*>([^<]+)<\/script>/)?.[1];
  return payload?gunzipSync(Buffer.from(payload,'base64')).toString('utf8'):html;
}
if (verifyParity) test('source, readable, root download and decompressed release have identical application runtime', () => {
  const runtime = file => {
    const html = readHtml(file).replace(/\r\n/g, '\n');
    return html.slice(html.indexOf('const translations ='), html.lastIndexOf('</script>')).trim();
  };
  const source = runtime(targets[0]);
  for (const target of targets.slice(1)) assert.equal(runtime(target), source, target);
});

// Minimal DOM boundary for the real inline application. This is intentionally
// not a browser/layout test; cloud-preview QA separately covers rendered UI.
function boot(file, language = 'en') {
  const html = readHtml(file);
  const nodes = new Map();
  let activeElement = null;
  const downloads=[], blobs=new Map();
  let fileRead=null;
  class Element {
    constructor(attributes = '') {
      this.attributes = new Map([...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
      this.dataset = Object.fromEntries([...this.attributes].filter(([k]) => k.startsWith('data-')).map(([k, v]) => [k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v]));
      this.classes = new Set((this.attributes.get('class') || '').split(/\s+/));
      this.classList = {
        add: (...names) => names.forEach(name => this.classes.add(name)),
        remove: (...names) => names.forEach(name => this.classes.delete(name)),
        contains: name => this.classes.has(name),
        toggle: (name, value = !this.classes.has(name)) => { value ? this.classes.add(name) : this.classes.delete(name); return value; },
      };
      this.listeners = new Map(); this.value = ''; this.innerHTML = ''; this.textContent = '';
      this.open = false; this.isConnected = true; this.disabled=/\bdisabled\b/.test(attributes);
    }
    addEventListener(type, handler) { const list = this.listeners.get(type) || []; list.push(handler); this.listeners.set(type, list); }
    dispatch(type, values = {}) {
      const event = { target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...values };
      for (const handler of this.listeners.get(type) || []) handler(event);
      return event;
    }
    click() { if(this.disabled)return; if(this.tagName==='A')downloads.push({filename:this.download,blob:blobs.get(this.href)}); return this.dispatch('click'); }
    focus() { activeElement = this; }
    select() { this.focus(); }
    showModal() { this.open = true; }
    close() { this.open = false; this.dispatch('close'); }
    getBoundingClientRect() { return {left:10,top:10,right:100,bottom:100}; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    querySelector(selector) { return node(`${this.attributes.get('id') || 'child'} ${selector}`); }
    get options() { const decode=s=>s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&'); return [...this.innerHTML.matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)].map(m => ({value:decode(m[1]),label:decode(m[2])})); }
  }
  function node(selector) { if (!nodes.has(selector)) { if(/^#[\w-]+$/.test(selector))return null; nodes.set(selector, new Element()); } return nodes.get(selector); }
  for (const match of html.matchAll(/<\w+\s+([^>]*\bid="([^"]+)"[^>]*)>/g)) nodes.set(`#${match[2]}`, new Element(match[1]));
  const filters = [...html.matchAll(/<button\s+([^>]*\bdata-reception-filter="[^"]+"[^>]*)>/g)].map(m => new Element(m[1]));
  const modes = [...html.matchAll(/<button\s+([^>]*\bdata-session-mode="[^"]+"[^>]*)>/g)].map(m => new Element(m[1]));
  const document = {
    querySelector: node,
    createElement(tag) { const element=new Element();element.tagName=tag.toUpperCase();return element; },
    querySelectorAll: selector => selector === '.segment[data-reception-filter]' ? filters : selector === '#sessionModePicker [data-session-mode]' ? modes : [],
    documentElement: {}, body: new Element(), addEventListener() {},
    get activeElement() { return activeElement; },
  };
  const members = [
    {id:'synthetic-a',name:'Synthetic Alpha',externalId:'FAKE-001',group:'Test A',note:''},
    {id:'synthetic-b',name:'Synthetic Beta',externalId:'FAKE-002',group:'Test B',note:''},
    {id:'synthetic-c',name:'Synthetic Gamma',externalId:'FAKE-003',group:'Test A',note:''},
  ];
  const data = {schemaVersion:1,members,sessions:[],activeSessionId:null,sampleDismissed:true};
  const stored = new Map([['check-in-desk:state-v1',JSON.stringify(data)],['check-in-desk:language',language]]);
  const context = vm.createContext({document,window:{addEventListener(){},scrollTo(){}},HTMLElement:Element,navigator:{language},
    localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},sessionStorage:{getItem:()=>null,setItem(){}},
    Blob,URL:{createObjectURL(blob){const url=`blob:test-${blobs.size}`;blobs.set(url,blob);return url;},revokeObjectURL:url=>blobs.delete(url)},
    FileReader:class {readAsText(file){this.result=file.content;fileRead=this.onload();}},Intl,TextDecoder,TextEncoder,Uint8Array,atob,btoa,structuredClone,
    setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:fn=>fn(),matchMedia:()=>({matches:true}),
  });
  let script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(m => m[1].includes('function renderReception()'))?.[1];
  assert.ok(script, `application script exists in ${file}`);
  script = script.replace('__APP_CONFIG_JSON__',fs.readFileSync(path.join(root,'app.config.json'),'utf8')).replace('__BUILD_MANIFEST_JSON__','{}').replace('__EMBEDDED_ASSET_BUNDLE_JSON__','{}');
  // Expose closures only in this test VM. Product code is executed unchanged.
  const end = script.lastIndexOf('})();');
  script = script.slice(0,end) + 'globalThis.app={get state(){return state;},activeSession,renderReception,applyLanguage,reopenSession,visibleReceptionPeople,personStatus,endSession,exportAttendance,exportSessionAttendance,importBackup,resetAll,submitWalkIn};\n' + script.slice(end);
  vm.runInContext(script,context,{filename:file});
  const app = context.app;
  return {
    ...app, get state(){return app.state;}, node, filters, modes, stored, downloads,
    async restore(data){app.importBackup({content:JSON.stringify({app:'check-in-desk',data})});node('#appConfirmOk').click();await fileRead;},
    async reset(){const pending=app.resetAll();node('#appConfirmOk').click();await pending;},
    openExport(){node('#exportReceptionButton').click();},
    submitExport(){node('#receptionExportForm').dispatch('submit');},
    get focused(){return activeElement;},
    filter(value){filters.find(b=>b.dataset.receptionFilter===value).click();},
    search(value){node('#receptionSearch').value=value;node('#receptionSearch').dispatch('input');},
    groupValue(label){return node('#receptionGroupFilter').options.find(o=>o.label===label)?.value;},
    group(label){node('#receptionGroupFilter').value=label?this.groupValue(label):'';assert.notEqual(node('#receptionGroupFilter').value,undefined,`group option ${label}`);node('#receptionGroupFilter').dispatch('change');},
    start(mode='checkin'){node('#sessionNameInput').value='Synthetic session';modes.find(b=>b.dataset.sessionMode===mode).click();node('#sessionForm').dispatch('submit');return app.activeSession();},
    async end(){const pending=app.endSession();node('#appConfirmOk').click();await pending;},
    key(event={key:'Enter'}){return node('#receptionSearch').dispatch('keydown',event);},
  };
}
function selected(app, expected) {
  for (const button of app.filters) {
    const active = button.dataset.receptionFilter === expected;
    assert.equal(button.classList.contains('is-active'),active,`${button.dataset.receptionFilter} visual state`);
    assert.equal(button.getAttribute('aria-pressed'),String(active),`${button.dataset.receptionFilter} accessible state`);
  }
}
function visible(app){return Array.from(app.visibleReceptionPeople(app.activeSession()),p=>p.memberId);}

for (const file of targets) for (const language of ['ja','en']) {
  const label = `${file} / ${language}`;
  test(`${label}: render derives visual and accessible filter state`, () => {
    const app=boot(file,language);app.start();selected(app,'pending');
    for(const filter of ['present','all','pending']) {app.filter(filter);selected(app,filter);app.applyLanguage();selected(app,filter);}
  });
  test(`${label}: starting another session clears old search and filters`, async () => {
    const app=boot(file,language);const first=app.start();app.filter('present');app.group('Test A');app.search('zz-not-a-person');await app.end();
    const second=app.start();assert.notEqual(second.id,first.id);assert.equal(app.node('#receptionSearch').value,'');
    assert.equal(app.node('#receptionGroupFilter').value,'');selected(app,'pending');assert.equal(visible(app).length,3);assert.equal(first.events.length,0);
  });
  test(`${label}: reopening an ended session resets controls without changing attendance`, async () => {
    const app=boot(file,language);const first=app.start();app.search('FAKE-001');app.key();await app.end();
    app.start();app.filter('all');app.group('Test B');app.search('zz-not-a-person');await app.end();
    app.reopenSession(first.id);assert.equal(app.node('#receptionSearch').value,'');assert.equal(app.node('#receptionGroupFilter').value,'');
    selected(app,'pending');assert.deepEqual(visible(app),['synthetic-b','synthetic-c']);assert.equal(first.events.length,1);
  });
  test(`${label}: rerender and blocked reopen preserve current session controls`, async () => {
    const app=boot(file,language);const old=app.start();await app.end();const current=app.start();
    app.filter('all');app.group('Test A');app.search('Gamma');app.renderReception();app.applyLanguage();app.reopenSession(old.id);
    assert.equal(app.activeSession().id,current.id);assert.equal(app.node('#receptionSearch').value,'Gamma');assert.equal(app.node('#receptionGroupFilter').value,app.groupValue('Test A'));
    assert.deepEqual(visible(app),['synthetic-c']);
  });
  for(const mode of ['checkin','entryexit']) for(const [name,flags] of [['composition',{isComposing:true}],['IME 229',{keyCode:229}],['held key',{repeat:true}]]) {
    test(`${label}: ${mode} ignores ${name} Enter without clearing search`, () => {
      const app=boot(file,language);const session=app.start(mode);app.search('FAKE-001');
      const event=app.key({key:'Enter',...flags});assert.equal(session.events.length,0);assert.equal(app.node('#receptionSearch').value,'FAKE-001');assert.equal(event.defaultPrevented,false);
      app.key();assert.equal(session.events.length,1,'a later deliberate Enter still works');
    });
  }
  test(`${label}: no match, multiple matches and non-Enter keys do not record attendance`, () => {
    const app=boot(file,language);const session=app.start();
    for(const search of ['zz-not-a-person','Synthetic']){app.search(search);assert.equal(app.key().defaultPrevented,false);}
    app.search('FAKE-001');app.key({key:'a'});assert.equal(session.events.length,0);
  });
  test(`${label}: unique check-in preserves focus and immediate Undo`, () => {
    const app=boot(file,language);const session=app.start();app.search('FAKE-001');assert.equal(app.key().defaultPrevented,true);
    assert.equal(session.events.length,1);assert.equal(session.events[0].type,'checkin');assert.equal(app.node('#receptionSearch').value,'');assert.equal(app.focused,app.node('#receptionSearch'));
    app.node('#appToastAction').click();assert.equal(session.events.length,0);assert.equal(app.personStatus(session,'synthetic-a').present,false);assert.equal(app.focused,app.node('#receptionSearch'));
  });
  test(`${label}: already checked-in result is not recorded again`, () => {
    const app=boot(file,language);const session=app.start();app.search('FAKE-001');app.key();app.filter('present');app.search('FAKE-001');app.key();assert.equal(session.events.length,1);
  });
  test(`${label}: Entry / Exit supports deliberate toggles and Undo, ignores repeat after entry`, () => {
    const app=boot(file,language);const session=app.start('entryexit');app.filter('all');app.search('FAKE-001');app.key();
    app.search('FAKE-001');app.key({key:'Enter',repeat:true});assert.equal(session.events.length,1);assert.equal(app.personStatus(session,'synthetic-a').inside,true);
    app.key();assert.deepEqual(Array.from(session.events,e=>e.type),['enter','exit']);assert.equal(app.personStatus(session,'synthetic-a').inside,false);
    app.node('#appToastAction').click();assert.deepEqual(Array.from(session.events,e=>e.type),['enter']);assert.equal(app.personStatus(session,'synthetic-a').inside,true);
  });
  test(`${label}: Enter without active session is harmless`, () => {const app=boot(file,language);assert.equal(app.key().defaultPrevented,false);assert.equal(app.state.sessions.length,0);});
}

for (const file of targets) for (const language of ['ja','en']) for (const mode of ['checkin','entryexit']) {
  const label = `${file} / ${language} / ${mode}`;
  test(`${label}: literal sentinel and no-group options target distinct participants`, () => {
    const app=boot(file,language);
    app.state.members.forEach((m,i)=>m.group=['__ungrouped__','','group:__ungrouped__'][i]);
    const session=app.start(mode), before=JSON.stringify(app.state);
    const options=app.node('#receptionGroupFilter').options;
    assert.equal(new Set(options.map(o=>o.value)).size,options.length,'each option has its own internal value');
    for(const [group,want] of [['__ungrouped__','synthetic-a'],[language==='ja'?'グループなし':'No group','synthetic-b'],['group:__ungrouped__','synthetic-c']]) {
      app.group(group);app.renderReception();app.applyLanguage();assert.deepEqual(visible(app),[want]);
    }
    assert.equal(JSON.stringify(app.state),before,'filters do not change stored groups or records');
    app.group('__ungrouped__');app.key();assert.equal(session.events[0].personId,'synthetic-a');
    app.node('#appToastAction').click();assert.equal(session.events.length,0);
  });
  test(`${label}: literal sentinel remains selectable without ungrouped people`, () => {
    const app=boot(file,language);app.state.members[0].group='__ungrouped__';app.start(mode);
    app.group('__ungrouped__');assert.deepEqual(visible(app),['synthetic-a']);
  });
}

async function csvDownload(app,index=0){assert.ok(app.downloads[index],'CSV download exists');return Buffer.from(await app.downloads[index].blob.arrayBuffer()).toString('utf8');}
const csvHeader='session,started_at,ended_at,mode,name,id,group,walk_in,status,first_record_at,last_record_at';
function dataRows(text){return text.slice(1).split('\r\n').slice(1).map(row=>row.split(','));}
for(const file of targets) for(const language of ['ja','en']) {
  const label=`${file} / ${language}`;
  test(`${label}: shown export intersects status, group and normalized search with an editable filename`, async()=>{
    const app=boot(file,language), session=app.start();app.search('FAKE-001');app.key();app.filter('all');app.group('Test A');app.search('ＧＡＭＭＡ');
    assert.match(app.node('#exportReceptionButton').textContent,/\(1\)/);app.openExport();
    assert.equal(app.node('#receptionExportDialog').open,true);assert.match(app.node('#receptionExportSummary').textContent,/1/);
    app.node('#receptionExportFilename').value='Front desk.CSV';app.submitExport();
    assert.equal(app.downloads[0].filename,'Front desk.csv');
    assert.equal(await csvDownload(app),'\ufeff'+csvHeader+'\r\n'+`Synthetic session,${session.startedAt},,checkin,Synthetic Gamma,FAKE-003,Test A,0,absent,,`);
    assert.equal(app.node('#receptionExportDialog').open,false);assert.equal(session.events.length,1);
  });
  test(`${label}: pending and checked-in exports preserve visible order and session-only walk-ins`,async()=>{
    const app=boot(file,language),session=app.start();app.search('FAKE-001');app.key();
    app.node('#walkInNameInput').value='Synthetic Walk-in';app.submitWalkIn({preventDefault(){}});
    app.openExport();app.submitExport();let rows=dataRows(await csvDownload(app));
    assert.deepEqual(rows.map(r=>r[4]),['Synthetic Beta','Synthetic Gamma','Synthetic Walk-in']);assert.equal(rows[2][7],'1');assert.ok(rows.every(r=>r[8]==='absent'));
    app.filter('present');app.openExport();app.submitExport();rows=dataRows(await csvDownload(app,1));assert.deepEqual(rows.map(r=>r[4]),['Synthetic Alpha']);assert.equal(rows[0][8],'present');
    app.filter('all');app.openExport();app.submitExport();assert.equal(dataRows(await csvDownload(app,2)).length,4);assert.equal(session.targetMembers.length,4);
  });
  test(`${label}: Entry / Exit present exports include people who entered and subsequently exited`,async()=>{
    const app=boot(file,language),session=app.start('entryexit');app.filter('all');app.search('FAKE-001');app.key();app.search('FAKE-001');app.key();app.filter('present');
    app.openExport();app.submitExport();const rows=dataRows(await csvDownload(app));
    assert.equal(rows.length,1);assert.equal(rows[0][4],'Synthetic Alpha');assert.equal(rows[0][8],'present');assert.equal(rows[0][9],session.events[0].at);assert.equal(rows[0][10],session.events[1].at);assert.equal(app.personStatus(session,'synthetic-a').inside,false);
  });
  test(`${label}: export snapshots quoted rows on open and ignores later roster/filter/session edits`,async()=>{
    const app=boot(file,language);app.state.members[0].name='Synthetic "A",\nLine';const session=app.start();session.name='Desk "A",\nLine';app.search('FAKE-001');
    app.openExport();const started=session.startedAt;app.state.members[0].name='Edited roster';session.name='Changed session';app.search('FAKE-001');app.key();app.search('FAKE-003');app.filter('all');
    app.submitExport();assert.equal(await csvDownload(app),'\ufeff'+csvHeader+'\r\n'+`"Desk ""A"",\nLine",${started},,checkin,"Synthetic ""A"",\nLine",FAKE-001,Test A,0,absent,,`);
  });
  test(`${label}: no active session and zero results cannot open or download a shown export`,()=>{
    const app=boot(file,language);assert.equal(app.node('#exportReceptionButton').disabled,true);app.openExport();app.submitExport();assert.equal(app.downloads.length,0);
    app.start();app.search('no-match');assert.equal(app.node('#exportReceptionButton').disabled,true);assert.match(app.node('#exportReceptionButton').textContent,/\(0\)/);app.openExport();app.submitExport();assert.equal(app.downloads.length,0);assert.equal(app.node('#receptionExportDialog').open,false);
    app.search('FAKE-001');assert.equal(app.node('#exportReceptionButton').disabled,false);
  });
  for(const how of ['cancel','close','escape','backdrop']) test(`${label}: ${how} discards a snapshot, restores focus and keeps the edited name for reopening`,async()=>{
    const app=boot(file,language);app.start();app.search('FAKE-001');app.openExport();app.node('#receptionExportFilename').value='Desk report';
    if(how==='cancel')app.node('#cancelReceptionExportDialog').click();
    if(how==='close')app.node('#closeReceptionExportDialog').click();
    if(how==='escape')app.node('#receptionExportDialog').dispatch('cancel');
    if(how==='backdrop')app.node('#receptionExportDialog').dispatch('click',{clientX:0,clientY:0});
    assert.equal(app.node('#receptionExportDialog').open,false);assert.equal(app.focused,app.node('#exportReceptionButton'));app.submitExport();assert.equal(app.downloads.length,0);
    app.search('FAKE-002');app.openExport();assert.equal(app.node('#receptionExportFilename').value,'Desk report');app.submitExport();assert.equal(app.downloads[0].filename,'Desk report.csv');assert.equal(dataRows(await csvDownload(app))[0][4],'Synthetic Beta');
  });
  test(`${label}: repeated open and submit do not replace a pending snapshot or duplicate downloads`,async()=>{
    const app=boot(file,language);app.start();app.search('FAKE-001');app.openExport();app.node('#receptionExportFilename').value='Keep me';app.search('FAKE-002');app.openExport();
    assert.equal(app.node('#receptionExportFilename').value,'Keep me');app.submitExport();app.submitExport();assert.equal(app.downloads.length,1);assert.equal(dataRows(await csvDownload(app))[0][4],'Synthetic Alpha');
  });
  for(const how of ['end','restore','reset']) test(`${label}: ${how} invalidates the pending export even if a restored session reuses its ID`,async()=>{
    const app=boot(file,language),session=app.start();app.openExport();assert.equal(app.node('#receptionExportDialog').open,true);
    if(how==='end'){await app.end();app.reopenSession(session.id);}
    if(how==='restore'){const replacement=structuredClone(app.state);replacement.sessions[0].name='Restored session';await app.restore(replacement);}
    if(how==='reset')await app.reset();
    assert.equal(app.node('#receptionExportDialog').open,false);app.submitExport();assert.equal(app.downloads.length,0);
  });
  test(`${label}: a delayed close event from an earlier dialog does not cancel a newly opened export`,async()=>{
    const app=boot(file,language);app.start();app.openExport();app.node('#cancelReceptionExportDialog').click();
    app.search('FAKE-002');app.openExport();app.node('#receptionExportDialog').dispatch('close');
    assert.equal(app.node('#receptionExportDialog').open,true);app.submitExport();assert.equal(dataRows(await csvDownload(app))[0][4],'Synthetic Beta');
  });
  test(`${label}: submit rejects a replaced session even before its next render`,()=>{
    const app=boot(file,language);app.start();app.openExport();assert.equal(app.node('#receptionExportDialog').open,true);
    app.state.sessions[0]=structuredClone(app.state.sessions[0]);app.submitExport();
    assert.equal(app.downloads.length,0);assert.equal(app.node('#receptionExportDialog').open,false);
  });
  test(`${label}: filtered export scales to a thousand snapshots without reordering or changing stored data`,async()=>{
    const app=boot(file,language);app.state.members=Array.from({length:1000},(_,i)=>({id:`bulk-${i}`,name:`Person ${i}`,externalId:`ID-${i}`,group:i%2?'Odd':'Even',note:''}));
    const session=app.start();app.group('Odd');const before=JSON.stringify(app.state);app.openExport();app.submitExport();
    const rows=dataRows(await csvDownload(app));assert.equal(rows.length,500);assert.equal(rows[0][5],'ID-1');assert.equal(rows[499][5],'ID-999');assert.equal(JSON.stringify(app.state),before);assert.equal(session.events.length,0);
  });
  test(`${label}: keyboard activation inside the export dialog does not dismiss before submit`,async()=>{
    const app=boot(file,language);app.start();app.search('FAKE-001');app.openExport();
    const submitButton=app.node('#receptionExportForm').querySelector('button[type="submit"]');
    app.node('#receptionExportDialog').dispatch('click',{target:submitButton,clientX:0,clientY:0});
    assert.equal(app.node('#receptionExportDialog').open,true);app.submitExport();assert.equal(dataRows(await csvDownload(app))[0][4],'Synthetic Alpha');
  });
  test(`${label}: full-session and all-history exports retain their original full scope`,async()=>{
    const app=boot(file,language),first=app.start();await app.end();const second=app.start();app.group('Test A');app.search('Gamma');
    app.exportSessionAttendance(second.id);app.exportAttendance();assert.equal(dataRows(await csvDownload(app)).length,3);assert.equal(dataRows(await csvDownload(app,1)).length,6);assert.notEqual(first.id,second.id);
  });
  test(`${label}: file names remove controls/path separators, normalize extension and use a safe fallback`,async()=>{
    const app=boot(file,language);app.start();
    for(const [input,want] of [[' ../A\\B:\u0000*.CSV ','..-A-B-.csv'],[' \u0000 ','Synthetic session-shown.csv'],['report.csv.csv','report.csv']]){
      app.openExport();app.node('#receptionExportFilename').value=input;app.submitExport();assert.equal(app.downloads.at(-1).filename,want);
    }
  });
}
