const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken, authorize } = require('../middleware/auth'); // ✅ CORREGIDO: agregar authorize
const { checkPermission } = require('../middleware/permissions');

// 📋 Obtener todas las matrículas - SUPERADMIN Y SECRETARIA
router.get('/', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']), // ✅ CORREGIDO: agregar autorización
    checkPermission('matriculas', 'ver'),
    async (req, res) => {
        try {
            console.log('👤 Usuario solicitando matrículas:', req.user.rol);
            
            const { page = 1, limit = 10, search = '', estudiante_id } = req.query;
            const offset = (page - 1) * limit;

            let query = `
                SELECT 
                    m.id,
                    m.numero_boleta,
                    m.metodo_pago,
                    m.descuento,
                    m.aula,
                    m.estado,
                    m.fecha_matricula,
                    m.matriculado_por,
                    e.id as estudiante_id,
                    u.dni as estudiante_dni,
                    u.nombre as estudiante_nombre,
                    u.apellido_paterno as estudiante_apellido_paterno,
                    u.apellido_materno as estudiante_apellido_materno,
                    c.nombre as ciclo_nombre,
                    c.precio as ciclo_precio,
                    COUNT(p.id) as total_cuotas,
                    SUM(CASE WHEN p.estado = 'pagado' THEN p.monto ELSE 0 END) as total_pagado
                FROM matriculas m
                INNER JOIN estudiantes e ON m.estudiante_id = e.id
                INNER JOIN usuarios u ON e.usuario_id = u.id
                INNER JOIN ciclos_academicos c ON m.ciclo_id = c.id
                LEFT JOIN pagos p ON m.id = p.matricula_id
                WHERE 1=1
            `;

            let countQuery = `
                SELECT COUNT(DISTINCT m.id)
                FROM matriculas m
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

            // Filtro por estudiante_id
            if (estudiante_id) {
                paramCount++;
                query += ` AND m.estudiante_id = $${paramCount}`;
                countQuery += ` AND m.estudiante_id = $${paramCount}`;
                params.push(estudiante_id);
            }

            query += ` 
                GROUP BY m.id, e.id, u.dni, u.nombre, u.apellido_paterno, u.apellido_materno, c.nombre, c.precio
                ORDER BY m.fecha_matricula DESC 
                LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
            `;
            params.push(parseInt(limit), offset);

            const matriculasResult = await pool.query(query, params);
            const countResult = await pool.query(countQuery, params.slice(0, paramCount));
            const total = parseInt(countResult.rows[0].count);

            console.log(`✅ Matrículas obtenidas: ${matriculasResult.rows.length}`);

            res.json({
                success: true,
                matriculas: matriculasResult.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('❌ Error obteniendo matrículas:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
);

// 🔍 Verificar si existe matrícula para un estudiante - SUPERADMIN Y SECRETARIA
router.get('/verificar', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']), // ✅ CORREGIDO: agregar autorización
    async (req, res) => {
        try {
            const { estudiante_id, ciclo_id } = req.query;

            if (!estudiante_id) {
                return res.status(400).json({ 
                    success: false,
                    error: 'El ID del estudiante es requerido' 
                });
            }

            let query = `
                SELECT 
                    m.*,
                    e.id as estudiante_id,
                    u.dni as estudiante_dni,
                    u.nombre as estudiante_nombre,
                    u.apellido_paterno as estudiante_apellido_paterno,
                    u.apellido_materno as estudiante_apellido_materno,
                    c.nombre as ciclo_nombre,
                    c.precio as ciclo_precio
                FROM matriculas m
                INNER JOIN estudiantes e ON m.estudiante_id = e.id
                INNER JOIN usuarios u ON e.usuario_id = u.id
                INNER JOIN ciclos_academicos c ON m.ciclo_id = c.id
                WHERE m.estudiante_id = $1
            `;

            const params = [estudiante_id];

            // Si se proporciona ciclo_id, buscar específicamente en ese ciclo
            if (ciclo_id) {
                query += ' AND m.ciclo_id = $2';
                params.push(ciclo_id);
            }

            // Ordenar por la más reciente primero
            query += ' ORDER BY m.fecha_matricula DESC LIMIT 1';

            const result = await pool.query(query, params);

            if (result.rows.length === 0) {
                return res.json({
                    success: true,
                    existe: false,
                    activa: false,
                    mensaje: 'No existe matrícula para este estudiante'
                });
            }

            const matricula = result.rows[0];
            
            // Considerar activa si el estado es 'activo'
            const estaActiva = matricula.estado === 'activo';

            return res.json({
                success: true,
                existe: true,
                activa: estaActiva,
                matricula: {
                    id: matricula.id,
                    estudiante_id: matricula.estudiante_id,
                    ciclo_id: matricula.ciclo_id,
                    numero_boleta: matricula.numero_boleta,
                    fecha_matricula: matricula.fecha_matricula,
                    metodo_pago: matricula.metodo_pago,
                    descuento: matricula.descuento,
                    aula: matricula.aula,
                    estado: matricula.estado,
                    estudiante_nombre: matricula.estudiante_nombre,
                    estudiante_apellido_paterno: matricula.estudiante_apellido_paterno,
                    estudiante_apellido_materno: matricula.estudiante_apellido_materno,
                    estudiante_dni: matricula.estudiante_dni,
                    ciclo_nombre: matricula.ciclo_nombre,
                    ciclo_precio: matricula.ciclo_precio
                }
            });

        } catch (error) {
            console.error('❌ Error verificando matrícula:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error del servidor al verificar matrícula' 
            });
        }
    }
);

// 🧩 Crear nueva matrícula - SUPERADMIN Y SECRETARIA
router.post('/', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']), // ✅ CORREGIDO: agregar autorización
    async (req, res) => {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            console.log('👤 Usuario creando matrícula:', req.user.rol);

            const {
                estudiante_id,
                ciclo_id,
                numero_boleta,
                metodo_pago,
                descuento = 0,
                aula,
                cuotas = []
            } = req.body;

            // Validaciones básicas
            if (!estudiante_id || !ciclo_id || !numero_boleta || !metodo_pago) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    success: false,
                    error: 'Faltan campos obligatorios: estudiante_id, ciclo_id, numero_boleta, metodo_pago' 
                });
            }

            // 🔴 VERIFICACIÓN MEJORADA - Buscar CUALQUIER matrícula en el mismo ciclo
            const matriculaExistente = await client.query(
                `SELECT m.id, m.estado, m.fecha_matricula, m.numero_boleta,
                        u.dni, u.nombre, u.apellido_paterno, u.apellido_materno,
                        c.nombre as ciclo_nombre
                 FROM matriculas m
                 INNER JOIN estudiantes e ON m.estudiante_id = e.id
                 INNER JOIN usuarios u ON e.usuario_id = u.id
                 INNER JOIN ciclos_academicos c ON m.ciclo_id = c.id
                 WHERE m.estudiante_id = $1 AND m.ciclo_id = $2
                 ORDER BY m.fecha_matricula DESC 
                 LIMIT 1`,
                [estudiante_id, ciclo_id]
            );

            if (matriculaExistente.rows.length > 0) {
                const matricula = matriculaExistente.rows[0];
                await client.query('ROLLBACK');
                
                // Mensaje más claro y específico
                const mensajeError = `El estudiante ${matricula.nombre} ${matricula.apellido_paterno} (DNI: ${matricula.dni}) ya está matriculado en el ciclo ${matricula.ciclo_nombre}. No se permiten múltiples matrículas en el mismo ciclo.`;
                
                return res.status(400).json({ 
                    success: false,
                    error: mensajeError,
                    detalles: {
                        matricula_existente: {
                            id: matricula.id,
                            numero_boleta: matricula.numero_boleta,
                            estado: matricula.estado,
                            fecha_matricula: matricula.fecha_matricula,
                            ciclo: matricula.ciclo_nombre
                        }
                    }
                });
            }

            // Verificar si la boleta ya existe
            const boletaExists = await client.query(
                'SELECT id, numero_boleta FROM matriculas WHERE numero_boleta = $1',
                [numero_boleta]
            );

            if (boletaExists.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    success: false,
                    error: `El número de boleta ${boletaExists.rows[0].numero_boleta} ya está en uso. Por favor genere un nuevo número.` 
                });
            }

            // Obtener información del ciclo
            const cicloResult = await client.query(
                'SELECT precio, nombre FROM ciclos_academicos WHERE id = $1',
                [ciclo_id]
            );

            if (cicloResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    success: false,
                    error: 'Ciclo académico no encontrado' 
                });
            }

            const precioCiclo = parseFloat(cicloResult.rows[0].precio);
            const nombreCiclo = cicloResult.rows[0].nombre;
            const precioFinal = precioCiclo - (precioCiclo * (descuento / 100));

            // Obtener información del estudiante para el mensaje de éxito
            const estudianteResult = await client.query(
                `SELECT u.dni, u.nombre, u.apellido_paterno, u.apellido_materno
                 FROM estudiantes e
                 INNER JOIN usuarios u ON e.usuario_id = u.id
                 WHERE e.id = $1`,
                [estudiante_id]
            );

            if (estudianteResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    success: false,
                    error: 'Estudiante no encontrado' 
                });
            }

            const estudiante = estudianteResult.rows[0];

            // Crear matrícula
            const matriculaResult = await client.query(
                `INSERT INTO matriculas (estudiante_id, ciclo_id, numero_boleta, metodo_pago, descuento, aula, matriculado_por, estado)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'activo')
                 RETURNING id`,
                [estudiante_id, ciclo_id, numero_boleta, metodo_pago, descuento, aula, req.user.id]
            );

            const matriculaId = matriculaResult.rows[0].id;

            // Crear cuotas de pago
            if (cuotas.length > 0) {
                for (const cuota of cuotas) {
                    await client.query(
                        `INSERT INTO pagos (matricula_id, numero_cuota, monto, fecha_vencimiento, estado)
                         VALUES ($1, $2, $3, $4, 'pendiente')`,
                        [matriculaId, cuota.numero, cuota.monto, cuota.fecha_vencimiento]
                    );
                }
            }

            await client.query('COMMIT');

            // Obtener datos completos de la matrícula
            const matriculaCompleta = await pool.query(`
                SELECT 
                    m.*,
                    e.id as estudiante_id,
                    u.dni as estudiante_dni,
                    u.nombre as estudiante_nombre,
                    u.apellido_paterno as estudiante_apellido_paterno,
                    u.apellido_materno as estudiante_apellido_materno,
                    c.nombre as ciclo_nombre,
                    c.precio as ciclo_precio
                FROM matriculas m
                INNER JOIN estudiantes e ON m.estudiante_id = e.id
                INNER JOIN usuarios u ON e.usuario_id = u.id
                INNER JOIN ciclos_academicos c ON m.ciclo_id = c.id
                WHERE m.id = $1
            `, [matriculaId]);

            console.log('✅ Matrícula creada exitosamente por:', req.user.rol);

            res.status(201).json({
                success: true,
                message: `Matrícula exitosa: ${estudiante.nombre} ${estudiante.apellido_paterno} matriculado en ${nombreCiclo}`,
                matricula: matriculaCompleta.rows[0]
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Error creando matrícula:', error);
            
            // Manejar error de violación de índice único (si existe el índice)
            if (error.code === '23505') {
                return res.status(400).json({ 
                    success: false,
                    error: 'El estudiante ya está matriculado en este ciclo académico. No se permiten múltiples matrículas.'
                });
            }
            
            // Para cualquier otro error, mostrar mensaje genérico pero más amigable
            res.status(500).json({ 
                success: false,
                error: 'No se pudo completar la matrícula. Por favor, intente nuevamente.' 
            });
        } finally {
            client.release();
        }
    }
);

// 🔍 Obtener matrícula por ID - SUPERADMIN Y SECRETARIA
router.get('/:id', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']), // ✅ CORREGIDO: agregar autorización
    async (req, res) => {
        try {
            const { id } = req.params;
            console.log('👤 Usuario solicitando matrícula específica:', req.user.rol);

            const matriculaResult = await pool.query(`
                SELECT 
                    m.*,
                    e.id as estudiante_id,
                    u.dni as estudiante_dni,
                    u.nombre as estudiante_nombre,
                    u.apellido_paterno as estudiante_apellido_paterno,
                    u.apellido_materno as estudiante_apellido_materno,
                    u.email as estudiante_email,
                    u.telefono as estudiante_telefono,
                    c.nombre as ciclo_nombre,
                    c.descripcion as ciclo_descripcion,
                    c.precio as ciclo_precio,
                    c.fecha_inicio as ciclo_fecha_inicio,
                    c.fecha_fin as ciclo_fecha_fin
                FROM matriculas m
                INNER JOIN estudiantes e ON m.estudiante_id = e.id
                INNER JOIN usuarios u ON e.usuario_id = u.id
                INNER JOIN ciclos_academicos c ON m.ciclo_id = c.id
                WHERE m.id = $1
            `, [id]);

            if (matriculaResult.rows.length === 0) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Matrícula no encontrada' 
                });
            }

            // Obtener cuotas de pago
            const cuotasResult = await pool.query(`
                SELECT * FROM pagos 
                WHERE matricula_id = $1 
                ORDER BY numero_cuota
            `, [id]);

            res.json({
                success: true,
                matricula: matriculaResult.rows[0],
                cuotas: cuotasResult.rows
            });

        } catch (error) {
            console.error('❌ Error obteniendo matrícula:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error del servidor al obtener matrícula' 
            });
        }
    }
);

// 💰 Obtener pagos de una matrícula - SUPERADMIN Y SECRETARIA
router.get('/:id/pagos', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']), // ✅ CORREGIDO: agregar autorización
    async (req, res) => {
        try {
            const { id } = req.params;
            console.log('👤 Usuario solicitando pagos de matrícula:', req.user.rol);

            // Verificar que la matrícula existe
            const matriculaResult = await pool.query(`
                SELECT 
                    m.*,
                    e.id as estudiante_id,
                    u.dni as estudiante_dni,
                    u.nombre as estudiante_nombre,
                    u.apellido_paterno as estudiante_apellido_paterno,
                    c.nombre as ciclo_nombre,
                    c.precio as ciclo_precio
                FROM matriculas m
                INNER JOIN estudiantes e ON m.estudiante_id = e.id
                INNER JOIN usuarios u ON e.usuario_id = u.id
                INNER JOIN ciclos_academicos c ON m.ciclo_id = c.id
                WHERE m.id = $1
            `, [id]);

            if (matriculaResult.rows.length === 0) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Matrícula no encontrada' 
                });
            }

            // Obtener pagos
            const pagosResult = await pool.query(`
                SELECT * FROM pagos 
                WHERE matricula_id = $1 
                ORDER BY fecha_vencimiento
            `, [id]);

            res.json({
                success: true,
                matricula: matriculaResult.rows[0],
                pagos: pagosResult.rows
            });

        } catch (error) {
            console.error('❌ Error obteniendo pagos:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error del servidor al obtener pagos' 
            });
        }
    }
);

// 💳 Registrar nuevo pago - SUPERADMIN Y SECRETARIA
router.post('/:id/pagos', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']), // ✅ CORREGIDO: agregar autorización
    async (req, res) => {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const { id } = req.params;
            const {
                monto,
                fecha_pago,
                metodo_pago,
                observaciones = '',
                numero_cuota = null
            } = req.body;

            console.log('👤 Usuario registrando pago:', req.user.rol);

            // Validaciones
            if (!monto || !fecha_pago || !metodo_pago) {
                return res.status(400).json({ 
                    success: false,
                    error: 'Faltan campos obligatorios: monto, fecha_pago, metodo_pago' 
                });
            }

            // Verificar que la matrícula existe
            const matriculaResult = await client.query(
                'SELECT id FROM matriculas WHERE id = $1',
                [id]
            );

            if (matriculaResult.rows.length === 0) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Matrícula no encontrada' 
                });
            }

            // Si se especifica número de cuota, actualizar el estado de esa cuota
            if (numero_cuota !== null) {
                await client.query(
                    `UPDATE pagos SET estado = 'pagado', fecha_pago = $1 
                     WHERE matricula_id = $2 AND numero_cuota = $3`,
                    [fecha_pago, id, numero_cuota]
                );
            }

            // Registrar el pago
            const pagoResult = await client.query(
                `INSERT INTO pagos (matricula_id, numero_cuota, monto, fecha_pago, metodo_pago, observaciones, estado)
                 VALUES ($1, $2, $3, $4, $5, $6, 'pagado')
                 RETURNING id`,
                [id, numero_cuota, monto, fecha_pago, metodo_pago, observaciones]
            );

            await client.query('COMMIT');

            console.log('✅ Pago registrado exitosamente por:', req.user.rol);

            res.status(201).json({
                success: true,
                message: 'Pago registrado exitosamente',
                pago: {
                    id: pagoResult.rows[0].id,
                    matricula_id: id,
                    numero_cuota,
                    monto,
                    fecha_pago,
                    metodo_pago,
                    observaciones,
                    estado: 'pagado'
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Error registrando pago:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error del servidor al registrar pago' 
            });
        } finally {
            client.release();
        }
    }
);

// ✏️ Actualizar matrícula - SUPERADMIN Y SECRETARIA
router.put('/:id', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']), // ✅ CORREGIDO: agregar autorización
    async (req, res) => {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const { id } = req.params;
            const {
                metodo_pago,
                descuento,
                aula,
                estado
            } = req.body;

            console.log('👤 Usuario actualizando matrícula:', req.user.rol);

            // Verificar que la matrícula existe
            const matriculaExistente = await client.query(
                'SELECT id FROM matriculas WHERE id = $1',
                [id]
            );

            if (matriculaExistente.rows.length === 0) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Matrícula no encontrada' 
                });
            }

            // Construir query dinámica para actualización
            const updates = [];
            const params = [];
            let paramCount = 0;

            if (metodo_pago !== undefined) {
                paramCount++;
                updates.push(`metodo_pago = $${paramCount}`);
                params.push(metodo_pago);
            }

            if (descuento !== undefined) {
                paramCount++;
                updates.push(`descuento = $${paramCount}`);
                params.push(descuento);
            }

            if (aula !== undefined) {
                paramCount++;
                updates.push(`aula = $${paramCount}`);
                params.push(aula);
            }

            if (estado !== undefined) {
                paramCount++;
                updates.push(`estado = $${paramCount}`);
                params.push(estado);
            }

            if (updates.length === 0) {
                return res.status(400).json({ 
                    success: false,
                    error: 'No hay campos para actualizar' 
                });
            }

            paramCount++;
            updates.push(`actualizado_en = NOW()`);
            params.push(id);

            const query = `UPDATE matriculas SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

            const result = await client.query(query, params);

            await client.query('COMMIT');

            console.log('✅ Matrícula actualizada exitosamente por:', req.user.rol);

            res.json({
                success: true,
                message: 'Matrícula actualizada exitosamente',
                matricula: result.rows[0]
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Error actualizando matrícula:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error del servidor al actualizar matrícula' 
            });
        } finally {
            client.release();
        }
    }
);

// 🎫 Generar número de boleta automático - SUPERADMIN Y SECRETARIA
router.get('/generar/boleta', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']), // ✅ CORREGIDO: agregar autorización
    async (req, res) => {
        try {
            console.log('👤 Usuario generando boleta:', req.user.rol);

            const year = new Date().getFullYear();
            const result = await pool.query(
                `SELECT COUNT(*) as total FROM matriculas WHERE EXTRACT(YEAR FROM fecha_matricula) = $1`,
                [year]
            );
            
            const totalMatriculas = parseInt(result.rows[0].total) + 1;
            const numeroBoleta = `B${year}${totalMatriculas.toString().padStart(5, '0')}`;
            
            res.json({
                success: true,
                numero_boleta: numeroBoleta
            });

        } catch (error) {
            console.error('❌ Error generando boleta:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error del servidor al generar boleta' 
            });
        }
    }
);

module.exports = router;