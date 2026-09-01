import { buildWhatsAppUrl, APP_CONFIG } from '@/lib/appConfig'
import { LegalLayout, type LegalSection } from './LegalLayout'
import { Mail, MessageCircle } from 'lucide-react'

const sections: LegalSection[] = [
  { id: 'proteccion-datos', title: '1. Protección de Datos Personales' },
  { id: 'comercio-electronico', title: '2. Comercio Electrónico' },
  { id: 'responsabilidad', title: '3. Régimen de Responsabilidad' },
  { id: 'contacto', title: '4. Contacto' },
]

export function CumplimientoPage() {
  return (
    <LegalLayout title="Cumplimiento Normativo" sections={sections}>
      <Section id="proteccion-datos" num="1" title="Protección de Datos Personales">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          VenxPOS cumple con la Ley 1581 de 2012 y el Decreto Reglamentario 1377 de 2013 sobre
          protección de datos personales (Habeas Data). El Servicio implementa:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
          <li>Política de tratamiento de datos personales disponible al público.</li>
          <li>Mecanismos para la recolección, almacenamiento y eliminación segura de datos.</li>
          <li>Procedimientos para la atención de consultas, reclamos y ejercicio de derechos ARCO.</li>
          <li>Medidas de seguridad técnicas y organizativas para proteger la información.</li>
        </ul>
      </Section>

      <Section id="comercio-electronico" num="2" title="Comercio Electrónico">
        <p className="text-sm text-slate-600 leading-relaxed">
          VenxPOS se acoge a lo dispuesto en la Ley 527 de 1999 sobre comercio electrónico y
          mensajes de datos, que reconoce la validez jurídica de los documentos electrónicos,
          las firmas digitales y las comunicaciones por medios electrónicos. Los registros
          generados por el Servicio tienen plena validez probatoria conforme a la legislación
          colombiana.
        </p>
      </Section>

      <Section id="responsabilidad" num="3" title="Régimen de Responsabilidad">
        <p className="text-sm text-slate-600 leading-relaxed">
          VenxPOS actúa como proveedor de infraestructura tecnológica para la operación
          comercial. El Cliente es el único responsable de la veracidad, integridad y exactitud
          de los datos, transacciones e información registrada en la plataforma, así como del
          cumplimiento de sus obligaciones comerciales, contables y tributarias ante las
          autoridades competentes.
        </p>
      </Section>

      <Section id="contacto" num="4" title="Contacto">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          Para consultas sobre cumplimiento normativo:
        </p>
        <div className="flex flex-wrap gap-3 mt-3">
          <a
            href={buildWhatsAppUrl('Hola, tengo una consulta sobre cumplimiento normativo en VenxPOS.')}
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