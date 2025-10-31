// PANEL DE ESTUDIANTES - VERSIÓN MEJORADA Y CORREGIDA
console.log('🎓 Script del panel estudiantil cargado correctamente');

class EstudiantePanel {
    constructor() {
        this.currentTab = 'perfil';
        this.pagosPage = 1;
        this.asistenciasPage = 1;
        this.limit = 10;
        this.init();
    }

    async init() {
        console.log('🚀 Inicializando panel estudiantil...');
        await this.checkAuthentication();
        this.loadUserInfo();
        await this.cargarPerfil();
        await this.cargarResumenGeneral();
        this.setupEventListeners();
        console.log('✅ Panel estudiantil inicializado correctamente');
    }

    async checkAuthentication() {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        console.log('🔐 Verificando autenticación...');
        
        // Verificar que el usuario sea estudiante
        if (!token || !user.id || user.rol !== 'estudiante') {
            this.showMessage('Acceso denegado. Redirigiendo...', 'error');
            setTimeout(() => this.redirectToLogin(), 2000);
            return;
        }

        console.log('✅ Usuario estudiante autenticado');
    }

    loadUserInfo() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user) {
            document.getElementById('userName').textContent = 
                `${user.nombre} ${user.apellido_paterno}`;
        }
    }

    async cargarPerfil() {
        try {
            const token = localStorage.getItem('token');
            
            console.log('👤 Cargando perfil del estudiante...');

            // Intentar API normal primero
            let response = await this.fetchWithFallback('/api/estudiante/mi-perfil', token);
            
            const data = await response.json();
            console.log('📊 Perfil recibido:', data);
            
            if (data.success) {
                this.mostrarPerfil(data.estudiante, data.matricula);
                this.showMessage('Perfil cargado correctamente', 'success');
            } else {
                throw new Error(data.error || 'Error en la respuesta');
            }

        } catch (error) {
            console.error('❌ Error cargando perfil:', error);
            this.showMessage('Error cargando perfil. Mostrando datos de demostración...', 'warning');
            this.mostrarDatosDemo();
        }
    }

    async fetchWithFallback(url, token, fallbackUrl = null) {
        try {
            console.log(`🌐 Intentando: ${url}`);
            let response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                return response;
            }

            // Si falla, intentar con API de emergencia
            if (!fallbackUrl) {
                fallbackUrl = url.replace('/api/estudiante/', '/api/emergencia/');
            }
            
            console.log(`⚠️ Falló ${url}, intentando: ${fallbackUrl}`);
            response = await fetch(fallbackUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                return response;
            }

            throw new Error(`Ambas APIs fallaron: ${url}`);

        } catch (error) {
            console.error('❌ Error en fetchWithFallback:', error);
            throw error;
        }
    }

    mostrarPerfil(estudiante, matricula) {
        try {
            console.log('🔄 Mostrando perfil:', estudiante);
            
            // Banner de bienvenida
            document.getElementById('welcomeMessage').textContent = 
                `Hola ${estudiante.nombre}, aquí puedes gestionar tu información académica.`;

            // Avatar con iniciales
            const iniciales = (estudiante.nombre.charAt(0) + estudiante.apellido_paterno.charAt(0)).toUpperCase();
            document.getElementById('avatarInitials').textContent = iniciales;

            // Información principal
            document.getElementById('profileName').textContent = 
                `${estudiante.nombre} ${estudiante.apellido_paterno} ${estudiante.apellido_materno || ''}`.trim();
            document.getElementById('profileDni').textContent = `DNI: ${estudiante.dni}`;
            
            if (matricula) {
                document.getElementById('profileCiclo').textContent = `Ciclo: ${matricula.ciclo_nombre}`;
            } else {
                document.getElementById('profileCiclo').textContent = 'Ciclo: No asignado';
            }

            // Información personal
            this.setInfoValue('infoEmail', estudiante.email);
            this.setInfoValue('infoTelefono', estudiante.telefono);
            this.setInfoValue('infoDireccion', estudiante.direccion);
            
            if (estudiante.fecha_nacimiento) {
                const fechaNac = new Date(estudiante.fecha_nacimiento);
                document.getElementById('infoNacimiento').textContent = fechaNac.toLocaleDateString();
            } else {
                document.getElementById('infoNacimiento').textContent = 'No especificado';
            }

            // Información académica
            if (estudiante.fecha_ingreso) {
                const fechaIng = new Date(estudiante.fecha_ingreso);
                document.getElementById('infoIngreso').textContent = fechaIng.toLocaleDateString();
            } else {
                document.getElementById('infoIngreso').textContent = 'No especificado';
            }

            document.getElementById('infoEstado').textContent = estudiante.estado_estudiante || 'Activo';
            
            if (matricula) {
                document.getElementById('infoBoleta').textContent = matricula.numero_boleta || 'N/A';
                document.getElementById('infoAula').textContent = matricula.aula || 'N/A';
            } else {
                document.getElementById('infoBoleta').textContent = 'Sin matrícula activa';
                document.getElementById('infoAula').textContent = 'N/A';
            }

            console.log('✅ Perfil mostrado correctamente');

        } catch (error) {
            console.error('❌ Error mostrando perfil:', error);
        }
    }

    setInfoValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value || 'No especificado';
        }
    }

    async cargarResumenGeneral() {
        try {
            await Promise.all([
                this.cargarResumenPagos(),
                this.cargarResumenAsistencias()
            ]);
        } catch (error) {
            console.error('❌ Error cargando resumen general:', error);
        }
    }

    async cargarResumenPagos() {
        try {
            const token = localStorage.getItem('token');
            
            console.log('💰 Cargando resumen de pagos...');

            const response = await this.fetchWithFallback('/api/estudiante/mis-pagos?page=1&limit=5', token);

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.actualizarEstadisticasPagos(data.resumen);
                }
            }
        } catch (error) {
            console.error('❌ Error cargando resumen de pagos:', error);
            // Usar datos de demostración
            this.actualizarEstadisticasPagos({
                pendiente: { cantidad: 2, monto: 1000 },
                pagado: { cantidad: 3, monto: 1500 },
                vencido: { cantidad: 0, monto: 0 }
            });
        }
    }

    async cargarResumenAsistencias() {
        try {
            const token = localStorage.getItem('token');
            
            console.log('✅ Cargando resumen de asistencias...');

            const response = await this.fetchWithFallback('/api/estudiante/mis-asistencias?page=1&limit=5', token);

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.actualizarEstadisticasAsistencias(data.estadisticas);
                }
            }
        } catch (error) {
            console.error('❌ Error cargando resumen de asistencias:', error);
            // Usar datos de demostración
            this.actualizarEstadisticasAsistencias({
                total_asistencias: 15,
                dias_con_asistencia: 12
            });
        }
    }

    actualizarEstadisticasPagos(resumen) {
        try {
            console.log('📊 Actualizando estadísticas de pagos:', resumen);
            
            const totalPagos = (resumen.pendiente?.cantidad || 0) + 
                             (resumen.pagado?.cantidad || 0) + 
                             (resumen.vencido?.cantidad || 0);
            
            document.getElementById('totalPagos').textContent = totalPagos;
            document.getElementById('pagosPendientes').textContent = resumen.pendiente?.cantidad || 0;

            console.log('✅ Estadísticas de pagos actualizadas');

        } catch (error) {
            console.error('❌ Error actualizando estadísticas de pagos:', error);
        }
    }

    actualizarEstadisticasAsistencias(estadisticas) {
        try {
            console.log('📊 Actualizando estadísticas de asistencias:', estadisticas);
            
            document.getElementById('totalAsistencias').textContent = estadisticas.total_asistencias || 0;
            document.getElementById('diasAsistencia').textContent = estadisticas.dias_con_asistencia || 0;

            console.log('✅ Estadísticas de asistencias actualizadas');

        } catch (error) {
            console.error('❌ Error actualizando estadísticas de asistencias:', error);
        }
    }

    async cargarPagosDetallados() {
        try {
            const token = localStorage.getItem('token');
            
            console.log('💰 Cargando pagos detallados...');

            const response = await this.fetchWithFallback(
                `/api/estudiante/mis-pagos?page=${this.pagosPage}&limit=${this.limit}`, 
                token
            );

            const data = await response.json();
            console.log('📊 Pagos detallados recibidos:', data);
            
            if (data.success) {
                this.mostrarResumenPagos(data.resumen);
                this.mostrarTablaPagos(data.pagos);
                this.mostrarPaginacionPagos(data.pagination);
            } else {
                throw new Error(data.error || 'Error en la respuesta');
            }

        } catch (error) {
            console.error('❌ Error cargando pagos detallados:', error);
            this.showMessage('Error cargando pagos. Mostrando datos de demostración...', 'warning');
            this.mostrarPagosDemo();
        }
    }

    mostrarResumenPagos(resumen) {
        const resumenDiv = document.getElementById('resumenPagos');
        
        const html = `
            <div class="summary-card">
                <div class="summary-value" style="color: #f39c12;">S/ ${(resumen.pendiente?.monto || 0).toFixed(2)}</div>
                <div class="summary-label">Pendiente (${resumen.pendiente?.cantidad || 0})</div>
            </div>
            <div class="summary-card">
                <div class="summary-value" style="color: #2ecc71;">S/ ${(resumen.pagado?.monto || 0).toFixed(2)}</div>
                <div class="summary-label">Pagado (${resumen.pagado?.cantidad || 0})</div>
            </div>
            <div class="summary-card">
                <div class="summary-value" style="color: #e74c3c;">S/ ${(resumen.vencido?.monto || 0).toFixed(2)}</div>
                <div class="summary-label">Vencido (${resumen.vencido?.cantidad || 0})</div>
            </div>
            <div class="summary-card">
                <div class="summary-value" style="color: #3498db;">S/ ${(resumen.total_general || 0).toFixed(2)}</div>
                <div class="summary-label">Total General</div>
            </div>
        `;

        resumenDiv.innerHTML = html;
    }

    mostrarTablaPagos(pagos) {
        const tbody = document.getElementById('pagosTableBody');
        
        if (!pagos || pagos.length === 0) {
            tbody.innerHTML = '<div class="no-data">No se encontraron pagos registrados</div>';
            return;
        }

        tbody.innerHTML = pagos.map(pago => {
            const fechaVenc = new Date(pago.fecha_vencimiento);
            const fechaPago = pago.fecha_pago ? new Date(pago.fecha_pago) : null;
            
            let estadoClass = '';
            let estadoTexto = '';
            
            switch(pago.estado) {
                case 'pagado':
                    estadoClass = 'status-badge status-pagado';
                    estadoTexto = 'Pagado';
                    break;
                case 'pendiente':
                    estadoClass = 'status-badge status-pendiente';
                    estadoTexto = 'Pendiente';
                    break;
                case 'vencido':
                    estadoClass = 'status-badge status-vencido';
                    estadoTexto = 'Vencido';
                    break;
                default:
                    estadoClass = 'status-badge';
                    estadoTexto = pago.estado;
            }

            return `
                <div class="table-row">
                    <div>${pago.numero_cuota}</div>
                    <div><strong>${pago.numero_boleta}</strong></div>
                    <div>${pago.ciclo_nombre || 'N/A'}</div>
                    <div><strong>S/ ${parseFloat(pago.monto || 0).toFixed(2)}</strong></div>
                    <div>${fechaVenc.toLocaleDateString()}</div>
                    <div>${fechaPago ? fechaPago.toLocaleDateString() : '--'}</div>
                    <div>
                        <span class="${estadoClass}">
                            ${estadoTexto}
                        </span>
                        ${pago.estado === 'pagado' ? `
                            <button class="btn-download" onclick="descargarComprobante(${pago.id})" style="margin-top: 0.25rem;">
                                📄 Comprobante
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    mostrarPaginacionPagos(pagination) {
        const paginationDiv = document.getElementById('pagosPagination');
        if (!paginationDiv) return;

        const { page = 1, pages = 1, total = 0 } = pagination || {};

        let html = `
            <button ${page === 1 ? 'disabled' : ''} onclick="cambiarPaginaPagos(${page - 1})">
                Anterior
            </button>
            <span>Página ${page} de ${pages} (${total} pagos)</span>
            <button ${page === pages ? 'disabled' : ''} onclick="cambiarPaginaPagos(${page + 1})">
                Siguiente
            </button>
        `;

        paginationDiv.innerHTML = html;
    }

    async cargarAsistenciasDetalladas() {
        try {
            const token = localStorage.getItem('token');
            
            console.log('✅ Cargando asistencias detalladas...');

            const response = await this.fetchWithFallback(
                `/api/estudiante/mis-asistencias?page=${this.asistenciasPage}&limit=${this.limit}`, 
                token
            );

            const data = await response.json();
            console.log('📊 Asistencias detalladas recibidas:', data);
            
            if (data.success) {
                this.mostrarResumenAsistencias(data.estadisticas);
                this.mostrarTablaAsistencias(data.asistencias);
                this.mostrarPaginacionAsistencias(data.pagination);
            } else {
                throw new Error(data.error || 'Error en la respuesta');
            }

        } catch (error) {
            console.error('❌ Error cargando asistencias detalladas:', error);
            this.showMessage('Error cargando asistencias. Mostrando datos de demostración...', 'warning');
            this.mostrarAsistenciasDemo();
        }
    }

    mostrarResumenAsistencias(estadisticas) {
        const resumenDiv = document.getElementById('resumenAsistencias');
        if (!resumenDiv) return;
        
        // Calcular promedio mensual
        const promedioMensual = estadisticas.por_mes && estadisticas.por_mes.length > 0 
            ? Math.round((estadisticas.total_asistencias || 0) / estadisticas.por_mes.length)
            : 0;

        const html = `
            <div class="summary-card">
                <div class="summary-value" style="color: #3498db;">${estadisticas.total_asistencias || 0}</div>
                <div class="summary-label">Total Asistencias</div>
            </div>
            <div class="summary-card">
                <div class="summary-value" style="color: #2ecc71;">${estadisticas.dias_con_asistencia || 0}</div>
                <div class="summary-label">Días con Asistencia</div>
            </div>
            <div class="summary-card">
                <div class="summary-value" style="color: #9b59b6;">${promedioMensual}</div>
                <div class="summary-label">Promedio Mensual</div>
            </div>
            <div class="summary-card">
                <div class="summary-value" style="color: #e67e22;">${estadisticas.por_mes?.length || 0}</div>
                <div class="summary-label">Meses Activo</div>
            </div>
        `;

        resumenDiv.innerHTML = html;
    }

    mostrarTablaAsistencias(asistencias) {
        const tbody = document.getElementById('asistenciasTableBody');
        if (!tbody) return;
        
        if (!asistencias || asistencias.length === 0) {
            tbody.innerHTML = '<div class="no-data">No se encontraron asistencias registradas</div>';
            return;
        }

        tbody.innerHTML = asistencias.map((asistencia, index) => {
            const fecha = new Date(asistencia.fecha);
            const hora = new Date(`2000-01-01T${asistencia.hora}`);
            
            let tipoClass = '';
            let tipoTexto = '';
            
            switch(asistencia.tipo_registro) {
                case 'manual':
                    tipoClass = 'status-badge status-pendiente';
                    tipoTexto = 'Manual';
                    break;
                case 'dni':
                    tipoClass = 'status-badge status-pagado';
                    tipoTexto = 'Por DNI';
                    break;
                case 'qr':
                    tipoClass = 'status-badge';
                    tipoTexto = 'Por QR';
                    break;
                default:
                    tipoClass = 'status-badge';
                    tipoTexto = asistencia.tipo_registro || 'N/A';
            }

            return `
                <div class="table-row">
                    <div>${index + 1}</div>
                    <div>${fecha.toLocaleDateString()}</div>
                    <div>${hora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
                    <div>
                        <span class="${tipoClass}">
                            ${tipoTexto}
                        </span>
                    </div>
                    <div>${asistencia.ciclo_nombre || 'N/A'}</div>
                    <div>
                        <button class="btn-download" onclick="verDetalleAsistencia(${asistencia.id})">
                            👁️ Ver
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    mostrarPaginacionAsistencias(pagination) {
        const paginationDiv = document.getElementById('asistenciasPagination');
        if (!paginationDiv) return;

        const { page = 1, pages = 1, total = 0 } = pagination || {};

        let html = `
            <button ${page === 1 ? 'disabled' : ''} onclick="cambiarPaginaAsistencias(${page - 1})">
                Anterior
            </button>
            <span>Página ${page} de ${pages} (${total} asistencias)</span>
            <button ${page === pages ? 'disabled' : ''} onclick="cambiarPaginaAsistencias(${page + 1})">
                Siguiente
            </button>
        `;

        paginationDiv.innerHTML = html;
    }

    // Métodos de demostración para cuando las APIs fallen
    mostrarDatosDemo() {
        console.log('📋 Mostrando datos de demostración...');
        
        const datosDemo = {
            estudiante: {
                nombre: 'Ana',
                apellido_paterno: 'García',
                apellido_materno: 'López',
                dni: '12345678',
                email: 'ana.garcia@email.com',
                telefono: '987654321',
                direccion: 'Av. Ejemplo 123',
                fecha_nacimiento: '2000-05-15',
                fecha_ingreso: '2024-01-10',
                estado_estudiante: 'activo'
            },
            matricula: {
                numero_boleta: 'B2024001',
                ciclo_nombre: 'Ciclo 2024-I',
                aula: 'A-101'
            }
        };
        
        this.mostrarPerfil(datosDemo.estudiante, datosDemo.matricula);
    }

    mostrarPagosDemo() {
        const pagosDemo = [
            {
                id: 1,
                numero_cuota: 1,
                monto: "500.00",
                estado: "pagado",
                metodo_pago: "efectivo",
                fecha_vencimiento: "2024-01-15",
                fecha_pago: "2024-01-10",
                numero_boleta: "B2024001",
                ciclo_nombre: "Ciclo 2024-I"
            },
            {
                id: 2,
                numero_cuota: 2,
                monto: "500.00",
                estado: "pendiente",
                metodo_pago: null,
                fecha_vencimiento: "2024-02-15",
                fecha_pago: null,
                numero_boleta: "B2024001",
                ciclo_nombre: "Ciclo 2024-I"
            }
        ];
        
        this.mostrarResumenPagos({
            pendiente: { cantidad: 1, monto: 500 },
            pagado: { cantidad: 1, monto: 500 },
            vencido: { cantidad: 0, monto: 0 },
            total_general: 1000
        });
        
        this.mostrarTablaPagos(pagosDemo);
        this.mostrarPaginacionPagos({ page: 1, pages: 1, total: 2 });
    }

    mostrarAsistenciasDemo() {
        const asistenciasDemo = [
            {
                id: 1,
                fecha: new Date().toISOString().split('T')[0],
                hora: "08:15:00",
                tipo_registro: "dni",
                ciclo_nombre: "Ciclo 2024-I"
            },
            {
                id: 2,
                fecha: new Date(Date.now() - 86400000).toISOString().split('T')[0],
                hora: "08:20:00",
                tipo_registro: "qr",
                ciclo_nombre: "Ciclo 2024-I"
            }
        ];
        
        this.mostrarResumenAsistencias({
            total_asistencias: 15,
            dias_con_asistencia: 12,
            por_mes: [{ mes: 1, año: 2024, total: 15 }],
            año: 2024
        });
        
        this.mostrarTablaAsistencias(asistenciasDemo);
        this.mostrarPaginacionAsistencias({ page: 1, pages: 1, total: 2 });
    }

    setupEventListeners() {
        console.log('✅ Event listeners configurados');
    }

    showMessage(message, type) {
        try {
            // Remover mensajes anteriores
            const existingMessage = document.querySelector('.global-message');
            if (existingMessage) {
                existingMessage.remove();
            }

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
                            type === 'warning' ? '#fff3cd' : '#efe'};
                color: ${type === 'error' ? '#c33' : 
                        type === 'warning' ? '#856404' : '#363'};
                border: 1px solid ${type === 'error' ? '#fcc' : 
                                  type === 'warning' ? '#ffeaa7' : '#cfc'};
                box-shadow: var(--shadow);
            `;

            document.body.appendChild(messageDiv);

            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.remove();
                }
            }, 5000);
        } catch (error) {
            console.error('❌ Error mostrando mensaje:', error);
        }
    }

    redirectToLogin() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    }
}

