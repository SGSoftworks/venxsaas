import { Link } from 'react-router-dom'
import { buildWhatsAppUrl, APP_CONFIG } from '@/lib/appConfig'
import { LegalLayout, type LegalSection } from './LegalLayout'
import { Mail, MessageCircle, AlertTriangle } from 'lucide-react'

const sections: LegalSection[] = [
  { id: 'pago-inicial', title: '1. Pago Inicial' },
  { id: 'mensualidades', title: '2. Mensualidades' },
  { id: 'errores-cobro', title: '3. Errores de Cobro' },
  { id: 'duplicidad', title: '4. Duplicidad de Pagos' },
  { id: 'renovaciones', title: '5. Renovaciones' },
  { id: 'cambios-plan', title: '6. Cambios de Plan' },
  { id: 'cancelacion', title: '7. Cancelación del Servicio' },
  { id: 'casos-excepcionales', title: '8. Casos Excepcionales' },
  { id: 'contacto', title: '9. Contacto' },
]

export function ReembolsosPage() {
  return (
    <LegalLayout title="Política de Reembolsos" sections={sections}>
      <Section id="pago-inicial" num="1" title="Pago Inicial">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          El pago inicial corresponde a los siguientes conceptos:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
          <li>Implementación y configuración técnica de la cuenta.</li>
          <li>Configuración inicial del inventario y parametrización del sistema.</li>
          <li>Activación del tenant y provisión de recursos en la nube.</li>
          <li>Capacitación inicial y soporte de incorporación (onboarding) si aplica.</li>
        </ul>
        <p className="text-sm text-slate-600 leading-relaxed mt-3">
          El pago inicial <span className="font-semibold text-slate-700">no es reembolsable</span> una vez
          iniciado el proceso de implementación. Al completar el registro y pago, el Cliente acepta que
          la prestación del Servicio inicia de inmediato, conforme a lo previsto en el artículo 47 del
          Estatuto del Consumidor (Ley 1480 de 2011) sobre la exclusión del derecho de retracto en
          servicios que inician su ejecución con el consentimiento expreso del consumidor.
        </p>
      </Section>

      <Section id="mensualidades" num="2" title="Mensualidades">
        <p className="text-sm text-slate-600 leading-relaxed">
          Las mensualidades posteriores <span className="font-semibold text-slate-700">no son reembolsables</span> una
          vez iniciado el ciclo de facturación correspondiente. El cobro se realiza al inicio de cada
          período mensual. No se realizan reembolsos parciales ni prorrateos por días no utilizados
          dentro del ciclo de facturación en curso, con excepción de los casos previstos en la
          sección de Casos Excepcionales de esta Política.
        </p>
      </Section>

      <Section id="errores-cobro" num="3" title="Errores de Cobro">
        <p className="text-sm text-slate-600 leading-relaxed">
          En caso de errores de facturación o cobros posteriores a una cancelación debidamente
          registrada, el Cliente dispone de un plazo de cinco (5) días hábiles contados desde
          la fecha del cobro para presentar su reclamación. Los errores de cobro <span className="font-semibold text-slate-700">sí podrán
          revisarse</span> y, de proceder, se tramitará el reembolso correspondiente.
        </p>
      </Section>

      <Section id="duplicidad" num="4" title="Duplicidad de Pagos">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          En caso de detectar un cobro duplicado, el Cliente debe notificar a la Gerencia a
          través de los canales de contacto indicados, proporcionando:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
          <li>Comprobante de cada transacción realizada.</li>
          <li>ID de referencia de Wompi de cada cobro.</li>
          <li>Fecha y hora de las transacciones.</li>
        </ul>
        <p className="text-sm text-slate-600 leading-relaxed mt-3">
          Una vez verificada la duplicidad, VenxPOS tramitará el reembolso del cobro duplicado
          en un plazo máximo de diez (10) días hábiles al método de pago original.
        </p>
      </Section>

      <Section id="renovaciones" num="5" title="Renovaciones">
        <p className="text-sm text-slate-600 leading-relaxed">
          Las renovaciones de suscripción se gestionan mediante solicitud del Cliente a través
          de WhatsApp. Una vez procesado el pago de la renovación, el ciclo de facturación se
          extiende por un período adicional de treinta (30) días calendario. Las renovaciones
          están sujetas a las tarifas vigentes al momento del cobro. No se realizan reembolsos
          por renovaciones procesadas correctamente.
        </p>
      </Section>

      <Section id="cambios-plan" num="6" title="Cambios de Plan">
        <p className="text-sm text-slate-600 leading-relaxed">
          El Cliente puede cambiar de plan en cualquier momento desde el panel de administración
          o solicitándolo a la Gerencia. El ajuste de precio se aplica al siguiente ciclo de
          facturación. En caso de cambio a un plan de mayor valor durante el ciclo vigente, se
          cobrará la diferencia proporcional por los días restantes. En caso de cambio a un plan
          de menor valor, no se generan reembolsos ni créditos; el nuevo precio entrará en vigor
          al inicio del siguiente ciclo.
        </p>
      </Section>

      <Section id="cancelacion" num="7" title="Cancelación del Servicio">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          La cancelación de la suscripción puede realizarse en cualquier momento y sin penalización
          desde el panel de administración. Una vez cancelada, el Cliente mantiene acceso completo
          al Servicio hasta la finalización del ciclo de facturación ya pagado.
        </p>
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          <span className="font-semibold text-slate-700">¿Qué ocurre con los datos?</span> Tras la
          cancelación, los datos se conservan por un período de noventa (90) días calendario para
          facilitar la reactivación. Transcurrido este plazo, los datos son eliminados de manera
          irreversible, salvo aquellos que deban conservarse por obligaciones legales o fiscales
          (facturación, registros contables) durante el término de cinco (5) años exigido por el
          Estatuto Tributario colombiano.
        </p>
      </Section>

      <Section id="casos-excepcionales" num="8" title="Casos Excepcionales">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          VenxPOS evaluará solicitudes de reembolso en las siguientes circunstancias excepcionales:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
          <li>Falla técnica comprobada atribuible a VenxPOS que impida el uso del Servicio por más de cuarenta y ocho (48) horas continuas.</li>
          <li>Cobro duplicado por error del sistema de facturación o de la pasarela de pagos.</li>
          <li>Cobro realizado con posterioridad a una cancelación completada y confirmada.</li>
          <li>Incumplimiento sustancial del Servicio que no pueda ser subsanado en un plazo razonable.</li>
        </ul>
        <p className="text-sm text-slate-600 leading-relaxed mt-3">
          Cada caso será evaluado individualmente y la decisión será comunicada en un plazo no
          mayor a diez (10) días hábiles. VenxPOS se reserva el derecho de solicitar documentación
          adicional para evaluar la procedencia del reembolso.
        </p>
      </Section>

      <Section id="contacto" num="9" title="Contacto">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          Para solicitudes de reembolso, reclamaciones o consultas, puede comunicarse a través de
          los siguientes canales:
        </p>
        <div className="flex flex-wrap gap-3 mt-3">
          <a
            href={buildWhatsAppUrl('Hola, tengo una consulta sobre reembolsos en VenxPOS.')}
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
