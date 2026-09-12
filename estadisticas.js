// --- MÓDULO MODULAR DE ANALÍTICA Y ESTADÍSTICAS PRO (CON BÚSQUEDA DINÁMICA) ---

let myStatsChart = null;
let allAvailableProductsForStats = []; // Almacén local para filtrado instantáneo

document.addEventListener('DOMContentLoaded', () => {
    const scopeSelect = document.getElementById('stats-scope');
    const tenantFilterContainer = document.getElementById('tenant-filter-container');
    
    if (tenantFilterContainer) {
        tenantFilterContainer.style.display = 'none';
    }

    if (scopeSelect) {
        scopeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'global') {
                tenantFilterContainer.style.display = 'none';
            } else {
                tenantFilterContainer.style.display = 'block';
                loadCompaniesIntoStatsSelect();
            }
            loadProductsForMultiSelect();
            loadAdvancedStatistics();
        });
    }

    const refreshBtn = document.getElementById('refresh-stats-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadProductsForMultiSelect();
            loadAdvancedStatistics();
        });
    }

    const exportPdfBtn = document.getElementById('export-pdf-btn');
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', exportStatsToPDF);
    }

    const clearProductsBtn = document.getElementById('clear-products-selection');
    if (clearProductsBtn) {
        clearProductsBtn.addEventListener('click', () => {
            const multiSelect = document.getElementById('stats-multi-products');
            if (multiSelect) {
                Array.from(multiSelect.options).forEach(opt => opt.selected = false);
                loadAdvancedStatistics();
            }
        });
    }

    const selectAllBtn = document.getElementById('select-all-products');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            const multiSelect = document.getElementById('stats-multi-products');
            if (multiSelect) {
                Array.from(multiSelect.options).forEach(opt => opt.selected = true);
                loadAdvancedStatistics();
            }
        });
    }

    // Evento de búsqueda dinámica en tiempo real
    const productSearchInput = document.getElementById('stats-product-search-input');
    if (productSearchInput) {
        productSearchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            renderProductMultiSelectOptions(term);
        });
    }

    ['stats-tenant-select', 'stats-timeframe', 'stats-sort-criterion', 'stats-multi-products'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', loadAdvancedStatistics);
    });

    loadProductsForMultiSelect();
    loadAdvancedStatistics();
});

async function loadCompaniesIntoStatsSelect() {
    const select = document.getElementById('stats-tenant-select');
    if (!select) return;
    try {
        select.innerHTML = `<option value="">Cargando empresas...</option>`;
        const { data, error } = await supabaseClient.from('tenants').select('id, name');
        if (error) throw error;
        
        if (!data || data.length === 0) {
            select.innerHTML = `<option value="">No hay empresas registradas</option>`;
            return;
        }

        select.innerHTML = `<option value="">Seleccione una empresa...</option>` + 
            data.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    } catch (err) {
        console.error('Error al cargar empresas:', err);
        select.innerHTML = `<option value="">Error al cargar empresas</option>`;
    }
}

// Cargar productos base desde Supabase y almacenarlos en memoria
async function loadProductsForMultiSelect() {
    const scope = document.getElementById('stats-scope')?.value || 'global';
    const tenantId = document.getElementById('stats-tenant-select')?.value;

    try {
        let query = supabaseClient.from('products').select('id, name, code, tenant_id');
        if (scope === 'tenant' && tenantId) {
            query = query.eq('tenant_id', tenantId);
        }

        const { data, error } = await query;
        if (error) throw error;

        allAvailableProductsForStats = data || [];
        renderProductMultiSelectOptions(''); // Renderizar inicial sin filtro de texto
    } catch (err) {
        console.error('Error al cargar productos:', err);
    }
}

// Renderizar dinámicamente las opciones del select múltiple aplicando el filtro de búsqueda
function renderProductMultiSelectOptions(searchTerm) {
    const multiSelect = document.getElementById('stats-multi-products');
    if (!multiSelect) return;

    // Guardar los IDs que ya estaban seleccionados previamente para no perderlos al filtrar
    const previouslySelectedIds = Array.from(multiSelect.selectedOptions).map(opt => opt.value);

    const filtered = allAvailableProductsForStats.filter(p => {
        const name = (p.name || '').toLowerCase();
        const code = (p.code || '').toLowerCase();
        return name.includes(searchTerm) || code.includes(searchTerm);
    });

    multiSelect.innerHTML = filtered.map(p => {
        const isSelected = previouslySelectedIds.includes(p.id) ? 'selected' : '';
        return `<option value="${p.id}" ${isSelected}>${p.name} (${p.code || 'S/C'})</option>`;
    }).join('');
}

