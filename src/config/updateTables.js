const pool = require('./database');

const updateTables = async () => {
    try {
        console.log('🔄 Actualizando tablas con datos de estudiantes...');

        // Insertar datos de ejemplo para estudiantes
        const users = [
            { dni: '12345678', nombre: 'Juan', apellido: 'Pérez', rol: 'estudiante' },
            { dni: '87654321', nombre: 'María', apellido: 'Gómez', rol: 'estudiante' },
            { dni: '11223344', nombre: 'Carlos', apellido: 'López', rol: 'estudiante' }
        ];

        for (const user of users) {
            // Verificar si el usuario ya existe
            const existing = await pool.query(
                'SELECT id FROM usuarios WHERE dni = $1',
                [user.dni]
            );

            if (existing.rows.length === 0) {
                const bcrypt = require('bcryptjs');
                const hashedPassword = await bcrypt.hash('estudiante123', 10);
                
                await pool.query(
                    `INSERT INTO usuarios (dni, password, rol, nombre, apellido_paterno, debe_cambiar_password)
                     VALUES ($1, $2, $3, $4, $5, false)`,
                    [user.dni, hashedPassword, user.rol, user.nombre, user.apellido]
                );
                console.log(`✅ Estudiante ${user.nombre} ${user.apellido} creado`);
            }
        }

        // Insertar ciclo académico de ejemplo
        const cicloExistente = await pool.query(
            'SELECT id FROM ciclos_academicos WHERE nombre = $1',
            ['Ciclo 2024-I']
        );

        if (cicloExistente.rows.length === 0) {
            await pool.query(
                `INSERT INTO ciclos_academicos (nombre, descripcion, precio, fecha_inicio, fecha_fin, duracion_semanas, activo)
                 VALUES ('Ciclo 2024-I', 'Ciclo académico primer semestre 2024', 1500.00, '2024-03-01', '2024-07-31', 20, true)`
            );
            console.log('✅ Ciclo académico 2024-I creado');
        }

        console.log('🎉 Datos de ejemplo creados exitosamente');

    } catch (error) {
        console.error('❌ Error actualizando tablas:', error);
    }
};

if (require.main === module) {
    updateTables().then(() => {
        console.log('✨ Proceso completado');
        process.exit(0);
    });
}

module.exports = updateTables;