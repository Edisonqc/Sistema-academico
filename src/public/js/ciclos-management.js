class CiclosManagement {
    constructor() {
        this.ciclos = [];
        this.init();
    }

    async init() {
        await this.checkAuthentication();
        this.loadUserInfo();
        this.loadEstadisticas();
        this.loadCiclos();
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
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Token inválido');
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

    async loadEstadisticas() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/ciclos/estadisticas/generales', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.success) {
                const stats = data.estadisticas;
                document.getElementById('totalCiclos').textContent = stats.total_ciclos;
                document.getElementById('ciclosActivos').textContent = stats.ciclos_activos;
                document.getElementById('matriculasCiclo').textContent = stats.total_matriculas_activas;
                document.getElementById('ingresosCiclo').textContent = 
                    `S/ ${parseFloat(stats.ingresos_totales || 0).toFixed(2)}`;
            } else {
                throw new Error(data.error || 'Error en la respuesta del servidor');
            }
        } catch (error) {
            console.error('Error cargando estadísticas:', error);
            
            // Mostrar valores por defecto en caso de error
            document.getElementById('totalCiclos').textContent = '0';
            document.getElementById('ciclosActivos').textContent = '0';
            document.getElementById('matriculasCiclo').textContent = '0';
            document.getElementById('ingresosCiclo').textContent = 'S/ 0.00';
            
            // Solo mostrar mensaje si no es un error de autenticación
            if (!error.message.includes('Token') && !error.message.includes('401')) {
                this.showMessage('Error cargando estadísticas: ' + error.message, 'error');
            }
        }
    }

    async loadCiclos() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/ciclos', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Error cargando ciclos');

            const data = await response.json();
            if (data.success) {
                this.ciclos = data.ciclos;
                this.renderCiclos();
            }
        } catch (error) {
            console.error('Error:', error);
            this.showMessage('Error cargando ciclos académicos', 'error');
        }
    }

    renderCiclos() {
    const tbody = document.getElementById('tablaCiclosBody');
    if (!tbody) return;

    if (!this.ciclos || this.ciclos.length === 0) {
        tbody.innerHTML = '<div class="loading">No se encontraron ciclos académicos</div>';
        return;
    }

    tbody.innerHTML = this.ciclos.map(ciclo => `
        <div class="table-row">
            <div>${ciclo.id}</div>
            <div><strong>${ciclo.nombre}</strong></div>
            <div>${new Date(ciclo.fecha_inicio).toLocaleDateString()}</div>
            <div>${new Date(ciclo.fecha_fin).toLocaleDateString()}</div>
            <div class="price-tag">S/ ${parseFloat(ciclo.precio || 0).toFixed(2)}</div>
            <div>${ciclo.total_matriculas || 0}</div>
            <div>
                <span class="status-badge status-${ciclo.activo ? 'activo' : 'inactivo'}">
                    ${ciclo.activo ? 'Activo' : 'Inactivo'}
                </span>
            </div>
            <div class="btn-actions">
                <button class="btn-action btn-edit" onclick="ciclosManager.editarCiclo(${ciclo.id})">Editar</button>
                <button class="btn-action btn-delete" onclick="ciclosManager.eliminarCiclo(${ciclo.id})">Eliminar</button>
            </div>
        </div>
    `).join('');
}

    getEstadoName(estado) {
        const estados = {
            activo: 'Activo',
            inactivo: 'Inactivo',
            planificado: 'Planificado'
        };
        return estados[estado] || estado;
    }

    setupEventListeners() {
        const form = document.getElementById('formCiclo');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.guardarCiclo();
            });
        }

        // Cerrar modal al hacer clic fuera
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('modalCiclo');
            if (e.target === modal) {
                this.cerrarModalCiclo();
            }
        });
    }

    abrirModalCiclo(ciclo = null) {
    const modal = document.getElementById('modalCiclo');
    const titulo = document.getElementById('modalTitulo');
    const form = document.getElementById('formCiclo');

    if (ciclo) {
        // Modo edición
        titulo.textContent = 'Editar Ciclo Académico';
        document.getElementById('cicloId').value = ciclo.id;
        document.getElementById('nombre').value = ciclo.nombre || '';
        document.getElementById('precio').value = ciclo.precio || 0;
        document.getElementById('fechaInicio').value = ciclo.fecha_inicio ? ciclo.fecha_inicio.split('T')[0] : '';
        document.getElementById('fechaFin').value = ciclo.fecha_fin ? ciclo.fecha_fin.split('T')[0] : '';
        document.getElementById('descripcion').value = ciclo.descripcion || '';
        
        // Manejar el estado (convertir booleano a string para el select)
        const estadoSelect = document.getElementById('estado');
        if (estadoSelect) {
            // Si la columna es 'activo' (booleano) o 'estado' (string)
            if (ciclo.activo !== undefined) {
                estadoSelect.value = ciclo.activo ? 'activo' : 'inactivo';
            } else if (ciclo.estado) {
                estadoSelect.value = ciclo.estado;
            }
        }
    } else {
        // Modo nuevo
        titulo.textContent = 'Nuevo Ciclo Académico';
        form.reset();
        document.getElementById('cicloId').value = '';
        
        // Establecer fecha mínima como hoy
        const hoy = new Date().toISOString().split('T')[0];
        document.getElementById('fechaInicio').min = hoy;
        document.getElementById('fechaFin').min = hoy;
        
        // Establecer valores por defecto
        const estadoSelect = document.getElementById('estado');
        if (estadoSelect) {
            estadoSelect.value = 'activo'; // Valor por defecto
        }
    }

    modal.style.display = 'block';
}

    cerrarModalCiclo() {
        const modal = document.getElementById('modalCiclo');
        modal.style.display = 'none';
    }

    async guardarCiclo() {
    try {
        const token = localStorage.getItem('token');
        const cicloId = document.getElementById('cicloId').value;
        
        // Obtener y validar los datos del formulario
        const formData = {
            nombre: document.getElementById('nombre').value.trim(),
            precio: parseFloat(document.getElementById('precio').value) || 0,
            fecha_inicio: document.getElementById('fechaInicio').value,
            fecha_fin: document.getElementById('fechaFin').value,
            descripcion: document.getElementById('descripcion').value.trim()
        };

        // Solo incluir 'activo' si estamos en modo edición y el campo existe
        const estadoSelect = document.getElementById('estado');
        if (estadoSelect && estadoSelect.value) {
            // Convertir el valor del select a booleano para la columna 'activo'
            formData.activo = estadoSelect.value === 'activo';
        }

        console.log('Datos a enviar:', formData);
        console.log('Modo:', cicloId ? 'Edición' : 'Creación');

        // Validaciones básicas
        if (!formData.nombre || !formData.fecha_inicio || !formData.fecha_fin) {
            return this.showMessage('Nombre, fecha inicio y fecha fin son obligatorios', 'error');
        }

        if (formData.precio < 0) {
            return this.showMessage('El precio no puede ser negativo', 'error');
        }

        const fechaInicio = new Date(formData.fecha_inicio);
        const fechaFin = new Date(formData.fecha_fin);
        if (fechaInicio >= fechaFin) {
            return this.showMessage('La fecha de fin debe ser posterior a la fecha de inicio', 'error');
        }

        // Determinar URL y método
        const url = cicloId ? `/api/ciclos/${cicloId}` : '/api/ciclos';
        const method = cicloId ? 'PUT' : 'POST';

        console.log('Enviando solicitud:', method, url);

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();
        console.log('Respuesta completa del servidor:', data);

        if (response.ok && data.success) {
            this.showMessage(
                data.message || (cicloId ? 'Ciclo actualizado exitosamente' : 'Ciclo creado exitosamente'),
                'success'
            );
            this.cerrarModalCiclo();
            this.loadEstadisticas();
            this.loadCiclos();
        } else {
            const errorMsg = data.detalles || data.error || `Error ${response.status}`;
            this.showMessage('Error: ' + errorMsg, 'error');
        }

    } catch (error) {
        console.error('Error en guardarCiclo:', error);
        this.showMessage('Error de conexión: ' + error.message, 'error');
    }
}

    async editarCiclo(id) {
        const ciclo = this.ciclos.find(c => c.id === id);
        if (ciclo) {
            this.abrirModalCiclo(ciclo);
        }
    }

    async eliminarCiclo(id) {
        try {
            const result = await Swal.fire({
                title: '¿Estás seguro?',
                text: "Esta acción no se puede deshacer",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            });

            if (result.isConfirmed) {
                const token = localStorage.getItem('token');
                const response = await fetch(`/api/ciclos/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data = await response.json();

                if (response.ok) {
                    this.showMessage(data.message || 'Ciclo eliminado exitosamente', 'success');
                    this.loadEstadisticas();
                    this.loadCiclos();
                } else {
                    this.showMessage(data.error || 'Error eliminando ciclo', 'error');
                }
            }
        } catch (error) {
            console.error('Error:', error);
            this.showMessage('Error eliminando ciclo académico', 'error');
        }
    }

    showMessage(message, type = 'info') {
        if (typeof Swal !== 'undefined') {
            const config = {
                title: type === 'error' ? 'Error' : 
                       type === 'success' ? 'Éxito' : 'Información',
                text: message,
                confirmButtonText: 'Aceptar'
            };

            if (type === 'error') {
                config.icon = 'error';
                config.confirmButtonColor = '#d33';
            } else if (type === 'success') {
                config.icon = 'success';
                config.confirmButtonColor = '#28a745';
            } else {
                config.icon = 'info';
                config.confirmButtonColor = '#17a2b8';
            }

            Swal.fire(config);
            return;
        }

        // Fallback para cuando no hay SweetAlert2
        alert(message);
    }

    redirectToLogin() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    }
}

// Funciones globales
let ciclosManager;

function goToDashboard() {
    window.location.href = '/superadmin/dashboard.html';
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

function abrirModalCiclo() {
    if (ciclosManager) ciclosManager.abrirModalCiclo();
}

function cerrarModalCiclo() {
    if (ciclosManager) ciclosManager.cerrarModalCiclo();
}

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', function() {
    ciclosManager = new CiclosManagement();
});