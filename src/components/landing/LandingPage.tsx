import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { buildWhatsAppUrl, APP_CONFIG } from '@/lib/appConfig'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import logoSaaS from '@/assets/branding/logo-saas.png'
const posLink = APP_CONFIG.POS_WEB_URL
import {
  Package,
  Shield,
  Lock,
  Check,
  Search,
  ChevronDown,
  ArrowRight,
  Menu,
  X,
  ArrowUp,
  AlertTriangle,
  FileSpreadsheet,
  DollarSign,
  ExternalLink,
  TrendingUp,
  Layers,
  RefreshCw,
  CreditCard,
  Store,
  BarChart3,
  Bell,
  Receipt,
  Tag,
  FileText,
  MessageCircle,
  Monitor,
  Mail,
  MapPin,
  Settings,
  GraduationCap,
  Sliders,
  Zap,
  HeartHandshake,
} from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const problems = [
  {
    icon: AlertTriangle,
    title: 'Inventario disperso',
    description:
      'Cada sucursal maneja su inventario por separado. Nunca sabes qué producto está disponible en cada tienda sin llamar o escribir.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Reportes manuales',
    description:
      'Pasas horas armando reportes en Excel al final del día. Los datos llegan tarde y con errores de digitación.',
  },
  {
    icon: DollarSign,
    title: 'Control de caja inexistente',
    description:
      'No tienes visibilidad de cuánto dinero entra y sale en tiempo real. Los arqueos son un dolor de cabeza semanal.',
  },
]

const features = [
  {
    icon: Layers,
    title: 'Multi-sucursal',
    description:
      'Gestiona todas tus tiendas desde un solo lugar. Control centralizado con reportes por sucursal y consolidados.',
  },
  {
    icon: Package,
    title: 'Inventario en tiempo real',
    description:
      'Control preciso de stock con alertas de mínimo. Actualización instantánea entre sucursales.',
  },
  {
    icon: TrendingUp,
    title: 'Reportes avanzados',
    description:
      'Ventas, productos, cierres de caja y más. Filtra por fecha, sucursal o categoría.',
  },
  {
    icon: Shield,
    title: 'Control de caja',
    description:
      'Apertura, cierre y arqueo de caja con trazabilidad completa. Concilia ingresos y egresos fácilmente.',
  },
  {
    icon: Lock,
    title: 'Seguridad',
    description:
      'PIN de administrador, roles granulares y auditoría completa de cada operación en el sistema.',
  },
  {
    icon: RefreshCw,
    title: 'Funciona offline',
    description:
      'Opera sin conexión a internet. Sincroniza automáticamente cuando recuperes la red.',
  },
]

const plans = [
  {
    name: 'Básico',
    badge: 'Ideal para pequeños negocios',
    setup: '$1.490.000',
    monthly: '$110.900',
    features: [
      'Implementación inicial',
      'Configuración completa',
      '1 sucursal incluida',
      'Hasta 1.000 productos',
      'Administradores incluidos según configuración',
      'Inventario general',
      'Soporte por WhatsApp',
      'Atención Lunes a Viernes',
      '7:00 AM a 7:00 PM',
    ],
    highlighted: false,
  },
  {
    name: 'Estándar',
    badge: 'Más vendido',
    setup: '$1.690.000',
    monthly: '$229.900',
    features: [
      'Implementación inicial',
      'Configuración completa',
      '4 sucursales incluidas',
      'Hasta 5.000 productos',
      'Reportes generales',
      'Inventario general y por sucursal',
      'Soporte por WhatsApp',
      'Atención Lunes a Viernes',
      '7:00 AM a 7:00 PM',
    ],
    highlighted: true,
  },
  {
    name: 'Pro',
    badge: 'Empresas en crecimiento',
    setup: '$1.990.000',
    monthly: '$449.900',
    features: [
      'Implementación completa',
      'Configuración empresarial',
      'Hasta 10 sucursales',
      'Productos ilimitados',
      'Reportes generales y personalizados',
      'Analíticas generales',
      'Soporte por WhatsApp',
      'Atención Lunes a Viernes',
      '7:00 AM a 7:00 PM',
    ],
    highlighted: false,
  },
]

const implementationBenefits = [
  {
    icon: Settings,
    title: 'Configuración personalizada',
    desc: 'Ajustamos VenxPOS a la operación de tu negocio, no al revés.',
  },
  {
    icon: GraduationCap,
    title: 'Capacitación inicial',
    desc: 'Te enseñamos a usar el sistema para que saques el máximo provecho desde el día uno.',
  },
  {
    icon: Sliders,
    title: 'Parametrización',
    desc: 'Configuramos impuestos, formas de pago, categorías y todo lo necesario.',
  },
  {
    icon: Package,
    title: 'Inventario',
    desc: 'Cargamos tus productos iniciales para que empieces a vender de inmediato.',
  },
  {
    icon: Zap,
    title: 'Activación',
    desc: 'Ponemos en marcha tu cuenta con todas las funcionalidades listas.',
  },
  {
    icon: HeartHandshake,
    title: 'Soporte inicial',
    desc: 'Te acompañamos durante los primeros días para resolver cualquier duda.',
  },
]

