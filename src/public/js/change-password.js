class ChangePassword {
    constructor() {
        this.init();
    }

    init() {
        this.form = document.getElementById('changePasswordForm');
        this.submitBtn = document.getElementById('changePasswordBtn');
        this.btnText = this.submitBtn.querySelector('.btn-text');
        this.btnLoader = this.submitBtn.querySelector('.btn-loader');
        
        this.nuevaPassword = document.getElementById('nueva_password');
        this.confirmarPassword = document.getElementById('confirmar_password');
        this.passwordStrength = document.getElementById('passwordStrength');
        this.passwordMatch = document.getElementById('passwordMatch');

        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Validación en tiempo real
        this.nuevaPassword.addEventListener('input', () => this.validatePassword());
        this.confirmarPassword.addEventListener('input', () => this.validatePasswordMatch());
        
        // Verificar autenticación
        this.checkAuthentication();
    }

    async checkAuthentication() {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (!token || !user.id) {
            this.showMessage('Debe iniciar sesión primero', 'error');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
            return;
        }

        // Verificar si realmente necesita cambiar la contraseña
        if (user.rol === 'estudiante' || !user.debe_cambiar_password) {
            this.redirectToDashboard(user.rol);
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const nuevaPassword = this.nuevaPassword.value;
        const confirmarPassword = this.confirmarPassword.value;

        if (!this.validateForm(nuevaPassword, confirmarPassword)) {
            return;
        }

        this.setLoading(true);

        try {
            const token = localStorage.getItem('token');
            const user = JSON.parse(localStorage.getItem('user') || '{}');

            const response = await fetch('/api/auth/cambiar-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    usuario_id: user.id,
                    nueva_password: nuevaPassword
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showMessage('¡Contraseña cambiada exitosamente!', 'success');
                
                // Actualizar estado local
                user.debe_cambiar_password = false;
                localStorage.setItem('user', JSON.stringify(user));
                
                // Redirigir al dashboard
                setTimeout(() => {
                    this.redirectToDashboard(user.rol);
                }, 2000);
            } else {
                this.showMessage(data.error || 'Error al cambiar contraseña', 'error');
            }

        } catch (error) {
            console.error('Error:', error);
            this.showMessage('Error de conexión con el servidor', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    validateForm(nuevaPassword, confirmarPassword) {
        // Validar fortaleza de contraseña
        const strength = this.checkPasswordStrength(nuevaPassword);
        if (strength.score < 2) {
            this.showMessage('La contraseña es muy débil. Mejórela.', 'error');
            return false;
        }

        // Validar que las contraseñas coincidan
        if (nuevaPassword !== confirmarPassword) {
            this.showMessage('Las contraseñas no coinciden', 'error');
            return false;
        }

        return true;
    }

    validatePassword() {
        const password = this.nuevaPassword.value;
        const strength = this.checkPasswordStrength(password);
        
        // Actualizar barra de fortaleza
        this.updateStrengthBar(strength);
        
        // Actualizar requisitos
        this.updateRequirements(strength);
    }

    validatePasswordMatch() {
        const password = this.nuevaPassword.value;
        const confirm = this.confirmarPassword.value;
        
        if (confirm === '') {
            this.passwordMatch.textContent = '';
            this.passwordMatch.style.color = '';
            return;
        }
        
        if (password === confirm) {
            this.passwordMatch.textContent = '✓ Las contraseñas coinciden';
            this.passwordMatch.style.color = 'var(--success-color)';
        } else {
            this.passwordMatch.textContent = '✗ Las contraseñas no coinciden';
            this.passwordMatch.style.color = 'var(--danger-color)';
        }
    }

    checkPasswordStrength(password) {
        const requirements = {
            length: password.length >= 6,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password)
        };

        // Calcular puntaje
        let score = 0;
        if (requirements.length) score += 1;
        if (requirements.uppercase) score += 1;
        if (requirements.lowercase) score += 1;
        if (requirements.number) score += 1;

        return {
            requirements,
            score,
            level: score < 2 ? 'weak' : 
                   score < 3 ? 'medium' : 
                   score < 4 ? 'strong' : 'very-strong'
        };
    }

    updateStrengthBar(strength) {
        this.passwordStrength.className = 'strength-bar';
        
        switch(strength.level) {
            case 'weak':
                this.passwordStrength.classList.add('strength-weak');
                break;
            case 'medium':
                this.passwordStrength.classList.add('strength-medium');
                break;
            case 'strong':
                this.passwordStrength.classList.add('strength-strong');
                break;
            case 'very-strong':
                this.passwordStrength.classList.add('strength-very-strong');
                break;
        }
    }

    updateRequirements(strength) {
        const reqIds = ['length', 'uppercase', 'lowercase', 'number'];
        
        reqIds.forEach(req => {
            const element = document.getElementById(`req-${req}`);
            if (element) {
                if (strength.requirements[req]) {
                    element.classList.add('requirement-met');
                    element.classList.remove('requirement-not-met');
                } else {
                    element.classList.add('requirement-not-met');
                    element.classList.remove('requirement-met');
                }
            }
        });
    }

    setLoading(loading) {
        if (loading) {
            this.btnText.style.display = 'none';
            this.btnLoader.style.display = 'block';
            this.submitBtn.disabled = true;
        } else {
            this.btnText.style.display = 'block';
            this.btnLoader.style.display = 'none';
            this.submitBtn.disabled = false;
        }
    }

    redirectToDashboard(rol) {
    let dashboardUrl = '';
    
    switch(rol) {
        case 'superadmin':
            dashboardUrl = '/superadmin/dashboard.html';
            break;
        case 'admin':
            dashboardUrl = '/admin/dashboard.html';
            break;
        case 'secretaria':
            dashboardUrl = '/secretaria/dashboard.html';
            break;
        case 'estudiante':
            dashboardUrl = '/estudiante/dashboard.html';
            break;
        default:
            dashboardUrl = '/';
    }
    
    window.location.href = dashboardUrl;
}

    showMessage(message, type) {
        // Remover mensajes anteriores
        const existingMessage = document.querySelector('.message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Crear nuevo mensaje
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            padding: 12px;
            margin: 10px 0;
            border-radius: 5px;
            text-align: center;
            font-weight: 500;
            background: ${type === 'error' ? '#fee' : '#efe'};
            color: ${type === 'error' ? '#c33' : '#363'};
            border: 1px solid ${type === 'error' ? '#fcc' : '#cfc'};
        `;

        this.form.insertBefore(messageDiv, this.form.firstChild);

        // Auto-remover después de 5 segundos
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new ChangePassword();
});