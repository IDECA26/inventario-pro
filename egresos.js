// --- MÓDULO MODULAR DE EGRESOS Y DESPACHOS (CON HÍBRIDO DE CÁMARA) ---

document.addEventListener('DOMContentLoaded', () => {
    const searchEgressBtn = document.getElementById('search-egress-prod-btn');
    if (searchEgressBtn) {
        searchEgressBtn.addEventListener('click', handleSearchEgressProduct);
    }

    const scanEgressBtn = document.getElementById('scan-egress-btn');
    const egressCodeInput = document.getElementById('egress-code');

    if (scanEgressBtn && egressCodeInput) {
        scanEgressBtn.addEventListener('click', () => {
            const val = egressCodeInput.value.trim();
            if (val === '') {
                openEgressScanner();
            } else {
                handleSearchEgressProduct();
            }
        });
    }

    const egressForm = document.getElementById('egress-form');
    if (egressForm) {
        egressForm.addEventListener('submit', handleProcessEgress);
    }
});

function openEgressScanner() {
    activeScannerTarget = 'egress';
    const modal = document.getElementById('scanner-modal');
    if (modal) modal.classList.remove('hidden');

    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }

    const config = { fps: 10, qrbox: { width: 250, height: 150 } };

    html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        onEgressScanSuccess, 
        (err) => {}
    ).catch(err => {
        console.error("Error al iniciar la cámara:", err);
        alert("No se pudo acceder a la cámara.");
        closeScanner();
    });
}

async function onEgressScanSuccess(decodedText, decodedResult) {
    closeScanner();
    const codeInput = document.getElementById('egress-code');
    if (codeInput) {
        codeInput.value = decodedText;
        await handleSearchEgressProduct();
    }
}

async function handleSearchEgressProduct() {
    const codeInput = document.getElementById('egress-code');
    const code = codeInput.value.trim();

    if (!code) {
        alert('Por favor introduce un código para buscar.');
        return;
    }

    try {
        let tenantId = await getCurrentTenantId();
        if (!tenantId) return;

        const { data, error } = await supabaseClient
            .from('products')
            .select('*')
            .eq('tenant_id', tenantId)
            .or(`code.eq.${code},barcode.eq.${code}`)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            document.getElementById('egress-product-name').value = data.name || 'Sin nombre';
            document.getElementById('egress-current-stock').value = data.stock ?? 0;
            document.getElementById('egress-form').dataset.productId = data.id;
            document.getElementById('egress-form').dataset.boxFactor = data.box_factor || 1;
            document.getElementById('egress-form').dataset.packFactor = data.pack_factor || 1;
            document.getElementById('egress-form').dataset.baleFactor = data.bale_factor || 1;
            alert('¡Producto cargado para despacho con éxito!');
        } else {
            alert('No se encontró este producto en el inventario de tu empresa.');
            clearEgressFormFields();
        }
    } catch (error) {
        console.error('Error al buscar producto para egreso:', error);
        alert('Error al buscar el producto.');
    }
}

async function handleProcessEgress(e) {
    e.preventDefault();

    const form = document.getElementById('egress-form');
    const productId = form.dataset.productId;
    const currentStock = parseFloat(document.getElementById('egress-current-stock').value) || 0;
    
    if (!productId) {
        alert('Primero debes buscar y seleccionar un producto válido.');
        return;
    }

    const packagingUnit = document.getElementById('egress-packaging-unit').value;
    const qtyEntered = parseFloat(document.getElementById('egress-quantity').value) || 0;
    const egressType = document.getElementById('egress-type').value;

    const boxFactor = parseFloat(form.dataset.boxFactor) || 1;
    const packFactor = parseFloat(form.dataset.packFactor) || 1;
    const baleFactor = parseFloat(form.dataset.baleFactor) || 1;

    let totalUnitsToSubtract = qtyEntered;
    if (packagingUnit === 'caja') totalUnitsToSubtract = qtyEntered * boxFactor;
    else if (packagingUnit === 'paquete') totalUnitsToSubtract = qtyEntered * packFactor;
    else if (packagingUnit === 'bulto') totalUnitsToSubtract = qtyEntered * baleFactor;

    if (totalUnitsToSubtract > currentStock) {
        alert(`Stock insuficiente. Intentas despachar ${totalUnitsToSubtract} unidades, pero el stock actual es de ${currentStock}.`);
        return;
    }

    try {
        const newStock = currentStock - totalUnitsToSubtract;

        const { error: updateError } = await supabaseClient
            .from('products')
            .update({ stock: newStock })
            .eq('id', productId);

        if (updateError) throw updateError;

        alert(`¡Despacho exitoso (${egressType.toUpperCase()})! Se descontaron ${totalUnitsToSubtract} unidades del inventario.`);
        
        form.reset();
        clearEgressFormFields();
        if (typeof loadProducts === 'function') loadProducts();
    } catch (error) {
        console.error('Error al procesar el egreso:', error);
        alert('Error al procesar el egreso: ' + error.message);
    }
}

function clearEgressFormFields() {
    document.getElementById('egress-product-name').value = '';
    document.getElementById('egress-current-stock').value = '0';
    const form = document.getElementById('egress-form');
    if (form) {
        delete form.dataset.productId;
    }
}

async function getCurrentTenantId() {
    if (state.user.email === 'altuna.g1@gmail.com') {
        const { data: tenants } = await supabaseClient.from('tenants').select('id').limit(1).maybeSingle();
        return tenants ? tenants.id : null;
    }

    const { data: userData, error } = await supabaseClient
        .from('users')
        .select('tenant_id')
        .eq('username', state.user.email)
        .maybeSingle();

    if (error || !userData) {
        alert('No se pudo determinar la empresa del usuario.');
        return null;
    }
    return userData.tenant_id;
}