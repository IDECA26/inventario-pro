// RUTA: inventario-pro/app.js

let state = {
    user: null,
    role: null,
    products: []
};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Inicializar autenticacion y eventos de login originales
    initAuthHandlers();
    await checkActiveSession();

    // 2. Configurar buscador inteligente de ingresos
    setupIngressAutocomplete();

    const ingressForm = document.getElementById('ingress-form');
    if (ingressForm) {
        ingressForm.addEventListener('submit', handleIngressMercancia);
    }
});

// ==========================================
// AUTENTICACION Y LOGIN ORIGINAL
// ==========================================
function initAuthHandlers() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;

            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                
                await checkActiveSession();
            } catch (err) {
                alert('Error al iniciar sesión: ' + err.message);
            }
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            state.user = null;
            state.role = null;
            document.getElementById('app').style.display = 'none';
            document.getElementById('login-container').style.display = 'flex';
        });
    }
}

async function checkActiveSession() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && session.user) {
            state.user = { email: session.user.email };
            
            // Mostrar interfaz de la app y ocultar login
            document.getElementById('login-container').style.display = 'none';
            document.getElementById('app').style.display = 'block';
            
            const emailDisplay = document.getElementById('user-display-email');
            if (emailDisplay) emailDisplay.textContent = session.user.email;

            // Determinar rol del usuario
            if (typeof determineUserRole === 'function') {
                state.role = await determineUserRole(session.user.email);
            } else {
                state.role = 'admin';
            }

            renderNavigationMenu();
            await loadProducts();
            switchTab('ingress');
        } else {
            document.getElementById('login-container').style.display = 'flex';
            document.getElementById('app').style.display = 'none';
        }
    } catch (e) {
        console.error('Error al verificar sesion:', e);
        document.getElementById('login-container').style.display = 'flex';
    }
}

// ==========================================
// NAVEGACION Y PESTAÑAS ORIGINALES
// ==========================================
function renderNavigationMenu() {
    const navContainer = document.getElementById('main-nav');
    if (!navContainer) return;

    let menuHTML = `
        <button onclick="switchTab('ingress')" class="nav-btn active" data-tab="ingress">Ingresos</button>
        <button onclick="switchTab('egress')" class="nav-btn" data-tab="egress">Egresos</button>
        <button onclick="switchTab('estadisticas')" class="nav-btn" data-tab="estadisticas">Estadísticas</button>
    `;

    if (state.role === 'depositario' || state.role === 'admin' || (state.user && state.user.email === 'altuna.g1@gmail.com')) {
        menuHTML += `<button onclick="switchTab('tenant-stats')" class="nav-btn" data-tab="tenant-stats">Depósito</button>`;
    }

    navContainer.innerHTML = menuHTML;
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(section => {
        section.style.display = 'none';
    });

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) {
        targetTab.style.display = 'block';
    }

    const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }

    if (tabName === 'estadisticas' && typeof loadEstadisticas === 'function') {
        loadEstadisticas();
    } else if (tabName === 'tenant-stats' && typeof loadTenantStats === 'function') {
        loadTenantStats();
    }
}

async function loadProducts() {
    try {
        const { data, error } = await supabaseClient.from('products').select('*');
        if (!error && data) {
            state.products = data;
        }
    } catch (err) {
        console.error('Error al cargar productos en memoria:', err);
    }
}

// ==========================================
// BUSCADOR DINAMICO INTELIGENTE (INGRESOS)
// ==========================================
function setupIngressAutocomplete() {
    const ingressCodeInput = document.getElementById('ingress-code');
    const ingressSuggestions = document.getElementById('ingress-suggestions');

    if (!ingressCodeInput || !ingressSuggestions) return;

    ingressCodeInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        if (query.length === 0) {
            ingressSuggestions.classList.add('hidden');
            ingressSuggestions.innerHTML = '';
            return;
        }

        const matches = state.products.filter(p => 
            (p.name && p.name.toLowerCase().includes(query)) || 
            (p.code && p.code.toLowerCase().includes(query)) ||
            (p.barcode && p.barcode.toLowerCase().includes(query))
        );

        if (matches.length === 0) {
            ingressSuggestions.classList.add('hidden');
            ingressSuggestions.innerHTML = '';
            return;
        }

        ingressSuggestions.innerHTML = matches.map(prod => `
            <div class="autocomplete-suggestion-item" onclick="seleccionarProductoIngreso('${prod.code || prod.barcode}', '${escapeHtml(prod.name)}', ${prod.sale_price || 0}, ${prod.box_factor || 1}, ${prod.pack_factor || 1}, ${prod.bale_factor || 1})">
                <span><strong>${prod.name}</strong></span>
                <code>${prod.code || prod.barcode || 'S/C'}</code>
            </div>
        `).join('');

        ingressSuggestions.classList.remove('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!ingressCodeInput.contains(e.target) && !ingressSuggestions.contains(e.target)) {
            ingressSuggestions.classList.add('hidden');
        }
    });
}

