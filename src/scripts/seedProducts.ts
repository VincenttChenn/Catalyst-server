import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product';

dotenv.config();

export const products = [
  { name: "Wool Overcoat", category: "Outerwear", price: 239, stock: 10, image: "/products/wool-overcoat-red.webp", description: "Tailored wool overcoat for a refined silhouette.", sizes: ["S", "M", "L", "XL"] },
  { name: "Denim Jacket", category: "Outerwear", price: 179, stock: 12, image: "/products/denim-jacket.webp", description: "Classic denim jacket with a relaxed fit.", sizes: ["S", "M", "L", "XL"] },
  { name: "Trench Coat", category: "Outerwear", price: 269, stock: 8, image: "/products/trench-coat.webp", description: "Timeless trench coat, belted waist.", sizes: ["S", "M", "L", "XL"] },
  { name: "Bomber Jacket", category: "Outerwear", price: 199, stock: 10, image: "/products/bomber-jacket-red.webp", description: "Lightweight bomber jacket with ribbed trim.", sizes: ["S", "M", "L", "XL"] },
  { name: "Linen Long Sleeve Shirt", category: "Tops", price: 99, stock: 18, image: "/products/Linen-Shirt-Long-Sleeve.webp", description: "Breathable linen shirt for warm seasons.", sizes: ["S", "M", "L", "XL"] },
  { name: "Silk Blouse", category: "Tops", price: 129, stock: 20, image: "/products/Silk-Blouse.webp", description: "Lightweight silk blouse with a relaxed fit.", sizes: ["XS", "S", "M", "L"] },
  { name: "Knit Sweater", category: "Tops", price: 119, stock: 15, image: "/products/knit-sweater.avif", description: "Soft knit sweater for everyday layering.", sizes: ["S", "M", "L", "XL"] },
  { name: "Turtleneck Top", category: "Tops", price: 89, stock: 16, image: "/products/turtleneck-top.webp", description: "Fitted turtleneck in soft jersey.", sizes: ["XS", "S", "M", "L"] },
  { name: "Tailored Trousers", category: "Bottoms", price: 159, stock: 15, image: "/products/tailored-trouser.jpg", description: "Slim-fit tailored trousers.", sizes: ["S", "M", "L"] },
  { name: "Wide Leg Pants", category: "Bottoms", price: 149, stock: 14, image: "/products/wide-pant.webp", description: "Flowy wide-leg trousers with high waist.", sizes: ["S", "M", "L", "XL"] },
  { name: "Pleated Skirt", category: "Bottoms", price: 119, stock: 12, image: "/products/pleated-skirt.webp", description: "Midi pleated skirt with elastic waist.", sizes: ["XS", "S", "M", "L"] },
  { name: "Straight Denim Jeans", category: "Bottoms", price: 139, stock: 20, image: "/products/denim-jeans.webp", description: "Classic straight-fit denim jeans.", sizes: ["S", "M", "L", "XL"] },
  { name: "Cashmere Scarf", category: "Accessories", price: 89, stock: 25, image: "/products/cashmere-scarf.webp", description: "Soft cashmere scarf.", sizes: [] },
  { name: "Leather Belt", category: "Accessories", price: 69, stock: 22, image: "/products/belt.avif", description: "Genuine leather belt with brass buckle.", sizes: ["S", "M", "L"] },
  { name: "Leather Loafers", category: "Accessories", price: 219, stock: 12, image: "/products/loafer.avif", description: "Handcrafted leather loafers.", sizes: ["38", "39", "40", "41", "42"] }
];

const seedDB = async (): Promise<void> => {
  try {
    const uri = process.env.MONGO_URI as string;
    await mongoose.connect(uri);
    console.log('MongoDB connected for seeding');

    await Product.deleteMany({});
    console.log('Old products cleared');

    await Product.insertMany(products);
    console.log(`${products.length} products seeded`);

    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedDB();