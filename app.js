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
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

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
    const emailInput = document.getElementById('username'); // Input usado como email
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
    if (nameDisplay && state.user) {
        // Muestra el correo y un indicador si es el superadmin global
        const roleLabel = state.user.email === 'altuna.g1@gmail.com' ? ' (SuperAdmin Global)' : '';
        nameDisplay.textContent = state.user.email + roleLabel;
    }

    await loadProducts();
}

// --- CARGAR PRODUCTOS MULTI-TENANT INTELIGENTE ---
async function loadProducts() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) loadingIndicator.classList.remove('hidden');

    try {
        let query = supabaseClient.from('products').select('*');

        // REGLA DE NEGOCIO: Si NO es el superadmin, filtramos por el tenant_id de su empresa
        if (state.user && state.user.email !== 'altuna.g1@gmail.com') {
            const { data: userData, error: userError } = await supabaseClient
                .from('users')
                .select('tenant_id')
                .eq('id', state.user.id)
                .maybeSingle();

            if (userError || !userData || !userData.tenant_id) {
                throw new Error('El usuario no está asociado a ninguna empresa (tenant_id).');
            }

            query = query.eq('tenant_id', userData.tenant_id);
        }

        const { data, error } = await query;
        if (error) throw error;

        state.products = data || [];
        renderProducts(state.products);
    } catch (error) {
        console.error('Error al cargar productos:', error.message);
        showAlert('Error al cargar la lista de productos: ' + error.message, 'error');
    } finally {
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
    }
}

function renderProducts(productsToRender) {
    const container = document.getElementById('product-list');
    if (!container) return;

    if (!productsToRender || productsToRender.length === 0) {
        container.innerHTML = `<p class="no-products">No se encontraron productos.</p>`;
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
// --- FUNCIONES DE ADMINISTRACIÓN MULTI-TENANT ---

// Abrir o cerrar el modal de administración
function toggleAdminModal(show) {
    const modal = document.getElementById('admin-modal');
    if (!modal) return;
    
    if (show) {
        modal.classList.remove('hidden');
        cargarEmpresasEnSelect(); // Rellenar el select de empresas al abrir
    } else {
        modal.classList.add('hidden');
    }
}

// Escuchadores para los formularios de administración cuando carga la página
document.addEventListener('DOMContentLoaded', () => {
    // Formulario para crear empresa
    const createCompanyForm = document.getElementById('create-company-form');
    if (createCompanyForm) {
        createCompanyForm.addEventListener('submit', handleCreateCompany);
    }

    // Formulario para crear usuario vinculado
    const createUserForm = document.getElementById('create-user-form');
    if (createUserForm) {
        createUserForm.addEventListener('submit', handleCreateUser);
    }
});

// 1. Crear una nueva empresa
async function handleCreateCompany(e) {
    e.preventDefault();
    const nameInput = document.getElementById('company-name');
    const companyName = nameInput.value.trim();

    try {
        // Generamos un UUID único para el tenant de esta empresa
        const tenantId = crypto.randomUUID();

        const { error } = await supabaseClient
            .from('companies')
            .insert([{ id: tenantId, name: companyName }]);

        if (error) throw error;

        alert(`¡Empresa "${companyName}" creada con éxito! (ID/Tenant: ${tenantId})`);
        nameInput.value = '';
        cargarEmpresasEnSelect();
    } catch (error) {
        alert('Error al crear la empresa: ' + error.message);
    }
}

// 2. Cargar empresas en el elemento <select> del formulario de usuarios
async function cargarEmpresasEnSelect() {
    const select = document.getElementById('company-select');
    if (!select) return;

    try {
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
    }
}

// 3. Crear usuario y asociarlo a la empresa seleccionada
async function handleCreateUser(e) {
    e.preventDefault();
    const companyId = document.getElementById('company-select').value;
    const email = document.getElementById('new-user-email').value.trim();
    const password = document.getElementById('new-user-password').value.trim();

    if (!companyId) {
        alert('Por favor selecciona una empresa.');
        return;
    }

    try {
        // Nota: La creación de usuarios en Supabase Auth se realiza de forma segura.
        // Como estamos desde el cliente, usamos signUp o insertamos en la tabla users directamente si el usuario ya fue autenticado.
        // Idealmente, guardamos la relación en la tabla public.users vinculando su tenant_id.
        
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
            email: email,
            password: password
        });

        if (authError) throw authError;

        const userId = authData.user ? authData.user.id : null;

        if (userId) {
            // Guardamos el registro en la tabla public.users amarrado a su tenant_id
            const { error: profileError } = await supabaseClient
                .from('users')
                .upsert([{
                    id: userId,
                    tenant_id: companyId,
                    username: email,
                    full_name: email.split('@')[0]
                }]);

            if (profileError) throw profileError;
        }

        alert(`¡Usuario ${email} registrado y vinculado a la empresa exitosamente!`);
        document.getElementById('create-user-form').reset();
    } catch (error) {
        alert('Error al registrar usuario: ' + error.message);
    }
}
