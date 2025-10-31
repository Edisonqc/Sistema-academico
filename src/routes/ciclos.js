const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken, authorize } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

// 📊 Obtener estadísticas de ciclos - PARA SUPERADMIN Y SECRETARIA
router.get('/estadisticas/generales', 
    verifyToken, 
    checkPermission('reportes', 'ver'),
    async (req, res) => {
        console.log('👤 Usuario solicitando estadísticas de ciclos:', req.user.rol);
        
        try {
            console.log('1. Verificando conexión a la base de datos...');
            
            // Estadísticas básicas
            const totalCiclosResult = await pool.query('SELECT COUNT(*) as total FROM ciclos_academicos');
            const ciclosActivosResult = await pool.query('SELECT COUNT(*) as activos FROM ciclos_academicos WHERE activo = true');

            const totalCiclos = parseInt(totalCiclosResult.rows[0].total) || 0;
            const ciclosActivos = parseInt(ciclosActivosResult.rows[0].activos) || 0;

            const estadisticas = {
                total_ciclos: totalCiclos,
                ciclos_activos: ciclosActivos,
                ciclos_inactivos: totalCiclos - ciclosActivos,
                ciclos_planificados: 0,
                total_matriculas_activas: 0,
                ingresos_totales: 0
            };

            console.log('✅ Estadísticas calculadas:', estadisticas);
            
            res.json({
                success: true,
                estadisticas: estadisticas
            });

        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error obteniendo estadísticas de ciclos' 
            });
        }
    }
);

// 📋 Obtener todos los ciclos académicos - SUPERADMIN Y SECRETARIA
router.get('/', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']),
    async (req, res) => {
        try {
            console.log('👤 Usuario solicitando ciclos:', req.user.rol);
            
            const { page = 1, limit = 10, search = '' } = req.query;
            const offset = (page - 1) * limit;

            let query = `
                SELECT id, nombre, fecha_inicio, fecha_fin, activo, descripcion
                FROM ciclos_academicos 
                WHERE 1=1
            `;
            
            let countQuery = `SELECT COUNT(*) FROM ciclos_academicos WHERE 1=1`;
            const params = [];
            let paramCount = 0;

            if (search) {
                paramCount++;
                query += ` AND (nombre ILIKE $${paramCount} OR descripcion ILIKE $${paramCount})`;
                countQuery += ` AND (nombre ILIKE $${paramCount} OR descripcion ILIKE $${paramCount})`;
                params.push(`%${search}%`);
            }

            query += ` ORDER BY fecha_inicio DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
            params.push(parseInt(limit), offset);

            const ciclosResult = await pool.query(query, params);
            const countResult = await pool.query(countQuery, params.slice(0, paramCount));
            const total = parseInt(countResult.rows[0].count);

            console.log('✅ Ciclos obtenidos:', ciclosResult.rows.length);

            res.json({
                success: true,
                ciclos: ciclosResult.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('❌ Error obteniendo ciclos:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error del servidor al obtener ciclos' 
            });
        }
    }
);

// 📅 Obtener ciclos activos - SUPERADMIN, SECRETARIA Y ESTUDIANTE
router.get('/activos', 
    verifyToken, 
    authorize(['superadmin', 'secretaria', 'estudiante']),
    async (req, res) => {
        try {
            console.log('👤 Usuario solicitando ciclos activos:', req.user.rol);
            
            const result = await pool.query(`
                SELECT * FROM ciclos_academicos 
                WHERE activo = true 
                ORDER BY fecha_inicio DESC
            `);

            res.json({
                success: true,
                ciclos: result.rows
            });

        } catch (error) {
            console.error('❌ Error obteniendo ciclos activos:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error del servidor al obtener ciclos activos' 
            });
        }
    }
);

// 🔍 Obtener ciclo por ID - SUPERADMIN Y SECRETARIA
router.get('/:id', 
    verifyToken, 
    authorize(['superadmin', 'secretaria']),
    async (req, res) => {
        try {
            const { id } = req.params;
            console.log('👤 Usuario solicitando ciclo específico:', req.user.rol);

            const result = await pool.query(`
                SELECT * FROM ciclos_academicos WHERE id = $1
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Ciclo académico no encontrado' 
                });
            }

            res.json({
                success: true,
                ciclo: result.rows[0]
            });

        } catch (error) {
            console.error('❌ Error obteniendo ciclo:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error del servidor al obtener ciclo' 
            });
        }
    }
);

