// AUTH DE EMERGENCIA - VERSIÓN EXTREMA
console.log('🚨 Cargando auth de emergencia...');

function handleEmergencyLogin() {
    const dni = document.getElementById('dni').value.trim();
    const password = document.getElementById('password').value;
    
    console.log('🔐 Login emergencia:', dni, password);
    
    // Usuarios hardcodeados directamente
    const users = {
        '99999999': { 
            password: 'admin123', 
            rol: 'superadmin', 
            nombre: 'Super Admin'
        },
        '12345678': { 
            password: 'estudiante123', 
            rol: 'estudiante', 
            nombre: 'Ana García'
        }
    };
    
    const user = users[dni];
    
    if (user && user.password === password) {
        // Guardar sesión
        localStorage.setItem('token', 'emergency-token');
        localStorage.setItem('user', JSON.stringify({
            id: 1,
            dni: dni,
            rol: user.rol,
            nombre: user.nombre,
            apellido_paterno: user.rol === 'superadmin' ? 'Admin' : 'García'
        }));
        
        alert('✅ Login exitoso! Redirigiendo...');
        
        // Redirigir
        if (user.rol === 'estudiante') {
            window.location.href = '/estudiante/dashboard.html';
        } else {
            window.location.href = '/superadmin/dashboard.html';
        }
    } else {
        alert('❌ Credenciales incorrectas');
    }
}

// Reemplazar el form original
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    
    if (loginForm) {
        loginForm.onsubmit = function(e) {
            e.preventDefault();
            handleEmergencyLogin();
            return false;
        };
    }
    
    if (loginBtn) {
        loginBtn.onclick = handleEmergencyLogin;
    }
    
    console.log('✅ Auth de emergencia cargado');
});