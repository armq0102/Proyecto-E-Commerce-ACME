require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./Product.model');
const User = require('./User.model');
const connectDB = require('./mongo');

const products = [
    // ====== HOMBRES (8 productos) ======
    { title: 'Camisa clásica blanca', price: 85000, img: 'images/2.png', stock: 15, status: 'active' },
    { title: 'Camisa casual azul', price: 95000, img: 'images/2.png', stock: 12, status: 'active' },
    { title: 'Pantalón casual beige', price: 120000, img: 'images/3.png', stock: 10, status: 'active' },
    { title: 'Pantalón jean oscuro', price: 135000, img: 'images/3.png', stock: 14, status: 'active' },
    { title: 'Chaqueta de cuero', price: 450000, img: 'images/4.png', stock: 5, status: 'active' },
    { title: 'Chaqueta deportiva', price: 280000, img: 'images/4.png', stock: 8, status: 'active' },
    { title: 'Polo premium', price: 65000, img: 'images/2.png', stock: 20, status: 'active' },
    { title: 'Camiseta básica negra', price: 45000, img: 'images/2.png', stock: 25, status: 'active' },

    // ====== MUJERES (8 productos) ======
    { title: 'Vestido casual floral', price: 180000, img: 'images/5.png', stock: 18, status: 'active' },
    { title: 'Vestido elegante negro', price: 250000, img: 'images/5.png', stock: 10, status: 'active' },
    { title: 'Blusa blanca estampada', price: 75000, img: 'images/1.png', stock: 22, status: 'active' },
    { title: 'Blusa de seda dorada', price: 125000, img: 'images/1.png', stock: 8, status: 'active' },
    { title: 'Falda midi plisada', price: 160000, img: 'images/5.png', stock: 12, status: 'active' },
    { title: 'Falda corta jean', price: 95000, img: 'images/5.png', stock: 16, status: 'active' },
    { title: 'Pantalón chino blanco', price: 140000, img: 'images/3.png', stock: 11, status: 'active' },
    { title: 'Pantalón palazzo', price: 155000, img: 'images/3.png', stock: 9, status: 'active' },

    // ====== ACCESORIOS (8 productos) ======
    { title: 'Gorra clásica negra', price: 35000, img: 'images/4.png', stock: 30, status: 'active' },
    { title: 'Gorra ajustable roja', price: 40000, img: 'images/4.png', stock: 25, status: 'active' },
    { title: 'Bolso de mano cuero', price: 280000, img: 'images/5.png', stock: 7, status: 'active' },
    { title: 'Bolso crossbody beige', price: 195000, img: 'images/1.png', stock: 12, status: 'active' },
    { title: 'Cinturón de cuero marrón', price: 65000, img: 'images/2.png', stock: 20, status: 'active' },
    { title: 'Cinturón ancho negro', price: 75000, img: 'images/2.png', stock: 18, status: 'active' },
    { title: 'Bufanda de lana', price: 55000, img: 'images/1.png', stock: 15, status: 'active' },
    { title: 'Cinturón de cadena dorado', price: 85000, img: 'images/4.png', stock: 10, status: 'active' }
];

const users = [
    {
        name: 'Admin Acme',
        email: 'admin@acme.com',
        password: 'Password123!', 
        role: 'admin'
    },
    {
        name: 'Usuario de Prueba',
        email: 'test@acme.com',
        password: 'Password123!', 
        role: 'user'
    }
];

const seedDB = async () => {
    await connectDB();
    
    try {
        // --- Limpiar y sembrar Productos ---
        await Product.deleteMany({}); // Limpiar productos viejos
        console.log('🗑️  Productos anteriores eliminados');

        const createdProducts = await Product.insertMany(products);
        console.log(`✅ ${createdProducts.length} productos insertados correctamente`);
        
        // --- Limpiar y sembrar Usuarios ---
        await User.deleteMany({}); // Limpiar usuarios viejos
        console.log('🗑️  Usuarios anteriores eliminados');

        // FIX: Usar bucle con save() para asegurar que se ejecute el hook pre('save') de encriptación.
        // Esto es crítico: insertMany NO ejecuta los hooks del modelo.
        for (const userData of users) {
            const user = new User(userData);
            await user.save();
            // Verificación visual en consola
            if (userData.email === 'admin@acme.com') {
                console.log(`🔑 Admin creado. Password original: ${userData.password} -> Hash en BD: ${user.password}`);
            }
        }
        console.log(`✅ ${users.length} usuarios insertados correctamente`);

        process.exit();
    } catch (error) {
        console.error('❌ Error en seed:', error);
        process.exit(1);
    }
};

seedDB();