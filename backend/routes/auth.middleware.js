const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_super_seguro';

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: 'No autorizado. Token requerido.' });
  }

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Formato de token inválido.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido o expirado.' });
  }
};

module.exports = verifyToken;