# SHOE STORE — SHARED CONTRACT (v1)

This is the single source of truth for all 5 agents. **Read it fully before writing any code.**
Data types live in `client/src/shared/types/index.ts` (authoritative; this file never redefines them).
Nobody edits this file or the types file except the human owner. See section 12 if something is missing.

---

## 1. Stack
- **Backend:** Node 20, Express, Mongoose (MongoDB), plain JavaScript (ESM, `"type": "module"`), `zod` for validation, `jsonwebtoken`, `bcryptjs`, `multer` + Cloudinary, `nodemailer`.
- **Frontend:** React 18 + Vite + TypeScript, React Router v6, Axios, TanStack Query, Tailwind CSS, MSW (Mock Service Worker) for mocks.
- **Payments:** Paystack (redirect flow via `authorization_url`).
- **One React app** with three route areas: `/` (customer), `/admin/*`, `/owner/*`.

## 2. Repo layout and ownership

```
shoe-store/
  CONTRACT.md                      (human)
  CONTRACT_CHANGES.md              (anyone appends requests; human resolves)
  server/
    src/
      app.js, server.js, routes.js     Agent 1
      config/                          Agent 1
      models/*.js (ALL models)         Agent 1
      middleware/                      Agent 1
      utils/                           Agent 1
      modules/auth, users              Agent 1
      scripts/seed.js                  Agent 1
      modules/products                 Agent 2
      modules/cart, wishlist           Agent 2
      modules/orders, checkout         Agent 2
      modules/payments                 Agent 2
      modules/delivery, discounts      Agent 2
      modules/reviews, returns         Agent 2
      modules/admin (dashboard, admin orders, inventory, uploads, audit-logs view)  Agent 2
      modules/owner (transactions, reports, export)                                 Agent 2
  client/
    src/
      shared/                          Agent 5   (layout, api client, auth, guards, ui kit, MSW bootstrap)
      shared/types/index.ts            human
      customer/                        Agent 3   (pages, components, api, mocks)
      admin/                           Agent 4
      owner/                           Agent 5
      main.tsx, App.tsx, router.tsx    Agent 5
```

**Hard rules**
1. Only edit files inside your owned paths. Never touch another agent's files.
2. Each agent works on its own git branch: `agent-1-backend-core`, `agent-2-backend-commerce`, `agent-3-customer`, `agent-4-admin`, `agent-5-owner-shared`.
3. Agent 1 creates **stub files** (router returning `501 NOT_IMPLEMENTED`) for every Agent 2 module so the server boots from day one. Agent 2 replaces those stubs with real code.
4. Never invent endpoints, fields, enums or env vars. If you need something missing, follow section 12.

## 3. Conventions
- **Money:** integer kobo everywhere (API, DB, UI state). Format to ₦ only at display time with `Intl.NumberFormat('en-NG', {style:'currency', currency:'NGN'})` on `kobo / 100`.
- **IDs:** API returns `id` (string). Mongoose models must use a `toJSON` transform that maps `_id` → `id` and removes `__v` and `passwordHash`.
- **Dates:** ISO strings.
- **Base URL:** all routes are under `/api`. Dev server `http://localhost:5000`, client `http://localhost:5173`.
- **Success response:** `{ "success": true, "data": <T>, "message"?: string, "meta"?: PageMeta }`
- **Error response:** `{ "success": false, "error": { "code": ErrorCode, "message": string, "details"?: {field: message} } }`
- **Pagination:** query `?page=1&limit=20` (limit max 100); list responses put `PageMeta` in `meta`.
- **Auth:** header `Authorization: Bearer <jwt>`. JWT payload `{ sub: userId, role }`, expires in `JWT_EXPIRES_IN` (default `7d`). Client stores token in `localStorage` key `shoestore_token`.
- **Roles:** `customer`, `admin`, `owner`. Public registration creates **customers only**. Admin and owner accounts are created only by `server/src/scripts/seed.js`.
- **Blocked users** (`isActive=false`) get `403 FORBIDDEN` on login and on every authenticated request.
- **Order number:** `SS-YYYYMMDD-XXXXX` (5 random digits, retry on collision).
- **Dev seed accounts** (password for all: `Passw0rd!123`): `customer@shoestore.test`, `admin@shoestore.test`, `owner@shoestore.test`. Seed also inserts ~12 products, 3 delivery zones, 2 discounts.

