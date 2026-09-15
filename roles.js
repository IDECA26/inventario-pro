// RUTA: inventario-pro/roles.js

window.addEventListener('userLoggedIn', async (event) => {
    const user = event.detail.user;
    if (!user) return;

    const isSuperAdmin = user.email === 'altuna.g1@gmail.com';
    
    const menuTabs = document.querySelectorAll('.menu-tab');
    menuTabs.forEach(tab => {
        tab.style.display = 'none';
    });

    if (isSuperAdmin) {
        console.log('Permisos aplicados: SuperAdmin Global (Acceso Total)');
        menuTabs.forEach(tab => {
            tab.style.display = 'block';
        });
        return;
    }

    try {
        const { data: userData, error } = await supabaseClient
            .from('users')
            .select('role_id, roles(name)')
            .eq('username', user.email)
            .maybeSingle();

        if (error || !userData) {
            console.error('Error al obtener el rol del usuario:', error);
            return;
        }

        const roleName = userData.roles ? userData.roles.name.toLowerCase().trim() : 'ayudante';
        console.log(`Permisos aplicados: Usuario ${roleName.charAt(0).toUpperCase() + roleName.slice(1)}`);

        const tabEgress = document.querySelector('.menu-tab[data-target="tab-egress"]');
        const tabTenantStats = document.querySelector('.menu-tab[data-target="tab-tenant-stats"]');
        const tabIngress = document.querySelector('.menu-tab[data-target="tab-ingress"]');
        const tabAdvancedStats = document.querySelector('.menu-tab[data-target="tab-advanced-stats"]');
        const tabAdminUsers = document.querySelector('.menu-tab[data-target="tab-admin-users"]');
        const tabGlobalAudit = document.querySelector('.menu-tab[data-target="tab-global-audit"]');

        if (roleName === 'ayudante') {
            if (tabEgress) tabEgress.style.display = 'block';
        } 
        else if (roleName === 'depositario') {
            if (tabIngress) tabIngress.style.display = 'block';
            if (tabEgress) tabEgress.style.display = 'block';
            if (tabTenantStats) tabTenantStats.style.display = 'block';
        } 
        else if (roleName === 'administrador' || roleName === 'presidente') {
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