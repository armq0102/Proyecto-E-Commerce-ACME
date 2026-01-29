const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Usa la variable de entorno o conecta a local por defecto
        const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/acme_ecommerce';
        
        const conn = await mongoose.connect(mongoURI, {
            dbName: 'acme_ecommerce' // FIX: Forzar nombre de BD correcto ignorando el .env si está mal
        });

        console.log(`🍃 MongoDB Conectado: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ Error conectando a MongoDB: ${error.message}`);
        process.exit(1); // Detener la app si no hay conexión a DB
    }
};

module.exports = connectDB;