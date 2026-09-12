// --- MÓDULO DE CONTROL Y ESTADÍSTICAS DEL DEPOSITARIO ---

document.addEventListener('DOMContentLoaded', () => {
    const tenantSearchInput = document.getElementById('tenant-search-input');
    if (tenantSearchInput) {
        tenantSearchInput.addEventListener('input', (e) => {
            renderTenantDetailedInventory(e.target.value.toLowerCase().trim());
        });
    }

    const exportTenantPdfBtn = document.getElementById('export-tenant-pdf-btn');
    if (exportTenantPdfBtn) {
        exportTenantPdfBtn.addEventListener('click', exportTenantStatsToPDF);
    }
});

async function loadTenantStats() {
    renderTenantDetailedInventory('');
}

async function renderTenantDetailedInventory(searchTerm = '') {
    const tbody = document.getElementById('tenant-detailed-stats-body');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" class="text-center">Consultando stock y movimientos del depósito...</td></tr>`;

    try {
        // 1. Obtener productos de la empresa del usuario actual
        let queryProducts = supabaseClient.from('products').select('*');
        if (state.user && state.user.email !== 'altuna.g1@gmail.com') {
            const { data: userData } = await supabaseClient
                .from('users')
                .select('tenant_id')
                .eq('username', state.user.email)
                .maybeSingle();
            
            if (userData && userData.tenant_id) {
                queryProducts = queryProducts.eq('tenant_id', userData.tenant_id);
            }
        }

        const { data: productsData, error: prodError } = await queryProducts;
        if (prodError) throw prodError;

        // 2. Obtener registros de auditoría/movimientos para cruzar vencidos y cambios
        let queryAudit = supabaseClient.from('audit_logs').select('*');
        const { data: auditData } = await queryAudit;

        let totalStockUnits = 0;
        let totalExpired = 0;
        let totalPendingChanges = 0;

        let processed = (productsData || []).map(prod => {
            const stockTotal = parseFloat(prod.stock) || 0;
            totalStockUnits += stockTotal;

            // Calcular desglose en presentaciones (Ej: Bultos / Pacas y Unidades)
            const baleFactor = parseFloat(prod.bale_factor) || 1;
            const pacas = baleFactor > 1 ? Math.floor(stockTotal / baleFactor) : 0;
            const unidadesSueltas = baleFactor > 1 ? stockTotal % baleFactor : stockTotal;
            
            let desgloseText = `${unidadesSueltas} unidades`;
            if (baleFactor > 1) {
                desgloseText = `<strong>${pacas}</strong> pacas y <strong>${unidadesSueltas}</strong> un.`;
            }

            // Contabilizar incidencias reales desde audit_logs (ej: egresos por 'dañado' o 'cambio')
            let vencidosCount = 0;
            let esperaCambioCount = 0;

            if (auditData) {
                auditData.forEach(log => {
                    const matches = log.details && (log.details.includes(prod.code) || log.details.includes(prod.name));
                    if (matches) {
                        if (log.action && log.action.toLowerCase().includes('dañado')) vencidosCount += 1;
                        if (log.action && log.action.toLowerCase().includes('cambio')) esperaCambioCount += 1;
                    }
                });
            }

            totalExpired += vencidosCount;
            totalPendingChanges += esperaCambioCount;

            return {
                ...prod,
                stockTotal,
                desgloseText,
                vencidosCount,
                esperaCambioCount
            };
        });

        // Actualizar tarjetas resumen
        document.getElementById('tenant-prod-count').textContent = processed.length;
        document.getElementById('tenant-total-stock').textContent = totalStockUnits;
        document.getElementById('tenant-expired-count').textContent = totalExpired;
        document.getElementById('tenant-pending-changes').textContent = totalPendingChanges;

        // Filtrar por búsqueda dinámica
        if (searchTerm) {
            processed = processed.filter(p => 
                (p.name && p.name.toLowerCase().includes(searchTerm)) || 
                (p.code && p.code.toLowerCase().includes(searchTerm))
            );
        }

        if (processed.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center">No se encontraron productos en este depósito.</td></tr>`;
            return;
        }

        tbody.innerHTML = processed.map(item => {
            return `
                <tr>
                    <td><code>${item.code || 'N/A'}</code></td>
                    <td><strong>${item.name}</strong></td>
                    <td>${item.desgloseText}</td>
                    <td><span style="color: #dc2626; font-weight: bold;">${item.vencidosCount} un.</span></td>
                    <td><span style="color: #d97706; font-weight: bold;">${item.esperaCambioCount} un.</span></td>
                    <td><span class="badge" style="background: #e2e8f0; color: #334155;">Activo en Almacén</span></td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error('Error al cargar estadísticas detalladas del depósito:', err);
        tbody.innerHTML = `<tr><td colspan="6" class="text-center">Error al procesar los datos del depósito.</td></tr>`;
    }
}

function exportTenantStatsToPDF() {
    if (typeof window.jspdf === 'undefined') {
        alert('Librería PDF no cargada.');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Informe de Control y Stock por Depósito", 14, 20);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha de emisión: ${new Date().toLocaleString()}`, 14, 26);

    let yPos = 35;
    const rows = document.querySelectorAll('#tenant-detailed-stats-body tr');
    
    doc.setFontSize(8);
    doc.setFillColor(240, 240, 240);
    doc.rect(14, yPos, 180, 8, 'F');
    doc.text("Código", 16, yPos + 5);
    doc.text("Producto", 45, yPos + 5);
    doc.text("Stock Desglosado", 115, yPos + 5);
    doc.text("Vencidos", 155, yPos + 5);
    doc.text("Cambios", 178, yPos + 5);

    yPos += 8;
    rows.forEach((row, idx) => {
        if (idx > 25) return;
        const cols = row.querySelectorAll('td');
        if (cols.length >= 5) {
            yPos += 6;
            doc.text(cols[0].textContent.substring(0, 15), 16, yPos);
            doc.text(cols[1].textContent.substring(0, 32), 45, yPos);
            doc.text(cols[2].textContent.replace(/<[^>]*>?/gm, '').substring(0, 25), 115, yPos);
            doc.text(cols[3].textContent, 155, yPos);
            doc.text(cols[4].textContent, 178, yPos);
        }
    });

    doc.save(`Informe_Deposito_${Date.now()}.pdf`);
}