## 4. Environment variables

Server (`server/.env`, with a committed `server/.env.example`):
`PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_URL`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.

Client (`client/.env`, with `client/.env.example`):
`VITE_API_URL` (default `http://localhost:5000/api`), `VITE_USE_MOCKS` (`true`/`false`).

## 5. Shared backend helpers (Agent 1 builds, Agent 2 imports; paths and signatures are fixed)

| Path | Exports |
|---|---|
| `server/src/models/index.js` | `User, Product, Cart, Order, Transaction, Discount, DeliveryZone, Review, ReturnRequest, AuditLog` (Mongoose models whose fields match the types file exactly; Product has unique index on `variants.sku`; Cart is `{userId, items:[{productId, sku, quantity}]}`) |
| `server/src/middleware/auth.js` | `authenticate` (verifies JWT, loads user, sets `req.user`), `authorize(...roles)` |
| `server/src/middleware/validate.js` | `validate({ body?, query?, params? })` taking zod schemas |
| `server/src/middleware/errorHandler.js` | final error handler producing the error envelope |
| `server/src/utils/ApiError.js` | `class ApiError(status, code, message, details?)` |
| `server/src/utils/asyncHandler.js` | `asyncHandler(fn)` |
| `server/src/utils/respond.js` | `ok(res, data, {message, meta, status})` |
| `server/src/utils/paginate.js` | `parsePagination(query)` returns `{page, limit, skip}`; `buildMeta(page, limit, total)` |
| `server/src/utils/audit.js` | `logAudit(req, { action, entity, entityId, meta })` (reads actor from `req.user`, never throws) |
| `server/src/utils/mailer.js` | `sendMail({ to, subject, html })` (logs to console if SMTP is not configured; never throws) |
| `server/src/routes.js` | mounts every module router at the prefixes in section 6 |

Each module exports `export default router` from `server/src/modules/<name>/<name>.routes.js`.

## 6. API endpoints

Legend: **P** public, **C** customer, **A** admin, **O** owner. "Builder" = agent implementing the backend.

### Auth and users (Builder: Agent 1)
| Method + path | Who | Body / query | Returns |
|---|---|---|---|
| POST `/api/auth/register` | P | `{name,email,password(min 8),phone?}` | `AuthPayload` |
| POST `/api/auth/login` | P | `{email,password}` | `AuthPayload` |
| POST `/api/auth/forgot-password` | P | `{email}` | `{}` (always 200) |
| POST `/api/auth/reset-password` | P | `{token,password}` | `{}` |
| GET `/api/auth/me` | any auth | | `User` |
| PATCH `/api/auth/me` | any auth | `{name?,phone?}` | `User` |
| PATCH `/api/auth/change-password` | any auth | `{currentPassword,newPassword}` | `{}` |
| GET `/api/users/me/addresses` | C | | `Address[]` |
| POST `/api/users/me/addresses` | C | `Address` without `id` | `Address` |
| PATCH `/api/users/me/addresses/:id` | C | partial `Address` | `Address` |
| DELETE `/api/users/me/addresses/:id` | C | | `{}` |
| GET `/api/admin/customers` | A | `page,limit,q` | `User[]` + meta |
| PATCH `/api/admin/customers/:id/status` | A | `{isActive:boolean}` | `User` |

