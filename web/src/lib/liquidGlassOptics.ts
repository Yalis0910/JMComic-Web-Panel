/**
 * Analytic Liquid Glass Optical Displacement Map Generator
 *
 * Adapted from analytic rounded-rect surface-normal Snell refraction curves
 * (MIT-licensed optical concepts from rdev/liquid-glass-react, glassy-liquid, and shuding/liquid-glass).
 * Keeps the center flat and legible while concentrating optical bending within an 8–24px curved rim.
 */

export interface OpticalMapParams {
  width: number;
  height: number;
  radius: number;
  bezelWidth?: number;
  maxDisplacement?: number;
}

export interface OpticalMapResult {
  dataUrl: string;
  scale: number;
  width: number;
  height: number;
}

const mapCache = new Map<string, OpticalMapResult>();
let cachedSvgSupport: boolean | null = null;

/**
 * Detect Chromium-style SVG filter support for CSS backdrop-filter.
 * Safari and Firefox do not consistently apply SVG displacement maps to backdrop-filter.
 */
export function supportsBackdropSvgFilter(): boolean {
  if (cachedSvgSupport !== null) return cachedSvgSupport;
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    cachedSvgSupport = false;
    return false;
  }
  const reducedTransparency = window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches;
  if (reducedTransparency) {
    cachedSvgSupport = false;
    return false;
  }
  const ua = navigator.userAgent;
  const isChromium =
    (/Chrome|Chromium|Edg\//.test(ua) && !/OPR\//.test(ua)) ||
    (typeof (window as unknown as Record<string, unknown>).chrome !== 'undefined');
  const supportsBackdrop =
    typeof CSS !== 'undefined' &&
    (CSS.supports('backdrop-filter', 'blur(2px)') || CSS.supports('-webkit-backdrop-filter', 'blur(2px)'));

  cachedSvgSupport = Boolean(isChromium && supportsBackdrop);
  return cachedSvgSupport;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Signed distance and outward unit normal to a rounded rectangle centered at origin.
 * Returns distance inside edge (positive = inside, 0 = boundary) and inward normal pointing to center.
 */
function roundedRectInteriorNormal(
  x: number,
  y: number,
  halfW: number,
  halfH: number,
  r: number
): { distFromEdge: number; nx: number; ny: number } {
  const innerW = Math.max(0, halfW - r);
  const innerH = Math.max(0, halfH - r);

  const ax = Math.abs(x);
  const ay = Math.abs(y);

  const qx = ax - innerW;
  const qy = ay - innerH;

  // Outside core box -> rounded corner sector
  if (qx > 0 && qy > 0) {
    const cornerDist = Math.hypot(qx, qy);
    const distFromEdge = r - cornerDist;
    if (cornerDist > 1e-4) {
      const signX = x >= 0 ? 1 : -1;
      const signY = y >= 0 ? 1 : -1;
      return {
        distFromEdge,
        nx: -(qx / cornerDist) * signX,
        ny: -(qy / cornerDist) * signY,
      };
    }
  }

  // Flat side nearest edge
  const dxEdge = halfW - ax;
  const dyEdge = halfH - ay;
  if (dxEdge < dyEdge) {
    return {
      distFromEdge: dxEdge,
      nx: x >= 0 ? -1 : 1,
      ny: 0,
    };
  }
  return {
    distFromEdge: dyEdge,
    nx: 0,
    ny: y >= 0 ? -1 : 1,
  };
}

/**
 * Smooth convex lens refraction profile: 0 in center, smooth bend near edge.
 */
function snellEdgeProfile(t: number): number {
  // t in [0, 1], where 0 = outer boundary, 1 = inner flat zone
  const u = clamp(1 - t, 0, 1);
  // Smooth convex curve peaking smoothly toward the outer bezel
  return Math.pow(u, 2.2) * (1 - 0.18 * u);
}

export function generateOpticalDisplacementMap({
  width,
  height,
  radius,
  bezelWidth = 18,
  maxDisplacement = 18,
}: OpticalMapParams): OpticalMapResult | null {
  if (typeof document === 'undefined' || width < 16 || height < 16) return null;

  const w = Math.min(960, Math.round(width / 2) * 2);
  const h = Math.min(480, Math.round(height / 2) * 2);
  const effRadius = clamp(Math.round(radius), 4, Math.min(w, h) / 2);
  const effBezel = clamp(Math.round(bezelWidth), 8, Math.min(24, Math.min(w, h) / 2));
  const effScale = clamp(Math.round(maxDisplacement), 4, Math.floor(Math.min(w, h) * 0.25));

  const key = `${w}x${h}_r${effRadius}_b${effBezel}_s${effScale}`;
  const existing = mapCache.get(key);
  if (existing) return existing;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const img = ctx.createImageData(w, h);
  const data = img.data;
  const halfW = w / 2;
  const halfH = h / 2;

  for (let py = 0; py < h; py++) {
    const y = py + 0.5 - halfH;
    for (let px = 0; px < w; px++) {
      const x = px + 0.5 - halfW;
      const idx = (py * w + px) * 4;

      const { distFromEdge, nx, ny } = roundedRectInteriorNormal(x, y, halfW, halfH, effRadius);

      let dispX = 0;
      let dispY = 0;

      if (distFromEdge >= 0 && distFromEdge < effBezel) {
        const mag = snellEdgeProfile(distFromEdge / effBezel);
        dispX = nx * mag;
        dispY = ny * mag;
      }

      data[idx] = clamp(Math.round(128 + dispX * 127), 0, 255);
      data[idx + 1] = clamp(Math.round(128 + dispY * 127), 0, 255);
      data[idx + 2] = 128;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const result: OpticalMapResult = {
    dataUrl: canvas.toDataURL('image/png'),
    scale: effScale,
    width: w,
    height: h,
  };

  if (mapCache.size > 60) {
    const firstKey = mapCache.keys().next().value;
    if (firstKey) mapCache.delete(firstKey);
  }
  mapCache.set(key, result);
  return result;
}
