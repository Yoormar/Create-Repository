const STORAGE_KEY = 'botica-giudamy-catalog';
const WHATSAPP_NUMBER = '51999999999';

const CATEGORY_ICONS = {
  Medicamentos: '💊',
  Vitaminas: '🍊',
  'Cuidado personal': '🧴',
  Dermatología: '🧴',
  Bebés: '👶',
  Primeros auxilios: '🩹',
  default: '🏥',
};

const DEFAULT_PRODUCTS = [
  { id: '1', nombre: 'Paracetamol 500mg', descripcion: 'Analgésico y antipirético. Caja x 20 tabletas.', precio: 5.5, categoria: 'Medicamentos', stock: 120, imagen: '' },
  { id: '2', nombre: 'Ibuprofeno 400mg', descripcion: 'Antiinflamatorio. Caja x 30 tabletas.', precio: 8.9, categoria: 'Medicamentos', stock: 85, imagen: '' },
  { id: '3', nombre: 'Omeprazol 20mg', descripcion: 'Protector gástrico. Caja x 14 cápsulas.', precio: 12.0, categoria: 'Medicamentos', stock: 60, imagen: '' },
  { id: '4', nombre: 'Amoxicilina 500mg', descripcion: 'Antibiótico. Caja x 21 cápsulas. Venta con receta.', precio: 18.5, categoria: 'Medicamentos', stock: 40, imagen: '' },
  { id: '5', nombre: 'Vitamina C 1000mg', descripcion: 'Suplemento vitamínico. Frasco x 60 tabletas.', precio: 22.0, categoria: 'Vitaminas', stock: 55, imagen: '' },
  { id: '6', nombre: 'Complejo B', descripcion: 'Energía y sistema nervioso. Frasco x 30 cápsulas.', precio: 15.5, categoria: 'Vitaminas', stock: 70, imagen: '' },
  { id: '7', nombre: 'Alcohol medicinal 70°', descripcion: 'Desinfectante. Frasco 500 ml.', precio: 6.0, categoria: 'Primeros auxilios', stock: 90, imagen: '' },
  { id: '8', nombre: 'Agua oxigenada', descripcion: 'Antiséptico. Frasco 120 ml.', precio: 4.5, categoria: 'Primeros auxilios', stock: 100, imagen: '' },
  { id: '9', nombre: 'Curitas adhesivas', descripcion: 'Caja x 20 unidades. Varios tamaños.', precio: 7.0, categoria: 'Primeros auxilios', stock: 45, imagen: '' },
  { id: '10', nombre: 'Protector solar FPS 50', descripcion: 'Protección UVA/UVB. Tubo 120 g.', precio: 35.0, categoria: 'Dermatología', stock: 30, imagen: '' },
  { id: '11', nombre: 'Crema hidratante corporal', descripcion: 'Piel seca y sensible. Tarro 400 ml.', precio: 28.0, categoria: 'Cuidado personal', stock: 25, imagen: '' },
  { id: '12', nombre: 'Pañales talla M', descripcion: 'Paquete x 30 unidades. Alta absorción.', precio: 42.0, categoria: 'Bebés', stock: 35, imagen: '' },
];

let products = [];
let filteredProducts = [];
let cart = {};

const $ = (sel) => document.querySelector(sel);

const elements = {
  grid: $('#products-grid'),
  count: $('#product-count'),
  empty: $('#empty-state'),
  search: $('#search'),
  categoryFilter: $('#category-filter'),
  sortFilter: $('#sort-filter'),
  uploadZone: $('#upload-zone'),
  fileInput: $('#file-input'),
  uploadStatus: $('#upload-status'),
  cartBar: $('#cart-bar'),
  cartCount: $('#cart-count'),
  cartTotal: $('#cart-total'),
  nav: $('#nav'),
  navToggle: $('#nav-toggle'),
};

function loadProducts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    products = saved ? JSON.parse(saved) : [...DEFAULT_PRODUCTS];
  } catch {
    products = [...DEFAULT_PRODUCTS];
  }
}

function saveProducts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

function formatPrice(value) {
  return `S/ ${Number(value).toFixed(2)}`;
}

function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || CATEGORY_ICONS.default;
}

