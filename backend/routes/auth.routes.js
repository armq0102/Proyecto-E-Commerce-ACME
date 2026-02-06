const { Router } = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../User.model');
const verifyToken = require('../auth.middleware');
const { sendError } = require('../utils/response');
const { z, validate } = require('../utils/validate');

const router = Router();

// ==========================================
// RUTAS DE AUTENTICACIÓN
// ==========================================

const registerSchema = z.object({
    name: z.string().trim().min(2, 'Nombre requerido.'),
    email: z.string().trim().email('Email invalido.'),
    password: z.string().min(8, 'La contraseña debe tener minimo 8 caracteres.')
});

const loginSchema = z.object({
    email: z.string().trim().email('Email invalido.'),
    password: z.string().min(1, 'La contraseña es obligatoria.')
});

const updateSchema = z.object({
    name: z.string().trim().min(2, 'El nombre es obligatorio.'),
    phone: z.string().trim().optional(),
    address: z.string().trim().optional()
});

/**
 * @route   POST /api/auth/register
 * @desc    Registrar un nuevo usuario
 * @access  Public
 */
router.post('/register', validate(registerSchema), async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // 1. Validación básica de entrada (schema)

        // 2. Crear y guardar usuario
        // El Schema (User.model.js) se encarga automáticamente de hacer trim() y lowercase()
        const user = new User({ name, email, password, role: 'user' });
        await user.save();

        // 3. Respuesta exitosa
        res.status(201).json({ 
            ok: true, 
            msg: 'Usuario registrado con éxito. Ahora puedes iniciar sesión.' 
        });

    } catch (error) {
        // Manejo específico para email duplicado (MongoDB Error 11000)
        if (error.code === 11000) {
            return sendError(res, 409, 'El correo electrónico ya está registrado.');
        }

        console.error('❌ Error en registro:', error);
        return sendError(res, 500, 'Error interno del servidor al registrar usuario.', error.message);
    }
});

/**
 * @route   POST /api/auth/login
 * @desc    Iniciar sesión y obtener token
 * @access  Public
 */
router.post('/login', validate(loginSchema), async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Validación básica (schema)

        // 2. Buscar usuario (Normalizado para evitar errores de Case Sensitive)
        const normalizedEmail = email.toLowerCase().trim();

        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return sendError(res, 400, 'Credenciales inválidas (Usuario no encontrado).');
        }

        // NUEVA VALIDACIÓN: Verificar si el usuario está suspendido
        if (user.status && user.status !== 'active') {
            return sendError(res, 403, 'Tu cuenta está suspendida. Contacta al administrador.');
        }

        // 3. Verificar contraseña
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return sendError(res, 400, 'Credenciales inválidas (Contraseña incorrecta).');
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
        return sendError(res, 500, 'Error interno del servidor al iniciar sesión.', error.message);
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
            return sendError(res, 404, 'Usuario no encontrado.');
        }
        
        // NOTA: Se devuelve el objeto user directamente para mantener compatibilidad 
        // con el frontend actual (auth.js espera el objeto user, no { data: user }).
        res.json(user);

    } catch (error) {
        console.error('❌ Error obteniendo perfil:', error);
        return sendError(res, 500, 'Error interno del servidor al obtener perfil.', error.message);
    }
});

/**
 * @route   PUT /api/auth/update
 * @desc    Actualizar datos del perfil
 * @access  Private
 */
router.put('/update', verifyToken, validate(updateSchema), async (req, res) => {
    try {
        const { name, phone, address } = req.body;

        // Validación ligera (schema)

        const user = await User.findByIdAndUpdate(
            req.user.userId, 
            { name, phone, address }, 
            { new: true, runValidators: true }
        ).select('-password');
        
        if (!user) {
            return sendError(res, 404, 'Usuario no encontrado.');
        }

        res.json({ 
            ok: true, 
            msg: 'Perfil actualizado correctamente.', 
            user 
        });

    } catch (error) {
        console.error('❌ Error actualizando perfil:', error);
        return sendError(res, 500, 'Error interno del servidor al actualizar perfil.', error.message);
    }
});

module.exports = router;