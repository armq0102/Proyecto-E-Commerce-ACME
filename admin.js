// --- CONFIGURATION ---
const API_URL = 'http://localhost:3000/api';

// --- STATE ---
let currentProductToEdit = null;
let currentOrderToEdit = null;
let currentSection = localStorage.getItem('acme_admin_section') || 'inventory';

// --- AUTHENTICATION ---

function init() {
    let token = localStorage.getItem('acme_admin_token');

    // Auto-login: Si no hay token de admin, intentar usar el de la tienda principal
    if (!token) {
        const mainToken = localStorage.getItem('acme_token');
        if (mainToken) {
            try {
                const payload = JSON.parse(atob(mainToken.split('.')[1]));
                if (payload.role === 'admin') {
                    token = mainToken;
                    localStorage.setItem('acme_admin_token', token); // Guardar para esta sesión
                }
            } catch (e) {}
        }
    }

    if (token) {
        showDashboard();
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById('loginView').classList.remove('hidden');
    document.getElementById('dashboardView').classList.add('hidden');
}

function showDashboard() {
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('dashboardView').classList.remove('hidden');
    showSection(currentSection); // Usar la sección activa actual
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('loginError');
    
    setLoading(true);
    errorMsg.textContent = '';

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            try {
                const payload = JSON.parse(atob(data.token.split('.')[1]));
                if(payload.role !== 'admin') throw new Error('No tienes permisos de administrador.');

                localStorage.setItem('acme_admin_token', data.token);
                showDashboard();
            } catch (e) {
                throw new Error('Token inválido recibido del servidor.');
            }
        } else {
            throw new Error(data.message || 'Error al iniciar sesión');
        }
    } catch (error) {
        errorMsg.textContent = error.message;
    } finally {
        setLoading(false);
    }
});

function logout() {
    localStorage.removeItem('acme_admin_token');
    window.location.reload();
}

// --- API HELPERS ---

async function fetchAdmin(endpoint, options = {}, silent = false) {
    const token = localStorage.getItem('acme_admin_token');
    if (!token) {
        logout();
        return;
    }

    const defaultHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    options.headers = { ...defaultHeaders, ...options.headers };

    try {
        const response = await fetch(`${API_URL}/admin${endpoint}`, options);
        
        if (response.status === 401 || response.status === 403) {
            if (!silent) showToast('Sesión expirada o sin permisos.', 'error');
            logout();
            return null;
        }

        return response;
    } catch (error) {
        console.error('Fetch error:', error);
        if (!silent) showToast('Error de conexión con el servidor.', 'error');
        return null;
    }
}

// --- NAVIGATION ---

function showSection(sectionId) {
    currentSection = sectionId; // Actualizar estado de la sección activa
    localStorage.setItem('acme_admin_section', sectionId); // Persistir sección para sobrevivir recargas
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-link[onclick="showSection('${sectionId}')"]`);
    if(activeLink) activeLink.classList.add('active');

    document.getElementById('inventorySection').classList.add('hidden');
    document.getElementById('ordersSection').classList.add('hidden');
    document.getElementById('usersSection').classList.add('hidden');

    document.getElementById(`${sectionId}Section`).classList.remove('hidden');

    if (sectionId === 'inventory') {
        document.getElementById('sectionTitle').textContent = 'Inventario';
        AdminUI.inventory.load();
    } else if (sectionId === 'orders') {
        document.getElementById('sectionTitle').textContent = 'Pedidos';
        AdminUI.orders.load();
    } else if (sectionId === 'users') {
        document.getElementById('sectionTitle').textContent = 'Usuarios';
        AdminUI.users.load();
    }
}

// --- MODULARIZED LOGIC ---
const AdminUI = {
    inventory: {
        data: [], // Almacenamos los datos para filtrar localmente
        async load() {
            setLoading(true);
            const response = await fetchAdmin('/products');
            if (response && response.ok) {
                this.data = await response.json();
                this.render(this.data);
            }
            setLoading(false);
        },
        render(products) {
            const tbody = document.querySelector('#productsTable tbody');
            tbody.innerHTML = products.map(p => `
                <tr>
                    <td><img src="${p.img}" class="product-thumb" alt="img"></td>
                    <td>
                        <div style="font-weight:600">${p.title}</div>
                        <small style="color:#888">ID: ${p.id}</small>
                    </td>
                    <td>$${p.price.toFixed(2)}</td>
                    <td><span class="badge ${p.stock > 5 ? 'badge-success' : 'badge-danger'}">${p.stock} unid.</span></td>
                    <td><span class="badge badge-${p.status === 'active' ? 'success' : (p.status === 'hidden' ? 'warning' : 'danger')}">${p.status || 'active'}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick='openProductModal(${JSON.stringify(p)})'>✏️ Editar</button>
                    </td>
                </tr>
            `).join('');
        },
        filter(query) {
            const filtered = this.data.filter(p => 
                p.title.toLowerCase().includes(query.toLowerCase()) || 
                p.id.toLowerCase().includes(query.toLowerCase())
            );
            this.render(filtered);
        }
    },
    orders: {
        async load() {
            setLoading(true);
            const response = await fetchAdmin('/orders');
            if (response && response.ok) {
                const orders = await response.json();
                this.render(orders);
            }
            setLoading(false);
        },
        render(orders) {
            const tbody = document.querySelector('#ordersTable tbody');
            tbody.innerHTML = orders.map(o => {
                let badgeClass = 'badge-warning';
                if (o.status === 'Enviado') badgeClass = 'badge-info';
                if (o.status === 'Entregado') badgeClass = 'badge-success';
                if (o.status === 'Cancelado') badgeClass = 'badge-danger';
                return `<tr><td><small>#${o.id}</small></td><td>${o.userId}</td><td>$${o.total.toFixed(2)}</td><td>${new Date(o.createdAt).toLocaleDateString()}</td><td><span class="badge ${badgeClass}">${o.status}</span></td><td><button class="btn btn-sm btn-outline" onclick="openStatusModal('${o.id}', '${o.status}')">🔄 Estado</button></td></tr>`;
            }).join('');
        }
    },
    users: {
        async load() {
            setLoading(true);
            const response = await fetchAdmin('/users');
            if (response && response.ok) {
                const users = await response.json();
                this.render(users);
            }
            setLoading(false);
        },
        render(users) {
            const tbody = document.querySelector('#usersTable tbody');
            tbody.innerHTML = users.map(u => `<tr><td>${u.id}</td><td>${u.name || 'Sin nombre'}</td><td>${u.email}</td><td><span class="badge ${u.role === 'admin' ? 'badge-danger' : 'badge-info'}">${u.role}</span></td></tr>`).join('');
        }
    }
};

