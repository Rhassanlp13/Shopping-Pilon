// auth.js - Con registro de vendedores pendientes de aprobación
import { supabase } from './supabase.js';
import { mostrarToast } from './modules/toast.js';
import { escapeHtml } from './utils/escape.js';

let currentUser = null;
let currentRole = null;

let _bodyListenersBound = false;
let _dropdownCloseHandler = null;

// Referencias a elementos del DOM
let userBtn = null;
let userMenu = null;

// ==================== INICIALIZACIÓN DEL BOTÓN Y MENÚ ====================
function initUserButtonAndMenu() {
    userBtn = document.getElementById('user-btn');
    if (!userBtn) {
        console.error('No se encontró #user-btn en el DOM');
        return;
    }
    const container = userBtn.parentNode;
    if (!container) return;
    container.style.position = 'relative';

    // Crear menú desplegable si no existe
    if (!userMenu) {
        userMenu = document.createElement('div');
        userMenu.className = 'user-dropdown';
        container.appendChild(userMenu);
    }

    // Limpiar event listeners antiguos (clonando y reemplazando)
    const newBtn = userBtn.cloneNode(true);
    userBtn.parentNode.replaceChild(newBtn, userBtn);
    userBtn = newBtn;
}

function toggleUserMenu() {
    if (!userMenu) return;
    userMenu.classList.toggle('show');
}

function closeUserMenu() {
    if (userMenu) userMenu.classList.remove('show');
}

// ==================== AUTENTICACIÓN PRINCIPAL ====================
export async function initAuth() {
    initUserButtonAndMenu();

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        await loadUserRole();
        await ensureProfile();
        updateUIForLoggedIn();
    } else {
        updateUIForLoggedOut();
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN') {
            currentUser = session.user;
            await loadUserRole();
            await ensureProfile();
            updateUIForLoggedIn();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            currentRole = null;
            updateUIForLoggedOut();
        }
    });
}

async function loadUserRole(forceRefresh = false) {
    if (!currentUser) return;
    if (!forceRefresh) {
        const cached = localStorage.getItem('user_role');
        const cachedExpiry = localStorage.getItem('user_role_expiry');
        if (cached && cachedExpiry && Date.now() < parseInt(cachedExpiry)) {
            currentRole = cached;
            return;
        }
    }
    const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .maybeSingle();
    if (error) {
        console.error('Error al consultar perfil:', error);
        currentRole = 'customer';
        return;
    }
    if (!data) {
        await supabase.from('profiles').upsert(
            { id: currentUser.id, email: currentUser.email, role: 'customer' },
            { onConflict: 'id' }
        );
        currentRole = 'customer';
        return;
    }
    let role = data.role;
    if (role === 'administrativo') role = 'admin';
    currentRole = role || 'customer';
    localStorage.setItem('user_role', currentRole);
    localStorage.setItem('user_role_expiry', Date.now() + 60 * 1000);
}

export async function refreshUserRole() {
    if (!currentUser) return;
    const oldRole = currentRole;
    await loadUserRole(true);
    if (oldRole !== currentRole) {
        updateUserMenuContent();
        mostrarToast('Tu rol ha sido actualizado', 'info');
    }
}

async function ensureProfile() {
    if (!currentUser) return;
    const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', currentUser.id)
        .maybeSingle();
    if (error) {
        console.error('Error al verificar perfil:', error);
        return;
    }
    if (!data) {
        const { error: insertError } = await supabase
            .from('profiles')
            .insert({
                id: currentUser.id,
                email: currentUser.email,
                role: 'customer',
                nombre_completo: currentUser.user_metadata?.nombre || currentUser.user_metadata?.full_name || '',
                telefono: currentUser.user_metadata?.telefono || null
            });
        if (insertError) {
            console.error('Error al crear perfil:', insertError);
        } else {
            console.log('Perfil creado automáticamente para', currentUser.email);
        }
    }
}

