// SISTEMA DE REPORTES - VERSIÓN FINAL COMPLETA
console.log('🎯 Script de reportes cargado correctamente');

class ReportesManagement {
    constructor() {
        this.charts = {};
        this.currentTab = 'general';
        console.log('🚀 Constructor de ReportesManagement llamado');
    }

    async init() {
        console.log('🚀 Inicializando gestión de reportes...');
        this.loadUserInfo();
        this.setupEventListeners();
        await this.cargarReporteGeneral();
        this.setDefaultDates();
        console.log('✅ ReportesManagement inicializado correctamente');
    }

    loadUserInfo() {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const userNameElement = document.getElementById('userName');
            const userRoleElement = document.getElementById('userRole');
            
            if (userNameElement && user.nombre) {
                userNameElement.textContent = `${user.nombre} ${user.apellido_paterno}`;
            }
            if (userRoleElement && user.rol) {
                userRoleElement.textContent = user.rol;
            }
            console.log('✅ Información de usuario cargada');
        } catch (error) {
            console.error('❌ Error cargando información de usuario:', error);
        }
    }

    setupEventListeners() {
        this.setDefaultDates();
        console.log('✅ Event listeners configurados');
    }

    setDefaultDates() {
        try {
            const hoy = new Date();
            const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            
            const inicioMes = primerDiaMes.toISOString().split('T')[0];
            const finMes = hoy.toISOString().split('T')[0];
            
            document.getElementById('fechaInicioPagos').value = inicioMes;
            document.getElementById('fechaFinPagos').value = finMes;
            
            const hace7Dias = new Date(hoy);
            hace7Dias.setDate(hoy.getDate() - 7);
            
            document.getElementById('fechaInicioAsistencias').value = hace7Dias.toISOString().split('T')[0];
            document.getElementById('fechaFinAsistencias').value = finMes;
            
        } catch (error) {
            console.error('❌ Error estableciendo fechas:', error);
        }
    }

    async cargarReporteGeneral() {
        try {
            console.log('📈 Cargando reporte general...');
            
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No hay token disponible');
            }

            this.mostrarLoading();

            const response = await fetch('/api/reportes/general', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('📡 Status:', response.status);

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            console.log('📊 Datos recibidos:', data);
            
            if (data.success && data.reporte) {
                console.log('✅ Datos válidos, actualizando interfaz...');
                this.actualizarInterfaz(data.reporte);
                this.showMessage('Reporte general cargado correctamente', 'success');
            } else {
                throw new Error('Estructura de respuesta inválida');
            }

        } catch (error) {
            console.error('❌ Error cargando reporte:', error);
            this.showMessage('Error cargando reporte. Mostrando datos de prueba...', 'warning');
            this.mostrarDatosDePrueba();
        }
    }

    actualizarInterfaz(reporte) {
        console.log('🔄 Actualizando interfaz con:', reporte.general);
        
        // ACTUALIZAR ESTADÍSTICAS PRINCIPALES
        const stats = reporte.general;
        document.getElementById('totalUsuarios').textContent = stats.usuarios || '0';
        document.getElementById('totalEstudiantes').textContent = stats.estudiantes || '0';
        document.getElementById('totalMatriculas').textContent = stats.matriculas || '0';
        document.getElementById('totalPagos').textContent = stats.pagos || '0';
        
        console.log('✅ Estadísticas actualizadas');
        
        // CREAR GRÁFICOS (solo si no existen ya)
        this.crearGraficos(reporte);
    }

    mostrarLoading() {
        document.getElementById('totalUsuarios').textContent = '...';
        document.getElementById('totalEstudiantes').textContent = '...';
        document.getElementById('totalMatriculas').textContent = '...';
        document.getElementById('totalPagos').textContent = '...';
    }

    crearGraficos(reporte) {
        try {
            console.log('📈 Creando gráficos...');
            
            // DESTRUIR GRÁFICOS EXISTENTES DE FORMA SEGURA
            this.destruirGraficosExistentes();

            // Crear nuevos gráficos solo si los datos existen
            if (reporte.ingresos_mensuales && reporte.ingresos_mensuales.length > 0) {
                this.crearGraficoIngresos(reporte.ingresos_mensuales);
            } else {
                console.log('⚠️ No hay datos para gráfico de ingresos');
            }

            if (reporte.asistencias_mensuales && reporte.asistencias_mensuales.length > 0) {
                this.crearGraficoAsistencias(reporte.asistencias_mensuales);
            } else {
                console.log('⚠️ No hay datos para gráfico de asistencias');
            }

            if (reporte.estado_pagos && reporte.estado_pagos.length > 0) {
                this.crearGraficoEstadoPagos(reporte.estado_pagos);
            } else {
                console.log('⚠️ No hay datos para gráfico de estado de pagos');
            }

            if (reporte.distribucion_roles && reporte.distribucion_roles.length > 0) {
                this.crearGraficoRoles(reporte.distribucion_roles);
            } else {
                console.log('⚠️ No hay datos para gráfico de roles');
            }

            console.log('✅ Proceso de creación de gráficos completado');

        } catch (error) {
            console.error('❌ Error creando gráficos:', error);
        }
    }

    destruirGraficosExistentes() {
        console.log('🗑️ Destruyendo gráficos existentes...');
        Object.keys(this.charts).forEach(chartName => {
            if (this.charts[chartName] && typeof this.charts[chartName].destroy === 'function') {
                try {
                    this.charts[chartName].destroy();
                    console.log(`✅ Gráfico ${chartName} destruido`);
                } catch (destroyError) {
                    console.error(`❌ Error destruyendo gráfico ${chartName}:`, destroyError);
                }
            }
        });
        this.charts = {};
    }

    crearGraficoIngresos(datos) {
        try {
            const ctx = document.getElementById('chartIngresos');
            if (!ctx) {
                console.error('❌ Canvas chartIngresos no encontrado');
                return;
            }

            const context = ctx.getContext('2d');
            const labels = datos.map(item => {
                const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                return `${meses[item.mes - 1]} ${item.año}`;
            });
            const valores = datos.map(item => parseFloat(item.total) || 0);

            this.charts.ingresos = new Chart(context, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Ingresos (S/)',
                        data: valores,
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Evolución de Ingresos Mensuales'
                        }
                    }
                }
            });
            console.log('✅ Gráfico de ingresos creado');
        } catch (error) {
            console.error('❌ Error creando gráfico de ingresos:', error);
        }
    }

    crearGraficoAsistencias(datos) {
        try {
            const ctx = document.getElementById('chartAsistencias');
            if (!ctx) {
                console.error('❌ Canvas chartAsistencias no encontrado');
                return;
            }

            const context = ctx.getContext('2d');
            const labels = datos.map(item => {
                const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                return `${meses[item.mes - 1]} ${item.año}`;
            });
            const valores = datos.map(item => parseInt(item.total) || 0);

            this.charts.asistencias = new Chart(context, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Asistencias',
                        data: valores,
                        backgroundColor: '#2ecc71',
                        borderColor: '#27ae60',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Asistencias Mensuales'
                        }
                    }
                }
            });
            console.log('✅ Gráfico de asistencias creado');
        } catch (error) {
            console.error('❌ Error creando gráfico de asistencias:', error);
        }
    }

    crearGraficoEstadoPagos(datos) {
        try {
            const ctx = document.getElementById('chartEstadoPagos');
            if (!ctx) {
                console.error('❌ Canvas chartEstadoPagos no encontrado');
                return;
            }

            const context = ctx.getContext('2d');
            const labels = datos.map(item => {
                const estados = {
                    'pendiente': 'Pendiente',
                    'pagado': 'Pagado', 
                    'vencido': 'Vencido'
                };
                return estados[item.estado] || item.estado;
            });
            const valores = datos.map(item => parseInt(item.total) || 0);
            const colores = ['#f39c12', '#2ecc71', '#e74c3c'];

            this.charts.estadoPagos = new Chart(context, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: valores,
                        backgroundColor: colores,
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Distribución por Estado de Pagos'
                        },
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
            console.log('✅ Gráfico de estado de pagos creado');
        } catch (error) {
            console.error('❌ Error creando gráfico de estado de pagos:', error);
        }
    }

    crearGraficoRoles(datos) {
        try {
            const ctx = document.getElementById('chartRoles');
            if (!ctx) {
                console.error('❌ Canvas chartRoles no encontrado');
                return;
            }

            const context = ctx.getContext('2d');
            const labels = datos.map(item => {
                const roles = {
                    'superadmin': 'Super Admin',
                    'administrativo': 'Administrativo',
                    'docente': 'Docente',
                    'estudiante': 'Estudiante'
                };
                return roles[item.rol] || item.rol;
            });
            const valores = datos.map(item => parseInt(item.total) || 0);
            const colores = ['#3498db', '#9b59b6', '#e67e22', '#2ecc71'];

            this.charts.roles = new Chart(context, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: valores,
                        backgroundColor: colores,
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Distribución de Usuarios por Rol'
                        },
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
            console.log('✅ Gráfico de roles creado');
        } catch (error) {
            console.error('❌ Error creando gráfico de roles:', error);
        }
    }

    mostrarDatosDePrueba() {
        console.log('📋 Mostrando datos de prueba...');
        
        // Actualizar estadísticas con datos de prueba
        document.getElementById('totalUsuarios').textContent = '25';
        document.getElementById('totalEstudiantes').textContent = '68';
        document.getElementById('totalMatriculas').textContent = '45';
        document.getElementById('totalPagos').textContent = '156';
        
        // Crear gráficos de prueba
        this.crearGraficos({
            ingresos_mensuales: [
                { año: 2024, mes: 1, total: "12500.00" },
                { año: 2024, mes: 2, total: "15800.00" }
            ],
            asistencias_mensuales: [
                { año: 2024, mes: 1, total: "285" },
                { año: 2024, mes: 2, total: "312" }
            ],
            estado_pagos: [
                { estado: "pendiente", total: "18" },
                { estado: "pagado", total: "125" }
            ],
            distribucion_roles: [
                { rol: "superadmin", total: "1" },
                { rol: "estudiante", total: "68" }
            ]
        });
    }

    // ==================== REPORTE DE PAGOS ====================
    async generarReportePagos() {
        try {
            console.log('💰 Generando reporte de pagos...');
            
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No hay token disponible');
            }

            const fechaInicio = document.getElementById('fechaInicioPagos').value;
            const fechaFin = document.getElementById('fechaFinPagos').value;
            const estado = document.getElementById('estadoPago').value;

            if (!fechaInicio || !fechaFin) {
                this.showMessage('Por favor, seleccione un rango de fechas', 'warning');
                return;
            }

            this.mostrarLoadingPagos();

            let url = `/api/reportes/pagos?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
            if (estado) {
                url += `&estado=${estado}`;
            }

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                this.mostrarReportePagos(data);
                this.showMessage('Reporte de pagos generado correctamente', 'success');
            } else {
                throw new Error(data.error || 'Error en la respuesta');
            }

        } catch (error) {
            console.error('❌ Error generando reporte de pagos:', error);
            this.showMessage('Error generando reporte de pagos', 'error');
            this.mostrarPagosDePrueba();
        }
    }

    mostrarLoadingPagos() {
        document.getElementById('tablaPagosBody').innerHTML = `
            <div class="loading">⏳ Generando reporte de pagos...</div>
        `;
        document.getElementById('resumenPagos').innerHTML = '';
    }

    mostrarReportePagos(data) {
        try {
            console.log('📊 Mostrando reporte de pagos:', data);
            
            // Mostrar resumen
            this.mostrarResumenPagos(data.totales);
            
            // Mostrar tabla
            const tbody = document.getElementById('tablaPagosBody');
            
            if (!data.pagos || data.pagos.length === 0) {
                tbody.innerHTML = `
                    <div class="table-row">
                        <div colspan="7" style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">
                            No se encontraron pagos en el rango seleccionado
                        </div>
                    </div>
                `;
                return;
            }

            tbody.innerHTML = data.pagos.map(pago => `
                <div class="table-row">
                    <div>${pago.id}</div>
                    <div><strong>${pago.numero_boleta}</strong></div>
                    <div>${pago.nombre} ${pago.apellido_paterno}</div>
                    <div>${pago.numero_cuota}</div>
                    <div><strong>S/ ${parseFloat(pago.monto).toFixed(2)}</strong></div>
                    <div>${new Date(pago.fecha_vencimiento).toLocaleDateString()}</div>
                    <div>
                        <span class="status-badge status-${pago.estado}">
                            ${this.formatearEstado(pago.estado)}
                        </span>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error('❌ Error mostrando reporte de pagos:', error);
        }
    }

    mostrarResumenPagos(totales) {
        const resumenDiv = document.getElementById('resumenPagos');
        
        const html = `
            <div class="summary-card">
                <div class="summary-value" style="color: #f39c12;">S/ ${(totales.pendiente || 0).toFixed(2)}</div>
                <div class="summary-label">Pendiente</div>
            </div>
            <div class="summary-card">
                <div class="summary-value" style="color: #2ecc71;">S/ ${(totales.pagado || 0).toFixed(2)}</div>
                <div class="summary-label">Pagado</div>
            </div>
            <div class="summary-card">
                <div class="summary-value" style="color: #e74c3c;">S/ ${(totales.vencido || 0).toFixed(2)}</div>
                <div class="summary-label">Vencido</div>
            </div>
            <div class="summary-card">
                <div class="summary-value" style="color: #3498db;">S/ ${(totales.total_general || 0).toFixed(2)}</div>
                <div class="summary-label">Total General</div>
            </div>
        `;

        resumenDiv.innerHTML = html;
    }

    mostrarPagosDePrueba() {
        document.getElementById('resumenPagos').innerHTML = `
            <div class="summary-card">
                <div class="summary-value" style="color: #f39c12;">S/ 2,500.00</div>
                <div class="summary-label">Pendiente</div>
            </div>
            <div class="summary-card">
                <div class="summary-value" style="color: #2ecc71;">S/ 12,800.00</div>
                <div class="summary-label">Pagado</div>
            </div>
            <div class="summary-card">
                <div class="summary-value" style="color: #e74c3c;">S/ 800.00</div>
                <div class="summary-label">Vencido</div>
            </div>
        `;

        document.getElementById('tablaPagosBody').innerHTML = `
            <div class="table-row">
                <div>1</div>
                <div><strong>B2024001</strong></div>
                <div>Ana García López</div>
                <div>3</div>
                <div><strong>S/ 500.00</strong></div>
                <div>15/03/2024</div>
                <div><span class="status-badge status-pendiente">Pendiente</span></div>
            </div>
            <div class="table-row">
                <div>2</div>
                <div><strong>B2024002</strong></div>
                <div>Carlos Rodríguez</div>
                <div>2</div>
                <div><strong>S/ 450.00</strong></div>
                <div>10/03/2024</div>
                <div><span class="status-badge status-pagado">Pagado</span></div>
            </div>
        `;
    }

    // ==================== REPORTE DE ASISTENCIAS ====================
    async generarReporteAsistencias() {
        try {
            console.log('✅ Generando reporte de asistencias...');
            
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No hay token disponible');
            }

            const fechaInicio = document.getElementById('fechaInicioAsistencias').value;
            const fechaFin = document.getElementById('fechaFinAsistencias').value;
            const tipoRegistro = document.getElementById('tipoRegistro').value;

            if (!fechaInicio || !fechaFin) {
                this.showMessage('Por favor, seleccione un rango de fechas', 'warning');
                return;
            }

            this.mostrarLoadingAsistencias();

            let url = `/api/reportes/asistencias?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
            if (tipoRegistro) {
                url += `&tipo_registro=${tipoRegistro}`;
            }

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                this.mostrarReporteAsistencias(data);
                this.showMessage('Reporte de asistencias generado correctamente', 'success');
            } else {
                throw new Error(data.error || 'Error en la respuesta');
            }

        } catch (error) {
            console.error('❌ Error generando reporte de asistencias:', error);
            this.showMessage('Error generando reporte de asistencias', 'error');
            this.mostrarAsistenciasDePrueba();
        }
    }

    mostrarLoadingAsistencias() {
        document.getElementById('tablaAsistenciasBody').innerHTML = `
            <div class="loading">⏳ Generando reporte de asistencias...</div>
        `;
        document.getElementById('resumenAsistencias').innerHTML = '';
    }

    mostrarReporteAsistencias(data) {
        try {
            console.log('📊 Mostrando reporte de asistencias:', data);
            
            // Mostrar resumen
            this.mostrarResumenAsistencias(data.estadisticas);
            
            // Mostrar tabla
            const tbody = document.getElementById('tablaAsistenciasBody');
            
            if (!data.asistencias || data.asistencias.length === 0) {
                tbody.innerHTML = `
                    <div class="table-row">
                        <div colspan="7" style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">
                            No se encontraron asistencias en el rango seleccionado
                        </div>
                    </div>
                `;
                return;
            }

            tbody.innerHTML = data.asistencias.map(asistencia => `
                <div class="table-row">
                    <div>${asistencia.id}</div>
                    <div>${asistencia.dni}</div>
                    <div>${asistencia.nombre} ${asistencia.apellido_paterno}</div>
                    <div>${new Date(asistencia.fecha).toLocaleDateString()}</div>
                    <div>${asistencia.hora.substring(0, 5)}</div>
                    <div>
                        <span class="status-badge">
                            ${this.formatearTipoRegistro(asistencia.tipo_registro)}
                        </span>
                    </div>
                    <div>${asistencia.ciclo_nombre || 'N/A'}</div>
                </div>
            `).join('');

        } catch (error) {
            console.error('❌ Error mostrando reporte de asistencias:', error);
        }
    }

    mostrarResumenAsistencias(estadisticas) {
        const resumenDiv = document.getElementById('resumenAsistencias');
        
        const html = `
            <div class="summary-card">
                <div class="summary-value" style="color: #3498db;">${estadisticas.total_asistencias || 0}</div>
                <div class="summary-label">Total Asistencias</div>
            </div>
            ${Object.entries(estadisticas.por_tipo || {}).map(([tipo, cantidad]) => `
                <div class="summary-card">
                    <div class="summary-value" style="color: #2ecc71;">${cantidad}</div>
                    <div class="summary-label">${this.formatearTipoRegistro(tipo)}</div>
                </div>
            `).join('')}
        `;

        resumenDiv.innerHTML = html;
    }

    mostrarAsistenciasDePrueba() {
        document.getElementById('resumenAsistencias').innerHTML = `
            <div class="summary-card">
                <div class="summary-value" style="color: #3498db;">45</div>
                <div class="summary-label">Total Asistencias</div>
            </div>
            <div class="summary-card">
                <div class="summary-value" style="color: #2ecc71;">28</div>
                <div class="summary-label">Por DNI</div>
            </div>
            <div class="summary-card">
                <div class="summary-value" style="color: #e67e22;">12</div>
                <div class="summary-label">Por QR</div>
            </div>
        `;

        document.getElementById('tablaAsistenciasBody').innerHTML = `
            <div class="table-row">
                <div>1</div>
                <div>12345678</div>
                <div>Ana García López</div>
                <div>15/03/2024</div>
                <div>08:15</div>
                <div><span class="status-badge">Por DNI</span></div>
                <div>Ciclo 2024-I</div>
            </div>
            <div class="table-row">
                <div>2</div>
                <div>87654321</div>
                <div>Carlos Rodríguez</div>
                <div>15/03/2024</div>
                <div>08:20</div>
                <div><span class="status-badge">Por QR</span></div>
                <div>Ciclo 2024-I</div>
            </div>
        `;
    }

    // ==================== FUNCIONES AUXILIARES ====================
    formatearEstado(estado) {
        const estados = {
            'pendiente': 'Pendiente',
            'pagado': 'Pagado',
            'vencido': 'Vencido'
        };
        return estados[estado] || estado;
    }

    formatearTipoRegistro(tipo) {
        const tipos = {
            'manual': 'Manual',
            'dni': 'Por DNI', 
            'qr': 'Por QR'
        };
        return tipos[tipo] || tipo;
    }

    showMessage(message, type) {
        try {
            const messageDiv = document.createElement('div');
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
            `;
            document.body.appendChild(messageDiv);
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.remove();
                }
            }, 3000);
        } catch (error) {
            console.error('❌ Error mostrando mensaje:', error);
        }
    }
}

