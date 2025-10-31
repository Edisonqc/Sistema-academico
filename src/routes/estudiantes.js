const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken, authorize } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions'); // ✅ AGREGADO: middleware de permisos

// 📋 Obtener todos los estudiantes - SUPERADMIN Y SECRETARIA CON PERMISOS
router.get('/', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']),
    checkPermission('estudiantes', 'ver'), // ✅ AGREGADO: verificar permiso específico
    async (req, res) => {
        try {
            console.log('👤 Usuario solicitando estudiantes:', req.user.rol);
            
            const { page = 1, limit = 10, search = '' } = req.query;
            const offset = (page - 1) * limit;

            let query = `
                SELECT 
                    e.id,
                    e.direccion,
                    e.sexo,
                    e.fecha_nacimiento,
                    e.datos_apoderado,
                    e.tipo_alumno,
                    e.created_at,
                    u.dni,
                    u.nombre,
                    u.apellido_paterno,
                    u.apellido_materno,
                    u.email,
                    u.telefono,
                    u.activo
                FROM estudiantes e
                INNER JOIN usuarios u ON e.usuario_id = u.id
                WHERE u.rol = 'estudiante'
            `;

            let countQuery = `
                SELECT COUNT(*)
                FROM estudiantes e
                INNER JOIN usuarios u ON e.usuario_id = u.id
                WHERE u.rol = 'estudiante'
            `;

            const params = [];
            let paramCount = 0;

            if (search) {
                paramCount++;
                query += ` AND (u.dni ILIKE $${paramCount} OR u.nombre ILIKE $${paramCount} OR u.apellido_paterno ILIKE $${paramCount})`;
                countQuery += ` AND (u.dni ILIKE $${paramCount} OR u.nombre ILIKE $${paramCount} OR u.apellido_paterno ILIKE $${paramCount})`;
                params.push(`%${search}%`);
            }

            query += ` ORDER BY e.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
            params.push(parseInt(limit), offset);

            const studentsResult = await pool.query(query, params);
            const countResult = await pool.query(countQuery, params.slice(0, paramCount));
            const total = parseInt(countResult.rows[0].count);

            console.log(`✅ Estudiantes obtenidos: ${studentsResult.rows.length}`);

            res.json({
                success: true,
                estudiantes: studentsResult.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('❌ Error obteniendo estudiantes:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

// 🔍 Obtener estudiante por ID - SUPERADMIN Y SECRETARIA CON PERMISOS
router.get('/:id', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']),
    checkPermission('estudiantes', 'ver'), // ✅ AGREGADO: verificar permiso específico
    async (req, res) => {
        try {
            const { id } = req.params;
            console.log('👤 Usuario solicitando estudiante específico:', req.user.rol);

            const result = await pool.query(`
                SELECT 
                    e.*,
                    u.dni,
                    u.nombre,
                    u.apellido_paterno,
                    u.apellido_materno,
                    u.email,
                    u.telefono
                FROM estudiantes e
                INNER JOIN usuarios u ON e.usuario_id = u.id
                WHERE e.id = $1
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Estudiante no encontrado' });
            }

            res.json({
                success: true,
                estudiante: result.rows[0]
            });

        } catch (error) {
            console.error('❌ Error obteniendo estudiante:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

// 🧩 Crear nuevo estudiante - SUPERADMIN Y SECRETARIA CON PERMISOS
router.post('/', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']),
    checkPermission('estudiantes', 'crear'), // ✅ AGREGADO: verificar permiso específico
    async (req, res) => {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            console.log('👤 Usuario creando estudiante:', req.user.rol);

            const {
                dni,
                nombre,
                apellido_paterno,
                apellido_materno = '',
                email = '',
                telefono = '',
                direccion = '',
                sexo = '',
                fecha_nacimiento = null,
                datos_apoderado = null,
                tipo_alumno = 'full'
            } = req.body;

            // Validaciones
            if (!dni || !nombre || !apellido_paterno) {
                return res.status(400).json({ error: 'DNI, nombre y apellido paterno son obligatorios' });
            }

            // Verificar si el usuario ya existe
            const userExists = await client.query(
                'SELECT id FROM usuarios WHERE dni = $1',
                [dni]
            );

            let usuarioId;

            if (userExists.rows.length > 0) {
                // Usuario existe, verificar que sea estudiante
                const user = userExists.rows[0];
                const userRole = await client.query(
                    'SELECT rol FROM usuarios WHERE id = $1',
                    [user.id]
                );

                if (userRole.rows[0].rol !== 'estudiante') {
                    return res.status(400).json({ error: 'El DNI pertenece a un usuario que no es estudiante' });
                }

                usuarioId = user.id;

                // Actualizar datos del usuario
                await client.query(
                    `UPDATE usuarios 
                     SET nombre = $1, apellido_paterno = $2, apellido_materno = $3, email = $4, telefono = $5
                     WHERE id = $6`,
                    [nombre, apellido_paterno, apellido_materno, email, telefono, usuarioId]
                );

            } else {
                // Crear nuevo usuario estudiante
                const bcrypt = require('bcryptjs');
                const hashedPassword = await bcrypt.hash(dni, 10); // Password por defecto: DNI

                const newUser = await client.query(
                    `INSERT INTO usuarios (dni, password, rol, nombre, apellido_paterno, apellido_materno, email, telefono, debe_cambiar_password)
                     VALUES ($1, $2, 'estudiante', $3, $4, $5, $6, $7, true)
                     RETURNING id`,
                    [dni, hashedPassword, nombre, apellido_paterno, apellido_materno, email, telefono]
                );

                usuarioId = newUser.rows[0].id;
            }

            // Verificar si el estudiante ya existe
            const studentExists = await client.query(
                'SELECT id FROM estudiantes WHERE usuario_id = $1',
                [usuarioId]
            );

            let estudianteId;

            if (studentExists.rows.length > 0) {
                // Actualizar estudiante existente
                await client.query(
                    `UPDATE estudiantes 
                     SET direccion = $1, sexo = $2, fecha_nacimiento = $3, datos_apoderado = $4, tipo_alumno = $5
                     WHERE usuario_id = $6`,
                    [direccion, sexo, fecha_nacimiento, datos_apoderado, tipo_alumno, usuarioId]
                );
                estudianteId = studentExists.rows[0].id;
            } else {
                // Crear nuevo estudiante
                const newStudent = await client.query(
                    `INSERT INTO estudiantes (usuario_id, direccion, sexo, fecha_nacimiento, datos_apoderado, tipo_alumno)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING id`,
                    [usuarioId, direccion, sexo, fecha_nacimiento, datos_apoderado, tipo_alumno]
                );
                estudianteId = newStudent.rows[0].id;
            }

            await client.query('COMMIT');

            // Obtener datos completos del estudiante
            const studentResult = await pool.query(`
                SELECT 
                    e.*,
                    u.dni,
                    u.nombre,
                    u.apellido_paterno,
                    u.apellido_materno,
                    u.email,
                    u.telefono
                FROM estudiantes e
                INNER JOIN usuarios u ON e.usuario_id = u.id
                WHERE e.id = $1
            `, [estudianteId]);

            console.log('✅ Estudiante creado exitosamente por:', req.user.rol);

            res.status(201).json({
                success: true,
                message: 'Estudiante registrado exitosamente',
                estudiante: studentResult.rows[0]
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Error creando estudiante:', error);
            res.status(500).json({ error: 'Error del servidor' });
        } finally {
            client.release();
        }
    }
);

// ✅ Actualizar estudiante existente - SUPERADMIN Y SECRETARIA CON PERMISOS
router.put('/:id', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']),
    checkPermission('estudiantes', 'editar'), // ✅ AGREGADO: verificar permiso específico
    async (req, res) => {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');
            const { id } = req.params;

            console.log('👤 Usuario actualizando estudiante:', req.user.rol);

            const {
                dni,
                nombre,
                apellido_paterno,
                apellido_materno = '',
                email = '',
                telefono = '',
                direccion = '',
                sexo = '',
                fecha_nacimiento = null,
                datos_apoderado = null,
                tipo_alumno = 'full'
            } = req.body;

            const estudianteResult = await client.query(
                'SELECT usuario_id FROM estudiantes WHERE id = $1',
                [id]
            );

            if (estudianteResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Estudiante no encontrado' });
            }

            const usuarioId = estudianteResult.rows[0].usuario_id;

            // Verificar si el DNI ya existe en otro usuario
            if (dni) {
                const dniExists = await client.query(
                    'SELECT id FROM usuarios WHERE dni = $1 AND id != $2',
                    [dni, usuarioId]
                );
                if (dniExists.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'El DNI ya está registrado en otro usuario' });
                }
            }

            await client.query(
                `UPDATE usuarios 
                 SET dni = $1, nombre = $2, apellido_paterno = $3, apellido_materno = $4, 
                     email = $5, telefono = $6, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $7`,
                [dni, nombre, apellido_paterno, apellido_materno, email, telefono, usuarioId]
            );

            await client.query(
                `UPDATE estudiantes 
                 SET direccion = $1, sexo = $2, fecha_nacimiento = $3, 
                     datos_apoderado = $4, tipo_alumno = $5, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $6`,
                [direccion, sexo, fecha_nacimiento, datos_apoderado, tipo_alumno, id]
            );

            await client.query('COMMIT');

            const updated = await pool.query(`
                SELECT 
                    e.id,
                    e.direccion,
                    e.sexo,
                    e.fecha_nacimiento,
                    e.datos_apoderado,
                    e.tipo_alumno,
                    u.dni,
                    u.nombre,
                    u.apellido_paterno,
                    u.apellido_materno,
                    u.email,
                    u.telefono
                FROM estudiantes e
                INNER JOIN usuarios u ON e.usuario_id = u.id
                WHERE e.id = $1
            `, [id]);

            console.log('✅ Estudiante actualizado exitosamente por:', req.user.rol);

            res.json({
                success: true,
                message: 'Estudiante actualizado correctamente',
                estudiante: updated.rows[0]
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Error actualizando estudiante:', error);
            res.status(500).json({ error: 'Error al actualizar estudiante' });
        } finally {
            client.release();
        }
    }
);

// 📅 Obtener ciclos académicos activos - SUPERADMIN, SECRETARIA Y ESTUDIANTE
router.get('/ciclos/activos', 
    verifyToken, 
    authorize(['superadmin', 'secretaria', 'estudiante']),
    async (req, res) => {
        try {
            console.log('👤 Usuario solicitando ciclos activos:', req.user.rol);

            const result = await pool.query(`
                SELECT id, nombre, descripcion, precio, fecha_inicio, fecha_fin
                FROM ciclos_academicos 
                WHERE activo = true
                ORDER BY fecha_inicio DESC
            `);

            res.json({
                success: true,
                ciclos: result.rows
            });

        } catch (error) {
            console.error('❌ Error obteniendo ciclos:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

// 🔄 Obtener estudiantes para select/dropdown - SUPERADMIN Y SECRETARIA CON PERMISOS
router.get('/options/activos', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']),
    checkPermission('estudiantes', 'ver'), // ✅ AGREGADO: verificar permiso específico
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT 
                    e.id,
                    u.dni,
                    u.nombre,
                    u.apellido_paterno,
                    u.apellido_materno
                FROM estudiantes e
                INNER JOIN usuarios u ON e.usuario_id = u.id
                WHERE u.activo = true
                ORDER BY u.nombre, u.apellido_paterno
            `);

            res.json({
                success: true,
                estudiantes: result.rows
            });
        } catch (error) {
            console.error('❌ Error obteniendo opciones de estudiantes:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

module.exports = router;