// ==================== ACTUALIZACIÓN DE UI ====================
function updateUserMenuContent() {
    if (!userMenu) return;
    const emailText = currentUser?.email || 'Usuario';
    userMenu.innerHTML = `
        <div class="user-dropdown-header">
            <i class="fas fa-envelope"></i> ${escapeHtml(emailText)}
        </div>
        ${(currentRole === 'seller' || currentRole === 'admin') ? `
        <a href="/admin.html" id="admin-link">
            <i class="fas fa-chalkboard-user"></i> Panel de vendedor
        </a>` : ''}
        ${(currentRole === 'customer') ? `
        <button id="request-seller-btn">
            <i class="fas fa-store"></i> Solicitar ser vendedor
        </button>` : ''}
        ${(currentRole === 'pending_seller') ? `
        <div class="user-dropdown-pending">
            <i class="fas fa-clock"></i> Solicitud pendiente de aprobación
        </div>` : ''}
        <button id="logout-btn-dropdown">
            <i class="fas fa-sign-out-alt"></i> Cerrar sesión
        </button>
    `;

    const requestBtn = userMenu.querySelector('#request-seller-btn');
    if (requestBtn) {
        requestBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await solicitarSerVendedor();
            closeUserMenu();
        });
    }
    const logoutBtn = userMenu.querySelector('#logout-btn-dropdown');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await supabase.auth.signOut();
            localStorage.removeItem('user_role');
            localStorage.removeItem('user_role_expiry');
            currentUser = null;
            currentRole = null;
            mostrarToast('Sesión cerrada', 'info');
            setTimeout(() => location.reload(), 200);
        });
    }
}

function updateUIForLoggedIn() {
    if (!userBtn) initUserButtonAndMenu();
    if (!userBtn) return;

    // Cambiar icono y comportamiento
    userBtn.innerHTML = '<i class="fas fa-user-check"></i>';
    userBtn.removeEventListener('click', userBtn._listener); // Limpiar listener anterior
    const clickHandler = (e) => {
        e.stopPropagation();
        toggleUserMenu();
    };
    userBtn.addEventListener('click', clickHandler);
    userBtn._listener = clickHandler;

    // Construir menú
    updateUserMenuContent();

    // Cerrar menú al hacer clic fuera
    if (_dropdownCloseHandler) {
        document.removeEventListener('click', _dropdownCloseHandler);
    }
    _dropdownCloseHandler = (e) => {
        if (userMenu && !userMenu.contains(e.target) && e.target !== userBtn) {
            closeUserMenu();
        }
    };
    document.addEventListener('click', _dropdownCloseHandler);

    // Mostrar bienvenida y ocultar botones de registro/ayuda
    const heroWelcome = document.getElementById('hero-welcome');
    const registerBtn = document.getElementById('btn-registro-vendedor');
    if (heroWelcome && registerBtn) {
        const userName =
            currentUser.user_metadata?.nombre ||
            currentUser.user_metadata?.full_name ||
            currentUser.email?.split('@')[0] ||
            'Usuario';
        document.getElementById('welcome-message').innerHTML =
            `✨ ¡Bienvenido, ${escapeHtml(userName)}! ✨`;
        heroWelcome.style.display = 'block';
        registerBtn.style.display = 'none';
    }
    const helpBtn = document.getElementById('help-seller-btn');
    if (helpBtn) helpBtn.style.display = 'none';
}

function updateUIForLoggedOut() {
    if (!userBtn) initUserButtonAndMenu();
    if (!userBtn) return;

    // Cambiar icono y comportamiento: abre modal de login
    userBtn.innerHTML = '<i class="fas fa-user"></i>';
    userBtn.removeEventListener('click', userBtn._listener);
    const clickHandler = (e) => {
        e.stopPropagation();
        openAuthModal();
    };
    userBtn.addEventListener('click', clickHandler);
    userBtn._listener = clickHandler;

    // Vaciar menú y ocultarlo
    if (userMenu) {
        userMenu.innerHTML = '';
        userMenu.classList.remove('show');
    }

    if (_dropdownCloseHandler) {
        document.removeEventListener('click', _dropdownCloseHandler);
        _dropdownCloseHandler = null;
    }

    const heroWelcome = document.getElementById('hero-welcome');
    const registerBtn = document.getElementById('btn-registro-vendedor');
    if (heroWelcome && registerBtn) {
        heroWelcome.style.display = 'none';
        registerBtn.style.display = 'inline-flex';
    }
    const helpBtn = document.getElementById('help-seller-btn');
    if (helpBtn) helpBtn.style.display = 'inline-flex';
}