// ==================== FUNCIONES GLOBALES ====================
let reportesManager;

function cambiarTab(tabName) {
    try {
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        
        document.getElementById(`tab-${tabName}`).classList.add('active');
        document.querySelector(`.tab[onclick="cambiarTab('${tabName}')"]`).classList.add('active');
        
        if (reportesManager) {
            reportesManager.currentTab = tabName;
        }
    } catch (error) {
        console.error('❌ Error cambiando tab:', error);
    }
}

function goToDashboard() {
    window.location.href = '/superadmin/dashboard.html';
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

function generarReporteCompleto() {
    if (reportesManager) {
        reportesManager.cargarReporteGeneral();
        reportesManager.showMessage('Reportes actualizados correctamente', 'success');
    }
}

function generarReportePagos() {
    if (reportesManager) {
        reportesManager.generarReportePagos();
    }
}

function generarReporteAsistencias() {
    if (reportesManager) {
        reportesManager.generarReporteAsistencias();
    }
}

// Funciones de exportación (placeholders)
function exportarPagosPDF() {
    alert('📄 Función de exportación a PDF para pagos - En desarrollo');
}

function exportarPagosExcel() {
    alert('📊 Función de exportación a Excel para pagos - En desarrollo');
}

function exportarAsistenciasPDF() {
    alert('📄 Función de exportación a PDF para asistencias - En desarrollo');
}

function exportarAsistenciasExcel() {
    alert('📊 Función de exportación a Excel para asistencias - En desarrollo');
}

function exportarGeneralPDF() {
    alert('📄 Función de exportación a PDF para reporte general - En desarrollo');
}

function exportarGeneralExcel() {
    alert('📊 Función de exportación a Excel para reporte general - En desarrollo');
}

function exportarPagosCompletoPDF() {
    alert('📄 Función de exportación a PDF para pagos completo - En desarrollo');
}

function exportarPagosCompletoExcel() {
    alert('📊 Función de exportación a Excel para pagos completo - En desarrollo');
}

function exportarAsistenciasCompletoPDF() {
    alert('📄 Función de exportación a PDF para asistencias completo - En desarrollo');
}

function exportarAsistenciasCompletoExcel() {
    alert('📊 Función de exportación a Excel para asistencias completo - En desarrollo');
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM cargado, inicializando reportes...');
    reportesManager = new ReportesManagement();
    reportesManager.init();
});