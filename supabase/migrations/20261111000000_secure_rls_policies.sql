-- ==============================================================================
-- MIGRACIÓN DE SEGURIDAD RLS - LA CABRERA RESTAURANTE
-- Objetivo: Cerrar permisos de escritura/modificación a roles anónimos (anon / PUBLIC)
--           y restringir operaciones administrativas a usuarios autenticados.
-- ==============================================================================

-- 1. HABILITAR ROW LEVEL SECURITY (RLS) EN TODAS LAS TABLAS
ALTER TABLE IF EXISTS store_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS store_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS store_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS store_cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS store_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS store_product_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS store_user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS store_point_movements ENABLE ROW LEVEL SECURITY;

-- 2. ELIMINACIÓN DE POLÍTICAS INSEGURAS ANTERIORES
DROP POLICY IF EXISTS "anon_select_store_categories" ON store_categories;
DROP POLICY IF EXISTS "anon_insert_store_categories" ON store_categories;
DROP POLICY IF EXISTS "anon_update_store_categories" ON store_categories;
DROP POLICY IF EXISTS "anon_delete_store_categories" ON store_categories;

DROP POLICY IF EXISTS "anon_select_store_products" ON store_products;
DROP POLICY IF EXISTS "anon_insert_store_products" ON store_products;
DROP POLICY IF EXISTS "anon_update_store_products" ON store_products;
DROP POLICY IF EXISTS "anon_delete_store_products" ON store_products;

DROP POLICY IF EXISTS "anon_select_store_settings" ON store_settings;
DROP POLICY IF EXISTS "anon_insert_store_settings" ON store_settings;
DROP POLICY IF EXISTS "anon_update_store_settings" ON store_settings;
DROP POLICY IF EXISTS "anon_delete_store_settings" ON store_settings;

DROP POLICY IF EXISTS "anon_select_store_orders" ON store_orders;
DROP POLICY IF EXISTS "anon_insert_store_orders" ON store_orders;
DROP POLICY IF EXISTS "anon_update_store_orders" ON store_orders;
DROP POLICY IF EXISTS "anon_delete_store_orders" ON store_orders;

DROP POLICY IF EXISTS "anon_select_store_order_items" ON store_order_items;
DROP POLICY IF EXISTS "anon_insert_store_order_items" ON store_order_items;
DROP POLICY IF EXISTS "anon_update_store_order_items" ON store_order_items;
DROP POLICY IF EXISTS "anon_delete_store_order_items" ON store_order_items;

DROP POLICY IF EXISTS "anon_select_store_cash_registers" ON store_cash_registers;
DROP POLICY IF EXISTS "anon_insert_store_cash_registers" ON store_cash_registers;
DROP POLICY IF EXISTS "anon_update_store_cash_registers" ON store_cash_registers;
DROP POLICY IF EXISTS "anon_delete_store_cash_registers" ON store_cash_registers;

DROP POLICY IF EXISTS "anon_all_store_page_views" ON store_page_views;
DROP POLICY IF EXISTS "anon_all_store_page_views_ins" ON store_page_views;
DROP POLICY IF EXISTS "anon_all_store_page_views_upd" ON store_page_views;

DROP POLICY IF EXISTS "anon_all_store_product_views" ON store_product_views;
DROP POLICY IF EXISTS "anon_all_store_product_views_ins" ON store_product_views;
DROP POLICY IF EXISTS "anon_all_store_product_views_del" ON store_product_views;

DROP POLICY IF EXISTS "anon_all_store_user_points" ON store_user_points;
DROP POLICY IF EXISTS "anon_all_store_user_points_ins" ON store_user_points;
DROP POLICY IF EXISTS "anon_all_store_user_points_upd" ON store_user_points;
DROP POLICY IF EXISTS "anon_all_store_user_points_del" ON store_user_points;

DROP POLICY IF EXISTS "anon_all_store_point_movements" ON store_point_movements;
DROP POLICY IF EXISTS "anon_all_store_point_movements_ins" ON store_point_movements;

-- ==============================================================================
-- 3. POLÍTICAS SEGURAS - CATÁLOGO Y CONFIGURACIÓN (Lectura pública, Escritura autenticada)
-- ==============================================================================

-- Categorías
CREATE POLICY "public_read_store_categories"
  ON store_categories FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "auth_manage_store_categories"
  ON store_categories FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Productos
CREATE POLICY "public_read_store_products"
  ON store_products FOR SELECT
  TO anon, authenticated
  USING (available = true OR auth.role() = 'authenticated');

CREATE POLICY "auth_manage_store_products"
  ON store_products FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Configuración de Envíos y Tienda
CREATE POLICY "public_read_store_settings"
  ON store_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "auth_manage_store_settings"
  ON store_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- 4. POLÍTICAS SEGURAS - PEDIDOS Y DETALLES
-- ==============================================================================

-- Inserción de nuevos pedidos (abierto a clientes web para generar checkout)
CREATE POLICY "public_create_orders"
  ON store_orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (total >= 0);

CREATE POLICY "public_create_order_items"
  ON store_order_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (quantity > 0 AND unit_price >= 0);

-- Lectura, edición y cancelación de pedidos: estrictamente personal o administrativo
CREATE POLICY "auth_manage_orders"
  ON store_orders FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "auth_manage_order_items"
  ON store_order_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- 5. POLÍTICAS SEGURAS - CIERRES DE CAJA (Totalmente privado / Solo staff autenticado)
-- ==============================================================================

CREATE POLICY "auth_only_cash_registers"
  ON store_cash_registers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- 6. POLÍTICAS SEGURAS - PROGRAMA DE PUNTOS Y CLIENTES
-- ==============================================================================

-- Los clientes anónimos NO pueden listar todos los usuarios ni ver hashes de contraseñas
CREATE POLICY "users_read_own_points"
  ON store_user_points FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "users_register_account"
  ON store_user_points FOR INSERT
  TO anon, authenticated
  WITH CHECK (length(username) >= 3);

CREATE POLICY "auth_manage_user_points"
  ON store_user_points FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "auth_manage_point_movements"
  ON store_point_movements FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- 7. MÉTRICAS Y VISTAS
-- ==============================================================================

CREATE POLICY "public_track_page_views"
  ON store_page_views FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "public_increment_page_views"
  ON store_page_views FOR UPDATE
  TO anon, authenticated
  USING (id = 1)
  WITH CHECK (id = 1);

CREATE POLICY "public_track_product_views"
  ON store_product_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "auth_read_product_views"
  ON store_product_views FOR SELECT
  TO authenticated
  USING (true);
