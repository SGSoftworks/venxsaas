export interface PlanBreakdown {
  activacion_venxpos: number
  configuracion_inventario: number
  primera_mensualidad: number
}

export interface PlanConfig {
  id: string
  nombre: string
  mensualidad: number
  implementacion: number
  sucursales: number
  administradores: number
  limite_productos: number | 'ilimitado'
  desglose_activacion: PlanBreakdown
  features: string[]
  badge: string
  highlighted: boolean
}

export const PLANS_CONFIG: Record<string, PlanConfig> = {
  basico: {
    id: 'basico_v2',
    nombre: 'Básico',
    mensualidad: 110900,
    implementacion: 1490000,
    sucursales: 1,
    administradores: 1,
    limite_productos: 1000,
    desglose_activacion: {
      activacion_venxpos: 650000,
      configuracion_inventario: 729100,
      primera_mensualidad: 110900,
    },
    features: [
      'Implementación inicial',
      'Configuración completa del sistema',
      '1 sucursal incluida',
      'Hasta 1.000 productos',
      'Administradores incluidos según configuración',
      'Soporte por WhatsApp',
      'Atención Lunes a Viernes',
      '7:00 AM a 7:00 PM',
    ],
    badge: 'Ideal para pequeños negocios',
    highlighted: false,
  },
  estandar: {
    id: 'estandar_v2',
    nombre: 'Estándar',
    mensualidad: 229900,
    implementacion: 1690000,
    sucursales: 4,
    administradores: 4,
    limite_productos: 5000,
    desglose_activacion: {
      activacion_venxpos: 600000,
      configuracion_inventario: 860100,
      primera_mensualidad: 229900,
    },
    features: [
      'Implementación inicial',
      'Configuración completa',
      '4 sucursales incluidas',
      'Hasta 5.000 productos',
      'Reportes avanzados',
      'Inventario avanzado',
      'Soporte por WhatsApp',
      'Atención Lunes a Viernes',
      '7:00 AM a 7:00 PM',
    ],
    badge: 'Más vendido',
    highlighted: true,
  },
  pro: {
    id: 'pro_v2',
    nombre: 'Pro',
    mensualidad: 449900,
    implementacion: 1990000,
    sucursales: 10,
    administradores: 10,
    limite_productos: 'ilimitado',
    desglose_activacion: {
      activacion_venxpos: 550000,
      configuracion_inventario: 990100,
      primera_mensualidad: 449900,
    },
    features: [
      'Implementación completa',
      'Configuración empresarial',
      'Hasta 10 sucursales',
      'Productos ilimitados',
      'Reportes personalizados',
      'Analíticas avanzadas',
      'Soporte por WhatsApp',
      'Atención Lunes a Viernes',
      '7:00 AM a 7:00 PM',
    ],
    badge: 'Empresas en crecimiento',
    highlighted: false,
  },
}

export function getPlanConfigByName(nombre: string): PlanConfig | undefined {
  const normalizedName = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "")
  return Object.values(PLANS_CONFIG).find(
    p => p.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "") === normalizedName
  )
}

export const IMPLEMENTACION_DETALLE = [
  'Configuración del software',
  'Creación de empresa',
  'Configuración de usuarios',
  'Parametrización inicial',
  'Configuración de sucursales',
  'Configuración tributaria',
  'Registro inicial de inventario',
  'Activación de la licencia',
  'Primera mensualidad incluida',
]
