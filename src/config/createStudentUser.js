const pool = require('./database');
const bcrypt = require('bcryptjs');

const createStudentUser = async () => {
    try {
        console.log('🎓 Creando usuario estudiante de prueba...');

        // Verificar si ya existe el usuario estudiante
        const existingUser = await pool.query(
            'SELECT id FROM usuarios WHERE dni = $1',
            ['12345678']
        );

        if (existingUser.rows.length > 0) {
            console.log('✅ Usuario estudiante ya existe');
            return;
        }

        // Crear usuario estudiante
        const hashedPassword = await bcrypt.hash('estudiante123', 10);
        
        const userResult = await pool.query(`
            INSERT INTO usuarios (dni, nombre, apellido_paterno, apellido_materno, email, password, rol, activo)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        `, [
            '12345678',
            'Ana',
            'García',
            'López',
            'ana.garcia@email.com',
            hashedPassword,
            'estudiante',
            true
        ]);

        const userId = userResult.rows[0].id;

        // Crear registro en estudiantes
        await pool.query(`
            INSERT INTO estudiantes (usuario_id, fecha_ingreso, estado)
            VALUES ($1, $2, $3)
        `, [userId, new Date(), 'activo']);

        console.log('✅ Usuario estudiante creado exitosamente:');
        console.log('📋 Credenciales de prueba:');
        console.log('   DNI: 12345678');
        console.log('   Password: estudiante123');
        console.log('   Rol: estudiante');

    } catch (error) {
        console.error('❌ Error creando usuario estudiante:', error);
    }
};

// Ejecutar si se llama directamente
if (require.main === module) {
    createStudentUser().then(() => {
        console.log('✨ Proceso completado');
        process.exit(0);
    });
}

module.exports = createStudentUser;