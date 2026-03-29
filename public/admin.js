const adminView = document.getElementById("adminView");
const deniedView = document.getElementById("deniedView");
const productsAdmin = document.getElementById("productsAdmin");
const ordersAdmin = document.getElementById("ordersAdmin");
const adminsAdmin = document.getElementById("adminsAdmin");
const adminManageBox = document.getElementById("adminManageBox");
const newAdminIdInput = document.getElementById("newAdminId");
const addAdminBtn = document.getElementById("addAdminBtn");
const quickSearch = document.getElementById("quickSearch");
const quickAvailabilityFilter = document.getElementById("quickAvailabilityFilter");
const statsGrid = document.getElementById("statsGrid");

const params = new URLSearchParams(location.search);
const adminUid = params.get("uid") || "";
const adminSig = params.get("sig") || "";

let store = { banner: {}, products: [], orders: [], admins: [], isSuperAdmin: false, superAdminId: null };

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "x-admin-uid": adminUid,
    "x-admin-sig": adminSig
  };
}

function parseNumber(value) {
  const cleaned = String(value || "").trim().replace(/\s+/g, "").replace(",", ".");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function formatRub(value) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function availabilityMeta(value) {
  return value === "preorder"
    ? { label: "Под заказ", action: "Перевести в наличие", badgeClass: "out" }
    : { label: "В наличии", action: "Перевести под заказ", badgeClass: "sale" };
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  let data = {};
  try {
    data = await res.json();
  } catch {}
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || "Ошибка запроса");
  }
  return data;
}

async function checkAccess() {
  try {
    await apiFetch(`/api/admin/auth?uid=${encodeURIComponent(adminUid)}&sig=${encodeURIComponent(adminSig)}`);
    adminView.classList.remove("hidden");
    deniedView.classList.add("hidden");
    return true;
  } catch {
    adminView.classList.add("hidden");
    deniedView.classList.remove("hidden");
    return false;
  }
}

async function loadStore() {
  try {
    store = await apiFetch("/api/admin/store", { headers: authHeaders() });
    fillBanner();
    renderStats();
    renderAdmins();
    renderProducts();
    renderOrders();
  } catch (e) {
    alert(e.message || "Нет доступа к админке");
  }
}

function fillBanner() {
  document.getElementById("bannerEnabled").value = String(store.banner.enabled);
  document.getElementById("bannerText").value = store.banner.text || "";
  document.getElementById("bannerSubtext").value = store.banner.subtext || "";
  document.getElementById("bannerCtaText").value = store.banner.ctaText || "";
  adminManageBox.classList.toggle("hidden", !store.isSuperAdmin);
}

function renderStats() {
  const products = store.products || [];
  const orders = store.orders || [];
  const revenue = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  const inStock = products.filter(product => (product.availability || "in_stock") === "in_stock").length;
  const preorder = products.filter(product => (product.availability || "in_stock") === "preorder").length;

  statsGrid.innerHTML = [
    ["Товаров", products.length],
    ["В наличии", inStock],
    ["Под заказ", preorder],
    ["Заказов", orders.length],
    ["Выручка", formatRub(revenue)]
  ].map(([label, value]) => `
    <div class="stat-card">
      <div class="tiny">${label}</div>
      <strong>${value}</strong>
    </div>
  `).join("");
}

function renderAdmins() {
  if (!adminsAdmin) return;
  const admins = store.admins || [];
  if (!admins.length) {
    adminsAdmin.innerHTML = `<div class="admin-item">Админов пока нет</div>`;
    return;
  }

  adminsAdmin.innerHTML = "";
  admins.forEach(id => {
    const card = document.createElement("div");
    card.className = "admin-item";
    const isCurrent = String(id) === String(adminUid);
    const isSuper = String(id) === String(store.superAdminId || "");
    card.innerHTML = `
      <div class="admin-item__top">
        <div>
          <strong>ID: ${escapeHtml(id)}</strong>
          <div class="tiny">${isSuper ? "Главный админ" : (isCurrent ? "Это ты" : "Администратор магазина")}</div>
        </div>
        <div class="admin-actions">
          <button class="admin-mini-btn copy-id">Скопировать ID</button>
          ${store.isSuperAdmin && !isSuper ? '<button class="admin-mini-btn danger remove-admin">Удалить</button>' : ""}
        </div>
      </div>
    `;

    card.querySelector(".copy-id").onclick = async () => {
      try {
        await navigator.clipboard.writeText(String(id));
        alert("ID скопирован");
      } catch {
        alert("Не удалось скопировать");
      }
    };

    const removeBtn = card.querySelector(".remove-admin");
    if (removeBtn) removeBtn.onclick = () => removeAdmin(id);
    adminsAdmin.appendChild(card);
  });
}