### Catalog (Builder: Agent 2)
| Method + path | Who | Body / query | Returns |
|---|---|---|---|
| GET `/api/products` | P | `q,audience,type,brand,size,color,minPrice,maxPrice,sort(newest\|price_asc\|price_desc\|rating),page,limit` | `Product[]` + meta (active only) |
| GET `/api/products/filters` | P | | `ProductFilterMeta` |
| GET `/api/products/:id` | P | accepts id or slug | `Product` |
| GET `/api/products/:id/reviews` | P | `page,limit` | `Review[]` (approved only) + meta |
| POST `/api/products/:id/reviews` | C | `{rating,comment}` (only if customer has a delivered order with this product; one per product) | `Review` (status `pending`) |
| GET `/api/admin/products` | A | `page,limit,q,isActive` | `Product[]` + meta (includes inactive) |
| POST `/api/admin/products` | A | `Product` without `id, slug, ratingAverage, ratingCount, createdAt, updatedAt` | `Product` |
| PATCH `/api/admin/products/:id` | A | partial of the above | `Product` |
| DELETE `/api/admin/products/:id` | A | soft delete (`isActive=false`) | `{}` |
| PATCH `/api/admin/products/:id/stock` | A | `{sku, stock}` | `Product` |
| GET `/api/admin/inventory/low-stock` | A | `threshold` (default 5) | `LowStockItem[]` |
| POST `/api/admin/uploads/image` | A | multipart field `image` | `{url: string}` |

### Cart and wishlist (Builder: Agent 2, customers only)
| Method + path | Body | Returns |
|---|---|---|
| GET `/api/cart` | | `Cart` |
| PUT `/api/cart/items` | `{productId, sku, quantity}` (sets quantity; `0` removes; rejects above stock with `OUT_OF_STOCK`) | `Cart` |
| DELETE `/api/cart` | | `Cart` (empty) |
| GET `/api/wishlist` | | `Product[]` |
| POST `/api/wishlist/:productId` | | `string[]` (product ids) |
| DELETE `/api/wishlist/:productId` | | `string[]` |

### Delivery, discounts, checkout, orders, payments (Builder: Agent 2)
| Method + path | Who | Body / query | Returns |
|---|---|---|---|
| GET `/api/delivery-zones` | P | | `DeliveryZone[]` (active) |
| POST `/api/discounts/validate` | C | `{code, subtotal}` | `DiscountCheck` or `VALIDATION_ERROR` |
| POST `/api/checkout` | C | `CheckoutRequest` | `CheckoutResponse` |
| GET `/api/orders` | C | `page,limit` | `Order[]` + meta (own only) |
| GET `/api/orders/:id` | C | | `Order` (own only) |
| POST `/api/orders/:id/cancel` | C | only while `pending_payment` or `paid` and not yet `packed` | `Order` |
| GET `/api/payments/verify/:reference` | C | | `Order` (server re-verifies with Paystack, then returns current order) |
| POST `/api/payments/paystack/webhook` | P | Paystack payload, header `x-paystack-signature` | `200 {}` |
| POST `/api/returns` | C | `{orderId, items:[{sku,quantity}], reason}` (order must be `delivered`) | `ReturnRequest` |
| GET `/api/returns` | C | | `ReturnRequest[]` (own) |

### Admin operations (Builder: Agent 2)
| Method + path | Who | Body / query | Returns |
|---|---|---|---|
| GET `/api/admin/dashboard/summary` | A | | `DashboardSummary` |
| GET `/api/admin/orders` | A | `page,limit,status,from,to,q(orderNumber/customer)` | `Order[]` + meta |
| GET `/api/admin/orders/:id` | A | | `Order` |
| PATCH `/api/admin/orders/:id/status` | A | `{status, note?}` (allowed transitions in section 8) | `Order` |
| GET `/api/admin/delivery-zones` | A | | `DeliveryZone[]` (all) |
| POST / PATCH `/api/admin/delivery-zones(/:id)` | A | `DeliveryZone` minus `id` | `DeliveryZone` |
| DELETE `/api/admin/delivery-zones/:id` | A | | `{}` |
| GET `/api/admin/discounts` | A | | `Discount[]` |
| POST / PATCH `/api/admin/discounts(/:id)` | A | `Discount` minus `id, usedCount` | `Discount` |
| DELETE `/api/admin/discounts/:id` | A | | `{}` |
| GET `/api/admin/reviews` | A | `status,page,limit` | `Review[]` + meta |
| PATCH `/api/admin/reviews/:id` | A | `{status:'approved'\|'rejected'}` | `Review` |
| GET `/api/admin/returns` | A | `status,page,limit` | `ReturnRequest[]` + meta |
| PATCH `/api/admin/returns/:id` | A | `{status, adminNote?}` | `ReturnRequest` |

