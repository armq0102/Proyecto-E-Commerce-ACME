// script.js - Lógica principal del frontend (Carrito y Productos)

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

// --- SINCRONIZACIÓN CON BACKEND ---
async function syncProducts() {
    try {
        const response = await fetch('http://localhost:3000/api/products');
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

            return `
            <article class="product-card ${isOutOfStock ? 'out-of-stock' : ''}">
                ${isOutOfStock ? '<span class="badge-out-of-stock">Agotado</span>' : ''}
                <img src="${p.img}" alt="${p.title}">
                <h3>${p.title}</h3>
                <p class="price">$${p.price.toFixed(2)}</p>
                ${isLowStock ? `<p style="color:var(--acme-red, #cc0000);font-weight:bold;font-size:0.85rem;margin-bottom:5px;">¡Solo quedan ${p.stock}!</p>` : ''}
                <button class="btn btn-dark" 
                        onclick="addToCart('${p.id}')" 
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
                    product = PRODUCTS.find(p => p.title === title);
                    if (product) {
                        // ¡Encontrado! Actualizamos el botón con el ID real de Mongo
                        const realId = product.id || product._id;
                        console.log(`🔗 Vinculado: ${title} -> ${realId}`);
                        btn.setAttribute('data-id', realId);
                        btn.setAttribute('onclick', `addToCart('${realId}')`);
                    }
                }
            }
        }
        // ---------------------------------------------------------
        
        if (product && product.stock !== undefined) {
            const card = btn.closest('.product-card');
            
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
            drawerTotal.textContent = 'Total: $0.00';
        } else {
            drawerContent.innerHTML = cart.map(item => `
                <div class="cart-item">
                    <img src="${item.img}" alt="${item.title}">
                    <div class="meta">
                        <div class="title">${item.title}</div>
                        <div class="price">$${item.price.toFixed(2)}</div>
                        <div class="qty-controls">
                            <button class="qty-btn" onclick="changeQty('${item.id}', -1)">-</button>
                            <span class="qty-display">${item.qty}</span>
                            <button class="qty-btn" onclick="changeQty('${item.id}', 1)">+</button>
                        </div>
                    </div>
                    <button class="remove-item" onclick="removeFromCart('${item.id}')" aria-label="Eliminar">×</button>
                </div>
            `).join('');
            drawerTotal.textContent = `Total: $${total.toFixed(2)}`;
        }
    }
    
    // 3. Actualizar Modal de Carrito (si se usa en index)
    const modalContent = document.getElementById('cartContent');
    if (modalContent) {
        modalContent.textContent = cart.length === 0 
            ? 'Tu carrito está vacío.' 
            : `Tienes ${count} productos. Total: $${total.toFixed(2)}`;
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

    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    try {
        // Petición al Backend
        const response = await fetch('http://localhost:3000/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                items: cart,
                total: total
            })
        });

        if (response.ok) {
            showToast('¡Pedido realizado con éxito!', 'success');
            localStorage.removeItem('acme_cart'); // Limpiar carrito
            updateCartUI();
            closeCartDrawer();
            
            // Opcional: Abrir historial de pedidos
            const myOrdersBtn = document.getElementById('menuMyOrders');
            if(myOrdersBtn) myOrdersBtn.click();
            
        } else {
            const errorData = await response.json();
            showToast(`Error: ${errorData.message}`, 'error');
        }
    } catch (error) {
        console.error('Error en checkout:', error);
        showToast('Error de conexión al procesar pedido.', 'error');
    }
};

// --- INICIALIZACIÓN AL CARGAR LA PÁGINA ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar estado del carrito
    updateCartUI();

    // 2. Event Listeners para abrir/cerrar carrito
    const openCartBtns = document.querySelectorAll('.open-cart');
    openCartBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            openCartDrawer();
        });
    });

    const closeCartBtn = document.getElementById('cartDrawerClose');
    if (closeCartBtn) closeCartBtn.addEventListener('click', closeCartDrawer);

    const backdrop = document.getElementById('cartDrawerBackdrop');
    if (backdrop) backdrop.addEventListener('click', closeCartDrawer);

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
});
