# Shoe Store API

## Run locally

Use Node.js 20 and MongoDB. From `server/`, copy `.env.example` to `.env`, set `MONGODB_URI` and `JWT_SECRET`, then run:

```sh
npm install
npm run dev
```

The API listens on port 5000 by default. `GET /api/health` is available for a health check. `npm start` starts the production server.

## Seed development data

With MongoDB running and the environment configured, run `npm run seed`. The script safely inserts the three development accounts, three delivery zones, two discounts, and twelve sample products. The password for all three accounts is `Passw0rd!123`.

## Shared backend helpers

Commerce modules import the shared contract helpers from:

- `src/models/index.js`: `User`, `Product`, `Cart`, `Order`, `Transaction`, `Discount`, `DeliveryZone`, `Review`, `ReturnRequest`, `AuditLog`
- `src/middleware/auth.js`: `authenticate`, `authorize(...roles)`
- `src/middleware/validate.js`: `validate({ body, query, params })`
- `src/middleware/errorHandler.js`: API error-envelope handler
- `src/utils/ApiError.js`: `ApiError(status, code, message, details?)`
- `src/utils/asyncHandler.js`: `asyncHandler(fn)`
- `src/utils/respond.js`: `ok(res, data, { message, meta, status })`
- `src/utils/paginate.js`: `parsePagination(query)`, `buildMeta(page, limit, total)`
- `src/utils/audit.js`: `logAudit(req, { action, entity, entityId, meta })`
- `src/utils/mailer.js`: `sendMail({ to, subject, html })`

All success responses use the shared envelope and all errors are normalized by the final error handler.