Invoices are printed from `GET /api/admin/orders/:id` by the admin client (no separate endpoint).

### Owner (view-only) (Builder: Agent 2) — accessible by **O and A**; every route is GET only
| Method + path | Query | Returns |
|---|---|---|
| GET `/api/owner/transactions` | `page,limit,from,to,status,method,q(reference/orderNumber/customer)` | `Transaction[]` + meta |
| GET `/api/owner/transactions/:id` | | `{ transaction: Transaction, order: Order }` |
| GET `/api/owner/transactions/export` | same filters, `format=csv` | CSV file (`Content-Disposition: attachment`), no envelope |
| GET `/api/owner/reports/summary` | `period=daily\|weekly\|monthly, from, to` | `ReportSummary` |
| GET `/api/owner/reports/top-products` | `from,to,limit(default 5)` | `TopProduct[]` |
| GET `/api/audit-logs` | `page,limit,actorId,entity,from,to` | `AuditLog[]` + meta (O and A) |

PDF export is generated client-side by Agent 5 (print stylesheet / `window.print`). The owner role has **no** POST/PATCH/DELETE access anywhere.

## 7. Authorization matrix
- `/api/admin/*` → `authorize('admin')` (exception: none).
- `/api/owner/*` and `/api/audit-logs` → `authorize('owner','admin')`.
- Customer routes (`cart, wishlist, checkout, orders, returns, users/me, reviews POST, discounts/validate`) → `authorize('customer')`.
- Admin and owner must never be able to register through the public endpoint.

## 8. Business rules
- **Order statuses and allowed transitions:**
  `pending_payment → paid | cancelled`; `paid → packed | cancelled | refunded`; `packed → shipped | cancelled`; `shipped → delivered`; `delivered → refunded`. Anything else returns `409 CONFLICT`. Every change appends to `statusHistory` and writes an audit log.
- **Checkout:** validates cart is non-empty and every item is in stock, snapshots items and prices into the order, applies the discount, adds the delivery zone fee, and **decrements stock atomically at order creation**. Stock is restored when an order is cancelled or a payment fails.
- **Paystack:** order starts `pending_payment` / `unpaid`; the response includes `authorizationUrl`; reference = `orderNumber`. The **webhook is the only way an order becomes paid**: verify HMAC SHA512 of the raw body with `PAYSTACK_SECRET_KEY`, then confirm amount equals `order.total`, then set `paymentStatus='paid'`, `status='paid'`, and create/update the `Transaction` as `success`. The redirect-back page only calls `GET /api/payments/verify/:reference`, which re-checks with Paystack and never trusts the client.
- **Pay on delivery:** the order starts at `status='pending_payment'` with `paymentStatus='unpaid'`. Admin moves it `pending_payment → paid` when the order is confirmed, then onward manually. `paymentStatus` becomes `paid` when the order is marked `delivered`. A `Transaction` with status `pending` and reference `POD-<orderNumber>` is created at checkout and becomes `success` when the order is marked `delivered`.
- **Refund:** moving an order to `refunded` sets `paymentStatus='refunded'`, the transaction to `refunded`, and restores stock.
- **Reviews:** rating average and count on the product update only when a review is approved.
- **Every admin mutation** (product, stock, order status, discounts, zones, reviews, returns, customer block) calls `logAudit`.
- **Emails** (via `sendMail`): order confirmation on checkout, "paid" receipt on payment success, status update on `shipped` and `delivered`.

## 9. Frontend contracts (Agent 5 builds, Agents 3 and 4 consume; paths fixed)

