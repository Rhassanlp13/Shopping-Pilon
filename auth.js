// auth.js - Con reenvío de confirmación, restablecer contraseña y bienvenida en hero
import { supabase } from './supabase.js';
import { mostrarToast } from './modules/toast.js';
import { escapeHtml } from './utils/escape.js';

let currentUser = null;
let currentRole = null;

export async function initAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        await loadUserRole();
        await ensureProfile();
        updateUIForLoggedIn();
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

async function loadUserRole() {
    if (!currentUser) return;
    const cached = localStorage.getItem('user_role');
    const cachedExpiry = localStorage.getItem('user_role_expiry');
    if (cached && cachedExpiry && Date.now() < parseInt(cachedExpiry)) {
        currentRole = cached;
        return;
    }
    const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .maybeSingle();
    if (error) {
        console.error('Error al consultar perfil:', error);
        mostrarToast('Error al verificar tu cuenta. Intenta recargar la página.', 'error');
        currentRole = 'customer';
        return;
    }
    if (!data) {
        await supabase.from('profiles').upsert({ id: currentUser.id, email: currentUser.email, role: 'customer' }, { onConflict: 'id' });
        currentRole = 'customer';
        return;
    }
    let role = data.role;
    if (role === 'administrativo') role = 'admin';
    currentRole = role || 'customer';
    localStorage.setItem('user_role', currentRole);
    localStorage.setItem('user_role_expiry', Date.now() + 3600000);
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

function updateUIForLoggedIn() {
    const userBtn = document.getElementById('user-btn');
    if (!userBtn) return;
    const container = userBtn.parentNode;
    const oldDropdown = container.querySelector('.user-dropdown');
    if (oldDropdown) oldDropdown.remove();
    userBtn.innerHTML = `<i class="fas fa-user-check"></i>`;
    userBtn.style.cursor = 'pointer';
    userBtn.style.position = 'relative';
    const userMenu = document.createElement('div');
    userMenu.className = 'user-dropdown';
    const emailText = currentUser?.email || 'Usuario';
    userMenu.innerHTML = `
        <div class="user-dropdown-header">
            <i class="fas fa-envelope"></i> ${escapeHtml(emailText)}
        </div>
        ${(currentRole === 'seller' || currentRole === 'admin') ? `
        <a href="/admin.html" id="admin-link">
            <i class="fas fa-chalkboard-user"></i> Panel de vendedor
        </a>` : ''}
        <button id="logout-btn">
            <i class="fas fa-sign-out-alt"></i> Cerrar sesión
        </button>
    `;
    container.style.position = 'relative';
    container.appendChild(userMenu);
    const toggleDropdown = (e) => {
        e.stopPropagation();
        userMenu.classList.toggle('show');
    };
    userBtn.addEventListener('click', toggleDropdown);
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            userMenu.classList.remove('show');
        }
    });
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            mostrarToast('Sesión cerrada', 'info');
            location.reload();
        });
    }

    // Mensaje de bienvenida en el héroe
    const heroWelcome = document.getElementById('hero-welcome');
    const registerBtn = document.getElementById('btn-registro-vendedor');
    if (heroWelcome && registerBtn) {
        let userName = currentUser.user_metadata?.nombre ||
            currentUser.user_metadata?.full_name ||
            currentUser.email?.split('@')[0] ||
            'Usuario';
        const welcomeText = `✨ ¡Bienvenido, ${escapeHtml(userName)}! ✨`;
        document.getElementById('welcome-message').innerHTML = welcomeText;
        heroWelcome.style.display = 'block';
        registerBtn.style.display = 'none';
    }
}

