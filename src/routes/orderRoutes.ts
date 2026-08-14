import { Router } from 'express';
import { createOrder, getMyOrders } from '../controllers/orderController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.post('/', protect, createOrder);
router.get('/my-orders', protect, getMyOrders);

export default router;