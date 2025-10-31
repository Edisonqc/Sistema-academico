class PermisosManager {
    constructor() {
        this.permisos = [];
        this.usuarioEspecifico = null;
        this.usuarioData = null;
        this.init();
    }

    async init() {
        // Verificar si estamos en modo "usuario específico"
        const urlParams = new URLSearchParams(window.location.search);
        const usuarioId = urlParams.get('usuarioId');
        
        if (usuarioId) {
            this.usuarioEspecifico = usuarioId;
            await this.cargarUsuarioEspecifico(usuarioId);
            this.mostrarInfoUsuario();
        }

        await this.loadPermisos();
        this.setupEventListeners();
    }

    async cargarUsuarioEspecifico(usuarioId) {
        try {
            const response = await fetch(`/api/usuarios/${usuarioId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.usuarioData = data.usuario;
            }
        } catch (error) {
            console.error('Error cargando usuario:', error);
            this.showError('Error cargando información del usuario');
        }
    }

    mostrarInfoUsuario() {
        if (this.usuarioData) {
            // Actualizar el título de la página
            const pageTitle = document.getElementById('pageTitle') || document.querySelector('h1');
            if (pageTitle) {
                pageTitle.textContent = `🔐 Permisos de ${this.usuarioData.nombre} ${this.usuarioData.apellido_paterno}`;
            }

            // Crear barra de información del usuario
            const header = document.querySelector('.header') || document.querySelector('.container');
            if (header) {
                const infoUsuario = document.createElement('div');
                infoUsuario.className = 'user-info-bar';
                infoUsuario.innerHTML = `
                    <div class="user-details">
                        <strong>Usuario:</strong> ${this.usuarioData.nombre} ${this.usuarioData.apellido_paterno} |
                        <strong>DNI:</strong> ${this.usuarioData.dni} |
                        <strong>Rol:</strong> <span class="badge ${this.getRolBadgeClass(this.usuarioData.rol)}">${this.usuarioData.rol}</span> |
                        <strong>Email:</strong> ${this.usuarioData.email || 'N/A'}
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="volverAUsuarios()">
                        ← Volver a Usuarios
                    </button>
                `;
                header.appendChild(infoUsuario);
            }

            // Ocultar filtro de rol ya que estamos viendo permisos de un usuario específico
            const filterRol = document.getElementById('filterRol');
            if (filterRol) {
                filterRol.style.display = 'none';
                const filterRolLabel = filterRol.previousElementSibling;
                if (filterRolLabel && filterRolLabel.tagName === 'LABEL') {
                    filterRolLabel.style.display = 'none';
                }
            }
        }
    }

    async loadPermisos() {
        try {
            let url = '/api/usuarios/permisos/config';
            
            // Si hay un usuario específico, cargar permisos para ese rol
            if (this.usuarioEspecifico && this.usuarioData) {
                url = `/api/usuarios/permisos/config?rol=${this.usuarioData.rol}`;
            }

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Error cargando permisos');

            const data = await response.json();
            this.permisos = data.permisos;
            this.renderPermisos();
        } catch (error) {
            console.error('Error:', error);
            this.showError('Error cargando permisos');
        }
    }

    renderPermisos(filteredPermisos = null) {
        const permisos = filteredPermisos || this.permisos;
        const tbody = document.getElementById('permisosBody');
        
        if (!tbody) {
            console.error('No se encontró el elemento permisosBody');
            return;
        }

        // Si estamos en modo usuario específico, filtrar por su rol
        let permisosFiltrados = permisos;
        if (this.usuarioEspecifico && this.usuarioData) {
            permisosFiltrados = permisos.filter(permiso => permiso.rol === this.usuarioData.rol);
        }

        if (permisosFiltrados.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">
                        <div class="no-data">
                            No se encontraron permisos configurados
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = permisosFiltrados.map(permiso => `
            <tr>
                <td>
                    ${this.usuarioEspecifico ? 
                        `<span class="badge ${this.getRolBadgeClass(permiso.rol)}">
                            ${permiso.rol}
                        </span>` : 
                        `<select class="form-select form-select-sm" onchange="permisosManager.cambiarRolPermiso(${permiso.id}, this.value)">
                            <option value="secretaria" ${permiso.rol === 'secretaria' ? 'selected' : ''}>Secretaria</option>
                            <option value="estudiante" ${permiso.rol === 'estudiante' ? 'selected' : ''}>Estudiante</option>
                            <option value="superadmin" ${permiso.rol === 'superadmin' ? 'selected' : ''}>Super Admin</option>
                        </select>`
                    }
                </td>
                <td>
                    <span class="modulo-badge">${this.getModuloIcon(permiso.modulo)} ${this.getModuloText(permiso.modulo)}</span>
                </td>
                <td>
                    <span class="accion-badge ${permiso.accion}">
                        ${this.getAccionText(permiso.accion)}
                    </span>
                </td>
                <td>
                    <span class="status ${permiso.permitido ? 'active' : 'inactive'}">
                        ${permiso.permitido ? '✅ Permitido' : '❌ Denegado'}
                    </span>
                </td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm ${permiso.permitido ? 'btn-warning' : 'btn-success'}" 
                                onclick="permisosManager.togglePermiso(${permiso.id}, ${!permiso.permitido})">
                            ${permiso.permitido ? '❌ Denegar' : '✅ Permitir'}
                        </button>
                        ${!this.usuarioEspecifico ? `
                            <button class="btn btn-sm btn-danger" 
                                    onclick="permisosManager.eliminarPermiso(${permiso.id})">
                                🗑️
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    }

    async cambiarRolPermiso(permisoId, nuevoRol) {
        try {
            const response = await fetch(`/api/usuarios/permisos/${permisoId}/rol`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ rol: nuevoRol })
            });

            if (!response.ok) throw new Error('Error actualizando rol del permiso');

            this.showSuccess('Rol actualizado correctamente');
            await this.loadPermisos();
        } catch (error) {
            console.error('Error:', error);
            this.showError('Error actualizando rol del permiso');
        }
    }

    // En el método togglePermiso - CAMBIAR
async togglePermiso(permisoId, nuevoEstado) {
    try {
        const response = await fetch(`/api/usuarios/permisos/${permisoId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ permitido: nuevoEstado })
        });

        if (!response.ok) throw new Error('Error actualizando permiso');

        const result = await response.json();
        this.showSuccess(`Permiso ${nuevoEstado ? 'activado' : 'desactivado'} correctamente`);
        
        // Limpiar cache de permisos
        await this.limpiarCachePermisos();
        await this.loadPermisos();
    } catch (error) {
        console.error('Error:', error);
        this.showError('Error actualizando permiso');
    }
}

