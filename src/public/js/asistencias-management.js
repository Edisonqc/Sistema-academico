class AsistenciasManagement {
    constructor() {
        this.currentPage = 1;
        this.limit = 10;
        this.search = '';
        this.filters = {
            fecha: '',
            tipo: ''
        };
        this.init();
    }

    async init() {
        console.log('🚀 Inicializando gestión de asistencias...');
        await this.checkAuthentication();
        this.loadUserInfo();
        this.loadAsistencias();
        this.loadEstadisticas();
        this.setupEventListeners();
    }

    async checkAuthentication() {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        console.log('🔐 Verificando autenticación...');
        
        if (!token || !user.id) {
            this.showMessage('No hay sesión activa. Redirigiendo al login...', 'error');
            setTimeout(() => this.redirectToLogin(), 2000);
            return;
        }

        try {
            const response = await fetch('/api/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Token inválido');
            }

            console.log('✅ Autenticación verificada correctamente');
        } catch (error) {
            console.error('❌ Error de autenticación:', error);
            this.showMessage('Sesión expirada. Redirigiendo al login...', 'error');
            setTimeout(() => this.redirectToLogin(), 2000);
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

    async loadAsistencias() {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                this.showMessage('No hay token de autenticación', 'error');
                return;
            }

            let url = `/api/asistencias?page=${this.currentPage}&limit=${this.limit}&search=${this.search}`;
            
            // Agregar filtros
            if (this.filters.fecha) {
                url += `&fecha=${this.filters.fecha}`;
            }
            if (this.filters.tipo) {
                url += `&tipo_registro=${this.filters.tipo}`;
            }

            console.log('🌐 Solicitando asistencias:', url);

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('📡 Respuesta del servidor:', response.status);

            if (!response.ok) {
                throw new Error(`Error ${response.status}`);
            }

            const data = await response.json();
            console.log('📊 Asistencias recibidas:', data);
            
            if (data.success) {
                this.renderAsistencias(data.asistencias);
                this.renderPagination(data.pagination);
                console.log(`✅ ${data.asistencias.length} asistencias cargadas`);
            } else {
                throw new Error(data.error || 'Error en la respuesta');
            }

        } catch (error) {
            console.error('❌ Error cargando asistencias:', error);
            this.showMessage('Error cargando asistencias', 'error');
        }
    }

    async loadEstadisticas() {
        try {
            const token = localStorage.getItem('token');
            const hoy = new Date().toISOString().split('T')[0];

            const response = await fetch(`/api/asistencias/estadisticas?fecha=${hoy}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderEstadisticas(data.estadisticas);
            }
        } catch (error) {
            console.error('Error cargando estadísticas:', error);
            // Usar valores por defecto
            this.renderEstadisticas({
                asistencias_hoy: 0,
                estudiantes_totales: 0,
                por_tipo_registro: []
            });
        }
    }

    renderEstadisticas(estadisticas) {
        document.getElementById('totalAsistenciasHoy').textContent = estadisticas.asistencias_hoy;
        document.getElementById('totalEstudiantes').textContent = estadisticas.estudiantes_totales;
        
        const porcentaje = estadisticas.estudiantes_totales > 0 
            ? Math.round((estadisticas.asistencias_hoy / estadisticas.estudiantes_totales) * 100)
            : 0;
        document.getElementById('porcentajeAsistencia').textContent = `${porcentaje}%`;
    }

    renderAsistencias(asistencias) {
        const tbody = document.getElementById('asistenciasTableBody');
        
        if (asistencias.length === 0) {
            tbody.innerHTML = '<div class="loading">No se encontraron asistencias</div>';
            return;
        }

        tbody.innerHTML = asistencias.map(asistencia => {
            const fecha = new Date(asistencia.fecha);
            const hora = new Date(`2000-01-01T${asistencia.hora}`);
            
            return `
                <div class="table-row">
                    <div>${asistencia.id}</div>
                    <div>${asistencia.dni}</div>
                    <div>
                        <strong>${asistencia.nombre} ${asistencia.apellido_paterno}</strong>
                        ${asistencia.apellido_materno ? `<br><small>${asistencia.apellido_materno}</small>` : ''}
                    </div>
                    <div>${fecha.toLocaleDateString()}</div>
                    <div>${hora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
                    <div>
                        <span class="type-badge type-${asistencia.tipo_registro}">
                            ${this.getTipoRegistroName(asistencia.tipo_registro)}
                        </span>
                    </div>
                    <div>
                        <button class="btn-action" onclick="verDetallesAsistencia(${asistencia.id})" style="background: #17a2b8; color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 3px; cursor: pointer; font-size: 0.8rem;">
                            Detalles
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderPagination(pagination) {
        const paginationDiv = document.getElementById('pagination');
        const { page, pages, total } = pagination;

        let html = `
            <button ${page === 1 ? 'disabled' : ''} onclick="changePage(${page - 1})">
                Anterior
            </button>
            <span>Página ${page} de ${pages} (${total} asistencias)</span>
            <button ${page === pages ? 'disabled' : ''} onclick="changePage(${page + 1})">
                Siguiente
            </button>
        `;

        paginationDiv.innerHTML = html;
    }

    getTipoRegistroName(tipo) {
        const tipos = {
            'manual': 'Manual',
            'dni': 'Por DNI', 
            'qr': 'Por QR'
        };
        return tipos[tipo] || tipo;
    }

    setupEventListeners() {
        console.log('🔧 Configurando event listeners...');
        
        // 1. Botón de registrar asistencia
        const btnRegistrar = document.getElementById('btnRegistrarAsistencia');
        if (btnRegistrar) {
            console.log('✅ Botón registrar encontrado');
            btnRegistrar.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🔘 Click en botón - Registrando asistencia');
                this.registrarAsistencia();
            });
        } else {
            console.log('❌ Botón registrar NO encontrado - buscando por clase');
            // Buscar por clase como fallback
            const btnByClass = document.querySelector('.btn-primary');
            if (btnByClass) {
                btnByClass.onclick = (e) => {
                    e.preventDefault();
                    this.registrarAsistencia();
                };
            }
        }

        // 2. Input DNI - Configurar Enter
        this.setupEnterListener();
    }

    setupEnterListener() {
        const inputDNI = document.getElementById('dniInput');
        
        if (!inputDNI) {
            console.log('❌ Input dniInput no encontrado');
            return;
        }

        console.log('✅ Input dniInput encontrado, configurando Enter...');
        
        // Remover event listeners existentes
        const newInput = inputDNI.cloneNode(true);
        inputDNI.parentNode.replaceChild(newInput, inputDNI);
        
        // Obtener el nuevo input
        const cleanInput = document.getElementById('dniInput');
        
        // Agregar listener para Enter
        cleanInput.addEventListener('keydown', (e) => {
            console.log('Tecla presionada:', e.key);
            
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevenir comportamiento por defecto
                console.log('↵ Enter presionado - Registrando asistencia');
                this.registrarAsistencia();
            }
        });

        // Focus automático
        cleanInput.focus();
        console.log('✅ Listener de Enter configurado correctamente');
    }

    async registrarAsistencia() {
        try {
            const dniInput = document.getElementById('dniInput');
            const resultadoDiv = document.getElementById('registroResult');
            
            if (!dniInput) {
                console.error('❌ Elemento dniInput no encontrado');
                this.showMessage('Error: Campo DNI no encontrado', 'error');
                return;
            }

            const dni = dniInput.value.trim();

            // Limpiar resultado anterior
            if (resultadoDiv) {
                resultadoDiv.innerHTML = '';
            }

            if (!dni) {
                this.showMessageInDiv('Ingrese un DNI válido', 'error', resultadoDiv);
                return;
            }

            if (dni.length !== 8) {
                this.showMessageInDiv('El DNI debe tener 8 dígitos', 'error', resultadoDiv);
                return;
            }

            const token = localStorage.getItem('token');
            
            console.log('📝 Registrando asistencia para DNI:', dni);

            const response = await fetch('/api/asistencias/registrar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    dni: dni,
                    tipo_registro: 'dni'
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showMessageInDiv(
                    `✅ Asistencia registrada para: ${data.estudiante.nombre}`,
                    'success', 
                    resultadoDiv
                );
                
                // Limpiar campo y recargar datos
                dniInput.value = '';
                this.loadAsistencias();
                this.loadEstadisticas();
                
                // Enfocar nuevamente el campo para siguiente registro
                setTimeout(() => {
                    const refocusedInput = document.getElementById('dniInput');
                    if (refocusedInput) {
                        refocusedInput.focus();
                    }
                }, 500);
                
            } else {
                this.showMessageInDiv(data.error || 'Error registrando asistencia', 'error', resultadoDiv);
            }

        } catch (error) {
            console.error('Error registrando asistencia:', error);
            this.showMessageInDiv('Error de conexión con el servidor', 'error', resultadoDiv);
        }
    }

    // FUNCIÓN: Ver detalles de asistencia
    verDetallesAsistencia(asistenciaId) {
        console.log('🔍 Mostrando detalles de asistencia:', asistenciaId);
        
        try {
            const asistenciaData = this.obtenerDatosPruebaDetallesAsistencia(asistenciaId);
            this.mostrarModalDetallesAsistencia(asistenciaData);
            
        } catch (error) {
            console.error('Error mostrando detalles:', error);
            this.showMessage('Error mostrando detalles de la asistencia', 'error');
        }
    }

    obtenerDatosPruebaDetallesAsistencia(asistenciaId) {
        const hoy = new Date();
        const datosPrueba = {
            1: {
                id: 1,
                estudiante: {
                    dni: "12345678",
                    nombre: "Ana García López",
                    ciclo: "Ciclo 2024-I",
                    matricula: "MAT-2024-001"
                },
                fecha: new Date(hoy.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                hora: "08:15:00",
                tipo_registro: "dni",
                ubicacion: "Aula Principal - Pabellón A",
                observaciones: "Asistencia puntual",
                estado: "confirmada",
                dispositivo: "Lector DNI - Estación 1",
                duracion: "6 horas"
            },
            2: {
                id: 2,
                estudiante: {
                    dni: "87654321", 
                    nombre: "Carlos Rodríguez Mendoza",
                    ciclo: "Ciclo 2024-I",
                    matricula: "MAT-2024-002"
                },
                fecha: new Date(hoy.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                hora: "08:30:00",
                tipo_registro: "manual",
                ubicacion: "Laboratorio de Ciencias",
                observaciones: "Ingreso con retardo de 15 minutos",
                estado: "tardanza",
                dispositivo: "Registro Manual - Administración",
                duracion: "5.5 horas"
            },
            3: {
                id: 3,
                estudiante: {
                    dni: "11223344",
                    nombre: "María Torres Silva",
                    ciclo: "Ciclo 2024-I", 
                    matricula: "MAT-2024-003"
                },
                fecha: hoy.toISOString().split('T')[0],
                hora: "07:45:00",
                tipo_registro: "qr",
                ubicacion: "Biblioteca - Sala Estudio",
                observaciones: "Asistencia para estudio independiente",
                estado: "confirmada",
                dispositivo: "Escáner QR - Móvil",
                duracion: "4 horas"
            }
        };

        return datosPrueba[asistenciaId] || datosPrueba[1];
    }

    mostrarModalDetallesAsistencia(asistenciaData) {
        const fecha = new Date(asistenciaData.fecha);
        const hora = new Date(`2000-01-01T${asistenciaData.hora}`);
        
        let estadoColor = '#28a745';
        let estadoTexto = 'Confirmada';
        
        if (asistenciaData.estado === 'tardanza') {
            estadoColor = '#ffc107';
            estadoTexto = 'Con Tardanza';
        } else if (asistenciaData.estado === 'justificada') {
            estadoColor = '#17a2b8';
            estadoTexto = 'Justificada';
        }

        const modalHTML = `
            <div class="modal" id="detallesAsistenciaModal" style="display: block; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5);">
                <div class="modal-content" style="background-color: #fefefe; margin: 5% auto; padding: 20px; border: 1px solid #888; width: 80%; max-width: 600px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e9ecef; padding-bottom: 1rem; margin-bottom: 1rem;">
                        <h2 style="margin: 0; color: #2c3e50;">📋 Detalles de Asistencia</h2>
                        <span class="close" onclick="cerrarModalDetallesAsistencia()" style="font-size: 28px; font-weight: bold; cursor: pointer; color: #aaa;">&times;</span>
                    </div>
                    <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                        <div class="detalles-section" style="margin-bottom: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #3498db;">
                            <h3 style="color: #3498db; margin-top: 0;">Información del Estudiante</h3>
                            <div class="detalles-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                                <div class="detalle-item" style="display: flex; flex-direction: column; gap: 0.25rem;">
                                    <strong style="color: #6c757d; font-size: 0.9rem;">Estudiante:</strong>
                                    <span>${asistenciaData.estudiante.nombre}</span>
                                </div>
                                <div class="detalle-item" style="display: flex; flex-direction: column; gap: 0.25rem;">
                                    <strong style="color: #6c757d; font-size: 0.9rem;">DNI:</strong>
                                    <span>${asistenciaData.estudiante.dni}</span>
                                </div>
                                <div class="detalle-item" style="display: flex; flex-direction: column; gap: 0.25rem;">
                                    <strong style="color: #6c757d; font-size: 0.9rem;">Matrícula:</strong>
                                    <span>${asistenciaData.estudiante.matricula}</span>
                                </div>
                                <div class="detalle-item" style="display: flex; flex-direction: column; gap: 0.25rem;">
                                    <strong style="color: #6c757d; font-size: 0.9rem;">Ciclo:</strong>
                                    <span>${asistenciaData.estudiante.ciclo}</span>
                                </div>
                            </div>
                        </div>

                        <div class="detalles-section" style="margin-bottom: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #28a745;">
                            <h3 style="color: #28a745; margin-top: 0;">Detalles de la Asistencia</h3>
                            <div class="detalles-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                                <div class="detalle-item" style="display: flex; flex-direction: column; gap: 0.25rem;">
                                    <strong style="color: #6c757d; font-size: 0.9rem;">Fecha:</strong>
                                    <span>${fecha.toLocaleDateString()}</span>
                                </div>
                                <div class="detalle-item" style="display: flex; flex-direction: column; gap: 0.25rem;">
                                    <strong style="color: #6c757d; font-size: 0.9rem;">Hora:</strong>
                                    <span>${hora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div class="detalle-item" style="display: flex; flex-direction: column; gap: 0.25rem;">
                                    <strong style="color: #6c757d; font-size: 0.9rem;">Tipo de Registro:</strong>
                                    <span>${this.getTipoRegistroName(asistenciaData.tipo_registro)}</span>
                                </div>
                                <div class="detalle-item" style="display: flex; flex-direction: column; gap: 0.25rem;">
                                    <strong style="color: #6c757d; font-size: 0.9rem;">Estado:</strong>
                                    <span style="color: ${estadoColor}; font-weight: bold;">${estadoTexto}</span>
                                </div>
                                <div class="detalle-item" style="display: flex; flex-direction: column; gap: 0.25rem;">
                                    <strong style="color: #6c757d; font-size: 0.9rem;">Ubicación:</strong>
                                    <span>${asistenciaData.ubicacion}</span>
                                </div>
                                <div class="detalle-item" style="display: flex; flex-direction: column; gap: 0.25rem;">
                                    <strong style="color: #6c757d; font-size: 0.9rem;">Dispositivo:</strong>
                                    <span>${asistenciaData.dispositivo}</span>
                                </div>
                                <div class="detalle-item" style="display: flex; flex-direction: column; gap: 0.25rem;">
                                    <strong style="color: #6c757d; font-size: 0.9rem;">Duración:</strong>
                                    <span>${asistenciaData.duracion}</span>
                                </div>
                            </div>
                        </div>

                        ${asistenciaData.observaciones ? `
                        <div class="detalles-section" style="margin-bottom: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #fd7e14;">
                            <h3 style="color: #fd7e14; margin-top: 0;">Observaciones</h3>
                            <p style="margin: 0; padding: 0.5rem; background: white; border-radius: 5px; border-left: 3px solid #fd7e14;">
                                ${asistenciaData.observaciones}
                            </p>
                        </div>
                        ` : ''}

                        <div class="modal-actions" style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #dee2e6;">
                            <button class="btn-secondary" onclick="cerrarModalDetallesAsistencia()" style="background: #6c757d; color: white; border: none; padding: 0.5rem 1rem; border-radius: 5px; cursor: pointer;">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Crear o actualizar modal
        let modal = document.getElementById('detallesAsistenciaModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'detallesAsistenciaModal';
            document.body.appendChild(modal);
        }
        
        modal.innerHTML = modalHTML;
    }

    showMessageInDiv(message, type, divElement) {
        if (divElement) {
            divElement.innerHTML = `
                <div class="${type === 'error' ? 'error-message' : 'success-message'}">
                    ${message}
                </div>
            `;
        }
    }

    searchAsistencias() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            this.search = searchInput.value;
            this.currentPage = 1;
            this.loadAsistencias();
        }
    }

    applyFilters() {
        const filterFecha = document.getElementById('filterFecha');
        const filterTipo = document.getElementById('filterTipo');
        
        if (filterFecha && filterTipo) {
            this.filters.fecha = filterFecha.value;
            this.filters.tipo = filterTipo.value;
            this.currentPage = 1;
            this.loadAsistencias();
        }
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

        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }

    redirectToLogin() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    }
}

// Funciones globales
let asistenciasManager;

function goToDashboard() {
    window.location.href = '/superadmin/dashboard.html';
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

function searchAsistencias() {
    if (asistenciasManager) {
        asistenciasManager.searchAsistencias();
    }
}

function changePage(page) {
    if (asistenciasManager) {
        asistenciasManager.currentPage = page;
        asistenciasManager.loadAsistencias();
    }
}

function applyFilters() {
    if (asistenciasManager) {
        asistenciasManager.applyFilters();
    }
}

function registrarAsistencia() {
    if (asistenciasManager) {
        asistenciasManager.registrarAsistencia();
    }
}

function iniciarEscanner() {
    if (asistenciasManager) {
        asistenciasManager.showMessage('Escáner QR en desarrollo', 'info');
    }
}

// FUNCIÓN: Ver detalles de asistencia
function verDetallesAsistencia(asistenciaId) {
    if (asistenciasManager) {
        asistenciasManager.verDetallesAsistencia(asistenciaId);
    }
}

// FUNCIÓN: Cerrar modal de detalles de asistencia
function cerrarModalDetallesAsistencia() {
    const modal = document.getElementById('detallesAsistenciaModal');
    if (modal) {
        modal.remove();
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    asistenciasManager = new AsistenciasManagement();
});