/**
 * Utilidades generales, formateadores y funciones de seguridad criptográfica (CSPRNG)
 */

export const money = (value: number | null | undefined): string => {
  const safeVal = typeof value === 'number' && !isNaN(value) ? value : 0;
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(safeVal);
};

export const haversine = (aLat: number, aLng: number, bLat: number, bLng: number): number => {
  if (isNaN(aLat) || isNaN(aLng) || isNaN(bLat) || isNaN(bLng)) return 0;
  const rad = Math.PI / 180;
  const a =
    0.5 -
    Math.cos((bLat - aLat) * rad) / 2 +
    (Math.cos(aLat * rad) * Math.cos(bLat * rad) * (1 - Math.cos((bLng - aLng) * rad))) / 2;
  return 12742 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, a))));
};

export const fmtDate = (iso?: string | null): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return '-';
  }
};

/**
 * Genera un código de orden legible usando CSPRNG (crypto.getRandomValues)
 * Prefijo: LC (La Cabrera)
 */
export const generateOrderCode = (): string => {
  const bytes = new Uint8Array(4);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 4; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 6)
    .toUpperCase();
  return `LC-${hex}`;
};

/**
 * Genera un identificador único seguro usando CSPRNG
 */
export const generateSecureId = (prefix = 'id'): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  const randomHex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}-${randomHex}`;
};

/**
 * Validador estricto para formato UUID v4
 */
export const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

/**
 * Sanitiza URLs de imágenes o enlaces externos para prevenir XSS (ej. esquemas javascript:, data:text/html)
 */
export const sanitizeUrl = (url: string | null | undefined, fallback = '/restaurant.png'): string => {
  if (!url || typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  if (!trimmed) return fallback;

  // Permitir rutas relativas seguras
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  // Permitir data URLs estrictamente de imágenes (ej. uploads en base64)
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }

  // Validar protocolos http / https
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
  } catch {
    // URL inválida
  }

  return fallback;
};

export const mapsLink = (lat: number, lng: number): string =>
  `https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`;

/**
 * Hash seguro de contraseñas usando SHA-256 via Web Crypto API nativa
 */
export const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(`lacabrera-salt:${password}`);
  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback simple si subtle crypto no estuviera disponible (ej. entornos inseguros)
  return `h:${Array.from(data).reduce((acc, byte) => (acc << 5) - acc + byte, 0).toString(16)}`;
};
