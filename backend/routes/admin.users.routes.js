const { Router } = require('express');
const User = require('../User.model');
const router = Router();

// GET: Listar usuarios
router.get('/', async (req, res) => {
    try {
        const users = await User.find({}).select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ msg: 'Error al obtener usuarios' });
    }
});

module.exports = router;