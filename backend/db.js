const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

// Archivo físico donde se guardarán los datos
const USERS_FILE = path.join(__dirname, 'users.json');
const ORDERS_FILE = path.join(__dirname, 'orders.json');
const PRODUCTS_FILE = path.join(__dirname, 'products.json');

// Función para inicializar la DB con el usuario admin por defecto
const initDB = () => {
    if (!fs.existsSync(USERS_FILE)) {
        const initialUsers = [
            {
                id: 'admin-1',
                name: 'Administrador',
                email: 'admin@acme.com',
                password: bcrypt.hashSync('Admin123!', 10),
                role: 'admin'
            }
        ];
        fs.writeFileSync(USERS_FILE, JSON.stringify(initialUsers, null, 2));
        console.log('DB Usuarios creada');
    }

    if (!fs.existsSync(ORDERS_FILE)) {
        fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2));
        console.log('DB Pedidos creada');
    }

    if (!fs.existsSync(PRODUCTS_FILE)) {
        // Seed inicial de productos con Stock para que el backend coincida con el frontend
        const initialProducts = [
            { id: 'p1', title: 'Camisa clásica', price: 29.99, stock: 20 },
            { id: 'p2', title: 'Pantalón urbano', price: 49.99, stock: 15 },
            { id: 'p3', title: 'Chaqueta ligera', price: 79.99, stock: 10 },
            { id: 'p4', title: 'Vestido veraniego', price: 39.99, stock: 25 },
            { id: 'p5', title: 'Blusa estampada', price: 24.99, stock: 30 },
            { id: 'p6', title: 'Falda midi', price: 34.99, stock: 12 },
            { id: 'p7', title: 'Gorra clásica', price: 14.99, stock: 50 },
            { id: 'p8', title: 'Bolso de mano', price: 49.99, stock: 8 },
            { id: 'p9', title: 'Cinturón de cuero', price: 24.99, stock: 18 }
        ];
        fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(initialProducts, null, 2));
        console.log('DB Productos creada con datos iniciales');
    }
};

// Generador de IDs centralizado (Timestamp + Random para evitar colisiones)
const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Cache en memoria para evitar lecturas constantes a disco (Simulación de DB conectada)
const memoryCache = {};

// --- HELPERS INTERNOS (Simulación de Driver de DB) ---
// Estos métodos encapsulan la lectura/escritura de archivos.
// En el futuro, aquí se conectarían las llamadas a Mongoose/MongoDB.
const readData = (file) => {
    // 1. Cache Hit: Si ya tenemos los datos en memoria, los devolvemos
    if (memoryCache[file]) return memoryCache[file];

    if (!fs.existsSync(file)) initDB();
    try {
        const data = fs.readFileSync(file, 'utf-8');
        const parsed = JSON.parse(data);
        // 2. Cache Miss: Guardamos en memoria para la próxima
        memoryCache[file] = parsed;
        return parsed;
    } catch (error) {
        console.error(`Error leyendo DB ${file}:`, error);
        throw new Error('DB_READ_FAILED'); // Estandarización: Siempre lanzamos error si falla
    }
};

const writeData = (file, data) => {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
        // 3. Actualización de Cache: Mantener consistencia
        memoryCache[file] = data;
    } catch (error) {
        console.error(`Error escribiendo DB ${file}:`, error);
        throw new Error('DB_WRITE_FAILED');
    }
};

// --- MODELOS (REPOSITORY PATTERN) ---
// Exponemos interfaces limpias en lugar de acceso directo a archivos.

const User = {
    findAll: () => readData(USERS_FILE),
    findById: (id) => readData(USERS_FILE).find(u => u.id === id),
    create: (user) => {
        const users = readData(USERS_FILE);
        // Validación de Unicidad (Email)
        if (users.some(u => u.email === user.email)) {
            throw new Error('EMAIL_EXISTS');
        }
        if (!user.id) user.id = generateId();
        users.push(user);
        writeData(USERS_FILE, users);
        return user;
    },
    updateById: (id, updates) => {
        const users = readData(USERS_FILE);
        const index = users.findIndex(u => u.id === id);
        if (index !== -1) {
            users[index] = { ...users[index], ...updates };
            writeData(USERS_FILE, users);
            return users[index];
        }
        return null;
    }
};

