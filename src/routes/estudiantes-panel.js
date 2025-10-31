const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken, authorize } = require('../middleware/auth'); // ✅ CORREGIDO: agregar authorize

// ===============================
// ✅ ACTUALIZAR DATOS DEL ESTUDIANTE - SOLO ESTUDIANTE
// ===============================
router.put('/:id', 
    verifyToken, 
    authorize(['estudiante']), // ✅ CORREGIDO: solo estudiante puede editar sus datos
    async (req, res) => {
        try {
            const estudianteId = req.params.id;
            const {
                dni,
                nombre,
                apellido_paterno,
                apellido_materno,
                email,
                telefono,
                direccion,
                fecha_nacimiento,
                genero,
                estado_estudiante
            } = req.body;

            console.log('👤 Estudiante editando sus datos:', req.user.rol);
            console.log('✏️ Editando estudiante:', estudianteId, req.body);

            // Verificar que el estudiante solo puede editar sus propios datos
            if (parseInt(estudianteId) !== req.user.id) {
                return res.status(403).json({ error: 'No puedes editar datos de otros estudiantes' });
            }

            // 1️⃣ Buscar el usuario vinculado al estudiante
            const userResult = await pool.query(`
                SELECT u.id AS usuario_id
                FROM estudiantes e
                INNER JOIN usuarios u ON e.usuario_id = u.id
                WHERE e.id = $1 AND u.id = $2
            `, [estudianteId, req.user.id]);

            if (userResult.rows.length === 0) {
                return res.status(404).json({ error: 'Estudiante no encontrado' });
            }

            const usuarioId = userResult.rows[0].usuario_id;

            // 2️⃣ Actualizar los datos en la tabla usuarios
            await pool.query(`
                UPDATE usuarios
                SET 
                    dni = $1,
                    nombre = $2,
                    apellido_paterno = $3,
                    apellido_materno = $4,
                    email = $5,
                    telefono = $6,
                    direccion = $7,
                    fecha_nacimiento = $8,
                    genero = $9,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $10
            `, [
                dni,
                nombre,
                apellido_paterno,
                apellido_materno,
                email,
                telefono,
                direccion,
                fecha_nacimiento,
                genero,
                usuarioId
            ]);

            // 3️⃣ Actualizar estado del estudiante
            await pool.query(`
                UPDATE estudiantes
                SET estado = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [estado_estudiante, estudianteId]);

            console.log('✅ Datos del estudiante actualizados por:', req.user.rol);

            res.json({ success: true, message: '✅ Estudiante actualizado correctamente' });

        } catch (error) {
            console.error('❌ Error actualizando estudiante:', error);
            res.status(500).json({ error: 'Error al actualizar estudiante' });
        }
    }
);

// ===============================
// ✅ OBTENER PERFIL DEL ESTUDIANTE - SOLO ESTUDIANTE
// ===============================
router.get('/mi-perfil', 
    verifyToken, 
    authorize(['estudiante']), // ✅ CORREGIDO: solo estudiante
    async (req, res) => {
        try {
            const userId = req.user.id;

            console.log('👤 Estudiante obteniendo su perfil:', req.user.rol);
            console.log('👤 Obteniendo perfil del estudiante:', userId);

            const estudianteResult = await pool.query(`
                SELECT 
                    e.id as estudiante_id,
                    u.dni,
                    u.nombre,
                    u.apellido_paterno,
                    u.apellido_materno,
                    u.email,
                    u.telefono,
                    u.direccion,
                    u.fecha_nacimiento,
                    u.genero,
                    e.fecha_ingreso,
                    e.estado as estado_estudiante
                FROM estudiantes e
                INNER JOIN usuarios u ON e.usuario_id = u.id
                WHERE u.id = $1 AND u.rol = 'estudiante'
            `, [userId]);

            if (estudianteResult.rows.length === 0) {
                return res.status(404).json({ error: 'Estudiante no encontrado' });
            }

            const estudiante = estudianteResult.rows[0];

            // Obtener matrícula activa
            const matriculaResult = await pool.query(`
                SELECT 
                    m.id,
                    m.numero_boleta,
                    m.fecha_matricula,
                    m.metodo_pago,
                    m.aula,
                    m.estado as estado_matricula,
                    c.nombre as ciclo_nombre,
                    c.fecha_inicio,
                    c.fecha_fin
                FROM matriculas m
                INNER JOIN ciclos_academicos c ON m.ciclo_id = c.id
                WHERE m.estudiante_id = $1 AND m.activa = true
                ORDER BY m.fecha_matricula DESC
                LIMIT 1
            `, [estudiante.estudiante_id]);

            let matricula = matriculaResult.rows.length > 0 ? matriculaResult.rows[0] : null;

            res.json({
                success: true,
                estudiante: estudiante,
                matricula: matricula
            });

        } catch (error) {
            console.error('❌ Error obteniendo perfil del estudiante:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

// ===============================
// ✅ OBTENER PAGOS DEL ESTUDIANTE - SOLO ESTUDIANTE
// ===============================
router.get('/mis-pagos', 
    verifyToken, 
    authorize(['estudiante']), // ✅ CORREGIDO: solo estudiante
    async (req, res) => {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 10, estado = '' } = req.query;
            const offset = (page - 1) * limit;

            console.log('👤 Estudiante obteniendo sus pagos:', req.user.rol);
            console.log('💰 Obteniendo pagos del estudiante:', userId);

            const estudianteResult = await pool.query(`
                SELECT e.id FROM estudiantes e 
                WHERE e.usuario_id = $1
            `, [userId]);

            if (estudianteResult.rows.length === 0) {
                return res.status(404).json({ error: 'Estudiante no encontrado' });
            }

            const estudianteId = estudianteResult.rows[0].id;

            let query = `
                SELECT 
                    p.id,
                    p.numero_cuota,
                    p.monto,
                    p.estado,
                    p.metodo_pago,
                    p.fecha_vencimiento,
                    p.fecha_pago,
                    m.numero_boleta,
                    c.nombre as ciclo_nombre
                FROM pagos p
                INNER JOIN matriculas m ON p.matricula_id = m.id
                INNER JOIN ciclos_academicos c ON m.ciclo_id = c.id
                WHERE m.estudiante_id = $1
            `;

            let countQuery = `
                SELECT COUNT(*)
                FROM pagos p
                INNER JOIN matriculas m ON p.matricula_id = m.id
                WHERE m.estudiante_id = $1
            `;

            const params = [estudianteId];
            let paramCount = 1;

            if (estado) {
                paramCount++;
                query += ` AND p.estado = $${paramCount}`;
                countQuery += ` AND p.estado = $${paramCount}`;
                params.push(estado);
            }

            query += ` ORDER BY p.fecha_vencimiento DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
            params.push(parseInt(limit), parseInt(offset));

            const pagosResult = await pool.query(query, params);
            const countResult = await pool.query(countQuery, params.slice(0, paramCount));
            const total = parseInt(countResult.rows[0].count);

            const resumenResult = await pool.query(`
                SELECT 
                    estado,
                    COUNT(*) as cantidad,
                    SUM(monto) as total
                FROM pagos p
                INNER JOIN matriculas m ON p.matricula_id = m.id
                WHERE m.estudiante_id = $1
                GROUP BY estado
            `, [estudianteId]);

            const resumen = {
                pendiente: 0,
                pagado: 0,
                vencido: 0,
                total_general: 0
            };

            resumenResult.rows.forEach(item => {
                resumen[item.estado] = {
                    cantidad: parseInt(item.cantidad),
                    monto: parseFloat(item.total) || 0
                };
                resumen.total_general += parseFloat(item.total) || 0;
            });

            res.json({
                success: true,
                pagos: pagosResult.rows,
                resumen: resumen,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('❌ Error obteniendo pagos del estudiante:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

// ===============================
// ✅ OBTENER ASISTENCIAS DEL ESTUDIANTE - SOLO ESTUDIANTE
// ===============================
router.get('/mis-asistencias', 
    verifyToken, 
    authorize(['estudiante']), // ✅ CORREGIDO: solo estudiante
    async (req, res) => {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 10, mes, año = new Date().getFullYear() } = req.query;
            const offset = (page - 1) * limit;

            console.log('👤 Estudiante obteniendo sus asistencias:', req.user.rol);
            console.log('✅ Obteniendo asistencias del estudiante:', userId);

            const estudianteResult = await pool.query(`
                SELECT e.id FROM estudiantes e 
                WHERE e.usuario_id = $1
            `, [userId]);

            if (estudianteResult.rows.length === 0) {
                return res.status(404).json({ error: 'Estudiante no encontrado' });
            }

            const estudianteId = estudianteResult.rows[0].id;

            let query = `
                SELECT 
                    a.id,
                    a.fecha,
                    a.hora,
                    a.tipo_registro,
                    a.created_at,
                    c.nombre as ciclo_nombre
                FROM asistencias a
                LEFT JOIN matriculas m ON a.estudiante_id = m.estudiante_id AND m.activa = true
                LEFT JOIN ciclos_academicos c ON m.ciclo_id = c.id
                WHERE a.estudiante_id = $1
            `;

            let countQuery = `
                SELECT COUNT(*)
                FROM asistencias a
                WHERE a.estudiante_id = $1
            `;

            const params = [estudianteId];
            let paramCount = 1;

            if (mes) {
                paramCount++;
                query += ` AND EXTRACT(MONTH FROM a.fecha) = $${paramCount} AND EXTRACT(YEAR FROM a.fecha) = $${paramCount + 1}`;
                countQuery += ` AND EXTRACT(MONTH FROM a.fecha) = $${paramCount} AND EXTRACT(YEAR FROM a.fecha) = $${paramCount + 1}`;
                params.push(parseInt(mes), parseInt(año));
            } else {
                paramCount++;
                query += ` AND EXTRACT(YEAR FROM a.fecha) = $${paramCount}`;
                countQuery += ` AND EXTRACT(YEAR FROM a.fecha) = $${paramCount}`;
                params.push(parseInt(año));
            }

            query += ` ORDER BY a.fecha DESC, a.hora DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
            params.push(parseInt(limit), parseInt(offset));

            const asistenciasResult = await pool.query(query, params);
            const countResult = await pool.query(countQuery, params.slice(0, paramCount));
            const total = parseInt(countResult.rows[0].count);

            const statsResult = await pool.query(`
                SELECT 
                    COUNT(*) as total_asistencias,
                    COUNT(DISTINCT DATE(a.fecha)) as dias_con_asistencia,
                    EXTRACT(MONTH FROM a.fecha) as mes,
                    EXTRACT(YEAR FROM a.fecha) as año
                FROM asistencias a
                WHERE a.estudiante_id = $1 
                AND EXTRACT(YEAR FROM a.fecha) = $2
                GROUP BY mes, año
                ORDER BY año, mes
            `, [estudianteId, año]);

            res.json({
                success: true,
                asistencias: asistenciasResult.rows,
                estadisticas: {
                    total_asistencias: total,
                    por_mes: statsResult.rows,
                    año: año
                },
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('❌ Error obteniendo asistencias del estudiante:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

// ===============================
// ✅ DESCARGAR COMPROBANTE DE PAGO - SOLO ESTUDIANTE
// ===============================
router.get('/comprobante/:pagoId', 
    verifyToken, 
    authorize(['estudiante']), // ✅ CORREGIDO: solo estudiante
    async (req, res) => {
        try {
            const userId = req.user.id;
            const { pagoId } = req.params;

            console.log('👤 Estudiante generando comprobante:', req.user.rol);
            console.log('📄 Generando comprobante para pago:', pagoId);

            const pagoResult = await pool.query(`
                SELECT 
                    p.id,
                    p.numero_cuota,
                    p.monto,
                    p.estado,
                    p.metodo_pago,
                    p.fecha_pago,
                    p.fecha_vencimiento,
                    m.numero_boleta,
                    u.dni,
                    u.nombre,
                    u.apellido_paterno,
                    u.apellido_materno,
                    c.nombre as ciclo_nombre
                FROM pagos p
                INNER JOIN matriculas m ON p.matricula_id = m.id
                INNER JOIN estudiantes e ON m.estudiante_id = e.id
                INNER JOIN usuarios u ON e.usuario_id = u.id
                INNER JOIN ciclos_academicos c ON m.ciclo_id = c.id
                WHERE p.id = $1 AND u.id = $2
            `, [pagoId, userId]);

            if (pagoResult.rows.length === 0) {
                return res.status(404).json({ error: 'Pago no encontrado' });
            }

            const pago = pagoResult.rows[0];

            res.json({
                success: true,
                comprobante: {
                    numero: `CMP-${pago.id.toString().padStart(6, '0')}`,
                    fecha_emision: new Date().toISOString().split('T')[0],
                    pago: pago,
                    qr_data: `https://sistema-academico.edu.pe/comprobante/${pago.id}`
                }
            });

        } catch (error) {
            console.error('❌ Error generando comprobante:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

// ===============================
// ✅ OBTENER NOTIFICACIONES DEL ESTUDIANTE - SOLO ESTUDIANTE
// ===============================
router.get('/mis-notificaciones', 
    verifyToken, 
    authorize(['estudiante']),
    async (req, res) => {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 10 } = req.query;
            const offset = (page - 1) * limit;

            console.log('👤 Estudiante obteniendo notificaciones:', req.user.rol);

            const notificacionesResult = await pool.query(`
                SELECT 
                    id,
                    titulo,
                    mensaje,
                    tipo,
                    leido,
                    created_at
                FROM notificaciones 
                WHERE usuario_id = $1
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
            `, [userId, parseInt(limit), offset]);

            const countResult = await pool.query(`
                SELECT COUNT(*) FROM notificaciones WHERE usuario_id = $1
            `, [userId]);

            const total = parseInt(countResult.rows[0].count);

            res.json({
                success: true,
                notificaciones: notificacionesResult.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('❌ Error obteniendo notificaciones:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

module.exports = router;