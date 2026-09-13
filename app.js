// RUTA: inventario-pro/app.js

// CONFIGURACION DE SUPABASE
const SUPABASE_URL = 'https://xqisaqjswazjawzeguuj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxaXNhcWpzd2F6amF3emVndXVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxODE1MjQsImV4cCI6MjEwMTc1NzUyNH0.TGegMa4OXGN45MqHpKMbNQk0kGiKTGIdmwLQvCelvCA';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let state = {
    user: null,
    products: []
};

let html5QrCode = null;
let activeScannerTarget = null;

document.addEventListener('DOMContentLoaded', () => {
    const menuToggleBtn = document.getElementById('menu-toggle-btn');
    const navTabsContainer = document.getElementById('nav-tabs-container');
    const tabBtns = document.querySelectorAll('.tab-btn');

    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    document.addEventListener('click', (e) => {
        if (!menuToggleBtn || !navTabsContainer) return;
        if (menuToggleBtn.contains(e.target)) {
            e.stopPropagation();
            navTabsContainer.classList.toggle('mobile-open');
        } else if (e.target.classList.contains('tab-btn')) {
            if (window.innerWidth <= 768) {
                navTabsContainer.classList.remove('mobile-open');
            }
        } else if (!navTabsContainer.contains(e.target)) {
            navTabsContainer.classList.remove('mobile-open');
        }
    });

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
            tabBtns.forEach(b => b.classList.remove('active'));
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.classList.remove('hidden');
            }
            btn.classList.add('active');

            if (navTabsContainer && window.innerWidth <= 768) {
                navTabsContainer.classList.remove('mobile-open');
            }

            if (targetId === 'tab-tenant-stats') {
                if (typeof loadTenantStats === 'function') {
                    loadTenantStats();
                }
            } else if (targetId === 'tab-admin-users') {
                cargarEmpresasEnSelect();
                cargarRolesEnSelect();
                loadAdminUsersList();
            } else if (targetId === 'tab-global-audit') {
                loadGlobalStatsAndAudit();
            }
        });
    });

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            const filtered = state.products.filter(prod => 
                (prod.name && prod.name.toLowerCase().includes(term)) || 
                (prod.code && prod.code.toLowerCase().includes(term))
            );
            renderProducts(filtered);
        });
    }

    const scanSearchBtn = document.getElementById('scan-search-btn');
    if (scanSearchBtn) {
        scanSearchBtn.addEventListener('click', () => {
            const val = searchInput.value.trim();
            if (val === '') {
                openScanner('search');
            } else {
                const term = val.toLowerCase();
                const filtered = state.products.filter(prod => 
                    (prod.name && prod.name.toLowerCase().includes(term)) || 
                    (prod.code && prod.code.toLowerCase().includes(term))
                );
                renderProducts(filtered);
            }
        });
    }

    const scanIngressBtn = document.getElementById('scan-ingress-btn');
    const ingressCodeInput = document.getElementById('ingress-code');
    if (scanIngressBtn && ingressCodeInput) {
        scanIngressBtn.addEventListener('click', () => {
            const val = ingressCodeInput.value.trim();
            if (val === '') {
                openScanner('ingress');
            } else {
                handleSearchMasterProduct();
            }
        });
    }

    const closeScannerBtn = document.getElementById('close-scanner-btn');
    if (closeScannerBtn) {
        closeScannerBtn.addEventListener('click', closeScanner);
    }

    const createCompanyForm = document.getElementById('create-company-form');
    if (createCompanyForm) createCompanyForm.addEventListener('submit', handleCreateCompany);

    const createUserForm = document.getElementById('create-user-form');
    if (createUserForm) createUserForm.addEventListener('submit', handleCreateUser);

    const searchMasterBtn = document.getElementById('search-master-btn');
    if (searchMasterBtn) {
        searchMasterBtn.addEventListener('click', handleSearchMasterProduct);
    }

    const ingressForm = document.getElementById('ingress-form');
    if (ingressForm) {
        ingressForm.addEventListener('submit', handleIngressMercancia);
    }

    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            state.user = session.user;
            showDashboard();
        }
    });

    const closeEditModal = () => {
        const modal = document.getElementById('edit-user-modal');
        if (modal) modal.classList.add('hidden');
    };
    const closeEditBtn = document.getElementById('close-edit-modal-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    if (closeEditBtn) closeEditBtn.addEventListener('click', closeEditModal);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModal);
    const editForm = document.getElementById('edit-user-form');
    if (editForm) {
        editForm.addEventListener('submit', handleUpdateUser);
    }
});