| Path | Exports |
|---|---|
| `client/src/shared/api/client.ts` | `api` Axios instance: baseURL `VITE_API_URL`, attaches token, **unwraps the envelope** (so `await api.get<Product[]>('/products')` resolves to `{ data, meta }`), converts error envelopes into thrown `ApiClientError { code, message, details, status }`; on `401` clears token and redirects to `/login` |
| `client/src/shared/auth/AuthContext.tsx` | `AuthProvider`, `useAuth()` → `{ user, token, isLoading, login, register, logout, refreshUser }` |
| `client/src/shared/auth/guards.tsx` | `<RequireAuth roles={Role[]}>`, `<GuestOnly>` |
| `client/src/shared/lib/format.ts` | `formatNaira(kobo)`, `formatDate(iso)`, `formatDateTime(iso)` |
| `client/src/shared/ui/*` | `Button, Input, Select, Modal, Badge, Spinner, EmptyState, Pagination, DataTable, StatusBadge, Toast (useToast)` |
| `client/src/shared/layout/*` | `CustomerLayout, AdminLayout, OwnerLayout` (each renders `<Outlet/>`) |
| `client/src/shared/mocks/browser.ts` | starts MSW when `VITE_USE_MOCKS==='true'`, collecting `handlers` exported from `customer/mocks/index.ts`, `admin/mocks/index.ts`, `owner/mocks/index.ts` |
| `client/src/router.tsx` | route tree; each area exports its routes: `customer/routes.tsx`, `admin/routes.tsx`, `owner/routes.tsx` (each exports `export const customerRoutes: RouteObject[]` etc.) |

**Routes by area**
- Customer (`/`): `/`, `/shop`, `/product/:slug`, `/cart`, `/checkout`, `/checkout/verify` (Paystack callback, reads `?reference=`), `/orders`, `/orders/:id`, `/wishlist`, `/account`, `/login`, `/register`, `/forgot-password`, `/reset-password`. Login and register pages are built by Agent 3 and use `useAuth()`.
- Admin: `/admin`, `/admin/products`, `/admin/products/new`, `/admin/products/:id`, `/admin/orders`, `/admin/orders/:id`, `/admin/customers`, `/admin/inventory`, `/admin/discounts`, `/admin/delivery`, `/admin/reviews`, `/admin/returns`, `/admin/audit-logs`.
- Owner: `/owner` (summary + charts), `/owner/transactions`, `/owner/transactions/:id`, `/owner/reports`. Admin/owner login uses the same `/login` page and redirects by role after login (`admin → /admin`, `owner → /owner`, `customer → /`).

**Mocks:** every frontend agent builds MSW handlers in its own `mocks/` folder that return data matching the types file and the exact paths in section 6, using the envelope format. Mock data is realistic (Nigerian names/states, ₦ prices in kobo). Switching `VITE_USE_MOCKS=false` must require **no** other code change.

## 10. Quality bar (every agent)
- No hardcoded secrets or URLs; use env vars from section 4.
- Validate all input on the server (zod) and show field errors on the client.
- Handle loading, empty and error states on every screen.
- Mobile-first responsive layouts (most shoppers are on phones).
- Commit small and often with messages like `agent-3: add product filters`.
- Don't add new dependencies beyond section 1 without noting them in your final report.

## 11. Integration order
1. Human sets up repo, copies this file and the types file, creates the 5 branches.
2. Agent 1 merges first (server boots, auth works, stubs exist). Agent 5's shared layer merges early too.
3. Agent 2 merges next. Agents 3, 4, 5 switch `VITE_USE_MOCKS=false` and fix any mismatches **in their own code** against the contract.
4. Final integration pass: end-to-end test of register → browse → cart → checkout (Paystack test mode) → admin marks shipped/delivered → owner sees transaction.

## 12. When something is missing or wrong
Do **not** guess silently and do **not** edit this file. Append a request to `CONTRACT_CHANGES.md` in this format, then continue with the most conservative assumption and mention it in your final report:

```
- [agent-N] YYYY-MM-DD: <what is missing or conflicting> | proposed fix: <your suggestion> | blocking: yes/no
```
