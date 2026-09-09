// Configuración de Supabase (ajusta con tus credenciales si es necesario)
const SUPABASE_URL = 'https://xqisaqjswazjawzeguuj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxaXNhcWpzd2F6amF3emVndXVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxODE1MjQsImV4cCI6MjEwMTc1NzUyNH0.TGegMa4OXGN45MqHpKMbNQk0kGiKTGIdmwLQvCelvCA';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let state = {
    user: null,
    products: []
};

document.addEventListener('DOMContentLoaded', () => {
    // Verificar si ya hay sesión guardada
    const savedUser = localStorage.getItem('inventory_user');
    if (savedUser) {
        state.user = JSON.parse(savedUser);
        showDashboard();
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    
    setLoading(true, 'login-btn', 'Ingresando...');
    hideAlert();
    
    try {
        // Consulta directa y limpia a la tabla users
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password', password) // Valida usuario y contraseña directo
            .single();

        if (error || !data) {
            throw new Error('Usuario o contraseña incorrectos');
        }

        state.user = {
            id: data.id,
            username: data.username,
            full_name: data.full_name,
            tenant_id: data.tenant_id,
            role_id: data.role_id
        };

        localStorage.setItem('inventory_user', JSON.stringify(state.user));
        showDashboard();
    } catch (error) {
        showAlert(error.message, 'error');
    } finally {
        setLoading(false, 'login-btn', 'Ingresar');
    }
}

function showDashboard() {
    // Ocultar pantalla de login usando los IDs exactos del index.html
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) {
        loginScreen.classList.add('hidden');
        loginScreen.style.display = 'none';
    }

    // Mostrar el panel principal
    const dashboardScreen = document.getElementById('dashboard-screen');
    if (dashboardScreen) {
        dashboardScreen.classList.remove('hidden');
        dashboardScreen.style.display = 'block';
    }

    // Mostrar nombre de usuario en la barra superior
    const userDisplay = document.getElementById('user-display-name');
    if (userDisplay && state.user) {
        userDisplay.textContent = state.user.full_name || state.user.username;
    }

    if (typeof loadProducts === 'function') {
        loadProducts();
    }
}

function handleLogout() {
    localStorage.removeItem('inventory_user');
    state.user = null;
    window.location.reload();
}

function setLoading(isLoading, btnId, text) {
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.disabled = isLoading;
        btn.textContent = text;
    }
}

function showAlert(message, type) {
    const alertDiv = document.getElementById('login-alert');
    if (alertDiv) {
        alertDiv.textContent = message;
        alertDiv.className = `alert alert-${type}`;
        alertDiv.classList.remove('hidden');
    }
}

function hideAlert() {
    const alertDiv = document.getElementById('login-alert');
    if (alertDiv) {
        alertDiv.classList.add('hidden');
    }
}

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
    } finally {
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
    }
}

function renderProducts(products) {
    const productList = document.getElementById('product-list');
    if (!productList) return;

    productList.innerHTML = '';

    if (products.length === 0) {
        productList.innerHTML = '<p class="loading">No hay productos registrados.</p>';
        return;
    }

    products.forEach(prod => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="product-info">
                <h3>${prod.name || 'Sin nombre'}</h3>
                <p>Código: ${prod.code || 'N/A'}</p>
            </div>
            <div class="product-stock">
                <div class="stock-number">${prod.stock ?? 0}</div>
                <div class="stock-label">Stock</div>
            </div>
        `;
        productList.appendChild(card);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});
