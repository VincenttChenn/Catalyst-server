import mongoose, { Schema, Document } from 'mongoose'

// Iproduct used for type checking in typescript 
export interface Iproduct extends Document {
  name: string;
  price: number;
  stock: number;
  image: string;
  category: string;
  description: string;
  sizes: string[];
}

// product schema used to define the structure of a product document in MongoDB
const productSchema = new Schema<Iproduct>({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  stock: { type: Number, required: true, default: 0 },
  image: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  sizes: { type: [String], default: [] },
});

export default mongoose.model<Iproduct>('Product', productSchema);