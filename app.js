'use strict';

const ROLES = TRAINING_ROLES;
const STORAGE_KEY = 'v-komande-demo-v3';
const main = document.getElementById('main');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const now = () => new Date().toISOString();
const isoDay = offset => { const d = new Date(); d.setDate(d.getDate() - offset); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); };
const ago = days => new Date(Date.now() - days * 86400000).toISOString();
const initials = e => ((e.firstName?.[0] || '') + (e.lastName?.[0] || '')).toLocaleUpperCase('ru');
const fullName = e => `${e.firstName} ${e.lastName}`;
const roleOf = e => ROLES[e.role];
const courseOf = e => roleOf(e).lessons;
const doneCount = e => courseOf(e).filter(l => e.completed.includes(l.id)).length;
const progressOf = e => Math.round(doneCount(e) / courseOf(e).length * 100);
const nextLesson = e => courseOf(e).find(l => !e.completed.includes(l.id));
const dateText = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? 'Нет даты' : d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'}); };
const timeText = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? 'Сохранено в демо' : d.toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}); };
const sinceDays = value => Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
const current = () => db.employees.find(e => e.id === db.activeId);
const employeeById = id => db.employees.find(e => e.id === id);
const lessonById = (e,id) => courseOf(e).find(l => l.id === id);
const isHRPage = page => ['hr','employee','hr-questions'].includes(page);
let activeDay = 0, quiz = null, chatTab = 'bot', hrFilter = {search:'',role:'',signal:''};
let storageAvailable = true, toastTimer;

function makeEmployee(firstName,lastName,role,extra={}) {
  return {id:uid(),firstName,lastName,role,bitrixId:100000+Math.floor(Math.random()*800000),source:'profile',startDate:isoDay(0),createdAt:now(),lastActivity:now(),completed:[],attempts:{},mood:null,messages:[],notes:[],seeded:false,...extra};
}
function seedDatabase() {
  const specs = [
    ['demo-w1','Даниил','Крылов','warehouse',2,1,0,'good'],
    ['demo-w2','Марина','Волкова','warehouse',8,3,4,'help'],
    ['demo-r1','Анна','Лебедева','retail',3,2,0,'okay'],
    ['demo-r2','Илья','Новиков','retail',12,5,0,'good'],
    ['demo-s1','Софья','Морозова','sales',5,2,1,'good'],
    ['demo-s2','Роман','Козлов','sales',10,1,4,'okay'],
    ['demo-o1','Алина','Зайцева','office',1,0,0,null],
    ['demo-o2','Павел','Егоров','office',7,4,0,'good']
  ];
  const employees = specs.map(([id,first,last,role,day,count,idle,mood],i) => makeEmployee(first,last,role,{id,bitrixId:9001+i,startDate:isoDay(day),createdAt:ago(day),lastActivity:ago(idle),completed:ROLES[role].lessons.slice(0,count).map(l=>l.id),mood,seeded:true,source:'sample',attempts:count?{welcome:{tries:1,wrong:0,lastAt:ago(idle)}}:{}}));
  employees[1].messages.push({id:'demo-question-1',channel:'mentor',text:'Не хватает доступа к терминалу. К кому обратиться?',created:ago(1),answer:'',read:false});
  employees[2].messages.push({id:'demo-question-2',channel:'mentor',text:'Как проверить наличие нужного размера?',created:ago(1),answer:'Сверь артикул и размер, затем проверь остаток в рабочей системе. Если не получается, разберём вместе.',answeredAt:ago(0),read:false});
  employees[5].attempts.brief={tries:4,wrong:3,lastAt:ago(4)};
  // Earlier demo data stays intact; import its learner as an additional local example.
  try {
    const old=JSON.parse(localStorage.getItem('v-komande-demo-v1'));
    if(old && Array.isArray(old.completed)) {
      employees.push(makeEmployee('Алексей','Соколов','warehouse',{id:'legacy-alexey',bitrixId:9901,source:'legacy',completed:old.completed.filter(id=>ROLES.warehouse.lessons.some(l=>l.id===id)),mood:['good','okay','help'].includes(old.mood)?old.mood:null,messages:Array.isArray(old.messages)?old.messages.filter(m=>m&&typeof m.text==='string').map(m=>({id:typeof m.id==='string'?m.id:uid(),channel:'mentor',text:m.text,created:m.created||now(),answer:typeof m.answer==='string'?m.answer:'',read:!!m.read})):[]}));
    }
  } catch { /* An invalid old demo does not prevent the new simulation. */ }
  return {version:3,introDone:false,activeId:null,employees,events:[]};
}
function loadDatabase() {
  try {
    const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(!parsed || parsed.version!==3 || !Array.isArray(parsed.employees)) return seedDatabase();
    parsed.employees=parsed.employees.filter(e=>e&&typeof e.id==='string'&&typeof e.firstName==='string'&&typeof e.lastName==='string'&&ROLES[e.role]).map(e=>({...e,completed:Array.isArray(e.completed)?e.completed.filter(id=>ROLES[e.role].lessons.some(l=>l.id===id)):[],attempts:e.attempts&&typeof e.attempts==='object'?e.attempts:{},notes:Array.isArray(e.notes)?e.notes.filter(n=>n&&typeof n.text==='string'):[],messages:Array.isArray(e.messages)?e.messages.filter(m=>m&&typeof m.id==='string'&&typeof m.text==='string'&&['mentor','bot'].includes(m.channel)).map(m=>({...m,answer:typeof m.answer==='string'?m.answer:'',read:!!m.read})):[]}));
    parsed.events=Array.isArray(parsed.events)?parsed.events.filter(e=>e&&typeof e.id==='string'):[];
    return parsed;
  } catch { return seedDatabase(); }
}
let db=loadDatabase();
function save() {
  try {localStorage.setItem(STORAGE_KEY,JSON.stringify(db));storageAvailable=true;return true;}
  catch {storageAvailable=false;toast('Сохранение недоступно. Данные останутся до обновления страницы.');return false;}
}
function toast(text) {const el=document.getElementById('toast');el.textContent=text;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),5000);}
function activity(e) {e.lastActivity=now();save();}
function go(hash) {if(location.hash==='#'+hash)render();else location.hash=hash;}
function selectEmployee(id) {const e=employeeById(id);if(!e)return;db.activeId=id;db.introDone=true;activeDay=0;quiz=null;chatTab='bot';activity(e);go('home');}
function unread(e) {return e.messages.filter(m=>m.channel==='mentor'&&m.answer&&!m.read).length;}
function openQuestions(e) {return e.messages.filter(m=>m.channel==='mentor'&&!m.answer);}
function signals(e) {
  const out=[];
  if(openQuestions(e).length)out.push({key:'question',text:'Есть вопрос',kind:'warm'});
  if(e.mood==='help')out.push({key:'help',text:'Просит поддержки',kind:'warm'});
  if(sinceDays(e.lastActivity)>=3 && progressOf(e)<100)out.push({key:'inactive',text:`Нет активности ${sinceDays(e.lastActivity)} дн.`,kind:'neutral'});
  return out;
}
function progressMarkup(e) {return `<div class="table-progress"><div class="progress-track" role="progressbar" aria-label="Прогресс ${esc(fullName(e))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressOf(e)}"><span style="width:${progressOf(e)}%"></span></div><span>${progressOf(e)}%</span></div>`;}
function roleOptions(selected='',placeholder=false) {return (placeholder?'<option value="">Выберите должность</option>':'')+Object.entries(ROLES).map(([id,r])=>`<option value="${id}" ${id===selected?'selected':''}>${r.title}</option>`).join('');}
function updateChrome(page) {
  const e=current(),hr=isHRPage(page),setup=page==='setup';
  document.body.classList.toggle('setup-view',setup);
  document.body.dataset.page=page;
  document.body.dataset.profession=e?.role||'warehouse';
  const studentNav=[['home','home','Главная'],['learn','book','Обучение'],['knowledge','grid','Справочник'],['chat','chat','Чат']];
  const managerNav=[['hr','grid','Обзор команды'],['hr-questions','chat','Вопросы новичков'],['setup','people','Добавить сотрудника'],['about','info','О симуляции']];
  const items=hr?managerNav:studentNav,active=page==='lesson'?'learn':page==='employee'?'hr':page;
  const navHtml=items.map(([route,i,label])=>`<a href="#${route}" class="nav-item ${active===route?'active':''}" ${active===route?'aria-current="page"':''}>${icon(i)}<span>${label}</span>${route==='chat'&&e&&unread(e)?`<span class="nav-count">${unread(e)}</span>`:''}</a>`).join('');
  document.getElementById('side-nav').innerHTML=navHtml;
  document.getElementById('mobile-nav').innerHTML=navHtml;
  document.getElementById('mobile-nav').hidden=setup;
  const routeBox=document.getElementById('side-route');
  routeBox.innerHTML=e&&!hr?`<span class="little-label">Твой маршрут</span><strong>${esc(roleOf(e).title)}</strong><span>${esc(roleOf(e).department)} · 14 дней</span><div class="progress-track"><span style="width:${progressOf(e)}%"></span></div><div class="side-progress-caption">${doneCount(e)} из ${courseOf(e).length} уроков</div>`:hr?'<span class="little-label">Данные демонстрации</span><strong>Вся команда</strong><span>4 направления обучения</span>':'';
  document.getElementById('topbar-title').textContent=({setup:'Создание сотрудника',home:'Моя адаптация',learn:'Маршрут обучения',lesson:'Урок',knowledge:'База знаний',chat:'Помощь и общение',hr:'Кабинет HR и руководителя',employee:'Карточка новичка','hr-questions':'Вопросы команды',about:'О симуляции'})[page]||'В команде';
  document.getElementById('demo-modes').innerHTML=[['home','Новичок'],['hr','HR / руководитель'],['setup','Битрикс24 · симуляция']].map(([route,label])=>`<a href="#${route}" class="mode-link ${(route==='setup'?setup:route==='hr'?hr:!setup&&!hr&&page!=='about')?'active':''}">${label}</a>`).join('');
  document.getElementById('storage-caption').textContent=storageAvailable?'Мок-данные · этот браузер':'Сохранение недоступно · до обновления';
  const context=document.getElementById('employee-context');
  context.innerHTML=e&&!hr&&!setup&&page!=='about'?`<div class="employee-context-inner"><span class="avatar avatar-small" data-profession="${esc(e.role)}">${esc(initials(e))}</span><label for="employee-picker"><span>Сотрудник в демо</span><select id="employee-picker">${db.employees.map(p=>`<option value="${esc(p.id)}" ${p.id===e.id?'selected':''}>${esc(fullName(p))} · ${esc(roleOf(p).title)}</option>`).join('')}</select></label><span class="context-note">Переключение примеров</span></div>`:'';
  document.getElementById('employee-picker')?.addEventListener('change',ev=>selectEmployee(ev.target.value));
  document.getElementById('search-trigger').innerHTML=icon('search');document.getElementById('search-trigger').hidden=!e||hr||setup;
  document.getElementById('notifications').innerHTML=icon('bell')+(e&&unread(e)?'<span class="unread-dot"></span>':'');document.getElementById('notifications').hidden=!e||setup;
}

