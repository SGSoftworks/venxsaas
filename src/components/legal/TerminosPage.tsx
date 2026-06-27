import { Link } from 'react-router-dom'
import { buildWhatsAppUrl, APP_CONFIG } from '@/lib/appConfig'
import { LegalLayout, type LegalSection } from './LegalLayout'
import { Mail, MessageCircle, AlertTriangle } from 'lucide-react'

const sections: LegalSection[] = [
  { id: 'aceptacion', title: '1. Aceptación de los Términos' },
  { id: 'definiciones', title: '2. Definiciones' },
  { id: 'objeto', title: '3. Objeto del Servicio' },
  { id: 'elegibilidad', title: '4. Elegibilidad' },
  { id: 'creacion-cuentas', title: '5. Creación de Cuentas' },
  { id: 'responsabilidad-cliente', title: '6. Responsabilidad del Cliente' },
  { id: 'planes-pagos', title: '7. Planes y Pagos' },
  { id: 'suspension', title: '8. Suspensión del Servicio' },
  { id: 'cancelacion-reembolsos', title: '9. Cancelación y Reembolsos' },
  { id: 'propiedad-intelectual', title: '10. Propiedad Intelectual' },
  { id: 'limitacion-responsabilidad', title: '11. Limitación de Responsabilidad' },
  { id: 'modificaciones', title: '12. Modificaciones del Servicio' },
  { id: 'modificaciones-terminos', title: '13. Modificaciones a los Términos' },
  { id: 'jurisdiccion', title: '14. Ley Aplicable y Jurisdicción' },
  { id: 'contacto', title: '15. Contacto' },
]

