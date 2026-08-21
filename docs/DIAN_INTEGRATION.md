# Integración de Facturación Electrónica DIAN — Documento de Arquitectura

> **Estado:** Solo documentación — No implementar todavía
> **Propósito:** Dejar el sistema preparado para que en el futuro la integración con un proveedor tecnológico autorizado por la DIAN sea sencilla.

---

## 1. Proveedores Tecnológicos Autorizados por la DIAN

Para emitir facturas electrónicas con validez legal en Colombia, VenxPOS debe integrarse con un **Proveedor Tecnológico (PT)** autorizado por la DIAN. El PT actúa como intermediario entre el sistema y la DIAN: genera, firma, transmite y almacena los documentos electrónicos.

### Proveedores recomendados (2026)

| Proveedor | Tipo | API | Costo estimado | Ideal para |
|-----------|------|-----|----------------|------------|
| **Siigo S.A.** | Software contable + PT | REST | Desde $50.000/mes | Negocios que también llevan contabilidad |
| **Carvajal Tecnología y Servicios** | PT puro | REST/SOAP | Desde $30.000/mes | Empresas que solo necesitan facturación |
| **Facele (Aliaddo)** | PT + API | REST | Desde $40.000/mes | Startups y SaaS que requieren integración API |
| **TFile** | PT puro | REST | Desde $25.000/mes | Facturación masiva |
| **Ol Software** | PT + POS | REST | Desde $35.000/mes | Comercios con POS |
| **Alegra** | Software contable + PT | REST | Desde $49.000/mes | Pymes |
| **Xubio** | Software contable + PT | REST | Desde $30.000/mes | Pymes |
| **Saphety** | PT puro | REST/SOAP | Desde $20.000/mes | Grandes volúmenes |

### Criterios de selección
1. **API REST moderna** (no SOAP) — facilita integración con Edge Functions
2. **Webhooks de estado** — notificar cuando DIAN acepta/rechaza
3. **Costo por factura** — para escalar con el número de clientes
4. **Certificación digital incluida** — algunos PT incluyen la firma en su plan

---

## 2. Cambios Requeridos en VenxPOS

### 2.1 Nuevas tablas

```sql
-- ============================================================
-- Resoluciones DIAN (rangos numéricos autorizados)
-- ============================================================
CREATE TABLE public.dian_resolutions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    sucursal_id     UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,
    numero_resolucion TEXT NOT NULL,
    prefijo         TEXT NOT NULL,  -- ej: VENX
    rango_desde     INTEGER NOT NULL,
    rango_hasta     INTEGER NOT NULL,
    fecha_expedicion DATE NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    activo          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Facturas electrónicas (documento DIAN)
-- ============================================================
CREATE TABLE public.facturas_electronicas (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factura_saas_id     UUID NOT NULL REFERENCES public.facturas_saas(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    -- Documento XML
    xml_firmado         TEXT NOT NULL,  -- XML firmado electrónicamente
    -- Identificadores DIAN
    cufe                TEXT,           -- Código Único de Facturación Electrónica (64 chars)
    cude                TEXT,           -- Código Único de Documento Electrónico
    qr_url              TEXT,           -- URL de verificación DIAN
    -- Tracking
    estado_dian         TEXT NOT NULL DEFAULT 'pendiente',
        CHECK (estado_dian IN ('pendiente','enviado','aceptada','rechazada','acuse_recibo'))
    respuesta_dian      JSONB,          -- Respuesta completa de la DIAN
    error_dian          TEXT,           -- Mensaje de error si fue rechazada
    -- Metadata
    numero_factura_dian TEXT,           -- Número asignado en resolución
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Certificados digitales (firma electrónica)
-- ============================================================
CREATE TABLE public.dian_certificates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    nombre_emisor   TEXT NOT NULL,
    numero_documento TEXT NOT NULL,  -- NIT del contribuyente
    certificado     TEXT NOT NULL,   -- Certificado en base64
    fecha_expiracion DATE NOT NULL,
    activo          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Log de envíos DIAN (auditoría)
-- ============================================================
CREATE TABLE public.dian_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factura_electronica_id UUID REFERENCES public.facturas_electronicas(id) ON DELETE CASCADE,
    accion          TEXT NOT NULL,  -- 'envio', 'consulta', 'reenvio'
    request_data    JSONB,
    response_data   JSONB,
    estado          TEXT NOT NULL,
    error           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2.2 Modificaciones a tablas existentes

```sql
-- Agregar columnas preparatorias a sucursales (ya existe resolucion_dian)
-- Verificar que sucursales.resolucion_dian existe y es TEXT

