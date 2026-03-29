TRENDSETTER MARKET PRO

1) Скопируй .env.example в .env
2) Вставь свой BOT_TOKEN, WEB_APP_URL, ADMIN_CHAT_ID и ADMIN_KEY
3) Установи зависимости:
   npm.cmd install

Проверка токена:
   node check-token.js

Запуск:
   node server.js
   node bot.js

Сайт магазина:
   http://localhost:3000

Админка:
   http://localhost:3000/admin.html

В админке можно:
- добавлять товары
- удалять товары
- редактировать цену, скидку, размеры, описание
- отмечать "нет в наличии"
- включать баннер на главной
- смотреть заказы

Данные хранятся в:
   data/store.json
