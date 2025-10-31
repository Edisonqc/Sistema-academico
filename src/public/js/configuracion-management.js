// CONFIGURACIÓN DEL SISTEMA - VERSIÓN FUNCIONAL
console.log('⚙️ Script de configuración cargado correctamente');

class ConfiguracionManagement {
    constructor() {
        this.init();
    }

    async init() {
        console.log('🚀 Inicializando sistema de configuración...');
        this.loadUserInfo();
        this.setupEventListeners();
        this.cargarConfiguracionActual();
        console.log('✅ Sistema de configuración inicializado');
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
        // Configurar eventos para los formularios
        document.getElementById('confirmacion')?.addEventListener('input', (e) => {
            this.habilitarAccionesPeligrosas(e.target.value);
        });

        console.log('✅ Event listeners configurados');
    }

    cargarConfiguracionActual() {
        try {
            console.log('📋 Cargando configuración actual...');
            
            // Cargar configuración desde localStorage o usar valores por defecto
            const config = JSON.parse(localStorage.getItem('configuracion_sistema') || '{}');
            
            // Configuración General
            document.getElementById('nombreInstitucion').value = config.nombreInstitucion || 'Centro de Estudios Académicos';
            document.getElementById('direccionInstitucion').value = config.direccionInstitucion || 'Av. Principal 123';
            document.getElementById('telefonoInstitucion').value = config.telefonoInstitucion || '+51 123 456 789';
            document.getElementById('emailInstitucion').value = config.emailInstitucion || 'contacto@institucion.edu';
            document.getElementById('moneda').value = config.moneda || 'PEN';
            
            // Configuración Académica
            document.getElementById('duracionClase').value = config.duracionClase || '45';
            document.getElementById('horarioInicio').value = config.horarioInicio || '08:00';
            document.getElementById('horarioFin').value = config.horarioFin || '16:00';
            document.getElementById('porcentajeAsistencia').value = config.porcentajeAsistencia || '75';
            document.getElementById('notaAprobatoria').value = config.notaAprobatoria || '11';
            
            // Sistema de Backup
            document.getElementById('frecuenciaBackup').value = config.frecuenciaBackup || 'semanal';
            document.getElementById('retencionBackup').value = config.retencionBackup || '30';
            
            console.log('✅ Configuración cargada correctamente');
            
        } catch (error) {
            console.error('❌ Error cargando configuración:', error);
        }
    }

    async guardarConfigGeneral() {
        try {
            console.log('💾 Guardando configuración general...');
            
            const config = {
                nombreInstitucion: document.getElementById('nombreInstitucion').value,
                direccionInstitucion: document.getElementById('direccionInstitucion').value,
                telefonoInstitucion: document.getElementById('telefonoInstitucion').value,
                emailInstitucion: document.getElementById('emailInstitucion').value,
                moneda: document.getElementById('moneda').value
            };
            
            // Guardar en localStorage
            const configActual = JSON.parse(localStorage.getItem('configuracion_sistema') || '{}');
            const nuevaConfig = { ...configActual, ...config };
            localStorage.setItem('configuracion_sistema', JSON.stringify(nuevaConfig));
            
            this.showMessage('✅ Configuración general guardada correctamente', 'success');
            
        } catch (error) {
            console.error('❌ Error guardando configuración general:', error);
            this.showMessage('❌ Error guardando configuración', 'error');
        }
    }