// ➕ Crear nuevo ciclo académico - SOLO SUPERADMIN
router.post('/', 
    verifyToken, 
    authorize(['superadmin']),
    async (req, res) => {
        try {
            console.log('👤 Usuario creando ciclo:', req.user.rol);

            const {
                nombre,
                fecha_inicio,
                fecha_fin,
                activo = true,
                descripcion = '',
                precio = 0
            } = req.body;

            // Validaciones
            if (!nombre || !fecha_inicio || !fecha_fin) {
                return res.status(400).json({ 
                    success: false,
                    error: 'Faltan campos obligatorios: nombre, fecha_inicio, fecha_fin' 
                });
            }

            // Verificar si ya existe un ciclo con el mismo nombre
            const cicloExistente = await pool.query(
                'SELECT id FROM ciclos_academicos WHERE nombre = $1',
                [nombre]
            );

            if (cicloExistente.rows.length > 0) {
                return res.status(400).json({ 
                    success: false,
                    error: 'Ya existe un ciclo académico con ese nombre' 
                });
            }

            // Crear el ciclo
            const result = await pool.query(
                `INSERT INTO ciclos_academicos (nombre, fecha_inicio, fecha_fin, activo, descripcion, precio)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
                [nombre, fecha_inicio, fecha_fin, activo, descripcion, precio]
            );

            console.log('✅ Ciclo creado exitosamente por:', req.user.rol);

            res.status(201).json({
                success: true,
                message: 'Ciclo académico creado exitosamente',
                ciclo: result.rows[0]
            });

        } catch (error) {
            console.error('❌ Error creando ciclo:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error del servidor al crear ciclo' 
            });
        }
    }
);

// ✏️ Actualizar ciclo académico - SOLO SUPERADMIN
router.put('/:id', 
    verifyToken, 
    authorize(['superadmin']),
    async (req, res) => {
        try {
            const { id } = req.params;
            console.log('👤 Usuario actualizando ciclo:', req.user.rol);

            const {
                nombre,
                fecha_inicio,
                fecha_fin,
                activo,
                descripcion,
                precio
            } = req.body;

            // Verificar que el ciclo existe
            const cicloExistente = await pool.query(
                'SELECT id, nombre FROM ciclos_academicos WHERE id = $1',
                [id]
            );

            if (cicloExistente.rows.length === 0) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Ciclo académico no encontrado' 
                });
            }

            // Verificar nombre duplicado (excluyendo el ciclo actual)
            if (nombre && nombre !== cicloExistente.rows[0].nombre) {
                const nombreExistente = await pool.query(
                    'SELECT id FROM ciclos_academicos WHERE nombre = $1 AND id != $2',
                    [nombre, id]
                );

                if (nombreExistente.rows.length > 0) {
                    return res.status(400).json({ 
                        success: false,
                        error: 'Ya existe un ciclo académico con ese nombre' 
                    });
                }
            }

            // Construir query dinámica para actualización
            const updates = [];
            const params = [];
            let paramCount = 0;

            if (nombre !== undefined) {
                paramCount++;
                updates.push(`nombre = $${paramCount}`);
                params.push(nombre);
            }

            if (fecha_inicio !== undefined) {
                paramCount++;
                updates.push(`fecha_inicio = $${paramCount}`);
                params.push(fecha_inicio);
            }

            if (fecha_fin !== undefined) {
                paramCount++;
                updates.push(`fecha_fin = $${paramCount}`);
                params.push(fecha_fin);
            }

            if (activo !== undefined) {
                paramCount++;
                updates.push(`activo = $${paramCount}`);
                params.push(activo);
            }

            if (descripcion !== undefined) {
                paramCount++;
                updates.push(`descripcion = $${paramCount}`);
                params.push(descripcion);
            }

            if (precio !== undefined) {
                paramCount++;
                updates.push(`precio = $${paramCount}`);
                params.push(precio);
            }

            if (updates.length === 0) {
                return res.status(400).json({ 
                    success: false,
                    error: 'No hay campos para actualizar' 
                });
            }

            paramCount++;
            params.push(id);

            const query = `UPDATE ciclos_academicos SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
            const result = await pool.query(query, params);

            console.log('✅ Ciclo actualizado exitosamente por:', req.user.rol);

            res.json({
                success: true,
                message: 'Ciclo académico actualizado exitosamente',
                ciclo: result.rows[0]
            });

        } catch (error) {
            console.error('❌ Error actualizando ciclo:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error del servidor al actualizar ciclo'
            });
        }
    }
);