const faqItems = [
  {
    question: '¿Cómo funciona el período de prueba?',
    answer:
      'Ofrecemos un período de prueba de 3 días para que explores todas nuestras funcionalidades sin compromiso. Para que tu experiencia sea inmediata y eficiente, te proporcionaremos un usuario y una clave de acceso con información precargada (productos, facturas, cuentas y métricas). Esto te permitirá realizar pruebas rápidas y verificar el funcionamiento real del sistema antes de elegir el plan que mejor se adapte a tu negocio.',
  },
  {
    question: '¿Puedo cambiar de plan después?',
    answer:
      'Sí. Puedes solicitar un cambio de plan en cualquier momento comunicándote con nuestro gerente vía WhatsApp. El proceso se realiza de manera personalizada para acordar los ajustes necesarios y las diferencias de tarifa, asegurando siempre que cuentes con la solución que mejor se adapte a tu operación actual.',
  },
  {
    question: '¿Qué métodos de pago aceptan?',
    answer:
      'Aceptamos PSE, tarjetas (crédito/débito), Nequi y Daviplata, además de transferencia bancaria y Bre-B. El método de pago puede variar según la negociación. Todos los pagos generan una factura electrónica formal.',
  },
  {
    question: '¿Mis datos están seguros?',
    answer:
      'Absolutamente. Usamos cifrado AES-256, conexiones TLS 1.3, nuestra infraestructura está alojada en servidores AWS con certificación SOC 2 y las contraseñas se almacenan con hash bcrypt. Los datos se respaldan diariamente y contamos con control de acceso basado en roles.',
  },
  {
    question: '¿Cómo agrego más sucursales?',
    answer:
      'Puedes añadir nuevas sucursales en cualquier momento desde tu panel de administración. El número de sucursales habilitadas dependerá de las condiciones de tu plan actual. Para verificar cuántas tienes disponibles o realizar una ampliación, revisa el detalle de tu suscripción o escríbenos a nuestro equipo de soporte por WhatsApp.',
  },
  {
    question: '¿Tienen soporte técnico?',
    answer:
      'Sí. Contamos con un equipo de soporte técnico disponible de lunes a viernes, entre las 7:00 a.m. y las 7:00 p.m. Ten en cuenta que este servicio no opera durante fines de semana ni días festivos. Si tienes alguna consulta fuera de este horario, puedes dejarnos tu mensaje y te responderemos a la brevedad posible al iniciar nuestra jornada.',
  },
  {
    question: '¿Cómo adquiero VenxPOS?',
    answer:
      'Para adquirir VenxPOS, debes comunicarte con nuestro equipo de ventas a través de WhatsApp. La Gerencia creará tu cuenta y te proporcionará las credenciales de acceso. No existe registro público ni autogestionado. Todo el proceso es personalizado para garantizar que el sistema se ajuste a las necesidades de tu negocio.',
  },
  {
    question: '¿Cómo solicito una cotización?',
    answer:
      'Puedes solicitar una cotización personalizada a través del botón "Cotizar Ahora" en nuestro sitio web o contactándonos directamente por WhatsApp. Te enviaremos una propuesta detallada con los planes disponibles, costos de implementación y mensualidades según las necesidades de tu negocio.',
  },
  {
    question: '¿Qué incluye el pago inicial?',
    answer:
      'El pago inicial cubre la implementación completa del sistema: configuración técnica de tu cuenta, parametrización del sistema según tu negocio, carga de productos iniciales, activación de cuenta y capacitación inicial. Este pago no es reembolsable una vez iniciado el proceso de implementación.',
  },
  {
    question: '¿Qué incluye la mensualidad?',
    answer:
      'La mensualidad incluye el acceso completo a todas las funcionalidades del plan contratado, almacenamiento en la nube, soporte técnico, actualizaciones del sistema, facturación electrónica y respaldo diario de datos. No incluye costos de implementación, configuraciones adicionales ni servicios no contemplados en el plan.',
  },
  {
    question: '¿Cómo solicito una renovación?',
    answer:
      'Las renovaciones se gestionan mediante solicitud a través de WhatsApp. Una vez procesado el pago, tu suscripción se extiende por un período adicional de 30 días calendario. Te recomendamos solicitar la renovación antes de la fecha de vencimiento para evitar interrupciones en el servicio.',
  },
  {
    question: '¿Qué pasa si no pago?',
    answer:
      'Si no realizas el pago de tu suscripción dentro del período establecido, el servicio será suspendido. Recibirás una notificación con al menos 5 días de anticipación. Una vez regularizado el pago, el servicio se restablecerá en un plazo máximo de 24 horas. Tus datos se conservan durante 90 días después de la cancelación.',
  },
  {
    question: '¿Qué sucede si olvido mi contraseña?',
    answer:
      'Si olvidas tu contraseña, puedes solicitar un restablecimiento a través de la Gerencia por WhatsApp para que te asignen una nueva contraseña temporal.',
  },
  {
    question: '¿Cómo descargo mis facturas?',
    answer:
      'Puedes descargar tus facturas desde la sección "Facturación" en tu panel de administración. Todas las facturas están disponibles en formato PDF. También recibirás una copia por correo electrónico si lo pides desde atención al cliente por medio de WhatsApp.',
  },
  {
    question: '¿Cómo contacto soporte?',
    answer:
      'Puedes contactar a nuestro equipo de soporte a través de WhatsApp al 3228372341 o por correo electrónico a juan.dev1809@gmail.com. El horario de atención es de lunes a viernes de 7:00 a.m. a 7:00 p.m. Las consultas recibidas fuera de este horario serán respondidas al inicio de la siguiente jornada laboral.',
  },
  {
    question: '¿Cuántas sucursales puedo crear?',
    answer:
      'El número de sucursales depende del plan contratado. El Plan Básico incluye 1 sucursal, el Plan Estándar hasta 4 sucursales y el Plan Pro hasta 10 sucursales. Si necesitas más sucursales, puedes contactarnos para evaluar una solución personalizada.',
  },
  {
    question: '¿Existe límite de productos?',
    answer:
      'El límite de productos varía según el plan. El Plan Básico incluye hasta 1,000 productos, el Plan Estándar hasta 5,000 productos y el Plan Pro no tiene límite de productos. Todos los planes permiten gestionar el inventario en tiempo real.',
  },
  {
    question: '¿Dónde puedo ver mi suscripción?',
    answer:
      'Puedes ver todos los detalles de tu suscripción en la sección "Mi Suscripción" del panel de administración. Allí encontrarás información sobre tu plan actual, fecha de vencimiento, histórico de pagos y opciones para cambiar de plan o cancelar la suscripción.',
  },
  {
    question: '¿Cómo funciona el inventario?',
    answer:
      'El inventario de VenxPOS se actualiza en tiempo real. Cada venta descuenta automáticamente el stock, puedes configurar alertas de mínimo inventario, transferir productos entre sucursales y consultar el historial de movimientos. También puedes importar y exportar productos mediante archivos.',
  },
  {
    question: '¿Puedo importar o exportar productos?',
    answer:
      'Sí. VenxPOS permite importar productos desde archivos CSV o Excel para facilitar la carga inicial de tu inventario. También puedes exportar tu catálogo de productos en varios formatos para respaldo o análisis externo.',
  },
  {
    question: '¿Cómo se sincroniza con el POS?',
    answer:
      'El Sistema POS y el Panel Administrativo (SaaS) comparten la misma base de datos, por lo que la sincronización es automática e instantánea. Las ventas registradas en el POS se reflejan de inmediato en el inventario, reportes y analíticas del panel administrativo.',
  },
  {
    question: '¿Qué navegadores son compatibles?',
    answer:
      'VenxPOS es compatible con las versiones modernas de Google Chrome, Mozilla Firefox, Microsoft Edge y Safari. Recomendamos utilizar la versión más reciente de tu navegador preferido para garantizar el mejor rendimiento y la experiencia óptima.',
  },
  {
    question: '¿Qué tecnologías utiliza VenxPOS?',
    answer:
      'VenxPOS está construido con tecnologías modernas: React, TypeScript, TailwindCSS, Supabase para base de datos y autenticación, y está alojado en infraestructura AWS. El Sistema POS es una aplicación web independiente accesible desde cualquier navegador.',
  },
  {
    question: '¿Qué ocurre si cancelo mi suscripción? ¿Puedo volver después?',
    answer:
      'Si cancelas tu suscripción, mantienes acceso completo hasta el final del ciclo de facturación pagado. Tus datos se eliminaran después de la cancelación. Transcurrido ese plazo, los datos se eliminan irreversiblemente. Si deseas volver después, puedes contactarnos para crear una nueva cuenta.',
  },
  {
    question: '¿Qué pasa cuando mi plan vence?',
    answer:
      'Cuando tu plan vence, el servicio se suspende automáticamente. Recibirás notificaciones antes del vencimiento para que puedas renovar a tiempo. Durante los primeros días después del vencimiento, tus datos permanecen intactos y puedes reactivar el servicio contactando a la Gerencia por WhatsApp.',
  },
]

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrolled(window.scrollY > 20)
          ticking = false
        })
        ticking = true
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id: string) => {
    setMobileOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const navLinks = [
    { label: 'Características', target: 'features' },
    { label: 'Planes', target: 'pricing' },
    { label: 'FAQ', target: 'faq' },
  ]

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-xl border-b border-slate-200/60 shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center shrink-0">
            <img src={logoSaaS} alt="VenxPOS" className="h-10 hidden sm:block" />
            <img src={logoSaaS} alt="VenxPOS" className="h-8 sm:hidden" />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <button
                key={link.target}
                onClick={() => scrollTo(link.target)}
                className="text-sm font-medium text-slate-600 transition-colors hover:text-brand-600"
              >
                {link.label}
              </button>
            ))}
            <a
              href={posLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-brand-600 inline-flex items-center gap-1.5"
            >
              <Monitor className="w-4 h-4" />
              Sistema POS
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-brand-600"
            >
              Iniciar sesión
            </Link>
            <a
              href={buildWhatsAppUrl('Hola, me interesa conocer VenxPOS y recibir una cotizacion para mi negocio.')}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-300 ease-out hover:bg-brand-700 hover:shadow-[0_0_25px_rgba(109,60,245,0.25)] active:scale-[0.98]"
            >
              Cotizar Ahora
            </a>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden rounded-xl p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white pb-4 pt-2">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <button
                  key={link.target}
                  onClick={() => scrollTo(link.target)}
                  className="rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-brand-600"
                >
                  {link.label}
                </button>
              ))}
              <a
                href={posLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-brand-600"
                onClick={() => setMobileOpen(false)}
              >
                <Monitor className="w-4 h-4" />
                Sistema POS
                <ExternalLink className="w-3 h-3" />
              </a>
              <div className="mt-2 flex flex-col gap-2 px-3">
                <Link
                  to="/login"
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Iniciar sesión
                </Link>
                <a
                  href={buildWhatsAppUrl('Hola, me interesa conocer VenxPOS y recibir una cotizacion para mi negocio.')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition-all duration-300 ease-out hover:bg-brand-700 hover:shadow-[0_0_25px_rgba(109,60,245,0.25)] active:scale-[0.98]"
                >
                  Cotizar Ahora
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

type FaqCategory = {
  id: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  indices: number[]
}

const faqCategories: FaqCategory[] = [
  { id: 'planes', label: 'Planes y Suscripciones', icon: Package, indices: [0, 1, 6, 7, 15, 16, 17, 23, 24] },
  { id: 'pagos', label: 'Pagos y Facturación', icon: CreditCard, indices: [2, 8, 9, 10, 11, 13] },
  { id: 'pos', label: 'Sistema POS', icon: Monitor, indices: [4, 20, 21, 22] },
  { id: 'inventario', label: 'Inventario y Reportes', icon: BarChart3, indices: [18, 19] },
  { id: 'seguridad', label: 'Seguridad y Acceso', icon: Lock, indices: [3, 12] },
  { id: 'soporte', label: 'Soporte', icon: MessageCircle, indices: [5, 14] },
]

// ---------------------------------------------------------------------------
// FAQ Category Card
// ---------------------------------------------------------------------------

function AccordionItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string
  answer: string
  isOpen: boolean
  onToggle: () => void
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const content = contentRef.current
    const inner = innerRef.current
    if (!content || !inner) return

    if (isOpen) {
      gsap.fromTo(
        content,
        { height: 0 },
        {
          height: inner.scrollHeight,
          duration: 0.35,
          ease: 'power3.out',
        }
      )
    } else {
      gsap.fromTo(
        content,
        { height: inner.scrollHeight },
        {
          height: 0,
          duration: 0.3,
          ease: 'power3.inOut',
        }
      )
    }
  }, [isOpen])

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between py-4 text-left text-sm font-medium text-slate-900 transition-colors hover:text-brand-600 gap-4"
      >
        <span>{question}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div ref={contentRef} className="overflow-hidden" style={{ height: 0 }}>
        <div ref={innerRef} className="pb-4 pr-8 text-sm leading-relaxed text-slate-500">
          {answer}
        </div>
      </div>
    </div>
  )
}

