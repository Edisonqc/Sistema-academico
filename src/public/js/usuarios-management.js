class UsuariosManagement {
    constructor() {
        this.currentPage = 1;
        this.limit = 10;
        this.search = '';
        this.init();
    }

    async init() {
        await this.checkAuthentication();
        this.loadUserInfo();
        this.loadUsers();
        this.setupEventListeners();
    }

    async checkAuthentication() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!token || !user.id) {
        this.redirectToLogin();
        return;
    }

    try {
        const response = await fetch('/api/auth/verify', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Token inválido');

        const data = await response.json();
        
        // ✅ PERMITIR A SUPERADMIN Y SECRETARIA
        if (data.usuario.rol !== 'superadmin' && data.usuario.rol !== 'secretaria') {
            this.showMessage('No tienes permisos para gestionar usuarios', 'error');
            setTimeout(() => this.redirectToLogin(), 2000);
            return;
        }

    } catch (error) {
        console.error('Error de autenticación:', error);
        this.redirectToLogin();
    }
}

    loadUserInfo() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user) {
            document.getElementById('userName').textContent = 
                `${user.nombre} ${user.apellido_paterno}`;
            document.getElementById('userRole').textContent = user.rol;
        }
    }

    async loadUsers() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `/api/usuarios?page=${this.currentPage}&limit=${this.limit}&search=${this.search}`,
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );

            if (!response.ok) throw new Error('Error cargando usuarios');

            const data = await response.json();
            this.renderUsers(data.usuarios);
            this.renderPagination(data.pagination);

        } catch (error) {
            console.error('Error:', error);
            this.showMessage('Error cargando usuarios', 'error');
        }
    }

    renderUsers(usuarios) {
        const tbody = document.getElementById('usersTableBody');
        
        if (usuarios.length === 0) {
            tbody.innerHTML = '<div class="loading">No se encontraron usuarios</div>';
            return;
        }

        tbody.innerHTML = usuarios.map(usuario => `
            <div class="table-row">
                <div>${usuario.id}</div>
                <div>${usuario.dni}</div>
                <div>${usuario.nombre} ${usuario.apellido_paterno} ${usuario.apellido_materno || ''}</div>
                <div>
                    <span class="role-badge role-${usuario.rol}">
                        ${this.getRoleName(usuario.rol)}
                    </span>
                </div>
                <div>
                    ${usuario.email || 'N/A'}<br>
                    <small>${usuario.telefono || 'N/A'}</small>
                </div>
                <div>
                    <span class="status-badge ${usuario.activo ? 'status-active' : 'status-inactive'}">
                        ${usuario.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </div>
                <div class="action-buttons">
                    <button class="btn-action btn-edit" onclick="editUser(${usuario.id})">Editar</button>
                    <button class="btn-action btn-reset" onclick="resetPassword(${usuario.id})">Reset Pass</button>
                    <!-- 🆕 BOTÓN DE PERMISOS PARA TODOS LOS ROLES EXCEPTO ESTUDIANTES -->
                    ${usuario.rol !== 'estudiante' ? `
                        <button class="btn-action btn-permissions" onclick="showUserPermissionsModal(${usuario.id})">
                            🔐 Permisos
                        </button>
                    ` : ''}
                    ${usuario.rol !== 'superadmin' ? `
                        <button class="btn-action btn-delete" onclick="toggleUserStatus(${usuario.id}, ${!usuario.activo})">
                            ${usuario.activo ? 'Desactivar' : 'Activar'}
                        </button>` : ''}
                </div>
            </div>
        `).join('');
    }

    renderPagination(pagination) {
        const paginationDiv = document.getElementById('pagination');
        const { page, pages, total } = pagination;

        paginationDiv.innerHTML = `
            <button ${page === 1 ? 'disabled' : ''} onclick="changePage(${page - 1})">Anterior</button>
            <span>Página ${page} de ${pages} (${total} usuarios)</span>
            <button ${page === pages ? 'disabled' : ''} onclick="changePage(${page + 1})">Siguiente</button>
        `;
    }

    getRoleName(rol) {
        const roles = {
            'superadmin': 'Super Admin',
            'admin': 'Administrador',
            'secretaria': 'Secretaria',
            'estudiante': 'Estudiante'
        };
        return roles[rol] || rol;
    }

    setupEventListeners() {
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchUsers();
        });

        document.getElementById('userForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveUser();
        });
    }

    searchUsers() {
        this.search = document.getElementById('searchInput').value;
        this.currentPage = 1;
        this.loadUsers();
    }

    async saveUser() {
        try {
            const token = localStorage.getItem('token');
            const userId = document.getElementById('userId').value;

            const userData = {
                dni: document.getElementById('dni').value.trim(),
                rol: document.getElementById('rol').value,
                nombre: document.getElementById('nombre').value.trim(),
                apellido_paterno: document.getElementById('apellido_paterno').value.trim(),
                apellido_materno: document.getElementById('apellido_materno').value.trim(),
                email: document.getElementById('email').value.trim(),
                telefono: document.getElementById('telefono').value.trim()
            };

            if (!userId) {
                userData.password = document.getElementById('password').value;
            }

            const url = userId ? `/api/usuarios/${userId}` : '/api/usuarios';
            const method = userId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (response.ok) {
                this.showMessage(data.message, 'success');
                this.closeUserModal();
                this.loadUsers();
            } else {
                this.showMessage(data.error || 'Error guardando usuario', 'error');
            }

        } catch (error) {
            console.error('Error:', error);
            this.showMessage('Error guardando usuario', 'error');
        }
    }

    showAddUserModal() {
        document.getElementById('modalTitle').textContent = 'Agregar Usuario';
        document.getElementById('userForm').reset();
        document.getElementById('userId').value = '';
        document.getElementById('passwordField').style.display = 'block';
        document.getElementById('password').required = true;
        document.getElementById('userModal').style.display = 'block';
    }

    closeUserModal() {
        document.getElementById('userModal').style.display = 'none';
    }

    showMessage(message, type) {
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
            background: ${type === 'error' ? '#fee' : '#efe'};
            color: ${type === 'error' ? '#c33' : '#363'};
            border: 1px solid ${type === 'error' ? '#fcc' : '#cfc'};
            box-shadow: var(--shadow);
        `;
        document.body.appendChild(messageDiv);
        setTimeout(() => messageDiv.remove(), 5000);
    }

    redirectToLogin() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    }
}

// -------- FUNCIONES GLOBALES --------

let usuariosManager;

function goToDashboard() {
    window.location.href = '/superadmin/dashboard.html';
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

function searchUsers() {
    usuariosManager.searchUsers();
}

function changePage(page) {
    usuariosManager.currentPage = page;
    usuariosManager.loadUsers();
}

function showAddUserModal() {
    usuariosManager.showAddUserModal();
}

function closeUserModal() {
    usuariosManager.closeUserModal();
}

// 🆕 FUNCIÓN PARA MODAL DE PERMISOS SIMPLIFICADO
async function showUserPermissionsModal(userId) {
    try {
        const token = localStorage.getItem('token');
        
        // Cargar datos del usuario
        const userResponse = await fetch(`/api/usuarios/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!userResponse.ok) throw new Error('Error cargando usuario');
        
        const { usuario } = await userResponse.json();
        
        // VALIDAR QUE EL USUARIO SEA ADMIN O SECRETARIA
        if (usuario.rol === 'estudiante') {
            usuariosManager.showMessage('Los estudiantes no requieren gestión de permisos', 'info');
            return;
        }

        // Crear modal HTML SIMPLIFICADO - SOLO UN BOTÓN POR MÓDULO
        const modalHTML = `
            <div id="userPermissionsModal" class="modal" style="display: block;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>🔐 Permisos para ${usuario.nombre}</h3>
                        <span class="close" onclick="closeUserPermissionsModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="user-info">
                            <p><strong>Usuario:</strong> ${usuario.nombre} ${usuario.apellido_paterno}</p>
                            <p><strong>Rol:</strong> <span class="badge role-${usuario.rol}">${usuario.rol}</span></p>
                            <p><strong>DNI:</strong> ${usuario.dni}</p>
                        </div>
                        
                        <div class="permissions-list">
                            <h4>Selecciona los módulos permitidos:</h4>
                            
                            <div class="permission-buttons-simple">
                                <button class="perm-btn-simple" data-modulo="dashboard">
                                    📊 Dashboard
                                </button>
                                <button class="perm-btn-simple" data-modulo="usuarios">
                                    👥 Gestión de Usuarios
                                </button>
                                <button class="perm-btn-simple" data-modulo="estudiantes">
                                    🎓 Estudiantes
                                </button>
                                <button class="perm-btn-simple" data-modulo="matriculas">
                                    📝 Matrículas
                                </button>
                                <button class="perm-btn-simple" data-modulo="ciclos">
                                    📚 Ciclos Académicos
                                </button>
                                <button class="perm-btn-simple" data-modulo="pagos">
                                    💰 Control de Pagos
                                </button>
                                <button class="perm-btn-simple" data-modulo="asistencias">
                                    ✅ Asistencias
                                </button>
                                <button class="perm-btn-simple" data-modulo="reportes">
                                    📈 Reportes
                                </button>
                                <button class="perm-btn-simple" data-modulo="seguridad">
                                    🔐 Seguridad
                                </button>
                                <button class="perm-btn-simple" data-modulo="configuracion">
                                    ⚙️ Configuración
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="closeUserPermissionsModal()">Cerrar</button>
                        <button class="btn btn-primary" onclick="saveAllPermissions(${usuario.id})">💾 Guardar Cambios</button>
                    </div>
                </div>
            </div>
        `;

        // Remover modal existente si hay
        const existingModal = document.getElementById('userPermissionsModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Agregar nuevo modal
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // AGREGAR EVENT LISTENERS A LOS BOTONES
        setTimeout(() => {
            const botones = document.querySelectorAll('.perm-btn-simple');
            botones.forEach(boton => {
                boton.addEventListener('click', function() {
                    toggleUserPermission(this);
                });
            });
        }, 100);

    } catch (error) {
        console.error('Error:', error);
        usuariosManager.showMessage('Error cargando permisos', 'error');
    }
}

