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
    const emailInput = document.getElementById('username'); // Usamos el input de usuario como email
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
        nameDisplay.textContent = state.user.email;
    }

    await loadProducts();
}

async function loadProducts() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) loadingIndicator.classList.remove('hidden');

    try {
        const { data, error } = await supabaseClient.from('products').select('*');

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
