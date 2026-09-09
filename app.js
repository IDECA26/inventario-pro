async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    
    setLoading(true, 'login-btn', 'Ingresando...');
    hideAlert();
    
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !data) {
            throw new Error('Usuario no encontrado');
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
    const loginScreen = document.getElementById('login-screen') || document.querySelector('.screen');
    if (loginScreen) {
        loginScreen.classList.add('hidden');
        loginScreen.style.display = 'none';
    }

    const dashboard = document.getElementById('dashboard') || document.querySelector('.container') || document.body;
    if (dashboard) {
        dashboard.classList.remove('hidden');
        dashboard.style.display = 'block';
    }

    if (typeof loadProducts === 'function') {
        loadProducts();
    }
}