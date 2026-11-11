'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const memory = new Map();
const context = vm.createContext({
  assert, console, crypto: { randomUUID }, setTimeout, clearTimeout,
  document: { getElementById: () => ({}) },
  localStorage: { getItem: key => memory.get(key) ?? null, setItem: (key,value) => memory.set(key,value) }
});
vm.runInContext(fs.readFileSync(path.join(root,'training-data.js'),'utf8'),context);
const source = fs.readFileSync(path.join(root,'app.js'),'utf8');
vm.runInContext(source.slice(0, source.lastIndexOf("document.getElementById('search-trigger').addEventListener")),context);
vm.runInContext(`
  assert.equal(Object.keys(ROLES).length,4);
  let lessons=0, questions=0, faqs=0;
  for(const [role,r] of Object.entries(ROLES)) {
    assert.ok(r.lessons.length>=4);
    const ids=new Set(r.lessons.map(l=>l.id));
    assert.equal(ids.size,r.lessons.length);
    for(const l of r.lessons) {
      assert.ok(l.steps.length>=3);
      assert.ok(l.questions.length>=1);
      for(const q of l.questions) {
        assert.ok(q.correct>=0 && q.correct<q.a.length);
        assert.ok(q.why.length>20);
        questions++;
      }
      lessons++;
    }
    for(const f of r.faqs) {
      assert.ok(!f.lesson || ids.has(f.lesson));
      assert.ok(f.keywords.length>0);
      faqs++;
    }
    const person=makeEmployee('Тест','Проверка',role);
    assert.equal(roleOf(person).title,r.title);
    assert.equal(progressOf(person),0);
    assert.equal(botReply(person,r.faqs[0].q).fallback,false);
    assert.equal(botReply(person,'межзвёздный телепорт из квазара').fallback,true);
  }
  const first=makeEmployee('Анна','Тестовая','retail');
  const second=makeEmployee('Анна','Тестовая','office');
  assert.notEqual(first.id,second.id);
  first.completed.push('welcome');
  assert.equal(progressOf(first),20);
  assert.equal(progressOf(second),0);
  first.messages.push({id:'question',channel:'mentor',text:'Нужна помощь',created:now(),answer:'',read:false});
  assert.equal(openQuestions(first).length,1);
  assert.equal(openQuestions(second).length,0);
  assert.ok(signals(first).some(s=>s.key==='question'));
  first.messages[0].answer='Разберём вместе';
  assert.equal(openQuestions(first).length,0);
  assert.equal(unread(first),1);
  first.messages[0].read=true;
  assert.equal(unread(first),0);
  first.mood='help';
  assert.ok(signals(first).some(s=>s.key==='help'));
  first.mood=null;first.lastActivity=ago(4);
  assert.ok(signals(first).some(s=>s.key==='inactive'));
  first.completed=courseOf(first).map(l=>l.id);
  assert.equal(progressOf(first),100);
  assert.equal(signals(first).some(s=>s.key==='inactive'),false);
  db.employees.push(first,second);db.activeId=first.id;db.introDone=true;
  assert.equal(save(),true);
  const loaded=loadDatabase();
  assert.equal(loaded.activeId,first.id);
  assert.equal(loaded.employees.find(e=>e.id===first.id).completed.length,5);
  assert.equal(loaded.employees.find(e=>e.id===second.id).completed.length,0);
  console.log('PASS:',Object.keys(ROLES).length,'roles,',lessons,'lessons,',questions,'quiz questions,',faqs,'FAQs; isolation, retrieval, HR signals, replies and persistence');
`,context);