// ==================== SOLICITAR SER VENDEDOR ====================
export async function solicitarSerVendedor() {
    if (!currentUser) {
        mostrarToast('Debes iniciar sesión para solicitar ser vendedor', 'warning');
        return;
    }
    if (currentRole !== 'customer') {
        mostrarToast('Ya tienes una solicitud pendiente o ya eres vendedor', 'warning');
        return;
    }
    const { error } = await supabase
        .from('profiles')
        .update({ role: 'pending_seller' })
        .eq('id', currentUser.id);
    if (error) {
        console.error(error);
        mostrarToast('Error al enviar solicitud. Intenta de nuevo.', 'error');
    } else {
        mostrarToast('✅ Solicitud enviada. El administrador revisará tu petición.', 'info');
        await refreshUserRole();
    }
}

// ==================== MODAL DE AUTENTICACIÓN ====================
export function openAuthModal(preselectedRole = null) {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.removeAttribute('hidden');
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('reg-nombre').value = '';
    document.getElementById('reg-email').value = '';
    document.getElementById('reg-telefono').value = '';
    document.getElementById('reg-password').value = '';
    document.getElementById('reg-confirm').value = '';
    const roleSelect = document.getElementById('reg-role');
    if (roleSelect) roleSelect.value = 'customer';
    document.getElementById('login-error').style.display = 'none';
    document.getElementById('register-error').style.display = 'none';
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
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabId);
    });
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    if (tabId === 'login') {
        loginForm?.classList.add('active');
        registerForm?.classList.remove('active');
    } else {
        registerForm?.classList.add('active');
        loginForm?.classList.remove('active');
    }
}

function validarTelefonoCubano(tel) {
    if (!tel) return false;
    const cleaned = tel.replace(/\s+/g, '');
    return /^5[0-9]{7}$/.test(cleaned);
}

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
        mostrarToast(`Bienvenido, ${escapeHtml(email)}`, 'ok');
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Ingresar';
    }
}

async function handleRegister() {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const telefono = document.getElementById('reg-telefono').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    const role = document.getElementById('reg-role').value;
    const errorDiv = document.getElementById('register-error');
    const infoDiv = document.getElementById('register-info');

    if (!nombre || !email || !password || !confirm) {
        errorDiv.textContent = 'Todos los campos son obligatorios';
        errorDiv.style.display = 'block';
        if (infoDiv) infoDiv.style.display = 'none';
        return;
    }
    if (password.length < 6) {
        errorDiv.textContent = 'La contraseña debe tener al menos 6 caracteres';
        errorDiv.style.display = 'block';
        if (infoDiv) infoDiv.style.display = 'none';
        return;
    }
    if (password !== confirm) {
        errorDiv.textContent = 'Las contraseñas no coinciden';
        errorDiv.style.display = 'block';
        if (infoDiv) infoDiv.style.display = 'none';
        return;
    }
    if (role === 'seller' && telefono && !validarTelefonoCubano(telefono)) {
        errorDiv.textContent = 'Teléfono cubano inválido (formato: 5XXXXXXX)';
        errorDiv.style.display = 'block';
        if (infoDiv) infoDiv.style.display = 'none';
        return;
    }

    const finalRole = (role === 'seller') ? 'pending_seller' : role;

    const btn = document.getElementById('register-submit');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando cuenta...';
    errorDiv.style.display = 'none';
    if (infoDiv) infoDiv.style.display = 'none';

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: 'https://shopping-pilon.pages.dev/confirm-email.html',
                data: { role: finalRole, nombre, telefono }
            }
        });
        if (error) throw error;
        const user = data.user;
        if (!user) throw new Error('Error al crear usuario');

        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: user.id,
                email,
                role: finalRole,
                nombre_completo: nombre,
                telefono: telefono || null
            }, { onConflict: 'id' });

        if (profileError) {
            console.error('Error al guardar perfil:', profileError);
            mostrarToast('Error al crear perfil. Contacta al administrador.', 'error');
            btn.disabled = false;
            btn.innerHTML = 'Crear cuenta';
            return;
        }

        if (user.confirmed_at === null) {
            if (infoDiv) {
                infoDiv.innerHTML = '<i class="fas fa-envelope"></i> Te hemos enviado un correo de verificación. Revisa tu bandeja (incluye spam) y confirma tu cuenta. Luego inicia sesión.';
                infoDiv.style.display = 'block';
            }
            mostrarToast('✅ Revisa tu correo y confirma tu cuenta.', 'info');
            document.getElementById('reg-password').value = '';
            document.getElementById('reg-confirm').value = '';
            return;
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        closeAuthModal();

        if (finalRole === 'pending_seller') {
            mostrarToast('Registro exitoso. Tu cuenta será revisada por un administrador.', 'info');
            setTimeout(() => location.reload(), 2000);
        } else if (finalRole === 'seller') {
            mostrarToast('Registro exitoso. Ahora puedes acceder al panel de vendedor.', 'info');
            setTimeout(() => window.location.href = '/admin.html', 1500);
        } else {
            mostrarToast('Registro exitoso. ¡Bienvenido!', 'ok');
            location.reload();
        }
    } catch (err) {
        console.error('Error en registro:', err);
        let mensaje = err.message || 'Error al registrar. Revisa tu conexión.';
        if (err.message?.includes('email rate limit exceeded')) {
            mensaje = '📧 Demasiados intentos. Espera unos minutos y vuelve a intentar.';
        }
        errorDiv.textContent = mensaje;
        errorDiv.style.display = 'block';
        mostrarToast(mensaje, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Crear cuenta';
    }
}

