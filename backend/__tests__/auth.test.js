const request = require('supertest');
const { app } = require('../server');
const User = require('../User.model');

const registerUser = async (overrides = {}) => {
    const payload = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password1!'
    };
    return request(app).post('/api/auth/register').send({ ...payload, ...overrides });
};

describe('Auth API', () => {
    test('registers a user', async () => {
        const res = await registerUser();
        expect(res.status).toBe(201);
        expect(res.body.ok).toBe(true);
    });

    test('logs in a user and returns token', async () => {
        await registerUser();
        const res = await request(app).post('/api/auth/login').send({
            email: 'test@example.com',
            password: 'Password1!'
        });
        expect(res.status).toBe(200);
        expect(res.body.token).toBeTruthy();
    });

    test('returns profile for authenticated user', async () => {
        await registerUser();
        const login = await request(app).post('/api/auth/login').send({
            email: 'test@example.com',
            password: 'Password1!'
        });
        const token = login.body.token;

        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.email).toBe('test@example.com');
    });

    test('rejects invalid payload', async () => {
        const res = await request(app).post('/api/auth/register').send({
            name: 'X',
            email: 'invalid-email',
            password: 'short'
        });
        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
    });
});
