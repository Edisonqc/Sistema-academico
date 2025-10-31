// DASHBOARD MEJORADO - CON MANEJO MEJOR DE ERRORES
console.log('🎯 Dashboard mejorado cargado');

class DashboardManager {
    constructor() {
        this.userRole = '';
        this.isLoading = false;
        this.init();
    }

    async init() {
        console.log('🚀 Inicializando dashboard mejorado...');
        this.loadUserInfo();
        this.adaptInterfaceForRole();
        this.setupEventListeners();
        await this.loadStatistics();
        console.log('✅ Dashboard inicializado correctamente');
    }

    loadUserInfo() {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user && user.nombre) {
                this.userRole = user.rol || '';
                document.getElementById('userName').textContent = 
                    `${user.nombre} ${user.apellido_paterno}`;
                document.getElementById('userRole').textContent = user.rol;
                
                console.log('✅ Usuario autenticado:', this.userRole);
            } else {
                this.redirectToLogin();
            }
        } catch (error) {
            console.error('❌ Error cargando información de usuario:', error);
            this.redirectToLogin();
        }
    }

    adaptInterfaceForRole() {
    console.log('🎭 Adaptando interfaz para rol:', this.userRole);
    
    // ⭐⭐ ELIMINAR ESTO - MOSTRAR TODO A TODOS
    // if (this.userRole !== 'superadmin') {
    //     this.hideElement('cardUsers');
    //     this.hideElement('cardAdmins');
    //     this.hideElement('cardSecretarias');
    //     console.log('👤 Elementos ocultos para rol:', this.userRole);
    // }
    
    console.log('✅ Interfaz completa para todos los roles');
}

    hideElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = 'none';
        }
    }

    setupEventListeners() {
        console.log('✅ Event listeners configurados');
        
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadStatistics());
        }
    }

    async loadStatistics() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoadingState();
        
        try {
            console.log('📊 Cargando estadísticas...');
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('No hay token disponible');
            }

            // Intentar cargar datos reales
            await this.tryLoadRealData(token);
            
        } catch (error) {
            console.error('❌ Error cargando estadísticas:', error);
            this.showError();
            await this.loadExampleData();
        } finally {
            this.isLoading = false;
            this.hideLoadingState();
        }
    }

    async tryLoadRealData(token) {
    // ⭐⭐ USAR SIEMPRE LA RUTA CON DATOS COMPLETOS
    const routesToTry = [
        '/api/dashboard/estadisticas',  // ⭐ Ruta PRINCIPAL con datos completos
        '/api/reportes/dashboard',      // ⭐ Ruta alternativa
        '/api/emergencia/dashboard-stats'
    ];

    for (const route of routesToTry) {
        try {
            console.log(`🔍 Intentando ruta: ${route}`);
            const response = await fetch(route, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Datos cargados de:', route);
                this.processData(data);
                this.hideError();
                return;
            }
        } catch (error) {
            console.log(`❌ Ruta ${route} falló:`, error.message);
        }
    }

    throw new Error('Todas las rutas fallaron');
}

        processData(data) {
    console.log('🔍 ESTRUCTURA COMPLETA recibida:', data);
    
    let stats = {};
    
    if (data.estadisticas) {
        stats = data.estadisticas;
        console.log('✅ Datos encontrados en: data.estadisticas', stats);
    } else if (data.stats) {
        stats = data.stats;
        console.log('✅ Datos encontrados en: data.stats', stats);
    } else if (data.dashboard) {
        stats = data.dashboard;
        console.log('✅ Datos encontrados en: data.dashboard', stats);
    } else {
        stats = data;
        console.log('⚠️ Usando data directamente', stats);
    }
    
    console.log('📊 Stats finales a procesar:', stats);
    
    // ⭐⭐ USAR EL MISMO PROCESAMIENTO PARA TODOS
    this.processAllData(stats);
}

