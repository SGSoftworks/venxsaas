UPDATE plans
SET features = (regexp_replace(features::text, 'Productos ilimitados', 'Sin limite de productos'))::jsonb
WHERE nombre = 'Pro'
  AND features::text LIKE '%Productos ilimitados%';
