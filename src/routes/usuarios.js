const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken, authorize } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

// 📋 Obtener todos los usuarios - CON PERMISO GRANULAR
router.get('/', 
    verifyToken, 
    checkPermission('usuarios', 'ver'),
    async (req, res) => {
        try {
            console.log('👤 Usuario solicitando usuarios:', req.user.rol);
            
            const { page = 1, limit = 10, search = '' } = req.query;
            const offset = (page - 1) * limit;

            let query = `
                SELECT id, dni, rol, nombre, apellido_paterno, apellido_materno,
                       email, telefono, fecha_creacion, debe_cambiar_password, activo
                FROM usuarios 
                WHERE 1=1
            `;
            let countQuery = `SELECT COUNT(*) FROM usuarios WHERE 1=1`;
            const params = [];
            let paramCount = 0;

            if (search) {
                paramCount++;
                query += ` AND (dni ILIKE $${paramCount} OR nombre ILIKE $${paramCount} OR apellido_paterno ILIKE $${paramCount})`;
                countQuery += ` AND (dni ILIKE $${paramCount} OR nombre ILIKE $${paramCount} OR apellido_paterno ILIKE $${paramCount})`;
                params.push(`%${search}%`);
            }

            query += ` ORDER BY fecha_creacion DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
            params.push(parseInt(limit), offset);

            const usersResult = await pool.query(query, params);
            const countResult = await pool.query(countQuery, params.slice(0, paramCount));
            const total = parseInt(countResult.rows[0].count);

            res.json({
                success: true,
                usuarios: usersResult.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('❌ Error obteniendo usuarios:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

// 🧩 Crear nuevo usuario - CON PERMISO GRANULAR
router.post('/', 
    verifyToken, 
    checkPermission('usuarios', 'crear'),
    async (req, res) => {
        const {
            dni,
            password,
            rol,
            nombre,
            apellido_paterno,
            apellido_materno = '',
            email = '',
            telefono = ''
        } = req.body;

        try {
            console.log('👤 Usuario creando nuevo usuario:', req.user.rol);

            // Validaciones básicas
            if (!dni || !password || !rol || !nombre || !apellido_paterno) {
                return res.status(400).json({ error: 'Faltan campos obligatorios' });
            }

            // Validar roles permitidos según el usuario que crea
            const allowedRoles = req.user.rol === 'superadmin' 
                ? ['superadmin', 'secretaria', 'estudiante']
                : ['estudiante']; // Secretaria solo puede crear estudiantes

            if (!allowedRoles.includes(rol)) {
                return res.status(400).json({ 
                    error: `No tienes permisos para crear usuarios con rol: ${rol}. Roles permitidos: ${allowedRoles.join(', ')}` 
                });
            }

            if (password.length < 6) {
                return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
            }

            // Verificar si el DNI ya existe
            const existingUser = await pool.query('SELECT id FROM usuarios WHERE dni = $1', [dni]);
            if (existingUser.rows.length > 0) {
                return res.status(400).json({ error: 'El DNI ya está registrado' });
            }

            // Hash de la contraseña
            const hashedPassword = await bcrypt.hash(password, 10);

            // Insertar nuevo usuario
            const result = await pool.query(
                `INSERT INTO usuarios (dni, password, rol, nombre, apellido_paterno, apellido_materno, email, telefono)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING id, dni, rol, nombre, apellido_paterno, apellido_materno, email, telefono, fecha_creacion`,
                [dni, hashedPassword, rol, nombre, apellido_paterno, apellido_materno, email, telefono]
            );

            console.log('✅ Usuario creado exitosamente por:', req.user.rol);

            res.status(201).json({
                success: true,
                message: 'Usuario creado exitosamente',
                usuario: result.rows[0]
            });

        } catch (error) {
            console.error('❌ Error creando usuario:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

// 🔍 Obtener un usuario por ID - CON PERMISO GRANULAR
router.get('/:id', 
    verifyToken, 
    checkPermission('usuarios', 'ver'),
    async (req, res) => {
        const { id } = req.params;

        try {
            console.log('👤 Usuario solicitando usuario específico:', req.user.rol);

            let query;
            let params = [id];

            // Si es secretaria, solo puede ver datos básicos (no superadmin)
            if (req.user.rol === 'secretaria') {
                query = `
                    SELECT id, dni, rol, nombre, apellido_paterno, apellido_materno,
                           email, telefono, activo, fecha_creacion
                    FROM usuarios
                    WHERE id = $1 AND rol != 'superadmin'
                `;
            } else {
                // Superadmin puede ver todos los usuarios
                query = `
                    SELECT id, dni, rol, nombre, apellido_paterno, apellido_materno,
                           email, telefono, activo, fecha_creacion
                    FROM usuarios
                    WHERE id = $1
                `;
            }

            const result = await pool.query(query, params);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            res.json({
                success: true,
                usuario: result.rows[0]
            });
        } catch (error) {
            console.error('❌ Error obteniendo usuario:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

// 🧠 Actualizar usuario - CON PERMISO GRANULAR
router.put('/:id', 
    verifyToken, 
    checkPermission('usuarios', 'editar'),
    async (req, res) => {
        const { id } = req.params;

        try {
            console.log('👤 Usuario actualizando usuario:', req.user.rol);

            const updates = [];
            const values = [];
            let i = 1;

            // Verificar que el usuario a editar existe
            const userToEdit = await pool.query(
                'SELECT id, rol FROM usuarios WHERE id = $1',
                [id]
            );

            if (userToEdit.rows.length === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            const targetUserRole = userToEdit.rows[0].rol;

            // RESTRICCIONES PARA SECRETARIA
            if (req.user.rol === 'secretaria') {
                // Secretaria NO puede editar superadmins
                if (targetUserRole === 'superadmin') {
                    return res.status(403).json({ 
                        error: 'No tienes permisos para editar superadministradores' 
                    });
                }

                // Secretaria NO puede cambiar roles a superadmin
                if (req.body.rol && req.body.rol === 'superadmin') {
                    return res.status(403).json({ 
                        error: 'No tienes permisos para asignar rol de superadministrador' 
                    });
                }

                // Secretaria solo puede cambiar a roles que tenga permiso
                if (req.body.rol && !['secretaria', 'estudiante'].includes(req.body.rol)) {
                    return res.status(403).json({ 
                        error: 'Solo puedes asignar roles: secretaria, estudiante' 
                    });
                }
            }

            // Verificar si el nuevo DNI ya está usado por otro usuario
            if (req.body.dni) {
                const existingUser = await pool.query(
                    'SELECT id FROM usuarios WHERE dni = $1 AND id != $2',
                    [req.body.dni, id]
                );
                if (existingUser.rows.length > 0) {
                    return res.status(400).json({ error: 'El DNI ya está registrado en otro usuario' });
                }
            }

            // Construir query dinámica
            for (const [key, value] of Object.entries(req.body)) {
                if (value !== undefined) {
                    updates.push(`${key} = $${i}`);
                    values.push(value);
                    i++;
                }
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'No hay campos para actualizar' });
            }

            values.push(id);
            const query = `
                UPDATE usuarios
                SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
                WHERE id = $${i}
                RETURNING id, dni, rol, nombre, apellido_paterno, apellido_materno, email, telefono, activo
            `;

            const result = await pool.query(query, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            console.log('✅ Usuario actualizado exitosamente por:', req.user.rol);

            res.json({
                success: true,
                message: 'Usuario actualizado exitosamente',
                usuario: result.rows[0]
            });

        } catch (error) {
            console.error('❌ Error actualizando usuario:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

// 🔑 Resetear contraseña - CON PERMISO GRANULAR
router.post('/:id/reset-password', 
    verifyToken, 
    checkPermission('usuarios', 'editar'),
    async (req, res) => {
        const { id } = req.params;
        const { nueva_password } = req.body;

        try {
            console.log('👤 Usuario reseteando contraseña:', req.user.rol);

            // Verificar permisos para secretaria
            if (req.user.rol === 'secretaria') {
                const targetUser = await pool.query(
                    'SELECT rol FROM usuarios WHERE id = $1',
                    [id]
                );

                if (targetUser.rows.length === 0) {
                    return res.status(404).json({ error: 'Usuario no encontrado' });
                }

                // Secretaria NO puede resetear contraseña de superadmins
                if (targetUser.rows[0].rol === 'superadmin') {
                    return res.status(403).json({ 
                        error: 'No tienes permisos para resetear contraseña de superadministradores' 
                    });
                }
            }

            if (!nueva_password || nueva_password.length < 6) {
                return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
            }

            const hashedPassword = await bcrypt.hash(nueva_password, 10);

            const result = await pool.query(
                `UPDATE usuarios 
                 SET password = $1, debe_cambiar_password = true, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2
                 RETURNING id, dni, nombre`,
                [hashedPassword, id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            console.log('✅ Contraseña reseteada exitosamente por:', req.user.rol);

            res.json({
                success: true,
                message: 'Contraseña reseteada exitosamente'
            });

        } catch (error) {
            console.error('❌ Error reseteando contraseña:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

// ❌ Eliminar (desactivar) usuario - CON PERMISO GRANULAR
router.delete('/:id', 
    verifyToken, 
    checkPermission('usuarios', 'eliminar'),
    async (req, res) => {
        const { id } = req.params;

        try {
            console.log('👤 Usuario eliminando usuario:', req.user.rol);

            // No permitir auto-eliminación
            if (parseInt(id) === req.user.id) {
                return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
            }

            const result = await pool.query(
                'UPDATE usuarios SET activo = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            console.log('✅ Usuario eliminado/desactivado exitosamente');

            res.json({
                success: true,
                message: 'Usuario eliminado exitosamente'
            });

        } catch (error) {
            console.error('❌ Error eliminando usuario:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

// 🔄 Reactivar usuario - CON PERMISO GRANULAR
router.post('/:id/activate', 
    verifyToken, 
    checkPermission('usuarios', 'editar'),
    async (req, res) => {
        const { id } = req.params;

        try {
            console.log('👤 Usuario reactivando usuario:', req.user.rol);

            const result = await pool.query(
                'UPDATE usuarios SET activo = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, dni, nombre',
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            res.json({
                success: true,
                message: 'Usuario reactivado exitosamente',
                usuario: result.rows[0]
            });

        } catch (error) {
            console.error('❌ Error reactivando usuario:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

// 🎛️ SISTEMA DE GESTIÓN DE PERMISOS - SOLO SUPERADMIN
// 🔧 Obtener todos los permisos del sistema
router.get('/permisos/config',
    verifyToken,
    authorize(['superadmin']),
    async (req, res) => {
        try {
            console.log('👤 Superadmin solicitando configuración de permisos');

            const result = await pool.query(`
                SELECT * FROM permisos 
                ORDER BY rol, modulo, accion
            `);
            
            res.json({
                success: true,
                permisos: result.rows
            });
        } catch (error) {
            console.error('❌ Error obteniendo permisos:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

// 🔧 Actualizar un permiso específico
router.put('/permisos/:id',
    verifyToken,
    authorize(['superadmin']),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { permitido } = req.body;
            
            console.log('👤 Superadmin actualizando permiso:', id, permitido);

            const result = await pool.query(`
                UPDATE permisos SET permitido = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2 
                RETURNING *
            `, [permitido, id]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Permiso no encontrado' });
            }

            res.json({
                success: true,
                message: 'Permiso actualizado correctamente',
                permiso: result.rows[0]
            });
        } catch (error) {
            console.error('❌ Error actualizando permiso:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

// 🔧 Crear nuevo permiso
router.post('/permisos',
    verifyToken,
    authorize(['superadmin']),
    async (req, res) => {
        try {
            const { rol, modulo, accion, permitido = true } = req.body;
            
            console.log('👤 Superadmin creando nuevo permiso:', { rol, modulo, accion });

            // Validaciones
            if (!rol || !modulo || !accion) {
                return res.status(400).json({ error: 'Rol, módulo y acción son obligatorios' });
            }

            const result = await pool.query(`
                INSERT INTO permisos (rol, modulo, accion, permitido)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `, [rol, modulo, accion, permitido]);
            
            res.status(201).json({
                success: true,
                message: 'Permiso creado correctamente',
                permiso: result.rows[0]
            });
        } catch (error) {
            console.error('❌ Error creando permiso:', error);
            if (error.code === '23505') {
                return res.status(400).json({ error: 'Este permiso ya existe' });
            }
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

// 🔄 Limpiar cache de permisos
router.post('/permisos/clear-cache',
    verifyToken,
    authorize(['superadmin']),
    async (req, res) => {
        try {
            // Limpiar cache del middleware
            const { clearPermissionsCache } = require('../middleware/permissions');
            clearPermissionsCache();
            
            res.json({
                success: true,
                message: 'Cache de permisos limpiado correctamente'
            });
        } catch (error) {
            console.error('Error limpiando cache:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

// 🔧 Restablecer permisos por defecto
router.post('/permisos/reset',
    verifyToken,
    authorize(['superadmin']),
    async (req, res) => {
        try {
            console.log('👤 Superadmin restableciendo permisos por defecto');

            // Eliminar todos los permisos existentes
            await pool.query('DELETE FROM permisos');

            // Insertar permisos por defecto
            const permisosPorDefecto = [
                // Superadmin - Acceso completo
                { rol: 'superadmin', modulo: 'usuarios', accion: 'ver' },
                { rol: 'superadmin', modulo: 'usuarios', accion: 'crear' },
                { rol: 'superadmin', modulo: 'usuarios', accion: 'editar' },
                { rol: 'superadmin', modulo: 'usuarios', accion: 'eliminar' },
                { rol: 'superadmin', modulo: 'usuarios', accion: 'permisos' },
                
                // Secretaria - Permisos limitados
                { rol: 'secretaria', modulo: 'estudiantes', accion: 'ver' },
                { rol: 'secretaria', modulo: 'estudiantes', accion: 'crear' },
                { rol: 'secretaria', modulo: 'estudiantes', accion: 'editar' },
                { rol: 'secretaria', modulo: 'matriculas', accion: 'ver' },
                { rol: 'secretaria', modulo: 'matriculas', accion: 'crear' },
                { rol: 'secretaria', modulo: 'pagos', accion: 'ver' },
                { rol: 'secretaria', modulo: 'pagos', accion: 'crear' },
                { rol: 'secretaria', modulo: 'asistencias', accion: 'ver' },
                { rol: 'secretaria', modulo: 'asistencias', accion: 'crear' },
                
                // Estudiante - Solo lectura propia
                { rol: 'estudiante', modulo: 'perfil', accion: 'ver' },
                { rol: 'estudiante', modulo: 'pagos', accion: 'ver' },
                { rol: 'estudiante', modulo: 'asistencias', accion: 'ver' }
            ];

            for (const permiso of permisosPorDefecto) {
                await pool.query(`
                    INSERT INTO permisos (rol, modulo, accion, permitido) 
                    VALUES ($1, $2, $3, $4)
                `, [permiso.rol, permiso.modulo, permiso.accion, true]);
            }

            res.json({
                success: true,
                message: 'Permisos restablecidos correctamente a los valores por defecto'
            });
        } catch (error) {
            console.error('❌ Error restableciendo permisos:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

// 🔐 GUARDAR PERMISOS DE USUARIO - VERSIÓN CORREGIDA
// 🔐 GUARDAR PERMISOS DE USUARIO - VERSIÓN MEJORADA
router.put('/:id/permisos', 
    verifyToken, 
    authorize(['superadmin']),
    async (req, res) => {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const userId = req.params.id;
            const { permisos } = req.body;

            console.log('🔐 [BACKEND] Guardando permisos para usuario:', userId);
            console.log('📋 [BACKEND] Permisos recibidos:', permisos);
            console.log('👤 [BACKEND] Usuario que hace la petición:', req.user);

            // 1. Obtener el rol del usuario
            const userResult = await client.query(
                'SELECT rol FROM usuarios WHERE id = $1',
                [userId]
            );

            if (userResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ 
                    success: false,
                    error: 'Usuario no encontrado' 
                });
            }

            const userRol = userResult.rows[0].rol;
            console.log(`🎯 [BACKEND] Rol del usuario: ${userRol}`);

            // 2. Eliminar permisos existentes del usuario/rol
            await client.query(
                'DELETE FROM permisos WHERE rol = $1',
                [userRol]
            );

            console.log(`🗑️ [BACKEND] Permisos antiguos eliminados para rol: ${userRol}`);

            // 3. Insertar nuevos permisos
            if (permisos && permisos.length > 0) {
                for (const permiso of permisos) {
                    console.log(`📝 [BACKEND] Insertando permiso: ${userRol} -> ${permiso.modulo}.${permiso.accion}`);
                    
                    await client.query(
                        `INSERT INTO permisos (rol, modulo, accion, permitido) 
                         VALUES ($1, $2, $3, $4)`,
                        [userRol, permiso.modulo, permiso.accion, permiso.permitido]
                    );
                }
                console.log(`✅ [BACKEND] ${permisos.length} permisos insertados para rol: ${userRol}`);
            } else {
                console.log('ℹ️ [BACKEND] No hay permisos para insertar');
            }

            await client.query('COMMIT');
            console.log('💾 [BACKEND] Transacción completada exitosamente');

            res.json({
                success: true,
                message: 'Permisos actualizados correctamente',
                permisosGuardados: permisos ? permisos.length : 0,
                rol: userRol
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ [BACKEND] Error guardando permisos:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error interno del servidor',
                detalle: error.message 
            });
        } finally {
            client.release();
            console.log('🔓 [BACKEND] Conexión liberada');
        }
    }
);

module.exports = router;