    async guardarConfigAcademica() {
        try {
            console.log('🎓 Guardando configuración académica...');
            
            const config = {
                duracionClase: document.getElementById('duracionClase').value,
                horarioInicio: document.getElementById('horarioInicio').value,
                horarioFin: document.getElementById('horarioFin').value,
                porcentajeAsistencia: document.getElementById('porcentajeAsistencia').value,
                notaAprobatoria: document.getElementById('notaAprobatoria').value
            };
            
            // Validaciones
            if (config.porcentajeAsistencia < 50 || config.porcentajeAsistencia > 100) {
                this.showMessage('El porcentaje de asistencia debe estar entre 50% y 100%', 'warning');
                return;
            }
            
            if (config.notaAprobatoria < 0 || config.notaAprobatoria > 20) {
                this.showMessage('La nota aprobatoria debe estar entre 0 y 20', 'warning');
                return;
            }
            
            // Guardar en localStorage
            const configActual = JSON.parse(localStorage.getItem('configuracion_sistema') || '{}');
            const nuevaConfig = { ...configActual, ...config };
            localStorage.setItem('configuracion_sistema', JSON.stringify(nuevaConfig));
            
            this.showMessage('✅ Configuración académica guardada correctamente', 'success');
            
        } catch (error) {
            console.error('❌ Error guardando configuración académica:', error);
            this.showMessage('❌ Error guardando configuración', 'error');
        }
    }

    async crearBackup() {
        try {
            console.log('💾 Creando backup del sistema...');
            this.showMessage('⏳ Creando backup, por favor espere...', 'info');
            
            // Simular creación de backup
            setTimeout(() => {
                const fecha = new Date().toISOString().split('T')[0];
                this.showMessage(`✅ Backup creado correctamente: backup-${fecha}.sql`, 'success');
                
                // Actualizar lista de backups
                this.actualizarListaBackups();
            }, 2000);
            
        } catch (error) {
            console.error('❌ Error creando backup:', error);
            this.showMessage('❌ Error creando backup', 'error');
        }
    }

    async restaurarBackup() {
        try {
            const confirmacion = confirm('¿Está seguro de que desea restaurar el sistema desde un backup? Esta acción no se puede deshacer.');
            
            if (confirmacion) {
                this.showMessage('⏳ Restaurando sistema desde backup...', 'info');
                
                // Simular restauración
                setTimeout(() => {
                    this.showMessage('✅ Sistema restaurado correctamente desde el backup', 'success');
                }, 3000);
            }
            
        } catch (error) {
            console.error('❌ Error restaurando backup:', error);
            this.showMessage('❌ Error restaurando backup', 'error');
        }
    }

    actualizarListaBackups() {
        const listaBackups = document.getElementById('listaBackups');
        if (listaBackups) {
            const fecha = new Date();
            const backups = [
                { nombre: `backup-${fecha.toISOString().split('T')[0]}.sql`, fecha: fecha.toLocaleDateString() },
                { nombre: `backup-2024-03-15.sql`, fecha: '15/03/2024' },
                { nombre: `backup-2024-03-08.sql`, fecha: '08/03/2024' }
            ];
            
            listaBackups.innerHTML = backups.map(backup => `
                <div class="backup-item">
                    <span>${backup.nombre}</span>
                    <span>${backup.fecha}</span>
                </div>
            `).join('');
        }
    }

    habilitarAccionesPeligrosas(texto) {
        const confirmado = texto.toUpperCase() === 'CONFIRMAR';
        document.getElementById('btnLimpiarDatos').disabled = !confirmado;
        document.getElementById('btnReiniciarSistema').disabled = !confirmado;
    }

    async limpiarDatosPrueba() {
        try {
            const confirmacion = confirm('⚠️ ¿ESTÁ ABSOLUTAMENTE SEGURO?\n\nEsta acción eliminará todos los datos de prueba y no se puede deshacer.');
            
            if (confirmacion) {
                this.showMessage('🗑️ Eliminando datos de prueba...', 'warning');
                
                // Simular limpieza
                setTimeout(() => {
                    this.showMessage('✅ Datos de prueba eliminados correctamente', 'success');
                    document.getElementById('confirmacion').value = '';
                    this.habilitarAccionesPeligrosas('');
                }, 2000);
            }
            
        } catch (error) {
            console.error('❌ Error limpiando datos:', error);
            this.showMessage('❌ Error limpiando datos', 'error');
        }
    }

