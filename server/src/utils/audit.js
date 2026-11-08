import { AuditLog } from '../models/index.js';

export async function logAudit(req, { action, entity, entityId, meta }) {
  try {
    const actor = req.user;
    if (!actor) return;
    await AuditLog.create({
      actorId: String(actor.id),
      actorName: actor.name,
      actorRole: actor.role,
      action,
      entity,
      entityId: String(entityId),
      ...(meta !== undefined ? { meta } : {}),
    });
  } catch (error) {
    console.error('Unable to write audit log:', error);
  }
}
