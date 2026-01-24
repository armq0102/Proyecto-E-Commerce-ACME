const { Router } = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const verifyToken = require('./auth.middleware.js');
const { User, generateId } = require('../db.js'); // Importamos Modelos

const router = Router();

// RUTA PROTEGIDA: Obtener datos del usuario actual
// Requiere header Authorization: Bearer <token>
router.get('/test', (req, res) => {
  res.json({ ok: true, message: 'auth router funcionando' });
});

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_super_seguro';

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = {
      id: generateId(),
      name,
      email,
      password: hashedPassword,
      role: 'user' // Rol por defecto para nuevos registros
    };

    User.create(user);

    res.status(201).json({
      message: 'Usuario registrado con éxito',
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    if (error.message === 'EMAIL_EXISTS') {
        return res.status(409).json({ message: 'El email ya está registrado' });
    }
    console.error('Error en register:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    console.log('🔍 Intento de login:', { email, passwordRecibido: !!password });

    if (!email || !password) {
      return res.status(400).json({ message: 'Email y password son obligatorios' });
    }

    // 1. Buscar usuario por ID (Simulamos búsqueda por email escaneando todo por ahora)
    const users = User.findAll();
    const user = users.find(u => u.email === email);

    if (!user) {
      console.log('❌ Usuario no encontrado en DB');
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      console.log('❌ Contraseña incorrecta');
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role || 'user' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Login exitoso',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
});

// RUTA PROTEGIDA: Obtener datos del usuario actual
// Requiere header Authorization: Bearer <token>
router.get('/me', verifyToken, (req, res) => {
  // req.user viene del middleware verifyToken
  const user = User.findById(req.user.userId);
  
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

  // Devolver todos los datos del perfil (excepto password)
  res.json({ 
    id: user.id, 
    name: user.name, 
    email: user.email,
    phone: user.phone || '',
    address: user.address || '',
    document: user.document || ''
  });
});

// RUTA PROTEGIDA: Actualizar datos del usuario (PUT /api/auth/update)
router.put('/update', verifyToken, (req, res) => {
  const { name, phone, address, document } = req.body;
  
  const updates = {};
  if (name) updates.name = name;
  if (phone) updates.phone = phone;
  if (address) updates.address = address;
  if (document) updates.document = document;

  const updatedUser = User.updateById(req.user.userId, updates);

  if (!updatedUser) return res.status(404).json({ message: 'Usuario no encontrado' });

  res.json({ message: 'Perfil actualizado correctamente', user: updatedUser });
});

module.exports = router;