function seleccionarProductoIngreso(code, name, price, boxFactor, packFactor, baleFactor) {
    document.getElementById('ingress-code').value = code;
    document.getElementById('ingress-name').value = name;
    document.getElementById('ingress-price').value = price;
    document.getElementById('factor-box').value = boxFactor;
    document.getElementById('factor-pack').value = packFactor;
    document.getElementById('factor-bale').value = baleFactor;

    const ingressSuggestions = document.getElementById('ingress-suggestions');
    if (ingressSuggestions) ingressSuggestions.classList.add('hidden');
}

function escapeHtml(text) {
    if (!text) return '';
    return text.toString().replace(/'/g, "&#39;").replace(/"/g, "&quot;");
}

// ==========================================
// INGRESO CON SOPORTE OFFLINE Y CRONOLOGIA
// ==========================================
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
        if (state.user && state.user.email !== 'altuna.g1@gmail.com') {
            const { data: userData, error: userLookupError } = await supabaseClient
                .from('users')
                .select('tenant_id')
                .eq('username', state.user.email)
                .maybeSingle();

            if (userLookupError || !userData || !userData.tenant_id) {
                throw new Error('Tu usuario no tiene un tenant_id asociado en la base de datos.');
            }
            tenantId = userData.tenant_id;
        } else {
            const { data: tenants } = await supabaseClient.from('tenants').select('id').limit(1).maybeSingle();
            if (tenants) tenantId = tenants.id;
        }

        const payloadData = {
            code, name, price, boxFactor, packFactor, baleFactor, packagingUnit, qtyEntered, totalUnitsToAdd, tenantId: tenantId || null
        };

        if (!navigator.onLine) {
            guardarOperacionOffline('INGRESS_MERCANCIA', payloadData);
            document.getElementById('ingress-form').reset();
            return;
        }

        await ejecutarIngresoRemoto(payloadData);

        alert(`¡Ingreso exitoso! Se sumaron ${totalUnitsToAdd} unidades al inventario.`);
        document.getElementById('ingress-form').reset();
        loadProducts(); 

    } catch (error) {
        console.error('Error durante el ingreso:', error);
        
        if (!navigator.onLine || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            const payloadFallback = {
                code, name, price, boxFactor, packFactor, baleFactor, packagingUnit, qtyEntered, totalUnitsToAdd, tenantId: null
            };
            guardarOperacionOffline('INGRESS_MERCANCIA', payloadFallback);
            document.getElementById('ingress-form').reset();
        } else {
            alert('Error al procesar el ingreso: ' + error.message);
        }
    }
}

async function ejecutarIngresoRemoto(data) {
    const { code, name, price, boxFactor, packFactor, baleFactor, totalUnitsToAdd, tenantId } = data;

    let { data: existingProd, error: findError } = await supabaseClient
        .from('products')
        .select('*')
        .or(`code.eq.${code},barcode.eq.${code}`)
        .maybeSingle();

    if (findError) throw findError;

    let productId;

    if (existingProd) {
        productId = existingProd.id;
        await supabaseClient.from('products').update({
            box_factor: boxFactor,
            pack_factor: packFactor,
            bale_factor: baleFactor,
            sale_price: price
        }).eq('id', productId);
    } else {
        productId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
        await supabaseClient.from('products').insert([{
            id: productId,
            tenant_id: tenantId,
            code: code,
            barcode: code,
            name: name,
            sale_price: price,
            box_factor: boxFactor,
            pack_factor: packFactor,
            bale_factor: baleFactor,
            stock: 0 
        }]);
    }

    const currentStock = existingProd && existingProd.stock ? parseFloat(existingProd.stock) : 0;
    const newStock = currentStock + totalUnitsToAdd;

    const { error: updateStockError } = await supabaseClient
        .from('products')
        .update({ stock: newStock })
        .eq('id', productId);

    if (updateStockError) throw updateStockError;
}