function fieldMapping() {
  return `<details class="integration-details"><summary>Какие данные могут приходить автоматически${icon('plus')}</summary><p>При заполненных полях и достаточных правах приложения или вебхука:</p><div class="mapping-scroll"><table class="mapping-table"><thead><tr><th>Поле Битрикс24</th><th>В кабинете</th></tr></thead><tbody>${[['ID','Связь с профилем и защита от дублей'],['NAME, LAST_NAME','Имя и фамилия'],['WORK_POSITION','Должность → маршрут по настроенному соответствию'],['UF_DEPARTMENT','Подразделение по его ID'],['UF_EMPLOYMENT_DATE','Дата начала адаптации'],['EMAIL','Контакт, если заполнен']].map(([a,b])=>`<tr><td><code>${a}</code></td><td>${b}</td></tr>`).join('')}</tbody></table></div><p>Наставник и учебный маршрут назначаются нашими правилами. Стандартного поля «наставник» в этой схеме нет: нужен справочник соответствий или пользовательское поле.</p><p>Часть полей может отсутствовать. Их можно уточнить через <code>user.get</code> в рамках выданных прав; недостающие данные проверяет HR. Неизвестную должность нужно сопоставить вручную.</p><p><a class="text-link" href="https://apidocs.bitrix24.ru/api-reference/common/events/on-user-add.html" target="_blank" rel="noopener noreferrer">Документация ONUSERADD</a> · <a class="text-link" href="https://apidocs.bitrix24.ru/api-reference/user/user-get.html" target="_blank" rel="noopener noreferrer">user.get</a></p></details>`;
}
function setup() {
  main.innerHTML=`<div class="setup-page fade-in"><div class="page-intro"><h1>Симуляция Битрикс24:<br>создание сотрудника</h1><p>Добавь вымышленного новичка. Мы создадим его кабинет и назначим обучение по должности.</p></div><div class="setup-grid"><section class="content-panel setup-form-panel"><form id="create-employee"><fieldset class="source-switch"><legend>Откуда пришли данные</legend><label><input type="radio" name="source" value="profile" checked><span>Профиль сотрудника</span></label><label><input type="radio" name="source" value="task"><span>Задача приёма</span></label></fieldset><div class="name-fields"><div><label class="form-label" for="first-name">Имя</label><input class="text-input" id="first-name" name="firstName" required maxlength="40" autocomplete="off" placeholder="Например, Мария"></div><div><label class="form-label" for="last-name">Фамилия</label><input class="text-input" id="last-name" name="lastName" required maxlength="60" autocomplete="off" placeholder="Например, Соколова"></div></div><label class="form-label" for="position">Должность</label><select class="text-input" id="position" name="role" required>${roleOptions('',true)}</select><div class="assignment-preview" id="assignment-preview"><p>Выбери должность — здесь появятся маршрут и наставник.</p></div><div class="form-error" id="create-error" role="alert"></div><button class="primary-button full-width" type="submit">Создать кабинет${icon('arrow')}</button><button class="sample-button" id="fill-example" type="button">Заполнить вымышленный пример</button><p class="form-hint">Это локальная симуляция. Запросов в Битрикс24 и приглашений реальным людям нет.</p></form></section><aside class="setup-explanation"><h2>Как это выглядело бы в работе</h2><ol class="flow-steps"><li><strong>Битрикс24 передаёт событие</strong><span>Интеграция получает данные профиля или ID кадровой задачи.</span></li><li><strong>Назначается нужный маршрут</strong><span>Должность сопоставляется с одной из четырёх учебных баз.</span></li><li><strong>Кабинет появляется у новичка и HR</strong><span>Сотрудник учится, руководитель видит прогресс и вопросы.</span></li></ol><div class="api-note" id="source-note"></div>${fieldMapping()}<a href="#hr" class="secondary-button full-width">Посмотреть демокоманду${icon('people')}</a></aside></div><section class="setup-tracks"><h2>Четыре направления обучения</h2><div class="track-grid">${Object.values(ROLES).map(r=>`<div class="track-summary"><h3>${r.title}</h3><p>${r.summary}</p><span>${r.lessons.length} уроков · ${r.faqs.length} ответов в базе</span></div>`).join('')}</div></section></div>`;
  composeAirSetup();
  const form=document.getElementById('create-employee'),position=document.getElementById('position');
  function preview() {const r=ROLES[position.value];document.getElementById('assignment-preview').innerHTML=r?`<div class="assignment-title">${icon('check')}Маршрут подобран</div><strong>${esc(r.title)}</strong><p>${esc(r.summary)}</p><span>Наставник: ${esc(r.mentor)}</span><span>${r.lessons.length} уроков · подразделение «${esc(r.department)}»</span>`:'<p>Выбери должность — здесь появятся маршрут и наставник.</p>';}
  function sourceNote(){const source=form.querySelector('[name="source"]:checked').value;document.getElementById('source-note').innerHTML=source==='profile'?'<strong>Профиль сотрудника · ONUSERADD</strong><p>Событие приходит после первого входа и завершения регистрации, а не в момент приглашения. В демо этот этап считается пройденным.</p>':'<strong>Кадровая задача · ONTASKADD</strong><p>Событие передаёт ID задачи. Интеграция читает её через tasks.task.get и обрабатывает только заранее выбранные кадровые задачи. Поля сотрудника и правила сопоставления нужно настроить; произвольная задача не создаёт кабинет.</p><a class="text-link" href="https://apidocs.bitrix24.ru/api-reference/tasks/events-tasks/on-task-add.html" target="_blank" rel="noopener noreferrer">Событие задач в API</a>';}
  position.addEventListener('change',preview);form.querySelectorAll('[name="source"]').forEach(x=>x.addEventListener('change',sourceNote));sourceNote();
  document.getElementById('fill-example').addEventListener('click',()=>{form.elements.firstName.value='Мария';form.elements.lastName.value='Соколова';position.value='retail';preview();});
  form.addEventListener('submit',ev=>{
    ev.preventDefault();const first=form.elements.firstName.value.trim(),last=form.elements.lastName.value.trim(),role=position.value,source=form.querySelector('[name="source"]:checked').value;
    if(!first||!last||!ROLES[role]||!/[\p{L}]/u.test(first)||!/[\p{L}]/u.test(last)){document.getElementById('create-error').textContent='Укажи имя, фамилию и должность. Имя и фамилия должны содержать буквы.';return;}
    form.querySelector('[type="submit"]').disabled=true;
    const employee=makeEmployee(first,last,role,{source});
    // Unique local mock ID; actual event deduplication belongs to the future integration server.
    employee.bitrixId=Math.max(100000,...db.employees.map(e=>Number(e.bitrixId)||0))+1;
    db.employees.push(employee);db.activeId=employee.id;db.introDone=true;db.events.push({id:uid(),employeeId:employee.id,source,created:now(),bitrixId:employee.bitrixId,taskId:source==='task'?50000+db.events.length:null});save();activeDay=0;chatTab='bot';go('home');toast(`Кабинет создан. Назначен маршрут «${ROLES[role].title}».`);
  });
}