function normalizeProduct(raw, index) {
  const nombre = (raw.nombre || raw.name || '').trim();
  if (!nombre) return null;

  return {
    id: raw.id || `import-${Date.now()}-${index}`,
    nombre,
    descripcion: (raw.descripcion || raw.description || raw.desc || '').trim(),
    precio: parseFloat(String(raw.precio ?? raw.price ?? 0).replace(',', '.')) || 0,
    categoria: (raw.categoria || raw.category || 'General').trim(),
    stock: parseInt(raw.stock ?? raw.cantidad ?? 0, 10) || 0,
    imagen: (raw.imagen || raw.image || raw.url || '').trim(),
  };
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('El CSV debe tener encabezados y al menos una fila de datos.');

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || line.split(',');
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = (values[idx] || '').replace(/^"|"$/g, '').trim();
    });
    rows.push(obj);
  }

  return rows.map(normalizeProduct).filter(Boolean);
}

function parseJSON(text) {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : data.productos || data.products || [];
  if (!arr.length) throw new Error('El JSON no contiene productos.');
  return arr.map(normalizeProduct).filter(Boolean);
}

function updateCategoryFilter() {
  const categories = [...new Set(products.map((p) => p.categoria))].sort();
  const current = elements.categoryFilter.value;
  elements.categoryFilter.innerHTML = '<option value="">Todas las categorías</option>';
  categories.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    elements.categoryFilter.appendChild(opt);
  });
  elements.categoryFilter.value = current;
}

function filterProducts() {
  const query = elements.search.value.trim().toLowerCase();
  const category = elements.categoryFilter.value;
  const sort = elements.sortFilter.value;

  filteredProducts = products.filter((p) => {
    const matchSearch =
      !query ||
      p.nombre.toLowerCase().includes(query) ||
      p.descripcion.toLowerCase().includes(query) ||
      p.categoria.toLowerCase().includes(query);
    const matchCategory = !category || p.categoria === category;
    return matchSearch && matchCategory;
  });

  filteredProducts.sort((a, b) => {
    switch (sort) {
      case 'name-desc':
        return b.nombre.localeCompare(a.nombre);
      case 'price-asc':
        return a.precio - b.precio;
      case 'price-desc':
        return b.precio - a.precio;
      default:
        return a.nombre.localeCompare(b.nombre);
    }
  });

  renderProducts();
}

function renderProducts() {
  elements.count.textContent = filteredProducts.length;
  elements.grid.innerHTML = '';

  if (filteredProducts.length === 0) {
    elements.empty.classList.remove('hidden');
    return;
  }

  elements.empty.classList.add('hidden');

  filteredProducts.forEach((product, i) => {
    const inCart = cart[product.id] || 0;
    const stockClass = product.stock <= 10 ? 'product-card__stock--low' : '';
    const stockText = product.stock <= 0 ? 'Agotado' : product.stock <= 10 ? `¡Solo ${product.stock}!` : `${product.stock} disponibles`;

    const el = document.createElement('article');
    el.className = 'product-card';
    el.style.animationDelay = `${i * 0.03}s`;
    el.innerHTML = `
      <div class="product-card__image">
        ${product.imagen ? `<img src="${product.imagen}" alt="${product.nombre}" loading="lazy" onerror="this.parentElement.innerHTML='<span class=\\'product-card__placeholder\\'>${getCategoryIcon(product.categoria)}</span>'">` : `<span class="product-card__placeholder">${getCategoryIcon(product.categoria)}</span>`}
      </div>
      <div class="product-card__body">
        <span class="product-card__category">${product.categoria}</span>
        <h3 class="product-card__name">${product.nombre}</h3>
        <p class="product-card__desc">${product.descripcion || 'Sin descripción'}</p>
        <div class="product-card__footer">
          <span class="product-card__price">${formatPrice(product.precio)}</span>
          <span class="product-card__stock ${stockClass}">${stockText}</span>
        </div>
        <button class="btn btn--primary btn--block btn--sm add-to-cart" data-id="${product.id}" ${product.stock <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
          ${inCart ? `✓ En pedido (${inCart})` : 'Agregar al pedido'}
        </button>
      </div>
    `;
    elements.grid.appendChild(el);
  });

  document.querySelectorAll('.add-to-cart').forEach((btn) => {
    btn.addEventListener('click', () => addToCart(btn.dataset.id));
  });
}

function addToCart(productId) {
  const product = products.find((p) => p.id === productId);
  if (!product || product.stock <= 0) return;

  cart[productId] = (cart[productId] || 0) + 1;
  updateCartBar();
  filterProducts();
}

function updateCartBar() {
  const ids = Object.keys(cart);
  const totalItems = ids.reduce((sum, id) => sum + cart[id], 0);
  const totalPrice = ids.reduce((sum, id) => {
    const p = products.find((x) => x.id === id);
    return sum + (p ? p.precio * cart[id] : 0);
  }, 0);

  if (totalItems === 0) {
    elements.cartBar.classList.add('hidden');
    return;
  }

  elements.cartBar.classList.remove('hidden');
  elements.cartCount.textContent = totalItems;
  elements.cartTotal.textContent = formatPrice(totalPrice);
}

