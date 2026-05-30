/** Initial bearing from point A to B in degrees (0 = north, clockwise). */
export function bearingDeg(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function normalizeDegrees(angle: number): number {
  let value = angle % 360;
  if (value < 0) value += 360;
  return value;
}

export function shortestAngleDiff(fromDeg: number, toDeg: number): number {
  let diff = normalizeDegrees(toDeg - fromDeg);
  if (diff > 180) diff -= 360;
  return diff;
}
