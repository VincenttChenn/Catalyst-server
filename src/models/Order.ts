import mongoose, { Schema, Document } from 'mongoose';

export const ORDER_STATUSES = ['confirmed', 'shipped', 'delivered', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// to define the shape of each item in the order
export interface OrderItem {
  product: mongoose.Types.ObjectId;
  name: string;
  size: string;
  quantity: number;
  priceAtPurchase: number;
}

// to define the shape of the order document
export interface IOrder extends Document {
  user: mongoose.Types.ObjectId;
  items: OrderItem[];
  shippingInfo: {
    fullName: string;
    address: string;
    phone: string;
  };
  total: number;
  status: OrderStatus;
  cancelledAt?: Date;
}

// to define the order schema and its relationships with other collections (Product and User)
const orderSchema = new Schema<IOrder>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
      {
        product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },
        size: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        priceAtPurchase: { type: Number, required: true, min: 0 },
      },
    ],
    shippingInfo: {
      fullName: { type: String, required: true },
      address: { type: String, required: true },
      phone: { type: String, required: true },
    },
    total: { type: Number, required: true, min: 0 },
    status: { type: String, enum: [...ORDER_STATUSES], default: 'confirmed' },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model<IOrder>('Order', orderSchema);
