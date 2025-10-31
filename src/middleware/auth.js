const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const verifyToken = async (req, res, next) => {
    console.log('🔐 Verificando autenticación para ruta:', req.path);
    
    let token = req.headers['authorization'];
    console.log('📨 Headers de autorización:', token);

    if (token && token.startsWith('Bearer ')) {
        token = token.slice(7, token.length);
    } else if (req.query.token) {
        token = req.query.token;
    }

    console.log('🔑 Token extraído:', token ? 'PRESENTE' : 'FALTANTE');

    if (!token) {
        console.log('❌ Token no proporcionado');
        return res.status(403).json({ error: 'Token no proporcionado' });
    }

    try {
        console.log('🔍 Verificando token...');
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('✅ Token JWT decodificado:', decoded);
        
        const userResult = await pool.query(
            'SELECT id, dni, rol, nombre, apellido_paterno, activo FROM usuarios WHERE id = $1',
            [decoded.id]
        );

        if (userResult.rows.length === 0) {
            console.log('❌ Usuario no encontrado en BD');
            return res.status(401).json({ error: 'Usuario no válido' });
        }

        if (!userResult.rows[0].activo) {
            console.log('❌ Usuario inactivo');
            return res.status(401).json({ error: 'Usuario inactivo' });
        }

        const user = userResult.rows[0];
        console.log('✅ Usuario válido:', user);
        
        req.user = {
            id: user.id,
            dni: user.dni,
            rol: user.rol,
            nombre: user.nombre,
            apellido_paterno: user.apellido_paterno
        };
        
        next();
        
    } catch (error) {
        console.error('❌ Error verificando token JWT:', error.message);
        return res.status(401).json({ 
            error: 'Token JWT inválido o expirado. Por favor, inicie sesión nuevamente.' 
        });
    }
};

// 🔐 MIDDLEWARE DE AUTORIZACIÓN POR ROLES
const authorize = (allowedRoles = []) => {
    return (req, res, next) => {
        console.log('👤 Usuario actual:', req.user.rol);
        console.log('🎯 Roles permitidos:', allowedRoles);
        
        if (!req.user) {
            console.log('❌ No hay usuario en la request');
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }

        // Si el array de roles permitidos está vacío, permitir todos los roles
        if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.rol)) {
            console.log('❌ Acceso denegado. Rol no autorizado:', req.user.rol);
            return res.status(403).json({ 
                error: `No tienes permisos para esta acción. Rol requerido: ${allowedRoles.join(', ')}` 
            });
        }

        console.log('✅ Acceso autorizado para rol:', req.user.rol);
        next();
    };
};

module.exports = {
    verifyToken,
    authorize
};