function openScanner(targetType) {
    activeScannerTarget = targetType;
    const modal = document.getElementById('scanner-modal');
    modal.classList.remove('hidden');

    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }

    const config = { fps: 10, qrbox: { width: 250, height: 150 } };

    html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        onScanSuccess, 
        onScanFailure
    ).catch(err => {
        console.error("Error al iniciar la camara:", err);
        alert("No se pudo acceder a la camara. Revisa que los permisos esten habilitados.");
        closeScanner();
    });
}

async function onScanSuccess(decodedText, decodedResult) {
    closeScanner();
    if (activeScannerTarget === 'search') {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = decodedText;
            const term = decodedText.toLowerCase().trim();
            const filtered = state.products.filter(prod => 
                (prod.name && prod.name.toLowerCase().includes(term)) || 
                (prod.code && prod.code.toLowerCase().includes(term)) ||
                (prod.barcode && prod.barcode.toLowerCase().includes(term))
            );
            renderProducts(filtered);
        }
    } else if (activeScannerTarget === 'ingress') {
        const codeInput = document.getElementById('ingress-code');
        if (codeInput) {
            codeInput.value = decodedText;
            await handleSearchMasterProduct();
        }
    } else if (activeScannerTarget === 'egress') {
        const codeInput = document.getElementById('egress-code');
        if (codeInput) {
            codeInput.value = decodedText;
            if (typeof handleSearchEgressProduct === 'function') {
                await handleSearchEgressProduct();
            }
        }
    }
}

function onScanFailure(error) {
    // Ignorar errores por fotograma para mantener rendimiento fluido
}

async function closeScanner() {
    const modal = document.getElementById('scanner-modal');
    if (modal) modal.classList.add('hidden');

    if (html5QrCode && html5QrCode.isScanning) {
        try {
            await html5QrCode.stop();
        } catch (err) {
            console.error("Error al detener la camara:", err);
        }
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const emailInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    
    setLoadingLogin(true, 'Ingresando...');
    hideAlert();
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        if (error) throw error;
        state.user = data.user;
        showDashboard();
    } catch (error) {
        showAlert('Correo o contrasena incorrectos', 'error');
    } finally {
        setLoadingLogin(false, 'Ingresar');
    }
}

async function handleLogout() {
    await closeScanner();
    await supabaseClient.auth.signOut();
    state.user = null;
    state.products = [];
    
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.reset();

    document.getElementById('dashboard-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
}

async function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
    
    const nameDisplay = document.getElementById('user-display-name');
    if (state.user) {
        const isSuperAdmin = state.user.email === 'altuna.g1@gmail.com';
        if (nameDisplay) {
            nameDisplay.textContent = state.user.email + (isSuperAdmin ? ' (SuperAdmin Global)' : '');
        }
    }

    window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: { user: state.user } }));
    await loadProducts();
}

async function loadProducts() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) loadingIndicator.classList.remove('hidden');

    try {
        let query = supabaseClient.from('products').select('*');
        if (state.user && state.user.email !== 'altuna.g1@gmail.com') {
            const { data: userData, error: userError } = await supabaseClient
                .from('users')
                .select('tenant_id')
                .eq('username', state.user.email)
                .maybeSingle();

            if (userError || !userData || !userData.tenant_id) {
                throw new Error('El usuario actual no esta asociado a ninguna empresa.');
            }
            query = query.eq('tenant_id', userData.tenant_id);
        }

        const { data, error } = await query;
        if (error) throw error;

        state.products = data || [];
        renderProducts(state.products);
    } catch (error) {
        console.error('Error al cargar productos:', error.message);
    } finally {
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
    }
}

async function handleCreateCompany(e) {
    e.preventDefault();
    const nameInput = document.getElementById('company-name');
    const companyName = nameInput.value.trim();

    try {
        const { data, error } = await supabaseClient.from('tenants').insert([{ name: companyName }]).select();
        if (error) throw error;
        alert(`Empresa "${companyName}" creada con exito!`);
        nameInput.value = '';
        cargarEmpresasEnSelect();
    } catch (error) {
        alert('Error al crear la empresa: ' + error.message);
    }
}

