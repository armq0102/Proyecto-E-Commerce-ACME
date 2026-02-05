// script.js - Lógica principal del frontend (Carrito y Productos)

// --- CONFIGURACIÓN DE ENTORNO ---
const API_URL = 'http://localhost:3000/api';

// Base de datos de productos (Coincide con los IDs de tus HTMLs)
let PRODUCTS = []; // Ahora vacío, se llena desde el backend

// --- SISTEMA DE FEEDBACK (TOASTS) ---
function showToast(message, type = 'info') {
    // Crear contenedor si no existe (para compatibilidad con todas las páginas)
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Auto-eliminar después de 3.5 segundos
    setTimeout(() => {
        toast.remove();
        if (container.childNodes.length === 0) container.remove();
    }, 3500);
}

// --- FUNCIÓN DE FORMATO DE MONEDA ---
function formatCOP(value) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

// --- SINCRONIZACIÓN CON BACKEND ---
async function syncProducts() {
    try {
        const response = await fetch(`${API_URL}/products`);
        if (response.ok) {
            PRODUCTS = await response.json(); // Reemplazo total con datos reales de Mongo
            console.log('✅ Productos cargados desde Backend:', PRODUCTS.length);
        }
    } catch (error) {
        console.error('Error sincronizando productos:', error);
    }
}

function renderFeaturedProducts() {
    const featuredContainer = document.getElementById('featuredProducts');
    if (featuredContainer) {
        // Filtramos los ocultos antes de mostrar
        const featured = PRODUCTS.filter(p => p.status !== 'hidden').slice(0, 3);
        featuredContainer.innerHTML = featured.map(p => {
            const isOutOfStock = (p.stock !== undefined && p.stock <= 0) || p.status === 'out_of_stock';
            const isLowStock = !isOutOfStock && p.stock !== undefined && p.stock > 0 && p.stock < 10;
            
            // Tag de categoría
            const categoryTag = p.category || 'Otros';
            const categoryColor = {
                'Mujeres': '#FF69B4',
                'Hombres': '#4169E1',
                'Accesorios': '#FFB347',
                'Sostenibilidad': '#32CD32'
            }[categoryTag] || '#999';

            return `
            <article class="product-card ${isOutOfStock ? 'out-of-stock' : ''}">
                <div style="position: relative;">
                    ${isOutOfStock ? '<span class="badge-out-of-stock">Agotado</span>' : ''}
                    <span class="category-tag" style="position: absolute; top: 10px; right: 10px; background: ${categoryColor}; color: white; padding: 6px 12px; border-radius: 20px; font-size: 0.75em; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; z-index: 10; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">${categoryTag}</span>
                    <img src="${p.img}" alt="${p.title}">
                </div>
                <h3>${p.title}</h3>
                <p class="price">${formatCOP(p.price)}</p>
                ${isLowStock ? `<p style="color:var(--acme-red, #cc0000);font-weight:bold;font-size:0.85rem;margin-bottom:5px;">¡Solo quedan ${p.stock}!</p>` : ''}
                <button class="btn btn-dark add-to-cart"
                        data-id="${p.id}"
                        ${isOutOfStock ? 'disabled' : ''}>
                    ${isOutOfStock ? 'Agotado' : 'Agregar al carrito'}
                </button>
            </article>
        `}).join('');
    }
}

