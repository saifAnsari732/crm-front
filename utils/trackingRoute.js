const EARTH_RADIUS_KM = 6371;
const toRadians = (value) => (value * Math.PI) / 180;

export function distanceKm(first, second) {
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const latitudeOne = toRadians(first.latitude);
  const latitudeTwo = toRadians(second.latitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeOne) * Math.cos(latitudeTwo) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

const perpendicularDistance = (point, start, end) => {
  const x = point.longitude;
  const y = point.latitude;
  const startX = start.longitude;
  const startY = start.latitude;
  const endX = end.longitude;
  const endY = end.latitude;
  const denominator = Math.hypot(endX - startX, endY - startY);
  if (!denominator) return distanceKm(point, start) * 1000;
  return Math.abs((endY - startY) * x - (endX - startX) * y + endX * startY - endY * startX) / denominator * 111320;
};

const simplify = (points, toleranceMeters) => {
  if (points.length <= 2) return points;
  let farthestIndex = 0;
  let farthestDistance = 0;
  const lastIndex = points.length - 1;
  for (let index = 1; index < lastIndex; index += 1) {
    const currentDistance = perpendicularDistance(points[index], points[0], points[lastIndex]);
    if (currentDistance > farthestDistance) {
      farthestDistance = currentDistance;
      farthestIndex = index;
    }
  }
  if (farthestDistance <= toleranceMeters) return [points[0], points[lastIndex]];
  const left = simplify(points.slice(0, farthestIndex + 1), toleranceMeters);
  const right = simplify(points.slice(farthestIndex), toleranceMeters);
  return left.slice(0, -1).concat(right);
};

export function cleanTrackingRoute(coordinates = []) {
  const normalized = coordinates
    .map((point) => ({
      latitude: Number(point.latitude ?? point.lat),
      longitude: Number(point.longitude ?? point.lng),
      timestamp: point.timestamp ? new Date(point.timestamp).getTime() : null,
    }))
    .filter((point) => Number.isFinite(point.latitude)
      && Number.isFinite(point.longitude)
      && Math.abs(point.latitude) <= 90
      && Math.abs(point.longitude) <= 180);

  if (normalized.length <= 2) return normalized;

  const stable = [normalized[0]];
  normalized.slice(1).forEach((point) => {
    const previous = stable[stable.length - 1];
    const distance = distanceKm(previous, point);
    const seconds = previous.timestamp && point.timestamp
      ? Math.max(1, (point.timestamp - previous.timestamp) / 1000)
      : null;
    const speed = seconds ? distance * 3600 / seconds : 0;

    // Collapse GPS drift and reject impossible city-scale jumps.
    if (distance < 0.008) return;
    if (seconds && speed > 160 && distance > 0.25) return;
    stable.push(point);
  });

  const simplified = simplify(stable, 8);
  return simplified.map(({ latitude, longitude }) => ({ latitude, longitude }));
}
