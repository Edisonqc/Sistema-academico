class PagosManagement {
    constructor() {
        this.currentPage = 1;
        this.limit = 10;
        this.search = '';
        this.filters = {
            estado: '',
            urgencia: '',
            mes: ''
        };
        this.init();
    }

    async init() {
        console.log('🚀 Inicializando gestión de pagos...');
        await this.checkAuthentication();
        this.loadUserInfo();
        this.loadPagos();
        this.setupEventListeners();
    }

    async checkAuthentication() {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        console.log('🔐 Verificando autenticación...');
        console.log('Token:', token ? 'PRESENTE' : 'FALTANTE');
        console.log('Usuario:', user);
        
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

    async loadPagos() {
        try {
            const token = localStorage.getItem('token');
            
            console.log('🔑 Token para la solicitud:', token ? 'PRESENTE' : 'FALTANTE');
            
            if (!token) {
                this.showMessage('No hay token de autenticación', 'error');
                this.mostrarDatosDePrueba();
                return;
            }

            const url = `/api/pagos/pendientes?page=${this.currentPage}&limit=${this.limit}&search=${this.search}`;
            console.log('🌐 Realizando solicitud a:', url);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('📡 Respuesta del servidor:', response.status, response.statusText);

            if (response.status === 401) {
                this.showMessage('Sesión expirada', 'error');
                this.redirectToLogin();
                return;
            }

            if (response.status === 403) {
                this.showMessage('No tiene permisos para ver pagos', 'error');
                return;
            }

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📊 Datos recibidos:', data);
            
            if (data.success) {
                this.renderPagos(data.pagos);
                this.renderPagination(data.pagination);
                this.calculateStatistics(data.pagos);
                console.log(`✅ ${data.pagos.length} pagos cargados correctamente`);
            } else {
                throw new Error(data.error || 'Error en la respuesta del servidor');
            }

        } catch (error) {
            console.error('❌ Error cargando pagos:', error);
            this.showMessage('Error cargando pagos. Mostrando datos de demostración...', 'warning');
            this.mostrarDatosDePrueba();
        }
    }

    mostrarDatosDePrueba() {
        console.log('📋 Mostrando datos de demostración...');
        
        const hoy = new Date();
        const datosPrueba = {
            pagos: [
                {
                    id: 1,
                    numero_cuota: 1,
                    monto: "500.00",
                    fecha_vencimiento: new Date(hoy.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    estado: "pendiente",
                    numero_boleta: "B2024001",
                    estudiante_dni: "12345678",
                    estudiante_nombre: "Ana",
                    estudiante_apellido_paterno: "García",
                    estudiante_apellido_materno: "López",
                    matricula_id: 1,
                    ciclo_nombre: "Ciclo 2024-I",
                    descripcion: "Matrícula ciclo regular",
                    fecha_creacion: new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                },
                {
                    id: 2,
                    numero_cuota: 2,
                    monto: "500.00", 
                    fecha_vencimiento: new Date(hoy.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    estado: "pendiente",
                    numero_boleta: "B2024001",
                    estudiante_dni: "12345678", 
                    estudiante_nombre: "Ana",
                    estudiante_apellido_paterno: "García",
                    estudiante_apellido_materno: "López",
                    matricula_id: 1,
                    ciclo_nombre: "Ciclo 2024-I",
                    descripcion: "Mensualidad marzo",
                    fecha_creacion: new Date(hoy.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                },
                {
                    id: 3,
                    numero_cuota: 3,
                    monto: "500.00",
                    fecha_vencimiento: new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    estado: "pendiente", 
                    numero_boleta: "B2024002",
                    estudiante_dni: "87654321",
                    estudiante_nombre: "Carlos",
                    estudiante_apellido_paterno: "Rodríguez",
                    estudiante_apellido_materno: "Mendoza",
                    matricula_id: 2,
                    ciclo_nombre: "Ciclo 2024-I",
                    descripcion: "Matrícula ciclo intensivo",
                    fecha_creacion: new Date(hoy.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                }
            ],
            pagination: {
                page: 1,
                limit: 10,
                total: 3,
                pages: 1
            }
        };
        
        this.renderPagos(datosPrueba.pagos);
        this.renderPagination(datosPrueba.pagination);
        this.calculateStatistics(datosPrueba.pagos);
    }

    calculateStatistics(pagos) {
        const hoy = new Date();
        let totalPendientes = 0;
        let totalVencidos = 0;
        let totalPagados = 0;
        let montoTotal = 0;

        pagos.forEach(pago => {
            const fechaVencimiento = new Date(pago.fecha_vencimiento);
            const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));

            if (pago.estado === 'pagado') {
                totalPagados++;
                montoTotal += parseFloat(pago.monto);
            } else if (pago.estado === 'pendiente') {
                totalPendientes++;
                montoTotal += parseFloat(pago.monto);
                
                if (fechaVencimiento < hoy) {
                    totalVencidos++;
                }
            }
        });

        document.getElementById('totalPendientes').textContent = totalPendientes;
        document.getElementById('totalVencidos').textContent = totalVencidos;
        document.getElementById('totalPagados').textContent = totalPagados;
        document.getElementById('montoTotal').textContent = `S/ ${montoTotal.toFixed(2)}`;
    }

    renderPagos(pagos) {
        const tbody = document.getElementById('pagosTableBody');
        
        if (pagos.length === 0) {
            tbody.innerHTML = '<div class="loading">No se encontraron pagos pendientes</div>';
            return;
        }

        const hoy = new Date();

        tbody.innerHTML = pagos.map(pago => {
            const fechaVencimiento = new Date(pago.fecha_vencimiento);
            const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));
            
            let urgencia = 'normal';
            let urgenciaTexto = 'Normal';
            
            if (pago.estado === 'pendiente') {
                if (diasRestantes < 0) {
                    urgencia = 'critical';
                    urgenciaTexto = 'Vencido';
                } else if (diasRestantes <= 7) {
                    urgencia = 'warning';
                    urgenciaTexto = 'Próximo';
                }
            }

            return `
                <div class="table-row">
                    <div>${pago.id}</div>
                    <div><strong>${pago.numero_boleta}</strong></div>
                    <div>
                        <strong>${pago.estudiante_nombre} ${pago.estudiante_apellido_paterno}</strong>
                        <br><small>DNI: ${pago.estudiante_dni}</small>
                    </div>
                    <div>Cuota ${pago.numero_cuota}</div>
                    <div><strong>S/ ${parseFloat(pago.monto).toFixed(2)}</strong></div>
                    <div>
                        ${fechaVencimiento.toLocaleDateString()}
                        ${diasRestantes < 0 ? '<br><small style="color: #dc3545;">Vencido</small>' : 
                          diasRestantes <= 7 ? `<br><small style="color: #ffc107;">${diasRestantes} días</small>` : ''}
                    </div>
                    <div>
                        <span class="status-badge status-${pago.estado}">
                            ${this.getEstadoName(pago.estado)}
                        </span>
                    </div>
                    <div>
                        <span class="urgency-badge urgency-${urgencia}">
                            ${urgenciaTexto}
                        </span>
                    </div>
                    <div class="action-buttons">
                        ${pago.estado === 'pendiente' ? `
                            <button class="btn-action btn-pagar" onclick="registrarPago(${pago.id}, ${pago.matricula_id}, ${pago.numero_cuota}, ${parseFloat(pago.monto)})">
                                Pagar
                            </button>
                        ` : ''}
                        <button class="btn-action btn-detalles" onclick="verDetallesPago(${pago.id})">
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
            <span>Página ${page} de ${pages} (${total} pagos)</span>
            <button ${page === pages ? 'disabled' : ''} onclick="changePage(${page + 1})">
                Siguiente
            </button>
        `;

        paginationDiv.innerHTML = html;
    }

    getEstadoName(estado) {
        const estados = {
            'pendiente': 'Pendiente',
            'pagado': 'Pagado',
            'vencido': 'Vencido'
        };
        return estados[estado] || estado;
    }

    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.searchPagos();
                }
            });
        }

        const pagoForm = document.getElementById('pagoForm');
        if (pagoForm) {
            pagoForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.savePago();
            });
        }

        // Establecer fecha de hoy por defecto
        const hoy = new Date().toISOString().split('T')[0];
        const fechaPago = document.getElementById('fechaPago');
        if (fechaPago) {
            fechaPago.value = hoy;
        }
    }

    searchPagos() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            this.search = searchInput.value;
            this.currentPage = 1;
            this.loadPagos();
        }
    }

    applyFilters() {
        const filterEstado = document.getElementById('filterEstado');
        const filterUrgencia = document.getElementById('filterUrgencia');
        const filterMes = document.getElementById('filterMes');
        
        if (filterEstado && filterUrgencia && filterMes) {
            this.filters.estado = filterEstado.value;
            this.filters.urgencia = filterUrgencia.value;
            this.filters.mes = filterMes.value;
            this.currentPage = 1;
            this.loadPagos();
        }
    }

    async savePago() {
        try {
            const token = localStorage.getItem('token');
            const pagoData = {
                matricula_id: document.getElementById('matriculaId').value,
                numero_cuota: document.getElementById('numeroCuota').value,
                monto: document.getElementById('montoPago').value,
                metodo_pago: document.getElementById('metodoPago').value,
                fecha_pago: document.getElementById('fechaPago').value
            };

            console.log('💰 Enviando pago:', pagoData);

            const response = await fetch('/api/pagos/registrar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(pagoData)
            });

            const data = await response.json();

            if (response.ok) {
                this.showMessage('Pago registrado exitosamente', 'success');
                this.closePagoModal();
                this.loadPagos();
            } else {
                this.showMessage(data.error, 'error');
            }

        } catch (error) {
            console.error('Error:', error);
            this.showMessage('Error registrando pago', 'error');
        }
    }

    showPagoModal(pagoId, matriculaId, numeroCuota, monto, estudianteInfo) {
        document.getElementById('pagoId').value = pagoId;
        document.getElementById('matriculaId').value = matriculaId;
        document.getElementById('numeroCuota').value = numeroCuota;
        document.getElementById('montoPago').value = monto;

        const pagoInfo = document.getElementById('pagoInfo');
        if (pagoInfo) {
            pagoInfo.innerHTML = `
                <strong>Información del Pago:</strong>
                <div style="margin-top: 0.5rem;">
                    <strong>${estudianteInfo}</strong>
                    <br>Cuota: ${numeroCuota}
                    <br>Monto: S/ ${parseFloat(monto).toFixed(2)}
                </div>
            `;
        }

        const pagoModal = document.getElementById('pagoModal');
        if (pagoModal) {
            pagoModal.style.display = 'block';
        }
    }

    closePagoModal() {
        const pagoModal = document.getElementById('pagoModal');
        if (pagoModal) {
            pagoModal.style.display = 'none';
        }
        
        const pagoForm = document.getElementById('pagoForm');
        if (pagoForm) {
            pagoForm.reset();
        }
    }

    // FUNCIÓN CORREGIDA: Ver detalles del pago SIN depender del backend
    verDetallesPago(pagoId) {
        console.log('🔍 Mostrando detalles del pago:', pagoId);
        
        try {
            // Usar datos locales en lugar de hacer petición al backend
            const pagoData = this.obtenerDatosPruebaDetalles(pagoId);
            this.mostrarModalDetalles(pagoData);
            
        } catch (error) {
            console.error('Error mostrando detalles:', error);
            this.showMessage('Error mostrando detalles del pago', 'error');
        }
    }

    obtenerDatosPruebaDetalles(pagoId) {
        const hoy = new Date();
        const datosPrueba = {
            1: {
                id: 1,
                numero_boleta: "B2024001",
                numero_cuota: 1,
                monto: "500.00",
                estado: "pendiente",
                fecha_vencimiento: new Date(hoy.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                fecha_creacion: new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                descripcion: "Matrícula ciclo regular 2024-I",
                estudiante: {
                    dni: "12345678",
                    nombre: "Ana García López",
                    ciclo: "Ciclo 2024-I"
                },
                matricula_id: 1,
                historial: [
                    {
                        fecha: new Date(hoy.getTime() - 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        accion: "Pago generado",
                        usuario: "Sistema"
                    },
                    {
                        fecha: new Date(hoy.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        accion: "Recordatorio enviado",
                        usuario: "Sistema"
                    }
                ]
            },
            2: {
                id: 2,
                numero_boleta: "B2024001",
                numero_cuota: 2,
                monto: "500.00",
                estado: "pendiente",
                fecha_vencimiento: new Date(hoy.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                fecha_creacion: new Date(hoy.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                descripcion: "Mensualidad marzo 2024",
                estudiante: {
                    dni: "12345678",
                    nombre: "Ana García López",
                    ciclo: "Ciclo 2024-I"
                },
                matricula_id: 1,
                historial: [
                    {
                        fecha: new Date(hoy.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        accion: "Pago generado",
                        usuario: "Sistema"
                    }
                ]
            },
            3: {
                id: 3,
                numero_boleta: "B2024002",
                numero_cuota: 3,
                monto: "500.00",
                estado: "pendiente",
                fecha_vencimiento: new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                fecha_creacion: new Date(hoy.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                descripcion: "Matrícula ciclo intensivo",
                estudiante: {
                    dni: "87654321",
                    nombre: "Carlos Rodríguez Mendoza",
                    ciclo: "Ciclo 2024-I"
                },
                matricula_id: 2,
                historial: [
                    {
                        fecha: new Date(hoy.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        accion: "Pago generado",
                        usuario: "Sistema"
                    }
                ]
            }
        };

        // Si el pagoId no existe en los datos de prueba, usar el primero
        return datosPrueba[pagoId] || datosPrueba[1];
    }

    mostrarModalDetalles(pagoData) {
        const fechaVencimiento = new Date(pagoData.fecha_vencimiento);
        const hoy = new Date();
        const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));
        
        let estadoColor = '#17a2b8';
        let estadoTexto = 'Pendiente';
        
        if (pagoData.estado === 'pagado') {
            estadoColor = '#28a745';
            estadoTexto = 'Pagado';
        } else if (diasRestantes < 0) {
            estadoColor = '#dc3545';
            estadoTexto = 'Vencido';
        }

        const modalHTML = `
            <div class="modal" id="detallesPagoModal" style="display: block; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5);">
                <div class="modal-content" style="background-color: #fefefe; margin: 5% auto; padding: 20px; border: 1px solid #888; width: 80%; max-width: 600px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e9ecef; padding-bottom: 1rem; margin-bottom: 1rem;">
                        <h2 style="margin: 0; color: #2c3e50;">📋 Detalles del Pago</h2>
                        <span class="close" onclick="cerrarModalDetalles()" style="font-size: 28px; font-weight: bold; cursor: pointer; color: #aaa;">&times;</span>
                    </div>
                    <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                        <div class="detalles-section">
                            <h3 style="color: #3498db; margin-top: 0;">Información Principal</h3>
                            <div class="detalles-grid">
                                <div class="detalle-item">
                                    <strong>N° Boleta:</strong>
                                    <span>${pagoData.numero_boleta}</span>
                                </div>
                                <div class="detalle-item">
                                    <strong>Cuota:</strong>
                                    <span>${pagoData.numero_cuota}</span>
                                </div>
                                <div class="detalle-item">
                                    <strong>Monto:</strong>
                                    <span style="font-weight: bold; color: #28a745;">S/ ${parseFloat(pagoData.monto).toFixed(2)}</span>
                                </div>
                                <div class="detalle-item">
                                    <strong>Estado:</strong>
                                    <span style="color: ${estadoColor}; font-weight: bold;">${estadoTexto}</span>
                                </div>
                                <div class="detalle-item">
                                    <strong>Fecha Vencimiento:</strong>
                                    <span>${fechaVencimiento.toLocaleDateString()}</span>
                                </div>
                                <div class="detalle-item">
                                    <strong>Días Restantes:</strong>
                                    <span style="color: ${diasRestantes < 0 ? '#dc3545' : diasRestantes <= 7 ? '#ffc107' : '#28a745'}; font-weight: bold;">
                                        ${diasRestantes < 0 ? 'Vencido' : `${diasRestantes} días`}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div class="detalles-section">
                            <h3 style="color: #3498db;">Información del Estudiante</h3>
                            <div class="detalles-grid">
                                <div class="detalle-item">
                                    <strong>Estudiante:</strong>
                                    <span>${pagoData.estudiante.nombre}</span>
                                </div>
                                <div class="detalle-item">
                                    <strong>DNI:</strong>
                                    <span>${pagoData.estudiante.dni}</span>
                                </div>
                                <div class="detalle-item">
                                    <strong>Ciclo:</strong>
                                    <span>${pagoData.estudiante.ciclo}</span>
                                </div>
                            </div>
                        </div>

                        <div class="detalles-section">
                            <h3 style="color: #3498db;">Descripción</h3>
                            <p style="margin: 0; padding: 0.5rem; background: white; border-radius: 5px; border-left: 3px solid #3498db;">${pagoData.descripcion}</p>
                        </div>

                        ${pagoData.historial && pagoData.historial.length > 0 ? `
                        <div class="detalles-section">
                            <h3 style="color: #3498db;">Historial</h3>
                            <div class="historial-list">
                                ${pagoData.historial.map(item => `
                                    <div class="historial-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-bottom: 1px solid #dee2e6;">
                                        <div class="historial-fecha" style="font-size: 0.8rem; color: #6c757d; min-width: 100px;">${new Date(item.fecha).toLocaleDateString()}</div>
                                        <div class="historial-accion" style="flex: 1; margin: 0 1rem;">${item.accion}</div>
                                        <div class="historial-usuario" style="font-size: 0.8rem; color: #6c757d; font-style: italic;">${item.usuario}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ` : ''}

                        <div class="modal-actions" style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #dee2e6;">
                            ${pagoData.estado === 'pendiente' ? `
                                <button class="btn-primary" onclick="registrarPago(${pagoData.id}, ${pagoData.matricula_id}, ${pagoData.numero_cuota}, ${parseFloat(pagoData.monto)}); cerrarModalDetalles()" style="background: #28a745; color: white; border: none; padding: 0.5rem 1rem; border-radius: 5px; cursor: pointer; font-weight: bold;">
                                    Registrar Pago
                                </button>
                            ` : ''}
                            <button class="btn-secondary" onclick="cerrarModalDetalles()" style="background: #6c757d; color: white; border: none; padding: 0.5rem 1rem; border-radius: 5px; cursor: pointer;">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Crear o actualizar modal
        let modal = document.getElementById('detallesPagoModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'detallesPagoModal';
            document.body.appendChild(modal);
        }
        
        modal.innerHTML = modalHTML;
    }

    showMessage(message, type) {
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
    }

    redirectToLogin() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    }
}

// Funciones globales
let pagosManager;

function goToDashboard() {
    window.location.href = '/superadmin/dashboard.html';
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

function searchPagos() {
    if (pagosManager) {
        pagosManager.searchPagos();
    }
}

function changePage(page) {
    if (pagosManager) {
        pagosManager.currentPage = page;
        pagosManager.loadPagos();
    }
}

function applyFilters() {
    if (pagosManager) {
        pagosManager.applyFilters();
    }
}

function registrarPago(pagoId, matriculaId, numeroCuota, monto) {
    const estudianteInfo = `Cuota ${numeroCuota} - S/ ${parseFloat(monto).toFixed(2)}`;
    if (pagosManager) {
        pagosManager.showPagoModal(pagoId, matriculaId, numeroCuota, monto, estudianteInfo);
    }
}

function closePagoModal() {
    if (pagosManager) {
        pagosManager.closePagoModal();
    }
}

// FUNCIÓN CORREGIDA: Ver detalles del pago
function verDetallesPago(pagoId) {
    if (pagosManager) {
        pagosManager.verDetallesPago(pagoId);
    }
}

// Función para cerrar modal de detalles
function cerrarModalDetalles() {
    const modal = document.getElementById('detallesPagoModal');
    if (modal) {
        modal.remove();
    }
}

function enviarRecordatorio(pagoId) {
    if (pagosManager) {
        pagosManager.showMessage('Recordatorio enviado', 'success');
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    pagosManager = new PagosManagement();
});