// Actualizar UI de productos en páginas de categorías (estáticas)
function updateCategoryPagesUI() {
    const buttons = document.querySelectorAll('button[data-id]');
    buttons.forEach(btn => {
        let id = btn.getAttribute('data-id');
        let product = PRODUCTS.find(p => p.id === id);
        
        // --- FIX: Compatibilidad con IDs antiguos vs Mongo IDs ---
        // Si no encuentra el producto por ID (ej: 'p1'), intenta buscarlo por el Título en el HTML
        if (!product) {
            const card = btn.closest('.product-card');
            if (card) {
                const title = card.querySelector('h3')?.textContent.trim();
                if (title) {
                    // FIX: Búsqueda insensible a mayúsculas para mayor robustez
                    product = PRODUCTS.find(p => p.title.toLowerCase() === title.toLowerCase());
                    if (product) {
                        // ¡Encontrado! Actualizamos el botón con el ID real de Mongo
                        const realId = product.id || product._id;
                        console.log(`🔗 Vinculado: ${title} -> ${realId}`);
                        btn.setAttribute('data-id', realId);
                    }
                }
            }
        }
        // ---------------------------------------------------------
        
        if (product && product.stock !== undefined) {
            const card = btn.closest('.product-card');

            // --- MEJORA: Agregar tag de categoría si no existe ---
            if (!card.querySelector('.category-tag')) {
                const categoryTag = product.category || 'Otros';
                const categoryColor = {
                    'Mujeres': '#FF69B4',
                    'Hombres': '#4169E1',
                    'Accesorios': '#FFB347',
                    'Sostenibilidad': '#32CD32'
                }[categoryTag] || '#999';
                
                const img = card.querySelector('img');
                if (img) {
                    const tagEl = document.createElement('span');
                    tagEl.className = 'category-tag';
                    tagEl.style.cssText = `position: absolute; top: 10px; right: 10px; background: ${categoryColor}; color: white; padding: 6px 12px; border-radius: 20px; font-size: 0.75em; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; z-index: 10; box-shadow: 0 2px 8px rgba(0,0,0,0.2);`;
                    tagEl.textContent = categoryTag;
                    img.parentNode.insertBefore(tagEl, img);
                }
            }
            // ---------------------------------------------------
            
            // --- MEJORA: Actualizar el precio dinámicamente ---
            const priceEl = card.querySelector('p.price');
            if (priceEl) {
                priceEl.textContent = formatCOP(product.price);
            }
            // ---------------------------------------------------
            
            // 1. Ocultar si está "hidden" (Soft Delete)
            if (product.status === 'hidden') {
                card.style.display = 'none';
                return;
            }

            // 2. Agotado
            const isOutOfStock = (product.stock !== undefined && product.stock <= 0) || product.status === 'out_of_stock';
            
            if (isOutOfStock) {
                card.classList.add('out-of-stock');
                btn.disabled = true;
                btn.textContent = 'Agotado';
                btn.style.opacity = '0.6';
                btn.style.cursor = 'not-allowed';
                
                // Agregar badge si no existe
                if (!card.querySelector('.badge-out-of-stock')) {
                    const badge = document.createElement('span');
                    badge.className = 'badge-out-of-stock';
                    badge.textContent = 'Agotado';
                    card.insertBefore(badge, card.firstChild);
                }
            } 
            // 3. Stock Bajo (< 10)
            else if (product.stock < 10 && card) {
                if (!card.querySelector('.stock-warning')) {
                    const warning = document.createElement('p');
                    warning.className = 'stock-warning';
                    warning.style.color = 'var(--acme-red, #cc0000)';
                    warning.style.fontWeight = 'bold';
                    warning.style.fontSize = '0.85rem';
                    warning.style.margin = '5px 0';
                    warning.textContent = `¡Solo quedan ${product.stock}!`;
                    btn.parentNode.insertBefore(warning, btn);
                }
            }
        }
    });
}

// --- GESTIÓN DEL CARRITO ---

// Obtener carrito desde LocalStorage
function getCart() {
    const cart = localStorage.getItem('acme_cart');
    return cart ? JSON.parse(cart) : [];
}

// Guardar carrito
function saveCart(cart) {
    localStorage.setItem('acme_cart', JSON.stringify(cart));
    updateCartUI();
}

// Agregar al carrito (Global para que funcione con onclick en HTML)
window.addToCart = function(id) {
    const product = PRODUCTS.find(p => p.id === id || p._id === id);
    
    if (!product) {
        console.error(`Error: Producto con ID '${id}' no encontrado. Intenta recargar la página.`);
        showToast('Error: Producto no encontrado.', 'error');
        return;
    }

    // Validar estado (Hidden)
    if (product.status === 'hidden') {
        showToast('Este producto no está disponible.', 'error');
        return;
    }

    // Validar stock (si ya se sincronizó)
    const isOutOfStock = (product.stock !== undefined && product.stock <= 0) || product.status === 'out_of_stock';
    if (isOutOfStock) {
        showToast('Producto agotado.', 'warning');
        return;
    }

    const cart = getCart();
    const existing = cart.find(item => item.id === id);
    const currentQty = existing ? existing.qty : 0;
    
    if (product.stock !== undefined && currentQty + 1 > product.stock) {
        showToast(`Solo quedan ${product.stock} unidades disponibles.`, 'warning');
        return;
    }

    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({ ...product, qty: 1 });
    }

    saveCart(cart);
    
    // Abrir el carrito automáticamente para dar feedback
    openCartDrawer();
    showToast('Producto agregado al carrito', 'success');
};

