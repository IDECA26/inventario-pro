// --- MÓDULO MODULAR DE CONTROL DE ROLES Y PERMISOS ---

document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('userLoggedIn', (e) => {
        applyUserRolePermissions(e.detail.user);
    });
});

async function applyUserRolePermissions(user) {
    if (!user) return;

    // Seleccionamos los botones de las pestañas según su atributo data-target
    const tabIngress = document.querySelector('[data-target="tab-ingress"]');
    const tabEgress = document.querySelector('[data-target="tab-egress"]');
    const tabStats = document.querySelector('[data-target="tab-tenant-stats"]');
    const tabAdminUsers = document.querySelector('[data-target="tab-admin-users"]');
    const tabGlobalAudit = document.querySelector('[data-target="tab-global-audit"]');
    const tabAdvancedStats = document.querySelector('[data-target="tab-advanced-stats"]');

    const allRestrictedTabs = [tabIngress, tabEgress, tabStats, tabAdminUsers, tabGlobalAudit, tabAdvancedStats];

    // Por defecto, ocultamos todas las pestañas restringidas de forma directa
    allRestrictedTabs.forEach(tab => {
        if (tab) tab.style.display = 'none';
    });

    // 1. Si es el SuperAdmin global por excelencia (`altuna.g1@gmail.com`) -> Mostrar todo
    if (user.email === 'altuna.g1@gmail.com') {
        allRestrictedTabs.forEach(tab => {
            if (tab) tab.style.display = 'block';
        });
        console.log('Permisos aplicados: SuperAdmin Global (Acceso Total)');
        return;
    }

    try {
        // 2. Consultar el rol del usuario en la base de datos
        const { data: userData, error } = await supabaseClient
            .from('users')
            .select('role_id, roles(id, name)')
            .eq('username', user.email)
            .maybeSingle();

        if (error || !userData || !userData.roles) {
            console.warn('No se encontró el rol asociado a este usuario.');
            return;
        }

        const roleId = userData.roles.id; 
        const roleName = userData.roles.name ? userData.roles.name.toLowerCase() : '';

        // 3. Encender explícitamente mediante display: block las pestañas autorizadas según el rol
        if (roleId === 'role_ayudante' || roleName === 'ayudante') {
            // Ayudante: Solo ve Egresos y Productos
            if (tabEgress) tabEgress.style.display = 'block';
            console.log('Permisos aplicados: Ayudante de Depósito (Operativo)');
        } 
        else if (roleId === 'role_depositario' || roleName === 'depositario') {
            // Depositario: Ve Ingresos y Egresos
            if (tabIngress) tabIngress.style.display = 'block';
            if (tabEgress) tabEgress.style.display = 'block';
            console.log('Permisos aplicados: Usuario Depositario');
        } 
        else if (
            roleId === 'role_administrador' || 
            roleId === 'role_presidente' || 
            roleName === 'administrador' || 
            roleName === 'presidente'
        ) {
            // Administradores y Presidentes locales: Ingresos, Egresos, Estadísticas y Analítica Pro
            if (tabIngress) tabIngress.style.display = 'block';
            if (tabEgress) tabEgress.style.display = 'block';
            if (tabStats) tabStats.style.display = 'block';
            if (tabAdvancedStats) tabAdvancedStats.style.display = 'block';
            console.log(`Permisos aplicados: Acceso Total Empresa (${roleName.toUpperCase()})`);
        }

    } catch (err) {
        console.error('Error al aplicar permisos de roles:', err);
    }
}
