-- Reactiva todas las cuentas suspendidas (MVP: suspension manual deshabilitada)
UPDATE tenants
SET estado = 'active',
    updated_at = now()
WHERE estado = 'suspended';

-- Reactiva suscripciones canceladas por suspension para que el acceso quede consistente
UPDATE subscriptions
SET estado = 'active',
    updated_at = now()
WHERE estado = 'suspended';
