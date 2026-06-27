import { buildWhatsAppUrl, APP_CONFIG } from '@/lib/appConfig'
import { LegalLayout, type LegalSection } from './LegalLayout'
import { Mail, MessageCircle } from 'lucide-react'

const sections: LegalSection[] = [
  { id: 'uso-permitido', title: '1. Uso Permitido del Servicio' },
  { id: 'actividades-prohibidas', title: '2. Actividades Prohibidas' },
  { id: 'uso-recursos', title: '3. Uso de Recursos' },
  { id: 'contenido', title: '4. Contenido' },
  { id: 'suspension', title: '5. Suspensión por Violación' },
  { id: 'reporte', title: '6. Reporte de Violaciones' },
  { id: 'contacto', title: '7. Contacto' },
]

export function AceptableUsePage() {
  return (
    <LegalLayout title="Política de Conducta Aceptable" sections={sections}>
      <Section id="uso-permitido" num="1" title="Uso Permitido del Servicio">
        <p className="text-sm text-slate-600 leading-relaxed">
          VenxPOS debe ser utilizado exclusivamente por comercios legalmente constituidos en
          la República de Colombia para fines comerciales lícitos relacionados con la operación
          de punto de venta, gestión de inventario, facturación electrónica y administración
          de sucursales. El Servicio no puede ser utilizado para actividades distintas a su
          objeto contractual ni para fines ilegales o no autorizados.
        </p>
      </Section>

      <Section id="actividades-prohibidas" num="2" title="Actividades Prohibidas">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          Queda expresamente prohibido el uso de VenxPOS para:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
          <li>Actividades ilegales o que violen la legislación colombiana vigente.</li>
          <li>Fraude, suplantación de identidad o estafa.</li>
          <li>Envío de spam, mensajes no solicitados o comunicaciones masivas no autorizadas.</li>
          <li>Extracción masiva de datos (scraping) de la plataforma sin autorización expresa.</li>
          <li>Distribución de malware, virus, gusanos, troyanos o cualquier código malicioso.</li>
          <li>Ingeniería inversa, descompilación o modificación no autorizada del software.</li>
          <li>Acceso no autorizado a cuentas de otros clientes o a sistemas de VenxPOS.</li>
          <li>Cualquier actividad que pueda dañar, deshabilitar o sobrecargar la infraestructura.</li>
        </ul>
      </Section>

      <Section id="uso-recursos" num="3" title="Uso de Recursos">
        <p className="text-sm text-slate-600 leading-relaxed">
          El Cliente acepta utilizar los recursos del Servicio de manera razonable y acorde al
          plan contratado. El uso excesivo o abusivo de los recursos de infraestructura (API,
          almacenamiento, transacciones) que afecte la estabilidad de la plataforma podrá
          resultar en la limitación temporal del servicio o en la migración a un plan superior.
        </p>
      </Section>

      <Section id="contenido" num="4" title="Contenido">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          El Cliente es el único responsable del contenido que ingrese, procese o almacene
          en VenxPOS, incluyendo productos, precios, datos de clientes y facturación. Queda
          prohibido:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
          <li>Almacenar contenido ilegal, discriminatorio u ofensivo.</li>
          <li>Registrar información fraudulenta o falsa de clientes o transacciones.</li>
          <li>Procesar datos sensibles sin la autorización expresa del titular.</li>
        </ul>
      </Section>

      <Section id="suspension" num="5" title="Suspensión por Violación">
        <p className="text-sm text-slate-600 leading-relaxed">
          VenxPOS se reserva el derecho de suspender inmediatamente el acceso al Servicio ante
          la detección de cualquier violación a esta Política. Dependiendo de la gravedad de
          la infracción, VenxPOS podrá optar por la cancelación definitiva de la cuenta sin
          derecho a reembolso, además de reportar la actividad a las autoridades competentes
          cuando corresponda.
        </p>
      </Section>

      <Section id="reporte" num="6" title="Reporte de Violaciones">
        <p className="text-sm text-slate-600 leading-relaxed">
          Si un Cliente o tercero detecta una posible violación a esta Política de Conducta
          Aceptable, puede reportarla a través de WhatsApp. VenxPOS mantendrá la confidencialidad
          de la fuente del reporte y evaluará el caso en un plazo máximo de cinco (5) días hábiles.
        </p>
      </Section>

      <Section id="contacto" num="7" title="Contacto">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          Para reportar violaciones o resolver dudas sobre esta Política:
        </p>
        <div className="flex flex-wrap gap-3 mt-3">
          <a
            href={buildWhatsAppUrl('Hola, quiero reportar una posible violación a la Política de Conducta Aceptable de VenxPOS.')}
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
