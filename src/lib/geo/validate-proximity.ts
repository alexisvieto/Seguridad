import type { GpsCoordinates } from '@/shared/types/database';

const MAX_DISTANCE_METERS = 200;

/**
 * Calculates the distance in meters between two GPS points using the
 * Haversine formula.
 *
 * TODO: Wire up once properties_ph stores a reference GPS coordinate.
 * The formula below is production-ready — only the data source is pending.
 */
function haversineDistance(a: GpsCoordinates, b: GpsCoordinates): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLng = Math.sin(dLng / 2);

  const h =
    sinHalfLat * sinHalfLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinHalfLng * sinHalfLng;

  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Validates that the agent's GPS coordinates are within acceptable range
 * of the work station's property.
 *
 * Currently returns `true` (placeholder) because `properties_ph` does not
 * yet store a reference lat/lng. Once added:
 *
 * ```ts
 * const distance = haversineDistance(agentGps, propertyGps);
 * return { valid: distance <= MAX_DISTANCE_METERS, distance };
 * ```
 */
export function validateGpsProximity(
  agentGps: GpsCoordinates,
  _propertyGps?: GpsCoordinates | null,
): { valid: boolean; distance: number } {
  if (!_propertyGps) {
    return { valid: true, distance: 0 };
  }

  const distance = haversineDistance(agentGps, _propertyGps);
  return { valid: distance <= MAX_DISTANCE_METERS, distance };
}
