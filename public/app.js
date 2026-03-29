const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

const state = {
  products: [],
  banner: null,
  cart: [],
  selectedSizes: {}
};

const productsEl = document.getElementById("products");
const cartItemsEl = document.getElementById("cartItems");
const cartCountEl = document.getElementById("cartCount");
const cartTotalEl = document.getElementById("cartTotal");
const bannerEl = document.getElementById("banner");
const searchInput = document.getElementById("searchInput");
const stockFilter = document.getElementById("stockFilter");
const template = document.getElementById("productTemplate");

document.getElementById("scrollDrop").onclick = () => window.scrollTo({ top: window.innerHeight * 0.82, behavior: "smooth" });
document.getElementById("scrollCart").onclick = () => document.getElementById("cartSection").scrollIntoView({ behavior: "smooth" });

function formatRub(value) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function getAvailability(product) {
  return product.availability || (product.inStock === false ? "preorder" : "in_stock");
}

function getAvailabilityLabel(product) {
  return getAvailability(product) === "preorder" ? "Под заказ" : "В наличии";
}

function canBuy(product) {
  return ["in_stock", "preorder"].includes(getAvailability(product));
}

async function init() {
  const res = await fetch("/api/store");
  const data = await res.json();
  state.products = data.products || [];
  state.banner = data.banner || null;
  renderBanner();
  renderProducts();
  renderCart();
}

function renderBanner() {
  if (!state.banner || !state.banner.enabled) {
    bannerEl.classList.add("hidden");
    return;
  }
  bannerEl.classList.remove("hidden");
  bannerEl.innerHTML = `
    <div class="banner-copy">
      <strong>${escapeHtml(state.banner.text || "")}</strong>
      <span>${escapeHtml(state.banner.subtext || "")}</span>
    </div>
    <button class="banner-cta">${escapeHtml(state.banner.ctaText || "Смотреть")}</button>
  `;
  bannerEl.querySelector(".banner-cta").onclick = () => window.scrollTo({ top: window.innerHeight * 0.82, behavior: "smooth" });
}

function filteredProducts() {
  const q = searchInput.value.trim().toLowerCase();
  const mode = stockFilter.value;
  return state.products.filter(product => {
    const textMatch = !q || [product.title, product.category, product.description].join(" ").toLowerCase().includes(q);
    const availability = getAvailability(product);
    const filterMatch =
      mode === "all" ? true :
      mode === "instock" ? availability === "in_stock" :
      mode === "preorder" ? availability === "preorder" :
      product.featured;
    return textMatch && filterMatch;
  });
}

function renderProducts() {
  const items = filteredProducts();
  productsEl.innerHTML = "";
  items.forEach((product, index) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.style.animationDelay = `${index * 0.05}s`;
    node.querySelector(".product-image").src = product.image;
    node.querySelector(".product-image").alt = product.title;
    node.querySelector(".product-category").textContent = product.category || "Коллекция";
    node.querySelector(".product-stock").textContent = getAvailabilityLabel(product);
    node.querySelector(".product-title").textContent = product.title;
    node.querySelector(".product-description").textContent = product.description || "";
    node.querySelector(".price-now").textContent = formatRub(product.price);
    node.querySelector(".price-old").textContent = product.oldPrice ? formatRub(product.oldPrice) : "";

    const badges = node.querySelector(".badges");
    if (product.featured) badges.append(makeBadge("Хит", "dark"));
    if (product.discount > 0) badges.append(makeBadge(`-${product.discount}%`, "sale"));
    if (getAvailability(product) === "preorder") badges.append(makeBadge("Под заказ", "out"));
    if (product.badge && !["Хит", "Sold out"].includes(product.badge)) badges.append(makeBadge(product.badge, "dark"));

    const sizesWrap = node.querySelector(".sizes");
    (product.sizes || []).forEach(size => {
      const btn = document.createElement("button");
      btn.className = "size-pill" + (state.selectedSizes[product.id] === size ? " active" : "");
      btn.textContent = size;
      btn.onclick = () => {
        state.selectedSizes[product.id] = size;
        renderProducts();
      };
      sizesWrap.appendChild(btn);
    });

    const addBtn = node.querySelector(".add-btn");
    addBtn.disabled = !canBuy(product);
    addBtn.textContent = getAvailability(product) === "preorder" ? "Заказать" : "Добавить";
    addBtn.onclick = () => addToCart(product);

    productsEl.appendChild(node);
  });

  if (!items.length) {
    productsEl.innerHTML = `<div class="admin-card"><strong>Ничего не найдено</strong><p class="tiny">Измени фильтр или поиск.</p></div>`;
  }
}

function makeBadge(text, type) {
  const div = document.createElement("div");
  div.className = `badge ${type}`;
  div.textContent = text;
  return div;
}

function addToCart(product) {
  const size = state.selectedSizes[product.id] || product.sizes?.[0];
  if (!size) {
    alert("Выбери размер");
    return;
  }
  const existing = state.cart.find(item => item.id === product.id && item.size === size);
  if (existing) {
    existing.qty += 1;
    existing.lineTotal = existing.qty * existing.price;
  } else {
    state.cart.push({
      id: product.id,
      title: product.title,
      price: Number(product.price),
      qty: 1,
      size,
      availability: getAvailability(product),
      lineTotal: Number(product.price)
    });
  }
  renderCart();
}

function removeFromCart(index) {
  state.cart.splice(index, 1);
  renderCart();
}

function renderCart() {
  cartItemsEl.innerHTML = "";
  if (!state.cart.length) {
    cartItemsEl.innerHTML = `<div class="cart-item"><strong>Корзина пока пустая</strong><small>Добавь товар и выбери размер.</small></div>`;
  }

  let totalQty = 0;
  let total = 0;

  state.cart.forEach((item, index) => {
    totalQty += item.qty;
    total += item.lineTotal;

    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <div class="cart-line"><strong>${escapeHtml(item.title)}</strong><strong>${formatRub(item.lineTotal)}</strong></div>
      <small>Размер: ${escapeHtml(item.size)} • Кол-во: ${item.qty} • ${item.availability === "preorder" ? "Под заказ" : "В наличии"}</small>
      <button class="remove-btn">Убрать</button>
    `;
    div.querySelector(".remove-btn").onclick = () => removeFromCart(index);
    cartItemsEl.appendChild(div);
  });

  cartCountEl.textContent = String(totalQty);
  cartTotalEl.textContent = formatRub(total);
}

document.getElementById("checkoutBtn").onclick = async () => {
  if (!state.cart.length) {
    alert("Корзина пустая");
    return;
  }

  const payload = {
    type: "order",
    items: state.cart,
    total: state.cart.reduce((sum, item) => sum + item.lineTotal, 0),
    createdAt: new Date().toISOString(),
    user: tg?.initDataUnsafe?.user || null
  };

  const res = await fetch("/api/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (tg) {
    tg.sendData(JSON.stringify(payload));
    tg.showAlert(`Заказ отправлен ✅ № ${data.orderId || ""}`);
  } else {
    alert(`Заказ отправлен ✅ № ${data.orderId || ""}`);
  }

  state.cart = [];
  renderCart();
};

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

searchInput.oninput = renderProducts;
stockFilter.onchange = renderProducts;

init();