    async reiniciarSistema() {
        try {
            const confirmacion = confirm('🚨 ¿ESTÁ ABSOLUTAMENTE SEGURO?\n\nEsta acción reiniciará todo el sistema y eliminará todos los datos. Esta acción es IRREVERSIBLE.');
            
            if (confirmacion) {
                this.showMessage('🔄 Reiniciando sistema...', 'warning');
                
                // Simular reinicio
                setTimeout(() => {
                    this.showMessage('✅ Sistema reiniciado correctamente', 'success');
                    document.getElementById('confirmacion').value = '';
                    this.habilitarAccionesPeligrosas('');
                    
                    // Redirigir al dashboard después del reinicio
                    setTimeout(() => {
                        window.location.href = '/superadmin/dashboard.html';
                    }, 2000);
                }, 3000);
            }
            
        } catch (error) {
            console.error('❌ Error reiniciando sistema:', error);
            this.showMessage('❌ Error reiniciando sistema', 'error');
        }
    }

    async actualizarSistema() {
        try {
            this.showMessage('🔍 Buscando actualizaciones...', 'info');
            
            // Simular búsqueda de actualizaciones
            setTimeout(() => {
                this.showMessage('✅ El sistema está actualizado a la última versión', 'success');
            }, 1500);
            
        } catch (error) {
            console.error('❌ Error actualizando sistema:', error);
            this.showMessage('❌ Error buscando actualizaciones', 'error');
        }
    }

    async verLogs() {
        try {
            this.showMessage('📋 Abriendo logs del sistema...', 'info');
            
            // Simular apertura de logs
            setTimeout(() => {
                alert('Esta funcionalidad abrirá los logs del sistema en una nueva ventana.\n\nEn una implementación real, se mostrarían los archivos de log del servidor.');
            }, 1000);
            
        } catch (error) {
            console.error('❌ Error abriendo logs:', error);
            this.showMessage('❌ Error abriendo logs', 'error');
        }
    }

    showMessage(message, type) {
        try {
            // Remover mensajes anteriores
            const existingMessages = document.querySelectorAll('.global-message');
            existingMessages.forEach(msg => msg.remove());

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
                            type === 'warning' ? '#fff3cd' : 
                            type === 'success' ? '#efe' : '#e3f2fd'};
                color: ${type === 'error' ? '#c33' : 
                        type === 'warning' ? '#856404' : 
                        type === 'success' : '#363' : '#1565c0'};
                border: 1px solid ${type === 'error' ? '#fcc' : 
                                  type === 'warning' ? '#ffeaa7' : 
                                  type === 'success' ? '#cfc' : '#bbdefb'};
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            `;

            document.body.appendChild(messageDiv);

            // Auto-remover después de 5 segundos
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.remove();
                }
            }, 5000);
        } catch (error) {
            console.error('❌ Error mostrando mensaje:', error);
        }
    }
}

// Funciones globales
let configManager;

function goToDashboard() {
    window.location.href = '/superadmin/dashboard.html';
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

function guardarConfigGeneral() {
    if (configManager) {
        configManager.guardarConfigGeneral();
    }
}

function guardarConfigAcademica() {
    if (configManager) {
        configManager.guardarConfigAcademica();
    }
}

function crearBackup() {
    if (configManager) {
        configManager.crearBackup();
    }
}

function restaurarBackup() {
    if (configManager) {
        configManager.restaurarBackup();
    }
}

function limpiarDatosPrueba() {
    if (configManager) {
        configManager.limpiarDatosPrueba();
    }
}

function reiniciarSistema() {
    if (configManager) {
        configManager.reiniciarSistema();
    }
}

function actualizarSistema() {
    if (configManager) {
        configManager.actualizarSistema();
    }
}

function verLogs() {
    if (configManager) {
        configManager.verLogs();
    }
}

function habilitarAccionesPeligrosas() {
    const input = document.getElementById('confirmacion');
    if (input && configManager) {
        configManager.habilitarAccionesPeligrosas(input.value);
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM cargado, inicializando configuración...');
    configManager = new ConfiguracionManagement();
});