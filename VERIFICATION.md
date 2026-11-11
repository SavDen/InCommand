# Verification history

История проверок исходного демо сохранена ниже. В этой поставке сайт находится в корне репозитория; локальные скриншоты и служебные каталоги прежнего хостинга не включены.

# Проверка демоверсии

## Полная симуляция v3 — 11 ноября 2026

- Первый вход открывает «Симуляция Битрикс24: создание сотрудника». Проверены оба источника: профиль и кадровая задача; формой не вызывается реальный API.
- Через UI созданы четыре вымышленных сотрудника: склад, магазин, продажи, офис. У каждого проверены пять уроков своего маршрута и назначенный наставник.
- Пробельное имя отклоняется, запись не создаётся. После валидного ввода кнопка блокируется до перехода, чтобы не создавать дубли повторным нажатием.
- Для продавца выполнен полный сценарий: ошибка → объяснение → повтор → вводный урок → профессиональный урок из двух вопросов. Прогресс 0 → 40% появился в HR.
- Бот ответил на вопрос о размере/наличии из базы продавца, ссылка открыла соответствующий раскрытый ответ справочника.
- Неизвестный вопрос дал явный отказ от предположения и возможность передать наставнику. Обращение появилось в HR у того же сотрудника.
- Ответ HR и заметка сохранены; при возврате новичок увидел ответ наставника. Перезагрузка сохранила сотрудников, прогресс и переписку.
- Переключение между сотрудниками не переносит прогресс. Просьба о помощи видна в HR; ответы наставника закрывают открытый вопрос без автоматического снятия отдельной отметки самочувствия.
- Node: `tests/model.test.cjs` проверяет четыре базы, 20 уроков, 36 вопросов, 25 FAQ, валидность связей, поиск бота, раздельные данные, сигналы HR и сохранение. Все проверки прошли.
- Синтаксис трёх JS-файлов проверен Node, `git diff --check` прошёл. Локальный HTTP — 200. Ошибок и предупреждений в браузерном журнале сценария нет.
- В браузерном предпросмотре проверены ширины 320, 390, 768, 1024 и 1440px. Тело страницы белое. Исправлена горизонтальная прокрутка: уведомления центрируются без translateX, HR на компактных планшетах до 980px использует карточки вместо широкой таблицы.
- Справочник, чат, форма и раскрытая таблица API-полей проверены на узком экране. Таблица полей прокручивается внутри своего блока.
- Снимки: .impeccable/review/v3/; финальный независимый обзор — ship. Детектор: только замечания о смене токенов относительно прежнего DESIGN.md, без иных предупреждений; документация системы обновлена.
- Источники API и ограничения записаны в BITRIX24.md. Не проверены настоящий портал, права/тариф, доставка событий, реальные приглашения, межустройственная работа, реальные телефоны, другие движки и экранный диктор. Это локальные мок-данные и роли, не авторизация.

## Редизайн в сторону Slite — 11 ноября 2026

- Сохранены название, маршруты, уроки, тесты, справочник, переписка, роли демо и ключ localStorage.
- CUA: повторно пройден сценарий неверный ответ → объяснение → правильные ответы на три вопроса → завершение урока. Прогресс 1/5 → 2/5.
- CUA: вопрос новичка → ответ наставника → возврат к новичку → перезагрузка. Переписка сохранилась.
- Поиск «пропуск», раскрытие ответа и пустая выдача работают на ширине 320px.
- Отметка самочувствия сохраняется; новые подписи сопровождают иконки.
- Главная без горизонтальной прокрутки на 320, 390, 768, 1024 и 1440px. Тест и переписка проверены на 390px, справочник — на 320px.
- Вычисленный размер вариантов ответа, поля сообщения и ответа справочника — 16px. Подписи — не меньше 12px.
- На 390×844px первая строка маршрута начинается на y=595px; компактный блок урока оставляет больше места маршруту.
- Основная кнопка: #2d2f34 на #f67748, контраст 4.88:1; hover использует более светлый #ff875d с тёмным текстом.
- Node проверил синтаксис JavaScript; HTTP предпросмотра — 200; в браузерном журнале сценария нет ошибок и предупреждений.
- Снимки главной 1440/390px, мобильного теста и переписки сохранены в .impeccable/review/slite/. Свежий независимый обзор: ship, обязательных исправлений нет.
- Проверка проведена в браузере с изменением viewport; физические телефоны, другие движки и экранный диктор не проверялись. Авторизация, сервер и Битрикс24 остаются за рамками демо.