processAllData(stats) {
    console.log('👥 Procesando datos COMPLETOS para TODOS:', stats);
    
    // ⭐⭐ ACTUALIZAR TODAS LAS ESTADÍSTICAS
    this.updateStat('totalUsers', stats.total_usuarios || '0');
    this.updateStat('totalStudents', stats.total_estudiantes || '0');
    this.updateStat('totalAdmins', stats.total_administradores || '1');
    this.updateStat('totalMatriculas', stats.total_matriculas || '0');
    this.updateStat('totalSecretarias', stats.total_secretarias || '1');
    this.updateStat('totalPagosPendientes', stats.pagos_pendientes || '0');
    this.updateStat('pagosHoy', stats.pagos_hoy || '0');
    this.updateStat('ingresosMes', stats.ingresos_mes ? `S/ ${parseFloat(stats.ingresos_mes).toFixed(2)}` : 'S/ 0.00');
}

        processAdminData(stats) {
        console.log('👑 Procesando datos para SUPERADMIN:', stats);
        
        // ⭐⭐ USA LOS NOMBRES EXACTOS de tu backend
        this.updateStat('totalUsers', stats.total_usuarios || '0');
        this.updateStat('totalStudents', stats.total_estudiantes || '0');
        this.updateStat('totalAdmins', stats.total_administradores || '1');
        this.updateStat('totalMatriculas', stats.total_matriculas || '0');
        this.updateStat('totalSecretarias', stats.total_secretarias || '1');
        this.updateStat('totalPagosPendientes', stats.pagos_pendientes || '0');
        this.updateStat('pagosHoy', stats.pagos_hoy || '0');
        this.updateStat('ingresosMes', `S/ ${parseFloat(stats.ingresos_mes || 0).toFixed(2)}`);
    }

    processBasicData(stats) {
        console.log('👤 Procesando datos para SECRETARIA:', stats);
        
        // ⭐⭐ DATOS QUE SÍ VIENEN del backend
        this.updateStat('totalPagosPendientes', stats.pagos_pendientes || '0');
        this.updateStat('pagosHoy', stats.pagos_hoy || '0');
        this.updateStat('totalStudents', stats.nuevos_estudiantes || '0');
        
        // ⭐⭐ DATOS QUE PODEMOS CALCULAR o estimar
        this.updateStat('totalMatriculas', (stats.nuevos_estudiantes || 0) + 2);
        this.updateStat('ingresosMes', stats.ingresos_mes ? `S/ ${parseFloat(stats.ingresos_mes).toFixed(2)}` : 'S/ 0.00');
        
        // ⭐⭐ DATOS OCULTOS para secretaria
        this.updateStat('totalUsers', 'N/A');
        this.updateStat('totalAdmins', 'N/A');
        this.updateStat('totalSecretarias', 'N/A');
    }

    async loadExampleData() {
        console.log('📋 Cargando datos de ejemplo para:', this.userRole);
        
        const exampleData = {
            'superadmin': {
                totalUsers: '8',
                totalStudents: '5', 
                totalAdmins: '2',
                totalMatriculas: '3',
                totalSecretarias: '1',
                totalPagosPendientes: '4',
                pagosHoy: '2',
                ingresosMes: 'S/ 1,250.00'
            },
            'secretaria': {
                totalUsers: 'N/A',
                totalStudents: '5',
                totalAdmins: 'N/A',
                totalMatriculas: '3', 
                totalSecretarias: 'N/A',
                totalPagosPendientes: '4',
                pagosHoy: '2',
                ingresosMes: 'N/A'
            }
        };

        const data = exampleData[this.userRole] || exampleData.secretaria;
        
        Object.keys(data).forEach(key => {
            this.updateStat(key, data[key]);
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    updateStat(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    showLoadingState() {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.classList.add('loading');
            refreshBtn.innerHTML = '⏳ Cargando...';
            refreshBtn.disabled = true;
        }
    }

    hideLoadingState() {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.classList.remove('loading');
            refreshBtn.innerHTML = '🔄 Actualizar Datos';
            refreshBtn.disabled = false;
        }
    }

    showError() {
        const errorElement = document.getElementById('errorMessage');
        if (errorElement) {
            errorElement.style.display = 'block';
        }
    }

    hideError() {
        const errorElement = document.getElementById('errorMessage');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }

    redirectToLogin() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    }
}

// Funciones globales
let dashboardManager;

function refreshDashboard() {
    if (dashboardManager) {
        dashboardManager.loadStatistics();
    }
}

function logout() {
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM cargado, inicializando dashboard...');
    dashboardManager = new DashboardManager();
});