export type DeliveryType = 'pickup' | 'delivery';
export type OrderStatus = 'pending' | 'preparing' | 'delivered' | 'cancelled';
export type PaymentMethod = 'cash' | 'transfer';

export interface Category {
  id: string;
  name: string;
  description: string;
  image_url?: string;
  display_order: number;
}

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  description: string;
  price: number;
  image_url: string;
  images?: string[];
  available: boolean;
  featured: boolean;
  stock: number | null;
  points: number;
  is_reward?: boolean;
  points_cost?: number;
}

export interface Settings {
  id: number;
  delivery_base: number;
  delivery_per_km: number;
  store_lat: number;
  store_lng: number;
}

export interface CartItem extends Product {
  quantity: number;
  /** true = este ítem es un canje de puntos, false/undefined = compra normal */
  redeemed_with_points?: boolean;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface Order {
  id: string;
  order_code: string;
  customer_name: string;
  customer_phone: string;
  customer_notes: string;
  delivery_type: DeliveryType;
  delivery_address: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: OrderStatus;
  is_paid: boolean;
  payment_method: PaymentMethod;
  created_at: string;
  earned_points?: number;
  customer_username?: string;
  closed_in_register?: boolean;
}

export interface CashRegister {
  id: string;
  opened_at: string;
  closed_at: string;
  cash_total: number;
  transfer_total: number;
  grand_total: number;
  order_count: number;
}

export interface UserPoints {
  id: string;
  username: string;
  password?: string;
  name: string;
  points: number;
}
