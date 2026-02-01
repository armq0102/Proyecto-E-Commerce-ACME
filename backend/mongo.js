const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Usa la variable de entorno o conecta a local por defecto
        let mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/acme_ecommerce';
        
        // 🛡️ LIMPIEZA DEFENSIVA (CRÍTICO PARA RENDER)
        // 1. Eliminar espacios en blanco al inicio/final
        mongoURI = mongoURI.trim();
        
        // 2. Eliminar comillas si el usuario las puso por error en el dashboard
        if ((mongoURI.startsWith('"') && mongoURI.endsWith('"')) || 
            (mongoURI.startsWith("'") && mongoURI.endsWith("'"))) {
            mongoURI = mongoURI.slice(1, -1);
        }

        // Debug: Ver qué URL está llegando realmente (Ocultando contraseña por seguridad)
        const maskedURI = mongoURI.replace(/:([^:@]+)@/, ':****@');
        console.log(`🔌 Intentando conectar a: ${maskedURI}`);

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