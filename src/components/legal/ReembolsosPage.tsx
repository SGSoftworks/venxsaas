import { Link } from 'react-router-dom'

export function ReembolsosPage() {
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
            <h1 className="text-xl font-bold">Politica de Reembolsos</h1>
          </div>

          <div className="px-8 py-6 space-y-0">
            <p className="text-xs text-slate-400 mb-6">
              Ultima actualizacion: 21 de junio de 2026
            </p>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                1. Pago Inicial
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                El pago inicial correspondiente a la primera mensualidad del plan
                seleccionado (Basico, Estandar o Pro) no es reembolsable. Este pago
                cubre los costos de configuracion de la cuenta, activacion del
                tenant, provision de recursos en la nube y soporte de incorporacion
                inicial (onboarding). Al completar el proceso de registro y pago,
                el usuario acepta que la prestacion del Servicio inicia de inmediato,
                conforme a lo previsto en el articulo 47 del Estatuto del Consumidor
                (Ley 1480 de 2011) sobre la exclusion del derecho de retracto en
                servicios que inician su ejecucion con el consentimiento expreso del
                consumidor.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                2. Mensualidades
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Las mensualidades posteriores no son reembolsables una vez iniciado
                el ciclo de facturacion correspondiente. El cobro se realiza de
                manera automatica al inicio de cada periodo mensual. No se realizan
                reembolsos parciales ni prorrateos por dias no utilizados dentro
                del ciclo de facturacion en curso, con excepcion de los casos
                previstos en la seccion 6 de esta Politica.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                3. Errores de Cobro
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                En caso de errores de facturacion, cobros duplicados o cobros
                posteriores a una cancelacion debidamente registrada, el usuario
                dispone de un plazo de cinco (5) dias habiles contados desde la
                fecha del cobro para presentar su reclamacion ante{' '}
                <a
                  href="mailto:soporte@venxpos.com"
                  className="text-brand-600 hover:underline"
                >
                  soporte@venxpos.com
                </a>
                . La solicitud debe incluir el comprobante de la transaccion y el
                ID de referencia de Wompi. VenxPOS revisara el caso y, de proceder,
                tramitara el reembolso en un plazo maximo de diez (10) dias habiles
                al metodo de pago original.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                4. Cambios de Plan
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                El usuario puede cambiar de plan en cualquier momento desde el panel
                de administracion. El ajuste de precio se aplica al siguiente ciclo
                de facturacion. En el caso de cambio a un plan de mayor valor
                durante el ciclo vigente, se cobrara la diferencia proporcional por
                los dias restantes del periodo actual. En el caso de cambio a un
                plan de menor valor, no se generan reembolsos ni creditos; el nuevo
                precio entrara en vigor al inicio del siguiente ciclo.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                5. Cancelacion
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                La cancelacion de la suscripcion puede realizarse en cualquier
                momento y sin penalizacion desde el panel de administracion. Una vez
                cancelada, el usuario mantiene acceso completo al Servicio hasta la
                finalizacion del ciclo de facturacion ya pagado. No se realizaran
                cobros adicionales con posterioridad a la fecha de cancelacion.
                Tras la finalizacion del periodo, la cuenta se desactiva y los datos
                se conservan conforme a nuestra Politica de Privacidad.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                6. Casos Excepcionales
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                VenxPOS evaluara solicitudes de reembolso en las siguientes
                circunstancias excepcionales, que seran analizadas caso por caso:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
                <li>
                  Falla tecnica comprobada atribuible a VenxPOS que impida el uso
                  del Servicio por un periodo continuo superior a cuarenta y ocho
                  (48) horas, siempre que el usuario haya reportado la incidencia al
                  soporte en las primeras veinticuatro (24) horas.
                </li>
                <li>
                  Cobro duplicado por error del sistema de facturacion de VenxPOS
                  o de la pasarela de pagos.
                </li>
                <li>
                  Cobro realizado con posterioridad a una cancelacion completada y
                  confirmada por el sistema.
                </li>
                <li>
                  Incumplimiento sustancial del Servicio que no pueda ser subsanado
                  en un plazo razonable.
                </li>
              </ul>
              <p className="text-sm text-slate-600 leading-relaxed mt-3">
                La decision sobre cada caso sera comunicada al usuario en un plazo
                no mayor a diez (10) dias habiles desde la recepcion de la solicitud
                completa. VenxPOS se reserva el derecho de solicitar documentacion
                adicional para evaluar la procedencia del reembolso.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                7. Contacto
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Para solicitudes de reembolso, reclamaciones o consultas:{' '}
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
