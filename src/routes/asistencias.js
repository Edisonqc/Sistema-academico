const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken, authorize } = require('../middleware/auth'); // ✅ CORREGIDO: agregar authorize

// 📋 Obtener asistencias con filtros - SUPERADMIN Y SECRETARIA
router.get('/', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']), // ✅ CORREGIDO: agregar autorización
    async (req, res) => {
        console.log('👤 Usuario solicitando asistencias:', req.user.rol);
        console.log('=== 📋 OBTENIENDO ASISTENCIAS ===');
        console.log('Query params:', req.query);
        
        try {
            const { 
                page = 1, 
                limit = 10, 
                search = '',
                fecha = ''
            } = req.query;

            const offset = (page - 1) * limit;

            console.log('1. Construyendo query corregida...');

            // Query CORREGIDA - uniendo con tabla usuarios
            let query = `
                SELECT 
                    a.id,
                    a.fecha,
                    a.hora,
                    a.tipo_registro,
                    a.created_at,
                    e.id as estudiante_id,
                    u.dni,
                    u.nombre,
                    u.apellido_paterno,
                    u.apellido_materno
                FROM asistencias a
                INNER JOIN estudiantes e ON a.estudiante_id = e.id
                INNER JOIN usuarios u ON e.usuario_id = u.id
                WHERE u.rol = 'estudiante' AND u.activo = true
            `;

            let countQuery = `
                SELECT COUNT(*)
                FROM asistencias a
                INNER JOIN estudiantes e ON a.estudiante_id = e.id
                INNER JOIN usuarios u ON e.usuario_id = u.id
                WHERE u.rol = 'estudiante' AND u.activo = true
            `;

            const params = [];
            let paramCount = 0;

            // Filtro por búsqueda
            if (search) {
                paramCount++;
                query += ` AND (u.dni ILIKE $${paramCount} OR u.nombre ILIKE $${paramCount} OR u.apellido_paterno ILIKE $${paramCount})`;
                countQuery += ` AND (u.dni ILIKE $${paramCount} OR u.nombre ILIKE $${paramCount} OR u.apellido_paterno ILIKE $${paramCount})`;
                params.push(`%${search}%`);
            }

            // Filtro por fecha
            if (fecha) {
                paramCount++;
                query += ` AND a.fecha = $${paramCount}`;
                countQuery += ` AND a.fecha = $${paramCount}`;
                params.push(fecha);
            }

            query += ` ORDER BY a.fecha DESC, a.hora DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
            params.push(parseInt(limit), parseInt(offset));

            console.log('Query final:', query);
            console.log('Parámetros:', params);

            // Ejecutar queries
            const asistenciasResult = await pool.query(query, params);
            const countResult = await pool.query(countQuery, params.slice(0, paramCount));
            const total = parseInt(countResult.rows[0].count);

            console.log('✅ Asistencias encontradas:', asistenciasResult.rows.length);

            res.json({
                success: true,
                asistencias: asistenciasResult.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('❌ ERROR obteniendo asistencias:');
            console.error('   Mensaje:', error.message);
            console.error('   Stack:', error.stack);
            
            res.status(500).json({ 
                success: false,
                error: 'Error del servidor al obtener asistencias',
                detalles: error.message
            });
        }
    }
);

// 📊 Obtener estadísticas de asistencias - SUPERADMIN Y SECRETARIA
router.get('/estadisticas', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']), // ✅ CORREGIDO: agregar autorización
    async (req, res) => {
        console.log('👤 Usuario solicitando estadísticas:', req.user.rol);
        console.log('=== 📊 OBTENIENDO ESTADÍSTICAS ===');
        console.log('Query params:', req.query);
        
        try {
            const { fecha = new Date().toISOString().split('T')[0] } = req.query;

            console.log('Fecha para estadísticas:', fecha);

            // Total de asistencias del día
            const asistenciasHoy = await pool.query(`
                SELECT COUNT(*) as total
                FROM asistencias 
                WHERE fecha = $1
            `, [fecha]);

            // Total de estudiantes activos (CORREGIDO)
            const estudiantesTotales = await pool.query(`
                SELECT COUNT(*) as total
                FROM estudiantes e
                INNER JOIN usuarios u ON e.usuario_id = u.id
                WHERE u.rol = 'estudiante' AND u.activo = true
            `);

            console.log('✅ Estadísticas calculadas');

            const asistencias = parseInt(asistenciasHoy.rows[0].total) || 0;
            const estudiantes = parseInt(estudiantesTotales.rows[0].total) || 0;
            const porcentaje = estudiantes > 0 ? Math.round((asistencias / estudiantes) * 100) : 0;

            res.json({
                success: true,
                estadisticas: {
                    fecha: fecha,
                    asistencias_hoy: asistencias,
                    estudiantes_totales: estudiantes,
                    porcentaje_asistencia: porcentaje
                }
            });

        } catch (error) {
            console.error('❌ ERROR obteniendo estadísticas:');
            console.error('   Mensaje:', error.message);
            
            res.status(500).json({ 
                success: false,
                error: 'Error del servidor al obtener estadísticas',
                detalles: error.message
            });
        }
    }
);

// 📝 Registrar asistencia - SUPERADMIN Y SECRETARIA
router.post('/registrar', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']), // ✅ CORREGIDO: agregar autorización
    async (req, res) => {
        console.log('👤 Usuario registrando asistencia:', req.user.rol);
        console.log('=== 📝 REGISTRANDO ASISTENCIA ===');
        console.log('Datos recibidos:', req.body);
        
        try {
            const { dni } = req.body;
            
            if (!dni) {
                return res.status(400).json({ 
                    success: false,
                    error: 'El DNI es requerido' 
                });
            }

            console.log('1. Buscando estudiante con DNI:', dni);
            
            // Buscar estudiante (VERSIÓN CORREGIDA - uniendo con usuarios)
            const estudianteResult = await pool.query(`
                SELECT 
                    e.id,
                    u.dni,
                    u.nombre,
                    u.apellido_paterno,
                    u.apellido_materno
                FROM estudiantes e
                INNER JOIN usuarios u ON e.usuario_id = u.id
                WHERE u.dni = $1 AND u.rol = 'estudiante' AND u.activo = true
            `, [dni]);

            if (estudianteResult.rows.length === 0) {
                console.log('❌ Estudiante no encontrado');
                return res.status(404).json({ 
                    success: false,
                    error: 'Estudiante no encontrado o inactivo' 
                });
            }

            const estudiante = estudianteResult.rows[0];
            console.log('✅ Estudiante encontrado:', estudiante.nombre);

            const hoy = new Date().toISOString().split('T')[0];
            const ahora = new Date().toTimeString().split(' ')[0];
            console.log('2. Fecha actual:', hoy, 'Hora:', ahora);

            // Verificar si ya registró asistencia hoy
            const asistenciaExistente = await pool.query(`
                SELECT id FROM asistencias 
                WHERE estudiante_id = $1 AND fecha = $2
            `, [estudiante.id, hoy]);

            if (asistenciaExistente.rows.length > 0) {
                console.log('⚠️ Asistencia ya registrada hoy');
                return res.status(400).json({ 
                    success: false,
                    error: 'El estudiante ya registró asistencia hoy',
                    estudiante: {
                        nombre: `${estudiante.nombre} ${estudiante.apellido_paterno}`,
                        dni: dni
                    }
                });
            }

            console.log('3. Registrando nueva asistencia...');
            
            // Registrar asistencia
            const asistenciaResult = await pool.query(`
                INSERT INTO asistencias (estudiante_id, fecha, hora, tipo_registro)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `, [estudiante.id, hoy, ahora, 'manual']);

            console.log('✅ Asistencia registrada:', asistenciaResult.rows[0]);

            res.json({
                success: true,
                message: 'Asistencia registrada exitosamente',
                asistencia: asistenciaResult.rows[0],
                estudiante: {
                    id: estudiante.id,
                    dni: estudiante.dni,
                    nombre: `${estudiante.nombre} ${estudiante.apellido_paterno} ${estudiante.apellido_materno || ''}`
                }
            });

        } catch (error) {
            console.error('❌ ERROR registrando asistencia:');
            console.error('   Mensaje:', error.message);
            console.error('   Stack:', error.stack);
            
            res.status(500).json({ 
                success: false,
                error: 'Error del servidor al registrar asistencia',
                detalles: error.message
            });
        }
    }
);

// 📅 Obtener asistencias por estudiante - SUPERADMIN Y SECRETARIA
router.get('/estudiante/:id', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']),
    async (req, res) => {
        try {
            const { id } = req.params;
            console.log('👤 Usuario solicitando asistencias del estudiante:', req.user.rol);

            const { page = 1, limit = 30 } = req.query;
            const offset = (page - 1) * limit;

            const asistenciasResult = await pool.query(`
                SELECT 
                    a.id,
                    a.fecha,
                    a.hora,
                    a.tipo_registro,
                    a.created_at
                FROM asistencias a
                WHERE a.estudiante_id = $1
                ORDER BY a.fecha DESC, a.hora DESC
                LIMIT $2 OFFSET $3
            `, [id, parseInt(limit), offset]);

            const countResult = await pool.query(`
                SELECT COUNT(*) FROM asistencias WHERE estudiante_id = $1
            `, [id]);

            const total = parseInt(countResult.rows[0].count);

            res.json({
                success: true,
                asistencias: asistenciasResult.rows,
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

// 📈 Reporte mensual de asistencias - SUPERADMIN Y SECRETARIA
router.get('/reporte/mensual', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']),
    async (req, res) => {
        try {
            const { mes, año } = req.query;
            const mesActual = mes || new Date().getMonth() + 1;
            const añoActual = año || new Date().getFullYear();

            console.log('👤 Usuario solicitando reporte mensual:', req.user.rol);

            const reporte = await pool.query(`
                SELECT 
                    u.dni,
                    u.nombre,
                    u.apellido_paterno,
                    u.apellido_materno,
                    COUNT(a.id) as total_asistencias,
                    COUNT(DISTINCT a.fecha) as dias_asistidos
                FROM estudiantes e
                INNER JOIN usuarios u ON e.usuario_id = u.id
                LEFT JOIN asistencias a ON e.id = a.estudiante_id 
                    AND EXTRACT(MONTH FROM a.fecha) = $1 
                    AND EXTRACT(YEAR FROM a.fecha) = $2
                WHERE u.rol = 'estudiante' AND u.activo = true
                GROUP BY u.dni, u.nombre, u.apellido_paterno, u.apellido_materno
                ORDER BY u.nombre, u.apellido_paterno
            `, [mesActual, añoActual]);

            res.json({
                success: true,
                reporte: reporte.rows,
                mes: mesActual,
                año: añoActual
            });

        } catch (error) {
            console.error('❌ Error generando reporte mensual:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

module.exports = router;