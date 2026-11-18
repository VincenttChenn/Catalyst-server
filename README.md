# Catalyst — E-Commerce Backend REST API

> **Tech Stack:** `Node.js` • `ExpressJS` • `TypeScript` • `MongoDB (Mongoose)` • `JWT` • `Bcrypt`
> **Frontend Client Repository:** [Catalyst-client](https://github.com/VincenttChenn/Catalyst-client)

RESTful API for **Catalyst Marketplace**, built with Node.js, Express, TypeScript and MongoDB.

---

## What's new in v1.1

**Security / correctness fixes**
- Order validation: `items` must be a non-empty array, `quantity` a whole number 1–100 (a negative quantity used to create a negative total and *add* stock), `size` must exist on the product, `shippingInfo` is validated.
- **Atomic stock reservation**: stock is checked and decremented in a single database operation, so concurrent buyers can no longer oversell. If an order fails part-way, reserved stock is rolled back.
- CORS now actually enforces the allowlist (before, both branches allowed every origin). `CLIENT_URL` accepts comma-separated origins.
- `/api/health` reports the real database state (503 when disconnected).
- Emails are trimmed + lowercased; passwords are hidden from queries by default (`select: false`).
- Request body size capped at 10 KB; JSON parse errors and unknown routes return clean JSON via a central error handler.

**New features**
- Admin role + admin-only product create / update / delete
- Product filtering (`minPrice`, `maxPrice`, `inStock`), sorting, and opt-in pagination
- `GET /api/products/categories`
- Order lifecycle (`confirmed → shipped → delivered`, or `cancelled`), order detail, customer cancellation with automatic restock
- Admin order list with status filter + pagination
- `GET /api/auth/me` and `PATCH /api/auth/me/password`

---

## API Endpoints

### Auth
| Method | Endpoint                 | Access    | Description                                  |
| ------ | ------------------------ | --------- | -------------------------------------------- |
| POST   | `/api/auth/register`     | Public    | Register a new account (always role `user`)  |
| POST   | `/api/auth/login`        | Public    | Log in, receive JWT                          |
| GET    | `/api/auth/me`           | Protected | Current user (includes `role`)               |
| PATCH  | `/api/auth/me/password`  | Protected | Body: `{ currentPassword, newPassword }`     |

### Products
| Method | Endpoint                  | Access | Description                                                  |
| ------ | ------------------------- | ------ | ------------------------------------------------------------ |
| GET    | `/api/products`           | Public | List products (see query params below)                       |
| GET    | `/api/products/categories`| Public | Sorted list of category names                                |
| GET    | `/api/products/:id`       | Public | Single product                                               |
| POST   | `/api/products`           | Admin  | Create product                                               |
| PUT    | `/api/products/:id`       | Admin  | Update product (partial updates allowed)                     |
| DELETE | `/api/products/:id`       | Admin  | Delete product                                               |

`GET /api/products` query params: `search`, `category`, `minPrice`, `maxPrice`, `inStock=true`,
`sort=price_asc|price_desc|name_asc|newest`, `page`, `limit`.
Without `page`/`limit` the response is a plain array (backwards compatible). With them it is
`{ "data": [...], "pagination": { page, limit, total, totalPages } }`.

### Orders
| Method | Endpoint                  | Access          | Description                                             |
| ------ | ------------------------- | --------------- | ------------------------------------------------------- |
| POST   | `/api/orders`             | Protected       | Create order (validates input, reserves stock atomically)|
| GET    | `/api/orders/my-orders`   | Protected       | Your order history                                      |
| GET    | `/api/orders/:id`         | Owner / Admin   | Single order                                            |
| PATCH  | `/api/orders/:id/cancel`  | Owner / Admin   | Cancel while `confirmed`; stock is restored             |
| GET    | `/api/orders`             | Admin           | All orders. Query: `status`, `page`, `limit`            |
| PATCH  | `/api/orders/:id/status`  | Admin           | Body: `{ "status": "shipped" }`                         |

Allowed admin transitions: `confirmed → shipped | cancelled`, `shipped → delivered`.

Create-order body:
```json
{
  "items": [{ "product": "<productId>", "quantity": 2, "size": "M" }],
  "shippingInfo": { "fullName": "Jane Doe", "address": "1 Main St", "phone": "555-0100" }
}
```
Products with no sizes (e.g. scarves) don't need `size`; they're stored as "One Size".

---

## Getting Started

**Prerequisites:** Node.js 18+ and a MongoDB instance (local or Atlas).

```bash
npm install
cp .env.example .env      # then edit the values
npm run seed              # optional: loads sample products (also clears orders!)
npm run dev               # http://localhost:5000
```

### Environment variables
| Variable     | Description                                                       |
| ------------ | ----------------------------------------------------------------- |
| `PORT`       | Port for local dev (default 5000)                                 |
| `MONGO_URI`  | MongoDB connection string                                         |
| `JWT_SECRET` | Long random string used to sign tokens (server refuses to start without it) |
| `CLIENT_URL` | Allowed frontend origin(s), comma-separated                       |

### Creating an admin
Nobody can become an admin through the API. Register a normal account first, then:
```bash
npm run make-admin -- you@example.com
```
Log in again afterwards; `GET /api/auth/me` will show `"role": "admin"`.

### Scripts
| Script               | Purpose                              |
| -------------------- | ------------------------------------ |
| `npm run dev`        | Dev server with auto-reload          |
| `npm run typecheck`  | Type-check without emitting files    |
| `npm run build`      | Compile to `dist/`                   |
| `npm start`          | Run compiled build                   |
| `npm run seed`       | Seed sample products                 |
| `npm run make-admin` | Promote a user to admin              |

---

## Project Structure
```
src/
├── config/database.ts
├── controllers/   auth, product, order
├── middleware/    authMiddleware (protect, adminOnly), errorMiddleware
├── models/        User, Product, Order
├── routes/        auth, product, order
├── scripts/       seedProducts, makeAdmin
├── utils/         validators
└── server.ts
```
