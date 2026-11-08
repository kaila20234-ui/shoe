export function ok(res, data, { message, meta, status = 200 } = {}) {
  return res.status(status).json({
    success: true,
    data,
    ...(message ? { message } : {}),
    ...(meta ? { meta } : {}),
  });
}
