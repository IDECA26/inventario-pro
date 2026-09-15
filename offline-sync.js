// RUTA: inventario-pro/offline-sync.js

const OFFLINE_QUEUE_KEY = 'inventario_pro_offline_queue';

/**
 * Almacena una operacion en el dispositivo ordenandola cronologicamente por su timestamp.
 */
function guardarOperacionOffline(type, payload) {
    try {
        const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY)) || [];
        
        const operacionPendiente = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            type: type,
            payload: payload,
            timestamp: new Date().toISOString() // Marca cronologica exacta
        };

        queue.push(operacionPendiente);
        
        // Ordenamiento cronologico estricto ascendente (el mas antiguo primero)
        queue.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
        
        console.warn('Operacion almacenada offline en dispositivo:', operacionPendiente);
        alert('Sin conexión a internet. La operación se guardó de forma segura en su dispositivo y se sincronizará automáticamente al recuperar la red.');
    } catch (err) {
        console.error('Error al guardar operacion offline:', err);
        alert('Error crítico: No se pudo almacenar la operación en el dispositivo.');
    }
}

/**
 * Sincroniza la cola local con Supabase respetando estrictamente el orden cronologico.
 */
async function sincronizarColaOffline() {
    if (!navigator.onLine) return;

    const queueStr = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!queueStr) return;

    let queue = [];
    try {
        queue = JSON.parse(queueStr);
    } catch (e) {
        console.error('Error al leer cola offline:', e);
        return;
    }

    if (!queue || queue.length === 0) return;

    console.log(`Sincronizando ${queue.length} operaciones pendientes en orden cronologico estricto...`);

    // Asegurar ordenamiento por fecha/hora
    queue.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const operacionesRestantes = [];

    for (const op of queue) {
        try {
            if (op.type === 'INGRESS_MERCANCIA') {
                await ejecutarIngresoRemoto(op.payload);
            }
            console.log(`Operación sincronizada con éxito (Timestamp: ${op.timestamp})`);
        } catch (err) {
            console.error(`Fallo al sincronizar operacion (${op.timestamp}):`, err);
            operacionesRestantes.push(op);
            if (!navigator.onLine) break; // Detener si se vuelve a perder la red
        }
    }

    if (operacionesRestantes.length > 0) {
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(operacionesRestantes));
    } else {
        localStorage.removeItem(OFFLINE_QUEUE_KEY);
        console.log('Todas las operaciones offline se han sincronizado correctamente.');
    }

    if (typeof loadProducts === 'function') {
        loadProducts();
    }
}

// Escuchar de forma automatica cuando se recupera la conexion a internet
window.addEventListener('online', () => {
    console.log('Conexión a internet restablecida. Iniciando sincronización...');
    sincronizarColaOffline();
});

// Intentar sincronizar al cargar la aplicacion si hay internet disponible
window.addEventListener('DOMContentLoaded', () => {
    if (navigator.onLine) {
        sincronizarColaOffline();
    }
});