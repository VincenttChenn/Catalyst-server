import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product';
import {
  isNonEmptyString,
  isNonNegativeInt,
  isNonNegativeNumber,
  parseNumber,
  parsePositiveInt,
} from '../utils/validators';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 12;

const SORT_OPTIONS: Record<string, Record<string, 1 | -1>> = {
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  name_asc: { name: 1 },
  newest: { _id: -1 },
};

// GET /api/products
// Supported query params:
//   search, category, minPrice, maxPrice, inStock=true, sort=price_asc|price_desc|name_asc|newest
//   page, limit  -> opt-in pagination. Without them the response is a plain array
//                   (exactly what the existing frontend expects).
export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, category, minPrice, maxPrice, inStock, sort, page, limit } = req.query;
    const filter: Record<string, unknown> = {};

    if (typeof search === 'string' && search.trim()) {
      const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.name = { $regex: safeSearch, $options: 'i' };
    }
    // only accept plain strings so query-string objects (?category[$ne]=x) are ignored
    if (typeof category === 'string' && category.trim()) {
      filter.category = category.trim();
    }

    const min = parseNumber(minPrice);
    const max = parseNumber(maxPrice);
    if (min !== undefined || max !== undefined) {
      const priceFilter: Record<string, number> = {};
      if (min !== undefined) priceFilter.$gte = min;
      if (max !== undefined) priceFilter.$lte = max;
      filter.price = priceFilter;
    }

    if (inStock === 'true') {
      filter.stock = { $gt: 0 };
    }

    const sortBy = typeof sort === 'string' ? SORT_OPTIONS[sort] : undefined;
    const paginated = page !== undefined || limit !== undefined;

    if (!paginated) {
      const query = Product.find(filter);
      if (sortBy) query.sort(sortBy);
      res.status(200).json(await query);
      return;
    }

    const currentPage = parsePositiveInt(page, 1, 1_000_000);
    const pageSize = parsePositiveInt(limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    const [data, total] = await Promise.all([
      // fall back to _id so pages are stable when no sort is requested
      Product.find(filter)
        .sort(sortBy ?? { _id: 1 })
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize),
      Product.countDocuments(filter),
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
    res.status(500).json({ message: 'Failed to fetch products' });
  }
};

// GET /api/products/categories
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = (await Product.distinct('category')) as string[];
    res.status(200).json(categories.sort((a, b) => a.localeCompare(b)));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: 'Invalid product id' });
      return;
    }

    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch product' });
  }
};

// ---------- admin-only CRUD ----------

type ValidationResult = { data: Record<string, unknown> } | { error: string };

// Whitelists fields and validates types. `partial` = true for updates (every field optional).
const validateProductInput = (body: unknown, partial: boolean): ValidationResult => {
  if (!body || typeof body !== 'object') {
    return { error: 'Request body is required' };
  }
  const input = body as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  const stringFields = ['name', 'image', 'category', 'description'] as const;
  for (const field of stringFields) {
    const value = input[field];
    if (value === undefined) {
      if (!partial) return { error: `${field} is required` };
      continue;
    }
    if (!isNonEmptyString(value, field === 'description' ? 2000 : 300)) {
      return { error: `${field} must be a non-empty string` };
    }
    data[field] = value.trim();
  }

  if (input.price === undefined) {
    if (!partial) return { error: 'price is required' };
  } else if (!isNonNegativeNumber(input.price)) {
    return { error: 'price must be a number >= 0' };
  } else {
    data.price = input.price;
  }

  if (input.stock === undefined) {
    if (!partial) data.stock = 0;
  } else if (!isNonNegativeInt(input.stock)) {
    return { error: 'stock must be a whole number >= 0' };
  } else {
    data.stock = input.stock;
  }

  if (input.sizes !== undefined) {
    if (
      !Array.isArray(input.sizes) ||
      input.sizes.length > 20 ||
      !input.sizes.every((s) => isNonEmptyString(s, 20))
    ) {
      return { error: 'sizes must be an array of up to 20 non-empty strings' };
    }
    data.sizes = (input.sizes as string[]).map((s) => s.trim());
  }

  if (partial && Object.keys(data).length === 0) {
    return { error: 'No valid fields to update' };
  }

  return { data };
};

// POST /api/products (admin)
export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = validateProductInput(req.body, false);
    if ('error' in result) {
      res.status(400).json({ message: result.error });
      return;
    }

    const product = await Product.create(result.data);
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create product' });
  }
};

// PUT /api/products/:id (admin) — partial updates allowed
export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: 'Invalid product id' });
      return;
    }

    const result = validateProductInput(req.body, true);
    if ('error' in result) {
      res.status(400).json({ message: result.error });
      return;
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { $set: result.data },
      { new: true, runValidators: true }
    );
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update product' });
  }
};

// DELETE /api/products/:id (admin)
export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: 'Invalid product id' });
      return;
    }

    const product = await Product.findByIdAndDelete(id);
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    // past orders keep their own name/price snapshot, so deleting a product is safe
    res.status(200).json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete product' });
  }
};
