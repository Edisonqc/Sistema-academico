class AuthSystem {
    constructor() {
        this.init();
    }

    init() {
        console.log('🔐 Inicializando sistema de autenticación...');
        this.setupEventListeners();
        this.checkExistingSession();
        this.loadDemoAccounts();
    }

    setupEventListeners() {
        const loginForm = document.getElementById('loginForm');
        const dniInput = document.getElementById('dni');
        const passwordInput = document.getElementById('password');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Enter key support
        if (dniInput && passwordInput) {
            dniInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    passwordInput.focus();
                }
            });

            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleLogin();
                }
            });
        }

        console.log('✅ Event listeners configurados');
    }

    async handleLogin() {
        const dni = document.getElementById('dni').value.trim();
        const password = document.getElementById('password').value;
        const loginBtn = document.getElementById('loginBtn');
        const errorDiv = document.getElementById('error-message');

        // Reset error
        if (errorDiv) {
            errorDiv.style.display = 'none';
            errorDiv.textContent = '';
        }

        // Validaciones básicas
        if (!dni || !password) {
            this.showError('Por favor, complete todos los campos');
            return;
        }

        if (dni.length !== 8) {
            this.showError('El DNI debe tener 8 dígitos');
            return;
        }

        // Mostrar loading
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.innerHTML = '⏳ Ingresando...';
        }

        try {
            console.log('🔐 Intentando login para DNI:', dni);

            // Intentar con la API normal primero
            let response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ dni, password })
            });

            let data;

            // Si falla la API normal, intentar con emergencia
            if (!response.ok) {
                console.log('⚠️ API normal falló, intentando emergencia...');
                response = await fetch('/api/auth/login-emergencia', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ dni, password })
                });
            }

            data = await response.json();
            console.log('📡 Respuesta del servidor:', data);

            if (response.ok && data.success) {
                this.loginSuccess(data);
            } else {
                throw new Error(data.error || 'Error de conexión con el servidor');
            }

        } catch (error) {
            console.error('❌ Error en login:', error);
            this.showError(error.message || 'Error de conexión con el servidor');
        } finally {
            // Restaurar botón
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.innerHTML = 'Ingresar';
            }
        }
    }

    loginSuccess(data) {
    console.log('✅ Login exitoso:', data);
    
    // La API devuelve "usuario" en lugar de "user"
    const userData = data.usuario || data.user;
    
    if (!userData || !userData.rol) {
        console.error('❌ Estructura de respuesta inválida:', data);
        this.showError('Error en la respuesta del servidor');
        return;
    }

    // Guardar en localStorage
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(userData));

    this.showMessage('✅ Login exitoso! Redirigiendo...', 'success');

    // Redirigir según el rol
    setTimeout(() => {
        if (userData.rol === 'estudiante') {
            window.location.href = '/estudiante/dashboard.html';
        } else {
            window.location.href = '/superadmin/dashboard.html';
        }
    }, 1000);
}

    showError(message) {
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
        
        // También mostrar en consola
        console.error('❌ Error de login:', message);
    }

    showMessage(message, type = 'success') {
        // Crear elemento de mensaje
        const messageDiv = document.createElement('div');
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 5px;
            font-weight: 500;
            z-index: 10000;
            background: ${type === 'success' ? '#d4edda' : '#f8d7da'};
            color: ${type === 'success' ? '#155724' : '#721c24'};
            border: 1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'};
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        `;

        document.body.appendChild(messageDiv);

        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 3000);
    }

    checkExistingSession() {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (token && user.rol) {
            console.log('📱 Sesión existente encontrada:', user.rol);
            // Auto-redirigir si hay sesión
            if (user.rol === 'estudiante') {
                window.location.href = '/estudiante/dashboard.html';
            } else {
                window.location.href = '/superadmin/dashboard.html';
            }
        }
    }

    loadDemoAccounts() {
        console.log('👥 Cargando cuentas de demostración...');
        // Las cuentas ya están hardcodeadas en el HTML
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    window.authSystem = new AuthSystem();
    console.log('✅ Sistema de autenticación inicializado');
});

// Función global para cambiar tema
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    console.log('🎨 Tema cambiado a:', newTheme);
}

// Cargar tema guardado
document.addEventListener('DOMContentLoaded', function() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
});