-- Agregar columnas a tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS dian_email TEXT;
COMMENT ON COLUMN public.tenants.dian_email IS 'Correo registrado ante la DIAN para notificaciones';

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS dian_certificate_id UUID REFERENCES public.dian_certificates(id);

-- Modificar facturas_saas para enlazar con factura electrónica
ALTER TABLE public.facturas_saas ADD COLUMN IF NOT EXISTS factura_electronica_id UUID REFERENCES public.facturas_electronicas(id);
```

### 2.3 Modificaciones a RPCs existentes

**`generar_numero_factura()` — Actualizar para usar resolución DIAN:**
- Leer de `dian_resolutions` el próximo número disponible según el prefijo y rango
- Reemplazar el contador simple `invoice_counter` por el rango de la resolución activa
- Si no hay resolución activa, usar el sistema actual (VENX-XXXXXX)

**`generar_factura_desde_pago()` — Disparar creación de factura electrónica:**
- Después de insertar en `facturas_saas`, llamar a Edge Function `generate-dian-xml`
- Marcar estado DIAN como `pendiente`

### 2.4 Nuevas Edge Functions

| Función | Propósito | Disparador |
|---------|-----------|------------|
| `generate-dian-xml` | Generar XML de factura electrónica según estándar UBL 2.1, firmar digitalmente | Llamada desde `generar_factura_desde_pago` |
| `send-dian` | Transmitir XML al proveedor tecnológico (PT), recibir CUFE | After generate-dian-xml |
| `check-dian-status` | Consultar estado de una factura en el PT / DIAN | CRON cada 5 min + retry |

### 2.5 Flujo completo

```
Pago aprobado (manual o automático)
        │
        ▼
generar_factura_desde_pago(p_payment_id)
  ├── Crea facturas_saas (estado='emitida')
  ├── Crea facturas_electronicas (estado_dian='pendiente')
  └── Llama a Edge Function: generate-dian-xml(factura_electronica_id)
        │
        ▼
generate-dian-xml (Edge Function)
  ├── Lee factura, tenant, sucursal, resolución DIAN
  ├── Construye XML UBL 2.1
  ├── Firma digitalmente con certificado del tenant
  ├── Guarda XML en facturas_electronicas.xml_firmado
  └── Llama a Edge Function: send-dian(factura_electronica_id)
        │
        ▼
send-dian (Edge Function)
  ├── Envía XML al Proveedor Tecnológico vía API REST
  ├── PT lo transmite a la DIAN
  ├── Recibe CUFE / respuesta
  ├── Actualiza facturas_electronicas (cufe, estado_dian='enviado')
  └── Programa check-dian-status para verificar aceptación
        │
        ▼
check-dian-status (CRON)
  ├── Consulta PT por facturas en estado 'enviado'
  ├── Si aceptada → estado_dian='aceptada', genera QR, actualiza PDF
  ├── Si rechazada → estado_dian='rechazada', notifica admin
  └── Si pendiente → reintenta después
        │
        ▼
generate-pdf (Edge Function existente)
  ├── Agrega QR con URL de verificación DIAN
  └── Agrega CUFE en el PDF
