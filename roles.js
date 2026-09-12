// --- MÓDULO MODULAR DE CONTROL DE ROLES Y PERMISOS ---

document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('userLoggedIn', (e) => {
        applyUserRolePermissions(e.detail.user);
    });
});

async function applyUserRolePermissions(user) {
    if (!user) return;

    const roleTabs = document.querySelectorAll('.role-tab');

    // 1. Si es el SuperAdmin global por excelencia (`altuna.g1@gmail.com`) -> Muestra todo
    if (user.email === 'altuna.g1@gmail.com') {
        roleTabs.forEach(el => el.classList.remove('hidden'));
        return;
    }

    // Por defecto ocultamos todas las pestañas avanzadas
    roleTabs.forEach(el => el.classList.add('hidden'));

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

        const roleId = userData.roles.id; // Ej: 'role_depositario', 'role_ayudante', 'role_administrador', 'role_presidente'
        const roleName = userData.roles.name ? userData.roles.name.toLowerCase() : '';

        // 3. Encender selectivamente las pestañas permitidas según el rol exacto
        if (roleId === 'role_ayudante' || roleName === 'ayudante') {
            // Ayudante: Solo ve Productos y Egresos operativos
            document.querySelector('[data-target="tab-egress"]').classList.remove('hidden');
            console.log('Permisos aplicados: Ayudante de Depósito (Operativo)');
        } 
        else if (roleId === 'role_depositario' || roleName === 'depositario') {
            // Depositario: Ve Inventario, Ingreso Pro y Egreso
            document.querySelector('[data-target="tab-ingress"]').classList.remove('hidden');
            document.querySelector('[data-target="tab-egress"]').classList.remove('hidden');
            console.log('Permisos aplicados: Usuario Depositario');
        } 
        else if (
            roleId === 'role_administrador' || 
            roleId === 'role_presidente' || 
            roleName === 'administrador' || 
            roleName === 'presidente'
        ) {
            // Administradores y Presidentes locales: Ven Ingresos, Egresos y Estadísticas de su empresa
            document.querySelector('[data-target="tab-ingress"]').classList.remove('hidden');
            document.querySelector('[data-target="tab-egress"]').classList.remove('hidden');
            document.querySelector('[data-target="tab-tenant-stats"]').classList.remove('hidden');
            console.log(`Permisos aplicados: Acceso Total Empresa (${roleName.toUpperCase()})`);
        }

    } catch (err) {
        console.error('Error al aplicar permisos de roles:', err);
    }
}