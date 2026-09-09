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

async function handleCreateCompany(e) {
    e.preventDefault();
    const nameInput = document.getElementById('company-name');
    const companyName = nameInput.value.trim();

    try {
        const tenantId = crypto.randomUUID();

        const { error } = await supabaseClient
            .from('companies')
            .insert([{ id: tenantId, name: companyName }]);

        if (error) throw error;

        alert(`¡Empresa "${companyName}" creada con éxito!`);
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
        
        const { data, error } = await supabaseClient.from('companies').select('id, name');
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

async function handleCreateUser(e) {
    e.preventDefault();
    const companyId = document.getElementById('company-select').value;
    const email = document.getElementById('new-user-email').value.trim();
    const password = document.getElementById('new-user-password').value.trim();

    if (!companyId) {
        alert('Por favor selecciona una empresa válida.');
        return;
    }

    try {
        const userId = crypto.randomUUID();

        // Insertamos el usuario asegurando que el tenant_id coincida exactamente con el seleccionado
        const { error: profileError } = await supabaseClient
            .from('users')
            .insert([{
                id: userId,
                tenant_id: companyId, // ID exacto de la empresa seleccionada
                role_id: '00000000-0000-0000-0000-000000000001', // Rol estándar por defecto
                username: email,
                password: password,
                full_name: email.split('@')[0]
            }]);

        if (profileError) throw profileError;

        alert(`¡Usuario ${email} registrado y vinculado a la empresa con éxito!`);
        document.getElementById('create-user-form').reset();
        document.getElementById('admin-modal').classList.add('hidden');
    } catch (error) {
        alert('Error al registrar usuario en la base de datos: ' + error.message);
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
