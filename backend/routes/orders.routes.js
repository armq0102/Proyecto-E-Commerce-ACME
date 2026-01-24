const { Router } = require('express');
const verifyToken = require('./auth.middleware.js');
const { Order, User, Product, generateId } = require('../db.js');

const router = Router();

// 1. CREAR UN PEDIDO (POST /api/orders)
// Requiere estar logueado
router.post('/', verifyToken, (req, res) => {
    try {
        const { items } = req.body; // Ignoramos 'total' del body por seguridad

        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'El carrito no puede estar vacío' });
        }

        // 1. Obtener usuario real de la DB (Fuente de verdad)
        const user = User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // 2. Validar que tenga dirección configurada
        if (!user.address || user.address.trim() === '') {
            return res.status(400).json({ message: 'Por favor, completa tu dirección de envío en "Mi Perfil" antes de comprar.' });
        }

        // 3. RECALCULAR TOTAL Y VALIDAR PRODUCTOS (Lógica de Negocio Segura)
        const productsDB = Product.findAll(); // Obtenemos snapshot del inventario
        let calculatedTotal = 0;
        const sanitizedItems = [];
        const productsToUpdate = [...productsDB]; // Referencia para manipular stock (Simulación transacción)

        for (const item of items) {
            // Validar existencia del producto
            const product = productsToUpdate.find(p => p.id === item.id);
            
            if (!product) {
                return res.status(400).json({ 
                    message: `El producto '${item.title || item.id}' no existe o ya no está disponible.` 
                });
            }

            // Validar cantidad positiva
            const qty = parseInt(item.qty);
            if (!qty || qty <= 0) {
                return res.status(400).json({ message: 'Cantidad inválida en el pedido.' });
            }

            // VALIDACIÓN DE STOCK (Zero Trust)
            if (product.stock < qty) {
                return res.status(409).json({ 
                    message: `Stock insuficiente para '${product.title}'. Disponibles: ${product.stock}` 
                });
            }

            // Sumar al total usando el PRECIO DEL BACKEND (Source of Truth)
            calculatedTotal += product.price * qty;

            // Crear item sanitizado (evita que se guarden campos extraños enviados por hackers)
            sanitizedItems.push({
                id: product.id,
                title: product.title, // Opcional: guardar snapshot del nombre
                price: product.price, // Guardamos el precio al momento de la compra
                qty: qty
            });

            // Descontar stock en memoria (se persistirá si todo el loop pasa)
            product.stock -= qty;
        }

        // 4. PERSISTIR CAMBIOS DE STOCK (Commit de la transacción)
        Product.saveAll(productsToUpdate);
        
        const newOrder = {
            id: generateId(),          // ID centralizado
            userId: user.id,
            items: sanitizedItems,     // Usamos los items validados
            total: calculatedTotal,    // Usamos el total calculado por nosotros
            shippingAddress: user.address, // Dirección segura desde DB
            status: 'Pendiente',
            createdAt: new Date().toISOString(), // Timestamp estándar
            // 5. INICIALIZAR HISTORIAL (Auditoría)
            statusHistory: [{
                status: 'Pendiente',
                date: new Date().toISOString(),
                note: 'Pedido creado por el usuario'
            }]
        };

        Order.create(newOrder);

        return res.status(201).json({
            message: 'Pedido creado correctamente',
            order: newOrder
        });

    } catch (error) {
        console.error('Error creando pedido:', error);
        res.status(500).json({ message: 'Error al procesar el pedido' });
    }
});

// 2. OBTENER MIS PEDIDOS (GET /api/orders)
router.get('/', verifyToken, (req, res) => {
    const orders = Order.findAll();
    // Filtrar solo los pedidos del usuario actual (Service Logic)
    const myOrders = orders.filter(o => o.userId === req.user.userId);
    res.json(myOrders);
});

module.exports = router;