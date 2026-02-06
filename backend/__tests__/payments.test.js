const request = require('supertest');
const { app } = require('../server');
const User = require('../User.model');
const Product = require('../Product.model');
const Order = require('../Order.model');

const createUserAndLogin = async () => {
    await request(app).post('/api/auth/register').send({
        name: 'Pay User',
        email: 'pay@example.com',
        password: 'Password1!'
    });

    const login = await request(app).post('/api/auth/login').send({
        email: 'pay@example.com',
        password: 'Password1!'
    });

    return login.body.token;
};

describe('Payments API', () => {
    test('creates transaction and order', async () => {
        const token = await createUserAndLogin();
        const user = await User.findOne({ email: 'pay@example.com' });
        user.address = 'Calle 123, Bogota';
        await user.save();

        const product = await Product.create({
            title: 'Camisa Test',
            price: 50000,
            stock: 5,
            img: 'https://example.com/img.jpg',
            category: 'Hombres',
            status: 'active'
        });

        const res = await request(app)
            .post('/api/payments/create-transaction')
            .set('Authorization', `Bearer ${token}`)
            .send({ items: [{ id: product._id.toString(), qty: 1 }] });

        expect(res.status).toBe(200);
        expect(res.body.redirectUrl).toContain('wompi');

        const order = await Order.findOne({ userId: user._id });
        expect(order).toBeTruthy();
        expect(order.status).toBe('Pendiente');
    });
});