// The selected Air composition is now the first-run screen, not a preview.
function composeAirSetup() {
  const page=main.querySelector('.setup-page');
  page.classList.add('air-setup');
  const intro=page.querySelector('.page-intro');
  intro.querySelector('h1').innerHTML='Первый шаг<br>в команде.';
  intro.querySelector('p').textContent='Добавь вымышленного сотрудника из Битрикс24. Его должность определит обучение, базу знаний и наставника.';
  page.querySelector('.setup-grid').prepend(intro);
  const header=document.createElement('div');
  header.className='air-form-heading';
  header.innerHTML=`<span class="air-form-symbol">${icon('people')}</span><div><h2>Новый сотрудник</h2><p>Симуляция события Битрикс24</p></div><span class="air-form-status">Демо</span>`;
  document.getElementById('create-employee').prepend(header);
  const integration=document.createElement('div');
  integration.className='air-integration';
  integration.append(page.querySelector('.api-note'),page.querySelector('.integration-details'));
  page.querySelector('.setup-tracks').before(integration);
}
function roleLabel(role) {
  return `<span class="role-chip" data-profession="${esc(role)}"><span aria-hidden="true"></span>${esc(ROLES[role].title)}</span>`;
}

function mentorCard(e) {const r=roleOf(e);return `<section class="mentor-card"><h2>Твой наставник</h2><div class="mentor-person"><span class="avatar" data-profession="${esc(e.role)}">${esc(r.mentor.split(' ').map(x=>x[0]).join(''))}</span><div><strong>${esc(r.mentor)}</strong><small>${esc(r.mentorPosition)}</small><span class="available"><span class="available-dot"></span>${esc(r.department)}</span></div></div><p class="mentor-quote">Вопросов в начале много. Напиши, что не получается — разберём вместе.</p><a class="secondary-button full-width" href="#chat/mentor">${icon('chat')}Написать наставнику</a><p class="mentor-hours">Вымышленный наставник · ответ из кабинета HR</p></section>`;}
function routeRows(e,items) {const next=nextLesson(e);return `<div class="route-list">${items.map(l=>{const done=e.completed.includes(l.id),active=next?.id===l.id;return `<a href="#lesson/${l.id}" class="lesson-row ${active?'current':''}"><span class="lesson-status ${done?'done':active?'current':''}">${done?icon('check'):active?icon('play'):String(courseOf(e).indexOf(l)+1).padStart(2,'0')}</span><span class="lesson-row-content"><strong>${esc(l.title)}</strong><span class="lesson-meta"><span>${done?'Пройдено':l.type}</span><span class="meta-dot"></span><span>${l.minutes} мин</span></span></span>${active?'<span class="row-pill">Далее</span>':''}${icon('chevron','row-arrow')}</a>`;}).join('')}</div>`;}
const routeArt=()=>`<svg class="hero-art" viewBox="0 0 250 250" aria-hidden="true"><path d="M58 278V116a64 64 0 0 1 128 0v46a36 36 0 0 1-72 0v-37a8 8 0 0 1 16 0v131"/><path d="M45 278V116a77 77 0 0 1 154 0v46a49 49 0 0 1-98 0v-37a21 21 0 0 1 42 0v131"/><path d="M32 278V116a90 90 0 0 1 180 0v46a62 62 0 0 1-124 0v-37a34 34 0 0 1 68 0v131"/><circle class="route-dot" cx="194" cy="82" r="8"/><circle class="art-circle" cx="126" cy="117" r="27"/><path d="m116 117 7 7 13-15"/></svg>`;
function home() {
  const e=current(),r=roleOf(e),next=nextLesson(e),items=courseOf(e).filter(l=>l.day===activeDay);
  main.innerHTML=`<div class="fade-in"><div class="welcome-row"><div><h1>${esc(e.firstName)}, твой план на сегодня</h1><p class="welcome-profession">${roleLabel(e.role)}<span>${esc(r.department)}</span></p></div><span class="day-tag">${icon('calendar')}День ${sinceDays(e.startDate+'T12:00:00')+1} адаптации</span></div><div class="home-grid"><div class="main-column"><section class="next-lesson" aria-label="Следующий шаг обучения"><div class="hero-copy"><h2>${next?esc(next.title):'Учебный маршрут пройден'}</h2><p>${next?esc(next.desc):'Обсуди с наставником проверку практических навыков.'}</p><div class="hero-controls"><a class="primary-button" href="${next?'#lesson/'+next.id:'#chat/mentor'}">${next?'Продолжить':'Обсудить с наставником'}${icon('arrow')}</a>${next?`<span class="duration">${icon('clock')}${next.minutes} мин</span>`:''}</div></div>${routeArt()}</section><div class="overall-progress"><span class="overall-progress-label">Пройдено <strong>${doneCount(e)} из ${courseOf(e).length}</strong></span><div class="progress-track" role="progressbar" aria-label="Пройдено уроков" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressOf(e)}"><span style="width:${progressOf(e)}%"></span></div><strong>${progressOf(e)}%</strong></div><section class="home-route"><div class="section-heading"><h2>Твой маршрут</h2><a class="subtle-link" href="#learn">Все уроки${icon('arrow')}</a></div><div class="days" role="group" aria-label="Этап маршрута">${['День 1','Дни 2–3','Неделя 1'].map((t,i)=>`<button class="day-button ${activeDay===i?'active':''}" data-day="${i}" aria-pressed="${activeDay===i}">${t}</button>`).join('')}</div>${items.length?routeRows(e,items):'<p class="empty-state">На этом этапе уроков нет. Открой весь маршрут.</p>'}</section><section class="section-space"><div class="section-heading"><h2>Под рукой</h2></div><div class="quick-resources"><a class="resource" href="#knowledge">${icon('book')}<span><strong>База знаний</strong><small>Для роли «${esc(r.title)}»</small></span>${icon('chevron','row-arrow')}</a><a class="resource" href="#chat/bot">${icon('chat')}<span><strong>Спросить помощника</strong><small>Симуляция ответов по базе</small></span>${icon('chevron','row-arrow')}</a></div></section></div><aside class="right-column" aria-label="Помощь в адаптации">${mentorCard(e)}<section class="mood-card"><h2>Как проходит адаптация?</h2><p>Отметку увидит HR в этой симуляции.</p><div class="moods" role="group" aria-label="Самочувствие новичка">${[['good','smile','Всё хорошо','Хорошо'],['okay','neutral','Пока разбираюсь','Осваиваюсь'],['help','sad','Нужна помощь','Нужна помощь']].map(([v,i,label,text])=>`<button class="mood-option ${e.mood===v?'selected':''}" data-mood="${v}" aria-label="${label}" aria-pressed="${e.mood===v}">${icon(i)}<span>${text}</span></button>`).join('')}</div>${e.mood?`<p class="mood-confirm">Отметка сохранена.${e.mood==='help'?' Напиши наставнику, что случилось.':''}</p>`:''}</section><div class="note-card">${icon('info')}<p><strong>Здесь можно ошибаться</strong>Тесты помогают разобраться. Обязательные инструктажи проводит ответственный сотрудник.</p></div></aside></div></div>`;
  main.querySelectorAll('[data-day]').forEach(b=>b.addEventListener('click',()=>{activeDay=Number(b.dataset.day);home();}));
  main.querySelectorAll('[data-mood]').forEach(b=>b.addEventListener('click',()=>{e.mood=b.dataset.mood;activity(e);home();toast('Отметка доступна в кабинете HR.');}));
}
function learn() {const e=current();main.innerHTML=`<div class="page-width route-all fade-in"><div class="page-intro"><h1>Твой маршрут в команде</h1><p>${esc(roleOf(e).title)} · пройдено ${doneCount(e)} из ${courseOf(e).length} уроков. Можно вернуться к знакомой теме.</p></div>${['День 1 · знакомимся с работой','Дни 2–3 · пробуем с наставником','Неделя 1 · закрепляем навыки'].map((t,i)=>`<h2 class="route-day-heading">${t}</h2>${routeRows(e,courseOf(e).filter(l=>l.day===i))}`).join('')}<div class="info-note">${icon('info')}<p>Это вымышленные учебные процедуры. Прохождение тестов не заменяет практику, допуск и обязательные инструктажи.</p></div></div>`;}
function lesson(id) {
  const e=current(),l=lessonById(e,id);if(!l){main.innerHTML=`<div class="content-panel"><h1>Урок не найден в твоём маршруте</h1><p>Выбери тему своей специальности.</p><a class="primary-button" href="#learn">К маршруту</a></div>`;return;}
  quiz=null;activity(e);main.innerHTML=`<article class="lesson-content fade-in"><a class="back-link" href="#learn">${icon('back')}К маршруту обучения</a><h1>${esc(l.title)}</h1><p>${esc(l.desc)} · ${l.minutes} мин · ${e.completed.includes(l.id)?'Пройдено, можно повторить':'Для твоей специальности'}</p><div class="content-panel"><h2>Разберём по шагам</h2><ol class="lesson-steps">${l.steps.map(([title,text])=>`<li><strong>${esc(title)}</strong>${esc(text)}</li>`).join('')}</ol><div class="info-note">${icon('info')}<p>Учебный пример. Рабочий порядок и правила безопасности уточняй у наставника.</p></div><button class="primary-button" id="start-quiz">Проверить себя${icon('arrow')}</button></div></article>`;
  document.getElementById('start-quiz').addEventListener('click',()=>{quiz={employeeId:e.id,lessonId:id,index:0,correct:false};renderQuiz();window.scrollTo({top:0,behavior:'instant'});});
}
function renderQuiz() {
  const e=employeeById(quiz.employeeId),l=lessonById(e,quiz.lessonId),q=l.questions[quiz.index];
  main.innerHTML=`<article class="lesson-content fade-in"><a class="back-link" href="#lesson/${l.id}" id="return-lesson">${icon('back')}Перечитать урок</a><h1>Проверим на практике</h1><p>${esc(l.title)}</p><div class="content-panel"><div class="quiz-progress"><span>Вопрос ${quiz.index+1} из ${l.questions.length}</span><div class="progress-track"><span style="width:${(quiz.index+1)/l.questions.length*100}%"></span></div></div><form id="quiz-form"><h2 class="question-title" id="question-title">${esc(q.q)}</h2><fieldset class="answer-list" aria-labelledby="question-title">${q.a.map((a,i)=>`<label class="answer-option"><input type="radio" name="answer" value="${i}"><span>${esc(a)}</span></label>`).join('')}</fieldset><div id="quiz-feedback" aria-live="polite"></div><button class="primary-button" type="submit" id="check-answer" disabled>Проверить ответ${icon('arrow')}</button></form></div></article>`;
  document.getElementById('return-lesson').addEventListener('click',ev=>{ev.preventDefault();lesson(l.id);window.scrollTo({top:0,behavior:'instant'});});
  const form=document.getElementById('quiz-form'),button=document.getElementById('check-answer'),feedback=document.getElementById('quiz-feedback');
  form.addEventListener('change',()=>{button.disabled=false;button.innerHTML='Проверить ответ'+icon('arrow');feedback.innerHTML='';});
  form.addEventListener('submit',ev=>{
    ev.preventDefault();if(quiz.correct){if(quiz.index===l.questions.length-1){finishLesson(e,l);return;}quiz.index++;quiz.correct=false;renderQuiz();return;}
    const selected=form.querySelector('input:checked');if(!selected)return;
    const correct=Number(selected.value)===q.correct,record=e.attempts[l.id]||{tries:0,wrong:0};record.tries++;if(!correct)record.wrong++;record.lastAt=now();e.attempts[l.id]=record;activity(e);
    feedback.innerHTML=`<div class="feedback ${correct?'correct':''}"><strong>${correct?'Верно, так и действуем':'Давай разберёмся'}</strong><p>${esc(q.why)}</p></div>`;
    if(correct){quiz.correct=true;form.querySelectorAll('input').forEach(i=>i.disabled=true);button.innerHTML=(quiz.index===l.questions.length-1?'Завершить урок':'Следующий вопрос')+icon('arrow');}else{button.disabled=true;button.textContent='Выбери другой ответ';}
  });
}
function finishLesson(e,l) {if(!e.completed.includes(l.id))e.completed.push(l.id);activity(e);quiz=null;updateChrome('lesson');main.innerHTML=`<article class="lesson-content completion fade-in"><div class="content-panel"><div class="success-mark">${icon('check')}</div><h1>Ещё один уверенный шаг</h1><p>Урок «${esc(l.title)}» пройден. Прогресс уже доступен HR в этой локальной симуляции.</p><a class="primary-button" href="#learn">Вернуться к маршруту${icon('arrow')}</a></div></article>`;window.scrollTo({top:0,behavior:'instant'});}
function knowledge(id='') {
  const e=current(),faqs=roleOf(e).faqs,selected=faqs.find(f=>f.id===id);
  main.innerHTML=`<div class="page-width fade-in"><div class="page-intro"><h1>База знаний</h1><p>${esc(roleOf(e).title)} · ${faqs.length} ответов для твоей работы. Материалы демонстрационные.</p></div><div class="search-field">${icon('search')}<label class="sr-only" for="faq-search">Поиск по базе знаний</label><input id="faq-search" type="search" placeholder="Например, ${esc(faqs[0].keywords[0])}" autocomplete="off"></div><div id="faq-results"></div><div class="info-note">${icon('chat')}<p>Не нашлось ответа? <a class="text-link" href="#chat/mentor">Задай вопрос наставнику</a>.</p></div></div>`;
  const input=document.getElementById('faq-search');
  function draw(){const term=input.value.trim().toLocaleLowerCase('ru');const items=faqs.filter(f=>(f.q+' '+f.a+' '+f.keywords.join(' ')).toLocaleLowerCase('ru').includes(term));document.getElementById('faq-results').innerHTML=items.length?`<div class="faq-list">${items.map(f=>`<details ${selected?.id===f.id?'open':''}><summary>${esc(f.q)}${icon('plus')}</summary><div class="faq-answer">${esc(f.a)}${f.lesson?`<a class="subtle-link" href="#lesson/${f.lesson}">Открыть связанный урок${icon('arrow')}</a>`:''}</div></details>`).join('')}</div>`:'<div class="empty-state">Ничего не нашлось. Попробуй другое слово или спроси наставника.</div>';}
  input.addEventListener('input',draw);draw();
}