// Motor de cálculo analítico gerencial
async function loadAdvancedStatistics() {
    const scope = document.getElementById('stats-scope')?.value || 'global';
    const tenantId = document.getElementById('stats-tenant-select')?.value;
    const timeframe = document.getElementById('stats-timeframe')?.value || 'mensual';
    const sortCriterion = document.getElementById('stats-sort-criterion')?.value || 'mayor_salida';
    
    const multiSelect = document.getElementById('stats-multi-products');
    const selectedProductIds = multiSelect ? Array.from(multiSelect.selectedOptions).map(opt => opt.value) : [];

    const tbody = document.getElementById('advanced-stats-table-body');
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center">Procesando analítica de alta precisión...</td></tr>`;

    try {
        let queryProducts = supabaseClient.from('products').select('*, tenants(name)');
        if (scope === 'tenant' && tenantId) {
            queryProducts = queryProducts.eq('tenant_id', tenantId);
        }
        const { data: productsData, error: prodError } = await queryProducts;
        if (prodError) throw prodError;

        let filteredProducts = productsData || [];
        if (selectedProductIds.length > 0) {
            filteredProducts = filteredProducts.filter(p => selectedProductIds.includes(p.id));
        }

        const now = new Date();
        let startDate = new Date(0);

        if (timeframe === 'diario') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (timeframe === 'semanal') {
            startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        } else if (timeframe === 'mensual') {
            startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        } else if (timeframe === 'trimestral') {
            startDate = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
        } else if (timeframe === 'semestral') {
            startDate = new Date(now.getTime() - (180 * 24 * 60 * 60 * 1000));
        } else if (timeframe === 'anual') {
            startDate = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
        }

        let queryAudit = supabaseClient.from('audit_logs').select('*').gte('created_at', startDate.toISOString());
        if (scope === 'tenant' && tenantId) {
            queryAudit = queryAudit.eq('tenant_id', tenantId);
        }
        const { data: auditData } = await queryAudit;

        let processedData = filteredProducts.map(prod => {
            const stockReal = parseFloat(prod.stock) || 0;
            let salidasRango = 0;

            if (auditData) {
                auditData.forEach(log => {
                    const isEgreso = log.action && (log.action.toLowerCase().includes('egreso') || log.action.toLowerCase().includes('despacho') || log.action.toLowerCase().includes('salida'));
                    const matchesProduct = log.details && (log.details.includes(prod.code) || log.details.includes(prod.name));
                    
                    if (isEgreso && matchesProduct) {
                        salidasRango += 1;
                    }
                });
            }

            return {
                ...prod,
                stock: stockReal,
                total_salidas: salidasRango,
                tenant_name: prod.tenants ? prod.tenants.name : 'Empresa General'
            };
        });

        processedData.sort((a, b) => {
            if (sortCriterion === 'mayor_salida') return b.total_salidas - a.total_salidas;
            if (sortCriterion === 'menor_salida') return a.total_salidas - b.total_salidas;
            if (sortCriterion === 'mayor_stock') return parseFloat(b.stock) - parseFloat(a.stock);
            if (sortCriterion === 'menor_stock') return parseFloat(a.stock) - parseFloat(b.stock);
            return 0;
        });

        const totalMovements = auditData ? auditData.length : 0;
        const totalStockUnits = processedData.reduce((acc, curr) => acc + curr.stock, 0);
        const topProd = processedData.length > 0 && processedData[0].total_salidas > 0 ? processedData[0].name : 'Sin salidas en este periodo';

        document.getElementById('adv-stat-total-movements').textContent = totalMovements;
        document.getElementById('adv-stat-units-dispatched').textContent = totalStockUnits;
        document.getElementById('adv-stat-top-product').textContent = topProd;

        if (processedData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center">No se encontraron productos o movimientos con los filtros aplicados.</td></tr>`;
        } else {
            tbody.innerHTML = processedData.map((item, index) => {
                let badgeClass = 'badge-normal';
                let rotacionText = 'Rotación Normal';
                if (item.total_salidas > 5) {
                    badgeClass = 'badge-high';
                    rotacionText = '🔥 Alta Rotación';
                } else if (item.total_salidas === 0) {
                    badgeClass = 'badge-low';
                    rotacionText = '🧊 Sin Movimiento en Periodo';
                }

                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${item.tenant_name}</td>
                        <td><code>${item.code || item.barcode || 'N/A'}</code></td>
                        <td><strong>${item.name}</strong></td>
                        <td>${item.stock}</td>
                        <td>${item.total_salidas} un.</td>
                        <td><span class="badge ${badgeClass}">${rotacionText}</span></td>
                    </tr>
                `;
            }).join('');
        }

        renderAnalyticsChart(processedData.slice(0, 10));

    } catch (error) {
        console.error('Error en motor analítico gerencial:', error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center">Error al procesar la analítica de movimientos.</td></tr>`;
    }
}

function renderAnalyticsChart(topProducts) {
    const ctx = document.getElementById('statsChart');
    if (!ctx || typeof Chart === 'undefined') return;

    const labels = topProducts.map(p => p.name.length > 18 ? p.name.substring(0, 18) + '...' : p.name);
    const dataValues = topProducts.map(p => p.total_salidas);

    if (myStatsChart) {
        myStatsChart.destroy();
    }

    myStatsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Salidas Puras en Periodo Seleccionado',
                data: dataValues,
                backgroundColor: '#4f46e5',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function exportStatsToPDF() {
    if (typeof window.jspdf === 'undefined') {
        alert('Librería PDF no cargada aún.');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Informe Gerencial de Analítica y Estadísticas Pro", 14, 20);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha de emisión: ${new Date().toLocaleString()}`, 14, 26);
    doc.text(`Ámbito analítico: ${document.getElementById('stats-scope').value.toUpperCase()} | Rango: ${document.getElementById('stats-timeframe').value.toUpperCase()}`, 14, 32);

    let yPos = 42;
    doc.setFont("helvetica", "bold");
    doc.text("Resumen Ejecutivo de Gestión:", 14, yPos);
    
    yPos += 7;
    doc.setFont("helvetica", "normal");
    doc.text(`- Movimientos Registrados en Rango: ${document.getElementById('adv-stat-total-movements').textContent}`, 18, yPos);
    yPos += 5;
    doc.text(`- Unidades Totales en Stock: ${document.getElementById('adv-stat-units-dispatched').textContent}`, 18, yPos);
    yPos += 5;
    doc.text(`- Producto Estrella del Periodo: ${document.getElementById('adv-stat-top-product').textContent}`, 18, yPos);

    yPos += 12;
    doc.setFont("helvetica", "bold");
    doc.text("Listado Detallado de Movimientos y Rotación Pura:", 14, yPos);

    const rows = document.querySelectorAll('#advanced-stats-table-body tr');
    yPos += 6;
    
    doc.setFontSize(8);
    doc.setFillColor(240, 240, 240);
    doc.rect(14, yPos, 180, 8, 'F');
    doc.text("Empresa", 16, yPos + 5);
    doc.text("Código", 65, yPos + 5);
    doc.text("Producto", 95, yPos + 5);
    doc.text("Stock", 155, yPos + 5);
    doc.text("Salidas", 175, yPos + 5);

    yPos += 8;
    rows.forEach((row, idx) => {
        if (idx > 20) return;
        const cols = row.querySelectorAll('td');
        if (cols.length >= 6) {
            yPos += 6;
            doc.text(cols[1].textContent.substring(0, 20), 16, yPos);
            doc.text(cols[2].textContent.substring(0, 15), 65, yPos);
            doc.text(cols[3].textContent.substring(0, 30), 95, yPos);
            doc.text(cols[4].textContent, 155, yPos);
            doc.text(cols[5].textContent, 175, yPos);
        }
    });

    doc.save(`Informe_Gerencial_Inventario_${Date.now()}.pdf`);
}
