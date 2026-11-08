export function ok(res, data, { message, meta, status = 200 } = {}) {
  const body = { success: true, data };
  if (message !== undefined) body.message = message;
  if (meta !== undefined) body.meta = meta;
  return res.status(status).json(body);
}
