// --- CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = 'https://xqisaqjswazjawzeguuj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxaXNhcWpzd2F6amF3emVndXVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxODE1MjQsImV4cCI6MjEwMTc1NzUyNH0.TGegMa4OXGN45MqHpKMbNQk0kGiKTGIdmwLQvCelvCA';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ESTADO GLOBAL DE LA APLICACIÓN ---
let state = {
    user: null,
    products: []
};

// --- INICIALIZACIÓN AL CARGAR LA PÁGINA ---
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

    const savedUser = localStorage.getItem('inventory_user');
    if (savedUser) {
        try {
            state.user = JSON.parse(savedUser);
            showDashboard();
        } catch (e) {
            localStorage.removeItem('inventory_user');
        }
    }
});

// --- FUNCIÓN DE LOGIN ---
async function handleLogin(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    setLoadingLogin(true, 'Ingresando...');
    hideAlert();
    
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .maybeSingle(); // Usamos maybeSingle para evitar excepciones si no coincide exacto

        if (error) {
            throw new Error(error.message);
        }

        if (!data) {
            throw new Error('Usuario o contraseña incorrectos');
        }

        state.user = {
            id: data.id,
            username: data.username,
            full_name: data.full_name || data.username,
            tenant_id: data.tenant_id
        };

        localStorage.setItem('inventory_user', JSON.stringify(state.user));
        showDashboard();
    } catch (error) {
        showAlert(error.message, 'error');
    } finally {
        setLoadingLogin(false, 'Ingresar');
    }
}

// --- FUNCIÓN DE LOGOUT ---
function handleLogout() {
    state.user = null;
    state.products = [];
    localStorage.removeItem('inventory_user');
    
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.reset();

    document.getElementById('dashboard-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
}

// --- CAMBIAR A VISTA DE DASHBOARD ---
async function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
    
    const nameDisplay = document.getElementById('user-display-name');
    if (nameDisplay && state.user) {
        nameDisplay.textContent = state.user.full_name || state.user.username;
    }

    await loadProducts();
}

// --- CARGAR PRODUCTOS DESDE SUPABASE ---
async function loadProducts() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) loadingIndicator.classList.remove('hidden');

    try {
        let query = supabaseClient.from('products').select('*');
        
        if (state.user && state.user.tenant_id) {
            query = query.eq('tenant_id', state.user.tenant_id);
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

// --- RENDERIZAR PRODUCTOS ---
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
            <p><strong>Código:</strong> ${prod.code || 'N/A'}</p>
            <p><strong>Stock:</strong> ${prod.stock ?? prod.quantity ?? 0}</p>
            <p><strong>Precio:</strong> $${prod.price ?? 0.00}</p>
        </div>
    `).join('');
}

// --- UTILIDADES ---
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
