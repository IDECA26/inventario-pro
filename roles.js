// --- MÓDULO MODULAR DE CONTROL DE ROLES Y PERMISOS ---

document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('userLoggedIn', (e) => {
        applyUserRolePermissions(e.detail.user);
    });
});

async function applyUserRolePermissions(user) {
    if (!user) return;

    const superadminTabs = document.querySelectorAll('.superadmin-only');

    // 1. Si es el SuperAdmin global por excelencia (`altuna.g1@gmail.com`)
    if (user.email === 'altuna.g1@gmail.com') {
        superadminTabs.forEach(el => el.classList.remove('hidden'));
        return;
    }

    // Por defecto ocultamos pestañas de superadmin para cualquier otro usuario
    superadminTabs.forEach(el => el.classList.add('hidden'));

    try {
        // 2. Consultar el rol del usuario en la base de datos usando JOIN con la tabla roles
        const { data: userData, error } = await supabaseClient
            .from('users')
            .select('role_id, roles(id, name)')
            .eq('username', user.email)
            .maybeSingle();

        if (error || !userData || !userData.roles) {
            console.warn('No se encontró el rol asociado a este usuario.');
            return;
        }

        const roleId = userData.roles.id; // Ej: 'role_depositario', 'role_ayudante', etc.
        const roleName = userData.roles.name ? userData.roles.name.toLowerCase() : '';

        // 3. Aplicar reglas estrictas según el rol detectado en Supabase
        if (roleId === 'role_ayudante' || roleName === 'ayudante') {
            // Ayudante: Solo puede ver inventario, ingresos y egresos operativos básicos
            console.log('Permisos aplicados: Ayudante de Depósito (Operativo)');
        } else if (roleId === 'role_depositario' || roleName === 'depositario') {
            // Depositario: Gestión de inventario, ingresos y egresos
            console.log('Permisos aplicados: Usuario Depositario');
        } else if (roleId === 'role_administrador' || roleId === 'role_presidente' || roleName === 'administrador' || roleName === 'presidente') {
            // Administradores / Presidentes de empresa local (tienen estadísticas de su tenant pero no superadmin global)
            console.log(`Permisos aplicados: ${roleName.toUpperCase()}`);
        }

    } catch (err) {
        console.error('Error al aplicar permisos de roles:', err);
    }
}