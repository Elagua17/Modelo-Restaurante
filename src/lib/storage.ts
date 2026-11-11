import { initialCategories, initialProducts, initialSettings } from '@/lib/constants';

export function getLocalData<T>(key: string, initialFallback: T): T {
  try {
    const data = localStorage.getItem(`db_${key}`);
    if (!data) {
      setLocalData(key, initialFallback);
      return initialFallback;
    }
    return JSON.parse(data);
  } catch {
    return initialFallback;
  }
}

export function setLocalData<T>(key: string, data: T): void {
  try {
    localStorage.setItem(`db_${key}`, JSON.stringify(data));
  } catch (err) {
    console.error(`Error guardando en almacenamiento local (${key}):`, err);
  }
}

// Inicialización de colecciones en almacenamiento local
export function initStorage() {
  getLocalData('store_categories', initialCategories);
  getLocalData('store_products', initialProducts);
  getLocalData('store_settings', [initialSettings]);
  getLocalData('store_orders', []);
  getLocalData('store_order_items', []);
  getLocalData('store_user_points', []);
  getLocalData('store_point_movements', []);
  getLocalData('store_cash_registers', []);
  getLocalData('store_page_views', [{ id: 1, count: 0 }]);
  getLocalData('store_product_views', []);
}