async function resendConfirmationEmail() {
    const email =
        document.getElementById('login-email').value.trim() ||
        document.getElementById('reg-email').value.trim();
    if (!email) {
        mostrarToast('Ingresa tu correo electrónico primero', 'warning');
        return;
    }
    const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: window.location.origin }
    });
    if (error) {
        mostrarToast(`Error: ${error.message}`, 'error');
    } else {
        mostrarToast(`✅ Correo de confirmación enviado a ${escapeHtml(email)}. Revisa spam.`, 'info');
    }
}

async function resetPassword() {
    const email = document.getElementById('login-email').value.trim();
    if (!email) {
        mostrarToast('Ingresa tu correo electrónico para restablecer la contraseña', 'warning');
        return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password.html`
    });
    if (error) {
        mostrarToast(`Error: ${error.message}`, 'error');
    } else {
        mostrarToast(`📧 Enlace de restablecimiento enviado a ${escapeHtml(email)}.`, 'info');
    }
}

async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
    });
    if (error) mostrarToast(error.message, 'error');
}

async function signInWithFacebook() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: { redirectTo: window.location.origin }
    });
    if (error) mostrarToast(error.message, 'error');
}

// ==================== EVENTOS GLOBALES ====================
export function bindAuthEvents() {
    if (_bodyListenersBound) return;
    _bodyListenersBound = true;

    const modal = document.getElementById('auth-modal');
    const closeBtn = document.getElementById('auth-close');
    const loginBtn = document.getElementById('login-submit');
    const registerBtn = document.getElementById('register-submit');
    const btnRegistroVendedor = document.getElementById('btn-registro-vendedor');
    const footerRegistro = document.getElementById('footer-registro');
    const googleBtn = document.getElementById('login-google');
    const facebookBtn = document.getElementById('login-facebook');
    const forgotLink = document.getElementById('forgot-password-link');
    const resendLinkLogin = document.getElementById('resend-confirm-link');
    const resendLinkRegister = document.getElementById('resend-confirm-register');

    if (closeBtn) closeBtn.addEventListener('click', closeAuthModal);
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeAuthModal(); });
    if (loginBtn) loginBtn.addEventListener('click', handleLogin);
    if (registerBtn) registerBtn.addEventListener('click', handleRegister);
    if (googleBtn) googleBtn.addEventListener('click', signInWithGoogle);
    if (facebookBtn) facebookBtn.addEventListener('click', signInWithFacebook);
    if (forgotLink) forgotLink.addEventListener('click', (e) => { e.preventDefault(); resetPassword(); });
    if (resendLinkLogin) resendLinkLogin.addEventListener('click', (e) => { e.preventDefault(); resendConfirmationEmail(); });
    if (resendLinkRegister) resendLinkRegister.addEventListener('click', (e) => { e.preventDefault(); resendConfirmationEmail(); });

    if (btnRegistroVendedor) {
        btnRegistroVendedor.addEventListener('click', (e) => {
            e.preventDefault();
            openAuthModal('seller');
        });
    }
    if (footerRegistro) {
        footerRegistro.addEventListener('click', (e) => {
            e.preventDefault();
            openAuthModal('seller');
        });
    }

    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => switchTab(e.currentTarget.dataset.tab));
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.hasAttribute('hidden')) {
            closeAuthModal();
        }
    });
}

// Inicializar el botón al cargar el DOM (por si se llama desde app.js)
document.addEventListener('DOMContentLoaded', () => {
    initUserButtonAndMenu();
});