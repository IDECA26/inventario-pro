/**
 ============================================================
 ARCHIVO: app.js
 DESCRIPCION: Cliente Frontend Puro conectado a Supabase
 ============================================================
 */

const SUPABASE_URL = 'https://xqisaqjswazjawzeguuj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxaXNhcWpzd2F6amF3emVndXVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxODE1MjQsImV4cCI6MjEwMTc1NzUyNH0.TGegMa4OXGN45MqHpKMbNQk0kGiKTGIdmwLQvCelvCA';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
    user: JSON.parse(localStorage.getItem('inventory_user') || 'null')
};

const elements = {
    loginScreen: document.getElementById('login-screen'),
    dashboardScreen: document.getElementById('dashboard-screen'),
    loginForm: document.getElementById('login-form'),
    loginAlert: document.getElementById('login-alert'),
    loginBtn: document.getElementById('login-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    userDisplayName: document.getElementById('user-display-name'),
    searchInput: document.getElementById('search-input'),
    scanBtn: document.getElementById('scan-btn'),
    productList: document.getElementById('product-list'),
    loadingIndicator: document.getElementById('loading-indicator')
};

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

function setupEventListeners() {
    elements.loginForm.addEventListener('submit', handleLogin);
    elements.logoutBtn.addEventListener('click', handleLogout);
    elements.searchInput.addEventListener('input', debounce(handleSearch, 400));
    elements.scanBtn.addEventListener('click', () => alert('Escaner: Proximamente'));
}

function checkAuth() {
    if (state.user) {
        showDashboard();
    } else {
        showLogin();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    setLoading(true, 'login-btn', 'Ingresando...');
    hideAlert();
    
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('is_active', true)
            .single();

        if (error || !data) {
            throw new Error('Usuario o contrasena incorrectos');
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

function handleLogout() {
    state.user = null;
    localStorage.removeItem('inventory_user');
    showLogin();
}

function showDashboard() {
    elements.loginScreen.classList.add('hidden');
    elements.dashboardScreen.classList.remove('hidden');
    elements.userDisplayName.textContent = state.user.full_name || state.user.username;
    loadProducts();
}

function showLogin() {
    elements.dashboardScreen.classList.add('hidden');
    elements.loginScreen.classList.remove('hidden');
    elements.loginForm.reset();
}

async function loadProducts(searchTerm = '') {
    elements.productList.innerHTML = '';
    elements.loadingIndicator.classList.remove('hidden');
    
    try {
        let query = supabaseClient
            .from('products')
            .select('*')
            .eq('is_active', true)
            .limit(50);

        if (state.user.role_id !== 'role_presidente') {
            query = query.eq('tenant_id', state.user.tenant_id);
        }

        if (searchTerm) {
            query = query.or(`name.ilike.%${searchTerm}%,barcode.ilike.%${searchTerm}%,manual_code.ilike.%${searchTerm}%`);
        }

        const { data, error } = await query;

        if (error) throw error;
        renderProducts(data || []);
    } catch (error) {
        elements.productList.innerHTML = `<div class="alert alert-error">Error al cargar productos: ${error.message}</div>`;
    } finally {
        elements.loadingIndicator.classList.add('hidden');
    }
}

function renderProducts(products) {
    if (!products || products.length === 0) {
        elements.productList.innerHTML = '<div class="loading">No se encontraron productos.</div>';
        return;
    }
    elements.productList.innerHTML = products.map(product => `
        <div class="product-card">
            <div class="product-info">
                <h3>${product.name}</h3>
                <p>Cod: ${product.barcode || product.manual_code || 'Sin codigo'} | Stock: <strong>${product.stock}</strong> ${product.unit || 'unidades'}</p>
            </div>
            <div class="product-stock">
                <div class="stock-number">${product.stock}</div>
                <div class="stock-label">${product.sale_price ? '$' + product.sale_price : 'General'}</div>
            </div>
        </div>
    `).join('');
}

function handleSearch(e) {
    loadProducts(e.target.value.trim());
}

function showAlert(message, type = 'error') {
    elements.loginAlert.textContent = message;
    elements.loginAlert.className = `alert alert-${type}`;
    elements.loginAlert.classList.remove('hidden');
}

function hideAlert() {
    elements.loginAlert.classList.add('hidden');
}

function setLoading(isLoading, btnId, defaultText) {
    const btn = document.getElementById(btnId);
    if (isLoading) {
        btn.disabled = true;
        btn.textContent = 'Procesando...';
    } else {
        btn.disabled = false;
        btn.textContent = defaultText;
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}