import { supabase } from './supabase.js';
import { mostrarToast } from './modules/toast.js';

let currentUser = null;
let currentRole = null;

// Escapar HTML para evitar XSS en el menú desplegable
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export async function initAuth() {
    // Obtener sesión actual
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        await loadUserRole();
        updateUIForLoggedIn();
    }
    // Escuchar cambios de autenticación
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN') {
            currentUser = session.user;
            await loadUserRole();
            updateUIForLoggedIn();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            currentRole = null;
            updateUIForLoggedOut();
        }
    });
}

async function loadUserRole() {
    if (!currentUser) return;

    // Usamos maybeSingle() para evitar error 406 cuando no hay filas
    const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .maybeSingle();

    // Si no existe el perfil (data es null) o error de tipo "no rows"
    if (error || !data) {
        console.log('Perfil no encontrado, creando uno por defecto...');
        // Crear perfil con rol 'customer'
        const { error: insertError } = await supabase
            .from('profiles')
            .insert([{
                id: currentUser.id,
                email: currentUser.email,
                role: 'customer'
            }]);
        if (insertError) {
            console.error('Error al crear perfil:', insertError);
            currentRole = 'customer'; // fallback
        } else {
            currentRole = 'customer';
            console.log('Perfil creado exitosamente');
        }
        return;
    }

    // Si existe, asignamos el rol
    currentRole = data.role || 'customer';
}

function updateUIForLoggedIn() {
    const userBtn = document.getElementById('user-btn');
    if (userBtn) {
        userBtn.innerHTML = `<i class="fas fa-user-check"></i>`;
        // Eliminar dropdown previo si existe
        const existingDropdown = userBtn.parentNode.querySelector('.user-dropdown');
        if (existingDropdown) existingDropdown.remove();

        const userMenu = document.createElement('div');
        userMenu.className = 'user-dropdown';
        userMenu.innerHTML = `
            <div class="user-email">${escapeHtml(currentUser.email)}</div>
            <a href="#" id="profile-link">Mi perfil</a>
            ${currentRole === 'seller' ? '<a href="/admin.html" id="admin-link">Panel de vendedor</a>' : ''}
            <button id="logout-btn">Cerrar sesión</button>
        `;
        userBtn.parentNode.style.position = 'relative';
        userBtn.parentNode.appendChild(userMenu);

        userBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenu.classList.toggle('show');
        });
        document.addEventListener('click', () => userMenu.classList.remove('show'));

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await supabase.auth.signOut();
                mostrarToast('Sesión cerrada', 'info');
                location.reload();
            });
        }
    }
    // Ocultar botón de login/registro si hay uno
    const authBtn = document.getElementById('auth-btn');
    if (authBtn) authBtn.style.display = 'none';
}

function updateUIForLoggedOut() {
    const userBtn = document.getElementById('user-btn');
    if (userBtn) {
        userBtn.innerHTML = `<i class="fas fa-user"></i>`;
        const dropdown = userBtn.parentNode.querySelector('.user-dropdown');
        if (dropdown) dropdown.remove();
        // Reemplazar event listener para abrir modal
        userBtn.replaceWith(userBtn.cloneNode(true));
        const newUserBtn = document.getElementById('user-btn');
        if (newUserBtn) newUserBtn.addEventListener('click', () => openAuthModal());
    }
}

export function openAuthModal(preselectedRole = null) {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.removeAttribute('hidden');

    // Limpiar formularios
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('reg-email').value = '';
    document.getElementById('reg-password').value = '';
    document.getElementById('reg-confirm').value = '';
    const roleSelect = document.getElementById('reg-role');
    if (roleSelect) roleSelect.value = 'customer';
    document.getElementById('login-error').style.display = 'none';
    document.getElementById('register-error').style.display = 'none';

    // Si se pide rol vendedor, mostrar pestaña de registro y seleccionar 'seller'
    if (preselectedRole === 'seller') {
        switchTab('register');
        if (roleSelect) roleSelect.value = 'seller';
    } else {
        switchTab('login');
    }
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.setAttribute('hidden', '');
}

function switchTab(tabId) {
    const tabs = document.querySelectorAll('.tab-btn');
    const forms = document.querySelectorAll('.auth-form');
    tabs.forEach(tab => tab.classList.remove('active'));
    forms.forEach(form => form.classList.remove('active'));
    document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(`${tabId}-form`).classList.add('active');
}

// Login
async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    if (!email || !password) {
        errorDiv.textContent = 'Completa todos los campos';
        errorDiv.style.display = 'block';
        return;
    }
    const btn = document.getElementById('login-submit');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ingresando...';
    errorDiv.style.display = 'none';
    try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        closeAuthModal();
        mostrarToast(`Bienvenido, ${email}`, 'ok');
        location.reload();
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Ingresar';
    }
}

// Register
async function handleRegister() {
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    const role = document.getElementById('reg-role').value;
    const errorDiv = document.getElementById('register-error');
    if (!email || !password || !confirm) {
        errorDiv.textContent = 'Todos los campos son obligatorios';
        errorDiv.style.display = 'block';
        return;
    }
    if (password.length < 6) {
        errorDiv.textContent = 'La contraseña debe tener al menos 6 caracteres';
        errorDiv.style.display = 'block';
        return;
    }
    if (password !== confirm) {
        errorDiv.textContent = 'Las contraseñas no coinciden';
        errorDiv.style.display = 'block';
        return;
    }
    const btn = document.getElementById('register-submit');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando cuenta...';
    errorDiv.style.display = 'none';
    try {
        // 1. Crear usuario en auth
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { role } }
        });
        if (error) throw error;
        const user = data.user;
        if (!user) throw new Error('Error al crear usuario');
        // 2. Crear perfil manualmente
        const { error: profileError } = await supabase
            .from('profiles')
            .insert([{ id: user.id, email, role }]);
        if (profileError) console.error('Error al crear perfil:', profileError);
        // 3. Iniciar sesión automáticamente
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        closeAuthModal();
        if (role === 'seller') {
            mostrarToast('Registro exitoso. Ahora puedes acceder al panel de vendedor.', 'info');
            setTimeout(() => window.location.href = '/admin.html', 1500);
        } else {
            mostrarToast('Registro exitoso. ¡Bienvenido!', 'ok');
            location.reload();
        }
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Crear cuenta';
    }
}

export function bindAuthEvents() {
    const modal = document.getElementById('auth-modal');
    const closeBtn = document.getElementById('auth-close');
    const tabs = document.querySelectorAll('.tab-btn');
    const loginBtn = document.getElementById('login-submit');
    const registerBtn = document.getElementById('register-submit');
    const userBtn = document.getElementById('user-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeAuthModal);
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeAuthModal(); });
    if (tabs) tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    if (loginBtn) loginBtn.addEventListener('click', handleLogin);
    if (registerBtn) registerBtn.addEventListener('click', handleRegister);
    if (userBtn && !currentUser) userBtn.addEventListener('click', openAuthModal);
    // Para cerrar el modal con Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.hasAttribute('hidden')) closeAuthModal();
    });
}