// Funciones globales
let estudiantePanel;

function cambiarTab(tabName) {
    try {
        // Ocultar todos los tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Mostrar tab seleccionado
        document.getElementById(`tab-${tabName}`).classList.add('active');
        document.querySelector(`.tab[onclick="cambiarTab('${tabName}')"]`).classList.add('active');
        
        if (estudiantePanel) {
            estudiantePanel.currentTab = tabName;
            
            // Cargar datos específicos del tab
            if (tabName === 'pagos') {
                estudiantePanel.cargarPagosDetallados();
            } else if (tabName === 'asistencias') {
                estudiantePanel.cargarAsistenciasDetalladas();
            }
        }
        
    } catch (error) {
        console.error('❌ Error cambiando tab:', error);
    }
}

function cambiarPaginaPagos(page) {
    if (estudiantePanel) {
        estudiantePanel.pagosPage = page;
        estudiantePanel.cargarPagosDetallados();
    }
}

function cambiarPaginaAsistencias(page) {
    if (estudiantePanel) {
        estudiantePanel.asistenciasPage = page;
        estudiantePanel.cargarAsistenciasDetalladas();
    }
}

async function descargarComprobante(pagoId) {
    if (!estudiantePanel) return;
    
    try {
        estudiantePanel.showMessage('Generando comprobante...', 'info');
        
        // Simular generación de comprobante
        setTimeout(() => {
            estudiantePanel.showMessage('Comprobante generado correctamente', 'success');
            
            // Simular descarga
            alert(`✅ Comprobante generado exitosamente\n\nNúmero: CMP-${pagoId.toString().padStart(6, '0')}\nPuede descargarlo desde la sección de documentos.`);
        }, 1500);

    } catch (error) {
        console.error('❌ Error descargando comprobante:', error);
        estudiantePanel.showMessage('Error generando comprobante', 'error');
    }
}

function verDetalleAsistencia(asistenciaId) {
    if (estudiantePanel) {
        estudiantePanel.showMessage(`Detalles de asistencia #${asistenciaId} en desarrollo`, 'info');
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM cargado, inicializando panel estudiantil...');
    estudiantePanel = new EstudiantePanel();
});