function botReply(e,text) {
  const normalized=text.toLocaleLowerCase('ru').replace(/ё/g,'е'),faqs=roleOf(e).faqs;
  let match=null,best=0;
  for(const f of faqs){const score=f.keywords.reduce((sum,k)=>sum+(normalized.includes(k.toLocaleLowerCase('ru'))?3:0),0);if(score>best){best=score;match=f;}}
  return match?{text:match.a,faqId:match.id,lessonId:match.lesson,fallback:false}:{text:'В демонстрационной базе твоей специальности нет точного ответа на этот вопрос. Могу передать его наставнику: он увидит обращение в кабинете HR.',fallback:true};
}
function chat(param='') {
  if(['bot','mentor'].includes(param))chatTab=param;
  const e=current(),r=roleOf(e);
  if(chatTab==='mentor'){e.messages.forEach(m=>{if(m.channel==='mentor'&&m.answer)m.read=true;});save();updateChrome('chat');}
  const messages=e.messages.filter(m=>m.channel===chatTab);
  main.innerHTML=`<div class="page-width fade-in"><div class="page-intro"><h1>На связи с командой</h1><p>${esc(r.title)} · помощь по твоему маршруту</p></div><div class="chat-tabs" role="group" aria-label="С кем общаться"><button data-chat="bot" class="${chatTab==='bot'?'active':''}" aria-pressed="${chatTab==='bot'}">Помощник · симуляция</button><button data-chat="mentor" class="${chatTab==='mentor'?'active':''}" aria-pressed="${chatTab==='mentor'}">Наставник${unread(e)?` · ${unread(e)}`:''}</button></div><div class="chat-disclosure">${icon('info')}<p>${chatTab==='bot'?'Это бот-симуляция: он выбирает готовый ответ из базы твоей специальности. Нейросеть и внешние сервисы не подключены.':`Наставник — ${esc(r.mentor)}. Сообщения сохраняются в этом браузере; ответ можно дать в кабинете HR.`}</p></div><div class="chat-log" aria-label="История диалога">${messages.length?messages.map(m=>`<article class="chat-exchange"><div class="chat-bubble user-bubble"><div class="bubble-author">${esc(e.firstName)} · ${esc(timeText(m.created))}</div><p>${esc(m.text)}</p></div>${chatTab==='bot'?`<div class="chat-bubble bot-bubble"><div class="bubble-author">Помощник · ${m.bot?.fallback?'нет точного ответа':'ответ из демобазы'}</div><p>${esc(m.bot?.text||'Ответ недоступен. Задай вопрос ещё раз.')}</p>${m.bot?.faqId?`<a class="subtle-link" href="#knowledge/${esc(m.bot.faqId)}">Источник в базе знаний${icon('arrow')}</a>`:''}${m.bot?.fallback?`<button class="secondary-button escalate-button" data-escalate="${esc(m.id)}" ${m.escalated?'disabled':''}>${m.escalated?'Передано наставнику':'Передать наставнику'}</button>`:''}</div>`:m.answer?`<div class="chat-bubble bot-bubble"><div class="bubble-author">${esc(r.mentor)} · наставник</div><p>${esc(m.answer)}</p></div>`:'<p class="waiting-note">Вопрос ждёт ответа в кабинете HR.</p>'}</article>`).join(''):`<div class="chat-welcome"><h2>${chatTab==='bot'?'С чем помочь?':'Оставь вопрос наставнику'}</h2><p>${chatTab==='bot'?'Попробуй спросить о рабочей ситуации или выбери пример ниже.':'Опиши ситуацию и что уже проверено. Ответ появится здесь.'}</p></div>`}</div>${chatTab==='bot'?`<div class="suggested-questions">${r.faqs.slice(0,3).map(f=>`<button data-suggest="${esc(f.id)}">${esc(f.q)}</button>`).join('')}</div>`:''}<form class="content-panel chat-compose" id="chat-form"><label class="form-label" for="chat-text">${chatTab==='bot'?'Вопрос помощнику':'Вопрос наставнику'}</label><textarea id="chat-text" required minlength="3" maxlength="1500" placeholder="Напиши вопрос по работе"></textarea><div class="form-bottom"><span class="form-hint">Только вымышленные данные. Внешние сообщения не отправляются.</span><button class="primary-button" type="submit">Отправить${icon('send')}</button></div></form><div class="chat-bottom-links"><a href="#hr-questions" class="text-link">Показать, как HR отвечает на вопросы</a></div></div>`;
  main.querySelectorAll('[data-chat]').forEach(b=>b.addEventListener('click',()=>{go('chat/'+b.dataset.chat);}));
  const send=text=>{const clean=text.trim();if(clean.length<3)return;const message={id:uid(),channel:chatTab,text:clean,created:now(),answer:'',read:false};if(chatTab==='bot')message.bot=botReply(e,clean);e.messages.push(message);activity(e);chat();document.getElementById('chat-text')?.focus({preventScroll:true});};
  const form=document.getElementById('chat-form');form.addEventListener('submit',ev=>{ev.preventDefault();const input=document.getElementById('chat-text');if(input.value.trim().length<3){input.setCustomValidity('Напиши хотя бы три символа.');input.reportValidity();return;}send(input.value);});document.getElementById('chat-text').addEventListener('input',ev=>ev.target.setCustomValidity(''));
  main.querySelectorAll('[data-suggest]').forEach(b=>b.addEventListener('click',()=>send(r.faqs.find(f=>f.id===b.dataset.suggest).q)));
  main.querySelectorAll('[data-escalate]').forEach(b=>b.addEventListener('click',()=>{const source=e.messages.find(m=>m.id===b.dataset.escalate);if(!source||source.escalated)return;source.escalated=true;e.messages.push({id:uid(),channel:'mentor',text:source.text,created:now(),answer:'',read:false,fromBot:true});activity(e);chat();toast('Вопрос появился в кабинете HR.');}));
}

