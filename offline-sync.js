// RUTA: inventario-pro/offline-sync.js

const OFFLINE_QUEUE_KEY = 'inventario_pro_offline_queue';

window.addEventListener('online', () => {
    console.log('Conexion a internet restablecida. Sincronizando cola offline...');
    sincronizarColaOffline();
});

window.addEventListener('offline', () => {
    console.log('Sin conexion a internet. El sistema guardara los registros localmente.');
});

function guardarAccionOffline(tipoAccion, payload) {
    try {
        const queue = obtenerColaOffline();
        const nuevaAccion = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            tipo: tipoAccion,
            payload: payload,
            timestamp: Date.now()
        };
        queue.push(nuevaAccion);
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
        return true;
    } catch (err) {
        console.error('Error al guardar en la cola offline:', err);
        return false;
    }
}

function obtenerColaOffline() {
    try {
        const data = localStorage.getItem(OFFLINE_QUEUE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (err) {
        console.error('Error al leer la cola offline:', err);
        return [];
    }
}

function limpiarColaOffline() {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

async function sincronizarColaOffline() {
    if (!navigator.onLine) return;
    
    let queue = obtenerColaOffline();
    if (queue.length === 0) return;

    queue.sort((a, b) => a.timestamp - b.timestamp);

    console.log(`Sincronizando ${queue.length} acciones pendientes en orden cronologico...`);

    let accionesExitosas = [];

    for (const item of queue) {
        try {
            if (item.tipo === 'INGRESAR_MERCANCIA') {
                const res = await ejecutarIngresoSupabase(item.payload);
                if (res.success) {
                    accionesExitosas.push(item.id);
                } else {
                    console.error('Fallo sincronizacion de item:', res.error);
                    break;
                }
            }
        } catch (err) {
            console.error('Error de red durante la sincronizacion:', err);
            break; 
        }
    }

    if (accionesExitosas.length > 0) {
        const remainingQueue = queue.filter(item => !accionesExitosas.includes(item.id));
        if (remainingQueue.length === 0) {
            limpiarColaOffline();
            alert('¡Todos los registros pendientes offline se han sincronizado correctamente en orden cronológico!');
        } else {
            localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingQueue));
        }
        if (typeof loadProducts === 'function') loadProducts();
    }
}

async function ejecutarIngresoSupabase(payload) {
    try {
        const { code, name, price, boxFactor, packFactor, baleFactor, packagingUnit, qtyEntered, tenantId } = payload;

        let totalUnitsToAdd = qtyEntered;
        if (packagingUnit === 'caja') totalUnitsToAdd = qtyEntered * boxFactor;
        else if (packagingUnit === 'paquete') totalUnitsToAdd = qtyEntered * packFactor;
        else if (packagingUnit === 'bulto') totalUnitsToAdd = qtyEntered * baleFactor;

        let { data: existingProd } = await supabaseClient
            .from('products')
            .select('*')
            .or(`code.eq.${code},barcode.eq.${code}`)
            .maybeSingle();

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
            const { error: insertProdError } = await supabaseClient
                .from('products')
                .insert([{
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
            if (insertProdError) throw insertProdError;
        }

        const currentStock = existingProd && existingProd.stock ? parseFloat(existingProd.stock) : 0;
        const newStock = currentStock + totalUnitsToAdd;

        const { error: updateStockError } = await supabaseClient
            .from('products')
            .update({ stock: newStock })
            .eq('id', productId);

        if (updateStockError) throw updateStockError;

        return { success: true };
    } catch (err) {
        return { success: false, error: err };
    }
}