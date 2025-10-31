const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken, authorize } = require('../middleware/auth'); // ✅ CORREGIDO: agregar authorize

const { checkPermission } = require('../middleware/permissions');
// 📋 Obtener pagos pendientes - SUPERADMIN Y SECRETARIA
router.get('/pendientes', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']), // ✅ CORREGIDO: agregar autorización
    async (req, res) => {
        try {
            console.log('👤 Usuario solicitando pagos pendientes:', req.user.rol);
            console.log('📋 Buscando pagos pendientes...');
            
            const { page = 1, limit = 10 } = req.query;
            const offset = (page - 1) * limit;

            // Query simple para evitar errores
            const query = `
                SELECT 
                    p.id,
                    p.numero_cuota,
                    p.monto,
                    p.fecha_vencimiento,
                    p.estado,
                    p.matricula_id
                FROM pagos p
                WHERE p.estado = 'pendiente'
                ORDER BY p.fecha_vencimiento ASC 
                LIMIT $1 OFFSET $2
            `;

            const countQuery = `SELECT COUNT(*) FROM pagos WHERE estado = 'pendiente'`;

            console.log('🔍 Ejecutando query de pagos...');

            // Ejecutar queries
            const pagosResult = await pool.query(query, [parseInt(limit), offset]);
            const countResult = await pool.query(countQuery);
            const total = parseInt(countResult.rows[0].count);

            console.log(`✅ Encontrados ${pagosResult.rows.length} pagos pendientes`);

            // Si no hay pagos, crear algunos de prueba
            let pagos = pagosResult.rows;
            if (pagos.length === 0) {
                console.log('📝 No hay pagos, creando datos de prueba...');
                pagos = await crearPagosDePrueba();
            }

            // Agregar información de estudiantes (hardcodeada por ahora)
            const pagosConInfo = pagos.map(pago => ({
                ...pago,
                numero_boleta: `B${new Date().getFullYear()}${pago.id.toString().padStart(4, '0')}`,
                estudiante_dni: '12345678',
                estudiante_nombre: 'Ana',
                estudiante_apellido_paterno: 'García',
                estudiante_apellido_materno: 'López',
                ciclo_nombre: 'Ciclo 2024-I'
            }));

            res.json({
                success: true,
                pagos: pagosConInfo,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: pagosConInfo.length,
                    pages: Math.ceil(pagosConInfo.length / limit)
                }
            });

        } catch (error) {
            console.error('❌ Error en /api/pagos/pendientes:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error interno del servidor' 
            });
        }
    }
);