async function cargarEmpresasEnSelect() {
    const select = document.getElementById('company-select');
    if (!select) return;

    try {
        select.innerHTML = `<option value="">Cargando empresas...</option>`;
        const { data, error } = await supabaseClient.from('tenants').select('id, name');
        if (error) throw error;

        if (!data || data.length === 0) {
            select.innerHTML = `<option value="">No hay empresas registradas</option>`;
            return;
        }
        select.innerHTML = `<option value="">Seleccione una empresa...</option>` + 
            data.map(comp => `<option value="${comp.id}">${comp.name}</option>`).join('');
    } catch (error) {
        console.error('Error al cargar empresas:', error.message);
        select.innerHTML = `<option value="">Error al cargar empresas</option>`;
    }
}

async function cargarRolesEnSelect() {
    const select = document.getElementById('user-role-select');
    if (!select) return;

    try {
        select.innerHTML = `<option value="">Cargando roles...</option>`;
        const { data, error } = await supabaseClient.from('roles').select('id, name');
        if (error) throw error;

        if (!data || data.length === 0) {
            select.innerHTML = `<option value="">No hay roles disponibles</option>`;
            return;
        }
        select.innerHTML = `<option value="">Seleccione un rol...</option>` + 
            data.map(rol => `<option value="${rol.id}">${rol.name.toUpperCase()}</option>`).join('');
    } catch (error) {
        console.error('Error al cargar roles:', error.message);
        select.innerHTML = `<option value="">Error al cargar roles</option>`;
    }
}

async function handleCreateUser(e) {
    e.preventDefault();
    const companySelect = document.getElementById('company-select');
    const roleSelect = document.getElementById('user-role-select');

    const companyId = companySelect.value;
    const selectedRoleId = roleSelect ? roleSelect.value : null;
    const email = document.getElementById('new-user-email').value.trim();
    const password = document.getElementById('new-user-password').value.trim();

    if (!companyId) {
        alert('Por favor selecciona una empresa valida de la lista.');
        return;
    }
    if (!selectedRoleId) {
        alert('Por favor selecciona un rol para el usuario.');
        return;
    }

    try {
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
            email: email,
            password: password
        });
        if (authError) throw authError;

        const userId = authData.user ? authData.user.id : null;
        if (!userId) throw new Error('No se pudo obtener el ID del usuario autenticado.');

        const { error: profileError } = await supabaseClient.from('users').insert([{
            id: userId,
            tenant_id: companyId,
            role_id: selectedRoleId,
            username: email,
            password: password,
            full_name: email.split('@')[0]
        }]);
        if (profileError) throw profileError;

        alert(`Usuario ${email} registrado y vinculado a la empresa con exito!`);
        document.getElementById('create-user-form').reset();
        loadAdminUsersList();
    } catch (error) {
        console.error("Detalle del error:", error);
        alert('Error al registrar usuario: ' + error.message);
    }
}

async function loadGlobalStatsAndAudit() {
    try {
        const { count: tenantCount, error: tenantError } = await supabaseClient.from('tenants').select('*', { count: 'exact', head: true });
        if (!tenantError) document.getElementById('stat-tenants').textContent = tenantCount ?? 0;

        const { count: userCount, error: userError } = await supabaseClient.from('users').select('*', { count: 'exact', head: true });
        if (!userError) document.getElementById('stat-users').textContent = userCount ?? 0;

        const { count: prodCount, error: prodError } = await supabaseClient.from('products').select('*', { count: 'exact', head: true });
        if (!prodError) document.getElementById('stat-products').textContent = prodCount ?? 0;

        const { data: auditData, error: auditError } = await supabaseClient
            .from('audit_logs')
            .select('created_at, action, entity_type')
            .order('created_at', { ascending: false })
            .limit(10);

        const auditTableBody = document.getElementById('audit-log-body');
        if (!auditTableBody) return;

        if (auditError || !auditData || auditData.length === 0) {
            auditTableBody.innerHTML = `<tr><td colspan="3" class="text-center">No hay registros de auditoria recientes.</td></tr>`;
            return;
        }

        auditTableBody.innerHTML = auditData.map(log => {
            const fechaFormateada = log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A';
            return `<tr><td>${fechaFormateada}</td><td><span class="badge">${log.action || 'ACCION'}</span></td><td>${log.entity_type || 'General'}</td></tr>`;
        }).join('');
    } catch (error) {
        console.error('Error al cargar estadisticas y auditoria:', error);
    }
}

