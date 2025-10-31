const pool = require('./database');

const createTestData = async () => {
    try {
        console.log('🔄 Creando datos de prueba para pagos...');

        // 1. Verificar que existan matrículas
        const matriculasResult = await pool.query('SELECT id FROM matriculas LIMIT 1');
        
        if (matriculasResult.rows.length === 0) {
            console.log('❌ No hay matrículas. Creando matrícula de prueba...');
            
            // Crear una matrícula de prueba
            // Primero obtener un estudiante
            const estudianteResult = await pool.query(`
                SELECT e.id as estudiante_id, u.id as usuario_id 
                FROM estudiantes e 
                INNER JOIN usuarios u ON e.usuario_id = u.id 
                WHERE u.rol = 'estudiante' 
                LIMIT 1
            `);
            
            if (estudianteResult.rows.length === 0) {
                console.log('❌ No hay estudiantes. Creando estudiante de prueba...');
                
                // Crear usuario estudiante
                const bcrypt = require('bcryptjs');
                const hashedPassword = await bcrypt.hash('12345678', 10);
                
                const usuarioResult = await pool.query(`
                    INSERT INTO usuarios (dni, password, rol, nombre, apellido_paterno, debe_cambiar_password)
                    VALUES ($1, $2, 'estudiante', 'Ana', 'García', false)
                    RETURNING id
                `, ['12345678', hashedPassword]);
                
                const usuarioId = usuarioResult.rows[0].id;
                
                // Crear estudiante
                await pool.query(`
                    INSERT INTO estudiantes (usuario_id, tipo_alumno)
                    VALUES ($1, 'full')
                `, [usuarioId]);
                
                console.log('✅ Estudiante de prueba creado');
            }

            // Obtener ciclo académico
            const cicloResult = await pool.query('SELECT id FROM ciclos_academicos LIMIT 1');
            let cicloId;
            
            if (cicloResult.rows.length === 0) {
                console.log('❌ No hay ciclos académicos. Creando ciclo de prueba...');
                const cicloInsert = await pool.query(`
                    INSERT INTO ciclos_academicos (nombre, descripcion, precio, fecha_inicio, fecha_fin, duracion_semanas, activo)
                    VALUES ('Ciclo 2024-I', 'Ciclo de prueba', 1500.00, '2024-01-01', '2024-06-30', 24, true)
                    RETURNING id
                `);
                cicloId = cicloInsert.rows[0].id;
            } else {
                cicloId = cicloResult.rows[0].id;
            }

            // Obtener estudiante
            const estudianteFinal = await pool.query(`
                SELECT e.id as estudiante_id 
                FROM estudiantes e 
                INNER JOIN usuarios u ON e.usuario_id = u.id 
                WHERE u.rol = 'estudiante' 
                LIMIT 1
            `);
            
            const estudianteId = estudianteFinal.rows[0].estudiante_id;

            // Crear matrícula
            const matriculaResult = await pool.query(`
                INSERT INTO matriculas (estudiante_id, ciclo_id, numero_boleta, metodo_pago, aula, matriculado_por)
                VALUES ($1, $2, 'B202400001', 'efectivo', 'A-101', 1)
                RETURNING id
            `, [estudianteId, cicloId]);

            const matriculaId = matriculaResult.rows[0].id;
            console.log('✅ Matrícula de prueba creada:', matriculaId);

            // Crear pagos de prueba
            const hoy = new Date();
            const pagos = [
                { numero: 1, monto: 500, dias: -10 }, // Vencido
                { numero: 2, monto: 500, dias: 5 },   // Próximo a vencer
                { numero: 3, monto: 500, dias: 30 }   // Normal
            ];

            for (const pago of pagos) {
                const fechaVencimiento = new Date(hoy);
                fechaVencimiento.setDate(hoy.getDate() + pago.dias);
                
                await pool.query(`
                    INSERT INTO pagos (matricula_id, numero_cuota, monto, fecha_vencimiento, estado)
                    VALUES ($1, $2, $3, $4, 'pendiente')
                `, [matriculaId, pago.numero, pago.monto, fechaVencimiento.toISOString().split('T')[0]]);
            }

            console.log('✅ Pagos de prueba creados');
        } else {
            console.log('✅ Ya existen matrículas en la base de datos');
            
            // Verificar si hay pagos
            const pagosResult = await pool.query('SELECT id FROM pagos LIMIT 1');
            if (pagosResult.rows.length === 0) {
                console.log('❌ No hay pagos. Creando pagos de prueba...');
                
                const matriculaId = matriculasResult.rows[0].id;
                const hoy = new Date();
                
                const pagos = [
                    { numero: 1, monto: 500, dias: -10, estado: 'pendiente' },
                    { numero: 2, monto: 500, dias: 5, estado: 'pendiente' },
                    { numero: 3, monto: 500, dias: 30, estado: 'pendiente' },
                    { numero: 4, monto: 500, dias: -30, estado: 'pagado' }
                ];

                for (const pago of pagos) {
                    const fechaVencimiento = new Date(hoy);
                    fechaVencimiento.setDate(hoy.getDate() + pago.dias);
                    
                    await pool.query(`
                        INSERT INTO pagos (matricula_id, numero_cuota, monto, fecha_vencimiento, estado)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [matriculaId, pago.numero, pago.monto, fechaVencimiento.toISOString().split('T')[0], pago.estado]);
                }
                
                console.log('✅ Pagos de prueba creados');
            }
        }

        console.log('🎉 Datos de prueba para pagos creados exitosamente');

    } catch (error) {
        console.error('❌ Error creando datos de prueba:', error);
    }
};

if (require.main === module) {
    createTestData().then(() => {
        console.log('✨ Proceso completado');
        process.exit(0);
    });
}

module.exports = createTestData;