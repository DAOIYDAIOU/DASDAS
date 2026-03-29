require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

// 👇 ТВОЙ ДОМЕН
const WEB_APP_URL = "https://mybot.bothost.ru";

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN отсутствует");
  process.exit(1);
}

bot.start((ctx) => {
  return ctx.reply(
    "Добро пожаловать в TRENDSETTER MARKET 🔥",
    Markup.inlineKeyboard([
      [Markup.button.webApp("🛍 Открыть магазин", WEB_APP_URL)]
    ])
  );
});

bot.command("admin", (ctx) => {
  return ctx.reply(
    "Открыть админку",
    Markup.inlineKeyboard([
      [Markup.button.webApp("🛠 Админка", WEB_APP_URL + "/admin.html")]
    ])
  );
});

bot.launch();

console.log("BOT STARTED");
