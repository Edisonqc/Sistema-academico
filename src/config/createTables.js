const pool = require('./database');

const createTables = async () => {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Creando tablas...');

        await client.query('BEGIN');
        
        // ✅ CORREGIDO: Usar client.query() consistentemente
        await client.query('DROP TABLE IF EXISTS permisos CASCADE');
        console.log('✅ Tabla permisos antigua eliminada');

        // 1. Tabla de usuarios
        await client.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                dni VARCHAR(8) UNIQUE NOT NULL,
                nombre VARCHAR(100) NOT NULL,
                apellido_paterno VARCHAR(100) NOT NULL,
                apellido_materno VARCHAR(100),
                email VARCHAR(150) UNIQUE,
                telefono VARCHAR(15),
                direccion TEXT,
                fecha_nacimiento DATE,
                genero VARCHAR(1),
                password VARCHAR(255) NOT NULL,
                rol VARCHAR(20) NOT NULL DEFAULT 'estudiante',
                activo BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabla "usuarios" creada/verificada');

        // 2. Tabla de estudiantes
        await client.query(`
            CREATE TABLE IF NOT EXISTS estudiantes (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER REFERENCES usuarios(id),
                direccion TEXT,
                sexo VARCHAR(10) CHECK (sexo IN ('masculino', 'femenino')),
                fecha_nacimiento DATE,
                datos_apoderado JSONB,
                tipo_alumno VARCHAR(20) CHECK (tipo_alumno IN ('full', 'escolar', 'otro')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabla "estudiantes" creada/verificada');

        // 3. Tabla de ciclos académicos
        await client.query(`
            CREATE TABLE IF NOT EXISTS ciclos_academicos (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                descripcion TEXT,
                precio DECIMAL(10,2),
                fecha_inicio DATE,
                fecha_fin DATE,
                duracion_semanas INTEGER,
                activo BOOLEAN DEFAULT true,
                created_by INTEGER REFERENCES usuarios(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabla "ciclos_academicos" creada/verificada');

        // 4. Tabla de matrículas
        await client.query(`
            CREATE TABLE IF NOT EXISTS matriculas (
                id SERIAL PRIMARY KEY,
                estudiante_id INTEGER REFERENCES estudiantes(id),
                ciclo_id INTEGER REFERENCES ciclos_academicos(id),
                numero_boleta VARCHAR(50) UNIQUE,
                metodo_pago VARCHAR(50),
                descuento DECIMAL(10,2) DEFAULT 0,
                aula VARCHAR(50),
                estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'completado')),
                fecha_matricula TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                matriculado_por INTEGER REFERENCES usuarios(id)
            )
        `);
        console.log('✅ Tabla "matriculas" creada/verificada');

        // 5. Tabla de pagos
        await client.query(`
            CREATE TABLE IF NOT EXISTS pagos (
                id SERIAL PRIMARY KEY,
                matricula_id INTEGER REFERENCES matriculas(id),
                numero_cuota INTEGER,
                monto DECIMAL(10,2),
                fecha_vencimiento DATE,
                fecha_pago TIMESTAMP,
                estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado', 'vencido')),
                metodo_pago VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabla "pagos" creada/verificada');

        // 6. Tabla de asistencias
        await client.query(`
            CREATE TABLE IF NOT EXISTS asistencias (
                id SERIAL PRIMARY KEY,
                estudiante_id INTEGER REFERENCES estudiantes(id),
                fecha DATE NOT NULL,
                hora TIME DEFAULT CURRENT_TIME,
                tipo_registro VARCHAR(20) DEFAULT 'manual' CHECK (tipo_registro IN ('manual', 'qr', 'dni')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabla "asistencias" creada/verificada');

        // 7. Tabla de permisos - SOLO UNA VERSIÓN (la correcta)
        await client.query(`
            CREATE TABLE IF NOT EXISTS permisos (
                id SERIAL PRIMARY KEY,
                rol VARCHAR(50) NOT NULL,
                modulo VARCHAR(100) NOT NULL,
                accion VARCHAR(100) NOT NULL,
                permitido BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(rol, modulo, accion)
            )
        `);
        console.log('✅ Tabla "permisos" creada/verificada');

        // Insertar permisos por defecto - ✅ CORREGIDO: usar client
        const permisosPorDefecto = [
            // Superadmin - Acceso completo
            { rol: 'superadmin', modulo: 'usuarios', accion: 'ver' },
            { rol: 'superadmin', modulo: 'usuarios', accion: 'crear' },
            { rol: 'superadmin', modulo: 'usuarios', accion: 'editar' },
            { rol: 'superadmin', modulo: 'usuarios', accion: 'eliminar' },
            { rol: 'superadmin', modulo: 'usuarios', accion: 'permisos' },
            
            // Secretaria - Permisos limitados
            { rol: 'secretaria', modulo: 'estudiantes', accion: 'ver' },
            { rol: 'secretaria', modulo: 'estudiantes', accion: 'crear' },
            { rol: 'secretaria', modulo: 'estudiantes', accion: 'editar' },
            { rol: 'secretaria', modulo: 'matriculas', accion: 'ver' },
            { rol: 'secretaria', modulo: 'matriculas', accion: 'crear' },
            { rol: 'secretaria', modulo: 'pagos', accion: 'ver' },
            { rol: 'secretaria', modulo: 'pagos', accion: 'crear' },
            { rol: 'secretaria', modulo: 'asistencias', accion: 'ver' },
            { rol: 'secretaria', modulo: 'asistencias', accion: 'crear' },
            
            // Estudiante - Solo lectura propia
            { rol: 'estudiante', modulo: 'perfil', accion: 'ver' },
            { rol: 'estudiante', modulo: 'pagos', accion: 'ver' },
            { rol: 'estudiante', modulo: 'asistencias', accion: 'ver' }
        ];

        for (const permiso of permisosPorDefecto) {
            await client.query(`
                INSERT INTO permisos (rol, modulo, accion, permitido) 
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (rol, modulo, accion) DO NOTHING
            `, [permiso.rol, permiso.modulo, permiso.accion, true]);
        }

        await client.query('COMMIT');
        console.log('🎉 Todas las tablas creadas correctamente');

        // Insertar usuario superadmin por defecto - ✅ CORREGIDO: usar pool aquí
        await createSuperAdmin();

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error creando tablas:', error);
        throw error;
    } finally {
        client.release();
    }
};

// Función para crear superadmin - ✅ MANTENER pool aquí
async function createSuperAdmin() {
    try {
        const bcrypt = require('bcryptjs');
        const superadminPassword = await bcrypt.hash('admin123', 10);
        
        const result = await pool.query(`
            INSERT INTO usuarios (dni, password, rol, nombre, apellido_paterno, debe_cambiar_password)
            VALUES ($1, $2, 'superadmin', 'Super', 'Administrador', true)
            ON CONFLICT (dni) DO NOTHING
            RETURNING id
        `, ['99999999', superadminPassword]);

        if (result.rows.length > 0) {
            console.log('👑 Usuario superadmin creado:');
            console.log('   DNI: 99999999');
            console.log('   Password: admin123');
            console.log('   Rol: Superadministrador');
        } else {
            console.log('ℹ️  Usuario superadmin ya existe');
        }
    } catch (error) {
        console.error('❌ Error creando superadmin:', error);
    }
}

// Ejecutar solo si es el módulo principal
if (require.main === module) {
    createTables()
        .then(() => {
            console.log('✨ Proceso completado exitosamente');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Error en el proceso:', error);
            process.exit(1);
        });
}

module.exports = createTables;