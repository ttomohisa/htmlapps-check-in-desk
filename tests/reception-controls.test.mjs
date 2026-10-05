import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = process.argv.slice(2);
const verifyParity = !targets.length;
if (verifyParity) targets.push('src/index.template.html', 'dist/index.html', 'check-in-desk.html');
if (verifyParity) test('source, generated HTML and root download have identical application runtime', () => {
  const runtime = file => {
    const html = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
    return html.slice(html.indexOf('const translations ='), html.lastIndexOf('</script>')).trim();
  };
  const source = runtime(targets[0]);
  for (const target of targets.slice(1)) assert.equal(runtime(target), source, target);
});

// Minimal DOM boundary for the real inline application. This is intentionally
// not a browser/layout test; cloud-preview QA separately covers rendered UI.
function boot(file, language = 'en') {
  const html = fs.readFileSync(path.resolve(root, file), 'utf8');
  const nodes = new Map();
  let activeElement = null;
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
      this.open = false; this.isConnected = true;
    }
    addEventListener(type, handler) { const list = this.listeners.get(type) || []; list.push(handler); this.listeners.set(type, list); }
    dispatch(type, values = {}) {
      const event = { target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...values };
      for (const handler of this.listeners.get(type) || []) handler(event);
      return event;
    }
    click() { return this.dispatch('click'); }
    focus() { activeElement = this; }
    select() { this.focus(); }
    showModal() { this.open = true; }
    close() { this.open = false; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    querySelector(selector) { return node(`${this.attributes.get('id') || 'child'} ${selector}`); }
    get options() { return [...this.innerHTML.matchAll(/<option value="([^"]*)"/g)].map(m => ({value:m[1]})); }
  }
  function node(selector) { if (!nodes.has(selector)) nodes.set(selector, new Element()); return nodes.get(selector); }
  for (const match of html.matchAll(/<\w+\s+([^>]*\bid="([^"]+)"[^>]*)>/g)) nodes.set(`#${match[2]}`, new Element(match[1]));
  const filters = [...html.matchAll(/<button\s+([^>]*\bdata-reception-filter="[^"]+"[^>]*)>/g)].map(m => new Element(m[1]));
  const modes = [...html.matchAll(/<button\s+([^>]*\bdata-session-mode="[^"]+"[^>]*)>/g)].map(m => new Element(m[1]));
  const document = {
    querySelector: node,
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
    Blob,URL,Intl,TextDecoder,TextEncoder,Uint8Array,atob,btoa,structuredClone,
    setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:fn=>fn(),matchMedia:()=>({matches:true}),
  });
  let script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(m => m[1].includes('function renderReception()'))?.[1];
  assert.ok(script, `application script exists in ${file}`);
  script = script.replace('__APP_CONFIG_JSON__',fs.readFileSync(path.join(root,'app.config.json'),'utf8')).replace('__BUILD_MANIFEST_JSON__','{}').replace('__EMBEDDED_ASSET_BUNDLE_JSON__','{}');
  // Expose closures only in this test VM. Product code is executed unchanged.
  const end = script.lastIndexOf('})();');
  script = script.slice(0,end) + 'globalThis.app={get state(){return state;},activeSession,renderReception,applyLanguage,reopenSession,visibleReceptionPeople,personStatus,endSession};\n' + script.slice(end);
  vm.runInContext(script,context,{filename:file});
  const app = context.app;
  return {
    ...app, get state(){return app.state;}, node, filters, modes, stored,
    get focused(){return activeElement;},
    filter(value){filters.find(b=>b.dataset.receptionFilter===value).click();},
    search(value){node('#receptionSearch').value=value;node('#receptionSearch').dispatch('input');},
    group(value){node('#receptionGroupFilter').value=value;node('#receptionGroupFilter').dispatch('change');},
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
    assert.equal(app.activeSession().id,current.id);assert.equal(app.node('#receptionSearch').value,'Gamma');assert.equal(app.node('#receptionGroupFilter').value,'Test A');
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
