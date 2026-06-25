import { Link } from 'react-router-dom'

export function CookiesPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link
          to="/"
          className="text-sm text-brand-600 hover:text-brand-700 transition-colors inline-block mb-6"
        >
          &larr; Volver al inicio
        </Link>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-600 to-brand-800 text-white px-8 py-6">
            <h1 className="text-xl font-bold">Politica de Cookies</h1>
          </div>

          <div className="px-8 py-6 space-y-0">
            <p className="text-xs text-slate-400 mb-6">
              Ultima actualizacion: 21 de junio de 2026
            </p>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                1. Que son las Cookies
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Las cookies son pequenos archivos de texto que los sitios web
                almacenan en el navegador del usuario. Permiten que el sitio recuerde
                informacion sobre la visita, como las preferencias de idioma, la
                sesion activa y otras configuraciones, con el fin de mejorar la
                experiencia del usuario y el funcionamiento del sitio.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                2. Tipos de Cookies Utilizadas
              </h2>

              <div className="space-y-4 mt-4">
                <div>
                  <h3 className="text-sm font-medium text-slate-800 mb-1">
                    Cookies necesarias (de sesion)
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Son esenciales para el funcionamiento de la plataforma. Permiten
                    la autenticacion del usuario, el mantenimiento de la sesion activa
                    y la navegacion segura dentro de la aplicacion. Sin estas cookies,
                    VenxPOS no puede funcionar correctamente.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-800 mb-1">
                    Cookies analiticas
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Utilizamos cookies analiticas propias, sin vinculacion a terceros
                    de publicidad, para medir el rendimiento de la plataforma, detectar
                    errores tecnicos y analizar patrones de uso agregados. No se
                    recolecta informacion de identificacion personal a traves de estas
                    cookies.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-800 mb-1">
                    Cookies de preferencias
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Permiten recordar preferencias del usuario, como el idioma de la
                    interfaz o configuraciones de visualizacion, para ofrecer una
                    experiencia personalizada en visitas posteriores.
                  </p>
                </div>
              </div>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                3. Cookies de Terceros
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                Algunas funcionalidades del Servicio dependen de proveedores externos
                que pueden instalar sus propias cookies:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
                <li>
                  <span className="font-medium text-slate-700">Supabase:</span>{' '}
                  proveedor de infraestructura de base de datos y autenticacion.
                  Instala cookies tecnicas necesarias para gestionar las sesiones de
                  los usuarios y mantener la seguridad de la plataforma.
                </li>
                <li>
                  <span className="font-medium text-slate-700">Wompi:</span>{' '}
                  pasarela de pagos de Bancolombia. Los pagos se procesan en una
                  ventana o redireccion a los servidores de Wompi, los cuales operan
                  bajo su propia politica de cookies y privacidad. VenxPOS no tiene
                  control sobre dichas cookies.
                </li>
              </ul>
              <p className="text-sm text-slate-600 leading-relaxed mt-3">
                VenxPOS no utiliza cookies de rastreo publicitario, redes sociales
                ni herramientas de segmentacion de terceros.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                4. Tabla de Cookies
              </h2>
              <div className="overflow-x-auto mt-4">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-3 font-semibold text-slate-900">
                        Nombre
                      </th>
                      <th className="text-left py-3 px-3 font-semibold text-slate-900">
                        Proposito
                      </th>
                      <th className="text-left py-3 px-3 font-semibold text-slate-900">
                        Duracion
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-600">
                    <tr className="border-b border-slate-50">
                      <td className="py-3 px-3 font-mono text-xs">
                        sb-*-auth-token
                      </td>
                      <td className="py-3 px-3">
                        Autenticacion y mantenimiento de sesion activa
                      </td>
                      <td className="py-3 px-3">Sesion</td>
                    </tr>
                    <tr className="border-b border-slate-50">
                      <td className="py-3 px-3 font-mono text-xs">
                        supabase-auth-token
                      </td>
                      <td className="py-3 px-3">
                        Token de autenticacion de Supabase (JWT)
                      </td>
                      <td className="py-3 px-3">Persistente (360 dias)</td>
                    </tr>
                    <tr className="border-b border-slate-50">
                      <td className="py-3 px-3 font-mono text-xs">
                        venxpos_prefs
                      </td>
                      <td className="py-3 px-3">
                        Preferencias de interfaz de usuario
                      </td>
                      <td className="py-3 px-3">Persistente (365 dias)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                5. Como Deshabilitar las Cookies
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                El usuario puede configurar su navegador para rechazar todas las
                cookies o para que le notifique cuando se envie una cookie. Sin
                embargo, al ser las cookies de VenxPOS estrictamente necesarias
                para la autenticacion y el funcionamiento de la plataforma, su
                desactivacion impedira el inicio de sesion y el uso del Servicio.
                A continuacion, se indican los enlaces a las guias de configuracion
                de los navegadores mas comunes: Google Chrome, Mozilla Firefox,
                Microsoft Edge y Safari.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                6. Consentimiento
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                Al utilizar VenxPOS, el usuario acepta el uso de las cookies descritas
                en esta Politica. El consentimiento se otorga mediante:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
                <li>
                  La continuacion de la navegacion en la plataforma tras la
                  visualizacion del aviso de cookies.
                </li>
                <li>
                  La aceptacion expresa de los Terminos y Condiciones al momento
                  del registro.
                </li>
              </ul>
              <p className="text-sm text-slate-600 leading-relaxed mt-3">
                Si el usuario no acepta el uso de cookies necesarias, debera
                abstenerse de utilizar el Servicio.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                7. Contacto
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Para cualquier consulta sobre esta Politica de Cookies:{' '}
                <a
                  href="mailto:soporte@venxpos.com"
                  className="text-brand-600 hover:underline"
                >
                  soporte@venxpos.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
