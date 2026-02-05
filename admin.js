// --- CONFIGURATION ---
const API_URL = 'http://localhost:3000/api';

// --- STATE ---
let currentProductToEdit = null;
let currentAdminId = null;
let currentOrderToEdit = null;
let currentSection = localStorage.getItem('acme_admin_section') || 'inventory';

// --- HELPERS ---
function formatCOP(value) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

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
            } catch (e) {
                // Ignorar error si el token de la tienda no es válido o no es de admin
            }
        }
    }

    if (token) {
        try {
            // Decodificar token para obtener el ID del admin y aplicar regla de autoprotección
            const payload = JSON.parse(atob(token.split('.')[1]));
            currentAdminId = payload.userId;
            showDashboard();
        } catch (e) {
            console.error("Token de admin inválido, cerrando sesión.");
            logout();
        }
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
            tbody.innerHTML = products.map(p => {
                // CAMBIO 1: Usar un ID defensivo y mostrarlo.
                const productId = p._id || p.id;
                return `
                <tr>
                    <td><img src="${p.img}" class="product-thumb" alt="img"></td>
                    <td>
                        <div style="font-weight:600">${p.title}</div>
                        <small style="color:#888">ID: ${productId}</small>
                    </td>
                    <td>${formatCOP(p.price)}</td>
                    <td><span class="badge ${p.stock > 5 ? 'badge-success' : 'badge-danger'}">${p.stock} unid.</span></td>
                    <td><span class="badge badge-${p.status === 'active' ? 'success' : (p.status === 'hidden' ? 'warning' : 'danger')}">${p.status || 'active'}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick='openProductModal(${JSON.stringify(p)})'>✏️ Editar</button>
                    </td>
                </tr>`;
            }).join('');
        },
        filter(query) {
            const lowerCaseQuery = query.toLowerCase();
            const filtered = this.data.filter(p => {
                const productId = p._id || p.id;
                return p.title.toLowerCase().includes(lowerCaseQuery) ||
                       (productId && productId.toString().toLowerCase().includes(lowerCaseQuery));
            });
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

                // MEJORA 1: Mostrar resumen de productos, aprovechando el 'populate' del backend.
                const productsSummary = o.items?.map(item => {
                    const p = item.productId;
                    if (!p) return '<span style="color: #999;">(Producto eliminado)</span>';
                    // Usamos item.qty, que es la propiedad correcta del modelo Order.
                    return `${p.title} (x${item.qty})`;
                }).join('<br>') || '—';

                // FIX 1: Mostrar el nombre del usuario en lugar del objeto.
                // El backend popula `userId`, por lo que es un objeto con `name` y `email`.
                const userName = o.userId ? (o.userId.name || o.userId.email) : 'Usuario no disponible';

                // FIX 2: Usar `_id` ya que el modelo Order no tiene el virtual `id`.
                // Esto asegura que siempre tengamos un ID válido para las operaciones.
                const orderId = o._id || o.id;

                return `<tr>
                    <td><small>#${orderId.toString().substring(orderId.length - 7)}</small></td>
                    <td>${userName}</td>
                    <td>${productsSummary}</td>
                    <td>${formatCOP(o.total)}</td>
                    <td>${new Date(o.createdAt).toLocaleDateString()}</td>
                    <td><span class="badge ${badgeClass}">${o.status}</span></td>
                    <td><button class="btn btn-sm btn-outline" onclick="openStatusModal('${orderId}', '${o.status}')">🔄 Estado</button></td>
                </tr>`;
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
            tbody.innerHTML = users.map(u => {
                // CAMBIO 3: Usar _id y mostrar versión corta.
                const userId = u._id || u.id;
                const userStatus = u.status || 'active';

                const roleBadge = `<span class="badge ${u.role === 'admin' ? 'badge-danger' : 'badge-info'}">${u.role}</span>`;
                const statusBadge = `<span class="badge ${userStatus === 'active' ? 'badge-success' : 'badge-danger'}">${userStatus}</span>`;
                
                let actionButton = '';
                // Regla de autoprotección: No mostrar botón para el admin actualmente logueado
                if (userId !== currentAdminId) {
                    const actionText = userStatus === 'active' ? 'Suspender' : 'Activar';
                    const btnClass = userStatus === 'active' ? 'btn-outline-danger' : 'btn-outline-success';
                    actionButton = `<button class="btn btn-sm ${btnClass}" onclick="toggleUserStatus('${userId}', '${userStatus}')">${actionText}</button>`;
                } else {
                    actionButton = '—'; // Placeholder para el admin actual
                }

                return `<tr>
                    <td><small>#${userId.toString().substring(userId.length - 7)}</small></td>
                    <td>${u.name || 'Sin nombre'}</td>
                    <td>${u.email}</td>
                    <td>${roleBadge}</td>
                    <td>${statusBadge}</td>
                    <td>${actionButton}</td>
                </tr>`;
            }).join('');
        }
    }
};

