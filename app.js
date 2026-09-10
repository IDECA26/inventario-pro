// --- CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = 'https://xqisaqjswazjawzeguuj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxaXNhcWpzd2F6amF3emVndXVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxODE1MjQsImV4cCI6MjEwMTc1NzUyNH0.TGegMa4OXGN45MqHpKMbNQk0kGiKTGIdmwLQvCelvCA';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let state = {
    user: null,
    products: []
};

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

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

    // Botón para abrir el panel de administración
    const adminBtn = document.getElementById('admin-panel-btn');
    if (adminBtn) {
        adminBtn.addEventListener('click', () => {
            document.getElementById('admin-modal').classList.remove('hidden');
            cargarEmpresasEnSelect();
            cargarRolesEnSelect(); // Cargamos dinámicamente los roles al abrir el modal[cite: 1]
            loadGlobalStatsAndAudit(); // Cargamos estadísticas y auditoría global
        });
    }

    // Botón para cerrar el modal de administración
    const closeModalBtn = document.getElementById('close-modal-btn');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            document.getElementById('admin-modal').classList.add('hidden');
        });
    }

    // Formularios del panel de administración
    const createCompanyForm = document.getElementById('create-company-form');
    if (createCompanyForm) createCompanyForm.addEventListener('submit', handleCreateCompany);

    const createUserForm = document.getElementById('create-user-form');
    if (createUserForm) createUserForm.addEventListener('submit', handleCreateUser);

    // Comprobar sesión activa nativa
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            state.user = session.user;
            showDashboard();
        }
    });
});

// --- LOGIN NATIVO DE SUPABASE ---
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
        showAlert('Correo o contraseña incorrectos', 'error');
    } finally {
        setLoadingLogin(false, 'Ingresar');
    }
}

// --- LOGOUT NATIVO ---
async function handleLogout() {
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
    const adminBtn = document.getElementById('admin-panel-btn');

    if (state.user) {
        const isSuperAdmin = state.user.email === 'altuna.g1@gmail.com';
        if (nameDisplay) {
            nameDisplay.textContent = state.user.email + (isSuperAdmin ? ' (SuperAdmin Global)' : '');
        }
        
        // Mostrar botón de administración solo si es el superadmin
        if (adminBtn) {
            if (isSuperAdmin) {
                adminBtn.classList.remove('hidden');
            } else {
                adminBtn.classList.add('hidden');
            }
        }
    }

    await loadProducts();
}

// --- CARGAR PRODUCTOS ---
async function loadProducts() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) loadingIndicator.classList.remove('hidden');

    try {
        let query = supabaseClient.from('products').select('*');

        if (state.user && state.user.email !== 'altuna.g1@gmail.com') {
            const { data: userData, error: userError } = await supabaseClient
                .from('users')
                .select('tenant_id')
                .eq('id', state.user.id)
                .maybeSingle();

            if (userError || !userData || !userData.tenant_id) {
                throw new Error('El usuario no está asociado a ninguna empresa.');
            }

            query = query.eq('tenant_id', userData.tenant_id);
        }

        const { data, error } = await query;
        if (error) throw error;

        state.products = data || [];
        renderProducts(state.products);
    } catch (error) {
        console.error('Error al cargar productos:', error.message);
        showAlert('Error al cargar la lista de productos', 'error');
    } finally {
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
    }
}

// --- FUNCIONES DE ADMINISTRACIÓN ---

// 1. Crear una nueva empresa en la tabla 'tenants'
async function handleCreateCompany(e) {
    e.preventDefault();
    const nameInput = document.getElementById('company-name');
    const companyName = nameInput.value.trim();

    try {
        const { data, error } = await supabaseClient
            .from('tenants')
            .insert([{ name: companyName }])
            .select();

        if (error) throw error;

        alert(`¡Empresa "${companyName}" creada con éxito!`);
        nameInput.value = '';
        cargarEmpresasEnSelect();
    } catch (error) {
        alert('Error al crear la empresa: ' + error.message);
    }
}

