# ⚡ Catalyst — E-Commerce Backend REST API

> Secure, production-ready RESTful API for **Catalyst Marketplace** built with **Node.js**, **Express**, **TypeScript**, and **MongoDB**.

---

## 🔒 Security & Architecture Highlights

- **🛡️ Price Integrity Guard**: Server recalculates total order prices directly from MongoDB database records to prevent client-side DevTools price tampering.
- **⚡ Rate Limiting Protection**: Integrated `express-rate-limit` on Auth routes (10 req/15min) and General routes (100 req/15min) against brute-force attacks.
- **🛡️ Server-Side Input Validation**: Strict validation for email regex, missing parameters, and password minimum length (8 chars).
- **🔍 ReDoS Protection**: Sanitized regex queries in product search to prevent MongoDB server crash on special characters (e.g. `\`, `*`, `[`).
- **🔒 CORS Protection**: Restricted origin configuration enforcing trusted client access.
- **🔐 JWT Authentication**: Token signing with secret validation at startup (`JWT_SECRET`).
- **🔑 Password Hashing**: Salted password hashing via `bcryptjs` (salt rounds = 10).

---

## 📂 Project Structure

```
marketplace-server/
├── src/
│   ├── config/                # Database connection setup
│   │   └── database.ts
│   ├── controllers/           # Request handlers & logic
│   │   ├── authController.ts
│   │   ├── orderController.ts
│   │   └── productController.ts
│   ├── middleware/            # Express auth middleware
│   │   └── authMiddleware.ts
│   ├── models/                # Mongoose Schema definitions
│   │   ├── Order.ts
│   │   ├── Product.ts
│   │   └── User.ts
│   ├── routes/                # Express router endpoints
│   │   ├── authRoutes.ts
│   │   ├── orderRoutes.ts
│   │   └── productRoutes.ts
│   ├── scripts/               # DB Seed script
│   │   └── seedProducts.ts
│   └── server.ts              # Server entry point
├── package.json
└── tsconfig.json
```

---

## 📡 API Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register new user account |
| `POST` | `/api/auth/login` | Public | Authenticate user & receive JWT token |
| `GET` | `/api/products` | Public | Fetch products (supports `?search=` and `?category=`) |
| `GET` | `/api/products/:id` | Public | Fetch single product by ID |
| `POST` | `/api/orders` | Protected | Create order (validates stock & calculates server price) |
| `GET` | `/api/orders/my-orders` | Protected | Fetch order history of authenticated user |

---

## 🚀 Getting Started

### Prerequisites
- Node.js `v18+`
- MongoDB Instance (Local or MongoDB Atlas Cloud)

### Installation & Local Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root of `marketplace-server`:
   ```env
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/marketplace
   JWT_SECRET=your_super_secret_jwt_key_random_string_12345
   CLIENT_URL=http://localhost:5173
   ```

3. **Seed Database (Optional)**:
   ```bash
   npm run seed
   ```

4. **Run Development Server**:
   ```bash
   npm run dev
   ```

5. **Build for Production**:
   ```bash
   npm run build
   ```