## Первоначальная версия

Выполнено 11 ноября 2026 через браузер Codex (CUA), локальный Python HTTP server и Node.js.

- `node --check app.js`: синтаксис корректен.
- Локальный сервер отвечает HTTP 200.
- Урок «Как собрать первый заказ»: неправильный ответ → объяснение → повторная попытка → три верных ответа → завершение. Прогресс изменился с 1/5 на 2/5.
- Кнопка «Перечитать урок» возвращает к материалу с текущего адреса теста.
- Вопрос новичка → переключение в роль наставника → ответ → роль новичка. Ответ отображается.
- Перезагрузка сохраняет завершённый урок и переписку.
- Поиск «пропуск» фильтрует справочник; найденный ответ раскрывается.
- Мобильная навигация открывает обучение, справочник и наставника.
- Главная: document.scrollWidth не превышает viewport на 320, 390, 768 и 1440 px.
- Экран теста на 320 px и маршрут на 390 px: горизонтальной прокрутки нет.
- Ссылка перехода к содержимому по Enter переводит фокус в main, не меняет маршрут.
- В ходе основного сценария в журнале браузера нет ошибок и предупреждений.
- Сохранены настольный и мобильный снимки. Проверены читаемость, переносы и доступность основной кнопки.
- Исправлены маленькие подписи и контраст основной кнопки (белый на #ca4520, 4.79:1).

Не проверено: реальные iPhone/Android, другие браузерные движки, полный аудит с экранным диктором, нагрузка, реальный Битрикс24 и обмен между устройствами. Реальной авторизации и общего сервера в демоверсии нет. Утверждение учебных процедур работодателем не проводилось.

## First-screen design studies · 2026-11-11

- Added three optional, directly linked studies: Air / Dossier / Console; the existing setup and application routes remain available.
- CUA browser pass: desktop 1440 px, mobile 390 px, and width checks at 320 / 768 / 1024 px for all three. No root horizontal overflow; form controls and the demo notice remain present. Saved desktop and full-page mobile captures in the ignored .impeccable/review/variants folder.
- Entered fictional name Лев Демов, warehouse position and hiring-task source; cycled all three styles. All field values, role preview and ONTASKADD explanation remained unchanged. Submitted once from Console: correct warehouse account opened with zero completed lessons and the preview-only theme was removed.
- Returned to ordinary setup: comparison entry and one form present; no study theme applied. Browser console reported no errors in this pass.
- Ran node --check app.js and tests/model.test.cjs: all 4 roles, 20 lessons and 36 questions, isolation, retrieval, HR signals, replies and persistence passed.
- Contrast calculation: Dossier button's lightest background with white text 4.58:1; orange button's darkest background with dark text 5.43:1; secondary text on Console background 4.58:1. Darkened study placeholders after a 4.29:1 finding.
- Not checked: physical mobile devices, Safari/Firefox, full screen-reader traversal. These are first-page studies; remaining application screens have not been restyled to any of the three directions.

## Accepted Air application · 2026-11-11

- Promoted the selected Air first screen into #setup; historical #designs/* links redirect there. Removed the discarded chooser and preview-only stylesheet. LocalStorage v3 and training content are preserved.
- Applied Air surfaces throughout setup, learner home, route, lesson, quiz, completion, knowledge base, bot/mentor chat, HR overview/questions/detail and simulation information. Final user steering is reflected in the custom orange/cobalt/white palette, translucent glass, component reveals and interactive motion.
- Browser inspection: all ten principal routes at desktop 1440 px and mobile 390 px; final overflow matrix at 320 / 390 / 768 / 1024 px (40 route/viewport combinations) reported zero page-level horizontal overflow. HR records become cards at 980 px; narrow-phone mood choices use 51px rows.
- Mobile end-to-end flow: empty setup blocked by native validation; fictional Вера Демова / retail / hiring-task source assigned the retail route and mentor. Wrong answer showed explanation; retry completed the lesson. HR showed 20% and 2 attempts / 1 wrong answer.
- Bot answered a role-specific question with a working source link that opened the related FAQ. Unknown question was escalated, answered in HR and read in the employee's mentor chat; the reply survived refresh. A later mood update appeared in HR as “Просит поддержки”. No external messages or API requests were involved.
- Glass confirmed from computed styles: sidebar and mobile navigation blur(20px) saturate(1.3), sidebar white opacity 0.79; form blur(10px). Unsupported browsers retain white fallbacks through @supports. Mobile form text remains 16px.
- Motion confirmed: all 12 main home blocks became visible after natural scrolling; dynamically replaced HR records, chat and quiz content remained usable. Hover/press/focus, FAQ, feedback, messages and progress animations are defined; no browser console errors were reported. Reduced-motion code and CSS were reviewed; the OS preference itself was not changed during QA.
- Contrast calculations: navy #1e2b45 on the orange gradient 4.90–5.83:1; white on the lightest hero blue 4.59:1; completion teal on its tint 4.56:1; office role text on its tint 4.73:1; placeholders on fields 4.80:1. Hero secondary text was changed to white after an initial 3.81:1 finding.
- Fixed mobile header crowding, compact-tablet support layout, setup toolbar padding and a transient inner table scrollbar caused by entering rows. Saved screenshots under ignored .impeccable/review/air-app.
- Checks: node --check app.js; node tests/model.test.cjs (4 roles, 20 lessons, 36 questions, 25 FAQs, isolation, retrieval, HR signals/replies and persistence); git diff --check.
- Not verified: physical phones, Safari/Firefox, full screen-reader traversal, live OS reduced-motion change, glass fallback in an unsupported browser, or real Bitrix24/LLM/auth/backend integration. The latter remain intentionally absent from this local simulation.

## Onest typography · 2026-11-11

- Replaced the shared Manrope family with self-hosted Onest across all pages and native form controls. Added font preload; removed four unused Manrope files and their licence. Onest's OFL and source/hash record ship with the font.
- Downloaded the unmodified Google Fonts variable TTF: Onest 2.001, 193,056 bytes, weight axis 100–900. fontTools confirmed its family/version and complete coverage of the Russian sample “В команде. Новичок Ёжик 0123456789”.
- Browser verified document.fonts status loaded, Cyrillic/regular/bold font checks and computed Onest on headings, buttons and fields. Checked all 10 principal routes at 320 / 390 / 430 px, plus 5 representative routes at 768 / 1440 px: 40 route/viewport cases with no page horizontal overflow or clipped headings/buttons.
- Opened the situational quiz at 320 px and confirmed Onest on the question and answer action. Inspected mobile home, setup and HR screenshots; no spacing or breakpoint changes were needed. Browser console had no errors.
- Checks: node --check app.js and git diff --check. JavaScript behavior and storage were unchanged; existing model tests were not rerun for this typography-only change.
- Not checked: physical devices, other browser engines, native OS select-menu rendering or slow-network font swapping. Screenshots: .impeccable/review/onest.


## GitHub Pages folder preparation · 2026-11-11

- Copied the latest Onest build into the repository root with relative URLs, font licence and source record. Added .nojekyll and branch/root publication instructions.
- Adjusted existing model tests to read root JavaScript files. Excluded .git, .openai, .impeccable, local screenshots and archives from the transferred source.
- GitHub publication itself is left to the repository owner.