async function toggleUserStatus(userId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    if (!confirm(`¿Estás seguro de que quieres ${newStatus === 'suspended' ? 'suspender' : 'reactivar'} a este usuario?`)) return;

    setLoading(true);
    const response = await fetchAdmin(`/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
    });

    if (response && response.ok) {
        const result = await response.json();
        showToast(result.msg || 'Estado del usuario actualizado.', 'success');
        AdminUI.users.load();
    } else {
        let errorMessage = 'Error al actualizar el estado del usuario.';
        if (response) {
            try {
                const errorData = await response.json();
                if (errorData && errorData.msg) {
                    errorMessage = errorData.msg;
                }
            } catch (e) {
                // Si no hay JSON, se usa el mensaje por defecto
            }
        }
        showToast(errorMessage, 'error');
    }
    setLoading(false);
}

// --- MODAL ACTIONS ---

// Abrir modal reutilizable (Crear o Editar)
function openProductModal(product) {
    const modalTitle = document.getElementById('productModalTitle');
    const prodImageInput = document.getElementById('prodImage');
    
    if (product) {
        // MODO EDITAR
        currentProductToEdit = product._id || product.id;
        modalTitle.textContent = 'Editar Producto';
        document.getElementById('prodName').value = product.title;
        document.getElementById('prodPrice').value = product.price;
        document.getElementById('prodStock').value = product.stock;
        document.getElementById('prodImage').value = ''; // Limpiar input file
        document.getElementById('prodImage').setAttribute('data-current-img', product.img);
        document.getElementById('prodImageUrl').value = '';
        document.getElementById('prodStatus').value = product.status || 'active';
        prodImageInput.required = false; // No requerido al editar
    } else {
        // MODO CREAR
        currentProductToEdit = null;
        modalTitle.textContent = 'Nuevo Producto';
        document.getElementById('productForm').reset();
        document.getElementById('prodStatus').value = 'active';
        prodImageInput.required = true; // Requerido al crear
        document.getElementById('prodImage').removeAttribute('data-current-img');
    }
    document.getElementById('productModal').classList.add('active');
}

document.getElementById('saveProductBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    
    let imageUrl = null;
    const imageFile = document.getElementById('prodImage').files[0];
    const imageUrlInput = document.getElementById('prodImageUrl').value;

    // Si hay archivo seleccionado, subirlo
    if (imageFile) {
        // VALIDACIÓN: Limitar tamaño a 2MB para evitar error 413 del servidor
        if (imageFile.size > 2 * 1024 * 1024) {
            showToast('La imagen es muy pesada (Máx 2MB).', 'warning');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const base64 = event.target.result.split(',')[1]; // Obtener solo datos base64
                const uploadResponse = await fetchAdmin('/products/upload', {
                    method: 'POST',
                    body: JSON.stringify({
                        file: base64,
                        // Sanitizar nombre de archivo para evitar errores con espacios
                        filename: `${Date.now()}_${imageFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
                    })
                });

                if (uploadResponse && uploadResponse.ok) {
                    const uploadData = await uploadResponse.json();
                    imageUrl = uploadData.imgPath;
                    await saveProduct(imageUrl);
                } else {
                    // Manejo de errores específico
                    let errorMsg = 'Error al subir la imagen';
                    if (uploadResponse) {
                        if (uploadResponse.status === 413) {
                            errorMsg = 'La imagen es demasiado grande para el servidor.';
                        } else {
                            try {
                                const errData = await uploadResponse.json();
                                if (errData.msg) errorMsg = errData.msg;
                            } catch (e) {}
                        }
                    }
                    showToast(errorMsg, 'error');
                }
            } catch (error) {
                console.error('Upload error:', error);
                showToast('Error procesando el archivo', 'error');
            }
        };
        reader.readAsDataURL(imageFile);
    } 
    // Si hay URL de alternativa, usarla
    else if (imageUrlInput) {
        imageUrl = imageUrlInput;
        await saveProduct(imageUrl);
    } 
    // Si estamos editando y no hay nuevo archivo, usar el que ya tiene
    else if (currentProductToEdit) {
        const currentImg = document.getElementById('prodImage').getAttribute('data-current-img');
        imageUrl = currentImg;
        await saveProduct(imageUrl);
    }
    // Error: No hay imagen
    else {
        showToast('Selecciona una imagen o proporciona URL', 'error');
    }
});

async function saveProduct(imageUrl) {
    const payload = {
        name: document.getElementById('prodName').value,
        price: parseFloat(document.getElementById('prodPrice').value),
        stock: parseInt(document.getElementById('prodStock').value),
        imageUrl: imageUrl,
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
}

function openStatusModal(id, status) { currentOrderToEdit = id; document.getElementById('statusModalOrderId').textContent = `Pedido #${id}`; document.getElementById('newStatusSelect').value = status; document.getElementById('statusModal').classList.add('active'); }
document.getElementById('confirmStatusBtn').addEventListener('click', async (e) => {
    e.preventDefault(); // Prevenir recarga de página para mantener la vista en la sección de Pedidos
    const newStatus = document.getElementById('newStatusSelect').value;
    setLoading(true);
    const response = await fetchAdmin(`/orders/${currentOrderToEdit}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
    if (response && response.ok) { 
        closeModal('statusModal'); 
        AdminUI.orders.load(); 
        showToast('Estado actualizado', 'success'); 
    } else { 
        let errorMessage = 'Error al actualizar';
        if (response) {
            try {
                // Intentar leer el mensaje de error específico del backend
                const errorData = await response.json();
                if (errorData && errorData.msg) errorMessage = errorData.msg;
            } catch (e) {
                // Si la respuesta no es JSON, usar el mensaje genérico
            }
        }
        showToast(errorMessage, 'error'); 
    }
    setLoading(false);
});

// --- UTILS ---
function showToast(msg, type='success') { const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3000); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function setLoading(l) { document.getElementById('loadingOverlay').classList.toggle('hidden', !l); }

init();