const Product = {
    findAll: () => readData(PRODUCTS_FILE),
    findById: (id) => readData(PRODUCTS_FILE).find(p => p.id === id),
    create: (product) => {
        const products = readData(PRODUCTS_FILE);
        // Validación de Unicidad (ID)
        if (products.some(p => p.id === product.id)) {
            throw new Error('PRODUCT_ID_EXISTS');
        }
        if (!product.id) product.id = generateId();
        products.push(product);
        writeData(PRODUCTS_FILE, products);
        return product;
    },
    // Método semántico para actualizaciones parciales (estilo Mongo)
    updateById: (id, updates) => {
        const products = readData(PRODUCTS_FILE);
        const index = products.findIndex(p => p.id === id);
        if (index !== -1) {
            products[index] = { ...products[index], ...updates };
            writeData(PRODUCTS_FILE, products);
            return products[index];
        }
        return null;
    },
    // Método atómico simulado para stock
    updateStock: (id, delta) => {
        const products = readData(PRODUCTS_FILE);
        const product = products.find(p => p.id === id);
        if (product) {
            // Validación de stock negativo (Regla de negocio crítica)
            if (product.stock + delta < 0) {
                throw new Error('INSUFFICIENT_STOCK');
            }
            product.stock += delta;
            writeData(PRODUCTS_FILE, products);
            return product;
        }
        return null;
    },
    // ⚠️ INTERNAL USE ONLY: Evitar usar en controladores nuevos
    saveAll: (products) => writeData(PRODUCTS_FILE, products)
};

const Order = {
    findAll: () => readData(ORDERS_FILE),
    findById: (id) => readData(ORDERS_FILE).find(o => o.id === id),
    create: (order) => {
        const orders = readData(ORDERS_FILE);
        if (!order.id) order.id = generateId();
        orders.push(order);
        writeData(ORDERS_FILE, orders);
        return order;
    },
    // Alias semántico para consistencia
    update: (updatedOrder) => {
        const orders = readData(ORDERS_FILE);
        const index = orders.findIndex(o => o.id === updatedOrder.id);
        if (index !== -1) {
            orders[index] = updatedOrder;
            writeData(ORDERS_FILE, orders);
            return updatedOrder;
        }
        return null;
    },
    updateStatus: (id, status) => {
        const orders = readData(ORDERS_FILE);
        const order = orders.find(o => o.id === id);
        if (order) {
            order.status = status;
            order.updatedAt = new Date().toISOString();
            writeData(ORDERS_FILE, orders);
            return order;
        }
        return null;
    }
};

// --- LEGACY EXPORTS (Compatibilidad hacia atrás) ---
// Mantenemos estas funciones para no romper auth.routes.js u otros archivos no auditados.
// ⚠️ DEPRECATED - Usar los modelos (User, Product, Order) en su lugar
const getUsers = () => {
    return readData(USERS_FILE);
};

// ⚠️ DEPRECATED
const saveUsers = (users) => {
    writeData(USERS_FILE, users);
};

// ⚠️ DEPRECATED
const getOrders = () => {
    return readData(ORDERS_FILE);
};

// ⚠️ DEPRECATED
const saveOrders = (orders) => {
    writeData(ORDERS_FILE, orders);
};

// ⚠️ DEPRECATED
const getProducts = () => {
    return readData(PRODUCTS_FILE);
};

// ⚠️ DEPRECATED
const saveProducts = (products) => {
    writeData(PRODUCTS_FILE, products);
};

// Inicializar la base de datos automáticamente al arrancar el servidor
initDB();

module.exports = { 
    // Nuevos Modelos (Usa estos preferentemente)
    User, Product, Order, generateId,
    // Legacy (Mantener hasta migración completa)
    getUsers, saveUsers, getOrders, saveOrders, getProducts, saveProducts 
};