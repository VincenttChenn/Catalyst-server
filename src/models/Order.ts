import mongoose, { Schema, Document } from 'mongoose';

// to define the shape of each item in the order
interface OrderItem {
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
  status: string;
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
        quantity: { type: Number, required: true },
        priceAtPurchase: { type: Number, required: true },
      },
    ],
    shippingInfo: {
      fullName: { type: String, required: true },
      address: { type: String, required: true },
      phone: { type: String, required: true },
    },
    total: { type: Number, required: true },
    status: { type: String, default: 'confirmed' },
  },
  { timestamps: true }
);

export default mongoose.model<IOrder>('Order', orderSchema);