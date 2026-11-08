import ApiError from '../utils/ApiError.js';

export function validate(schemas) {
  return (req, _res, next) => {
    for (const location of ['body', 'query', 'params']) {
      const schema = schemas[location];
      if (!schema) continue;
      const result = schema.safeParse(req[location]);
      if (!result.success) {
        const details = {};
        for (const issue of result.error.issues) {
          const field = issue.path.length ? issue.path.join('.') : location;
          details[field] = issue.message;
        }
        return next(new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', details));
      }
      req[location] = result.data;
    }
    return next();
  };
}
