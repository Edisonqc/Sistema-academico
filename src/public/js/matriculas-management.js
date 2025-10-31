class MatriculasManagement {
    constructor() {
        this.currentPage = 1;
        this.limit = 10;
        this.search = '';
        this.ciclos = [];
        this.estudiantes = [];
        this.init();
    }

    /* ---------- Inicialización ---------- */
    async init() {
        await this.checkAuthentication();
        this.loadUserInfo();
        this.loadMatriculas();
        this.loadCiclosAcademicos();
        this.setupEventListeners();
        this.crearModalMatriculas();
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
            const nameEl = document.getElementById('userName');
            const roleEl = document.getElementById('userRole');
            if (nameEl) nameEl.textContent = `${user.nombre} ${user.apellido_paterno}`;
            if (roleEl) roleEl.textContent = user.rol;
        }
    }

    /* ---------- Carga de datos ---------- */
    async loadMatriculas() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `/api/matriculas?page=${this.currentPage}&limit=${this.limit}&search=${encodeURIComponent(this.search)}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (!response.ok) throw new Error('Error cargando matrículas');

            const data = await response.json();
            this.renderMatriculas(Array.isArray(data.matriculas) ? data.matriculas : []);
            this.renderPagination(data.pagination || { page: 1, pages: 1, total: 0 });
        } catch (error) {
            console.error('Error:', error);
            this.showMessage('Error cargando matrículas', 'error');
        }
    }

    async loadCiclosAcademicos() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/estudiantes/ciclos/activos', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                this.ciclos = Array.isArray(data.ciclos) ? data.ciclos : [];
                this.renderCiclosSelect();
            } else {
                console.warn('No se pudo cargar ciclos académicos:', response.status);
            }
        } catch (error) {
            console.error('Error cargando ciclos:', error);
        }
    }

    /* ---------- Render listado ---------- */
    renderMatriculas(matriculas) {
        const tbody = document.getElementById('matriculasTableBody');
        if (!tbody) return;

        if (!matriculas || matriculas.length === 0) {
            tbody.innerHTML = '<div class="loading">No se encontraron matrículas</div>';
            return;
        }

        tbody.innerHTML = matriculas.map(matricula => `
            <div class="table-row">
                <div>${matricula.id}</div>
                <div><strong>${matricula.numero_boleta}</strong></div>
                <div>
                    <strong>${matricula.estudiante_nombre || ''} ${matricula.estudiante_apellido_paterno || ''}</strong>
                    <br><small>DNI: ${matricula.estudiante_dni || ''}</small>
                </div>
                <div>
                    ${matricula.ciclo_nombre || 'N/A'}
                    <br><small>S/ ${matricula.ciclo_precio ? parseFloat(matricula.ciclo_precio).toFixed(2) : '0.00'}</small>
                </div>
                <div>${matricula.fecha_matricula ? new Date(matricula.fecha_matricula).toLocaleDateString() : 'N/A'}</div>
                <div>${this.getMetodoPagoName(matricula.metodo_pago)}</div>
                <div>${matricula.descuento ?? 0}%</div>
                <div>
                    <span class="status-badge status-${matricula.estado || 'inactivo'}">
                        ${this.getEstadoName(matricula.estado)}
                    </span>
                </div>
                <div class="action-buttons">
                    <button class="btn-action btn-view" onclick="verMatricula(${matricula.id})">Ver</button>
                    <button class="btn-action btn-pagos" onclick="gestionarPagos(${matricula.id})">Pagos</button>
                </div>
            </div>
        `).join('');
    }

    renderPagination(pagination) {
        const paginationDiv = document.getElementById('pagination');
        if (!paginationDiv) return;
        const { page = 1, pages = 1, total = 0 } = pagination;
        paginationDiv.innerHTML = `
            <button ${page === 1 ? 'disabled' : ''} onclick="changePage(${page - 1})">Anterior</button>
            <span>Página ${page} de ${pages} (${total} matrículas)</span>
            <button ${page === pages ? 'disabled' : ''} onclick="changePage(${page + 1})">Siguiente</button>
        `;
    }

    renderCiclosSelect() {
        const select = document.getElementById('ciclo_id');
        if (!select) return;
        select.innerHTML = '<option value="">Seleccionar ciclo académico</option>';
        this.ciclos.forEach(ciclo => {
            const option = document.createElement('option');
            option.value = ciclo.id;
            option.textContent = `${ciclo.nombre} - S/ ${parseFloat(ciclo.precio).toFixed(2)}`;
            option.dataset.precio = ciclo.precio;
            select.appendChild(option);
        });
    }

    getMetodoPagoName(metodo) {
        const metodos = {
            efectivo: 'Efectivo',
            tarjeta: 'Tarjeta',
            transferencia: 'Transferencia',
            deposito: 'Depósito'
        };
        return metodos[metodo] || (metodo || 'N/A');
    }

    getEstadoName(estado) {
        const estados = {
            activo: 'Activo',
            inactivo: 'Inactivo',
            completado: 'Completado'
        };
        return estados[estado] || (estado || 'N/A');
    }

    /* ---------- Eventos DOM ---------- */
    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.searchMatriculas(); });

        const form = document.getElementById('matriculaForm');
        if (form) form.addEventListener('submit', (e) => { e.preventDefault(); this.saveMatricula(); });

        const buscarEstudianteInput = document.getElementById('buscar_estudiante');
        if (buscarEstudianteInput) buscarEstudianteInput.addEventListener('input', (e) => { this.buscarEstudiantes(e.target.value); });

        const cicloSelect = document.getElementById('ciclo_id');
        if (cicloSelect) cicloSelect.addEventListener('change', (e) => { this.mostrarInfoCiclo(e.target.value); });

        const descuento = document.getElementById('descuento');
        if (descuento) descuento.addEventListener('input', () => this.calcularCuotas());

        const fechaPrimer = document.getElementById('fecha_primer_vencimiento');
        if (fechaPrimer && !fechaPrimer.value) {
            const fechaDefault = new Date();
            fechaDefault.setDate(fechaDefault.getDate() + 30);
            fechaPrimer.value = fechaDefault.toISOString().split('T')[0];
        }
    }

    searchMatriculas() {
        const input = document.getElementById('searchInput');
        this.search = input ? input.value : '';
        this.currentPage = 1;
        this.loadMatriculas();
    }

    /* ---------- Búsqueda / Selección estudiantes ---------- */
    async buscarEstudiantes(termino) {
        const resultadosDiv = document.getElementById('resultadosEstudiantes');
        if (!resultadosDiv) return;

        if (!termino || termino.length < 2) {
            resultadosDiv.style.display = 'none';
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/estudiantes?search=${encodeURIComponent(termino)}&limit=10`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) return;
            const data = await response.json();
            const estudiantes = Array.isArray(data.estudiantes) ? data.estudiantes : [];
            this.mostrarResultadosEstudiantes(estudiantes);
        } catch (error) {
            console.error('Error buscando estudiantes:', error);
        }
    }

    mostrarResultadosEstudiantes(estudiantes) {
        const resultadosDiv = document.getElementById('resultadosEstudiantes');
        if (!resultadosDiv) return;

        if (!estudiantes || estudiantes.length === 0) {
            resultadosDiv.innerHTML = '<div style="padding: 0.5rem; color: var(--text-muted);">No se encontraron estudiantes</div>';
            resultadosDiv.style.display = 'block';
            return;
        }

        resultadosDiv.innerHTML = estudiantes.map(estudiante => `
            <div class="student-result" 
                 onclick="seleccionarEstudiante(${estudiante.id}, '${estudiante.dni}', '${this._escape(estudiante.nombre)}', '${this._escape(estudiante.apellido_paterno)}', '${this._escape(estudiante.apellido_materno || '')}')"
                 style="padding: 0.75rem; border-bottom: 1px solid var(--border-color); cursor: pointer;">
                <strong>${estudiante.nombre} ${estudiante.apellido_paterno} ${estudiante.apellido_materno || ''}</strong>
                <br><small>DNI: ${estudiante.dni} | ${estudiante.email || 'Sin email'}</small>
            </div>
        `).join('');

        resultadosDiv.style.display = 'block';
    }

    _escape(text) {
        if (!text) return '';
        return String(text).replace(/'/g, "\\'").replace(/\n/g, ' ');
    }

    seleccionarEstudiante(id, dni, nombre, apellidoPaterno, apellidoMaterno) {
        const estudianteIdInput = document.getElementById('estudiante_id');
        if (estudianteIdInput) estudianteIdInput.value = id;

        const resultadosDiv = document.getElementById('resultadosEstudiantes');
        if (resultadosDiv) resultadosDiv.style.display = 'none';

        const buscarInput = document.getElementById('buscar_estudiante');
        if (buscarInput) buscarInput.value = '';

        const estudianteInfo = document.getElementById('estudianteSeleccionado');
        if (estudianteInfo) {
            estudianteInfo.style.display = 'block';
            estudianteInfo.innerHTML = `
                <strong>Estudiante seleccionado:</strong>
                <div style="margin-top: 0.5rem;">
                    ${nombre} ${apellidoPaterno} ${apellidoMaterno}
                    <br><small>DNI: ${dni}</small>
                </div>
            `;
        }
    }

    /* ---------- Info ciclo y cálculo de cuotas ---------- */
    mostrarInfoCiclo(cicloId) {
        const infoCiclo = document.getElementById('infoCiclo');
        if (!infoCiclo) return;

        const ciclo = this.ciclos.find(c => String(c.id) === String(cicloId));
        if (!ciclo) {
            infoCiclo.style.display = 'none';
            return;
        }

        infoCiclo.innerHTML = `
            <strong>Información del ciclo:</strong>
            <div style="margin-top: 0.5rem;">
                <strong>${ciclo.nombre}</strong>
                <br>Precio: S/ ${parseFloat(ciclo.precio).toFixed(2)}
                <br>Duración: ${new Date(ciclo.fecha_inicio).toLocaleDateString()} - ${new Date(ciclo.fecha_fin).toLocaleDateString()}
                ${ciclo.descripcion ? `<br>Descripción: ${ciclo.descripcion}` : ''}
            </div>
        `;
        infoCiclo.style.display = 'block';
        this.calcularCuotas();
    }

    calcularCuotas() {
        const cicloSelect = document.getElementById('ciclo_id');
        const descuentoInput = document.getElementById('descuento');
        const numeroCuotasInput = document.getElementById('numero_cuotas');
        const fechaPrimerVencimientoInput = document.getElementById('fecha_primer_vencimiento');
        const cuotasContainer = document.getElementById('cuotasContainer');

        if (!cicloSelect || !numeroCuotasInput || !fechaPrimerVencimientoInput || !cuotasContainer) return;

        const cicloId = cicloSelect.value;
        const descuento = parseFloat(descuentoInput ? descuentoInput.value : 0) || 0;
        const numCuotas = parseInt(numeroCuotasInput.value) || 1;
        const fechaPrimerVencimiento = fechaPrimerVencimientoInput.value;

        if (!cicloId || !fechaPrimerVencimiento) return;

        const ciclo = this.ciclos.find(c => String(c.id) === String(cicloId));
        if (!ciclo) return;

        const precioBase = parseFloat(ciclo.precio);
        const precioConDescuento = precioBase - (precioBase * (descuento / 100));
        const montoCuota = precioConDescuento / numCuotas;

        cuotasContainer.innerHTML = '';
        for (let i = 1; i <= numCuotas; i++) {
            const fechaV = new Date(fechaPrimerVencimiento);
            fechaV.setMonth(fechaV.getMonth() + (i - 1));
            cuotasContainer.innerHTML += `
                <div class="cuota-card">
                    <div class="cuota-numero">Cuota ${i}</div>
                    <div class="cuota-monto">S/ ${montoCuota.toFixed(2)}</div>
                    <div class="cuota-fecha">Vence: ${fechaV.toLocaleDateString()}</div>
                </div>
            `;
        }

        this.mostrarResumenPrecios(precioBase, descuento, precioConDescuento, numCuotas);
    }

    mostrarResumenPrecios(precioBase, descuento, precioFinal, numCuotas) {
        const resumenDiv = document.getElementById('resumenPrecios');
        const detallesDiv = document.getElementById('detallesPrecio');

        if (!resumenDiv || !detallesDiv) return;

        detallesDiv.innerHTML = `
            <div class="price-item"><span>Precio base:</span><span>S/ ${precioBase.toFixed(2)}</span></div>
            ${descuento > 0 ? `<div class="price-item"><span>Descuento (${descuento}%):</span><span>- S/ ${(precioBase * (descuento / 100)).toFixed(2)}</span></div>` : ''}
            <div class="price-item price-total"><span>Total a pagar:</span><span>S/ ${precioFinal.toFixed(2)}</span></div>
            <div class="price-item"><span>Número de cuotas:</span><span>${numCuotas}</span></div>
            <div class="price-item"><span>Monto por cuota:</span><span>S/ ${(precioFinal / numCuotas).toFixed(2)}</span></div>
        `;

        resumenDiv.style.display = 'block';
    }

    /* ---------- Guardar matrícula ---------- */
    async saveMatricula() {
        try {
            const token = localStorage.getItem('token');
            const estudianteId = document.getElementById('estudiante_id') ? document.getElementById('estudiante_id').value : '';
            const cicloId = document.getElementById('ciclo_id') ? document.getElementById('ciclo_id').value : '';
            const numeroBoleta = document.getElementById('numero_boleta') ? document.getElementById('numero_boleta').value : '';
            const metodoPago = document.getElementById('metodo_pago') ? document.getElementById('metodo_pago').value : '';
            const descuento = parseFloat(document.getElementById('descuento') ? document.getElementById('descuento').value : 0) || 0;
            const aula = document.getElementById('aula') ? document.getElementById('aula').value : '';
            const numCuotas = parseInt(document.getElementById('numero_cuotas') ? document.getElementById('numero_cuotas').value : 1) || 1;
            const fechaPrimerVencimiento = document.getElementById('fecha_primer_vencimiento') ? document.getElementById('fecha_primer_vencimiento').value : '';

            if (!estudianteId) return this.showMessage('Debe seleccionar un estudiante', 'error');
            if (!cicloId) return this.showMessage('Debe seleccionar un ciclo académico', 'error');
            if (!fechaPrimerVencimiento) return this.showMessage('Debe especificar la fecha del primer vencimiento', 'error');

            // 🔹 CORRECCIÓN: Verificación más precisa de matrícula existente
            try {
                const checkResp = await fetch(`/api/matriculas/verificar?estudiante_id=${encodeURIComponent(estudianteId)}&ciclo_id=${encodeURIComponent(cicloId)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (checkResp && checkResp.ok) {
                    const checkData = await checkResp.json();
                    
                    // Solo bloquear si existe una matrícula ACTIVA para el mismo ciclo
                    if (checkData.existe && checkData.activa) {
                        localStorage.setItem(`matriculado_${estudianteId}`, 'true');
                        return this.showMessage('Este estudiante ya tiene una matrícula ACTIVA para este ciclo académico.', 'error');
                    }
                    
                    // Permitir matricular si existe pero está inactiva/completada
                    if (checkData.existe && !checkData.activa) {
                        console.log('Matrícula existente pero inactiva, permitiendo nueva matrícula');
                    }
                }
            } catch (err) {
                console.warn('No se pudo comprobar existencia previa de matrícula:', err);
                // Si hay error en la verificación, permitir continuar
            }

            const ciclo = this.ciclos.find(c => String(c.id) === String(cicloId));
            if (!ciclo) return this.showMessage('Ciclo inválido', 'error');

            const precioBase = parseFloat(ciclo.precio);
            const precioFinal = precioBase - (precioBase * (descuento / 100));
            const montoCuota = precioFinal / numCuotas;

            const cuotas = [];
            for (let i = 1; i <= numCuotas; i++) {
                const fechaV = new Date(fechaPrimerVencimiento);
                fechaV.setMonth(fechaV.getMonth() + (i - 1));
                cuotas.push({
                    numero: i,
                    monto: montoCuota,
                    fecha_vencimiento: fechaV.toISOString().split('T')[0]
                });
            }

            const matriculaData = {
                estudiante_id: estudianteId,
                ciclo_id: cicloId,
                numero_boleta: numeroBoleta,
                metodo_pago: metodoPago,
                descuento,
                aula,
                cuotas
            };

            console.log('Enviando datos de matrícula:', matriculaData);

            const response = await fetch('/api/matriculas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(matriculaData)
            });

            const data = await response.json();
            
            // 🔴 CORRECCIÓN PRINCIPAL: Manejo correcto de errores del backend
            if (response.ok) {
                // Éxito - matrícula creada
                localStorage.setItem(`matriculado_${estudianteId}`, 'true');

                if (typeof Swal !== 'undefined') {
                    Swal.fire({ 
                        icon: 'success', 
                        title: '¡Matrícula Exitosa!',
                        text: data.message || 'Matrícula registrada correctamente',
                        confirmButtonText: 'Aceptar'
                    });
                } else {
                    this.showMessage(data.message || 'Matrícula registrada correctamente', 'success');
                }

                this.closeMatriculaModal();
                this.loadMatriculas();

                // intentar refrescar lista de estudiantes si la página está abierta
                try {
                    if (window.opener && window.opener.estudiantesManager && typeof window.opener.estudiantesManager.loadStudents === 'function') {
                        window.opener.estudiantesManager.loadStudents();
                    }
                } catch (e) { /* ignore cross-origin */ }
            } else {
                // 🔴 CORRECCIÓN: Mostrar el mensaje específico del backend
                const errorMessage = data.error || data.message || 'Error al guardar la matrícula';
                console.error('Error del servidor:', data);
                
                if (typeof Swal !== 'undefined') {
                    Swal.fire({ 
                        icon: 'error', 
                        title: 'Error en Matrícula',
                        text: errorMessage,
                        confirmButtonText: 'Entendido'
                    });
                } else {
                    this.showMessage(errorMessage, 'error');
                }
            }
        } catch (error) {
            console.error('Error de conexión:', error);
            
            // 🔴 CORRECCIÓN: Mensaje más amigable para errores de red
            const errorMessage = 'Error de conexión. Verifique su internet e intente nuevamente.';
            
            if (typeof Swal !== 'undefined') {
                Swal.fire({ 
                    icon: 'error', 
                    title: 'Error de Conexión',
                    text: errorMessage,
                    confirmButtonText: 'Reintentar'
                });
            } else {
                this.showMessage(errorMessage, 'error');
            }
        }
    }

    async generarBoleta() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/matriculas/generar/boleta', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) return;
            const data = await response.json();
            const numeroBoleta = document.getElementById('numero_boleta');
            if (numeroBoleta) numeroBoleta.value = data.numero_boleta || '';
        } catch (error) {
            console.error('Error generando boleta:', error);
        }
    }

    /* ---------- Modal: abrir / cerrar ---------- */
    showAddMatriculaModal(prefill = {}) {
        const modal = document.getElementById('matriculaModal');
        if (!modal) {
            console.warn('No existe #matriculaModal en el DOM');
            return;
        }

        const form = document.getElementById('matriculaForm');
        if (form) form.reset();

        const estudianteSeleccionado = document.getElementById('estudianteSeleccionado');
        if (estudianteSeleccionado) estudianteSeleccionado.style.display = 'none';

        const infoCiclo = document.getElementById('infoCiclo');
        if (infoCiclo) infoCiclo.style.display = 'none';

        const resumen = document.getElementById('resumenPrecios');
        if (resumen) resumen.style.display = 'none';

        const cuotasContainer = document.getElementById('cuotasContainer');
        if (cuotasContainer) cuotasContainer.innerHTML = '';

        const fechaPrimer = document.getElementById('fecha_primer_vencimiento');
        if (fechaPrimer && !fechaPrimer.value) {
            const fechaDefault = new Date();
            fechaDefault.setDate(fechaDefault.getDate() + 30);
            fechaPrimer.value = fechaDefault.toISOString().split('T')[0];
        }

        // Limpiar localStorage de verificación previa
        if (prefill.estudiante) {
            localStorage.removeItem(`matriculado_${prefill.estudiante.id}`);
        }

        // prefill estudiante
        if (prefill.estudiante) {
            const estudianteIdInput = document.getElementById('estudiante_id');
            if (estudianteIdInput) estudianteIdInput.value = prefill.estudiante.id || '';
            const estudianteInfo = document.getElementById('estudianteSeleccionado');
            if (estudianteInfo) {
                estudianteInfo.style.display = 'block';
                estudianteInfo.innerHTML = `
                    <p><strong>Nombre:</strong> ${prefill.estudiante.nombre} ${prefill.estudiante.apellido_paterno || ''} ${prefill.estudiante.apellido_materno || ''}</p>
                    <p><strong>DNI:</strong> ${prefill.estudiante.dni || ''}</p>
                    <p><strong>Tipo:</strong> ${prefill.estudiante.tipo_alumno || ''}</p>
                    <p><strong>Teléfono:</strong> ${prefill.estudiante.telefono || ''}</p>
                    <p><strong>Email:</strong> ${prefill.estudiante.email || ''}</p>
                `;
            }
        }

        // prefill matricula existente (si viene)
        if (prefill.matricula) {
            const m = prefill.matricula;
            const numeroBoleta = document.getElementById('numero_boleta');
            if (numeroBoleta) numeroBoleta.value = m.numero_boleta || '';
            const metodoPago = document.getElementById('metodo_pago');
            if (metodoPago) metodoPago.value = m.metodo_pago || '';
            const descuento = document.getElementById('descuento');
            if (descuento) descuento.value = m.descuento ?? 0;
            const aula = document.getElementById('aula');
            if (aula) aula.value = m.aula || '';
            const cicloSelect = document.getElementById('ciclo_id');
            if (cicloSelect && m.ciclo_id) cicloSelect.value = m.ciclo_id;

            this.mostrarInfoCiclo(m.ciclo_id || (cicloSelect ? cicloSelect.value : ''));
            if (Array.isArray(m.cuotas) && m.cuotas.length > 0) {
                const cuotasContainer = document.getElementById('cuotasContainer');
                if (cuotasContainer) {
                    cuotasContainer.innerHTML = '';
                    m.cuotas.forEach(q => {
                        cuotasContainer.innerHTML += `
                            <div class="cuota-card">
                                <div class="cuota-numero">Cuota ${q.numero}</div>
                                <div class="cuota-monto">S/ ${parseFloat(q.monto).toFixed(2)}</div>
                                <div class="cuota-fecha">Vence: ${new Date(q.fecha_vencimiento).toLocaleDateString()}</div>
                            </div>
                        `;
                    });
                }
            }

            if (typeof Swal !== 'undefined') {
                Swal.fire({ 
                    icon: 'info', 
                    title: 'Matrícula Existente',
                    text: 'Este estudiante ya tiene una matrícula registrada. Puede ver los detalles o crear una nueva si es necesario.',
                    confirmButtonText: 'Entendido'
                });
            }
        }

        modal.style.display = 'block';
    }

    closeMatriculaModal() {
        const modal = document.getElementById('matriculaModal');
        if (modal) modal.style.display = 'none';
        
        // Limpiar cualquier verificación previa al cerrar el modal
        const estudianteId = document.getElementById('estudiante_id');
        if (estudianteId && estudianteId.value) {
            localStorage.removeItem(`matriculado_${estudianteId.value}`);
        }
    }

    showMessage(message, type = 'info') {
        // Si tenemos SweetAlert2, usarlo para mejores mensajes
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
        const messageDiv = document.createElement('div');
        messageDiv.className = `global-message message-${type}`;
        messageDiv.innerHTML = `
            <strong>${type === 'error' ? '❌ Error:' : type === 'success' ? '✅ Éxito:' : 'ℹ️ Info:'}</strong>
            ${message}
        `;
        messageDiv.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            font-weight: 500;
            z-index: 10000;
            background: ${type === 'error' ? '#fee' : type === 'success' ? '#efe' : '#eef'};
            color: ${type === 'error' ? '#c33' : type === 'success' ? '#363' : '#336'};
            border: 2px solid ${type === 'error' ? '#fcc' : type === 'success' ? '#cfc' : '#ccf'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            max-width: 400px;
            font-size: 14px;
        `;

        document.body.appendChild(messageDiv);

        setTimeout(() => {
            if (messageDiv.parentNode) messageDiv.remove();
        }, 6000);
    }

    redirectToLogin() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    }

    /* ========== FUNCIONES PARA VER MATRÍCULA Y GESTIONAR PAGOS ========== */

    crearModalMatriculas() {
        if (document.getElementById('modalMatriculas')) return;

        const modalHTML = `
            <div id="modalMatriculas" class="modal" style="
                display:none; position:fixed; top:0; left:0; width:100%; height:100%;
                background:rgba(0,0,0,0.6); z-index:2000; justify-content:center; align-items:center;">
                <div class="modal-content" style="
                    background:var(--card-bg, #fff); color:var(--text-color, #333);
                    padding:20px; border-radius:10px; width:90%; max-width:600px; position:relative;
                    box-shadow:0 0 20px rgba(0,0,0,0.2); max-height:85%; overflow-y:auto;">
                    
                    <button id="cerrarModalMatriculas" style="
                        position:absolute; top:10px; right:15px; font-size:20px; border:none; background:none; cursor:pointer;">✖</button>
                    
                    <h2 id="tituloModalMatriculas" style="margin-bottom:10px;">Detalles</h2>
                    <div id="contenidoModalMatriculas">Cargando...</div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        document.getElementById('cerrarModalMatriculas').onclick = () => this.cerrarModalMatriculas();
        document.getElementById('modalMatriculas').onclick = (e) => {
            if (e.target.id === 'modalMatriculas') this.cerrarModalMatriculas();
        };
    }

    abrirModalMatriculas(titulo, htmlContenido) {
        this.crearModalMatriculas();

        document.getElementById('tituloModalMatriculas').innerText = titulo;
        document.getElementById('contenidoModalMatriculas').innerHTML = htmlContenido;
        document.getElementById('modalMatriculas').style.display = 'flex';
    }

    cerrarModalMatriculas() {
        const modal = document.getElementById('modalMatriculas');
        if (modal) modal.style.display = 'none';
    }

    async verMatricula(idMatricula) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/matriculas/${idMatricula}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('No se pudo obtener la matrícula.');

            const data = await response.json();
            const m = data.matricula || data;

            const html = `
                <div style="margin-bottom: 20px;">
                    <h3 style="color: var(--primary-color); margin-bottom: 15px;">Información de la Matrícula</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div><strong>N° Boleta:</strong> ${m.numero_boleta || '—'}</div>
                        <div><strong>Estado:</strong> <span class="status-badge status-${m.estado || 'inactivo'}">${this.getEstadoName(m.estado)}</span></div>
                        <div><strong>Fecha Matrícula:</strong> ${m.fecha_matricula ? new Date(m.fecha_matricula).toLocaleDateString() : '—'}</div>
                        <div><strong>Método Pago:</strong> ${this.getMetodoPagoName(m.metodo_pago)}</div>
                        <div><strong>Descuento:</strong> ${m.descuento || 0}%</div>
                        <div><strong>Aula:</strong> ${m.aula || '—'}</div>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <h3 style="color: var(--primary-color); margin-bottom: 15px;">Información del Estudiante</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div><strong>Nombre:</strong> ${m.estudiante_nombre || '—'} ${m.estudiante_apellido_paterno || ''} ${m.estudiante_apellido_materno || ''}</div>
                        <div><strong>DNI:</strong> ${m.estudiante_dni || '—'}</div>
                        <div><strong>Email:</strong> ${m.estudiante_email || '—'}</div>
                        <div><strong>Teléfono:</strong> ${m.estudiante_telefono || '—'}</div>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <h3 style="color: var(--primary-color); margin-bottom: 15px;">Información del Ciclo</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div><strong>Ciclo:</strong> ${m.ciclo_nombre || '—'}</div>
                        <div><strong>Precio:</strong> S/ ${m.ciclo_precio ? parseFloat(m.ciclo_precio).toFixed(2) : '0.00'}</div>
                        <div><strong>Fecha Inicio:</strong> ${m.ciclo_fecha_inicio ? new Date(m.ciclo_fecha_inicio).toLocaleDateString() : '—'}</div>
                        <div><strong>Fecha Fin:</strong> ${m.ciclo_fecha_fin ? new Date(m.ciclo_fecha_fin).toLocaleDateString() : '—'}</div>
                    </div>
                </div>

                ${m.cuotas && m.cuotas.length > 0 ? `
                <div>
                    <h3 style="color: var(--primary-color); margin-bottom: 15px;">Cuotas Programadas</h3>
                    <div style="max-height: 200px; overflow-y: auto;">
                        ${m.cuotas.map(cuota => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid var(--border-color);">
                                <div>
                                    <strong>Cuota ${cuota.numero}</strong>
                                    <br><small>Vence: ${new Date(cuota.fecha_vencimiento).toLocaleDateString()}</small>
                                </div>
                                <div style="text-align: right;">
                                    <strong>S/ ${parseFloat(cuota.monto).toFixed(2)}</strong>
                                    <br><small class="status-badge status-${cuota.estado || 'pendiente'}">${cuota.estado || 'Pendiente'}</small>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            `;

            this.abrirModalMatriculas('📘 Detalles de Matrícula', html);
        } catch (error) {
            console.error('❌ Error al cargar matrícula:', error);
            this.abrirModalMatriculas('Error', '<p>No se pudo cargar los detalles de la matrícula.</p>');
        }
    }

    async gestionarPagos(idMatricula) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/matriculas/${idMatricula}/pagos`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('No se pudo obtener los pagos.');

            const data = await response.json();
            const pagos = data.pagos || [];
            const matricula = data.matricula || {};

            let pagosHTML = '';
            if (pagos.length > 0) {
                pagosHTML = `
                    <div style="max-height: 300px; overflow-y: auto; margin-bottom: 20px;">
                        <h4 style="color: var(--primary-color); margin-bottom: 10px;">Historial de Pagos</h4>
                        ${pagos.map(pago => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--border-color); background: var(--card-bg); margin-bottom: 5px; border-radius: 5px;">
                                <div>
                                    <strong>Pago #${pago.id}</strong>
                                    <br><small>Fecha: ${new Date(pago.fecha_pago).toLocaleDateString()}</small>
                                    ${pago.numero_cuota ? `<br><small>Cuota: ${pago.numero_cuota}</small>` : ''}
                                </div>
                                <div style="text-align: right;">
                                    <strong>S/ ${parseFloat(pago.monto).toFixed(2)}</strong>
                                    <br><small class="status-badge status-${pago.estado || 'completado'}">${pago.estado || 'Completado'}</small>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                pagosHTML = '<p>No se encontraron pagos registrados para esta matrícula.</p>';
            }

            const html = `
                <div style="margin-bottom: 20px;">
                    <h3 style="color: var(--primary-color); margin-bottom: 15px;">Gestión de Pagos</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                        <div><strong>Matrícula:</strong> ${matricula.numero_boleta || '—'}</div>
                        <div><strong>Estudiante:</strong> ${matricula.estudiante_nombre || '—'} ${matricula.estudiante_apellido_paterno || ''}</div>
                        <div><strong>Total:</strong> S/ ${matricula.ciclo_precio ? parseFloat(matricula.ciclo_precio).toFixed(2) : '0.00'}</div>
                        <div><strong>Descuento:</strong> ${matricula.descuento || 0}%</div>
                    </div>
                </div>

                ${pagosHTML}

                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid var(--border-color);">
                    <h4 style="color: var(--primary-color); margin-bottom: 10px;">Registrar Nuevo Pago</h4>
                    <form id="formNuevoPago" onsubmit="registrarNuevoPago(${idMatricula}); return false;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                            <div>
                                <label style="display: block; margin-bottom: 5px; font-weight: 500;">Monto:</label>
                                <input type="number" step="0.01" id="montoPago" required 
                                       style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px;">
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 5px; font-weight: 500;">Fecha:</label>
                                <input type="date" id="fechaPago" required 
                                       value="${new Date().toISOString().split('T')[0]}"
                                       style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px;">
                            </div>
                        </div>
                        <div style="margin-bottom: 10px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 500;">Método de Pago:</label>
                            <select id="metodoPago" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px;">
                                <option value="efectivo">Efectivo</option>
                                <option value="tarjeta">Tarjeta</option>
                                <option value="transferencia">Transferencia</option>
                                <option value="deposito">Depósito</option>
                            </select>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 500;">Observaciones:</label>
                            <textarea id="observacionesPago" rows="3" 
                                      style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px;"></textarea>
                        </div>
                        <button type="submit" style="background: var(--success-color); color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">
                            Registrar Pago
                        </button>
                    </form>
                </div>
            `;

            this.abrirModalMatriculas('💰 Gestión de Pagos', html);
        } catch (error) {
            console.error('❌ Error al cargar pagos:', error);
            this.abrirModalMatriculas('Error', '<p>No se pudo cargar la información de pagos.</p>');
        }
    }
}