function filteredProducts() {
  const query = String(quickSearch?.value || "").trim().toLowerCase();
  const filter = quickAvailabilityFilter?.value || "all";
  return (store.products || []).filter(product => {
    const availability = product.availability || (product.inStock === false ? "preorder" : "in_stock");
    const text = [product.title, product.category, product.description, product.badge].join(" ").toLowerCase();
    const queryOk = !query || text.includes(query);
    const filterOk = filter === "all"
      ? true
      : filter === "featured"
        ? !!product.featured
        : availability === filter;
    return queryOk && filterOk;
  });
}

function renderProducts() {
  const products = filteredProducts();
  if (!products.length) {
    productsAdmin.innerHTML = `<div class="admin-item">Нет товаров по текущему фильтру</div>`;
    return;
  }

  productsAdmin.innerHTML = "";
  products.forEach(product => {
    const card = document.createElement("div");
    card.className = "admin-item";
    const availability = availabilityMeta(product.availability || (product.inStock === false ? "preorder" : "in_stock"));
    card.innerHTML = `
      <div class="admin-item__top">
        <div>
          <strong>${escapeHtml(product.title)}</strong>
          <div class="tiny">${escapeHtml(product.category || "")}</div>
          <div class="tiny">${formatRub(product.price)} ${product.oldPrice ? ` / <span style="text-decoration:line-through">${formatRub(product.oldPrice)}</span>` : ""}</div>
          <div class="tiny">Скидка: ${product.discount || 0}%</div>
          <div class="tiny">Размеры: ${(product.sizes || []).map(escapeHtml).join(", ") || "—"}</div>
          <div class="tiny">Статус: <span class="status-pill ${availability.badgeClass}">${availability.label}</span> ${product.featured ? '<span class="status-pill dark">Хит</span>' : ""}</div>
        </div>
        <div class="admin-actions">
          <button class="admin-mini-btn toggle-availability">${availability.action}</button>
          <button class="admin-mini-btn toggle-featured">${product.featured ? "Убрать хит" : "Сделать хитом"}</button>
          <button class="admin-mini-btn danger delete-product">Удалить</button>
        </div>
      </div>
      <div class="tiny">${escapeHtml(product.description || "")}</div>
    `;

    card.querySelector(".toggle-availability").onclick = () => updateProduct(product.id, {
      availability: (product.availability || (product.inStock === false ? "preorder" : "in_stock")) === "preorder" ? "in_stock" : "preorder"
    });
    card.querySelector(".toggle-featured").onclick = () => updateProduct(product.id, { featured: !product.featured });
    card.querySelector(".delete-product").onclick = () => deleteProduct(product.id);
    productsAdmin.appendChild(card);
  });
}

function renderOrders() {
  if (!store.orders.length) {
    ordersAdmin.innerHTML = `<div class="admin-item">Заказов пока нет</div>`;
    return;
  }

  ordersAdmin.innerHTML = "";
  store.orders.forEach(order => {
    const card = document.createElement("div");
    card.className = "admin-item";
    const items = (order.items || []).map(item => `${escapeHtml(item.title)} / ${escapeHtml(item.size)} / x${item.qty} — ${formatRub(item.lineTotal)}`).join("<br>");
    card.innerHTML = `
      <strong>Заказ ${escapeHtml(order.id || "")}</strong>
      <div class="tiny">${escapeHtml(order.createdAt || "")}</div>
      <div style="margin-top:10px">${items}</div>
      <div style="margin-top:10px"><strong>Итого: ${formatRub(order.total || 0)}</strong></div>
    `;
    ordersAdmin.appendChild(card);
  });
}

