const verifyAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ ok: false, msg: 'Acceso denegado. Se requiere rol de administrador.' });
    }
};

module.exports = verifyAdmin;