```

---

## 3. Tablas Adicionales Necesarias

| Tabla | Propósito | Registros esperados |
|-------|-----------|-------------------|
| `dian_resolutions` | Resoluciones de numeración por sucursal | 1-2 por sucursal (vigente + próximas) |
| `facturas_electronicas` | Documento electrónico con tracking DIAN | 1 por factura SaaS |
| `dian_certificates` | Certificados de firma digital por tenant | 1 por tenant |
| `dian_logs` | Auditoría de comunicaciones con PT/DIAN | Varios por factura |

---

## 4. Edge Functions a Crear y Modificar

### Nuevas
| Edge Function | Archivo | Dependencias |
|--------------|---------|-------------|
| `generate-dian-xml` | `supabase/functions/generate-dian-xml/index.ts` | `pdf-lib` (para firmas), XML builder |
| `send-dian` | `supabase/functions/send-dian/index.ts` | SDK del PT seleccionado |
| `check-dian-status` | `supabase/functions/check-dian-status/index.ts` | API del PT |

### Modificar
| Edge Function | Cambio |
|--------------|--------|
| `generate-pdf` | Agregar QR con CUFE y número de factura DIAN en el template |
| `generate-invoice` | Disparar `generate-dian-xml` después de crear la factura |

---

## 5. Información a Almacenar Desde Ahora

Para facilitar la integración futura, se recomienda **comenzar a almacenar**:

### Datos del negocio (ya existen)
- `tenants.nit` ✓ — NIT del contribuyente
- `sucursales.resolucion_dian` ✓ — Número de resolución DIAN
- `configuracion_fiscal.regimen_tributario` ✓ — Común o simplificado
- `configuracion_fiscal.tarifa_iva_default` ✓ — Tarifa IVA predeterminada

### Datos pendientes (agregar ahora)
- `tenants.dian_email` — Correo registrado ante la DIAN
- `tenants.dian_phone` — Teléfono de contacto DIAN
- `sucursales.dian_address` — Dirección fiscal (puede diferir de la comercial)
- `sucursales.dian_municipio_id` — Código Dane del municipio
- `productos.tarifa_impoconsumo` ✓ ya existe
- `productos.codigo_arancelario` — Código arancelario (si aplica)

### Configuración adicional
- Tipo de documento: `ventas` y `facuras_saas` deberían tener `tipo_operacion` (STANDARD, EXPORTACION, etc.)
- Forma de pago: `ventas.metodo_pago` ya existe → mapear a códigos DIAN (`1`=Efectivo, `2`=Tarjeta, etc.)

---

## 6. Estimación de Esfuerzo

| Componente | Tiempo estimado | Complejidad |
|-----------|----------------|-------------|
| Tablas y migraciones | 1 día | Baja |
| RPCs actualizados | 1 día | Media |
| Edge Function `generate-dian-xml` | 3 días | Alta (XML UBL, firma) |
| Edge Function `send-dian` | 2 días | Alta (integración PT) |
| Edge Function `check-dian-status` | 1 día | Media |
| Modificar `generate-pdf` (QR + CUFE) | 1 día | Baja |
| Modificar `generate-invoice` | 0.5 días | Baja |
| Pruebas con Sandbox DIAN | 2 días | Alta |
| **Total** | **~11.5 días** | |

---

## 7. Recomendaciones

1. **Esperar a tener 20+ clientes activos** antes de implementar — el costo del PT + desarrollo solo se justifica con volumen.
2. **Elegir Facele (Aliaddo) o TFile** como PT inicial por su API REST moderna y webhooks.
3. **Implementar primero para facturación de renovaciones** (las más predecibles), luego para activaciones y cambios de plan.
4. **No implementar facturación electrónica POS** en el MVP — la DIAN permite facturas POS en contingencia (formato .txt).
5. **Usar el servicio gratuito DIAN** como respaldo inicial si hay pocos clientes (< 5).
