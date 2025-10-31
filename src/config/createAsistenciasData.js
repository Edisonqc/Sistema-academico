const pool = require('./database');

const createAsistenciasData = async () => {
    try {
        console.log('🔄 Creando datos de prueba para asistencias...');

        // Verificar que existan estudiantes
        const estudiantesResult = await pool.query(`
            SELECT e.id, u.dni, u.nombre, u.apellido_paterno
            FROM estudiantes e
            INNER JOIN usuarios u ON e.usuario_id = u.id
            WHERE u.rol = 'estudiante' AND u.activo = true
            LIMIT 5
        `);

        if (estudiantesResult.rows.length === 0) {
            console.log('❌ No hay estudiantes para crear asistencias');
            return;
        }

        console.log(`✅ Encontrados ${estudiantesResult.rows.length} estudiantes`);

        // Crear asistencias de los últimos 7 días
        const hoy = new Date();
        const tiposRegistro = ['manual', 'dni', 'qr'];

        for (let i = 0; i < 7; i++) {
            const fecha = new Date(hoy);
            fecha.setDate(hoy.getDate() - i);
            const fechaStr = fecha.toISOString().split('T')[0];

            // Para cada estudiante, crear asistencia aleatoria (80% de probabilidad)
            for (const estudiante of estudiantesResult.rows) {
                if (Math.random() < 0.8) { // 80% de probabilidad de asistencia
                    const tipo = tiposRegistro[Math.floor(Math.random() * tiposRegistro.length)];
                    const hora = `${8 + Math.floor(Math.random() * 4)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}:00`;

                    // Verificar si ya existe
                    const existe = await pool.query(
                        'SELECT id FROM asistencias WHERE estudiante_id = $1 AND fecha = $2',
                        [estudiante.id, fechaStr]
                    );

                    if (existe.rows.length === 0) {
                        await pool.query(`
                            INSERT INTO asistencias (estudiante_id, fecha, hora, tipo_registro)
                            VALUES ($1, $2, $3, $4)
                        `, [estudiante.id, fechaStr, hora, tipo]);
                    }
                }
            }
        }

        console.log('✅ Datos de asistencias creados exitosamente');

    } catch (error) {
        console.error('❌ Error creando datos de asistencias:', error);
    }
};

if (require.main === module) {
    createAsistenciasData().then(() => {
        console.log('✨ Proceso completado');
        process.exit(0);
    });
}

module.exports = createAsistenciasData;