async function handleSearchMasterProduct() {
    const codeInput = document.getElementById('ingress-code');
    const code = codeInput.value.trim();
    if (!code) {
        alert('Por favor introduce un codigo para buscar.');
        return;
    }

    try {
        const { data, error } = await supabaseClient.from('products').select('*').or(`code.eq.${code},barcode.eq.${code}`).maybeSingle();
        if (error) throw error;

        if (data) {
            document.getElementById('ingress-name').value = data.name || '';
            document.getElementById('ingress-price').value = data.sale_price || 0;
            document.getElementById('factor-box').value = data.box_factor || 1;
            document.getElementById('factor-pack').value = data.pack_factor || 1;
            document.getElementById('factor-bale').value = data.bale_factor || 1;
            alert('Producto encontrado en el Catalogo Maestro!');
        } else {
            alert('El producto no existe en el indice global. Puedes registrarlo llenando los datos.');
        }
    } catch (error) {
        console.error('Error al buscar producto maestro:', error);
    }
}

async function handleIngressMercancia(e) {
    e.preventDefault();
    const code = document.getElementById('ingress-code').value.trim();
    const name = document.getElementById('ingress-name').value.trim();
    const price = parseFloat(document.getElementById('ingress-price').value) || 0;
    
    const boxFactor = parseFloat(document.getElementById('factor-box').value) || 1;
    const packFactor = parseFloat(document.getElementById('factor-pack').value) || 1;
    const baleFactor = parseFloat(document.getElementById('factor-bale').value) || 1;
    const packagingUnit = document.getElementById('packaging-unit').value;
    const qtyEntered = parseFloat(document.getElementById('ingress-quantity').value) || 0;

    let totalUnitsToAdd = qtyEntered;
    if (packagingUnit === 'caja') totalUnitsToAdd = qtyEntered * boxFactor;
    else if (packagingUnit === 'paquete') totalUnitsToAdd = qtyEntered * packFactor;
    else if (packagingUnit === 'bulto') totalUnitsToAdd = qtyEntered * baleFactor;

    try {
        let tenantId = null;
        if (state.user.email !== 'altuna.g1@gmail.com') {
            const { data: userData, error: userLookupError } = await supabaseClient.from('users').select('tenant_id').eq('username', state.user.email).maybeSingle();
            if (userLookupError || !userData || !userData.tenant_id) throw new Error('Tu usuario no tiene un tenant_id asociado.');
            tenantId = userData.tenant_id;
        } else {
            const { data: tenants } = await supabaseClient.from('tenants').select('id').limit(1).maybeSingle();
            if (tenants) tenantId = tenants.id;
        }

        if (!tenantId) throw new Error('No se pudo determinar la empresa para registrar el stock.');

        let { data: existingProd } = await supabaseClient.from('products').select('*').or(`code.eq.${code},barcode.eq.${code}`).maybeSingle();
        let productId;

        if (existingProd) {
            productId = existingProd.id;
            await supabaseClient.from('products').update({ box_factor: boxFactor, pack_factor: packFactor, bale_factor: baleFactor, sale_price: price }).eq('id', productId);
        } else {
            productId = crypto.randomUUID();
            const { error: insertProdError } = await supabaseClient.from('products').insert([{
                id: productId, tenant_id: tenantId, code: code, barcode: code, name: name, sale_price: price,
                box_factor: boxFactor, pack_factor: packFactor, bale_factor: baleFactor, stock: 0 
            }]);
            if (insertProdError) throw insertProdError;
        }

        const currentStock = existingProd && existingProd.stock ? parseFloat(existingProd.stock) : 0;
        const newStock = currentStock + totalUnitsToAdd;

        const { error: updateStockError } = await supabaseClient.from('products').update({ stock: newStock }).eq('id', productId);
        if (updateStockError) throw updateStockError;

        alert(`Ingreso exitoso! Se sumaron ${totalUnitsToAdd} unidades al inventario.`);
        document.getElementById('ingress-form').reset();
        loadProducts(); 
    } catch (error) {
        console.error('Error en el ingreso de mercancia:', error);
        alert('Error al procesar el ingreso: ' + error.message);
    }
}

function renderProducts(productsToRender) {
    const container = document.getElementById('product-list');
    if (!container) return;
    if (!productsToRender || productsToRender.length === 0) {
        container.innerHTML = `<p class="no-products">No se encontraron productos para mostrar.</p>`;
        return;
    }
    container.innerHTML = productsToRender.map(prod => `
        <div class="product-card">
            <h3>${prod.name || 'Sin nombre'}</h3>
            <p><strong>Codigo:</strong> ${prod.code || prod.manual_code || prod.barcode || 'N/A'}</p>
            <p><strong>Stock:</strong> ${prod.stock ?? 0}</p>
            <p><strong>Precio:</strong> $${prod.sale_price ?? 0.00}</p>
        </div>
    `).join('');
}

