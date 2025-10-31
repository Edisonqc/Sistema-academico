const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken, authorize } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions'); // ✅ AGREGAR ESTA LÍNEA

// 📊 Reporte general del sistema - SUPERADMIN Y SECRETARIA
router.get('/general', 
    verifyToken, 
    checkPermission('reportes', 'ver'), // ✅ CAMBIAR: usar checkPermission en lugar de authorize
    async (req, res) => {
        try {
            console.log('👤 Usuario solicitando reporte general:', req.user.rol);
            console.log('📈 Generando reporte general...');

            // Totales generales
            const [
                totalUsuarios,
                totalEstudiantes,
                totalMatriculas,
                totalPagos,
                totalAsistencias
            ] = await Promise.all([
                pool.query('SELECT COUNT(*) FROM usuarios WHERE activo = true'),
                pool.query('SELECT COUNT(*) FROM estudiantes e INNER JOIN usuarios u ON e.usuario_id = u.id WHERE u.activo = true'),
                pool.query('SELECT COUNT(*) FROM matriculas'),
                pool.query('SELECT COUNT(*) FROM pagos'),
                pool.query('SELECT COUNT(*) FROM asistencias')
            ]);

            // Ingresos mensuales
            const ingresosMensuales = await pool.query(`
                SELECT 
                    EXTRACT(YEAR FROM fecha_pago) as año,
                    EXTRACT(MONTH FROM fecha_pago) as mes,
                    SUM(monto) as total
                FROM pagos 
                WHERE estado = 'pagado' AND fecha_pago IS NOT NULL
                GROUP BY año, mes
                ORDER BY año DESC, mes DESC
                LIMIT 12
            `);

            // Asistencias mensuales
            const asistenciasMensuales = await pool.query(`
                SELECT 
                    EXTRACT(YEAR FROM fecha) as año,
                    EXTRACT(MONTH FROM fecha) as mes,
                    COUNT(*) as total
                FROM asistencias 
                GROUP BY año, mes
                ORDER BY año DESC, mes DESC
                LIMIT 12
            `);

            // Estado de pagos
            const estadoPagos = await pool.query(`
                SELECT estado, COUNT(*) as total, SUM(monto) as monto_total
                FROM pagos 
                GROUP BY estado
            `);

            // Distribución por roles
            const distribucionRoles = await pool.query(`
                SELECT rol, COUNT(*) as total
                FROM usuarios 
                WHERE activo = true
                GROUP BY rol
            `);

            console.log('✅ Reporte general generado por:', req.user.rol);

            res.json({
                success: true,
                reporte: {
                    general: {
                        usuarios: parseInt(totalUsuarios.rows[0].count),
                        estudiantes: parseInt(totalEstudiantes.rows[0].count),
                        matriculas: parseInt(totalMatriculas.rows[0].count),
                        pagos: parseInt(totalPagos.rows[0].count),
                        asistencias: parseInt(totalAsistencias.rows[0].count)
                    },
                    ingresos_mensuales: ingresosMensuales.rows,
                    asistencias_mensuales: asistenciasMensuales.rows,
                    estado_pagos: estadoPagos.rows,
                    distribucion_roles: distribucionRoles.rows,
                    fecha_generacion: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ Error generando reporte general:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error generando reporte' 
            });
        }
    }
);

// 💰 Reporte de pagos detallado - SUPERADMIN Y SECRETARIA
router.get('/pagos', 
    verifyToken, 
    checkPermission('reportes', 'ver'), // ✅ CAMBIAR: usar checkPermission
    async (req, res) => {
        try {
            console.log('👤 Usuario solicitando reporte de pagos:', req.user.rol);
            
            const { 
                fecha_inicio, 
                fecha_fin,
                estado = '',
                metodo_pago = ''
            } = req.query;

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
                WHERE 1=1
            `;

            const params = [];
            let paramCount = 0;

            if (fecha_inicio) {
                paramCount++;
                query += ` AND p.fecha_vencimiento >= $${paramCount}`;
                params.push(fecha_inicio);
            }

            if (fecha_fin) {
                paramCount++;
                query += ` AND p.fecha_vencimiento <= $${paramCount}`;
                params.push(fecha_fin);
            }

            if (estado) {
                paramCount++;
                query += ` AND p.estado = $${paramCount}`;
                params.push(estado);
            }

            if (metodo_pago) {
                paramCount++;
                query += ` AND p.metodo_pago = $${paramCount}`;
                params.push(metodo_pago);
            }

            query += ` ORDER BY p.fecha_vencimiento DESC`;

            console.log('🔍 Ejecutando query de reporte de pagos:', query);

            const result = await pool.query(query, params);

            // Calcular totales
            const totales = {
                pendiente: 0,
                pagado: 0,
                vencido: 0,
                total_general: 0
            };

            result.rows.forEach(pago => {
                const monto = parseFloat(pago.monto);
                totales[pago.estado] += monto;
                totales.total_general += monto;
            });

            console.log('✅ Reporte de pagos generado por:', req.user.rol);

            res.json({
                success: true,
                pagos: result.rows,
                totales: totales,
                cantidad: result.rows.length
            });

        } catch (error) {
            console.error('❌ Error generando reporte de pagos:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error generando reporte de pagos' 
            });
        }
    }
);

// 📅 Reporte de asistencias detallado - SUPERADMIN Y SECRETARIA
router.get('/asistencias', 
    verifyToken, 
    checkPermission('reportes', 'ver'), // ✅ CAMBIAR: usar checkPermission
    async (req, res) => {
        try {
            console.log('👤 Usuario solicitando reporte de asistencias:', req.user.rol);
            
            const { 
                fecha_inicio, 
                fecha_fin,
                estudiante_id = '',
                tipo_registro = ''
            } = req.query;

            let query = `
                SELECT 
                    a.id,
                    a.fecha,
                    a.hora,
                    a.tipo_registro,
                    u.dni,
                    u.nombre,
                    u.apellido_paterno,
                    u.apellido_materno,
                    c.nombre as ciclo_nombre
                FROM asistencias a
                INNER JOIN estudiantes e ON a.estudiante_id = e.id
                INNER JOIN usuarios u ON e.usuario_id = u.id
                LEFT JOIN matriculas m ON e.id = m.estudiante_id AND m.activa = true
                LEFT JOIN ciclos_academicos c ON m.ciclo_id = c.id
                WHERE 1=1
            `;

            const params = [];
            let paramCount = 0;

            if (fecha_inicio) {
                paramCount++;
                query += ` AND a.fecha >= $${paramCount}`;
                params.push(fecha_inicio);
            }

            if (fecha_fin) {
                paramCount++;
                query += ` AND a.fecha <= $${paramCount}`;
                params.push(fecha_fin);
            }

            if (estudiante_id) {
                paramCount++;
                query += ` AND a.estudiante_id = $${paramCount}`;
                params.push(estudiante_id);
            }

            if (tipo_registro) {
                paramCount++;
                query += ` AND a.tipo_registro = $${paramCount}`;
                params.push(tipo_registro);
            }

            query += ` ORDER BY a.fecha DESC, a.hora DESC`;

            const result = await pool.query(query, params);

            // Estadísticas
            const estadisticas = {
                total_asistencias: result.rows.length,
                por_tipo: {},
                por_estudiante: {}
            };

            result.rows.forEach(asistencia => {
                // Por tipo
                const tipo = asistencia.tipo_registro;
                estadisticas.por_tipo[tipo] = (estadisticas.por_tipo[tipo] || 0) + 1;

                // Por estudiante
                const estudiante = asistencia.dni;
                estadisticas.por_estudiante[estudiante] = (estadisticas.por_estudiante[estudiante] || 0) + 1;
            });

            console.log('✅ Reporte de asistencias generado por:', req.user.rol);

            res.json({
                success: true,
                asistencias: result.rows,
                estadisticas: estadisticas
            });

        } catch (error) {
            console.error('❌ Error generando reporte de asistencias:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error generando reporte de asistencias' 
            });
        }
    }
);

// 📊 Dashboard estadísticas - SUPERADMIN Y SECRETARIA
router.get('/dashboard', 
    verifyToken, 
    checkPermission('reportes', 'ver'), // ✅ CAMBIAR: usar checkPermission
    async (req, res) => {
        try {
            console.log('👤 Usuario solicitando dashboard:', req.user.rol);
            
            // Estadísticas rápidas para dashboard
            const [
                pagosPendientes,
                pagosHoy,
                asistenciasHoy,
                nuevosEstudiantes
            ] = await Promise.all([
                pool.query("SELECT COUNT(*) FROM pagos WHERE estado = 'pendiente' AND fecha_vencimiento <= CURRENT_DATE + INTERVAL '7 days'"),
                pool.query("SELECT COUNT(*) FROM pagos WHERE fecha_pago::date = CURRENT_DATE"),
                pool.query("SELECT COUNT(*) FROM asistencias WHERE fecha = CURRENT_DATE"),
                pool.query("SELECT COUNT(*) FROM estudiantes WHERE DATE(created_at) = CURRENT_DATE")
            ]);

            // Ingresos del mes actual
            const ingresosMes = await pool.query(`
                SELECT COALESCE(SUM(monto), 0) as total
                FROM pagos 
                WHERE estado = 'pagado' 
                AND EXTRACT(MONTH FROM fecha_pago) = EXTRACT(MONTH FROM CURRENT_DATE)
                AND EXTRACT(YEAR FROM fecha_pago) = EXTRACT(YEAR FROM CURRENT_DATE)
            `);

            console.log('✅ Dashboard generado por:', req.user.rol);

            res.json({
                success: true,
                dashboard: {
                    pagos_pendientes: parseInt(pagosPendientes.rows[0].count),
                    pagos_hoy: parseInt(pagosHoy.rows[0].count),
                    asistencias_hoy: parseInt(asistenciasHoy.rows[0].count),
                    nuevos_estudiantes: parseInt(nuevosEstudiantes.rows[0].count),
                    ingresos_mes: parseFloat(ingresosMes.rows[0].total) || 0
                }
            });

        } catch (error) {
            console.error('❌ Error obteniendo datos del dashboard:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error obteniendo datos del dashboard' 
            });
        }
    }
);

// 📄 Exportar reporte a PDF - SUPERADMIN Y SECRETARIA
router.post('/exportar/pdf', 
    verifyToken, 
    checkPermission('reportes', 'crear'), // ✅ CAMBIAR: usar checkPermission
    async (req, res) => {
        try {
            console.log('👤 Usuario exportando a PDF:', req.user.rol);
            
            const { tipo_reporte, datos, filtros } = req.body;

            console.log('📄 Solicitando exportación PDF para:', tipo_reporte);

            // Simular generación de PDF
            setTimeout(() => {
                res.json({
                    success: true,
                    message: 'Reporte PDF generado exitosamente',
                    url: `/exports/reporte-${tipo_reporte}-${Date.now()}.pdf`,
                    nombre_archivo: `reporte-${tipo_reporte}-${new Date().toISOString().split('T')[0]}.pdf`
                });
            }, 2000);

        } catch (error) {
            console.error('❌ Error exportando a PDF:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error exportando reporte' 
            });
        }
    }
);

// 📊 Exportar reporte a Excel - SUPERADMIN Y SECRETARIA
router.post('/exportar/excel', 
    verifyToken, 
    checkPermission('reportes', 'crear'), // ✅ CAMBIAR: usar checkPermission
    async (req, res) => {
        try {
            console.log('👤 Usuario exportando a Excel:', req.user.rol);
            
            const { tipo_reporte, datos, filtros } = req.body;

            console.log('📊 Solicitando exportación Excel para:', tipo_reporte);

            // Simular generación de Excel
            setTimeout(() => {
                res.json({
                    success: true,
                    message: 'Reporte Excel generado exitosamente',
                    url: `/exports/reporte-${tipo_reporte}-${Date.now()}.xlsx`,
                    nombre_archivo: `reporte-${tipo_reporte}-${new Date().toISOString().split('T')[0]}.xlsx`
                });
            }, 2000);

        } catch (error) {
            console.error('❌ Error exportando a Excel:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error exportando reporte' 
            });
        }
    }
);

// 🎓 Reporte de estudiantes - SUPERADMIN Y SECRETARIA
router.get('/estudiantes', 
    verifyToken, 
    checkPermission('reportes', 'ver'), // ✅ CAMBIAR: usar checkPermission
    async (req, res) => {
        try {
            console.log('👤 Usuario solicitando reporte de estudiantes:', req.user.rol);
            
            const { tipo = 'activos' } = req.query;

            let whereClause = 'WHERE u.rol = \'estudiante\'';
            
            if (tipo === 'activos') {
                whereClause += ' AND u.activo = true';
            } else if (tipo === 'inactivos') {
                whereClause += ' AND u.activo = false';
            }

            const estudiantesReporte = await pool.query(`
                SELECT 
                    u.dni,
                    u.nombre,
                    u.apellido_paterno,
                    u.apellido_materno,
                    u.email,
                    u.telefono,
                    u.activo,
                    e.direccion,
                    e.sexo,
                    e.fecha_nacimiento,
                    e.tipo_alumno,
                    COUNT(m.id) as total_matriculas,
                    MAX(m.fecha_matricula) as ultima_matricula
                FROM usuarios u
                INNER JOIN estudiantes e ON u.id = e.usuario_id
                LEFT JOIN matriculas m ON e.id = m.estudiante_id
                ${whereClause}
                GROUP BY u.dni, u.nombre, u.apellido_paterno, u.apellido_materno, 
                         u.email, u.telefono, u.activo, e.direccion, e.sexo, 
                         e.fecha_nacimiento, e.tipo_alumno
                ORDER BY u.nombre, u.apellido_paterno
            `);

            console.log('✅ Reporte de estudiantes generado por:', req.user.rol);

            res.json({
                success: true,
                estudiantes: estudiantesReporte.rows,
                total: estudiantesReporte.rows.length,
                tipo: tipo
            });

        } catch (error) {
            console.error('❌ Error generando reporte de estudiantes:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error del servidor' 
            });
        }
    }
);

module.exports = router;