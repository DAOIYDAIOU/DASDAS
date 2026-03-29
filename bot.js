require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const BOT_TOKEN = String(process.env.BOT_TOKEN || "").trim();
const RAW_WEB_APP_URL = String(process.env.WEB_APP_URL || "").trim();
const WEB_APP_URL = /ngrok-free\.dev/i.test(RAW_WEB_APP_URL) ? "" : RAW_WEB_APP_URL;
const ADMIN_CHAT_ID = String(process.env.ADMIN_CHAT_ID || "").replace(/\s+/g, "").trim();
const ADMIN_IDS_ENV = String(process.env.ADMIN_IDS || "").trim();
const ADMIN_KEY = String(process.env.ADMIN_KEY || "trendsetter_admin_2026").trim();
const DATA_DIR = path.join(__dirname, "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

function formatRub(value) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

if (!BOT_TOKEN) {
  console.error("Ошибка: BOT_TOKEN пустой.");
  process.exit(1);
}

function normalizeId(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function envAdmins() {
  const ids = ADMIN_IDS_ENV.split(",").map(v => normalizeId(v)).filter(Boolean);
  if (ADMIN_CHAT_ID && !ids.includes(ADMIN_CHAT_ID)) ids.unshift(ADMIN_CHAT_ID);
  return [...new Set(ids)];
}

function defaultStore() {
  return {
    banner: {
      enabled: true,
      text: "Новая коллекция уже в магазине • Скидки до 25% • Быстрая доставка",
      subtext: "TRENDSETTER MARKET — dark streetwear vibe",
      ctaText: "Смотреть дроп"
    },
    products: [],
    orders: [],
    admins: []
  };
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readStore() {
  ensureDataDir();
  try {
    const data = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
    data.admins = Array.isArray(data.admins) ? data.admins.map(v => normalizeId(v)).filter(Boolean) : [];
    return data;
  } catch {
    const data = defaultStore();
    writeStore(data);
    return data;
  }
}

function writeStore(data) {
  ensureDataDir();
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), "utf8");
}

function getAdmins() {
  const store = readStore();
  return [...new Set([...envAdmins(), ...(store.admins || [])])];
}

function isSuperAdmin(userId) {
  return !!ADMIN_CHAT_ID && normalizeId(userId) === ADMIN_CHAT_ID;
}

function isAdmin(userId) {
  return getAdmins().includes(normalizeId(userId));
}

function addAdmin(userId) {
  const id = normalizeId(userId);
  if (!id) return;
  const store = readStore();
  store.admins = Array.isArray(store.admins) ? store.admins : [];
  if (!store.admins.includes(id)) {
    store.admins.unshift(id);
    writeStore(store);
  }
}

function removeAdmin(userId) {
  const id = normalizeId(userId);
  const store = readStore();
  store.admins = Array.isArray(store.admins) ? store.admins.filter(v => normalizeId(v) !== id) : [];
  writeStore(store);
}

function adminSig(userId) {
  return crypto.createHmac("sha256", ADMIN_KEY).update(normalizeId(userId)).digest("hex");
}

function hasWebAppUrl() {
  return /^https?:\/\//i.test(WEB_APP_URL);
}

function adminPanelUrl(userId) {
  if (!hasWebAppUrl()) return null;
  const url = new URL("/admin.html", WEB_APP_URL);
  url.searchParams.set("uid", normalizeId(userId));
  url.searchParams.set("sig", adminSig(userId));
  return url.toString();
}


if (RAW_WEB_APP_URL && !WEB_APP_URL) {
  console.warn("WEB_APP_URL с ngrok отключён. Используй домен хостинга.");
}

const bot = new Telegraf(BOT_TOKEN);

bot.start(async (ctx) => {
  const userId = normalizeId(ctx.from.id);
  const rows = [];
  if (hasWebAppUrl()) rows.push([Markup.button.webApp("🛍 Открыть магазин", WEB_APP_URL)]);
  if (isAdmin(userId) && adminPanelUrl(userId)) {
    rows.push([Markup.button.webApp("🛠 Открыть админку", adminPanelUrl(userId))]);
  }
  const message = hasWebAppUrl()
    ? "Добро пожаловать в TRENDSETTER MARKET 🔥"
    : `Добро пожаловать в TRENDSETTER MARKET 🔥
Сайт ещё не подключён. Сначала задай WEB_APP_URL в панели хостинга.`;
  if (rows.length) return ctx.reply(message, Markup.keyboard(rows).resize());
  await ctx.reply(message);
});

bot.command("myid", async (ctx) => {
  await ctx.reply(`Твой ID: ${ctx.from.id}`);
});

bot.command("debugadmin", async (ctx) => {
  const userId = normalizeId(ctx.from.id);
  const admins = getAdmins();
  await ctx.reply(
    `DEBUG ADMIN\n` +
    `Ты: ${userId}\n` +
    `Главный: ${ADMIN_CHAT_ID || "не задан"}\n` +
    `ADMIN_IDS: ${ADMIN_IDS_ENV || "пусто"}\n` +
    `Все админы: ${admins.join(", ") || "нет"}\n` +
    `isAdmin: ${isAdmin(userId) ? "YES" : "NO"}\n` +
    `isSuperAdmin: ${isSuperAdmin(userId) ? "YES" : "NO"}`
  );
});

bot.command("admin", async (ctx) => {
  const userId = normalizeId(ctx.from.id);
  if (isAdmin(userId)) {
    const url = adminPanelUrl(userId);
    if (!url) return ctx.reply("Админка включится после того, как ты задашь WEB_APP_URL в панели хостинга.");
    return ctx.reply(
      "Админка доступна ✅",
      Markup.inlineKeyboard([[Markup.button.webApp("🛠 Открыть админку", url)]])
    );
  }
  if (isSuperAdmin(userId)) {
    return ctx.reply(
      "Ты главный админ. Нажми кнопку ниже, чтобы активировать себе админку.",
      Markup.inlineKeyboard([[Markup.button.callback("✅ Активировать себе админку", "activate_self_admin")]])
    );
  }
  return ctx.reply("У тебя нет прав администратора.");
});

bot.command("activate_admin", async (ctx) => {
  const userId = normalizeId(ctx.from.id);
  if (!isSuperAdmin(userId) && !isAdmin(userId)) {
    return ctx.reply("Тебя нет в списке админов.");
  }
  addAdmin(userId);
  const url = adminPanelUrl(userId);
  if (!url) return await ctx.reply(`Админ активирован ✅
Теперь задай WEB_APP_URL в панели хостинга, чтобы открыть админку.`);
  await ctx.reply(
    "Админ активирован ✅",
    Markup.inlineKeyboard([[Markup.button.webApp("🛠 Открыть админку", url)]])
  );
});

bot.command("addadmin", async (ctx) => {
  const userId = normalizeId(ctx.from.id);
  if (!isSuperAdmin(userId)) return ctx.reply("Только главный админ может добавлять админов.");
  const targetId = normalizeId((ctx.message.text.split(/\s+/)[1] || ""));
  if (!targetId) return ctx.reply("Используй так: /addadmin 123456789");
  addAdmin(targetId);
  await ctx.reply(`Админ ${targetId} добавлен ✅`);
});

bot.command("removeadmin", async (ctx) => {
  const userId = normalizeId(ctx.from.id);
  if (!isSuperAdmin(userId)) return ctx.reply("Только главный админ может удалять админов.");
  const targetId = normalizeId((ctx.message.text.split(/\s+/)[1] || ""));
  if (!targetId) return ctx.reply("Используй так: /removeadmin 123456789");
  if (targetId === ADMIN_CHAT_ID) return ctx.reply("Главного админа удалить нельзя.");
  removeAdmin(targetId);
  await ctx.reply(`Админ ${targetId} удалён.`);
});

bot.command("admins", async (ctx) => {
  const userId = normalizeId(ctx.from.id);
  if (!isAdmin(userId) && !isSuperAdmin(userId)) return ctx.reply("У тебя нет доступа.");
  const list = getAdmins();
  await ctx.reply("Список админов:\n" + list.map(id => `• ${id}`).join("\n"));
});

bot.action("activate_self_admin", async (ctx) => {
  const userId = normalizeId(ctx.from.id);
  if (!isSuperAdmin(userId)) return ctx.answerCbQuery("Нет доступа");
  addAdmin(userId);
  await ctx.answerCbQuery("Админ активирован");
  const url = adminPanelUrl(userId);
  if (!url) return await ctx.reply(`Админ активирован ✅
Теперь задай WEB_APP_URL в панели хостинга, чтобы открыть админку.`);
  await ctx.reply(
    "Админ активирован ✅",
    Markup.inlineKeyboard([[Markup.button.webApp("🛠 Открыть админку", url)]])
  );
});

bot.command("shop", async (ctx) => {
  if (!hasWebAppUrl()) return ctx.reply("Магазин включится после того, как ты задашь WEB_APP_URL в панели хостинга.");
  await ctx.reply("Открываю магазин 👇", Markup.inlineKeyboard([[Markup.button.webApp("Открыть магазин", WEB_APP_URL)]]));
});

bot.on("message", async (ctx) => {
  const webAppData = ctx.message?.web_app_data;
  if (!webAppData) return;
  try {
    const data = JSON.parse(webAppData.data);
    if (data.type === "order") {
      const itemsText = (data.items || [])
        .map(item => `• ${item.title} / ${item.size} / x${item.qty} — ${formatRub(item.lineTotal)}${item.availability === "preorder" ? " • под заказ" : ""}`)
        .join("\n");
      await ctx.reply("Заказ принят ✅");
      if (ADMIN_CHAT_ID) {
        await ctx.telegram.sendMessage(
          ADMIN_CHAT_ID,
          `🛒 Новый заказ\n\nПокупатель: @${ctx.from.username || "без username"}\nID: ${ctx.from.id}\n\n${itemsText}\n\nИтого: ${formatRub(data.total)}`
        );
      }
    }
  } catch (e) {
    console.error("Ошибка обработки заказа:", e.message);
  }
});

async function startBot() {
  try {
    const me = await bot.telegram.getMe();
    console.log(`Bot running: @${me.username}`);
    await bot.telegram.setChatMenuButton({ menu_button: { type: "commands" } });
    await bot.launch();
  } catch (e) {
    console.error("Ошибка запуска бота:", e.message);
    process.exit(1);
  }
}

startBot();
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
