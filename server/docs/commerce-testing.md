# Commerce API smoke test

Run the server with a staging MongoDB database populated with real catalog, stock, and delivery-zone data. The project no longer provides sample-data seeding. For protected requests, set `TOKEN` to a customer JWT; use an admin JWT for the admin status update.

The commerce routers are mounted under `/api`: products at `/products`, product reviews at `/products`, cart at `/cart`, wishlist at `/wishlist`, delivery zones at `/delivery-zones`, discounts at `/discounts`, checkout at `/checkout`, orders at `/orders`, payments at `/payments`, returns at `/returns`, admin operations at `/admin`, and owner operations at `/owner`. Mount the named `auditLogsRouter` export from `owner.routes.js` at `/api/audit-logs`, with the same owner/admin authorization guard as `/api/owner`.

```powershell
Set-Location .\server
$base = 'http://localhost:5000/api'
$headers = @('-H', "Authorization: Bearer $env:TOKEN")

# Browse active products and select a product ID and variant SKU.
$products = (curl.exe -s "$base/products?page=1&limit=5" | ConvertFrom-Json)
$product = $products.data[0]
$variant = $product.variants[0]

# Add the selected variant to the customer's cart.
$cartBody = @{ productId = $product.id; sku = $variant.sku; quantity = 1 } | ConvertTo-Json -Compress
curl.exe -s -X PUT "$base/cart/items" @headers -H 'Content-Type: application/json' -d $cartBody

# Create an order. Use a valid saved address ID or provide shippingAddress.
$zones = (curl.exe -s "$base/delivery-zones" | ConvertFrom-Json)
$zone = $zones.data[0]
$checkoutBody = @{
    shippingAddress = @{
      recipient = 'Test Customer'
      phone = '+2348000000000'
      street = '1 Test Street'
      city = 'Lagos'
      state = $zone.states[0]
    }
    deliveryZoneId = $zone.id
    paymentMethod = 'paystack'
  } | ConvertTo-Json -Depth 4 -Compress
$checkout = (curl.exe -s -X POST "$base/checkout" @headers `
  -H 'Content-Type: application/json' -d $checkoutBody | ConvertFrom-Json)

# Simulate Paystack's signed charge.success webhook for that order.
node .\src\scripts\simulate-webhook.js $checkout.data.paystack.reference

# Confirm the order and transaction after the webhook has been processed.
curl.exe -s "$base/orders/$($checkout.data.order.id)" @headers
curl.exe -s "$base/owner/transactions?page=1&limit=20" `
  -H "Authorization: Bearer $env:OWNER_TOKEN"
```

`simulate-webhook.js` reads `MONGODB_URI`, `PAYSTACK_SECRET_KEY`, and `PORT` from the process environment. The order must exist and use Paystack. The script sends a correctly HMAC-SHA512-signed local `charge.success` event; it does not contact Paystack or move real money.

For admin order transitions, send `PATCH /api/admin/orders/:id/status` with an admin bearer token and a JSON body such as `{"status":"shipped"}` followed by `{"status":"delivered"}`. The server rejects transitions that are not in the contract's state machine.

The automated smoke test requires an isolated staging database containing an in-stock product and an active delivery zone, plus `E2E_API_URL`, `ADMIN_TOKEN`, and `OWNER_TOKEN` for that environment. It creates a new test customer, a test admin, and a Paystack test order; do not run it against production. The webhook simulation does not charge a payment method.

Product and avatar uploads are stored under `server/uploads/` and served from `/uploads/`. Keep this directory on persistent storage and include it in backups when deploying; uploads are not stored in MongoDB or an external image service.
