// --- MÓDULO MODULAR DE ANALÍTICA Y ESTADÍSTICAS PRO (DATOS REALES) ---

let myStatsChart = null;

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
            loadAdvancedStatistics();
        });
    }

    const refreshBtn = document.getElementById('refresh-stats-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadAdvancedStatistics);
    }

    const exportPdfBtn = document.getElementById('export-pdf-btn');
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', exportStatsToPDF);
    }

    ['stats-tenant-select', 'stats-timeframe', 'stats-sort-criterion'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', loadAdvancedStatistics);
    });

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
        console.error('Error al cargar empresas para estadísticas:', err);
        select.innerHTML = `<option value="">Error al cargar empresas</option>`;
    }
}

async function loadAdvancedStatistics() {
    const scope = document.getElementById('stats-scope')?.value || 'global';
    const tenantId = document.getElementById('stats-tenant-select')?.value;
    const sortCriterion = document.getElementById('stats-sort-criterion')?.value || 'mayor_salida';

    const tbody = document.getElementById('advanced-stats-table-body');
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center">Consultando datos reales en Supabase...</td></tr>`;

    try {
        // 1. Obtener productos vinculados con su empresa (tenant)
        let queryProducts = supabaseClient.from('products').select('*, tenants(name)');
        
        if (scope === 'tenant') {
            if (!tenantId) {
                if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center">Por favor, seleccione una empresa para ver sus estadísticas.</td></tr>`;
                return;
            }
            queryProducts = queryProducts.eq('tenant_id', tenantId);
        }

        const { data: productsData, error: prodError } = await queryProducts;
        if (prodError) throw prodError;

        // 2. Consultar registros reales de auditoría / movimientos para cruzar volúmenes reales
        let queryAudit = supabaseClient.from('audit_logs').select('*');
        if (scope === 'tenant' && tenantId) {
            queryAudit = queryAudit.eq('tenant_id', tenantId);
        }
        const { data: auditData } = await queryAudit;

        // 3. Mapeo con valores reales extraídos de la base de datos
        let processedData = (productsData || []).map(prod => {
            const stockReal = parseFloat(prod.stock) || 0;
            
            // Contabilizar movimientos reales desde la auditoría si el nombre o código coincide en los detalles
            let salidasReales = 0;
            if (auditData) {
                auditData.forEach(log => {
                    if (log.details && (log.details.includes(prod.code) || log.details.includes(prod.name))) {
                        if (log.action && log.action.toLowerCase().includes('egreso')) {
                            salidasReales += 1; 
                        }
                    }
                });
            }

            return {
                ...prod,
                stock: stockReal,
                total_salidas: salidasReales, // Salidas reales basadas en transacciones
                tenant_name: prod.tenants ? prod.tenants.name : 'Empresa General'
            };
        });

        // 4. Ordenamiento dinámico según el criterio seleccionado
        processedData.sort((a, b) => {
            if (sortCriterion === 'mayor_salida') return b.total_salidas - a.total_salidas;
            if (sortCriterion === 'menor_salida') return a.total_salidas - b.total_salidas;
            if (sortCriterion === 'mayor_stock') return parseFloat(b.stock) - parseFloat(a.stock);
            if (sortCriterion === 'menor_stock') return parseFloat(a.stock) - parseFloat(b.stock);
            return 0;
        });

        // 5. Métricas de resumen ejecutivo basadas en datos reales
        const totalMovements = auditData ? auditData.length : 0;
        const totalUnits = processedData.reduce((acc, curr) => acc + curr.stock, 0);
        const topProd = processedData.length > 0 && processedData[0].total_salidas > 0 ? processedData[0].name : 'Sin movimientos recientes';

        document.getElementById('adv-stat-total-movements').textContent = totalMovements;
        document.getElementById('adv-stat-units-dispatched').textContent = totalUnits;
        document.getElementById('adv-stat-top-product').textContent = topProd;

        // 6. Renderizar Tabla Detallada con información real
        if (processedData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center">No se encontraron productos registrados para este ámbito.</td></tr>`;
        } else {
            tbody.innerHTML = processedData.map((item, index) => {
                let badgeClass = 'badge-normal';
                let rotacionText = 'Rotación Normal';
                if (item.total_salidas > 10) {
                    badgeClass = 'badge-high';
                    rotacionText = '🔥 Alta Rotación';
                } else if (item.total_salidas === 0) {
                    badgeClass = 'badge-low';
                    rotacionText = '🧊 Sin Movimiento / Estancado';
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

        renderAnalyticsChart(processedData.slice(0, 8));

    } catch (error) {
        console.error('Error al generar estadísticas avanzadas con datos reales:', error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center">Error al conectar con las estadísticas de Supabase.</td></tr>`;
    }
}

function renderAnalyticsChart(topProducts) {
    const ctx = document.getElementById('statsChart');
    if (!ctx || typeof Chart === 'undefined') return;

    const labels = topProducts.map(p => p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name);
    const dataValues = topProducts.map(p => p.total_salidas);

    if (myStatsChart) {
        myStatsChart.destroy();
    }

    myStatsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Volumen de Salidas Reales',
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
    doc.setFontSize(18);
    doc.text("Informe Ejecutivo de Analítica y Estadísticas Pro", 14, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha de emisión: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Ámbito analítico: ${document.getElementById('stats-scope').value.toUpperCase()}`, 14, 34);

    let yPos = 45;
    doc.setFont("helvetica", "bold");
    doc.text("Resumen de Métricas Clave:", 14, yPos);
    
    yPos += 8;
    doc.setFont("helvetica", "normal");
    doc.text(`- Total Movimientos Registrados: ${document.getElementById('adv-stat-total-movements').textContent}`, 18, yPos);
    yPos += 6;
    doc.text(`- Unidades Totales en Inventario: ${document.getElementById('adv-stat-units-dispatched').textContent}`, 18, yPos);
    yPos += 6;
    doc.text(`- Producto Estrella: ${document.getElementById('adv-stat-top-product').textContent}`, 18, yPos);

    yPos += 15;
    doc.setFont("helvetica", "bold");
    doc.text("Detalle de Rotación de Productos:", 14, yPos);

    const rows = document.querySelectorAll('#advanced-stats-table-body tr');
    yPos += 8;
    
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
        if (idx > 15) return;
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

    doc.save(`Informe_Inventario_Pro_${Date.now()}.pdf`);
}