// --- MODAL ACTIONS ---

// Abrir modal reutilizable (Crear o Editar)
function openProductModal(product) {
    const modalTitle = document.getElementById('productModalTitle');
    
    if (product) {
        // MODO EDITAR
        currentProductToEdit = product.id;
        modalTitle.textContent = 'Editar Producto';
        document.getElementById('prodName').value = product.title;
        document.getElementById('prodPrice').value = product.price;
        document.getElementById('prodStock').value = product.stock;
        document.getElementById('prodImage').value = product.img;
        document.getElementById('prodStatus').value = product.status || 'active';
    } else {
        // MODO CREAR
        currentProductToEdit = null;
        modalTitle.textContent = 'Nuevo Producto';
        document.getElementById('productForm').reset();
        document.getElementById('prodStatus').value = 'active';
    }
    document.getElementById('productModal').classList.add('active');
}

document.getElementById('saveProductBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    
    const payload = {
        name: document.getElementById('prodName').value,
        price: parseFloat(document.getElementById('prodPrice').value),
        stock: parseInt(document.getElementById('prodStock').value),
        imageUrl: document.getElementById('prodImage').value,
        status: document.getElementById('prodStatus').value
    };

    // UX: Forzar estado 'out_of_stock' si el stock es 0
    if (payload.stock === 0) {
        payload.status = 'out_of_stock';
    }

    setLoading(true);
    const method = currentProductToEdit ? 'PUT' : 'POST';
    const url = currentProductToEdit ? `/products/${currentProductToEdit}` : '/products';

    const response = await fetchAdmin(url, { method, body: JSON.stringify(payload) });
    
    if (response && response.ok) {
        closeModal('productModal');
        AdminUI.inventory.load();
        showToast(currentProductToEdit ? 'Producto actualizado' : 'Producto creado', 'success');
    } else {
        showToast('Error al guardar producto', 'error');
    }
    setLoading(false);
});

function openStatusModal(id, status) { currentOrderToEdit = id; document.getElementById('statusModalOrderId').textContent = `Pedido #${id}`; document.getElementById('newStatusSelect').value = status; document.getElementById('statusModal').classList.add('active'); }
document.getElementById('confirmStatusBtn').addEventListener('click', async (e) => {
    e.preventDefault(); // Prevenir recarga de página para mantener la vista en la sección de Pedidos
    const newStatus = document.getElementById('newStatusSelect').value;
    setLoading(true);
    const response = await fetchAdmin(`/orders/${currentOrderToEdit}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
    if (response && response.ok) { closeModal('statusModal'); AdminUI.orders.load(); showToast('Estado actualizado', 'success'); } // Refrescar solo la tabla
    else { showToast('Error al actualizar', 'error'); }
    setLoading(false);
});

// --- UTILS ---
function showToast(msg, type='success') { const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3000); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function setLoading(l) { document.getElementById('loadingOverlay').classList.toggle('hidden', !l); }

init();