function buildWhatsAppMessage(items) {
  let msg = '¡Hola Botica Giudamy! Quisiera hacer el siguiente pedido:\n\n';
  let total = 0;

  items.forEach(({ product, qty }) => {
    const subtotal = product.precio * qty;
    total += subtotal;
    msg += `• ${product.nombre} x${qty} — ${formatPrice(subtotal)}\n`;
  });

  msg += `\n*Total: ${formatPrice(total)}*\n\nGracias.`;
  return encodeURIComponent(msg);
}

function sendCartWhatsApp() {
  const items = Object.entries(cart)
    .map(([id, qty]) => ({ product: products.find((p) => p.id === id), qty }))
    .filter((x) => x.product);

  if (!items.length) return;
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${buildWhatsAppMessage(items)}`, '_blank');
}

function showUploadStatus(message, type) {
  elements.uploadStatus.textContent = message;
  elements.uploadStatus.className = `upload-status ${type}`;
  elements.uploadStatus.classList.remove('hidden');
  setTimeout(() => elements.uploadStatus.classList.add('hidden'), 5000);
}

function handleFileUpload(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target.result;
      const parsed = file.name.endsWith('.json') ? parseJSON(text) : parseCSV(text);

      if (!parsed.length) throw new Error('No se encontraron productos válidos.');

      products = parsed;
      saveProducts();
      updateCategoryFilter();
      filterProducts();
      showUploadStatus(`✓ ${parsed.length} productos cargados correctamente.`, 'success');
    } catch (err) {
      showUploadStatus(`✗ Error: ${err.message}`, 'error');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

function downloadCSV(content, filename) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportCatalog() {
  const header = 'nombre,descripcion,precio,categoria,stock,imagen';
  const rows = products.map((p) =>
    [p.nombre, p.descripcion, p.precio, p.categoria, p.stock, p.imagen]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );
  downloadCSV([header, ...rows].join('\n'), 'catalogo-botica-giudamy.csv');
}

function downloadTemplate() {
  const template = `nombre,descripcion,precio,categoria,stock,imagen
"Paracetamol 500mg","Caja x 20 tabletas",5.50,"Medicamentos",100,""
"Vitamina C","Frasco x 60 tabletas",22.00,"Vitaminas",50,""
"Alcohol medicinal","Frasco 500 ml",6.00,"Primeros auxilios",80,""`;
  downloadCSV(template, 'plantilla-catalogo.csv');
}

function resetCatalog() {
  if (!confirm('¿Restaurar el catálogo de demostración? Se perderán los productos actuales.')) return;
  products = [...DEFAULT_PRODUCTS];
  saveProducts();
  cart = {};
  updateCategoryFilter();
  updateCartBar();
  filterProducts();
  showUploadStatus('Catálogo de demostración restaurado.', 'success');
}

function initUploadZone() {
  elements.uploadZone.addEventListener('click', () => elements.fileInput.click());

  elements.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
  });

  ['dragenter', 'dragover'].forEach((evt) => {
    elements.uploadZone.addEventListener(evt, (e) => {
      e.preventDefault();
      elements.uploadZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((evt) => {
    elements.uploadZone.addEventListener(evt, (e) => {
      e.preventDefault();
      elements.uploadZone.classList.remove('dragover');
    });
  });

  elements.uploadZone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  });
}

function initContactForm() {
  $('#contact-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const msg = encodeURIComponent(
      `Hola Botica Giudamy, soy ${fd.get('nombre')}.\nTel: ${fd.get('telefono') || 'No indicado'}\n\n${fd.get('mensaje')}`
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, '_blank');
  });
}

function initNav() {
  elements.navToggle.addEventListener('click', () => {
    elements.nav.classList.toggle('open');
  });

  elements.nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => elements.nav.classList.remove('open'));
  });
}

function init() {
  loadProducts();
  updateCategoryFilter();
  filteredProducts = products;
  filterProducts();
  initUploadZone();
  initContactForm();
  initNav();

  elements.search.addEventListener('input', filterProducts);
  elements.categoryFilter.addEventListener('change', filterProducts);
  elements.sortFilter.addEventListener('change', filterProducts);

  $('#download-template').addEventListener('click', downloadTemplate);
  $('#export-catalog').addEventListener('click', exportCatalog);
  $('#reset-catalog').addEventListener('click', resetCatalog);
  $('#whatsapp-order').addEventListener('click', sendCartWhatsApp);
  $('#clear-cart').addEventListener('click', () => {
    cart = {};
    updateCartBar();
    filterProducts();
  });
}

init();