/* ========== FUNCIONES GLOBALES ========== */

let matriculasManager;

function goToDashboard() {
    window.location.href = '/superadmin/dashboard.html';
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

function searchMatriculas() {
    if (matriculasManager) matriculasManager.searchMatriculas();
}

function changePage(page) {
    if (!matriculasManager) return;
    matriculasManager.currentPage = page;
    matriculasManager.loadMatriculas();
}

function showAddMatriculaModal() {
    if (matriculasManager) matriculasManager.showAddMatriculaModal();
    else {
        const btn = document.querySelector('.btn-add, .btn-nueva-matricula, #btnNuevaMatricula');
        if (btn) btn.click();
    }
}

function closeMatriculaModal() {
    if (matriculasManager) matriculasManager.closeMatriculaModal();
}

function seleccionarEstudiante(id, dni, nombre, apellidoPaterno, apellidoMaterno) {
    if (matriculasManager) matriculasManager.seleccionarEstudiante(id, dni, nombre, apellidoPaterno, apellidoMaterno);
}

function generarBoleta() {
    if (matriculasManager) matriculasManager.generarBoleta();
}

function calcularCuotas() {
    if (matriculasManager) matriculasManager.calcularCuotas();
}

function verMatricula(matriculaId) {
    if (matriculasManager) {
        matriculasManager.verMatricula(matriculaId);
    }
}

function gestionarPagos(matriculaId) {
    if (matriculasManager) {
        matriculasManager.gestionarPagos(matriculaId);
    }
}

async function registrarNuevoPago(matriculaId) {
    try {
        const monto = parseFloat(document.getElementById('montoPago').value);
        const fecha = document.getElementById('fechaPago').value;
        const metodo = document.getElementById('metodoPago').value;
        const observaciones = document.getElementById('observacionesPago').value;

        if (!monto || monto <= 0) {
            alert('El monto debe ser mayor a 0');
            return;
        }

        const token = localStorage.getItem('token');
        const response = await fetch(`/api/matriculas/${matriculaId}/pagos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                monto,
                fecha_pago: fecha,
                metodo_pago: metodo,
                observaciones
            })
        });

        if (response.ok) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'success', text: 'Pago registrado correctamente' });
            } else {
                alert('Pago registrado correctamente');
            }
            
            if (matriculasManager) {
                matriculasManager.gestionarPagos(matriculaId);
            }
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Error registrando pago');
        }
    } catch (error) {
        console.error('Error registrando pago:', error);
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'error', text: error.message });
        } else {
            alert('Error: ' + error.message);
        }
    }
}

/* ---------- Inicializar manager ---------- */
document.addEventListener('DOMContentLoaded', async () => {
    matriculasManager = new MatriculasManagement();

    const selectedStudentId = localStorage.getItem('selectedStudentId');
    const openNuevaMatricula = localStorage.getItem('openNuevaMatricula');

    if (selectedStudentId && openNuevaMatricula === 'true') {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/estudiantes/${selectedStudentId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('No se pudo cargar el estudiante desde API');

            const data = await response.json();
            const e = data.estudiante;

            const estudianteInfo = document.getElementById('estudianteSeleccionado');
            const estudianteIdField = document.getElementById('estudiante_id');

            if (estudianteIdField) estudianteIdField.value = e.id;

            if (estudianteInfo) {
                estudianteInfo.style.display = 'block';
                estudianteInfo.innerHTML = `
                    <p><strong>Nombre:</strong> ${e.nombre} ${e.apellido_paterno} ${e.apellido_materno || ''}</p>
                    <p><strong>DNI:</strong> ${e.dni || ''}</p>
                    <p><strong>Tipo:</strong> ${e.tipo_alumno || ''}</p>
                    <p><strong>Teléfono:</strong> ${e.telefono || ''}</p>
                    <p><strong>Email:</strong> ${e.email || ''}</p>
                `;
            }

            let matriculaExistente = null;
            try {
                const respMat = await fetch(`/api/matriculas/verificar?estudiante_id=${encodeURIComponent(e.id)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (respMat && respMat.ok) {
                    const dm = await respMat.json();
                    if (dm.existe && dm.matricula) {
                        matriculaExistente = dm.matricula;
                    }
                }
            } catch (err) {
                console.warn('No se pudo comprobar matrícula existente:', err);
            }

            const intentarAbrir = () => {
                if (matriculasManager && typeof matriculasManager.showAddMatriculaModal === 'function') {
                    const prefill = { estudiante: e };
                    if (matriculaExistente) prefill.matricula = matriculaExistente;
                    matriculasManager.showAddMatriculaModal(prefill);

                    localStorage.removeItem('selectedStudentId');
                    localStorage.removeItem('openNuevaMatricula');
                } else {
                    setTimeout(intentarAbrir, 150);
                }
            };
            intentarAbrir();

        } catch (error) {
            console.error('❌ Error cargando estudiante desde Estudiantes:', error);
        }
    }
});

/* Exponer funciones globalmente */
window.goToDashboard = goToDashboard;
window.logout = logout;
window.searchMatriculas = searchMatriculas;
window.changePage = changePage;
window.showAddMatriculaModal = showAddMatriculaModal;
window.closeMatriculaModal = closeMatriculaModal;
window.seleccionarEstudiante = seleccionarEstudiante;
window.generarBoleta = generarBoleta;
window.calcularCuotas = calcularCuotas;
window.verMatricula = verMatricula;
window.gestionarPagos = gestionarPagos;
window.registrarNuevoPago = registrarNuevoPago;