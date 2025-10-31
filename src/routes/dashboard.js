const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');

// Ruta para estadísticas del dashboard
// Ruta para estadísticas del dashboard - DATOS COMPLETOS PARA TODOS
router.get('/estadisticas', verifyToken, async (req, res) => {
    try {
        const userRole = req.user.rol;
        
        console.log('📊 Solicitando estadísticas COMPLETAS para rol:', userRole);

        // ✅ CONSULTAS COMPLETAS (siempre las mismas para todos)
        const estudiantesResult = await pool.query('SELECT COUNT(*) FROM estudiantes');
        const matriculasResult = await pool.query('SELECT COUNT(*) FROM matriculas WHERE estado = $1', ['activo']);
        const pagosPendientesResult = await pool.query('SELECT COUNT(*) FROM pagos WHERE estado = $1', ['pendiente']);
        const pagosHoyResult = await pool.query(`SELECT COUNT(*) FROM pagos WHERE estado = 'pagado' AND DATE(fecha_pago) = CURRENT_DATE`);
        const usuariosResult = await pool.query('SELECT COUNT(*) FROM usuarios');
        const adminsResult = await pool.query('SELECT COUNT(*) FROM usuarios WHERE rol = $1', ['superadmin']);
        const secretariasResult = await pool.query('SELECT COUNT(*) FROM usuarios WHERE rol = $1', ['secretaria']);
        const ingresosResult = await pool.query(`SELECT COALESCE(SUM(monto), 0) as total FROM pagos WHERE estado = 'pagado' AND DATE_TRUNC('month', fecha_pago) = DATE_TRUNC('month', CURRENT_DATE)`);

        // ✅ SIEMPRE devolver TODOS los datos
        const estadisticas = {
            total_usuarios: parseInt(usuariosResult.rows[0].count),
            total_estudiantes: parseInt(estudiantesResult.rows[0].count),
            total_matriculas: parseInt(matriculasResult.rows[0].count),
            total_administradores: parseInt(adminsResult.rows[0].count),
            total_secretarias: parseInt(secretariasResult.rows[0].count),
            pagos_pendientes: parseInt(pagosPendientesResult.rows[0].count),
            pagos_hoy: parseInt(pagosHoyResult.rows[0].count),
            ingresos_mes: parseFloat(ingresosResult.rows[0].total),
            asistencias_hoy: 6,  // Valor de ejemplo
            nuevos_estudiantes: 5 // Valor de ejemplo
        };

        res.json({
            success: true,
            estadisticas: estadisticas,
            userRole: userRole
        });

    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error del servidor al obtener estadísticas' 
        });
    }
});

module.exports = router;