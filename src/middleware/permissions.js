const pool = require('../config/database');

// Cache en memoria para permisos
const permissionsCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

const checkPermission = (modulo, accion) => {
    return async (req, res, next) => {
        try {
            const userRole = req.user.rol;
            
            console.log('=== 🔐 DEBUG PERMISOS ===');
            console.log('🔍 Consultando permiso:', { userRole, modulo, accion });

            // Superadmin siempre tiene acceso completo
            if (userRole === 'superadmin') {
                console.log('✅ Superadmin - acceso completo');
                return next();
            }

            // ✅ CONSULTA SQL CON LOGS DETALLADOS
            console.log('📊 Ejecutando consulta SQL:');
            const sql = `
                SELECT permitido FROM permisos 
                WHERE rol = $1 AND modulo = $2 AND accion = $3
            `;
            console.log('   SQL:', sql);
            console.log('   Parámetros:', [userRole, modulo, accion]);

            const result = await pool.query(sql, [userRole, modulo, accion]);

            console.log('📋 Resultado de la consulta:');
            console.log('   - Filas encontradas:', result.rows.length);
            console.log('   - Datos:', result.rows);
            console.log('   - Permiso encontrado:', result.rows.length > 0 ? result.rows[0].permitido : 'NO');

            const permitido = result.rows.length > 0 && result.rows[0].permitido;
            
            console.log(`🎯 CONCLUSIÓN: ${permitido ? 'PERMITIDO' : 'DENEGADO'}`);

            if (!permitido) {
                console.log('❌ BLOQUEANDO ACCESO');
                return res.status(403).json({ 
                    success: false,
                    error: `No tienes permiso para ${accion} en ${modulo}` 
                });
            }

            console.log('✅ PERMITIENDO ACCESO');
            next();

        } catch (error) {
            console.error('💥 ERROR EN CONSULTA:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    };
};

// Agregar al final del archivo
const clearPermissionsCache = () => {
    permissionsCache.clear();
    console.log('🧹 Cache de permisos limpiado');
};

module.exports = { checkPermission, clearPermissionsCache };