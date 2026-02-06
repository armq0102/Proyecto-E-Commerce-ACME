const { z } = require('zod');
const { sendError } = require('./response');

const buildZodMessage = (error) => {
    if (!error || !error.errors) return 'Datos invalidos.';
    return error.errors.map((item) => item.message).join(' ');
};

const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        const msg = buildZodMessage(result.error);
        return sendError(res, 400, msg, result.error.errors);
    }
    req.body = result.data;
    return next();
};

module.exports = { z, validate };
