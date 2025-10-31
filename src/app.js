const express = require('express');
const path = require('path');
const pool = require('./config/database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ==================== RUTAS API ====================

// Health check
app.get('/api/status', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'API funcionando correctamente',
        timestamp: new Date().toISOString()
    });
});

// Cargar rutas API condicionalmente
const loadAPIRoute = (routePath, routeName) => {
    try {
        const route = require(routePath);
        app.use(`/api/${routeName}`, route);
        console.log(`✅ API ${routeName} cargada`);
        return true;
    } catch (error) {
        console.log(`❌ Error cargando API ${routeName}:`, error.message);
        // Crear ruta de fallback
        app.use(`/api/${routeName}`, (req, res) => {
            res.status(501).json({ 
                success: false, 
                error: `Módulo ${routeName} temporalmente no disponible` 
            });
        });
        return false;
    }
};

// Cargar todas las rutas API
loadAPIRoute('./routes/auth', 'auth');
loadAPIRoute('./routes/usuarios', 'usuarios');
loadAPIRoute('./routes/estudiantes', 'estudiantes');
loadAPIRoute('./routes/matriculas', 'matriculas');
loadAPIRoute('./routes/pagos', 'pagos');
loadAPIRoute('./routes/asistencias', 'asistencias');
loadAPIRoute('./routes/reportes', 'reportes');
loadAPIRoute('./routes/estudiantes-panel', 'estudiante');
loadAPIRoute('./routes/ciclos', 'ciclos');
loadAPIRoute('./routes/dashboard', 'dashboard');

// ==================== RUTAS DE EMERGENCIA ====================

// Ruta de login de emergencia
app.post('/api/auth/login-emergencia', (req, res) => {
    const { dni, password } = req.body;
    
    console.log('🔐 Login de emergencia para:', dni);
    
    // Usuarios hardcodeados para emergencia
    const users = {
        '99999999': { 
            password: 'admin123', 
            user: {
                id: 1,
                dni: '99999999',
                rol: 'superadmin', 
                nombre: 'Super', 
                apellido_paterno: 'Admin'
            }
        },
        '12345678': { 
            password: 'estudiante123', 
            user: {
                id: 2, 
                dni: '12345678',
                rol: 'estudiante', 
                nombre: 'Ana', 
                apellido_paterno: 'García'
            }
        }
    };
    
    const userData = users[dni];
    
    if (userData && userData.password === password) {
        const token = 'emergency-token-' + dni + '-' + Date.now();
        
        res.json({
            success: true,
            message: 'Login exitoso (modo emergencia)',
            user: userData.user,
            token: token
        });
        
        console.log('✅ Login emergencia exitoso para:', dni);
    } else {
        console.log('❌ Login emergencia fallido para:', dni);
        res.status(401).json({
            success: false,
            error: 'Credenciales inválidas'
        });
    }
});

// APIs de emergencia para estudiantes
app.get('/api/emergencia/mi-perfil', (req, res) => {
    console.log('👤 API emergencia - Perfil estudiante');
    
    const perfilEstudiante = {
        estudiante: {
            estudiante_id: 1,
            dni: '12345678',
            nombre: 'Ana',
            apellido_paterno: 'García',
            apellido_materno: 'López',
            email: 'ana.garcia@email.com',
            telefono: '987654321',
            direccion: 'Av. Ejemplo 123',
            fecha_nacimiento: '2000-05-15',
            genero: 'F',
            fecha_ingreso: '2024-01-10',
            estado_estudiante: 'activo'
        },
        matricula: {
            id: 1,
            numero_boleta: 'B2024001',
            fecha_matricula: '2024-01-15',
            metodo_pago: 'efectivo',
            aula: 'A-101',
            estado_matricula: 'activa',
            ciclo_nombre: 'Ciclo 2024-I',
            fecha_inicio: '2024-01-01',
            fecha_fin: '2024-12-31'
        }
    };
    
    res.json({
        success: true,
        ...perfilEstudiante
    });
});

