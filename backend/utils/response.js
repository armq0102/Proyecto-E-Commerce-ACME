const sendError = (res, status, msg, details) => {
    const payload = { ok: false, msg };
    if (details && process.env.NODE_ENV === 'development') {
        payload.details = details;
    }
    return res.status(status).json(payload);
};

module.exports = { sendError };
