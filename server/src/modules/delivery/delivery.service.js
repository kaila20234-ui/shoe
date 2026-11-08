import { DeliveryZone } from '../../models/index.js';

export async function listActiveZones() {
  return DeliveryZone.find({ isActive: true }).sort({ name: 1 });
}
