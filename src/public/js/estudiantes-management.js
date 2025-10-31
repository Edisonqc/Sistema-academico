class EstudiantesManagement {
    constructor() {
        this.currentPage = 1;
        this.limit = 10;
        this.search = '';
        this.init();
    }

    async init() {
        await this.checkAuthentication();
        this.loadUserInfo();
        this.loadStudents();
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
            document.getElementById('userName').textContent = `${user.nombre} ${user.apellido_paterno}`;
            document.getElementById('userRole').textContent = user.rol;
        }
    }

    async loadStudents() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `/api/estudiantes?page=${this.currentPage}&limit=${this.limit}&search=${this.search}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (!response.ok) throw new Error('Error cargando estudiantes');
            const data = await response.json();

            this.renderStudents(data.estudiantes);
            this.renderPagination(data.pagination);
        } catch (error) {
            console.error('Error:', error);
            this.showMessage('Error cargando estudiantes', 'error');
        }
    }

    renderStudents(estudiantes) {
        const tbody = document.getElementById('studentsTableBody');
        if (estudiantes.length === 0) {
            tbody.innerHTML = '<div class="loading">No se encontraron estudiantes</div>';
            return;
        }

        tbody.innerHTML = estudiantes.map(estudiante => `
            <div class="table-row">
                <div>${estudiante.id}</div>
                <div>${estudiante.dni}</div>
                <div>
                    <strong>${estudiante.nombre} ${estudiante.apellido_paterno} ${estudiante.apellido_materno || ''}</strong>
                    ${estudiante.fecha_nacimiento ? `<br><small>Nac: ${new Date(estudiante.fecha_nacimiento).toLocaleDateString()}</small>` : ''}
                </div>
                <div>
                    ${estudiante.email || 'N/A'}<br>
                    <small>${estudiante.telefono || 'N/A'}</small>
                </div>
                <div>
                    ${estudiante.direccion ? estudiante.direccion.substring(0, 30) + (estudiante.direccion.length > 30 ? '...' : '') : 'N/A'}
                </div>
                <div>
                    <span class="type-badge type-${estudiante.tipo_alumno}">
                        ${this.getTipoAlumnoName(estudiante.tipo_alumno)}
                    </span>
                </div>
                <div>
                    <span class="status-badge ${estudiante.activo ? 'status-active' : 'status-inactive'}">
                        ${estudiante.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </div>
                <div class="action-buttons">
                    <button class="btn-action btn-edit" onclick="editStudent(${estudiante.id})">Editar</button>
                    <button class="btn-action btn-view" onclick="viewStudent(${estudiante.id})">Ver</button>
                    <button class="btn-action btn-matricula" onclick="goToMatricula(${estudiante.id})">
                        Matricular
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderPagination(pagination) {
        const paginationDiv = document.getElementById('pagination');
        const { page, pages, total } = pagination;

        paginationDiv.innerHTML = `
            <button ${page === 1 ? 'disabled' : ''} onclick="changePage(${page - 1})">Anterior</button>
            <span>Página ${page} de ${pages} (${total} estudiantes)</span>
            <button ${page === pages ? 'disabled' : ''} onclick="changePage(${page + 1})">Siguiente</button>
        `;
    }

    getTipoAlumnoName(tipo) {
        const tipos = { full: 'Full', escolar: 'Escolar', otro: 'Otro' };
        return tipos[tipo] || tipo;
    }

    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('keypress', e => {
                if (e.key === 'Enter') this.searchStudents();
            });
        }

        const studentForm = document.getElementById('studentForm');
        if (studentForm) {
            studentForm.addEventListener('submit', e => {
                e.preventDefault();
                this.saveStudent();
            });
        }
    }

    searchStudents() {
        this.search = document.getElementById('searchInput').value;
        this.currentPage = 1;
        this.loadStudents();
    }

    async saveStudent() {
        try {
            const token = localStorage.getItem('token');
            const studentId = document.getElementById('studentId').value;

            const datosApoderado = {};
            const apoderadoNombre = document.getElementById('apoderado_nombre').value;
            const apoderadoTelefono = document.getElementById('apoderado_telefono').value;
            const apoderadoParentesco = document.getElementById('apoderado_parentesco').value;

            if (apoderadoNombre || apoderadoTelefono || apoderadoParentesco) {
                datosApoderado.nombre = apoderadoNombre;
                datosApoderado.telefono = apoderadoTelefono;
                datosApoderado.parentesco = apoderadoParentesco;
            }

            const studentData = {
                dni: document.getElementById('dni').value,
                nombre: document.getElementById('nombre').value,
                apellido_paterno: document.getElementById('apellido_paterno').value,
                apellido_materno: document.getElementById('apellido_materno').value,
                email: document.getElementById('email').value,
                telefono: document.getElementById('telefono').value,
                direccion: document.getElementById('direccion').value,
                sexo: document.getElementById('sexo').value,
                fecha_nacimiento: document.getElementById('fecha_nacimiento').value,
                tipo_alumno: document.getElementById('tipo_alumno').value,
                datos_apoderado: Object.keys(datosApoderado).length > 0 ? datosApoderado : null
            };

            const url = studentId ? `/api/estudiantes/${studentId}` : '/api/estudiantes';
            const method = studentId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(studentData)
            });

            const data = await response.json();

            if (response.ok) {
                this.showMessage(data.message || 'Estudiante guardado correctamente', 'success');
                this.closeStudentModal();
                this.loadStudents();
            } else {
                this.showMessage(data.error || 'Error al guardar', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showMessage('Error guardando estudiante', 'error');
        }
    }

    showAddStudentModal() {
        document.getElementById('modalTitle').textContent = 'Registrar Estudiante';
        document.getElementById('studentForm').reset();
        document.getElementById('studentId').value = '';
        this.showTab('datos-personales');
        document.getElementById('studentModal').style.display = 'block';
    }

    closeStudentModal() {
        document.getElementById('studentModal').style.display = 'none';
    }

    showTab(tabName) {
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.querySelector(`.tab[onclick="showTab('${tabName}')"]`).classList.add('active');
        document.getElementById(tabName).classList.add('active');
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

// 🌟 FUNCIONES GLOBALES
let estudiantesManager;

function goToDashboard() {
    window.location.href = '/superadmin/dashboard.html';
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

function searchStudents() {
    estudiantesManager.searchStudents();
}

function changePage(page) {
    estudiantesManager.currentPage = page;
    estudiantesManager.loadStudents();
}

function showAddStudentModal() {
    estudiantesManager.showAddStudentModal();
}

function closeStudentModal() {
    estudiantesManager.closeStudentModal();
}

function showTab(tabName) {
    estudiantesManager.showTab(tabName);
}

// ✅ Editar estudiante
async function editStudent(studentId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/estudiantes/${studentId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Error al cargar datos');

        const data = await response.json();
        const e = data.estudiante;

        document.getElementById('modalTitle').textContent = 'Editar Estudiante';
        document.getElementById('studentId').value = e.id;
        document.getElementById('dni').value = e.dni || '';
        document.getElementById('nombre').value = e.nombre || '';
        document.getElementById('apellido_paterno').value = e.apellido_paterno || '';
        document.getElementById('apellido_materno').value = e.apellido_materno || '';
        document.getElementById('email').value = e.email || '';
        document.getElementById('telefono').value = e.telefono || '';
        document.getElementById('direccion').value = e.direccion || '';
        document.getElementById('sexo').value = e.sexo || '';
        document.getElementById('fecha_nacimiento').value = e.fecha_nacimiento ? e.fecha_nacimiento.split('T')[0] : '';
        document.getElementById('tipo_alumno').value = e.tipo_alumno || '';

        let datosAp = {};
        if (e.datos_apoderado) {
            try {
                datosAp = typeof e.datos_apoderado === 'string' ? JSON.parse(e.datos_apoderado) : e.datos_apoderado;
            } catch {
                datosAp = {};
            }
        }

        document.getElementById('apoderado_nombre').value = datosAp.nombre || '';
        document.getElementById('apoderado_telefono').value = datosAp.telefono || '';
        document.getElementById('apoderado_parentesco').value = datosAp.parentesco || '';

        estudiantesManager.showTab('datos-personales');
        document.getElementById('studentModal').style.display = 'block';
    } catch (error) {
        console.error('Error al editar:', error);
        estudiantesManager.showMessage('Error al cargar datos del estudiante', 'error');
    }
}

// 🔵 Ver estudiante
async function viewStudent(studentId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/estudiantes/${studentId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Error cargando estudiante');
        const data = await response.json();
        const e = data.estudiante;

        let apoderado = e.datos_apoderado ? `
            <li><strong>Nombre:</strong> ${e.datos_apoderado.nombre}</li>
            <li><strong>Teléfono:</strong> ${e.datos_apoderado.telefono}</li>
            <li><strong>Parentesco:</strong> ${e.datos_apoderado.parentesco}</li>
        ` : '<li>No hay datos de apoderado</li>';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-view">
                <h2>👤 Datos del Estudiante</h2>
                <ul>
                    <li><strong>DNI:</strong> ${e.dni}</li>
                    <li><strong>Nombre:</strong> ${e.nombre} ${e.apellido_paterno} ${e.apellido_materno || ''}</li>
                    <li><strong>Email:</strong> ${e.email || 'N/A'}</li>
                    <li><strong>Teléfono:</strong> ${e.telefono || 'N/A'}</li>
                    <li><strong>Dirección:</strong> ${e.direccion || 'N/A'}</li>
                    <li><strong>Sexo:</strong> ${e.sexo || 'N/A'}</li>
                    <li><strong>Tipo Alumno:</strong> ${e.tipo_alumno || 'N/A'}</li>
                </ul>
                <h3>👨‍👩‍👧 Apoderado</h3>
                <ul>${apoderado}</ul>
                <button onclick="this.parentElement.parentElement.remove()">Cerrar</button>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        console.error(error);
        estudiantesManager.showMessage('Error cargando datos del estudiante', 'error');
    }
}

// 🟩 Matricular → Redirigir a página de matrículas
function goToMatricula(studentId) {
    localStorage.setItem('selectedStudentId', studentId);
    localStorage.setItem('openNuevaMatricula', 'true');
    window.location.href = '/superadmin/matriculas.html';
}

document.addEventListener('DOMContentLoaded', () => {
    estudiantesManager = new EstudiantesManagement();
});

// 🌍 Exponer funciones globales
window.editStudent = editStudent;
window.viewStudent = viewStudent;
window.goToMatricula = goToMatricula;
window.searchStudents = searchStudents;
window.changePage = changePage;
window.showAddStudentModal = showAddStudentModal;
window.closeStudentModal = closeStudentModal;
window.showTab = showTab;
window.logout = logout;
