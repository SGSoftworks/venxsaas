-- VenxPos — Añadir columnas para Inventory Manager
ALTER TABLE productos ADD COLUMN IF NOT EXISTS es_favorito BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock_minimo DECIMAL(12,3) NOT NULL DEFAULT 10;

CREATE INDEX IF NOT EXISTS idx_productos_favoritos ON productos(sucursal_id, es_favorito DESC);
