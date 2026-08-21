import { Link } from 'react-router-dom'
import { buildWhatsAppUrl, APP_CONFIG } from '@/lib/appConfig'
import { LegalLayout, type LegalSection } from './LegalLayout'
import { Mail, MessageCircle, CreditCard, Building2, Smartphone, Landmark, Banknote } from 'lucide-react'

const sections: LegalSection[] = [
  { id: 'medios-aceptados', title: '1. Medios de Pago Aceptados' },
  { id: 'procesamiento', title: '2. Procesamiento de Pagos' },
  { id: 'renovaciones', title: '3. Renovaciones y Cambios de Plan' },
  { id: 'seguridad', title: '4. Seguridad en los Pagos' },
  { id: 'contacto', title: '5. Contacto' },
]

const paymentMethods = [
  { icon: CreditCard, name: 'PSE, tarjetas crédito/débito', desc: 'Pasarela de pagos en línea' },
  { icon: Smartphone, name: 'Nequi', desc: 'Transferencia desde la app Nequi' },
  { icon: Smartphone, name: 'Daviplata', desc: 'Transferencia desde la app Daviplata' },
  { icon: Building2, name: 'Bre-B', desc: 'Transferencia inmediata' },
  { icon: Banknote, name: 'Transferencia bancaria', desc: 'Transferencia a cuenta bancaria de VenxPOS' },
]

export function MetodosPagoPage() {
  return (
    <LegalLayout title="Métodos de Pago" sections={sections}>
      <Section id="medios-aceptados" num="1" title="Medios de Pago Aceptados">
        <p className="text-sm text-slate-600 leading-relaxed mb-4">
          VenxPOS ofrece múltiples opciones de pago para facilitar la contratación y renovación
          del Servicio. Los métodos de pago pueden variar según la negociación y el plan
          seleccionado.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {paymentMethods.map((m, i) => {
            const Icon = m.icon
            return (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                  <Icon className="w-4.5 h-4.5 text-brand-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{m.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{m.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-sm text-slate-500 mt-3">
          Otros métodos de pago autorizados por la Gerencia también podrán ser aceptados previa coordinación.
        </p>
      </Section>

      <Section id="procesamiento" num="2" title="Procesamiento de Pagos">
        <p className="text-sm text-slate-600 leading-relaxed">
          Los pagos son procesados a través de una pasarela de pagos certificada
          S.A., que cumple con los más altos estándares de seguridad PCI-DSS. VenxPOS no almacena
          información sensible de tarjetas de crédito o débito. Todos los pagos generan una factura
          electrónica formal que será enviada al correo registrado del Cliente.
        </p>
      </Section>

      <Section id="renovaciones" num="3" title="Renovaciones y Cambios de Plan">
        <p className="text-sm text-slate-600 leading-relaxed">
          Las renovaciones y cambios de plan se gestionan mediante solicitud del Cliente a través
          de WhatsApp. El método de pago para estos conceptos podrá variar y será acordado entre
          el Cliente y la Gerencia al momento de la solicitud. Para más información sobre cambios
          de plan, consulte nuestra{' '}
          <Link to="/legal/reembolsos" className="text-brand-600 hover:underline">Política de Reembolsos</Link>.
        </p>
      </Section>

      <Section id="seguridad" num="4" title="Seguridad en los Pagos">
        <p className="text-sm text-slate-600 leading-relaxed">
          Todas las transacciones realizadas a través de VenxPOS utilizan cifrado TLS 1.3 y
          cumplen con los estándares de seguridad exigidos por la legislación colombiana.
          La pasarela de pagos está certificada bajo el estándar
          internacional PCI-DSS (Payment Card Industry Data Security Standard).
        </p>
      </Section>

      <Section id="contacto" num="5" title="Contacto">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          Para consultas sobre métodos de pago o facturación, puede comunicarse a través de
          los siguientes canales:
        </p>
        <div className="flex flex-wrap gap-3 mt-3">
          <a
            href={buildWhatsAppUrl('Hola, tengo una consulta sobre métodos de pago en VenxPOS.')}
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
