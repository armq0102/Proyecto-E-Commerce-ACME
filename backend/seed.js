require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./Product.model');
const connectDB = require('./mongo');

const products = [
    // Hombres
    { title: 'Camisa clásica', price: 29.99, img: 'images/2.png', stock: 20, status: 'active' },
    { title: 'Pantalón urbano', price: 49.99, img: 'images/3.png', stock: 15, status: 'active' },
    { title: 'Chaqueta ligera', price: 79.99, img: 'images/4.png', stock: 10, status: 'active' },
    // Mujeres
    { title: 'Vestido veraniego', price: 39.99, img: 'images/5.png', stock: 25, status: 'active' },
    { title: 'Blusa estampada', price: 24.99, img: 'images/1.png', stock: 30, status: 'active' },
    { title: 'Falda midi', price: 34.99, img: 'images/2.png', stock: 12, status: 'active' },
    // Accesorios
    { title: 'Gorra clásica', price: 14.99, img: 'images/4.png', stock: 50, status: 'active' },
    { title: 'Bolso de mano', price: 49.99, img: 'images/5.png', stock: 8, status: 'active' },
    { title: 'Cinturón de cuero', price: 24.99, img: 'images/2.png', stock: 18, status: 'active' }
];

const seedDB = async () => {
    await connectDB();
    
    try {
        await Product.deleteMany({}); // Limpiar productos viejos
        console.log('🗑️  Productos anteriores eliminados');

        const createdProducts = await Product.insertMany(products);
        console.log(`✅ ${createdProducts.length} productos insertados correctamente`);
        
        process.exit();
    } catch (error) {
        console.error('❌ Error en seed:', error);
        process.exit(1);
    }
};

seedDB();