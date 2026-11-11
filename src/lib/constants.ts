export const WA_NUMBER = (import.meta.env.VITE_WA_NUMBER as string | undefined) || '5493434478206';
export const ADMIN_PIN = (import.meta.env.VITE_ADMIN_PIN as string | undefined) || '775533';
export const STORE_LAT = Number(import.meta.env.VITE_STORE_LAT) || -31.7408;
export const STORE_LNG = Number(import.meta.env.VITE_STORE_LNG) || -60.4893;
export const MAX_DELIVERY_KM = Number(import.meta.env.VITE_MAX_DELIVERY_KM) || 12;

export const ORDER_STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending:    { label: 'Pendiente',     color: 'text-amber-700',   bg: 'bg-amber-100',   dot: 'bg-amber-500' },
  preparing:  { label: 'En preparación',color: 'text-blue-700',    bg: 'bg-blue-100',    dot: 'bg-blue-500' },
  delivered:  { label: 'Entregado',     color: 'text-green-700',   bg: 'bg-green-100',   dot: 'bg-green-500' },
  cancelled:  { label: 'Cancelado',     color: 'text-red-700',     bg: 'bg-red-100',     dot: 'bg-red-500' },
};

export const ORDER_COLUMNS: { key: string; label: string }[] = [
  { key: 'pending',   label: 'Pendiente' },
  { key: 'preparing', label: 'En preparación' },
  { key: 'delivered', label: 'Entregado' },
  { key: 'cancelled', label: 'Cancelado' },
];

export const photos = [
  'https://images.pexels.com/photos/37368697/pexels-photo-37368697.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/32912393/pexels-photo-32912393.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/37230382/pexels-photo-37230382.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/37025165/pexels-photo-37025165.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
];

export const initialCategories = [
  { id: 'cat-1', name: 'Empanadas', description: 'Caseras, abundantes y recién horneadas', display_order: 1 },
  { id: 'cat-2', name: 'Especialidades', description: 'Los favoritos de la casa', display_order: 2 },
  { id: 'cat-3', name: 'Bebidas', description: 'Para acompañar tu pedido', display_order: 3 },
];

export const initialProducts = [
  { id: 'prod-1', category_id: 'cat-1', name: 'Empanada de carne cortada a cuchillo', description: 'Carne, cebolla, morrón y especias de la casa.', price: 1800, image_url: photos[0], featured: true, stock: null, points: 18, is_reward: false, points_cost: 0, available: true, created_at: new Date().toISOString() },
  { id: 'prod-2', category_id: 'cat-1', name: 'Empanada de humita', description: 'Choclo cremoso, queso y un toque de albahaca.', price: 1700, image_url: photos[1], featured: false, stock: null, points: 17, is_reward: false, points_cost: 0, available: true, created_at: new Date().toISOString() },
  { id: 'prod-3', category_id: 'cat-1', name: 'Empanada salteña', description: 'La clásica, jugosa y bien condimentada.', price: 1800, image_url: photos[2], featured: true, stock: 24, points: 18, is_reward: false, points_cost: 0, available: true, created_at: new Date().toISOString() },
  { id: 'prod-4', category_id: 'cat-2', name: 'Docena surtida', description: 'Elegí tus sabores favoritos y compartí lo nuestro.', price: 19500, image_url: photos[3], featured: true, stock: 10, points: 195, is_reward: false, points_cost: 0, available: true, created_at: new Date().toISOString() },
  { id: 'prod-5', category_id: 'cat-2', name: 'Choripán criollo', description: 'Chorizo artesanal, chimichurri y pan tostado.', price: 6500, image_url: photos[0], featured: false, stock: 0, points: 65, is_reward: true, points_cost: 200, available: true, created_at: new Date().toISOString() },
  { id: 'prod-6', category_id: 'cat-3', name: 'Gaseosa línea Coca-Cola 1.5 L', description: 'Bien fría para completar la mesa.', price: 3200, image_url: photos[1], featured: false, stock: 8, points: 32, is_reward: false, points_cost: 0, available: true, created_at: new Date().toISOString() },
];

export const initialSettings = {
  id: 1,
  delivery_base: 1200,
  delivery_per_km: 450,
  store_lat: STORE_LAT,
  store_lng: STORE_LNG,
};