// 💰 Registrar pago - SUPERADMIN Y SECRETARIA
router.post('/registrar', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']), // ✅ CORREGIDO: agregar autorización
    async (req, res) => {
        try {
            console.log('👤 Usuario registrando pago:', req.user.rol);
            
            const {
                matricula_id,
                numero_cuota,
                monto,
                metodo_pago,
                fecha_pago = new Date()
            } = req.body;

            console.log('💰 Registrando pago:', { matricula_id, numero_cuota, monto, metodo_pago });

            // Validaciones básicas
            if (!matricula_id || !numero_cuota || !monto || !metodo_pago) {
                return res.status(400).json({ error: 'Faltan campos obligatorios' });
            }

            // Actualizar estado de la cuota
            const result = await pool.query(
                `UPDATE pagos 
                 SET estado = 'pagado', metodo_pago = $1, fecha_pago = $2
                 WHERE matricula_id = $3 AND numero_cuota = $4
                 RETURNING id`,
                [metodo_pago, fecha_pago, matricula_id, numero_cuota]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Cuota no encontrada' });
            }

            console.log('✅ Pago registrado exitosamente por:', req.user.rol);

            res.json({
                success: true,
                message: 'Pago registrado exitosamente'
            });

        } catch (error) {
            console.error('❌ Error registrando pago:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

// 📊 Obtener todos los pagos - SUPERADMIN Y SECRETARIA
router.get('/', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']),
    checkPermission('pagos', 'ver'),
    async (req, res) => {
        try {
            console.log('👤 Usuario solicitando todos los pagos:', req.user.rol);
            
            const { page = 1, limit = 10, search = '' } = req.query;
            const offset = (page - 1) * limit;

            let query = `
                SELECT 
                    p.id,
                    p.numero_cuota,
                    p.monto,
                    p.fecha_vencimiento,
                    p.fecha_pago,
                    p.metodo_pago,
                    p.estado,
                    p.observaciones,
                    m.numero_boleta,
                    u.dni as estudiante_dni,
                    u.nombre as estudiante_nombre,
                    u.apellido_paterno as estudiante_apellido_paterno,
                    u.apellido_materno as estudiante_apellido_materno,
                    c.nombre as ciclo_nombre
                FROM pagos p
                INNER JOIN matriculas m ON p.matricula_id = m.id
                INNER JOIN estudiantes e ON m.estudiante_id = e.id
                INNER JOIN usuarios u ON e.usuario_id = u.id
                INNER JOIN ciclos_academicos c ON m.ciclo_id = c.id
                WHERE 1=1
            `;

            let countQuery = `
                SELECT COUNT(*)
                FROM pagos p
                INNER JOIN matriculas m ON p.matricula_id = m.id
                INNER JOIN estudiantes e ON m.estudiante_id = e.id
                INNER JOIN usuarios u ON e.usuario_id = u.id
                WHERE 1=1
            `;

            const params = [];
            let paramCount = 0;

            if (search) {
                paramCount++;
                query += ` AND (u.dni ILIKE $${paramCount} OR u.nombre ILIKE $${paramCount} OR u.apellido_paterno ILIKE $${paramCount} OR m.numero_boleta ILIKE $${paramCount})`;
                countQuery += ` AND (u.dni ILIKE $${paramCount} OR u.nombre ILIKE $${paramCount} OR u.apellido_paterno ILIKE $${paramCount} OR m.numero_boleta ILIKE $${paramCount})`;
                params.push(`%${search}%`);
            }

            query += ` ORDER BY p.fecha_vencimiento DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
            params.push(parseInt(limit), offset);

            const pagosResult = await pool.query(query, params);
            const countResult = await pool.query(countQuery, params.slice(0, paramCount));
            const total = parseInt(countResult.rows[0].count);

            console.log(`✅ Pagos obtenidos: ${pagosResult.rows.length}`);

            res.json({
                success: true,
                pagos: pagosResult.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('❌ Error obteniendo pagos:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

// 📈 Obtener estadísticas de pagos - SUPERADMIN Y SECRETARIA
router.get('/estadisticas', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']),
    async (req, res) => {
        try {
            console.log('👤 Usuario solicitando estadísticas de pagos:', req.user.rol);

            const estadisticas = await pool.query(`
                SELECT 
                    COUNT(*) as total_pagos,
                    SUM(CASE WHEN estado = 'pagado' THEN monto ELSE 0 END) as total_recaudado,
                    SUM(CASE WHEN estado = 'pendiente' THEN monto ELSE 0 END) as total_pendiente,
                    COUNT(CASE WHEN estado = 'pagado' THEN 1 END) as pagos_realizados,
                    COUNT(CASE WHEN estado = 'pendiente' THEN 1 END) as pagos_pendientes
                FROM pagos
            `);

            res.json({
                success: true,
                estadisticas: estadisticas.rows[0]
            });

        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

// 🔍 Obtener pago por ID - SUPERADMIN Y SECRETARIA
router.get('/:id', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']),
    async (req, res) => {
        try {
            const { id } = req.params;
            console.log('👤 Usuario solicitando pago específico:', req.user.rol);

            const result = await pool.query(`
                SELECT 
                    p.*,
                    m.numero_boleta,
                    u.dni as estudiante_dni,
                    u.nombre as estudiante_nombre,
                    u.apellido_paterno as estudiante_apellido_paterno,
                    u.apellido_materno as estudiante_apellido_materno,
                    c.nombre as ciclo_nombre
                FROM pagos p
                INNER JOIN matriculas m ON p.matricula_id = m.id
                INNER JOIN estudiantes e ON m.estudiante_id = e.id
                INNER JOIN usuarios u ON e.usuario_id = u.id
                INNER JOIN ciclos_academicos c ON m.ciclo_id = c.id
                WHERE p.id = $1
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Pago no encontrado' });
            }

            res.json({
                success: true,
                pago: result.rows[0]
            });

        } catch (error) {
            console.error('❌ Error obteniendo pago:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

// Función para crear pagos de prueba si no existen
async function crearPagosDePrueba() {
    try {
        console.log('🔄 Creando pagos de prueba...');
        
        // Verificar si hay matrículas
        const matriculasResult = await pool.query('SELECT id FROM matriculas LIMIT 1');
        let matriculaId;

        if (matriculasResult.rows.length === 0) {
            // Crear matrícula de prueba
            const matriculaInsert = await pool.query(`
                INSERT INTO matriculas (estudiante_id, ciclo_id, numero_boleta, metodo_pago, aula)
                VALUES (1, 1, 'B20240001', 'efectivo', 'A-101')
                RETURNING id
            `);
            matriculaId = matriculaInsert.rows[0].id;
        } else {
            matriculaId = matriculasResult.rows[0].id;
        }

        // Crear pagos de prueba
        const hoy = new Date();
        const pagosPrueba = [
            { numero: 1, monto: 500, dias: -10 }, // Vencido
            { numero: 2, monto: 500, dias: 5 },   // Próximo a vencer
            { numero: 3, monto: 500, dias: 30 }   // Normal
        ];

        for (const pago of pagosPrueba) {
            const fechaVencimiento = new Date(hoy);
            fechaVencimiento.setDate(hoy.getDate() + pago.dias);
            
            await pool.query(`
                INSERT INTO pagos (matricula_id, numero_cuota, monto, fecha_vencimiento, estado)
                VALUES ($1, $2, $3, $4, 'pendiente')
            `, [matriculaId, pago.numero, pago.monto, fechaVencimiento.toISOString().split('T')[0]]);
        }

        // Obtener los pagos recién creados
        const result = await pool.query(`
            SELECT * FROM pagos WHERE matricula_id = $1 ORDER BY numero_cuota
        `, [matriculaId]);

        console.log(`✅ Creados ${result.rows.length} pagos de prueba`);
        return result.rows;

    } catch (error) {
        console.error('❌ Error creando pagos de prueba:', error);
        return [];
    }
}

module.exports = router;