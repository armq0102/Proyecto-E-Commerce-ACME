// auth.js
// Lógica de autenticación profesional conectada al Backend

document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'https://priyecto-e-comerce-acme.onrender.com/api';

    const API_AUTH_URL = `${API_URL}/auth`;
    const API_ORDERS_URL = `${API_URL}/orders`;
    
    // --- UTILIDADES GLOBALES (Para evitar errores con onclick en HTML) ---
    if (!window.openModal) {
        window.openModal = (modal) => {
            if (!modal) return;
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('modal-open');
        };
    }
    if (!window.closeModal) {
        window.closeModal = (modal) => {
            if (!modal) return;
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('modal-open');
        };
    }

    // Elementos del DOM
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const accountForm = document.getElementById('accountForm');
    const loginStatus = document.getElementById('loginStatus');
    const registerStatus = document.getElementById('registerStatus');
    
    // Elementos de UI de usuario
    const userToggle = document.getElementById('userToggle');
    const menuOpenLogin = document.getElementById('menuOpenLogin');
    const menuOpenRegister = document.getElementById('menuOpenRegister');
    const menuOpenAccount = document.getElementById('menuOpenAccount');
    const menuMyOrders = document.getElementById('menuMyOrders');
    const menuLogout = document.getElementById('menuLogout');
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const accountModal = document.getElementById('accountModal');
    const userDropdown = document.getElementById('userDropdown');
    const detallesModal = document.getElementById('detallesModal'); // Modal para ver pedidos

    // --- FUNCIONES DE UI ---

    const updateUIForSession = (user) => {
        const displayName = user.name || user.firstName || 'Usuario';
        userToggle.textContent = `Hola, ${displayName} ▾`;
        
        // Mostrar/Ocultar opciones del menú
        if(menuOpenLogin) menuOpenLogin.classList.add('hidden');
        if(menuOpenRegister) menuOpenRegister.classList.add('hidden');
        if(menuOpenAccount) menuOpenAccount.classList.remove('hidden');
        if(menuMyOrders) menuMyOrders.classList.remove('hidden');
        if(menuLogout) menuLogout.classList.remove('hidden');
    };

    const updateUIForGuest = () => {
        userToggle.innerHTML = `<span class="user-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="8" r="3.2" stroke="currentColor" stroke-width="1.2" /><path d="M4.5 20c0-3.6 3.6-6.2 7.5-6.2s7.5 2.6 7.5 6.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" /></svg></span>`;
        
        if(menuOpenLogin) menuOpenLogin.classList.remove('hidden');
        if(menuOpenRegister) menuOpenRegister.classList.remove('hidden');
        if(menuOpenAccount) menuOpenAccount.classList.add('hidden');
        if(menuMyOrders) menuMyOrders.classList.add('hidden');
        if(menuLogout) menuLogout.classList.add('hidden');
    };

    // --- LÓGICA DE NEGOCIO (API) ---

    const checkSession = async () => {
        const token = localStorage.getItem('acme_token');
        if (!token) {
            updateUIForGuest();
            return;
        }

        try {
            const response = await fetch(`${API_AUTH_URL}/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const user = await response.json();
                updateUIForSession(user);
            } else {
                throw new Error('Sesión expirada');
            }
        } catch (error) {
            console.warn('Sesión inválida:', error);
            handleLogout();
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('acme_token');
        updateUIForGuest();
        window.location.href = 'index.html';
    };

    // --- LÓGICA DE PEDIDOS (NUEVO) ---
    const handleGetOrders = async () => {
        const token = localStorage.getItem('acme_token');
        if (!token) return;

        try {
            const response = await fetch(API_ORDERS_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const orders = await response.json();
                showOrdersInModal(orders);
            } else {
                alert('No se pudo obtener el historial de pedidos.');
            }
        } catch (error) {
            console.error('Error obteniendo pedidos:', error);
        }
    };

    // --- LÓGICA PÁGINA DE PERFIL (profile.html) ---
    const loadProfilePage = async () => {
        const token = localStorage.getItem('acme_token');
        if (!token) {
            window.location.href = 'index.html'; // Proteger ruta
            return;
        }

        // Limpieza estética: Quitar parámetros de Wompi de la URL (id, env) sin recargar
        if (window.history.replaceState && window.location.search) {
            const cleanUrl = window.location.pathname + window.location.hash;
            window.history.replaceState(null, '', cleanUrl);
        }

        // 1. Cargar Datos del Usuario
        try {
            const res = await fetch(`${API_AUTH_URL}/me`, { headers: { 'Authorization': `Bearer ${token}` }});
            if(res.ok) {
                const user = await res.json();
                // Llenar sidebar
                document.getElementById('profileNameDisplay').textContent = user.name;
                document.getElementById('profileEmailDisplay').textContent = user.email;
                document.getElementById('profileAvatar').textContent = user.name.charAt(0).toUpperCase();
                
                // Llenar formulario
                const form = document.getElementById('fullProfileForm');
                if(form) {
                    const names = user.name.split(' ');
                    form.elements.firstName.value = names[0] || '';
                    form.elements.lastName.value = names.slice(1).join(' ') || '';
                    form.elements.email.value = user.email;
                    // Rellenar campos extra si existen
                    if(form.elements.phone) form.elements.phone.value = user.phone || '';
                    if(form.elements.address) form.elements.address.value = user.address || '';
                }
            }
        } catch(e) { console.error(e); }

        // 2. Cargar Pedidos (Reutilizamos lógica pero renderizamos en div)
        handleGetOrdersForProfilePage(token);
    };

    const handleGetOrdersForProfilePage = async (token) => {
        const container = document.getElementById('profileOrdersTableContainer');
        if(!container) return;

        try {
            const response = await fetch(API_ORDERS_URL, { headers: { 'Authorization': `Bearer ${token}` }});
            if (response.ok) {
                const orders = await response.json();
                if (orders.length === 0) {
                    container.innerHTML = '<p>No tienes pedidos registrados.</p>';
                } else {
                    // Renderizar tabla HTML
                    let html = '<div style="overflow-x:auto;"><table style="width:100%; border-collapse: collapse; text-align: left;">';
                    html += '<thead style="background:#f8f9fa; border-bottom:2px solid #dee2e6;"><tr><th style="padding:12px;">ID</th><th style="padding:12px;">Fecha</th><th style="padding:12px;">Total</th><th style="padding:12px;">Estado</th></tr></thead><tbody>';
                    orders.forEach(order => {
                        html += `<tr style="border-bottom:1px solid #eee;">
                            <td style="padding:12px;">#${order.id}</td>
                            <td style="padding:12px;">
                                ${new Date(order.createdAt || order.date).toLocaleDateString()}
                            </td>
                            <td style="padding:12px; font-weight:bold;">${formatCOP(order.total)}</td>
                            <td style="padding:12px;">
                                <span style="
                                    background:#e6fffa;
                                    color:#006d5b;
                                    padding:4px 8px;
                                    border-radius:4px;
                                    font-size:0.85rem;
                                ">
                                    ${order.status}
                                </span>
                            </td>
                        </tr>`;
                    });
                    html += '</tbody></table></div>';
                    container.innerHTML = html;
                }
            }
        } catch (error) { console.error(error); }
    };

    const showOrdersInModal = (orders) => {
        if (!detallesModal) return;
        const body = detallesModal.querySelector('.modal-body');
        
        if (orders.length === 0) {
            body.innerHTML = '<p>Aún no has realizado ningún pedido.</p>';
        } else {
            let html = '<div style="overflow-x:auto;"><table style="width:100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">';
            html += '<thead style="background:#f4f4f4; color:#333;"><tr>';
            html += '<th style="padding: 10px; border-bottom: 2px solid #ddd;">ID</th><th style="padding: 10px; border-bottom: 2px solid #ddd;">Fecha</th><th style="padding: 10px; border-bottom: 2px solid #ddd;">Total</th><th style="padding: 10px; border-bottom: 2px solid #ddd;">Estado</th>';
            html += '</tr></thead><tbody>';
            
            orders.forEach(order => {
                html += `<tr style="border-bottom:1px solid #eee;">
                    <td style="padding:12px;">#${order.id}</td>
                    <td style="padding:12px;">
                        ${new Date(order.createdAt || order.date).toLocaleDateString()}
                    </td>
                    <td style="padding:12px; font-weight:bold;">${formatCOP(order.total)}</td>
                    <td style="padding:12px;">
                        <span style="
                            background:#e6fffa;
                            color:#006d5b;
                            padding:4px 8px;
                            border-radius:4px;
                            font-size:0.85rem;
                        ">
                            ${order.status}
                        </span>
                    </td>
                </tr>`;
            });
            html += '</tbody></table></div>';
            body.innerHTML = html;
        }
        window.openModal(detallesModal);
    };

    // --- EVENT LISTENERS ---

    // 1. LOGIN
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            loginStatus.textContent = 'Autenticando...';
            loginStatus.style.color = 'var(--text-dark)';

            const formData = new FormData(loginForm);
            const data = Object.fromEntries(formData.entries());

            // Limpieza preventiva de espacios
            if (data.email) data.email = data.email.trim();

            try {
                const response = await fetch(`${API_AUTH_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (!response.ok) throw new Error(result.message || 'Error de login');

                // Guardar SOLO el token
                localStorage.setItem('acme_token', result.token);
                
                loginStatus.textContent = '¡Bienvenido!';
                loginStatus.style.color = 'green';
                updateUIForSession(result.user);
                
                setTimeout(() => {
                    if(typeof closeModal === 'function') closeModal(loginModal);
                    loginForm.reset();
                    loginStatus.textContent = '';
                }, 1000);

            } catch (error) {
                loginStatus.textContent = error.message;
                loginStatus.style.color = 'var(--acme-red)';
            }
        });
    }

    // 2. REGISTRO
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            registerStatus.textContent = 'Registrando...';
            
            const formData = new FormData(registerForm);
            const data = Object.fromEntries(formData.entries());
            
            // Adaptar datos para el backend (unir nombre)
            data.name = `${data.firstName} ${data.lastName}`.trim();

            try {
                const response = await fetch(`${API_AUTH_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (!response.ok) throw new Error(result.message || 'Error de registro');

                registerStatus.textContent = '¡Cuenta creada! Inicia sesión.';
                registerStatus.style.color = 'green';
                registerForm.reset();
                
                setTimeout(() => {
                    if(typeof closeModal === 'function') closeModal(registerModal);
                    if(typeof openModal === 'function') openModal(loginModal);
                }, 2000);

            } catch (error) {
                registerStatus.textContent = error.message;
                registerStatus.style.color = 'var(--acme-red)';
            }
        });
    }

    // 3. LOGOUT
    if (menuLogout) {
        menuLogout.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }

    // 4. MIS PEDIDOS
    if (menuMyOrders) {
        menuMyOrders.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'profile.html#pedidos';
        });
    }

    // --- INTERACCIONES DE UI (Menú, Modales, Navegación) ---

    // 5. Toggle del Menú de Usuario
    if (userToggle && userDropdown) {
        const userMenu = userToggle.closest('.user-menu');

        userToggle.addEventListener('click', (e) => {
            e.preventDefault();
            if (userMenu) {
                const isOpen = userMenu.classList.toggle('open');
                userToggle.setAttribute('aria-expanded', isOpen);
            }
        });

        // Cerrar al hacer clic fuera
        window.addEventListener('click', (e) => {
            if (!userToggle.contains(e.target) && !userDropdown.contains(e.target)) {
                if (userMenu) userMenu.classList.remove('open');
                userToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // 6. Abrir Modales desde el Menú (Usando window.openModal seguro)
    if (menuOpenLogin) menuOpenLogin.addEventListener('click', (e) => { e.preventDefault(); window.openModal(loginModal); });
    if (menuOpenRegister) menuOpenRegister.addEventListener('click', (e) => { e.preventDefault(); window.openModal(registerModal); });
    
    // CAMBIO: Redirigir a profile.html en lugar de abrir modal
    if (menuOpenAccount) menuOpenAccount.addEventListener('click', (e) => { 
        e.preventDefault(); 
        window.location.href = 'profile.html'; 
    });

    // 7. Cerrar Modales (Botones X y Cancelar)
    document.querySelectorAll('.close-btn, .modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            if (typeof window.closeModal === 'function') window.closeModal(btn.closest('.modal'));
        });
    });

    // 8. Manejo de Navegación (Links vacíos o anclas)
    document.querySelectorAll('.main-nav a, .side-nav a').forEach(a => {
        a.addEventListener('click', (e) => {
            const href = a.getAttribute('href');
            
            // Si es un link de ancla (#id), scroll suave
            if (href && href.startsWith('#') && href.length > 1) {
                const target = document.querySelector(href);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
            // Si es un link vacío (#), mostrar aviso
            else if (!href || href === '#') {
                e.preventDefault();
                alert(`La sección "${a.textContent.trim()}" aún no está implementada.`);
            }
        });
    });

    // 9. Mostrar/Ocultar Contraseña
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); // Evitar submit accidental
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input) {
                const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                input.setAttribute('type', type);
                btn.textContent = type === 'password' ? '👁️' : '🙈';
            }
        });
    });

    // Inicializar sesión al cargar
    checkSession();

    // Si estamos en la página de perfil, cargar datos
    if (window.location.pathname.includes('profile.html')) {
        loadProfilePage();
        
        // Lógica simple de Tabs (Datos vs Pedidos)
        const tabDatos = document.getElementById('tabDatos');
        const tabPedidos = document.getElementById('tabPedidos');
        const linkDatos = document.getElementById('tabLinkDatos');
        const linkPedidos = document.getElementById('tabLinkPedidos');

        const switchTab = (tab) => {
            if(tab === 'pedidos') {
                tabDatos.classList.add('hidden');
                tabPedidos.classList.remove('hidden');
                linkDatos.classList.remove('active');
                linkPedidos.classList.add('active');
            } else {
                tabPedidos.classList.add('hidden');
                tabDatos.classList.remove('hidden');
                linkPedidos.classList.remove('active');
                linkDatos.classList.add('active');
            }
        };

        if(linkDatos) linkDatos.addEventListener('click', () => switchTab('datos'));
        if(linkPedidos) linkPedidos.addEventListener('click', () => switchTab('pedidos'));
        
        // Si la URL tiene #pedidos, abrir esa tab
        if(window.location.hash === '#pedidos') switchTab('pedidos');
        
        // Logout desde sidebar
        const sidebarLogout = document.getElementById('sidebarLogout');
        if(sidebarLogout) sidebarLogout.addEventListener('click', (e) => { e.preventDefault(); handleLogout(); });

        // --- GUARDAR CAMBIOS DE PERFIL ---
        const profileForm = document.getElementById('fullProfileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = profileForm.querySelector('button[type="submit"]');
                const originalText = btn.textContent;
                btn.textContent = 'Guardando...';
                btn.disabled = true;

                const formData = new FormData(profileForm);
                const data = Object.fromEntries(formData.entries());
                
                // Combinar nombre y apellido para el backend
                const fullName = `${data.firstName} ${data.lastName}`.trim();

                const token = localStorage.getItem('acme_token');

                try {
                    const response = await fetch(`${API_AUTH_URL}/update`, {
                        method: 'PUT',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            name: fullName,
                            phone: data.phone,
                            address: data.address
                        })
                    });

                    if (response.ok) {
                        alert('¡Datos actualizados correctamente!');
                        // Actualizar nombre en el sidebar inmediatamente
                        document.getElementById('profileNameDisplay').textContent = fullName;
                        document.getElementById('profileAvatar').textContent = fullName.charAt(0).toUpperCase();
                    } else {
                        alert('Error al actualizar el perfil.');
                    }
                } catch (error) {
                    console.error(error);
                    alert('Error de conexión.');
                } finally {
                    btn.textContent = originalText;
                    btn.disabled = false;
                }
            });
        }
    }
});