-- =============================================================================
-- Migration: Uniqueness de NIT en tenants
-- =============================================================================
-- Agrega constraint UNIQUE a tenants.nit para evitar duplicados
-- =============================================================================

-- Limpiar duplicados: si hay varios tenants con el mismo NIT,
-- mantener el más reciente y eliminar los anteriores
DELETE FROM tenants a
USING tenants b
WHERE a.nit = b.nit
  AND a.created_at < b.created_at;

-- Agregar constraint UNIQUE (debe pasar después de la limpieza)
ALTER TABLE tenants ADD CONSTRAINT tenants_nit_key UNIQUE (nit);
