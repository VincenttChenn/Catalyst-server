import { Response } from 'express';
import mongoose from 'mongoose';
import Order, { ORDER_STATUSES, OrderItem, OrderStatus } from '../models/Order';
import Product from '../models/Product';
import { AuthRequest, isAdminUser } from '../middleware/authMiddleware';
import { isNonEmptyString, isPositiveInt, parsePositiveInt, roundMoney } from '../utils/validators';

const MAX_ITEMS_PER_ORDER = 50;
const MAX_QUANTITY_PER_ITEM = 100;
const MAX_PAGE_SIZE = 100;

// Which status changes an admin is allowed to make.
const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

interface RequestedItem {
  productId: string;
  quantity: number;
  size?: string;
}

interface StockLine {
  product: mongoose.Types.ObjectId;
  quantity: number;
}

// Put reserved stock back (used when an order fails part-way or is cancelled).
const restoreStock = async (lines: StockLine[]): Promise<void> => {
  await Promise.all(
    lines.map((line) => Product.updateOne({ _id: line.product }, { $inc: { stock: line.quantity } }))
  );
};

// POST /api/orders
export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  // stock we have already deducted; rolled back if anything below fails
  const reserved: StockLine[] = [];
  let orderCreated = false;

  try {
    const { items, shippingInfo } = req.body ?? {};

    // ---- 1. validate the request shape ----
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: 'Order must contain at least one item' });
      return;
    }
    if (items.length > MAX_ITEMS_PER_ORDER) {
      res.status(400).json({ message: `An order can contain at most ${MAX_ITEMS_PER_ORDER} items` });
      return;
    }

    const requested: RequestedItem[] = [];
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') {
        res.status(400).json({ message: 'Each item must be an object' });
        return;
      }
      const { product, quantity, size } = raw as Record<string, unknown>;

      if (typeof product !== 'string' || !mongoose.isValidObjectId(product)) {
        res.status(400).json({ message: 'Each item needs a valid product id' });
        return;
      }
      // SECURITY: reject 0, negatives, decimals — a negative quantity would otherwise
      // produce a negative total and *increase* stock.
      if (!isPositiveInt(quantity, MAX_QUANTITY_PER_ITEM)) {
        res.status(400).json({
          message: `quantity must be a whole number between 1 and ${MAX_QUANTITY_PER_ITEM}`,
        });
        return;
      }
      if (size !== undefined && typeof size !== 'string') {
        res.status(400).json({ message: 'size must be a string' });
        return;
      }
      requested.push({ productId: product, quantity, size: size?.trim() });
    }

    if (!shippingInfo || typeof shippingInfo !== 'object') {
      res.status(400).json({ message: 'shippingInfo is required' });
      return;
    }
    const { fullName, address, phone } = shippingInfo as Record<string, unknown>;
    if (!isNonEmptyString(fullName, 100) || !isNonEmptyString(address, 300) || !isNonEmptyString(phone, 30)) {
      res.status(400).json({ message: 'shippingInfo needs fullName, address and phone' });
      return;
    }

    // ---- 2. load products and validate each line ----
    const uniqueIds = [...new Set(requested.map((item) => item.productId))];
    const products = await Product.find({ _id: { $in: uniqueIds } });
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const lines: { productId: mongoose.Types.ObjectId; quantity: number; size: string; name: string }[] = [];
    for (const item of requested) {
      const product = productMap.get(item.productId);
      if (!product) {
        res.status(404).json({ message: `Product ${item.productId} not found` });
        return;
      }

      // products without sizes (e.g. scarves) are sold as "One Size"
      let size = 'One Size';
      if (product.sizes.length > 0) {
        if (!item.size || !product.sizes.includes(item.size)) {
          res.status(400).json({ message: `Invalid size for ${product.name}` });
          return;
        }
        size = item.size;
      }

      lines.push({ productId: product._id, quantity: item.quantity, size, name: product.name });
    }

    // ---- 3. reserve stock atomically ----
    // The filter `stock >= quantity` and the decrement happen in ONE database operation,
    // so two shoppers can never both buy the last item (the old check-then-update could).
    const orderItems: OrderItem[] = [];
    let total = 0;

    for (const line of lines) {
      const updated = await Product.findOneAndUpdate(
        { _id: line.productId, stock: { $gte: line.quantity } },
        { $inc: { stock: -line.quantity } },
        { new: true }
      );

      if (!updated) {
        await restoreStock(reserved);
        reserved.length = 0;
        res.status(400).json({ message: `Insufficient stock for ${line.name}` });
        return;
      }

      reserved.push({ product: updated._id, quantity: line.quantity });

      // SECURITY: price always comes from the database, never from the client
      total += updated.price * line.quantity;
      orderItems.push({
        product: updated._id,
        name: updated.name,
        size: line.size,
        quantity: line.quantity,
        priceAtPurchase: updated.price,
      });
    }

    // ---- 4. create the order ----
    const order = await Order.create({
      user: req.userId,
      items: orderItems,
      shippingInfo: {
        fullName: fullName.trim(),
        address: address.trim(),
        phone: phone.trim(),
      },
      total: roundMoney(total),
      status: 'confirmed',
    });
    orderCreated = true;

    res.status(201).json(order);
  } catch (error) {
    // don't leave stock deducted for an order that was never saved
    if (!orderCreated && reserved.length > 0) {
      await restoreStock(reserved).catch((rollbackError) =>
        console.error('Failed to roll back stock after order error:', rollbackError)
      );
    }
    res.status(500).json({ message: 'Failed to create order' });
  }
};

