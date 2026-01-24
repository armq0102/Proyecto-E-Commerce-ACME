const { Router } = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../User.model');
const verifyToken = require('../auth.middleware');

const router = Router();

// ==========================================
// RUTAS DE AUTENTICACIÓN
// ==========================================

/**
 * @route   POST /api/auth/register
 * @desc    Registrar un nuevo usuario
 * @access  Public
 */
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // 1. Validación básica de entrada
        if (!name || !email || !password) {
            return res.status(400).json({ 
                ok: false, 
                msg: 'Por favor, complete todos los campos (nombre, email, contraseña).' 
            });
        }

        // 2. Crear y guardar usuario (El hash se maneja en el modelo User)
        const user = new User({ name, email, password });
        await user.save();

        // 3. Respuesta exitosa
        res.status(201).json({ 
            ok: true, 
            msg: 'Usuario registrado con éxito. Ahora puedes iniciar sesión.' 
        });

    } catch (error) {
        // Manejo específico para email duplicado (MongoDB Error 11000)
        if (error.code === 11000) {
            return res.status(409).json({ 
                ok: false, 
                msg: 'El correo electrónico ya está registrado.' 
            });
        }

        console.error('❌ Error en registro:', error);
        res.status(500).json({ 
            ok: false, 
            msg: 'Error interno del servidor al registrar usuario.' 
        });
    }
});

/**
 * @route   POST /api/auth/login
 * @desc    Iniciar sesión y obtener token
 * @access  Public
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Validación básica
        if (!email || !password) {
            return res.status(400).json({ 
                ok: false, 
                msg: 'Por favor, ingrese email y contraseña.' 
            });
        }

        // 2. Buscar usuario
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ 
                ok: false, 
                msg: 'Credenciales inválidas (Usuario no encontrado).' 
            });
        }

        // 3. Verificar contraseña
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ 
                ok: false, 
                msg: 'Credenciales inválidas (Contraseña incorrecta).' 
            });
        }

        // 4. Generar Token JWT
        const token = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // 5. Respuesta con Token y Datos de Usuario
        res.json({
            ok: true,
            msg: 'Inicio de sesión exitoso',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('❌ Error en login:', error);
        res.status(500).json({ 
            ok: false, 
            msg: 'Error interno del servidor al iniciar sesión.' 
        });
    }
});

/**
 * @route   GET /api/auth/me
 * @desc    Obtener datos del usuario autenticado
 * @access  Private
 */
router.get('/me', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        
        if (!user) {
            return res.status(404).json({ 
                ok: false, 
                msg: 'Usuario no encontrado.' 
            });
        }
        
        // NOTA: Se devuelve el objeto user directamente para mantener compatibilidad 
        // con el frontend actual (auth.js espera el objeto user, no { data: user }).
        res.json(user);

    } catch (error) {
        console.error('❌ Error obteniendo perfil:', error);
        res.status(500).json({ 
            ok: false, 
            msg: 'Error interno del servidor al obtener perfil.' 
        });
    }
});

/**
 * @route   PUT /api/auth/update
 * @desc    Actualizar datos del perfil
 * @access  Private
 */
router.put('/update', verifyToken, async (req, res) => {
    try {
        const { name, phone, address } = req.body;

        // Validación ligera
        if (!name) {
            return res.status(400).json({
                ok: false,
                msg: 'El nombre es obligatorio.'
            });
        }

        const user = await User.findByIdAndUpdate(
            req.user.userId, 
            { name, phone, address }, 
            { new: true, runValidators: true }
        ).select('-password');
        
        if (!user) {
            return res.status(404).json({ ok: false, msg: 'Usuario no encontrado.' });
        }

        res.json({ 
            ok: true, 
            msg: 'Perfil actualizado correctamente.', 
            user 
        });

    } catch (error) {
        console.error('❌ Error actualizando perfil:', error);
        res.status(500).json({ 
            ok: false, 
            msg: 'Error interno del servidor al actualizar perfil.' 
        });
    }
});

module.exports = router;