function setLoadingLogin(isLoading, text) {
    const btn = document.getElementById('login-btn');
    if (!btn) return;
    btn.disabled = isLoading;
    btn.textContent = text;
}

function showAlert(message, type) {
    const alertDiv = document.getElementById('login-alert');
    if (!alertDiv) return;
    alertDiv.textContent = message;
    alertDiv.className = `alert ${type}`;
    alertDiv.classList.remove('hidden');
}

function hideAlert() {
    const alertDiv = document.getElementById('login-alert');
    if (!alertDiv) return;
    alertDiv.classList.add('hidden');
}

async function loadAdminUsersList() {
    const tbody = document.getElementById('admin-users-list-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="4" class="text-center">Cargando usuarios registrados...</td></tr>`;
    
    try {
        const { data, error } = await supabaseClient.from('users').select('id, username, tenant_id, role_id, tenants(name)').order('username', { ascending: true });
        if (error) throw error;
        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center">No hay usuarios registrados.</td></tr>`;
            return;
        }
        tbody.innerHTML = data.map(u => {
            const empresaNombre = u.tenants ? u.tenants.name : 'Sin Empresa';
            return `
                <tr>
                    <td><strong>${u.username}</strong></td>
                    <td>${empresaNombre}</td>
                    <td><code>Rol: ${u.role_id ? u.role_id.substring(0, 8) + '...' : 'N/A'}</code></td>
                    <td style="text-align: center; display: flex; gap: 6px; justify-content: center;">
                        <button type="button" class="btn-secondary" style="padding: 3px 8px; font-size: 0.75rem;" onclick="openEditUserModal('${u.id}', '${u.username}', '${u.tenant_id}')">Editar</button>
                        <button type="button" class="btn-secondary" style="padding: 3px 8px; font-size: 0.75rem; background: #fee2e2; color: #991b1b;" onclick="handleDeleteUser('${u.id}', '${u.username}')">Eliminar</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Error al listar usuarios:', err);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center">Error al cargar la lista de usuarios.</td></tr>`;
    }
}

async function openEditUserModal(userId, username, tenantId) {
    const modal = document.getElementById('edit-user-modal');
    if (!modal) return;
    document.getElementById('edit-user-id').value = userId;
    document.getElementById('edit-user-email').value = username;
    document.getElementById('edit-user-password').value = '';
    const selectCompany = document.getElementById('edit-user-company');
    try {
        const { data: tenants } = await supabaseClient.from('tenants').select('id, name');
        if (tenants) {
            selectCompany.innerHTML = tenants.map(t => 
                `<option value="${t.id}" ${t.id === tenantId ? 'selected' : ''}>${t.name}</option>`
            ).join('');
        }
    } catch (e) {
        console.error('Error al cargar empresas para editar:', e);
    }
    modal.classList.remove('hidden');
}

async function handleUpdateUser(e) {
    e.preventDefault();
    const userId = document.getElementById('edit-user-id').value;
    const newEmail = document.getElementById('edit-user-email').value.trim();
    const newPassword = document.getElementById('edit-user-password').value.trim();
    const newTenantId = document.getElementById('edit-user-company').value;
    try {
        const updateData = { username: newEmail, tenant_id: newTenantId };
        if (newPassword) updateData.password = newPassword;
        
        const { error: updateError } = await supabaseClient.from('users').update(updateData).eq('id', userId);
        if (updateError) throw updateError;
        
        alert('Usuario actualizado con exito!');
        document.getElementById('edit-user-modal').classList.add('hidden');
        loadAdminUsersList();
    } catch (err) {
        console.error('Error al actualizar usuario:', err);
        alert('Error al actualizar: ' + err.message);
    }
}

async function handleDeleteUser(userId, username) {
    if (!confirm(`Esta completamente seguro de eliminar al usuario "${username}"? Esta accion no se puede deshacer.`)) return;
    try {
        const { error } = await supabaseClient.from('users').delete().eq('id', userId);
        if (error) throw error;
        alert(`Usuario ${username} eliminado correctamente.`);
        loadAdminUsersList();
    } catch (err) {
        console.error('Error al eliminar usuario:', err);
        alert('No se pudo eliminar el usuario: ' + err.message);
    }
}