// GET /api/orders/my-orders
export const getMyOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orders = await Order.find({ user: req.userId }).sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
};

// GET /api/orders/:id — the owner or an admin
export const getOrderById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: 'Invalid order id' });
      return;
    }

    const order = await Order.findById(id);
    // answer 404 (not 403) for other people's orders so ids can't be probed
    if (!order || !(await canAccessOrder(req.userId, order.user))) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch order' });
  }
};

// PATCH /api/orders/:id/cancel — the owner or an admin, only while status is "confirmed"
export const cancelOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: 'Invalid order id' });
      return;
    }

    const order = await Order.findById(id);
    if (!order || !(await canAccessOrder(req.userId, order.user))) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    if (order.status !== 'confirmed') {
      res.status(400).json({ message: `Only confirmed orders can be cancelled (current status: ${order.status})` });
      return;
    }

    // the status filter makes the transition atomic: a double-click or a concurrent
    // admin action can't cancel (and restock) the same order twice
    const cancelled = await Order.findOneAndUpdate(
      { _id: order._id, status: 'confirmed' },
      { status: 'cancelled', cancelledAt: new Date() },
      { new: true }
    );
    if (!cancelled) {
      res.status(409).json({ message: 'Order status changed, please refresh and try again' });
      return;
    }

    await restoreStock(cancelled.items);
    res.status(200).json(cancelled);
  } catch (error) {
    res.status(500).json({ message: 'Failed to cancel order' });
  }
};

// GET /api/orders (admin) — all orders, newest first. Query: status, page, limit
export const getAllOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, page, limit } = req.query;
    const filter: Record<string, unknown> = {};

    if (status !== undefined) {
      if (typeof status !== 'string' || !ORDER_STATUSES.includes(status as OrderStatus)) {
        res.status(400).json({ message: `status must be one of: ${ORDER_STATUSES.join(', ')}` });
        return;
      }
      filter.status = status;
    }

    const currentPage = parsePositiveInt(page, 1, 1_000_000);
    const pageSize = parsePositiveInt(limit, 20, MAX_PAGE_SIZE);

    const [data, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize)
        .populate('user', 'name email'),
      Order.countDocuments(filter),
    ]);

    res.status(200).json({
      data,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
};

// PATCH /api/orders/:id/status (admin) — body: { "status": "shipped" }
export const updateOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: 'Invalid order id' });
      return;
    }

    const { status } = req.body ?? {};
    if (typeof status !== 'string' || !ORDER_STATUSES.includes(status as OrderStatus)) {
      res.status(400).json({ message: `status must be one of: ${ORDER_STATUSES.join(', ')}` });
      return;
    }
    const nextStatus = status as OrderStatus;

    const order = await Order.findById(id);
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    if (!STATUS_TRANSITIONS[order.status].includes(nextStatus)) {
      res.status(400).json({ message: `Cannot change status from ${order.status} to ${nextStatus}` });
      return;
    }

    const update: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === 'cancelled') update.cancelledAt = new Date();

    const updated = await Order.findOneAndUpdate({ _id: order._id, status: order.status }, update, { new: true });
    if (!updated) {
      res.status(409).json({ message: 'Order status changed, please refresh and try again' });
      return;
    }

    if (nextStatus === 'cancelled') {
      await restoreStock(updated.items);
    }
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update order status' });
  }
};

// the order's owner, or any admin
const canAccessOrder = async (userId: string | undefined, orderOwner: mongoose.Types.ObjectId): Promise<boolean> => {
  if (!userId) return false;
  if (orderOwner.toString() === userId) return true;
  return isAdminUser(userId);
};