function updateUIForLoggedOut() {
    const userBtn = document.getElementById('user-btn');
    if (!userBtn) return;
    userBtn.innerHTML = `<i class="fas fa-user"></i>`;
    const dropdown = userBtn.parentNode.querySelector('.user-dropdown');
    if (dropdown) dropdown.remove();
    const newUserBtn = userBtn.cloneNode(true);
    userBtn.parentNode.replaceChild(newUserBtn, userBtn);
    newUserBtn.addEventListener('click', () => openAuthModal());

    const heroWelcome = document.getElementById('hero-welcome');
    const registerBtn = document.getElementById('btn-registro-vendedor');
    if (heroWelcome && registerBtn) {
        heroWelcome.style.display = 'none';
        registerBtn.style.display = 'inline-flex';
    }
}

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
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        if (tab.dataset.tab === tabId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    if (tabId === 'login') {
        if (loginForm) loginForm.classList.add('active');
        if (registerForm) registerForm.classList.remove('active');
    } else {
        if (registerForm) registerForm.classList.add('active');
        if (loginForm) loginForm.classList.remove('active');
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
        mostrarToast(`Bienvenido, ${email}`, 'ok');
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

    // Validaciones básicas
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

    const btn = document.getElementById('register-submit');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando cuenta...';
    errorDiv.style.display = 'none';
    if (infoDiv) infoDiv.style.display = 'none';

    try {
        // Registrar usuario en Supabase con redirección personalizada
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: 'https://shopping-pilon.pages.dev/confirm-email.html',
                data: { role, nombre, telefono }
            }
        });

        if (error) throw error;

        const user = data.user;
        if (!user) throw new Error('Error al crear usuario');

        // Insertar perfil en tabla profiles
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: user.id,
                email,
                role,
                nombre_completo: nombre,
                telefono: telefono || null
            }, { onConflict: 'id' });

        if (profileError) {
            console.error('Error al guardar perfil:', profileError);
            mostrarToast('Usuario creado pero error al guardar perfil. Contacta al administrador.', 'error');
        } else {
            console.log('Perfil guardado correctamente para', email);
        }

        // Verificar si requiere confirmación de email
        if (user.confirmed_at === null) {
            // Mostrar mensaje de verificación en el formulario
            if (infoDiv) {
                infoDiv.innerHTML = '<i class="fas fa-envelope"></i> Te hemos enviado un correo de verificación. Revisa tu bandeja (incluye spam) y confirma tu cuenta. Luego inicia sesión.';
                infoDiv.style.display = 'block';
            }
            mostrarToast('✅ Revisa tu correo y confirma tu cuenta.', 'info');
            // Limpiar campos de contraseña
            document.getElementById('reg-password').value = '';
            document.getElementById('reg-confirm').value = '';
            // No cerramos el modal para que el usuario vea el mensaje
            btn.disabled = false;
            btn.innerHTML = 'Crear cuenta';
            return;
        }

        // Si no requiere confirmación (o ya está confirmado), iniciar sesión automáticamente
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
        console.error('Error en registro:', err);
        let mensaje = err.message || 'Error al registrar. Revisa tu conexión.';
        if (err.message && err.message.includes('email rate limit exceeded')) {
            mensaje = '📧 Demasiados intentos. Espera unos minutos y vuelve a intentar con el mismo correo o usa otro diferente.';
        }
        errorDiv.textContent = mensaje;
        errorDiv.style.display = 'block';
        mostrarToast(mensaje, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Crear cuenta';
    }
}

// ========== FUNCIONES PARA REENVIAR CONFIRMACIÓN Y RESTABLECER CONTRASEÑA ==========
async function resendConfirmationEmail() {
    const email = document.getElementById('login-email').value.trim() || document.getElementById('reg-email').value.trim();
    if (!email) {
        mostrarToast('Ingresa tu correo electrónico primero', 'warning');
        return;
    }
    const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
            emailRedirectTo: window.location.origin
        }
    });
    if (error) {
        mostrarToast(`Error: ${error.message}`, 'error');
    } else {
        mostrarToast(`✅ Se ha enviado un nuevo correo de confirmación a ${email}. Revisa tu bandeja (incluye spam).`, 'info');
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
        mostrarToast(`📧 Se ha enviado un enlace para restablecer tu contraseña a ${email}. Revisa tu correo.`, 'info');
    }
}
// =================================================================================

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

export function bindAuthEvents() {
    const modal = document.getElementById('auth-modal');
    const closeBtn = document.getElementById('auth-close');
    const loginBtn = document.getElementById('login-submit');
    const registerBtn = document.getElementById('register-submit');
    const userBtn = document.getElementById('user-btn');
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
    if (userBtn && !currentUser) userBtn.addEventListener('click', () => openAuthModal());

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.hasAttribute('hidden')) closeAuthModal();
    });

    // Pestañas
    const tabs = document.querySelectorAll('.tab-btn');
    function handleTabClick(e) {
        switchTab(e.currentTarget.dataset.tab);
    }
    tabs.forEach(tab => {
        tab.removeEventListener('click', handleTabClick);
        tab.addEventListener('click', handleTabClick);
    });

    // Enlaces de restablecer y reenviar confirmación
    if (forgotLink) forgotLink.addEventListener('click', (e) => { e.preventDefault(); resetPassword(); });
    if (resendLinkLogin) resendLinkLogin.addEventListener('click', (e) => { e.preventDefault(); resendConfirmationEmail(); });
    if (resendLinkRegister) resendLinkRegister.addEventListener('click', (e) => { e.preventDefault(); resendConfirmationEmail(); });

    // Delegación de eventos para el ojito
    document.body.addEventListener('click', function (e) {
        const icon = e.target.closest('.toggle-password');
        if (!icon) return;
        const targetId = icon.getAttribute('data-target');
        if (!targetId) return;
        const input = document.getElementById(targetId);
        if (!input) return;
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    });
}