// Agregar método para limpiar cache
async limpiarCachePermisos() {
    try {
        await fetch('/api/usuarios/permisos/clear-cache', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
    } catch (error) {
        console.log('Error limpiando cache:', error);
    }
}

    async eliminarPermiso(permisoId) {
        if (!confirm('¿Estás seguro de que deseas eliminar este permiso?')) {
            return;
        }

        try {
            const response = await fetch(`/api/usuarios/permisos/${permisoId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Error eliminando permiso');

            this.showSuccess('Permiso eliminado correctamente');
            await this.loadPermisos();
        } catch (error) {
            console.error('Error:', error);
            this.showError('Error eliminando permiso');
        }
    }

    async resetToDefault() {
        if (!confirm('¿Estás seguro de restablecer todos los permisos a los valores por defecto?')) {
            return;
        }

        try {
            const response = await fetch('/api/usuarios/permisos/reset', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Error restableciendo permisos');

            this.showSuccess('Permisos restablecidos correctamente');
            await this.loadPermisos();
        } catch (error) {
            console.error('Error:', error);
            this.showError('Error restableciendo permisos');
        }
    }

    async agregarPermiso() {
        const rol = prompt('Ingrese el rol (secretaria/estudiante):');
        const modulo = prompt('Ingrese el módulo (usuarios/estudiantes/matriculas/pagos/asistencias/reportes):');
        const accion = prompt('Ingrese la acción (ver/crear/editar/eliminar):');

        if (!rol || !modulo || !accion) {
            this.showError('Todos los campos son requeridos');
            return;
        }

        try {
            const response = await fetch('/api/usuarios/permisos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    rol,
                    modulo,
                    accion,
                    permitido: true
                })
            });

            if (!response.ok) throw new Error('Error creando permiso');

            this.showSuccess('Permiso creado correctamente');
            await this.loadPermisos();
        } catch (error) {
            console.error('Error:', error);
            this.showError('Error creando permiso');
        }
    }

    // Métodos auxiliares para UI
    getRolBadgeClass(rol) {
        const classes = {
            'superadmin': 'badge-superadmin',
            'secretaria': 'badge-secretaria', 
            'estudiante': 'badge-estudiante'
        };
        return classes[rol] || 'badge-default';
    }

    getModuloIcon(modulo) {
        const icons = {
            'usuarios': '👥',
            'estudiantes': '🎓',
            'matriculas': '📝',
            'pagos': '💰',
            'asistencias': '✅',
            'reportes': '📊',
            'perfil': '👤'
        };
        return icons[modulo] || '📁';
    }

    getModuloText(modulo) {
        const textos = {
            'usuarios': 'Usuarios',
            'estudiantes': 'Estudiantes',
            'matriculas': 'Matrículas',
            'pagos': 'Pagos',
            'asistencias': 'Asistencias',
            'reportes': 'Reportes',
            'perfil': 'Perfil'
        };
        return textos[modulo] || modulo;
    }

    getAccionText(accion) {
        const texts = {
            'ver': 'Ver',
            'crear': 'Crear',
            'editar': 'Editar',
            'eliminar': 'Eliminar',
            'permisos': 'Gestionar Permisos'
        };
        return texts[accion] || accion;
    }

    setupEventListeners() {
        const filterRol = document.getElementById('filterRol');
        const filterModulo = document.getElementById('filterModulo');

        if (filterRol) {
            filterRol.addEventListener('change', (e) => {
                this.filterPermisos();
            });
        }

        if (filterModulo) {
            filterModulo.addEventListener('change', (e) => {
                this.filterPermisos();
            });
        }
    }

    filterPermisos() {
        const rolFilter = document.getElementById('filterRol')?.value || '';
        const moduloFilter = document.getElementById('filterModulo')?.value || '';

        const filtered = this.permisos.filter(permiso => {
            return (!rolFilter || permiso.rol === rolFilter) &&
                   (!moduloFilter || permiso.modulo === moduloFilter);
        });

        this.renderPermisos(filtered);
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        // Crear notificación estilo toast
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${type === 'success' ? '✅' : '❌'} ${message}</span>
        `;
        
        notification.style.cssText = `
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
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.5s';
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }
}

// Funciones globales
function resetToDefault() {
    permisosManager.resetToDefault();
}

function agregarPermiso() {
    permisosManager.agregarPermiso();
}

function volverAUsuarios() {
    window.location.href = '/superadmin/usuarios.html';
}

// Instanciar el manager
const permisosManager = new PermisosManager();