// Eliminar del carrito
window.removeFromCart = function(id) {
    let cart = getCart();
    cart = cart.filter(item => item.id !== id);
    saveCart(cart);
};

// Vaciar todo el carrito
window.clearCart = function() {
    if(confirm('¿Estás seguro de que quieres vaciar el carrito?')) {
        saveCart([]);
        updateCartUI();
    }
};

// Cambiar cantidad (+/-)
window.changeQty = function(id, delta) {
    const cart = getCart();
    const item = cart.find(item => item.id === id);
    if (item) {
        // Validar stock al incrementar
        if (delta > 0) {
            const product = PRODUCTS.find(p => p.id === id);
            if (product && product.stock !== undefined) {
                if (item.qty + delta > product.stock) {
                    showToast(`Stock máximo alcanzado (${product.stock}).`, 'warning');
                    return;
                }
            }
        }

        item.qty += delta;
        if (item.qty <= 0) {
            removeFromCart(id);
            return;
        }
        saveCart(cart);
    }
};

// --- UI DEL CARRITO ---

function updateCartUI() {
    const cart = getCart();
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    // 1. Actualizar contador en el header (burbuja roja)
    const cartCountEl = document.getElementById('cartCount');
    if (cartCountEl) cartCountEl.textContent = count;

    // 2. Actualizar contenido del Drawer (Lateral)
    const drawerContent = document.getElementById('cartDrawerContent');
    const drawerTotal = document.getElementById('cartDrawerTotal');

    if (drawerContent && drawerTotal) {
        if (cart.length === 0) {
            drawerContent.innerHTML = '<p style="text-align:center; margin-top:20px; color:#666;">Tu carrito está vacío.</p>';
            drawerTotal.textContent = `Total: ${formatCOP(0)}`;
        } else {
            drawerContent.innerHTML = cart.map(item => `
                <div class="cart-item">
                    <img src="${item.img}" alt="${item.title}">
                    <div class="meta">
                        <div class="title">${item.title}</div>
                        <div class="price">${formatCOP(item.price)}</div>
                        <div class="qty-controls">
                            <button class="qty-btn" onclick="changeQty('${item.id}', -1)">-</button>
                            <span class="qty-display">${item.qty}</span>
                            <button class="qty-btn" onclick="changeQty('${item.id}', 1)">+</button>
                        </div>
                    </div>
                    <button class="remove-item" onclick="removeFromCart('${item.id}')" aria-label="Eliminar">×</button>
                </div>
            `).join('');
            drawerTotal.textContent = `Total: ${formatCOP(total)}`;
        }
    }
    
    // 3. Actualizar Modal de Carrito (si se usa en index)
    const modalContent = document.getElementById('cartContent');
    if (modalContent) {
        modalContent.textContent = cart.length === 0 
            ? 'Tu carrito está vacío.' 
            : `Tienes ${count} productos. Total: ${formatCOP(total)}`;
    }
}

// Abrir/Cerrar Drawer
window.openCartDrawer = function() {
    const drawer = document.getElementById('cartDrawer');
    const backdrop = document.getElementById('cartDrawerBackdrop');
    if (drawer && backdrop) {
        drawer.classList.add('open');
        backdrop.classList.remove('hidden');
        drawer.setAttribute('aria-hidden', 'false');
    }
};

window.closeCartDrawer = function() {
    const drawer = document.getElementById('cartDrawer');
    const backdrop = document.getElementById('cartDrawerBackdrop');
    if (drawer && backdrop) {
        drawer.classList.remove('open');
        backdrop.classList.add('hidden');
        drawer.setAttribute('aria-hidden', 'true');
    }
};

// --- CHECKOUT (PAGO CONECTADO AL BACKEND) ---

