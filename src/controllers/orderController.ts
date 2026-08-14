import { Response } from 'express';
import Order from '../models/Order';
import Product from '../models/Product';
import { AuthRequest } from '../middleware/authMiddleware';

// to handle order creation
export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { items, shippingInfo } = req.body;

    // validate products, fetch trusted price from DB, and build sanitized order items
    const sanitizedItems: { product: any; name: string; size: string; quantity: number; priceAtPurchase: number }[] = [];
    let total = 0;

    for (const item of items) {
      const product = await Product.findById(item.product);

      if (!product) {
        res.status(404).json({ message: `Product ${item.product} not found` });
        return;
      }
      if (product.stock < item.quantity) {
        res.status(400).json({ message: `Insufficient stock for ${product.name}` });
        return;
      }

      // SECURITY: use price from DB — never trust client-sent price
      const trustedPrice = product.price;
      total += trustedPrice * item.quantity;

      sanitizedItems.push({
        product: product._id,
        name: product.name,
        size: item.size,
        quantity: item.quantity,
        priceAtPurchase: trustedPrice,
      });
    }

    const order = await Order.create({
      user: req.userId,
      items: sanitizedItems,
      shippingInfo,
      total,
      status: 'confirmed',
    });

    // deduct stock after order is created
    for (const item of sanitizedItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity },
      });
    }

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create order', error: (error as Error).message });
  }
};

// to handle get my orders
export const getMyOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orders = await Order.find({ user: req.userId }).sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch orders', error: (error as Error).message });
  }
};