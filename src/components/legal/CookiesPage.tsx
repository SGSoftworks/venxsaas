import { buildWhatsAppUrl, APP_CONFIG } from '@/lib/appConfig'
import { LegalLayout, type LegalSection } from './LegalLayout'
import { Mail, MessageCircle } from 'lucide-react'

const sections: LegalSection[] = [
  { id: 'que-son', title: '1. ¿Qué son las Cookies?' },
  { id: 'tipos', title: '2. Tipos de Cookies Utilizadas' },
  { id: 'terceros', title: '3. Cookies de Terceros' },
  { id: 'tabla', title: '4. Tabla de Cookies' },
  { id: 'deshabilitar', title: '5. Cómo Deshabilitar las Cookies' },
  { id: 'consentimiento', title: '6. Consentimiento' },
  { id: 'contacto', title: '7. Contacto' },
]

export function CookiesPage() {
  return (
    <LegalLayout title="Política de Cookies" sections={sections}>
      <Section id="que-son" num="1" title="¿Qué son las Cookies?">
        <p className="text-sm text-slate-600 leading-relaxed">
          Las cookies son pequeños archivos de texto que los sitios web almacenan en el navegador
          del usuario. Permiten que el sitio recuerde información sobre la visita, como las
          preferencias de idioma, la sesión activa y otras configuraciones, con el fin de mejorar
          la experiencia del usuario y el funcionamiento del sitio.
        </p>
      </Section>

      <Section id="tipos" num="2" title="Tipos de Cookies Utilizadas">
        <div className="space-y-4 mt-2">
          <div>
            <h3 className="text-sm font-medium text-slate-800 mb-1">Cookies técnicas (necesarias)</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Son esenciales para el funcionamiento de la plataforma. Permiten la autenticación
              del usuario, el mantenimiento de la sesión activa y la navegación segura dentro de
              la aplicación. Sin estas cookies, VenxPOS no puede funcionar correctamente.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-800 mb-1">Cookies funcionales</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Permiten recordar preferencias del usuario, como el idioma de la interfaz o
              configuraciones de visualización, para ofrecer una experiencia personalizada
              en visitas posteriores.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-800 mb-1">Cookies analíticas</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Utilizamos cookies analíticas propias, sin vinculación a terceros de publicidad,
              para medir el rendimiento de la plataforma, detectar errores técnicos y analizar
              patrones de uso agregados. No se recolecta información de identificación personal
              a través de estas cookies.
            </p>
          </div>
        </div>
      </Section>

      <Section id="terceros" num="3" title="Cookies de Terceros">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          Algunas funcionalidades del Servicio dependen de proveedores externos que pueden
          instalar sus propias cookies:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
          <li><span className="font-medium text-slate-700">Supabase:</span> proveedor de infraestructura de base de datos y autenticación. Instala cookies técnicas necesarias para gestionar las sesiones de los usuarios y mantener la seguridad de la plataforma.</li>
          <li><span className="font-medium text-slate-700">Wompi:</span> pasarela de pagos de Bancolombia. Los pagos se procesan en una ventana o redirección a los servidores de Wompi, los cuales operan bajo su propia política de cookies y privacidad.</li>
        </ul>
        <p className="text-sm text-slate-600 leading-relaxed mt-3">
          VenxPOS no utiliza cookies de rastreo publicitario, redes sociales ni herramientas de
          segmentación de terceros. En el futuro, si se implementan nuevas funcionalidades que
          requieran cookies adicionales, se actualizará esta Política y se notificará a los usuarios.
        </p>
      </Section>

      <Section id="tabla" num="4" title="Tabla de Cookies">
        <div className="overflow-x-auto mt-2">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-3 font-semibold text-slate-900">Nombre</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-900">Propósito</th>
                <th className="text-left py-3 px-3 font-semibold text-slate-900">Duración</th>
              </tr>
            </thead>
            <tbody className="text-slate-600">
              <tr className="border-b border-slate-50">
                <td className="py-3 px-3 font-mono text-xs">sb-*-auth-token</td>
                <td className="py-3 px-3">Autenticación y mantenimiento de sesión activa</td>
                <td className="py-3 px-3">Sesión</td>
              </tr>
              <tr className="border-b border-slate-50">
                <td className="py-3 px-3 font-mono text-xs">supabase-auth-token</td>
                <td className="py-3 px-3">Token de autenticación de Supabase (JWT)</td>
                <td className="py-3 px-3">Persistente (360 días)</td>
              </tr>
              <tr className="border-b border-slate-50">
                <td className="py-3 px-3 font-mono text-xs">venxpos_prefs</td>
                <td className="py-3 px-3">Preferencias de interfaz de usuario</td>
                <td className="py-3 px-3">Persistente (365 días)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="deshabilitar" num="5" title="Cómo Deshabilitar las Cookies">
        <p className="text-sm text-slate-600 leading-relaxed">
          El usuario puede configurar su navegador para rechazar todas las cookies o para que le
          notifique cuando se envíe una cookie. Sin embargo, al ser las cookies de VenxPOS
          estrictamente necesarias para la autenticación y el funcionamiento de la plataforma,
          su desactivación impedirá el inicio de sesión y el uso del Servicio.
        </p>
        <p className="text-sm text-slate-600 leading-relaxed mt-3">
          A continuación, se indican los enlaces a las guías de configuración de los navegadores
          más comunes:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed mt-2">
          <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">Google Chrome</a></li>
          <li><a href="https://support.mozilla.org/es/kb/cookies-informacion-que-los-sitios-web-guardan-en-" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">Mozilla Firefox</a></li>
          <li><a href="https://support.microsoft.com/es-es/windows/eliminar-y-administrar-cookies-168dab11-0753-043d-7c16-ede5947fc64d" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">Microsoft Edge</a></li>
          <li><a href="https://support.apple.com/es-es/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">Safari</a></li>
        </ul>
      </Section>

      <Section id="consentimiento" num="6" title="Consentimiento">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          Al utilizar VenxPOS, el usuario acepta el uso de las cookies descritas en esta Política.
          El consentimiento se otorga mediante:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
          <li>La continuación de la navegación en la plataforma tras la visualización del aviso de cookies.</li>
          <li>La aceptación expresa de los Términos y Condiciones al momento del registro.</li>
        </ul>
        <p className="text-sm text-slate-600 leading-relaxed mt-3">
          Si el usuario no acepta el uso de cookies necesarias, deberá abstenerse de utilizar el Servicio.
        </p>
      </Section>

      <Section id="contacto" num="7" title="Contacto">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          Para cualquier consulta sobre esta Política de Cookies, puede comunicarse a través de
          los siguientes canales:
        </p>
        <div className="flex flex-wrap gap-3 mt-3">
          <a
            href={buildWhatsAppUrl('Hola, tengo una consulta sobre la Política de Cookies de VenxPOS.')}
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