// ❌ Eliminar ciclo académico - SOLO SUPERADMIN
router.delete('/:id', 
    verifyToken, 
    authorize(['superadmin']),
    async (req, res) => {
        try {
            const { id } = req.params;
            console.log('👤 Usuario eliminando ciclo:', req.user.rol);

            // Verificar que el ciclo existe
            const cicloExistente = await pool.query(
                'SELECT id FROM ciclos_academicos WHERE id = $1',
                [id]
            );

            if (cicloExistente.rows.length === 0) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Ciclo académico no encontrado' 
                });
            }

            // Verificar si hay matrículas asociadas
            const matriculasAsociadas = await pool.query(
                'SELECT COUNT(*) FROM matriculas WHERE ciclo_id = $1',
                [id]
            );

            const totalMatriculas = parseInt(matriculasAsociadas.rows[0].count);
            if (totalMatriculas > 0) {
                return res.status(400).json({ 
                    success: false,
                    error: `No se puede eliminar el ciclo porque tiene ${totalMatriculas} matrícula(s) asociada(s)`
                });
            }

            // Eliminar el ciclo
            await pool.query('DELETE FROM ciclos_academicos WHERE id = $1', [id]);

            console.log('✅ Ciclo eliminado exitosamente por:', req.user.rol);

            res.json({
                success: true,
                message: 'Ciclo académico eliminado exitosamente'
            });

        } catch (error) {
            console.error('❌ Error eliminando ciclo:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error del servidor al eliminar ciclo' 
            });
        }
    }
);

// 📋 Obtener ciclos para select - SUPERADMIN, SECRETARIA Y ESTUDIANTE
router.get('/select/activos', 
    verifyToken, 
    authorize(['superadmin', 'secretaria', 'estudiante']),
    async (req, res) => {
        try {
            console.log('👤 Usuario solicitando ciclos para select:', req.user.rol);
            
            const result = await pool.query(`
                SELECT id, nombre, precio 
                FROM ciclos_academicos 
                WHERE activo = true 
                ORDER BY fecha_inicio DESC
            `);

            res.json({
                success: true,
                ciclos: result.rows
            });

        } catch (error) {
            console.error('❌ Error obteniendo ciclos para select:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error del servidor al obtener ciclos' 
            });
        }
    }
);

// 🔄 Cambiar estado de ciclo - SOLO SUPERADMIN
router.patch('/:id/estado', 
    verifyToken, 
    authorize(['superadmin']),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { activo } = req.body;
            
            console.log('👤 Usuario cambiando estado de ciclo:', req.user.rol);

            // Verificar que el ciclo existe
            const cicloExistente = await pool.query(
                'SELECT id FROM ciclos_academicos WHERE id = $1',
                [id]
            );

            if (cicloExistente.rows.length === 0) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Ciclo académico no encontrado' 
                });
            }

            // Actualizar estado (activo/inactivo)
            const result = await pool.query(
                'UPDATE ciclos_academicos SET activo = $1 WHERE id = $2 RETURNING *',
                [activo, id]
            );

            console.log('✅ Estado del ciclo actualizado por:', req.user.rol);

            res.json({
                success: true,
                message: `Estado del ciclo actualizado a ${activo ? 'activo' : 'inactivo'}`,
                ciclo: result.rows[0]
            });

        } catch (error) {
            console.error('❌ Error cambiando estado del ciclo:', error);
            res.status(500).json({ 
                success: false,
                error: 'Error del servidor al cambiar estado del ciclo' 
            });
        }
    }
);

module.exports = router;