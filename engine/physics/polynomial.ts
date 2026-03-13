// Polynomial root finding — replaces numpy.roots for degree ≤ 4.

export function solvePolynomial(coeffs: number[]): number[] {
  if (coeffs.length === 2) return solveLinear(coeffs[0], coeffs[1]);
  if (coeffs.length === 3) return solveQuadratic(coeffs[0], coeffs[1], coeffs[2]);
  if (coeffs.length === 4) return solveCubic(coeffs[0], coeffs[1], coeffs[2], coeffs[3]);
  if (coeffs.length === 5) return solveQuartic(coeffs[0], coeffs[1], coeffs[2], coeffs[3], coeffs[4]);
  return [];
}

function solveLinear(a: number, b: number): number[] {
  if (a === 0) return [];
  return [-b / a];
}

function solveQuadratic(a: number, b: number, c: number): number[] {
  if (a === 0) return solveLinear(b, c);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return [];
  const sqrtDisc = Math.sqrt(disc);
  return [(-b + sqrtDisc) / (2 * a), (-b - sqrtDisc) / (2 * a)];
}

function solveCubic(a: number, b: number, c: number, d: number): number[] {
  if (a === 0) return solveQuadratic(b, c, d);

  // Depress: t = x - b/(3a)
  const p = (3 * a * c - b * b) / (3 * a * a);
  const q =
    (2 * b * b * b - 9 * a * b * c + 27 * a * a * d) / (27 * a * a * a);

  const disc = (q * q) / 4 + (p * p * p) / 27;
  const shift = -b / (3 * a);

  const roots: number[] = [];

  if (disc > 1e-12) {
    // One real root
    const sqrtDisc = Math.sqrt(disc);
    const u = Math.cbrt(-q / 2 + sqrtDisc);
    const v = Math.cbrt(-q / 2 - sqrtDisc);
    roots.push(u + v + shift);
  } else if (disc < -1e-12) {
    // Three real roots (casus irreducibilis)
    const r = Math.sqrt((-p * p * p) / 27);
    const theta = Math.acos((-q / 2) / r);
    const m = 2 * Math.cbrt(r);
    roots.push(
      m * Math.cos(theta / 3) + shift,
      m * Math.cos((theta + 2 * Math.PI) / 3) + shift,
      m * Math.cos((theta + 4 * Math.PI) / 3) + shift,
    );
  } else {
    // Repeated root
    const u = Math.cbrt(-q / 2);
    roots.push(2 * u + shift, -u + shift);
  }

  return roots;
}

function solveQuartic(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
): number[] {
  if (a === 0) return solveCubic(b, c, d, e);

  // Depress: x = t - b/(4a)
  const ba = b / a;
  const ca = c / a;
  const da = d / a;
  const ea = e / a;

  const p = ca - (3 * ba * ba) / 8;
  const q = (ba * ba * ba) / 8 - (ba * ca) / 2 + da;
  const r =
    (-3 * ba * ba * ba * ba) / 256 +
    (ba * ba * ca) / 16 -
    (ba * da) / 4 +
    ea;
  const shift = -ba / 4;

  if (Math.abs(q) < 1e-12) {
    // Biquadratic
    const qRoots = solveQuadratic(1, p, r);
    const roots: number[] = [];
    for (const t2 of qRoots) {
      if (t2 >= 0) {
        const s = Math.sqrt(t2);
        roots.push(s + shift, -s + shift);
      }
    }
    return roots;
  }

  // Resolvent cubic: m³ - p/2·m² - r·m + (pr/2 - q²/8) = 0
  const cubicRoots = solveCubic(1, -p / 2, -r, (p * r) / 2 - (q * q) / 8);

  // Pick a root where 2m - p > 0
  let m: number | null = null;
  for (const cr of cubicRoots) {
    if (2 * cr - p > 1e-12) {
      m = cr;
      break;
    }
  }
  if (m === null) return [];

  const sqrtVal = Math.sqrt(2 * m - p);

  const roots: number[] = [];
  // Two quadratics: t² ± sqrt(2m-p)·t + (m ∓ q/(2·sqrt(2m-p))) = 0
  const half = q / (2 * sqrtVal);
  roots.push(...solveQuadratic(1, sqrtVal, m - half));
  roots.push(...solveQuadratic(1, -sqrtVal, m + half));

  return roots.map((t) => t + shift);
}