function FAQCategoryCard({
  category,
  items,
}: {
  category: FaqCategory
  items: (typeof faqItems)[number][]
}) {
  const [openId, setOpenId] = useState<string | null>(null)

  const toggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <category.icon size={20} />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">{category.label}</h3>
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <AccordionItem
            key={item.question}
            question={item.question}
            answer={item.answer}
            isOpen={openId === item.question}
            onToggle={() => toggle(item.question)}
          />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Back to Top
// ---------------------------------------------------------------------------

function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setVisible(window.scrollY > 400)
          ticking = false
        })
        ticking = true
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-6 right-6 z-40 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg transition-all duration-300 hover:bg-brand-700 hover:shadow-[0_0_25px_rgba(109,60,245,0.25)] active:scale-[0.98] ${
        visible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      aria-label="Volver arriba"
    >
      <ArrowUp size={18} />
    </button>
  )
}

// ---------------------------------------------------------------------------
// POS Elements
// ---------------------------------------------------------------------------

function PosElements() {
  const containerRef = useRef<HTMLDivElement>(null)
  
  const items = [
    { icon: Package, text: 'Coca-Cola 1.5L', sub: '$4.500 x2', delay: 0, left: '5%', top: '20%' },
    { icon: Receipt, text: 'Ticket #2041', sub: '+$85.000', delay: 0.8, right: '4%', top: '15%' },
    { icon: CreditCard, text: 'Venta aprobada', sub: '$120.000', delay: 1.6, left: '8%', top: '50%' },
    { icon: Store, text: 'Sucursal Centro', sub: 'Conectada', delay: 2.4, right: '6%', top: '45%' },
    { icon: BarChart3, text: 'Cierre de caja', sub: '$2.450.000', delay: 3.2, left: '3%', top: '75%' },
    { icon: Bell, text: 'Stock bajo', sub: 'Arroz x1', delay: 4.0, right: '3%', top: '70%' },
    { icon: Tag, text: 'Precio actualizado', sub: 'Leche $3.200', delay: 4.8, left: '10%', top: '35%' },
    { icon: FileText, text: 'Factura #042', sub: '$450.000', delay: 5.6, right: '8%', top: '25%' },
  ]

  useEffect(() => {
    const ctx = gsap.context(() => {
      items.forEach((_, i) => {
        gsap.fromTo(`.pos-el-${i}`, 
          { opacity: 0, y: 30, scale: 0.85, rotate: -2 },
          { opacity: 1, y: 0, scale: 1, rotate: 0, duration: 0.5, delay: i * 0.25 + 0.8, ease: 'back.out(1.2)' }
        )
        gsap.to(`.pos-el-${i}`, {
          y: -6, duration: 4 + (i % 3), repeat: -1, yoyo: true, ease: 'sine.inOut', delay: i * 0.3
        })
      })
    }, containerRef)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none overflow-hidden z-20" aria-hidden="true">
      {items.map((item, i) => {
        const Icon = item.icon
        return (
          <div key={i} className={`pos-el-${i} absolute hidden lg:block`} style={{ top: item.top, left: item.left, right: item.right }}>
            <div className="rounded-xl border border-slate-200/80 bg-white/90 backdrop-blur-sm shadow-md px-3 py-2 text-xs flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                <Icon size={13} className="text-brand-600" />
              </div>
              <div>
                <p className="font-medium text-slate-700 leading-tight">{item.text}</p>
                <p className="text-[10px] text-slate-400">{item.sub}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Landing Page
// ---------------------------------------------------------------------------

export function LandingPage() {
  const heroRef = useRef<HTMLElement>(null)
  const problemRef = useRef<HTMLElement>(null)
  const solutionRef = useRef<HTMLElement>(null)
  const featuresRef = useRef<HTMLElement>(null)
  const pricingRef = useRef<HTMLElement>(null)
  const faqRef = useRef<HTMLElement>(null)

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!heroRef.current) return
      const rect = heroRef.current.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width - 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5
      setMousePos({ x, y })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // --- Hero animation ---
  useEffect(() => {
    const ctx = gsap.context(() => {
      const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      heroTl
        .fromTo('.hero-title', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8 })
        .fromTo('.hero-subtitle', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.4')
        .fromTo('.hero-cta', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, '-=0.3')
        .fromTo('.hero-mockup', { opacity: 0, scale: 0.95, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: 0.8, ease: 'power4.out' }, '-=0.2')
    }, heroRef)

    return () => ctx.revert()
  }, [])

  // --- Problem scroll reveal ---
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.problem-card',
        { opacity: 0, y: 36 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.12,
          duration: 0.6,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: problemRef.current,
            start: 'top 80%',
          },
        }
      )
    }, problemRef)

    return () => ctx.revert()
  }, [])

  // --- Solution scroll reveal ---
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.solution-content',
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: solutionRef.current,
            start: 'top 80%',
          },
        }
      )
    }, solutionRef)

    return () => ctx.revert()
  }, [])

  // --- Features scroll reveal ---
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.section-title-features',
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: featuresRef.current,
            start: 'top 80%',
          },
        }
      )

      gsap.fromTo(
        '.feature-card',
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.1,
          duration: 0.6,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: featuresRef.current,
            start: 'top 75%',
          },
        }
      )
    }, featuresRef)

    return () => ctx.revert()
  }, [])

  // --- Pricing scroll reveal ---
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.section-title-pricing',
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: pricingRef.current,
            start: 'top 80%',
          },
        }
      )

      gsap.fromTo(
        '.pricing-card',
        { opacity: 0, y: 36 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.12,
          duration: 0.6,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: pricingRef.current,
            start: 'top 78%',
          },
        }
      )
    }, pricingRef)

    return () => ctx.revert()
  }, [])

  // --- FAQ scroll reveal ---
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.faq-content',
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: faqRef.current,
            start: 'top 80%',
          },
        }
      )
    }, faqRef)

    return () => ctx.revert()
  }, [])

  const scrollToPricing = useCallback(() => {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const scrollToFeatures = useCallback(() => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 antialiased">
      <Navbar />

      {/* ================================================================= */}
      {/* Hero                                                              */}
      {/* ================================================================= */}
      <section
        ref={heroRef}
        id="hero"
        className="relative overflow-hidden bg-white pt-32 pb-20 sm:pt-40 sm:pb-32"
      >
        {/* Layer 1 — Decorative blobs */}
        <div className="absolute top-0 left-1/4 -z-10 h-80 w-80 rounded-full bg-brand-50/50 blur-3xl" />
        <div className="absolute top-1/3 right-0 -z-10 h-96 w-96 rounded-full bg-accent-50/40 blur-3xl" />
        <div className="absolute bottom-0 left-0 -z-10 h-64 w-64 rounded-full bg-brand-100/20 blur-3xl" />

        {/* Layer 2 — SVG Grid */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: 'radial-gradient(circle, #6D3CF5 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }} />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="hero-title text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl leading-[1.1]">
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-brand-500 via-brand-600 to-accent-500 bg-clip-text text-transparent">
                  Controla todas tus sucursales
                </span>
              </span>{' '}
              <span className="text-slate-900">desde un solo lugar</span>
            </h1>

            <p className="hero-subtitle mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-500 sm:text-xl">
              El centro de operaciones que conecta tus ventas, inventario y caja en tiempo real.
              Diseñado para negocios que crecen.
            </p>

            <div className="hero-cta mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <a
                href={buildWhatsAppUrl('Hola, me interesa conocer VenxPOS y recibir una cotizacion para mi negocio.')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-sm transition-all duration-300 ease-out hover:bg-brand-700 hover:shadow-[0_0_25px_rgba(109,60,245,0.25)] active:scale-[0.98]"
              >
                Cotizar Ahora
                <ArrowRight size={18} />
              </a>
              <a
                href={posLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-7 py-3.5 text-base font-medium text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
              >
                <Monitor className="w-5 h-5" />
                Acceder al Sistema POS
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Mockups + POS elements */}
          <div className="relative mx-auto mt-16 sm:mt-20 max-w-5xl">
            <PosElements />

            {/* Layer 3 — Central Mockup with glow */}
            <div
              className="hero-mockup relative mx-auto max-w-3xl"
              style={{ transform: `translate(${mousePos.x * 8}px, ${mousePos.y * 8}px)` }}
            >
              <div className="absolute -inset-4 rounded-3xl bg-brand-500/5 blur-2xl" />
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-brand-500/20 via-accent-500/10 to-brand-500/20 blur-sm" />
              <div className="relative rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)] overflow-hidden">
                <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                  <span className="h-3 w-3 rounded-full bg-rose-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  <span className="ml-3 text-xs font-medium text-slate-400">
                    VenxPOS v2.0
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                  </div>
                </div>
                <div className="flex">
                  <div className="hidden w-48 shrink-0 border-r border-slate-100 bg-slate-50/50 p-4 sm:block">
                    <div className="mb-6 space-y-1">
                      <div className="h-2.5 w-full rounded bg-slate-200" />
                      <div className="h-2.5 w-3/4 rounded bg-slate-200" />
                    </div>
                    <div className="space-y-2">
                      {[
                        { active: true, w: 'w-16' },
                        { active: false, w: 'w-20' },
                        { active: false, w: 'w-14' },
                        { active: false, w: 'w-18' },
                      ].map((item, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                            item.active ? 'bg-brand-100/60 animate-pulse' : ''
                          }`}
                        >
                          <div
                            className={`h-2 w-2 rounded-full ${
                              item.active ? 'bg-brand-600' : 'bg-slate-200'
                            }`}
                          />
                          <div
                            className={`h-2 ${item.w} rounded ${
                              item.active ? 'bg-brand-300' : 'bg-slate-200'
                            }`}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 rounded-lg bg-brand-600 px-3 py-2">
                      <div className="h-2 w-12 rounded bg-white/40" />
                    </div>
                  </div>
                  <div className="flex-1 p-4 sm:p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <div className="h-3 w-28 rounded bg-slate-200" />
                        <div className="mt-1.5 h-2 w-20 rounded bg-slate-100" />
                      </div>
                      <div className="flex gap-2">
                        <div className="h-8 w-8 rounded-lg bg-slate-100" />
                        <div className="h-8 w-8 rounded-lg bg-brand-600" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div
                          key={i}
                          className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm relative overflow-hidden"
                        >
                          <div className="mb-2 aspect-square rounded-lg bg-slate-100 relative">
                            {i % 3 === 0 && (
                              <span className="absolute top-1 left-1 rounded-md bg-brand-600 px-1.5 py-0.5 text-[8px] font-semibold text-white animate-[saleBlink_5s_ease-in-out_infinite]" style={{ animationDelay: `${i * 0.8}s` }}>
                                -15%
                              </span>
                            )}
                            {i === 5 && (
                              <span className="absolute top-1 right-1 rounded-md bg-accent-500 px-1.5 py-0.5 text-[8px] font-semibold text-white animate-[saleBlink_6s_ease-in-out_infinite_1s]">
                                Nuevo
                              </span>
                            )}
                          </div>
                          <div className="h-2 w-3/4 rounded bg-slate-200" />
                          <div className="mt-1.5 h-2 w-1/2 rounded bg-emerald-100" />
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 p-3">
                      <div className="flex items-center gap-4">
                        <div className="h-2.5 w-24 rounded bg-slate-200" />
                        <div className="h-2.5 w-16 rounded bg-slate-200" />
                      </div>
                      <div className="h-7 w-24 rounded-lg bg-brand-600 flex items-center justify-center">
                        <div className="h-2 w-12 rounded bg-white/40 animate-pulse" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating card (secondary mockup) */}
            <div className="absolute -right-4 -bottom-8 hidden lg:block w-64"
              style={{ transform: `translate(${mousePos.x * -12}px, ${mousePos.y * -12}px)` }}
            >
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/30">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <TrendingUp size={16} className="text-emerald-600" />
                  </div>
                  <div>
                    <div className="h-2.5 w-20 rounded bg-slate-200" />
                    <div className="mt-1 h-2 w-14 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <div className="h-2 w-16 rounded bg-slate-100" />
                    <div className="h-2 w-12 rounded bg-emerald-100" />
                  </div>
                  <div className="flex justify-between">
                    <div className="h-2 w-20 rounded bg-slate-100" />
                    <div className="h-2 w-12 rounded bg-emerald-100" />
                  </div>
                  <div className="h-px bg-slate-100" />
                  <div className="flex justify-between">
                    <div className="h-3 w-24 rounded bg-slate-200" />
                    <div className="h-3 w-16 rounded bg-brand-100" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Problem                                                           */}
      {/* ================================================================= */}
      <section
        ref={problemRef}
        id="problem"
        className="py-20 sm:py-28"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Gestionar múltiples sucursales es un caos
            </h2>
            <p className="mt-4 text-base text-slate-500 sm:text-lg">
              Si manejas más de una tienda, conoces estos problemas.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            {problems.map((problem, index) => {
              const Icon = problem.icon
              return (
                <div
                  key={index}
                  className="problem-card rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md sm:p-7"
                >
                  <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Icon size={22} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {problem.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    {problem.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Solution                                                          */}
      {/* ================================================================= */}
      <section
        ref={solutionRef}
        className="relative overflow-hidden bg-brand-50/30 py-20 sm:py-28"
      >
        <div className="absolute top-0 right-0 -z-10 h-72 w-72 rounded-full bg-brand-100/30 blur-3xl" />
        <div className="absolute bottom-0 left-0 -z-10 h-64 w-64 rounded-full bg-accent-50/30 blur-3xl" />

        <div className="solution-content relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl leading-[1.15]">
            VenxPOS unifica todo{' '}
            <span className="bg-gradient-to-r from-brand-600 to-accent-500 bg-clip-text text-transparent">
              en una plataforma
            </span>
          </h2>

          <p className="mt-5 text-lg leading-relaxed text-slate-500 max-w-2xl">
            Olvidate del Excel interminable y las llamadas a cada sucursal.
            VenxPOS centraliza ventas, inventario y caja en un solo lugar,
            accesible desde cualquier dispositivo con conexion a internet.
          </p>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0 mt-1">
                <Layers className="w-5 h-5 text-brand-600" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Multi-sucursal</h4>
                <p className="text-sm text-slate-500 mt-1">Gestiona todas tus tiendas desde un panel centralizado.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-accent-100 flex items-center justify-center shrink-0 mt-1">
                <TrendingUp className="w-5 h-5 text-accent-600" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Tiempo real</h4>
                <p className="text-sm text-slate-500 mt-1">Ventas, inventario y caja se actualizan al instante.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 mt-1">
                <Shield className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Seguridad</h4>
                <p className="text-sm text-slate-500 mt-1">Roles, PIN de administrador y auditoria completa.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Features                                                          */}
      {/* ================================================================= */}
      <section
        id="features"
        ref={featuresRef}
        className="relative bg-slate-50/50 py-20 sm:py-28"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="section-title-features mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Todo lo que necesitas para operar
            </h2>
            <p className="mt-4 text-base text-slate-500 sm:text-lg">
              Herramientas diseñadas para que te enfoques en vender, no en
              administrar.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon
              const iconColors = [
                { bg: 'bg-brand-50', text: 'text-brand-600' },
                { bg: 'bg-accent-50', text: 'text-accent-600' },
                { bg: 'bg-success-50', text: 'text-success-600' },
                { bg: 'bg-brand-50', text: 'text-brand-600' },
                { bg: 'bg-accent-50', text: 'text-accent-600' },
                { bg: 'bg-slate-100', text: 'text-slate-600' },
              ][index]
              return (
                <div
                  key={index}
                  className="feature-card group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 sm:p-7"
                >
                  <div className={`mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl ${iconColors.bg} ${iconColors.text} transition-colors group-hover:opacity-80`}>
                    <Icon size={22} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    {feature.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Pricing                                                           */}
      {/* ================================================================= */}
      <section id="pricing" ref={pricingRef} className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="section-title-pricing mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Planes que crecen contigo
            </h2>
            <p className="mt-4 text-base text-slate-500 sm:text-lg">
              Sin costos ocultos. Cambia de plan cuando tu negocio lo necesite.
            </p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`pricing-card relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md sm:p-7 ${
                  plan.highlighted
                    ? 'border-brand-300 ring-2 ring-brand-100 scale-105 md:scale-105 xl:scale-105'
                    : 'border-slate-200'
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-1 text-xs font-semibold text-white shadow-sm">
                    Popular
                  </span>
                )}

                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {plan.name}
                  </h3>
                  {plan.badge && (
                    <span className="mt-1 inline-block rounded-full bg-brand-50 px-3 py-0.5 text-[11px] font-medium text-brand-700">
                      {plan.badge}
                    </span>
                  )}
                </div>

                <div className="mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Implementación inicial</span>
                  <div className="mt-0.5 text-2xl font-bold text-slate-900">
                    {plan.setup}
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400 leading-relaxed">
                    Incluye toda la configuración técnica y puesta en marcha necesaria para comenzar a operar con VenxPOS.
                  </p>
                </div>

                <div className="my-4 border-t border-slate-100 pt-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-slate-900">
                      {plan.monthly}
                    </span>
                    <span className="text-sm text-slate-400">/mes</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    A partir del siguiente periodo únicamente pagarás la mensualidad
                  </p>
                </div>

                <ul className="mb-6 flex-1 space-y-2.5">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check
                        size={15}
                        className="mt-0.5 shrink-0 text-brand-600"
                      />
                      <span className="text-sm text-slate-600">{feat}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={buildWhatsAppUrl(`Hola, quiero contratar el plan ${plan.name} de VenxPOS.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block w-full text-center rounded-xl py-2.5 text-sm font-semibold transition-all ${
                    plan.highlighted
                      ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm'
                      : 'border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Lo quiero
                </a>
              </div>
            ))}
          </div>

          {/* Why implementation fee */}
          <div className="mt-20 mx-auto max-w-4xl">
            <div className="text-center mb-10">
              <h3 className="text-2xl font-bold text-slate-900">¿Por qué existe un pago de implementación?</h3>
              <p className="mt-2 text-sm text-slate-500">No solo activas un software. Te entregamos un negocio listo para operar.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {implementationBenefits.map((ben, i) => {
                const Icon = ben.icon
                return (
                  <div key={i} className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <Icon size={20} />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900">{ben.title}</h4>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">{ben.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* FAQ                                                               */}
      {/* ================================================================= */}
      <section id="faq" ref={faqRef} className="bg-slate-50/50 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 faq-content">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Preguntas frecuentes
            </h2>
            <p className="mt-4 text-base text-slate-500 sm:text-lg">
              Respuestas rápidas a las dudas más comunes.
            </p>
          </div>

          {/* Search */}
          <div className="relative mx-auto mt-10 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar preguntas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition-colors focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {/* Category chips */}
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => setActiveCategory(null)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                !activeCategory
                  ? 'bg-brand-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              Todas
            </button>
            {faqCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory((prev) => (prev === cat.id ? null : cat.id))}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-brand-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Category cards */}
          <div className="mt-12 space-y-8">
            {faqCategories.map((cat) => {
              const items = cat.indices
                .map((i) => faqItems[i])
                .filter((item) => {
                  if (!searchQuery) return true
                  const q = searchQuery.toLowerCase()
                  return (
                    item.question.toLowerCase().includes(q) ||
                    item.answer.toLowerCase().includes(q)
                  )
                })
              if (items.length === 0) return null
              if (activeCategory && cat.id !== activeCategory) return null
              return (
                <FAQCategoryCard key={cat.id} category={cat} items={items} />
              )
            })}
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* CTA Final                                                         */}
      {/* ================================================================= */}
      <section className="relative overflow-hidden bg-brand-50/50 py-20 sm:py-28">
        <div className="absolute top-0 right-0 -z-10 h-80 w-80 rounded-full bg-brand-100/30 blur-3xl" />
        <div className="absolute bottom-0 left-0 -z-10 h-72 w-72 rounded-full bg-accent-50/30 blur-3xl" />

        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            Comienza a vender hoy
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-slate-500">
            Unete a cientos de comercios colombianos que ya confían en
            VenxPOS para gestionar sus ventas.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href={buildWhatsAppUrl('Hola, me interesa conocer VenxPOS y recibir una cotizacion para mi negocio.')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-sm transition-all duration-300 ease-out hover:bg-brand-700 hover:shadow-[0_0_25px_rgba(109,60,245,0.25)] active:scale-[0.98]"
            >
              Cotizar Ahora
              <ArrowRight size={18} />
            </a>
            <button
              onClick={scrollToPricing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-7 py-3.5 text-base font-medium text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
            >
              Ver planes
            </button>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Footer                                                            */}
      {/* ================================================================= */}
      <footer className="relative bg-slate-50/80 border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-8 lg:pt-20">
          <div className="grid grid-cols-2 gap-10 lg:grid-cols-5">
            {/* Col 1 - Brand */}
            <div className="col-span-2 lg:col-span-1 space-y-4">
              <img src={logoSaaS} alt="VenxPOS" className="h-8 w-auto" />
              <p className="text-sm text-slate-500 leading-relaxed">
                Software POS multi-sucursal para el comercio colombiano.
              </p>
              <p className="text-xs text-slate-400">
                Desarrollado por <a href="https://jgsoftworks-site.netlify.app/" target="_blank" rel="noopener noreferrer" className="font-medium text-slate-600 hover:text-brand-600 transition-colors">JGSoftworks</a>
              </p>
            </div>

            {/* Col 2 - Legal */}
            <div>
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-4">Legal</h3>
              <ul className="space-y-3">
                <li><Link to="/legal/terminos" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">Términos y Condiciones</Link></li>
                <li><Link to="/legal/privacidad" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">Política de Privacidad</Link></li>
                <li><Link to="/legal/cookies" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">Política de Cookies</Link></li>
                <li><Link to="/legal/reembolsos" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">Política de Reembolsos</Link></li>
                <li><Link to="/legal/conducta-aceptable" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">Conducta Aceptable</Link></li>
                <li><Link to="/legal/cumplimiento" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">Cumplimiento Normativo</Link></li>
                <li><Link to="/legal/metodos-pago" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">Métodos de Pago</Link></li>
              </ul>
            </div>

            {/* Col 3 - Contacto */}
            <div>
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-4">Contacto</h3>
              <ul className="space-y-3">
                <li>
                  <a href="https://wa.me/573228372341" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-500 hover:text-slate-800 transition-colors inline-flex items-center gap-2">
                    <MessageCircle size={14} className="text-slate-400" />
                    WhatsApp
                  </a>
                </li>
                <li>
                  <a href="mailto:juan.dev1809@gmail.com" className="text-sm text-slate-500 hover:text-slate-800 transition-colors inline-flex items-center gap-2">
                    <Mail size={14} className="text-slate-400" />
                    juan.dev1809@gmail.com
                  </a>
                </li>

              </ul>
            </div>

            {/* Col 4 - Plataformas */}
            <div>
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-4">Plataformas</h3>
              <ul className="space-y-3">
                <li><Link to="/login" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">Panel Administrativo</Link></li>
                <li><a href={posLink} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-500 hover:text-slate-800 transition-colors inline-flex items-center gap-1.5">Sistema POS <ExternalLink size={12} /></a></li>
              </ul>
            </div>

            {/* Col 5 - Acciones */}
            <div>
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-4">Acciones</h3>
              <ul className="space-y-3">
                <li><a href={buildWhatsAppUrl('Hola, me interesa conocer VenxPOS y recibir una cotizacion para mi negocio.')} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:text-brand-700 font-medium transition-colors">Cotizar Ahora</a></li>
                <li><Link to="/login" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">Iniciar sesion</Link></li>
                <li><a href="https://wa.me/573228372341" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">Solicitar demo</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-16 pt-8 border-t border-slate-200 flex flex-col sm:flex-row justify-between gap-2">
            <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} VenxPOS. Todos los derechos reservados.</p>
            <div className="flex gap-4">
              <Link to="/legal/privacidad" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Privacidad</Link>
              <Link to="/legal/terminos" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Términos</Link>
              <Link to="/legal/cookies" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Cookies</Link>
              <Link to="/legal/reembolsos" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Reembolsos</Link>
              <Link to="/legal/metodos-pago" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Métodos de Pago</Link>
            </div>
          </div>
        </div>
      </footer>

      <BackToTop />
    </div>
  )
}