// 2. Cargar empresas desde la tabla 'tenants' para el select
async function cargarEmpresasEnSelect() {
    const select = document.getElementById('company-select');
    if (!select) return;

    try {
        select.innerHTML = `<option value="">Cargando empresas...</option>`;
        
        const { data, error } = await supabaseClient
            .from('tenants')
            .select('id, name');
            
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

// 3. Cargar roles desde la tabla 'roles' para el select correspondiente
async function cargarRolesEnSelect() {
    const select = document.getElementById('user-role-select');
    if (!select) return;

    try {
        select.innerHTML = `<option value="">Cargando roles...</option>`;
        
        const { data, error } = await supabaseClient
            .from('roles')
            .select('id, name');
            
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

// 4. Registrar usuario vinculándolo al tenant y al rol seleccionado[cite: 1]
async function handleCreateUser(e) {
    e.preventDefault();
    const companySelect = document.getElementById('company-select');
    const roleSelect = document.getElementById('user-role-select');

    const companyId = companySelect.value;
    const selectedRoleId = roleSelect ? roleSelect.value : null;
    const email = document.getElementById('new-user-email').value.trim();
    const password = document.getElementById('new-user-password').value.trim();

    if (!companyId) {
        alert('Por favor selecciona una empresa válida de la lista.');
        return;
    }

    if (!selectedRoleId) {
        alert('Por favor selecciona un rol para el usuario.');
        return;
    }

    try {
        // 1. Creamos el usuario en Supabase Auth[cite: 1]
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
            email: email,
            password: password
        });

        if (authError) throw authError;

        const userId = authData.user ? authData.user.id : null;
        if (!userId) throw new Error('No se pudo obtener el ID del usuario autenticado.');

        // 2. Insertamos en la tabla 'users' con los datos requeridos[cite: 1]
        const { error: profileError } = await supabaseClient
            .from('users')
            .insert([{
                id: userId,
                tenant_id: companyId,
                role_id: selectedRoleId,
                username: email,
                password: password,
                full_name: email.split('@')[0]
            }]);

        if (profileError) throw profileError;

        alert(`¡Usuario ${email} registrado y vinculado a la empresa con éxito!`);
        document.getElementById('create-user-form').reset();
        document.getElementById('admin-modal').classList.add('hidden');
    } catch (error) {
        console.error("Detalle del error:", error);
        alert('Error al registrar usuario: ' + error.message);
    }
}

// 5. Cargar estadísticas globales y registros de auditoría
async function loadGlobalStatsAndAudit() {
    try {
        // Conteo de empresas (tenants)
        const { count: tenantCount, error: tenantError } = await supabaseClient
            .from('tenants')
            .select('*', { count: 'exact', head: true });
        
        if (!tenantError) {
            document.getElementById('stat-tenants').textContent = tenantCount ?? 0;
        }

        // Conteo de usuarios
        const { count: userCount, error: userError } = await supabaseClient
            .from('users')
            .select('*', { count: 'exact', head: true });
        
        if (!userError) {
            document.getElementById('stat-users').textContent = userCount ?? 0;
        }

        // Conteo de productos globales
        const { count: prodCount, error: prodError } = await supabaseClient
            .from('products')
            .select('*', { count: 'exact', head: true });
        
        if (!prodError) {
            document.getElementById('stat-products').textContent = prodCount ?? 0;
        }

        // Cargar últimos registros de auditoría
        const { data: auditData, error: auditError } = await supabaseClient
            .from('audit_logs')
            .select('created_at, action, entity_type')
            .order('created_at', { ascending: false })
            .limit(10);

        const auditTableBody = document.getElementById('audit-log-body');
        if (!auditTableBody) return;

        if (auditError || !auditData || auditData.length === 0) {
            auditTableBody.innerHTML = `<tr><td colspan="3" class="text-center">No hay registros de auditoría recientes.</td></tr>`;
            return;
        }

        auditTableBody.innerHTML = auditData.map(log => {
            const fechaFormateada = log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A';
            return `
                <tr>
                    <td>${fechaFormateada}</td>
                    <td><span class="badge">${log.action || 'ACCION'}</span></td>
                    <td>${log.entity_type || 'General'}</td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error al cargar estadísticas y auditoría:', error);
    }
}

// --- RENDERIZAR PRODUCTOS Y UTILIDADES ---
function renderProducts(productsToRender) {
    const container = document.getElementById('product-list');
    if (!container) return;

    if (!productsToRender || productsToRender.length === 0) {
        container.innerHTML = `<p class="no-products">No se encontraron empresas/productos para mostrar.</p>`;
        return;
    }

    container.innerHTML = productsToRender.map(prod => `
        <div class="product-card">
            <h3>${prod.name || 'Sin nombre'}</h3>
            <p><strong>Código:</strong> ${prod.code || prod.manual_code || prod.barcode || 'N/A'}</p>
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

// --- MÓDULO DE INGRESO PRO ---

document.addEventListener('DOMContentLoaded', () => {
    const searchMasterBtn = document.getElementById('search-master-btn');
    if (searchMasterBtn) {
        searchMasterBtn.addEventListener('click', handleSearchMasterProduct);
    }

    const ingressForm = document.getElementById('ingress-form');
    if (ingressForm) {
        ingressForm.addEventListener('submit', handleIngressMercancia);
    }
});

// 1. Buscar en el Catálogo Maestro Global al introducir el código
async function handleSearchMasterProduct() {
    const codeInput = document.getElementById('ingress-code');
    const code = codeInput.value.trim();

    if (!code) {
        alert('Por favor introduce un código para buscar.');
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('products')
            .select('*')
            .or(`code.eq.${code},barcode.eq.${code}`)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            // El producto ya existe en el índice maestro, autocompletamos
            document.getElementById('ingress-name').value = data.name || '';
            document.getElementById('ingress-price').value = data.sale_price || 0;
            document.getElementById('factor-box').value = data.box_factor || 1;
            document.getElementById('factor-pack').value = data.pack_factor || 1;
            document.getElementById('factor-bale').value = data.bale_factor || 1;
            alert('¡Producto encontrado en el Catálogo Maestro!');
        } else {
            alert('El producto no existe en el índice global. Puedes registrarlo llenando los datos y se creará automáticamente.');
        }
    } catch (error) {
        console.error('Error al buscar producto maestro:', error);
    }
}

// 2. Registrar el ingreso aplicando factores de conversión automáticos
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

    // Calcular el total de unidades reales a sumar según el empaque seleccionado
    let totalUnitsToAdd = qtyEntered;
    if (packagingUnit === 'caja') totalUnitsToAdd = qtyEntered * boxFactor;
    else if (packagingUnit === 'paquete') totalUnitsToAdd = qtyEntered * packFactor;
    else if (packagingUnit === 'bulto') totalUnitsToAdd = qtyEntered * baleFactor;

    try {
        // Obtener el tenant_id del usuario actual si no es superadmin
        let tenantId = null;
        if (state.user.email !== 'altuna.g1@gmail.com') {
            const { data: userData } = await supabaseClient
                .from('users')
                .select('tenant_id')
                .eq('id', state.user.id)
                .single();
            if (userData) tenantId = userData.tenant_id;
        } else {
            // Si es superadmin operando, requerimos un tenant o se asigna al primero por defecto
            const { data: tenants } = await supabaseClient.from('tenants').select('id').limit(1).single();
            if (tenants) tenantId = tenants.id;
        }

        if (!tenantId) throw new Error('No se pudo determinar la empresa (tenant) para registrar el stock.');

        // 1. Verificar si el producto ya existe globalmente
        let { data: existingProd } = await supabaseClient
            .from('products')
            .select('*')
            .or(`code.eq.${code},barcode.eq.${code}`)
            .maybeSingle();

        let productId;

        if (existingProd) {
            productId = existingProd.id;
            // Actualizar factores por si cambiaron
            await supabaseClient.from('products').update({
                box_factor: boxFactor,
                pack_factor: packFactor,
                bale_factor: baleFactor,
                sale_price: price
            }).eq('id', productId);
        } else {
            // Crear el producto en el Catálogo Maestro Global
            productId = crypto.randomUUID();
            const { error: insertProdError } = await supabaseClient
                .from('products')
                .insert([{
                    id: productId,
                    tenant_id: tenantId, // Vinculación inicial
                    code: code,
                    barcode: code,
                    name: name,
                    sale_price: price,
                    box_factor: boxFactor,
                    pack_factor: packFactor,
                    bale_factor: baleFactor,
                    stock: 0 // Se gestionará por empresa
                }]);
            if (insertProdError) throw insertProdError;
        }

        // 2. Actualizar el stock sumando las unidades convertidas para este tenant
        // Buscamos el stock actual del producto para esta empresa
        const currentStock = existingProd && existingProd.stock ? parseFloat(existingProd.stock) : 0;
        const newStock = currentStock + totalUnitsToAdd;

        const { error: updateStockError } = await supabaseClient
            .from('products')
            .update({ stock: newStock })
            .eq('id', productId);

        if (updateStockError) throw updateStockError;

        alert(`¡Ingreso exitoso! Se sumaron ${totalUnitsToAdd} unidades al inventario (Equivalente a ${qtyEntered} ${packagingUnit}(s)).`);
        document.getElementById('ingress-form').reset();
        loadProducts(); // Recargar la lista visual de inventario
    } catch (error) {
        console.error('Error en el ingreso de mercancía:', error);
        alert('Error al procesar el ingreso: ' + error.message);
    }
}
