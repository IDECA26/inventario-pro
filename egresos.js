// --- MÓDULO MODULAR DE EGRESOS Y DESPACHOS ---

document.addEventListener('DOMContentLoaded', () => {
    const searchEgressBtn = document.getElementById('search-egress-prod-btn');
    if (searchEgressBtn) {
        searchEgressBtn.addEventListener('click', handleSearchEgressProduct);
    }

    const scanEgressBtn = document.getElementById('scan-egress-btn');
    const cameraInputEgress = document.getElementById('camera-input-egress');
    if (scanEgressBtn && cameraInputEgress) {
        scanEgressBtn.addEventListener('click', () => cameraInputEgress.click());
        cameraInputEgress.addEventListener('change', (e) => handleEgressCameraScan(e));
    }

    const egressForm = document.getElementById('egress-form');
    if (egressForm) {
        egressForm.addEventListener('submit', handleProcessEgress);
    }
});

// 1. Buscar producto para egreso por código
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

        // Buscamos el producto que pertenezca al tenant y coincida con el código o barras
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
            // Guardamos factores temporalmente en el formulario para cálculos
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

// 2. Escáner de cámara nativo específico para el módulo de egresos
function handleEgressCameraScan(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, img.width, img.height);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);

            if (code) {
                document.getElementById('egress-code').value = code.data;
                handleSearchEgressProduct();
            } else {
                alert('No se pudo detectar un código legible en la imagen.');
            }
            event.target.value = '';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// 3. Procesar el egreso y descontar stock de forma segura
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

    // Calcular el total de unidades reales a descontar según el empaque
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

        // Actualizar el stock en la base de datos
        const { error: updateError } = await supabaseClient
            .from('products')
            .update({ stock: newStock })
            .eq('id', productId);

        if (updateError) throw updateError;

        // Registrar auditoría o movimiento si aplica
        alert(`¡Despacho exitoso (${egressType.toUpperCase()})! Se descontaron ${totalUnitsToSubtract} unidades del inventario.`);
        
        form.reset();
        clearEgressFormFields();
        if (typeof loadProducts === 'function') loadProducts(); // Refrescar vista general
    } catch (error) {
        console.error('Error al procesar el egreso:', error);
        alert('Error al procesar el egreso: ' + error.message);
    }
}

function clearEgressFormFields() {
    document.getElementById('egress-product-name').value = '';
    document.getElementById('egress-current-stock').value = '0';
    const form = document.getElementById('egress-form');
    delete form.dataset.productId;
}

// Utilidad auxiliar para obtener el tenant_id del usuario logueado
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