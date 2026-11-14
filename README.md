# Shoe Store

An online shoe store with a customer storefront, admin dashboard, and Node.js/Express API backed by MongoDB. Customers can browse products, check out as guests or signed-in users, and pay through Paystack. Admins manage the catalog, orders, stock, discounts, delivery zones, and returns.

## Tech stack

- Client: React, TypeScript, Vite, React Router, and Three.js / React Three Fiber for product previews
- Server: Node.js 20, Express, Mongoose, and MongoDB
- Payments: Paystack checkout and signed webhooks
- Tests: Node's built-in test runner

## Prerequisites

- Node.js 20 and npm
- MongoDB, local or hosted
- A Paystack account and keys for production payments

## Local setup

Install dependencies and copy the example environment files:

```powershell
cd server
npm ci
Copy-Item .env.example .env
cd ..\client
npm ci
Copy-Item .env.example .env
```

In `server/.env`, set `MONGODB_URI` and a long random `JWT_SECRET`. The example uses `PAYSTACK_SECRET_KEY=sk_test_local_simulated`; keep `NODE_ENV=development` to use the local simulated payment flow. The server requires `PAYSTACK_PUBLIC_KEY` to be set as well, even though the current client redirects to Paystack's returned authorization URL.

There is no seed script or public first-admin creation route. Registration always creates a customer, while the admin-creation endpoint requires an existing admin. To bootstrap a development admin, register a user through the storefront, stop before exposing the app publicly, and promote that account directly in the configured MongoDB database:

```javascript
db.users.updateOne(
  { email: "admin@example.com" },
  { $set: { role: "admin" } }
)
```

Confirm that the update matched one user, then sign in through the admin login page. For production, provision the first admin through a controlled database operation and remove access to that operation afterward.

Run the API and client in separate terminals:

```powershell
cd server
npm run dev
```

```powershell
cd client
npm run dev
```

The client runs at `http://localhost:5173` and the API at `http://localhost:5000`. Set `VITE_API_URL` in `client/.env` if the API uses a different URL.

## Tests and build

```powershell
cd server
npm test
```

```powershell
cd client
npm run build
```

The client build also runs the TypeScript project check. There are no lint scripts configured. The optional end-to-end smoke script requires a running server and MongoDB, an admin and owner JWT (`ADMIN_TOKEN` and `OWNER_TOKEN`), an active in-stock product, and a Lagos delivery zone:

```powershell
cd server
node src/scripts/e2e-smoke.js
```

## Payments

In local development, the exact `sk_test_local_simulated` secret uses the built-in simulated Paystack flow. No Paystack network request is made; payment verification succeeds locally, and webhooks can be exercised by the tests or smoke script.

In production, set real Paystack secret and public keys and `NODE_ENV=production`. Configure Paystack to deliver events to:

```text
https://<your-api-host>/api/payments/paystack/webhook
```

Set `CLIENT_URL` to the deployed storefront URL. Never use the simulated key in production.

## Admin product uploads

Admins create and edit products in the dashboard. Product photos are uploaded to the server (maximum 5 MB each). A 3D model can be uploaded as a `.glb` file (maximum 20 MB), or linked using an HTTPS `.glb` or `.gltf` URL. Upload progress and errors are shown in the editor; clear the model URL to remove a model from a product.

Uploaded images and models are served from `/uploads`. Keep that directory on persistent storage in production and include it in backups.

## Deployment checklist

- Set `NODE_ENV=production` and use strong, unique secrets.
- Configure real Paystack keys and the webhook URL above.
- Set `CLIENT_URL` to the exact deployed storefront origin.
- Use a production MongoDB URI and configure regular database backups.
- Provide persistent storage and backups for `server/uploads/`.
- Configure SMTP settings if password-reset and order emails should be delivered.
