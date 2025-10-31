const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const pool = require('../config/database');

// Middleware para verificar token
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(403).json({ error: 'Token no proporcionado' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido' });
    }
};

// Login
router.post('/login', async (req, res) => {
    const { dni, password } = req.body;

    try {
        // Validar entrada
        if (!dni || !password) {
            return res.status(400).json({ error: 'DNI y contraseña son requeridos' });
        }

        // Buscar usuario
        const result = await pool.query(
            `SELECT id, dni, password, rol, nombre, apellido_paterno, apellido_materno, 
                    email, telefono, debe_cambiar_password, activo
             FROM usuarios 
             WHERE dni = $1 AND activo = true`,
            [dni]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const usuario = result.rows[0];

        // Verificar contraseña
        const validPassword = await bcrypt.compare(password, usuario.password);

        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Generar token
        const token = jwt.sign(
            { 
                id: usuario.id, 
                dni: usuario.dni, 
                rol: usuario.rol 
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        // Responder sin la contraseña
        const { password: _, ...userWithoutPassword } = usuario;

        res.json({
            success: true,
            message: 'Login exitoso',
            token,
            usuario: userWithoutPassword
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// Cambiar contraseña
router.post('/cambiar-password', verifyToken, async (req, res) => {
    const { usuario_id, nueva_password } = req.body;

    try {
        if (!nueva_password || nueva_password.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        }

        const hashedPassword = await bcrypt.hash(nueva_password, 10);
        
        await pool.query(
            'UPDATE usuarios SET password = $1, debe_cambiar_password = false WHERE id = $2',
            [hashedPassword, usuario_id]
        );

        res.json({ success: true, message: 'Contraseña actualizada correctamente' });
    } catch (error) {
        console.error('Error cambiando contraseña:', error);
        res.status(500).json({ error: 'Error al cambiar contraseña' });
    }
});

// Verificar autenticación y rol
router.get('/verify-role', verifyToken, async (req, res) => {
    try {
        const userResult = await pool.query(
            'SELECT id, dni, rol, nombre, apellido_paterno FROM usuarios WHERE id = $1 AND activo = true',
            [req.user.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }

        const user = userResult.rows[0];
        
        res.json({
            success: true,
            user: {
                id: user.id,
                dni: user.dni,
                rol: user.rol,
                nombre: user.nombre,
                apellido_paterno: user.apellido_paterno
            },
            redirectTo: user.rol === 'estudiante' ? '/estudiante/dashboard.html' : '/superadmin/dashboard.html'
        });

    } catch (error) {
        console.error('Error verificando rol:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// Verificar token
router.get('/verify', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, dni, rol, nombre, apellido_paterno, apellido_materno, 
                    email, telefono, debe_cambiar_password
             FROM usuarios 
             WHERE id = $1 AND activo = true`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const usuario = result.rows[0];
        res.json({ success: true, usuario });
    } catch (error) {
        console.error('Error verificando token:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

module.exports = router;