app.get('/api/emergencia/mis-pagos', (req, res) => {
    console.log('💰 API emergencia - Pagos estudiante');
    
    const pagos = [
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
            estado: "pagado",
            metodo_pago: "tarjeta",
            fecha_vencimiento: "2024-02-15",
            fecha_pago: "2024-02-12",
            numero_boleta: "B2024001",
            ciclo_nombre: "Ciclo 2024-I"
        },
        {
            id: 3,
            numero_cuota: 3,
            monto: "500.00",
            estado: "pendiente",
            metodo_pago: null,
            fecha_vencimiento: "2024-03-15",
            fecha_pago: null,
            numero_boleta: "B2024001",
            ciclo_nombre: "Ciclo 2024-I"
        }
    ];
    
    const resumen = {
        pendiente: { cantidad: 1, monto: 500 },
        pagado: { cantidad: 2, monto: 1000 },
        vencido: { cantidad: 0, monto: 0 },
        total_general: 1500
    };
    
    res.json({
        success: true,
        pagos: pagos,
        resumen: resumen,
        pagination: {
            page: 1,
            limit: 10,
            total: 3,
            pages: 1
        }
    });
});

app.get('/api/emergencia/mis-asistencias', (req, res) => {
    console.log('✅ API emergencia - Asistencias estudiante');
    
    const asistencias = [
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
        },
        {
            id: 3,
            fecha: new Date(Date.now() - 172800000).toISOString().split('T')[0],
            hora: "08:10:00",
            tipo_registro: "manual",
            ciclo_nombre: "Ciclo 2024-I"
        }
    ];
    
    res.json({
        success: true,
        asistencias: asistencias,
        estadisticas: {
            total_asistencias: 15,
            dias_con_asistencia: 12,
            por_mes: [
                { mes: 1, año: 2024, total: 15 }
            ],
            año: 2024
        },
        pagination: {
            page: 1,
            limit: 10,
            total: 3,
            pages: 1
        }
    });
});

// ==================== RUTAS HTML ====================

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Rutas para superadmin
const superadminRoutes = [
    'dashboard', 'usuarios', 'estudiantes', 'matriculas', 
    'pagos', 'asistencias', 'reportes', 'ciclos', 
    'configuracion', 'seguridad', 'placeholder', 'permisos'
];

superadminRoutes.forEach(route => {
    app.get(`/superadmin/${route}.html`, (req, res) => {
        res.sendFile(path.join(__dirname, 'views', 'superadmin', `${route}.html`));
    });
});

// Rutas para estudiante
app.get('/estudiante/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'estudiante', 'dashboard.html'));
});

// Ruta para cambiar contraseña
app.get('/cambiar-password.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cambiar-password.html'));
});

// ==================== MANEJO DE ERRORES ====================

// 404 para páginas HTML (SOLO para rutas que no sean API)
app.use((req, res) => {
    // Si es una ruta API que no fue capturada
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            error: 'Ruta API no encontrada',
            path: req.path
        });
    }
    
    // Para rutas HTML
    const notFoundPath = path.join(__dirname, 'public', '404.html');
    const fs = require('fs');
    if (fs.existsSync(notFoundPath)) {
        res.status(404).sendFile(notFoundPath);
    } else {
        res.status(404).send('Página no encontrada: ' + req.path);
    }
});

// Error global
app.use((err, req, res, next) => {
    console.error('❌ Error del servidor:', err);
    
    if (req.path.startsWith('/api/')) {
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    } else {
        res.status(500).send('Error interno del servidor');
    }
});

// ==================== INICIALIZACIÓN ====================

app.listen(PORT, async () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📊 Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️  Base de datos: ${process.env.DB_NAME}`);
    console.log(`👤 Superadmin: DNI 99999999, Password admin123`);
    console.log(`🎓 Estudiante: DNI 12345678, Password estudiante123`);
    console.log(`📍 Endpoints disponibles:`);
    console.log(`   - http://localhost:${PORT}/ (Login)`);
    console.log(`   - http://localhost:${PORT}/api/status (Status API)`);
    console.log(`   - http://localhost:${PORT}/api/auth/login-emergencia (Login Emergencia)`);
    console.log(`📍 Páginas disponibles:`);
    console.log(`   - http://localhost:${PORT}/superadmin/dashboard.html`);
    console.log(`   - http://localhost:${PORT}/estudiante/dashboard.html`);
    
    try {
        await pool.query('SELECT NOW()');
        console.log('✅ Conectado a la base de datos PostgreSQL');
        
        // Crear tablas si no existen
        await require('./config/createTables')();
        console.log('🎉 Sistema inicializado correctamente');
        
    } catch (error) {
        console.error('❌ Error conectando a la base de datos:', error.message);
        console.log('⚠️  Usando modo emergencia - APIs de emergencia disponibles');
    }
});