import { Link } from 'react-router-dom'

export function TerminosPage() {
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
            <h1 className="text-xl font-bold">Terminos y Condiciones</h1>
          </div>

          <div className="px-8 py-6 space-y-0">
            <p className="text-xs text-slate-400 mb-6">
              Ultima actualizacion: 21 de junio de 2026
            </p>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                1. Aceptacion de los Terminos
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Al acceder y utilizar VenxPOS (en adelante, &ldquo;el Servicio&rdquo;),
                usted acepta de manera expresa e irrevocable estos Terminos y Condiciones.
                Si no esta de acuerdo con la totalidad de las disposiciones aqui contenidas,
                debe abstenerse de utilizar el Servicio. El uso del Servicio constituye
                manifestacion tacita de aceptacion conforme al articulo 14 de la Ley 527
                de 1999 de la Republica de Colombia.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                2. Descripcion del Servicio
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                VenxPOS es una plataforma de punto de venta (POS) en la nube, ofrecida
                bajo el modelo SaaS (Software as a Service), que permite a comercios
                colombianos gestionar ventas, inventario, sucursales, facturacion
                electronica, clientes y suscripciones desde una interfaz web unificada.
                El Servicio se presta exclusivamente a traves de navegadores web y no
                requiere instalacion de software adicional.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                3. Registro y Cuenta
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                Para acceder al Servicio, el usuario debe crear una cuenta proporcionando
                informacion veraz, completa y actualizada, incluyendo:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
                <li>Razon social o nombre comercial del establecimiento</li>
                <li>Numero de Identificacion Tributaria (NIT) real del titular</li>
                <li>Correo electronico valido y numero de telefono de contacto</li>
                <li>Direccion fisica del establecimiento principal</li>
              </ul>
              <p className="text-sm text-slate-600 leading-relaxed mt-3">
                El usuario es el unico responsable de la confidencialidad de sus
                credenciales de acceso y de toda actividad que ocurra bajo su cuenta.
                VenxPOS se reserva el derecho de suspender o cancelar cuentas que
                proporcionen informacion falsa o incurran en suplantacion.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                4. Planes y Pagos
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                El Servicio se ofrece exclusivamente bajo tres (3) planes de suscripcion
                mensual en pesos colombianos (COP):
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
                <li>
                  <span className="font-medium text-slate-700">Plan Basico:</span>{' '}
                  funcionalidades esenciales de punto de venta y gestion de inventario
                  para una sucursal.
                </li>
                <li>
                  <span className="font-medium text-slate-700">Plan Estandar:</span>{' '}
                  multiples sucursales, reportes avanzados y facturacion electronica
                  basica.
                </li>
                <li>
                  <span className="font-medium text-slate-700">Plan Pro:</span>{' '}
                  todas las funcionalidades, API de integracion, soporte prioritario
                  y facturacion electronica ilimitada.
                </li>
              </ul>
              <p className="text-sm text-slate-600 leading-relaxed mt-3">
                Los pagos se procesan a traves de Wompi, pasarela de pagos de
                Bancolombia S.A. Al contratar un plan, el usuario autoriza los
                cobros recurrentes segun el plan seleccionado. Todos los precios
                incluyen el Impuesto al Valor Agregado (IVA) cuando corresponda
                segun el Estatuto Tributario colombiano. VenxPOS se reserva el
                derecho de modificar los precios notificando con al menos treinta
                (30) dias calendario de anticipacion.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                5. Cancelacion y Reembolsos
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                El usuario puede cancelar su suscripcion en cualquier momento desde
                el panel de administracion, sin penalizacion. La cancelacion surte
                efecto al finalizar el ciclo de facturacion en curso y el acceso al
                Servicio se mantiene hasta dicha fecha. Los terminos especificos de
                reembolso se rigen por nuestra{' '}
                <Link
                  to="/legal/reembolsos"
                  className="text-brand-600 hover:underline"
                >
                  Politica de Reembolsos
                </Link>
                , la cual forma parte integrante de estos Terminos.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                6. Propiedad Intelectual
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                VenxPOS, su codigo fuente, diseno, logo, marca, interfaz de usuario
                y toda la documentacion asociada constituyen propiedad intelectual
                exclusiva de VenxPOS. El usuario adquiere unicamente una licencia
                limitada, no exclusiva, no transferible y revocable para utilizar el
                Servicio conforme a estos Terminos. Queda expresamente prohibida la
                reproduccion, distribucion, ingenieria inversa, descompilacion o
                creacion de obras derivadas del software sin autorizacion previa y
                por escrito.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                7. Limitacion de Responsabilidad
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                VenxPOS se proporciona &ldquo;tal cual&rdquo; y &ldquo;segun
                disponibilidad&rdquo;, sin garantias explicitas o implicitas de
                disponibilidad continua o ausencia de errores. En la maxima medida
                permitida por la legislacion colombiana, VenxPOS no sera responsable
                por danos indirectos, incidentales, especiales o consecuentes,
                incluyendo pero no limitado a perdida de datos, lucro cesante,
                perdida de oportunidad comercial o interrupcion operativa. La
                responsabilidad total de VenxPOS, en cualquier circunstancia, se
                limita al valor de la ultima mensualidad pagada por el usuario.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                8. Modificaciones a los Terminos
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                VenxPOS se reserva el derecho de modificar estos Terminos en
                cualquier momento. Los cambios sustanciales seran notificados al
                correo electronico registrado con al menos quince (15) dias
                calendario de anticipacion a su entrada en vigor. El uso continuado
                del Servicio con posterioridad a la entrada en vigor de los nuevos
                Terminos constituye aceptacion plena de los mismos.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                9. Ley Aplicable y Jurisdiccion
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Estos Terminos y Condiciones se rigen por las leyes de la Republica
                de Colombia, particularmente por la Ley 527 de 1999 sobre comercio
                electronico, el Estatuto del Consumidor (Ley 1480 de 2011) y el
                Codigo de Comercio colombiano. Cualquier controversia derivada de
                estos Terminos sera sometida a la jurisdiccion de los jueces civiles
                del circuito de Bogota D.C., con renuncia expresa a cualquier otro
                fuero que pudiera corresponder.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                10. Contacto
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Para consultas, notificaciones o reclamaciones relacionadas con
                estos Terminos, comuniquese al correo electronico:{' '}
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
