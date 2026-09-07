# Aion DB Offline

Офлайн-база знань по грі **Aion** для iOS та Android. Дані (предмети, NPC, квести, уміння,
титули, ресурси для збору, карти з точками появи) та всі зображення взяті з
[db.aiondestiny.net](https://db.aiondestiny.net) і запаковані в SQLite-бази, які
йдуть разом із застосунком. Після встановлення інтернет не потрібен.

```
.
├── scraper/                 # збір даних із сайту та збірка баз
│   ├── scrape.mjs           # обхід JSON-API сайту -> data/raw/<lang>/*.ndjson
│   ├── download-images.mjs  # завантаження всіх іконок і карт -> data/images/
│   ├── build-db.mjs         # NDJSON + images -> app/assets/db/*.db (+ bundles.generated.ts)
│   ├── ref-kinds.json       # які поля деталей посилаються на які сутності
│   ├── make-icons.mjs       # генерація іконок застосунку (sharp)
│   └── test/query-test.mjs  # перевірка SQL-запитів застосунку на готовій базі
├── app/                     # Expo (React Native) застосунок
│   ├── assets/db/           # aion_ru.db, aion_en.db, assets.db (готові бази)
│   └── src/
│       ├── app/             # екрани (expo-router)
│       ├── components/      # UI, рендери деталей для кожного типу сутностей
│       ├── db/              # доступ до SQLite, FTS-пошук, зображення
│       ├── i18n/            # інтерфейс: українська / русский / english
│       └── state/           # налаштування, закладки, історія
└── data/                    # сирі дані (не в git, відтворюються скриптами)
```

## Що вміє застосунок

* **Пошук** по всіх розділах одразу (FTS5, префіксний пошук, кирилиця, ~130 тис. записів,
  відповідь за мілісекунди).
* **Каталог** із деревом категорій сайту (Зброя → Мечі, Доспіхи → Кожана броня → Верх …),
  фільтр за назвою, рівнем, якістю та расою (як на сайті).
* **Детальні сторінки**: характеристики, бонуси, випадкові стати, комплекти, ціни,
  з кого випадає / хто продає / для яких квестів потрібен; для NPC — дроп, квести,
  локації; для квестів — нагороди, NPC, предмети; уміння, титули, ресурси.
* **Карти** з превʼю, списком NPC/ресурсів на карті та **точками появи** (pinch-zoom).
* **Закладки** та історія переглядів.
* Мова інтерфейсу: uk / ru / en. Мова ігрових даних: ru та en (окремі бази).

## Збірка застосунку

Потрібен Node.js 22+. Готові бази вже лежать в `app/assets/db/` (`aion_ru.db` 50 МБ,
`aion_en.db` 43 МБ, `assets.db` 42 МБ — зріз від 2026-09-07), тому для збірки
достатньо (для скриптів у `scraper/` окремо `cd scraper && npm install`):

```bash
cd app
npm install
```

### Android (APK для встановлення на телефон)

```bash
# варіант 1: локально (потрібні Android SDK + JDK 17)
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk

# варіант 2: у хмарі через EAS (безкоштовний акаунт expo.dev; профілі в app/eas.json)
npm i -g eas-cli && eas login
eas build --platform android --profile preview   # -> APK для встановлення напряму
```

### iOS

Для iOS потрібен Mac з Xcode (або EAS Build). Встановлення на власний iPhone без
App Store можливо через безкоштовний Apple ID (7 днів) або платний Apple Developer
акаунт (TestFlight / Ad Hoc).

```bash
npx expo prebuild --platform ios
npx expo run:ios --device          # або відкрити ios/*.xcworkspace в Xcode
# або
eas build --platform ios --profile preview
```

### Розробка

```bash
npx expo start          # Expo Go не підійде (потрібен expo-sqlite з FTS) — використовуйте dev build:
npx expo run:android    # / npx expo run:ios
```

Перевірки: `npx tsc --noEmit`, `npx eslint src`.

## Оновлення даних із сайту

```bash
# 1. Зібрати дані (ru — основна мова сайту, en — англійська; є також de, fr, pl, tr, es)
node scraper/scrape.mjs --lang ru --stage all --concurrency 8
node scraper/scrape.mjs --lang ru --stage spawns          # точки появи NPC/ресурсів на картах
node scraper/scrape.mjs --lang ru --stage races           # списки предметів за расою (для фільтра)
node scraper/scrape.mjs --lang en --stage all --concurrency 8

# 2. Завантажити зображення (іконки, карти) — докачує лише відсутні
node scraper/download-images.mjs

# 3. Зібрати бази для застосунку
node scraper/build-db.mjs --lang ru            # + assets.db
node scraper/build-db.mjs --lang en --assets false

# 4. Перевірити запити
node --experimental-strip-types scraper/test/query-test.mjs app/assets/db/aion_ru.db "меч стража"
```

Скрапер працює з JSON-API сайту (`/api/{item,npc,quest,skill,title,harvest}/{search,info}`,
`/api/map/*`), обробляє анти-бот cookie (`__hash_`), відновлюється після обриву
(вже завантажені записи пропускаються). Повний обхід одної мови — близько
131 000 запитів (~1.5–2 години при 8 паралельних запитах).

`build-db.mjs` нормалізує JSON (посилання на інші сутності зберігаються лише як id,
назви й іконки підтягуються з таблиці `entities`), стискає деталі deflate блоками по 64
записи (320 МБ сирого JSON → ~17 МБ) і будує FTS5-індекс. База однієї мови ≈ 50 МБ. Зображення зберігаються BLOB-ами в `assets.db`
і показуються через `data:`-URI.

## Схема бази (`aion_<lang>.db`)

| Таблиця | Призначення |
|---|---|
| `entities` | короткі картки всіх сутностей (kind, id, name, level, quality, image, tags) |
| `search` | FTS5-індекс поверх `entities` (kind, name, tags) |
| `blocks` | повний JSON деталей блоками по 64 послідовних id, кожен блок — raw-deflate (`{id: detail, …}`) |
| `categories` | дерево категорій сайту для каталогу |
| `maps`, `map_entities`, `spawns` | карти, хто на них є, координати появи |
| `meta` | мова, дата зрізу, кількості записів, розмір блоку |

## Ліцензія та джерело даних

Ігрові дані належать NCSoft / Gameforge, зібрані сайтом db.aiondestiny.net.
Застосунок зроблено для особистого некомерційного використання. Перед публікацією
у Google Play / App Store варто узгодити використання даних і зображень із власниками
сайту db.aiondestiny.net.