function employeeRows(items) {
  return `<div class="employee-table-wrap"><table class="employee-table"><thead><tr><th>Сотрудник</th><th>Маршрут</th><th>Прогресс</th><th>Активность</th><th>Поддержка</th><th><span class="sr-only">Карточка</span></th></tr></thead><tbody>${items.map(e=>`<tr><td><a class="employee-name" href="#employee/${esc(e.id)}"><span class="avatar avatar-small" data-profession="${esc(e.role)}">${esc(initials(e))}</span><span><strong>${esc(fullName(e))}</strong><small>Начало ${esc(dateText(e.startDate+'T12:00:00'))}${e.seeded?' · пример':''}</small></span></a></td><td data-label="Маршрут">${roleLabel(e.role)}</td><td data-label="Прогресс">${progressMarkup(e)}<small class="table-meta">${doneCount(e)} из ${courseOf(e).length} уроков</small></td><td data-label="Активность">${sinceDays(e.lastActivity)===0?'Сегодня':`${sinceDays(e.lastActivity)} дн. назад`}</td><td data-label="Поддержка"><div class="signal-list">${signals(e).length?signals(e).map(s=>`<span class="signal-label ${s.kind}">${s.text}</span>`).join(''):'<span class="quiet-text">Нет открытых сигналов</span>'}</div></td><td><a class="row-open" href="#employee/${esc(e.id)}" aria-label="Открыть карточку ${esc(fullName(e))}">${icon('chevron')}</a></td></tr>`).join('')}</tbody></table></div>`;
}
function hr() {
  const total=db.employees.length,need=db.employees.filter(e=>signals(e).length).length,complete=db.employees.filter(e=>progressOf(e)===100).length,questions=db.employees.reduce((sum,e)=>sum+openQuestions(e).length,0);
  main.innerHTML=`<div class="hr-page fade-in"><div class="page-intro hr-intro"><div><h1>Адаптация команды</h1><p>Учебный прогресс, активность и вопросы новичков. Все сотрудники и исходная история вымышлены.</p></div><a class="primary-button" href="#setup">${icon('plus')}Добавить сотрудника</a></div><div class="hr-summary"><div><span>Новичков в демо</span><strong>${total}</strong></div><div><span>Нужен контакт</span><strong>${need}</strong></div><div><span>Маршрут пройден</span><strong>${complete}</strong></div><a href="#hr-questions"><span>Вопросов без ответа</span><strong>${questions}${icon('arrow')}</strong></a></div><div class="hr-filterbar"><div class="search-field">${icon('search')}<label class="sr-only" for="hr-search">Найти сотрудника</label><input id="hr-search" type="search" placeholder="Имя или фамилия" value="${esc(hrFilter.search)}"></div><label><span class="sr-only">Направление обучения</span><select class="text-input" id="hr-role" aria-label="Направление обучения"><option value="">Все направления</option>${roleOptions(hrFilter.role)}</select></label><label><span class="sr-only">Сигнал поддержки</span><select class="text-input" id="hr-signal" aria-label="Сигнал поддержки"><option value="">Все сотрудники</option><option value="attention" ${hrFilter.signal==='attention'?'selected':''}>Нужен контакт</option><option value="new" ${hrFilter.signal==='new'?'selected':''}>Не начали обучение</option><option value="complete" ${hrFilter.signal==='complete'?'selected':''}>Маршрут пройден</option></select></label></div><div id="hr-results"></div><div class="info-note">${icon('info')}<p>Сигналы для разговора: открытый вопрос, просьба о помощи или отсутствие активности 3+ дня. Это прозрачные правила демо, а не прогноз увольнения и не оценка сотрудника.</p></div></div>`;
  const search=document.getElementById('hr-search'),role=document.getElementById('hr-role'),signal=document.getElementById('hr-signal');
  function draw(){hrFilter={search:search.value,role:role.value,signal:signal.value};const term=search.value.trim().toLocaleLowerCase('ru');const items=db.employees.filter(e=>fullName(e).toLocaleLowerCase('ru').includes(term)&&(!role.value||e.role===role.value)&&(!signal.value||(signal.value==='attention'?signals(e).length:signal.value==='new'?progressOf(e)===0:progressOf(e)===100))).slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));document.getElementById('hr-results').innerHTML=items.length?employeeRows(items):'<div class="empty-state">По этим фильтрам сотрудников нет. Измени запрос или направление.</div>';}
  search.addEventListener('input',draw);role.addEventListener('change',draw);signal.addEventListener('change',draw);draw();
}
function questionCard(e,m) {return `<article class="thread"><div class="thread-head"><a class="text-link" href="#employee/${esc(e.id)}">${esc(fullName(e))} · ${esc(roleOf(e).title)}</a><span class="status-label ${m.answer?'answered':''}">${m.answer?'Есть ответ':'Ждёт ответа'}</span></div><p class="thread-question">${esc(m.text)}</p><p class="form-hint">${esc(timeText(m.created))}${m.fromBot?' · передано из помощника':''}</p>${m.answer?`<div class="thread-answer"><strong>${esc(roleOf(e).mentor)} · наставник</strong><p>${esc(m.answer)}</p></div>`:`<form class="reply-form" data-employee="${esc(e.id)}" data-message="${esc(m.id)}"><label class="form-label" for="reply-${esc(m.id)}">Ответ от имени наставника ${esc(roleOf(e).mentor)}</label><textarea id="reply-${esc(m.id)}" required minlength="3" maxlength="1500" placeholder="Подскажи следующий шаг"></textarea><div class="form-bottom"><span class="form-hint">Ответ появится в кабинете этого сотрудника.</span><button class="primary-button" type="submit">Ответить${icon('send')}</button></div></form>`}</article>`;}
function wireReplies() {main.querySelectorAll('.reply-form').forEach(form=>{const input=form.querySelector('textarea');input.addEventListener('input',()=>input.setCustomValidity(''));form.addEventListener('submit',ev=>{ev.preventDefault();const text=input.value.trim();if(text.length<3){input.setCustomValidity('Добавь содержательный ответ — не менее трёх символов.');input.reportValidity();return;}const e=employeeById(form.dataset.employee),m=e.messages.find(x=>x.id===form.dataset.message);m.answer=text;m.answeredAt=now();m.read=false;save();render();toast('Ответ доступен сотруднику в чате.');});});}
function hrQuestions() {const items=db.employees.flatMap(e=>e.messages.filter(m=>m.channel==='mentor').map(m=>({e,m}))).sort((a,b)=>Number(!!a.m.answer)-Number(!!b.m.answer)||new Date(b.m.created)-new Date(a.m.created));main.innerHTML=`<div class="page-width fade-in"><div class="page-intro"><h1>Вопросы новичков</h1><p>Здесь HR или руководитель может ответить от имени назначенного наставника. Все действия локальные.</p></div>${items.length?items.map(({e,m})=>questionCard(e,m)).join(''):'<div class="empty-state">Вопросов пока нет. Отправь обращение из кабинета новичка.</div>'}</div>`;wireReplies();}
function employeeDetail(id) {
  const e=employeeById(id);if(!e){main.innerHTML='<div class="content-panel"><h1>Сотрудник не найден</h1><a class="text-link" href="#hr">Вернуться к команде</a></div>';return;}
  const r=roleOf(e),questions=e.messages.filter(m=>m.channel==='mentor'),warnings=signals(e),mood={good:'Всё хорошо',okay:'Осваивается',help:'Просит поддержки'}[e.mood]||'Ещё не отмечено';
  main.innerHTML=`<div class="fade-in"><a class="back-link" href="#hr">${icon('back')}К команде</a><div class="page-intro hr-intro"><div><h1>${esc(fullName(e))}</h1><p>${esc(r.title)} · ${esc(r.department)} · начало ${esc(dateText(e.startDate+'T12:00:00'))}</p></div><button class="primary-button" id="open-employee">Открыть кабинет новичка${icon('arrow')}</button></div><div class="employee-detail-grid"><div><section class="content-panel"><div class="section-heading"><h2>Учебный прогресс</h2><strong>${progressOf(e)}%</strong></div>${progressMarkup(e)}<div class="detail-lessons">${courseOf(e).map(l=>`<div><span class="lesson-status ${e.completed.includes(l.id)?'done':''}">${e.completed.includes(l.id)?icon('check'):icon('book')}</span><span><strong>${esc(l.title)}</strong><small>${e.completed.includes(l.id)?'Пройдено':'Ещё не пройдено'}${e.attempts[l.id]?` · ответов ${Number(e.attempts[l.id].tries)||0}, с объяснением ошибки ${Number(e.attempts[l.id].wrong)||0}`:''}</small></span></div>`).join('')}</div><p class="form-hint">История образцов задана для демонстрации. Новые ответы и прогресс записываются из действий в этом браузере.</p></section><section class="section-space"><h2>Вопросы наставнику</h2>${questions.length?questions.slice().reverse().map(m=>questionCard(e,m)).join(''):'<p class="mentor-empty">Этот сотрудник пока не задавал вопросов.</p>'}</section></div><aside><section class="content-panel detail-summary"><h2>Контекст адаптации</h2><dl><div><dt>Наставник</dt><dd>${esc(r.mentor)}</dd></div><div><dt>Последняя активность</dt><dd>${esc(timeText(e.lastActivity))}</dd></div><div><dt>Самочувствие</dt><dd>${mood}</dd></div><div><dt>Источник профиля</dt><dd>${({profile:'Симуляция ONUSERADD',task:'Симуляция кадровой задачи',sample:'Готовый вымышленный пример',legacy:'Импорт предыдущего демо'})[e.source]||'Демоверсия'}</dd></div><div><dt>ID в симуляции Битрикс24</dt><dd>${esc(e.bitrixId)}</dd></div></dl><div class="signal-list">${warnings.map(s=>`<span class="signal-label ${s.kind}">${s.text}</span>`).join('')}</div></section><section class="content-panel contact-panel"><h2>Заметка HR</h2><form id="hr-note-form"><label class="form-label" for="hr-note">Что обсудили или нужно уточнить</label><textarea id="hr-note" required minlength="3" maxlength="1000" placeholder="Например, договорились проверить доступ на следующей смене"></textarea><button class="secondary-button full-width" type="submit">Сохранить заметку</button></form>${e.notes.map(n=>`<div class="hr-note"><small>${esc(timeText(n.created))}</small><p>${esc(n.text)}</p></div>`).join('')}</section></aside></div></div>`;
  document.getElementById('open-employee').addEventListener('click',()=>selectEmployee(id));wireReplies();
  const form=document.getElementById('hr-note-form'),input=document.getElementById('hr-note');input.addEventListener('input',()=>input.setCustomValidity(''));form.addEventListener('submit',ev=>{ev.preventDefault();const text=input.value.trim();if(text.length<3){input.setCustomValidity('Добавь заметку из трёх и более символов.');input.reportValidity();return;}e.notes.unshift({id:uid(),text,created:now()});save();employeeDetail(id);toast('Заметка сохранена в локальной симуляции.');});
}
function about() {
  main.innerHTML=`<div class="page-width fade-in demo-panel"><div class="page-intro"><h1>Как устроена симуляция</h1><p>«В команде» — рабочая демонстрация адаптации для склада, магазинов, продаж и офиса.</p></div><div class="content-panel"><h2>Полный сценарий</h2><ol class="plain-list"><li>Создай вымышленного сотрудника через экран «Битрикс24».</li><li>Пройди урок и тест своей специальности.</li><li>Спроси помощника или передай вопрос наставнику.</li><li>Открой HR, найди того же новичка и проверь прогресс.</li><li>Ответь на обращение и вернись в кабинет сотрудника.</li></ol><h2>Что здесь настоящее</h2><p>Создание профиля, выбор учебной базы, тесты, прогресс, фильтры HR, заметки и переписка работают в этом браузере. Сохранение — localStorage.</p><h2>Что имитируется</h2><p>Битрикс24 не подключён: события и ID создаются локально. Внешних запросов к API нет. Бот выбирает готовые ответы, без нейросети. Переключение сотрудников и HR — демонстрация ролей, а не защищённая авторизация.</p><p>Сотрудники, наставники, история примеров и процедуры вымышлены. Материалы требуют утверждения компанией. Общей базы между устройствами и отправки уведомлений нет.</p>${fieldMapping()}<h2>Последние созданные профили</h2>${db.events.length?`<ul class="event-list">${db.events.slice(-5).reverse().map(event=>{const e=employeeById(event.employeeId);return `<li>${esc(e?fullName(e):'Сотрудник')} · ${event.source==='task'?'кадровая задача':'профиль'} · ${esc(timeText(event.created))}</li>`;}).join('')}</ul>`:'<p>Пока нет: создай первый кабинет на экране симуляции.</p>'}<button class="secondary-button" id="reset-demo">Сбросить эту симуляцию</button><p class="form-hint">Удалятся только данные v3 в этом браузере. Предыдущая версия демо останется нетронутой.</p></div></div>`;
  let confirmed=false;document.getElementById('reset-demo').addEventListener('click',ev=>{if(!confirmed){confirmed=true;ev.target.textContent='Подтвердить сброс симуляции';return;}db=seedDatabase();db.employees=db.employees.filter(e=>e.source!=='legacy');save();activeDay=0;quiz=null;go('setup');toast('Симуляция возвращена к началу.');});
}
function render() {
  let [page,param]=location.hash.slice(1).split('/');page=page||(!db.introDone?'setup':current()?'home':'setup');
  if(page==='designs'){go('setup');return;}
  if(page==='mentor'){page='chat';param='mentor';}
  const student=['home','learn','lesson','knowledge','chat'];
  if(student.includes(page)&&!current()){go('setup');return;}
  if(!db.introDone && (!location.hash || page==='home'))page='setup';
  updateChrome(page);
  if(page==='setup')setup();else if(page==='home')home();else if(page==='learn')learn();else if(page==='lesson')lesson(param);else if(page==='knowledge')knowledge(param);else if(page==='chat')chat(param);else if(page==='hr')hr();else if(page==='hr-questions')hrQuestions();else if(page==='employee')employeeDetail(param);else if(page==='about')about();else{go(current()?'home':'setup');return;}
  document.title=({setup:'Создание сотрудника',home:'Главная',learn:'Обучение',lesson:'Урок',knowledge:'База знаний',chat:'Чат',hr:'HR и руководитель',employee:'Карточка сотрудника','hr-questions':'Вопросы новичков',about:'О симуляции'})[page]+' · В команде';
  window.scrollTo({top:0,behavior:'instant'});
}
document.getElementById('search-trigger').addEventListener('click',()=>{go('knowledge');setTimeout(()=>document.getElementById('faq-search')?.focus(),30);});
document.getElementById('notifications').addEventListener('click',()=>go('chat/mentor'));
document.querySelector('.skip-link').addEventListener('click',ev=>{ev.preventDefault();main.focus();main.scrollIntoView();});
window.addEventListener('hashchange',render);
function installAirMotion() {
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  if(!('IntersectionObserver' in window)||!('MutationObserver' in window))return;
  const seen=new WeakSet();
  const viewportObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('air-visible');viewportObserver.unobserve(entry.target);}});
  },{threshold:.01,rootMargin:'0px 0px 24px 0px'});
  const targets='.welcome-row,.page-intro,.next-lesson,.overall-progress,.section-heading,.days,.route-list,.resource,.mentor-card,.mood-card,.note-card,.content-panel,.faq-list details,.chat-tabs,.chat-disclosure,.chat-welcome,.suggested-questions>button,.chat-exchange,.thread,.hr-summary>div,.hr-summary>a,.hr-filterbar,.employee-table tbody tr,.setup-explanation,.air-integration,.setup-tracks>h2,.track-summary';
  function enhance() {
    main.querySelectorAll(targets).forEach((element,index)=>{
      if(seen.has(element))return;
      seen.add(element);
      if(media.matches)return;
      element.style.setProperty('--air-delay',Math.min(index%6*30,150)+'ms');
      element.classList.add('air-reveal');
      viewportObserver.observe(element);
    });
  }
  // Dynamic chat, quiz feedback and HR filters share the same presentation layer.
  let frame;
  const changes=new MutationObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(enhance);});
  changes.observe(main,{childList:true,subtree:true});
  media.addEventListener('change',()=>{
    if(media.matches){main.querySelectorAll('.air-reveal').forEach(element=>element.classList.add('air-visible'));viewportObserver.disconnect();}
  });
  enhance();
}
save();render();installAirMotion();
