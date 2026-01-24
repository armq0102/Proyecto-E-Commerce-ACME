const { Router } = require('express');
const { User } = require('../db.js');

const router = Router();

// GET /api/admin/users
router.get('/', (req, res) => {
    try {
        const users = User.findAll();

        // Sanitización: Eliminar passwords antes de enviar
        const sanitizedUsers = users.map(user => {
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        });

        res.json(sanitizedUsers);
    } catch (error) {
        console.error('Error admin get users:', error);
        res.status(500).json({ message: 'Error al obtener usuarios' });
    }
});

module.exports = router;