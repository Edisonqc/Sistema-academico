const pool = require('./database');

const createStudentData = async () => {
    try {
        console.log('📚 Creando datos académicos de prueba...');

        // Obtener el ID del estudiante
        const studentResult = await pool.query(`
            SELECT e.id as estudiante_id, u.id as usuario_id 
            FROM estudiantes e 
            INNER JOIN usuarios u ON e.usuario_id = u.id 
            WHERE u.dni = '12345678'
        `);

        if (studentResult.rows.length === 0) {
            console.log('❌ No se encontró el estudiante');
            return;
        }

        const estudianteId = studentResult.rows[0].estudiante_id;

        // Crear ciclo académico si no existe
        let cicloId;
        const cicloResult = await pool.query(`
            SELECT id FROM ciclos_academicos WHERE nombre = 'Ciclo 2024-I'
        `);

        if (cicloResult.rows.length === 0) {
            const newCiclo = await pool.query(`
                INSERT INTO ciclos_academicos (nombre, fecha_inicio, fecha_fin, estado)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `, ['Ciclo 2024-I', '2024-01-01', '2024-12-31', 'activo']);
            cicloId = newCiclo.rows[0].id;
        } else {
            cicloId = cicloResult.rows[0].id;
        }

        // Crear matrícula
        const matriculaResult = await pool.query(`
            INSERT INTO matriculas (estudiante_id, ciclo_id, numero_boleta, metodo_pago, aula, activa)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `, [estudianteId, cicloId, 'B2024001', 'efectivo', 'A-101', true]);

        const matriculaId = matriculaResult.rows[0].id;

        // Crear pagos de prueba
        const pagos = [
            { numero: 1, monto: 500, estado: 'pagado', dias: -30 },
            { numero: 2, monto: 500, estado: 'pagado', dias: -15 },
            { numero: 3, monto: 500, estado: 'pendiente', dias: 15 },
            { numero: 4, monto: 500, estado: 'pendiente', dias: 45 }
        ];

        for (const pago of pagos) {
            const fechaVencimiento = new Date();
            fechaVencimiento.setDate(fechaVencimiento.getDate() + pago.dias);
            
            const fechaPago = pago.estado === 'pagado' ? new Date() : null;

            await pool.query(`
                INSERT INTO pagos (matricula_id, numero_cuota, monto, estado, fecha_vencimiento, fecha_pago, metodo_pago)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [matriculaId, pago.numero, pago.monto, pago.estado, fechaVencimiento, fechaPago, 'efectivo']);
        }

        // Crear asistencias de prueba (últimos 7 días)
        for (let i = 0; i < 7; i++) {
            const fecha = new Date();
            fecha.setDate(fecha.getDate() - i);
            
            // 80% de probabilidad de asistencia
            if (Math.random() < 0.8) {
                const hora = `0${8 + Math.floor(Math.random() * 2)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}:00`;
                const tipos = ['manual', 'dni', 'qr'];
                const tipo = tipos[Math.floor(Math.random() * tipos.length)];

                await pool.query(`
                    INSERT INTO asistencias (estudiante_id, fecha, hora, tipo_registro)
                    VALUES ($1, $2, $3, $4)
                `, [estudianteId, fecha.toISOString().split('T')[0], hora, tipo]);
            }
        }

        console.log('✅ Datos académicos creados exitosamente:');
        console.log('   📝 1 matrícula creada');
        console.log('   💰 4 pagos creados (2 pagados, 2 pendientes)');
        console.log('   ✅ Asistencias de los últimos 7 días creadas');

    } catch (error) {
        console.error('❌ Error creando datos académicos:', error);
    }
};

if (require.main === module) {
    createStudentData().then(() => {
        console.log('✨ Proceso de datos completado');
        process.exit(0);
    });
}

module.exports = createStudentData;