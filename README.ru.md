<p align="center"><img src="images/yapix_mark.svg" width="96" alt="Yapix"></p>

<h1 align="center">Yapix</h1>

<p align="center">
  <b>Документация API, мок-сервер и тесты API для команд. Продолжение YApi с поддержкой безопасности.</b>
</p>

<p align="center">
  <a href="https://github.com/Perruer/yapix/actions/workflows/ci.yml"><img src="https://github.com/Perruer/yapix/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/Perruer/yapix/releases"><img src="https://img.shields.io/github/v/release/Perruer/yapix" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="Apache-2.0"></a>
</p>

<p align="center"><a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · Русский</p>

---

[YApi](https://github.com/YMFE/yapi) от YMFE — одна из самых популярных платформ управления API для своих серверов (27,7 тыс. звёзд). Последний релиз вышел в ноябре 2022 года. С тех пор YApi не запускается на актуальном Node.js, его клиент нельзя пересобрать, нужное ему расширение браузера больше не работает в Chrome, а известные уязвимости, включая выполнение кода через мок-скрипты, так и не закрыты.

Yapix продолжает YApi 1.12 и делает его безопасным в работе. Существующая база YApi подходит как есть: пользователи, проекты, интерфейсы, тестовые наборы и моки сохраняются.

## Чем отличается от YApi 1.12

| | YApi 1.12 | Yapix 2.0 |
| --- | --- | --- |
| Node.js | до 20; на 22+ ломаются токены проектов | 24 LTS |
| Слой базы данных | Mongoose 5.7 (2019) | Mongoose 9; MongoDB 4.4–8 |
| Мок- и тест-скрипты | `vm2`/`safeify` и `node:vm`, которые не изолируют скрипты от сервера | отдельный изолят V8 на каждый запуск, с лимитами памяти и времени и без доступа к Node.js |
| Токены проектов | без `passsalt` шифруются общеизвестным ключом `abcde`: участник проекта может подделать токен другого пользователя | случайный ключ в базе; поддельные токены YApi отклоняются (есть режим миграции) |
| Первый админ | пароль `ymfe.org` | `YAPIX_ADMIN_PASSWORD` или случайный пароль |
| Хранение паролей | SHA-1 с солью | scrypt, старые хеши заменяются при входе |
| Известные уязвимости в production-зависимостях | 244 (50 критических) | 1, с защитой (Mock.js, исправленной версии нет) |
| Сборка клиента | ykit (webpack 1) и node-sass: больше не собирается | webpack 5, Babel 7, dart-sass |
| Расширение браузера для вкладки «Запуск» | cross-request (Manifest V2, в Chrome уже не работает, без лицензии) | Yapix Request Helper (Manifest V3, Apache-2.0), работает только на разрешённых сайтах |
| Тестовые запросы с сервера | сертификаты TLS не проверяются (CVE-2025-70058) | проверяются; для тестовых стендов можно отключить |
| Docker | образы сообщества | официальный образ для amd64 и arm64 |
| Проверка обновления | — | CI на каждое изменение наполняет базу через YApi 1.12 и проверяет её в Yapix |

Полный список — в [SECURITY.md](SECURITY.md) и [журнале изменений](CHANGELOG.md). Всё остальное работает как в YApi 1.12: интерфейсы и категории, JSON Schema, моки на Mock.js и ожидания, тестовые наборы и отчёты, импорт Swagger/Postman/HAR, экспорт, открытый API, вики, плагины и LDAP.

## Быстрый старт

### Docker

```bash
curl -O https://raw.githubusercontent.com/Perruer/yapix/main/docker-compose.yml
YAPIX_ADMIN_PASSWORD='длинный пароль' docker compose up -d
```

Откройте http://localhost:3000 и войдите как `admin@admin.com`. Настройки описаны в [docs/devops/docker.md](docs/devops/docker.md).

### Из исходников

Нужны Node.js 24 и MongoDB 4.4 или новее.

```bash
mkdir yapix && cd yapix
git clone https://github.com/Perruer/yapix.git vendors
cp vendors/config_example.json config.json      # укажите db, adminAccount и остальное
cd vendors
npm ci
npm run build-client
YAPIX_ADMIN_PASSWORD='длинный пароль' npm run install-server
npm start
```

Как и в YApi, `config.json` лежит рядом с папкой `vendors`; переменная `YAPIX_CONFIG=/путь/к/config.json` задаёт другое место.

### Расширение браузера

Чтобы отправлять запросы со вкладки «Запуск» и гонять тестовые наборы в браузере, установите **Yapix Request Helper** (Chrome, Edge и другие браузеры на Chromium). Скачайте его на вкладке «Запуск» или в [релизах](https://github.com/Perruer/yapix/releases), загрузите как распакованное расширение и разрешите свой сайт Yapix в его окне. Подробно — в [docs/documents/extension.md](docs/documents/extension.md).

## Переход с YApi

Сделайте резервную копию MongoDB, остановите YApi и запустите Yapix на той же базе. Сначала прочитайте [UPGRADING.md](UPGRADING.md) (на английском): там про версии MongoDB, токены, которые нужно заменить, ограничения скриптов и новое расширение.

## Документация

- [Руководство пользователя](docs/documents/index.md) (на китайском, из YApi)
- [Открытый API](docs/documents/openapi.md)
- [Docker](docs/devops/docker.md)
- [Разработка плагинов](docs/documents/plugin-dev.md)

## Разработка

```bash
npm ci
npm test                 # юнит-тесты
npm run dev-client       # пересборка клиента при изменениях
npm run dev-server       # перезапуск сервера при изменениях
```

Сквозные тесты (`test/e2e/`) работают с запущенным сервером: сценарий API, обновление с базы YApi 1.12 и расширение браузера. Как их запускать, видно в workflow CI.

## Поддержать проект

Я поддерживаю Yapix в свободное время. Если он помогает вашей команде документировать и тестировать API, можно поддержать проект:

- [Boosty](https://boosty.to/mikio_kuroki/donate)
- USDT / TRX (TRC-20): `TXUBW4e88SDTfrnJRKfbhYfFcggufbonc1`
- USDT / USDC / ETH (ERC-20): `0x1378491169064702786b2E5b58c6375776177E8A`
- TON / USDT (TON): `UQAhI7EKzoa-JuKOfv0ULMzA3FrmpxsDkXj8Qevwj2z1cMRN`

## Лицензия

[Apache-2.0](LICENSE), как у YApi. Yapix — продолжение [YApi](https://github.com/YMFE/yapi) от YMFE (Qunar), см. [NOTICE](NOTICE). Исходный README сохранён в [docs/upstream-README.md](docs/upstream-README.md). Yapix не связан с YMFE и Qunar и не одобрен ими.
