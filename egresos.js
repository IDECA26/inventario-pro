document.addEventListener('DOMContentLoaded', () => {
    const egressForm = document.getElementById('egress-form');
    if (egressForm) {
        egressForm.addEventListener('submit', handleEgressMercancia);
    }

    // Configurar autocompletado dinamico y busqueda en Egresos
    setupEgressAutocomplete();
});

// ==========================================
// BUSCADOR DINAMICO INTELIGENTE (EGRESOS)
// ==========================================
function setupEgressAutocomplete() {
    const egressCodeInput = document.getElementById('egress-code');
    let egressSuggestions = document.getElementById('egress-suggestions');

    if (!egressCodeInput || !egressSuggestions) return;

    egressCodeInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        if (query.length === 0) {
            egressSuggestions.classList.add('hidden');
            egressSuggestions.innerHTML = '';
            return;
        }

        // Filtro dinamico sobre state.products
        const matches = state.products.filter(p => 
            (p.name && p.name.toLowerCase().includes(query)) || 
            (p.code && p.code.toLowerCase().includes(query)) ||
            (p.barcode && p.barcode.toLowerCase().includes(query))
        );

        if (matches.length === 0) {
            egressSuggestions.classList.add('hidden');
            egressSuggestions.innerHTML = '';
            return;
        }

        egressSuggestions.innerHTML = matches.map(prod => `
            <div class="autocomplete-suggestion-item" onclick="seleccionarProductoEgreso('${prod.code || prod.barcode}', '${escapeHtml(prod.name)}', ${prod.stock || 0}, '${prod.id}', ${prod.box_factor || 1}, ${prod.pack_factor || 1}, ${prod.bale_factor || 1})">
                <span><strong>${prod.name}</strong> (Stock: ${prod.stock || 0})</span>
                <code>${prod.code || prod.barcode || 'S/C'}</code>
            </div>
        `).join('');

        egressSuggestions.classList.remove('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!egressCodeInput.contains(e.target) && !egressSuggestions.contains(e.target)) {
            egressSuggestions.classList.add('hidden');
        }
    });
}

function seleccionarProductoEgreso(code, name, stock, productId, boxFactor, packFactor, baleFactor) {
    document.getElementById('egress-code').value = code;
    document.getElementById('egress-product-name').value = name;
    document.getElementById('egress-current-stock').value = stock;

    const form = document.getElementById('egress-form');
    if (form) {
        form.dataset.productId = productId;
        form.dataset.boxFactor = boxFactor;
        form.dataset.packFactor = packFactor;
        form.dataset.baleFactor = baleFactor;
    }

    const egressSuggestions = document.getElementById('egress-suggestions');
    if (egressSuggestions) egressSuggestions.classList.add('hidden');
}

async function handleEgressMercancia(e) {
    e.preventDefault();
    const form = document.getElementById('egress-form');
    const productId = form.dataset.productId;
    const qtyEgress = parseFloat(document.getElementById('egress-quantity').value) || 0;
    const currentStock = parseFloat(document.getElementById('egress-current-stock').value) || 0;

    if (!productId) {
        alert('Por favor seleccione un producto válido de las sugerencias o mediante el buscador.');
        return;
    }

    if (qtyEgress <= 0) {
        alert('La cantidad a egresar debe ser mayor a cero.');
        return;
    }

    if (qtyEgress > currentStock) {
        alert('No hay suficiente stock disponible para este egreso.');
        return;
    }

    try {
        const newStock = currentStock - qtyEgress;
        const { error } = await supabaseClient
            .from('products')
            .update({ stock: newStock })
            .eq('id', productId);

        if (error) throw error;

        alert('¡Egreso procesado exitosamente!');
        form.reset();
        delete form.dataset.productId;
        loadProducts();
    } catch (err) {
        console.error('Error al procesar egreso:', err);
        alert('Error al registrar el egreso: ' + err.message);
    }
}