window.handleCheckout = async function() {
    console.log('Botón de pago presionado. Iniciando proceso...');
    const token = localStorage.getItem('acme_token');
    
    // Debug: Verificar si el token existe antes de enviar
    console.log('Token de autenticación:', token ? 'Presente' : 'Ausente');

    if (!token) {
        showToast('Debes iniciar sesión para comprar.', 'warning');
        // Intentar abrir modal de login usando la función global de auth.js
        const loginModal = document.getElementById('loginModal');
        if (window.openModal && loginModal) {
            window.openModal(loginModal);
        }
        return;
    }

    const cart = getCart();
    if (cart.length === 0) {
        showToast('Tu carrito está vacío.', 'error');
        return;
    }

    try {
        // 1. Solicitar Transacción Wompi al Backend
        showToast('Redirigiendo a Wompi...', 'info');

        const endpoint = `${API_URL}/payments/create-transaction`;
        const payload = { 
            items: cart
        };

        console.log('Enviando solicitud a:', endpoint);
        console.log('Datos enviados (Payload):', payload);
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        console.log('Estado de la respuesta HTTP:', response.status);

        // Verificar si la respuesta es JSON antes de parsear
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const text = await response.text();
            console.error('Respuesta no válida del servidor (No es JSON):', text);
            throw new Error(`Error de comunicación con el servidor (Status: ${response.status})`);
        }

        const data = await response.json();

        if (!response.ok) {
            console.error('Error devuelto por el servidor:', data);
            throw new Error(data.msg || data.message || 'Error al iniciar pago');
        }

        console.log('Datos de la transacción recibidos:', data);

        // 2. Redirigir a Wompi Checkout
        if (data.redirectUrl) {
            localStorage.removeItem('acme_cart'); // Limpiamos carrito preventivamente
            window.location.href = data.redirectUrl;
        } else {
            console.error('Respuesta sin redirectUrl:', data);
            throw new Error('No se recibió la URL de pago.');
        }

    } catch (error) {
        console.error('Error checkout:', error);
        showToast(error.message, 'error');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar estado del carrito
    updateCartUI();

    // 2. Event Listeners para abrir/cerrar carrito
    const openCartBtns = document.querySelectorAll('.open-cart');
    openCartBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            window.openCartDrawer();
        });
    });

    const closeCartBtn = document.getElementById('cartDrawerClose');
    if (closeCartBtn) closeCartBtn.addEventListener('click', window.closeCartDrawer);

    const backdrop = document.getElementById('cartDrawerBackdrop');
    if (backdrop) backdrop.addEventListener('click', window.closeCartDrawer);

    // 3. Botones de Checkout
    const drawerCheckout = document.getElementById('drawerCheckout');
    if (drawerCheckout) drawerCheckout.addEventListener('click', handleCheckout);
    
    const modalCheckout = document.getElementById('checkoutBtn');
    if (modalCheckout) modalCheckout.addEventListener('click', handleCheckout);

    // 4. Renderizar productos destacados en index.html (si existe el contenedor)
    // Sincronizar con backend y luego renderizar
    syncProducts().then(() => {
        renderFeaturedProducts();
        updateCategoryPagesUI();
    });
    
    // 5. Búsqueda (Simulada)
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const query = document.getElementById('searchInput').value;
            if(query) alert(`Buscando: ${query} (Simulado)`);
        });
    }
    
    // Abrir modal búsqueda
    const openSearchBtns = document.querySelectorAll('.open-search');
    const searchModal = document.getElementById('searchModal');
    if(searchModal) {
        openSearchBtns.forEach(btn => btn.addEventListener('click', (e) => {
            e.preventDefault();
            if(window.openModal) window.openModal(searchModal);
        }));
    }

    // --- MEJORA: Delegación de eventos para botones "Agregar al carrito" ---
    // Esto reemplaza los `onclick` en el HTML y soluciona el problema de IDs.
    document.body.addEventListener('click', (e) => {
        const addToCartButton = e.target.closest('button.add-to-cart');
        if (addToCartButton) {
            e.preventDefault(); // Prevenir cualquier comportamiento por defecto
            const productId = addToCartButton.getAttribute('data-id');
            if (productId) window.addToCart(productId);
        }
    });
});