// 🆕 FUNCIÓN PARA CERRAR MODAL DE PERMISOS
function closeUserPermissionsModal() {
    const modal = document.getElementById('userPermissionsModal');
    if (modal) {
        modal.remove();
    }
}

// 🆕 FUNCIÓN PARA CAMBIAR PERMISO
function toggleUserPermission(boton) {
    const isActive = boton.classList.contains('active');
    
    if (isActive) {
        boton.classList.remove('active');
        boton.style.background = '#f8f9fa';
        boton.style.border = '1px solid #dee2e6';
        boton.style.color = '#000';
    } else {
        boton.classList.add('active');
        boton.style.background = '#007bff';
        boton.style.color = 'white';
        boton.style.border = '1px solid #007bff';
    }
}

// 🆕 FUNCIÓN MEJORADA PARA GUARDAR PERMISOS (SIN TIMEOUT)
async function saveAllPermissions(userId) {
    try {
        console.log('🔍 [DEBUG] Iniciando guardado de permisos para usuario:', userId);

        const token = localStorage.getItem('token');
        console.log('🔍 [DEBUG] Token disponible:', !!token);
        
        // Recoger todos los permisos activos del modal
        const permisosActivos = [];
        const botonesActivos = document.querySelectorAll('.perm-btn-simple.active');

        console.log('🔍 [DEBUG] Botones activos encontrados:', botonesActivos.length);
        
        botonesActivos.forEach(boton => {
            const modulo = boton.getAttribute('data-modulo');
            console.log('🔍 [DEBUG] Procesando módulo:', modulo);
            
            if (modulo) {
                // Para cada módulo activo, damos permisos básicos
                permisosActivos.push(
                    { modulo: modulo, accion: 'ver', permitido: true },
                    { modulo: modulo, accion: 'crear', permitido: true },
                    { modulo: modulo, accion: 'editar', permitido: true }
                );
                console.log(`✅ [DEBUG] Módulo activado: ${modulo}`);
            }
        });

        console.log('🔍 [DEBUG] Total de permisos a guardar:', permisosActivos);
        console.log('🔍 [DEBUG] JSON a enviar:', JSON.stringify({ permisos: permisosActivos }));

        // Mostrar loading en el botón
        const saveButton = document.querySelector('.modal-footer .btn-primary');
        const originalText = saveButton.innerHTML;
        saveButton.innerHTML = '⏳ Guardando...';
        saveButton.disabled = true;

        // 🆕 ENVIAR AL BACKEND CON MÁS DETALLES
        console.log('🔍 [DEBUG] Enviando petición a:', `/api/usuarios/${userId}/permisos`);
        
        const response = await fetch(`/api/usuarios/${userId}/permisos`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                permisos: permisosActivos,
                usuarioId: userId 
            })
        });

        console.log('🔍 [DEBUG] Estado de respuesta:', response.status);
        console.log('🔍 [DEBUG] Headers:', response.headers);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ [DEBUG] Error response:', errorText);
            throw new Error(`Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('🔍 [DEBUG] Respuesta del servidor:', data);

        // Restaurar botón
        saveButton.innerHTML = originalText;
        saveButton.disabled = false;

        if (data.success) {
            console.log('✅ [DEBUG] Permisos guardados exitosamente');
            usuariosManager.showMessage('✅ Permisos guardados correctamente', 'success');
            closeUserPermissionsModal();
            
            // 🔄 Recargar la página después de guardar
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            throw new Error(data.error || 'Error desconocido del servidor');
        }

    } catch (error) {
        console.error('💥 [DEBUG] Error completo guardando permisos:', error);
        
        // Restaurar botón en caso de error
        const saveButton = document.querySelector('.modal-footer .btn-primary');
        if (saveButton) {
            saveButton.innerHTML = '💾 Guardar Cambios';
            saveButton.disabled = false;
        }
        
        let errorMessage = 'Error guardando permisos';
        if (error.message.includes('Network') || error.message.includes('Fetch')) {
            errorMessage = '🌐 Error de conexión con el servidor';
        } else {
            errorMessage = error.message;
        }
        
        usuariosManager.showMessage('❌ ' + errorMessage, 'error');
    }
}

async function editUser(userId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/usuarios/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Error cargando usuario');

        const { usuario } = await response.json();

        document.getElementById('modalTitle').textContent = 'Editar Usuario';
        document.getElementById('userId').value = usuario.id;
        document.getElementById('dni').value = usuario.dni || '';
        document.getElementById('rol').value = usuario.rol;
        document.getElementById('nombre').value = usuario.nombre || '';
        document.getElementById('apellido_paterno').value = usuario.apellido_paterno || '';
        document.getElementById('apellido_materno').value = usuario.apellido_materno || '';
        document.getElementById('email').value = usuario.email || '';
        document.getElementById('telefono').value = usuario.telefono || '';

        document.getElementById('passwordField').style.display = 'none';
        document.getElementById('password').required = false;

        document.getElementById('userModal').style.display = 'block';

    } catch (error) {
        console.error('Error:', error);
        usuariosManager.showMessage('Error cargando usuario', 'error');
    }
}

async function resetPassword(userId) {
    const nuevaPassword = prompt('Ingrese la nueva contraseña (mínimo 6 caracteres):');
    if (!nuevaPassword || nuevaPassword.length < 6) {
        alert('La contraseña debe tener al menos 6 caracteres');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/usuarios/${userId}/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ nueva_password: nuevaPassword })
        });

        const data = await response.json();

        if (response.ok) {
            usuariosManager.showMessage(data.message, 'success');
        } else {
            usuariosManager.showMessage(data.error, 'error');
        }

    } catch (error) {
        console.error('Error:', error);
        usuariosManager.showMessage('Error reseteando contraseña', 'error');
    }
}

async function toggleUserStatus(userId, newStatus) {
    const action = newStatus ? 'activar' : 'desactivar';
    if (!confirm(`¿Está seguro de que desea ${action} este usuario?`)) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/usuarios/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ activo: newStatus })
        });

        const data = await response.json();

        if (response.ok) {
            usuariosManager.showMessage(data.message, 'success');
            usuariosManager.loadUsers();
        } else {
            usuariosManager.showMessage(data.error, 'error');
        }

    } catch (error) {
        console.error('Error:', error);
        usuariosManager.showMessage('Error actualizando usuario', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    usuariosManager = new UsuariosManagement();
});