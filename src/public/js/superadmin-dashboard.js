class SuperadminDashboard {
    constructor() {
        this.currentUser = null;
        this.init();
    }
    
    goToUsersManagement() {
    window.location.href = '/superadmin/usuarios.html';
}


    async init() {
        await this.checkAuthentication();
        this.loadUserInfo();
        this.loadStatistics();
        this.setupEventListeners();
    }

    async checkAuthentication() {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (!token || !user.id) {
            this.redirectToLogin();
            return;
        }

        // Verificar token con el servidor
        try {
            const response = await fetch('/api/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Token inválido');
            }

            const data = await response.json();
            this.currentUser = data.usuario;

            // Verificar que sea superadmin
            if (this.currentUser.rol !== 'superadmin') {
                this.showMessage('No tienes permisos de superadministrador', 'error');
                setTimeout(() => this.redirectToLogin(), 2000);
                return;
            }

        } catch (error) {
            console.error('Error de autenticación:', error);
            this.redirectToLogin();
        }
    }

    loadUserInfo() {
        if (this.currentUser) {
            document.getElementById('userName').textContent = 
                `${this.currentUser.nombre} ${this.currentUser.apellido_paterno}`;
            document.getElementById('userRole').textContent = this.currentUser.rol;
        }
    }

    async loadStatistics() {
        try {
            const token = localStorage.getItem('token');
            
            // En una implementación real, estos vendrían de la API
            // Por ahora usamos datos de ejemplo
            setTimeout(() => {
                document.getElementById('totalUsers').textContent = '15';
                document.getElementById('totalStudents').textContent = '8';
                document.getElementById('totalAdmins').textContent = '2';
                document.getElementById('totalSecretarias').textContent = '3';
            }, 1000);

        } catch (error) {
            console.error('Error cargando estadísticas:', error);
        }
    }

    setupEventListeners() {
        // Navegación del sidebar
        const menuItems = document.querySelectorAll('.sidebar-menu a');
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Remover active de todos
                menuItems.forEach(i => i.classList.remove('active'));
                // Agregar active al clickeado
                item.classList.add('active');
                
                const section = item.getAttribute('onclick')?.replace('showSection(\'', '').replace('\')', '');
                if (section) {
                    this.showSection(section);
                }
            });
        });
    }

    showSection(sectionName) {
        const dashboardSection = document.getElementById('dashboard-section');
        const otherSections = document.getElementById('other-sections');
        
        // Por ahora solo mostramos el dashboard
        // En implementaciones futuras, cargaremos otras secciones aquí
        dashboardSection.style.display = 'block';
        otherSections.style.display = 'none';
        
        this.showMessage(`Sección ${sectionName} - En desarrollo`, 'info');
    }

    redirectToLogin() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    }

    showMessage(message, type) {
        // Remover mensajes anteriores
        const existingMessage = document.querySelector('.global-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Crear nuevo mensaje
        const messageDiv = document.createElement('div');
        messageDiv.className = `global-message message-${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 5px;
            font-weight: 500;
            z-index: 10000;
            background: ${type === 'error' ? '#fee' : 
                        type === 'success' ? '#efe' : '#eef'};
            color: ${type === 'error' ? '#c33' : 
                    type === 'success' ? '#363' : '#336'};
            border: 1px solid ${type === 'error' ? '#fcc' : 
                              type === 'success' ? '#cfc' : '#ccf'};
            box-shadow: var(--shadow);
        `;

        document.body.appendChild(messageDiv);

        // Auto-remover después de 5 segundos
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }
}

// Función global para logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

// Función global para mostrar secciones
function showSection(sectionName) {
    if (window.dashboard) {
        window.dashboard.showSection(sectionName);
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new SuperadminDashboard();
});