async function updateProduct(id, payload) {
  try {
    await apiFetch(`/api/admin/products/${id}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    await loadStore();
  } catch (e) {
    alert(e.message || "Не удалось обновить товар");
  }
}

async function deleteProduct(id) {
  if (!confirm("Удалить товар?")) return;
  try {
    await apiFetch(`/api/admin/products/${id}`, {
      method: "DELETE",
      headers: {
        "x-admin-uid": adminUid,
        "x-admin-sig": adminSig
      }
    });
    await loadStore();
  } catch (e) {
    alert(e.message || "Не удалось удалить товар");
  }
}

async function saveBanner() {
  const payload = {
    enabled: document.getElementById("bannerEnabled").value === "true",
    text: document.getElementById("bannerText").value.trim(),
    subtext: document.getElementById("bannerSubtext").value.trim(),
    ctaText: document.getElementById("bannerCtaText").value.trim()
  };

  try {
    await apiFetch("/api/admin/banner", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    alert("Баннер сохранен");
    await loadStore();
  } catch (e) {
    alert(e.message || "Не удалось сохранить баннер");
  }
}

async function addProduct() {
  const payload = {
    title: document.getElementById("title").value.trim(),
    price: parseNumber(document.getElementById("price").value),
    oldPrice: parseNumber(document.getElementById("oldPrice").value),
    discount: parseNumber(document.getElementById("discount").value),
    category: document.getElementById("category").value.trim(),
    image: document.getElementById("image").value.trim() || "/assets/brand-avatar.png",
    sizes: document.getElementById("sizes").value.split(",").map(v => v.trim()).filter(Boolean),
    badge: document.getElementById("badge").value.trim(),
    description: document.getElementById("description").value.trim(),
    availability: document.getElementById("availability").value,
    featured: document.getElementById("featured").value === "true"
  };

  if (!payload.title || !payload.price) {
    alert("Заполни название и цену");
    return;
  }

  try {
    await apiFetch("/api/admin/products", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });

    document.querySelectorAll(".admin-form input, .admin-form textarea").forEach(el => {
      if (!["bannerText", "bannerSubtext", "bannerCtaText", "newAdminId", "quickSearch"].includes(el.id)) el.value = "";
    });
    document.getElementById("availability").value = "in_stock";
    document.getElementById("featured").value = "false";

    alert("Товар добавлен");
    await loadStore();
  } catch (e) {
    alert(e.message || "Не удалось добавить товар");
  }
}

async function addAdmin() {
  const userId = String(newAdminIdInput.value || "").replace(/\s+/g, "").trim();
  if (!userId) {
    alert("Введи Telegram ID");
    return;
  }

  try {
    await apiFetch("/api/admin/admins", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ userId })
    });
    newAdminIdInput.value = "";
    alert("Админ добавлен");
    await loadStore();
  } catch (e) {
    alert(e.message || "Не удалось добавить админа");
  }
}

async function removeAdmin(id) {
  if (!confirm(`Удалить админа ${id}?`)) return;
  try {
    await apiFetch(`/api/admin/admins/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        "x-admin-uid": adminUid,
        "x-admin-sig": adminSig
      }
    });
    alert("Админ удалён");
    await loadStore();
  } catch (e) {
    alert(e.message || "Не удалось удалить админа");
  }
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

document.getElementById("reloadBtn").onclick = loadStore;
document.getElementById("saveBannerBtn").onclick = saveBanner;
document.getElementById("addProductBtn").onclick = addProduct;
if (addAdminBtn) addAdminBtn.onclick = addAdmin;
if (newAdminIdInput) {
  newAdminIdInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addAdmin();
  });
}
if (quickSearch) quickSearch.oninput = renderProducts;
if (quickAvailabilityFilter) quickAvailabilityFilter.onchange = renderProducts;

(async () => {
  const ok = await checkAccess();
  if (ok) await loadStore();
})();