export function TerminosPage() {
  return (
    <LegalLayout title="Términos y Condiciones" sections={sections}>
      <Section id="aceptacion" num="1" title="Aceptación de los Términos">
        <p className="text-sm text-slate-600 leading-relaxed">
          Al acceder y utilizar VenxPOS (en adelante, &ldquo;el Servicio&rdquo;),
          usted acepta de manera expresa e irrevocable estos Términos y Condiciones.
          Si no está de acuerdo con la totalidad de las disposiciones aquí contenidas,
          debe abstenerse de utilizar el Servicio. El uso del Servicio constituye
          manifestación tácita de aceptación conforme al artículo 14 de la Ley 527
          de 1999 de la República de Colombia.
        </p>
      </Section>

      <Section id="definiciones" num="2" title="Definiciones">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          Para la interpretación de estos Términos y Condiciones, se entenderá por:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
          <li><span className="font-medium text-slate-700">Cliente:</span> persona natural o jurídica que contrata el Servicio.</li>
          <li><span className="font-medium text-slate-700">Empresa:</span> establecimiento de comercio del Cliente registrado en VenxPOS.</li>
          <li><span className="font-medium text-slate-700">Sucursal:</span> cada una de las sedes o puntos de venta asociados a la cuenta del Cliente.</li>
          <li><span className="font-medium text-slate-700">Usuario:</span> persona autorizada por el Cliente para utilizar el Servicio.</li>
          <li><span className="font-medium text-slate-700">Administrador:</span> Usuario con privilegios de gestión sobre la cuenta.</li>
          <li><span className="font-medium text-slate-700">Gerencia:</span> equipo administrativo de VenxPOS responsable de la gestión del Servicio.</li>
          <li><span className="font-medium text-slate-700">POS:</span> sistema de punto de venta (Point of Sale) integrado al Servicio.</li>
          <li><span className="font-medium text-slate-700">SaaS:</span> modelo de distribución de software (Software as a Service) bajo suscripción.</li>
          <li><span className="font-medium text-slate-700">Suscripción:</span> contrato de acceso al Servicio con periodicidad mensual.</li>
          <li><span className="font-medium text-slate-700">Factura:</span> documento electrónico que soporta los cobros realizados al Cliente.</li>
          <li><span className="font-medium text-slate-700">Cuenta:</span> registro único del Cliente en la plataforma VenxPOS.</li>
        </ul>
      </Section>

      <Section id="objeto" num="3" title="Objeto del Servicio">
        <p className="text-sm text-slate-600 leading-relaxed">
          VenxPOS es un sistema SaaS (Software as a Service) de gestión empresarial y punto de venta (POS)
          diseñado para comercios colombianos. El Servicio permite administrar ventas, inventario,
          sucursales, facturación electrónica, clientes y suscripciones desde una interfaz web unificada.
          Se presta exclusivamente a través de navegadores web modernos y no requiere instalación
          de software adicional. VenxPOS opera bajo un modelo de suscripción mensual con planes
          escalables según las necesidades del Cliente.
        </p>
      </Section>

      <Section id="elegibilidad" num="4" title="Elegibilidad">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          Para contratar el Servicio, el Cliente debe cumplir con los siguientes requisitos:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
          <li>Ser mayor de edad (18 años o más) conforme a la legislación colombiana.</li>
          <li>Tener capacidad legal para contratar y obligarse.</li>
          <li>Ser titular de un establecimiento de comercio legalmente constituido en Colombia.</li>
          <li>Contar con un número de NIT o documento de identificación válido.</li>
          <li>Disponer de una dirección de correo electrónico válida y acceso a internet.</li>
        </ul>
        <p className="text-sm text-slate-600 leading-relaxed mt-3">
          VenxPOS se reserva el derecho de verificar la información proporcionada y solicitar
          documentación adicional cuando lo considere necesario.
        </p>
      </Section>

      <Section id="creacion-cuentas" num="5" title="Creación de Cuentas">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          El proceso de creación de cuentas en VenxPOS opera de la siguiente manera:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
          <li>Las cuentas son creadas exclusivamente por la Gerencia de VenxPOS.</li>
          <li>No existe registro público ni autogestionado en la plataforma.</li>
          <li>Las credenciales iniciales (usuario y contraseña temporal) son entregadas por la Gerencia.</li>
          <li>El Cliente debe cambiar la contraseña en el primer inicio de sesión.</li>
          <li>La información proporcionada debe ser veraz, completa y actualizada.</li>
        </ul>
        <p className="text-sm text-slate-600 leading-relaxed mt-3">
          El Cliente se compromete a mantener la confidencialidad de sus credenciales y
          notificar inmediatamente a la Gerencia cualquier uso no autorizado de su cuenta.
        </p>
      </Section>

      <Section id="responsabilidad-cliente" num="6" title="Responsabilidad del Cliente">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          El Cliente se obliga a:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
          <li>Hacer uso correcto y ético del Servicio, conforme a la ley y estos Términos.</li>
          <li>Proteger sus credenciales de acceso y no compartirlas con terceros no autorizados.</li>
          <li>Mantener su información de contacto y datos del negocio actualizados.</li>
          <li>No utilizar el Servicio para actividades ilícitas o fraudulentas.</li>
          <li>No intentar vulnerar la seguridad de la plataforma ni acceder a datos de otros clientes.</li>
          <li>No realizar ingeniería inversa, descompilación o modificación no autorizada del software.</li>
          <li>Notificar a la Gerencia cualquier falla de seguridad o incidente detectado.</li>
        </ul>
      </Section>

      <Section id="planes-pagos" num="7" title="Planes y Pagos">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          El Servicio se ofrece bajo planes de suscripción mensual en pesos colombianos (COP):
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
          <li><span className="font-medium text-slate-700">Plan Básico:</span> funcionalidades esenciales de punto de venta y gestión de inventario para una sucursal.</li>
          <li><span className="font-medium text-slate-700">Plan Estándar:</span> múltiples sucursales, reportes avanzados y facturación electrónica básica.</li>
          <li><span className="font-medium text-slate-700">Plan Pro:</span> todas las funcionalidades, productos ilimitados, soporte WhatsApp y facturación electrónica ilimitada.</li>
        </ul>
        <p className="text-sm text-slate-600 leading-relaxed mt-3">
          Los pagos se procesan a través de Wompi, pasarela de pagos de Bancolombia S.A.
          Al contratar un plan, el usuario autoriza los cobros recurrentes según el plan seleccionado.
          Todos los precios incluyen el IVA cuando corresponda según el Estatuto Tributario colombiano.
          VenxPOS se reserva el derecho de modificar los precios notificando con al menos treinta (30)
          días calendario de anticipación. Consulte nuestros{' '}
          <Link to="/legal/metodos-pago" className="text-brand-600 hover:underline">métodos de pago aceptados</Link>
          {' '}para más información.
        </p>
      </Section>

      <Section id="suspension" num="8" title="Suspensión del Servicio">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          VenxPOS se reserva el derecho de suspender el acceso al Servicio, total o parcialmente,
          en los siguientes casos:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
          <li><span className="font-medium text-slate-700">Mora:</span> falta de pago de la suscripción dentro del período establecido.</li>
          <li><span className="font-medium text-slate-700">Fraude:</span> detección de actividad fraudulenta o uso indebido de la plataforma.</li>
          <li><span className="font-medium text-slate-700">Uso indebido:</span> violación de estos Términos o de la Política de Conducta Aceptable.</li>
          <li><span className="font-medium text-slate-700">Incumplimiento contractual:</span> violación de cualquier obligación establecida en estos Términos.</li>
          <li><span className="font-medium text-slate-700">Solicitud del Cliente:</span> suspensión temporal solicitada expresamente por el Cliente.</li>
        </ul>
        <p className="text-sm text-slate-600 leading-relaxed mt-3">
          En caso de suspensión por mora, el Cliente será notificado con al menos cinco (5) días
          calendario de anticipación. La suspensión por fraude o uso indebido podrá ser inmediata.
          Una vez regularizada la causa de la suspensión, el Servicio será restablecido en un plazo
          máximo de veinticuatro (24) horas.
        </p>
      </Section>

      <Section id="cancelacion-reembolsos" num="9" title="Cancelación y Reembolsos">
        <p className="text-sm text-slate-600 leading-relaxed">
          El usuario puede cancelar su suscripción en cualquier momento desde el panel de
          administración, sin penalización. La cancelación surte efecto al finalizar el ciclo
          de facturación en curso y el acceso al Servicio se mantiene hasta dicha fecha.
          Los términos específicos de reembolso se rigen por nuestra{' '}
          <Link to="/legal/reembolsos" className="text-brand-600 hover:underline">
            Política de Reembolsos
          </Link>
          , la cual forma parte integrante de estos Términos.
        </p>
      </Section>

      <Section id="propiedad-intelectual" num="10" title="Propiedad Intelectual">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          Todo el contenido, código, diseño, marca, logotipos, interfaz de usuario y documentación
          asociada a VenxPOS constituyen propiedad intelectual exclusiva de VenxPOS y están
          protegidos por las leyes de propiedad intelectual colombianas e internacionales.
        </p>
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          El Cliente adquiere únicamente una licencia limitada, no exclusiva, no transferible
          y revocable para utilizar el Servicio conforme a estos Términos. Queda expresamente
          prohibido:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
          <li>Reproducir, distribuir o modificar el software sin autorización previa y por escrito.</li>
          <li>Realizar ingeniería inversa, descompilación o crear obras derivadas del software.</li>
          <li>Utilizar la marca o logotipos de VenxPOS sin autorización expresa.</li>
          <li>Extraer o reutilizar partes sustanciales de la interfaz o el contenido.</li>
        </ul>
      </Section>

      <Section id="limitacion-responsabilidad" num="11" title="Limitación de Responsabilidad">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          VenxPOS se proporciona &ldquo;tal cual&rdquo; y &ldquo;según disponibilidad&rdquo;,
          sin garantías explícitas o implícitas de disponibilidad continua o ausencia de errores.
        </p>
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          En la máxima medida permitida por la legislación colombiana, VenxPOS no será responsable por:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
          <li>Daños indirectos, incidentales, especiales o consecuentes.</li>
          <li>Pérdida de datos, lucro cesante o pérdida de oportunidad comercial.</li>
          <li>Interrupción operativa por caídas de internet, fallas del proveedor de infraestructura o casos de fuerza mayor.</li>
          <li>Errores derivados del mal uso del Servicio por parte del Cliente o sus Usuarios.</li>
          <li>Daños causados por terceros o por integraciones externas no controladas por VenxPOS.</li>
        </ul>
        <p className="text-sm text-slate-600 leading-relaxed mt-3">
          La responsabilidad total de VenxPOS, en cualquier circunstancia, se limita al valor de
          la última mensualidad pagada por el Cliente.
        </p>
      </Section>

      <Section id="modificaciones" num="12" title="Modificaciones del Servicio">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          VenxPOS se reserva el derecho de realizar las siguientes modificaciones al Servicio:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
          <li>Agregar nuevas funcionalidades, módulos o integraciones.</li>
          <li>Eliminar o reemplazar funcionalidades existentes cuando sea técnicamente necesario.</li>
          <li>Actualizar los planes y precios con la debida antelación.</li>
          <li>Modificar la documentación, interfaz o experiencia de usuario para mejorarla.</li>
          <li>Actualizar los requisitos técnicos mínimos para el uso del Servicio.</li>
        </ul>
        <p className="text-sm text-slate-600 leading-relaxed mt-3">
          Las modificaciones sustanciales serán notificadas al Cliente con al menos quince (15)
          días calendario de anticipación. Las modificaciones menores o mejoras que no afecten
          negativamente el uso del Servicio podrán implementarse sin notificación previa.
        </p>
      </Section>

      <Section id="modificaciones-terminos" num="13" title="Modificaciones a los Términos">
        <p className="text-sm text-slate-600 leading-relaxed">
          VenxPOS se reserva el derecho de modificar estos Términos en cualquier momento.
          Los cambios sustanciales serán notificados al correo electrónico registrado con al
          menos quince (15) días calendario de anticipación a su entrada en vigor. El uso
          continuado del Servicio con posterioridad a la entrada en vigor de los nuevos
          Términos constituye aceptación plena de los mismos.
        </p>
      </Section>

      <Section id="jurisdiccion" num="14" title="Ley Aplicable y Jurisdicción">
        <p className="text-sm text-slate-600 leading-relaxed">
          Estos Términos y Condiciones se rigen por las leyes de la República de Colombia,
          particularmente por la Ley 527 de 1999 sobre comercio electrónico, el Estatuto del
          Consumidor (Ley 1480 de 2011) y el Código de Comercio colombiano. Cualquier
          controversia derivada de estos Términos será sometida a la jurisdicción de los
          jueces civiles del circuito de Bogotá D.C., con renuncia expresa a cualquier otro
          fuero que pudiera corresponder.
        </p>
      </Section>

      <Section id="contacto" num="15" title="Contacto">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          Para consultas, notificaciones o reclamaciones relacionadas con estos Términos,
          puede comunicarse a través de los siguientes canales:
        </p>
        <div className="flex flex-wrap gap-3 mt-3">
          <a
            href={buildWhatsAppUrl('Hola, tengo una consulta sobre los términos y condiciones de VenxPOS.')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp: {APP_CONFIG.whatsapp}
          </a>
          <a
            href={`mailto:${APP_CONFIG.email}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <Mail className="w-4 h-4" />
            {APP_CONFIG.email}
          </a>
        </div>
      </Section>
    </LegalLayout>
  )
}

function Section({ id, num, title, children }: { id: string; num: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="py-5 border-t border-slate-100 first:border-t-0">
      <h2 className="text-base font-semibold text-slate-900 mb-3">
        {num}. {title}
      </h2>
      {children}
    </section>
  )
}
