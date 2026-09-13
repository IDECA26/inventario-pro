// RUTA: inventario-pro/roles.js

// Escuchar el evento personalizado de inicio de sesion para aplicar permisos dinamicamente
window.addEventListener('userLoggedIn', async (event) => {
    const user = event.detail.user;
    if (!user) return;

    const isSuperAdmin = user.email === 'altuna.g1@gmail.com';
    
    // 1. Ocultar todas las pestanas de menu restringidas por defecto
    const menuTabs = document.querySelectorAll('.menu-tab');
    menuTabs.forEach(tab => {
        tab.style.display = 'none';
    });

    // 2. Si es SuperAdmin, mostrar todo y salir de la funcion
    if (isSuperAdmin) {
        console.log('Permisos aplicados: SuperAdmin Global (Acceso Total)');
        menuTabs.forEach(tab => {
            tab.style.display = 'block';
        });
        return;
    }

    try {
        // 3. Consultar el rol del usuario en la base de datos con su relacion a la tabla roles
        const { data: userData, error } = await supabaseClient
            .from('users')
            .select('role_id, roles(name)')
            .eq('username', user.email)
            .maybeSingle();

        if (error || !userData) {
            console.error('Error al obtener el rol del usuario:', error);
            return;
        }

        // Normalizar el nombre del rol a minusculas y sin espacios para comparacion segura
        const roleName = userData.roles ? userData.roles.name.toLowerCase().trim() : 'ayudante';
        console.log(`Permisos aplicados: Usuario ${roleName.charAt(0).toUpperCase() + roleName.slice(1)}`);

        // 4. Referencias a las pestanas del DOM
        const tabEgress = document.querySelector('.menu-tab[data-target="tab-egress"]');
        const tabTenantStats = document.querySelector('.menu-tab[data-target="tab-tenant-stats"]');
        const tabIngress = document.querySelector('.menu-tab[data-target="tab-ingress"]');
        const tabAdvancedStats = document.querySelector('.menu-tab[data-target="tab-advanced-stats"]');
        const tabAdminUsers = document.querySelector('.menu-tab[data-target="tab-admin-users"]');
        const tabGlobalAudit = document.querySelector('.menu-tab[data-target="tab-global-audit"]');

        // 5. Asignacion estricta de pestanas visibles segun el rol
        if (roleName === 'ayudante') {
            // Ayudante: Solo puede ver Egresos/Despacho (ademas de Productos que es la pestana por defecto)
            if (tabEgress) tabEgress.style.display = 'block';
        } 
        else if (roleName === 'depositario') {
            // Depositario: Puede ver Ingresos, Egresos/Despacho y Estadisticas de Deposito
            if (tabIngress) tabIngress.style.display = 'block';
            if (tabEgress) tabEgress.style.display = 'block';
            if (tabTenantStats) tabTenantStats.style.display = 'block';
        } 
        else if (roleName === 'administrador' || roleName === 'presidente') {
            // Administrador/Presidente: Acceso a Ingresos, Estadisticas de Empresa, Analitica Pro, Admin y Auditoria
            if (tabIngress) tabIngress.style.display = 'block';
            if (tabTenantStats) tabTenantStats.style.display = 'block';
            if (tabAdvancedStats) tabAdvancedStats.style.display = 'block';
            if (tabAdminUsers) tabAdminUsers.style.display = 'block';
            if (tabGlobalAudit) tabGlobalAudit.style.display = 'block';
        }

    } catch (err) {
        console.error('Error critico en la asignacion de roles:', err);
    }
});