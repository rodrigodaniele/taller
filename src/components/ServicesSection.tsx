import { CheckCircle2, ArrowRight } from 'lucide-react';

interface ServicesSectionProps {
  onScheduleClick: () => void;
}

export const ServicesSection = ({ onScheduleClick }: ServicesSectionProps) => {
  const services = [
    {
      title: 'Alineación Computarizada 3D',
      subtitle: 'Dirección precisa y desgaste parejo de cubiertas',
      description:
        'Ajustamos de manera milimétrica los ángulos geométricos de las cuatro ruedas con sensores láser de alta resolución. Garantizamos que el auto ruede en línea recta sin derivas ni tironeos.',
      image: '/assets/images/service_wheel_alignment_1791116604956.jpg',
      points: [
        'Medición de convergencia, divergencia, comba y caster',
        'Evita el desgaste prematuro e irregular de los neumáticos',
        'Mejora inmediata del consumo de combustible y maniobrabilidad',
      ],
    },
    {
      title: 'Balanceo Dinámico Digital',
      subtitle: 'Conducción suave y libre de vibraciones',
      description:
        'Corregimos el desbalance de peso del conjunto llanta-neumático mediante diagnóstico computarizado de alta velocidad. Eliminamos los rebotes y sacudidas del volante en ruta.',
      image: '/assets/images/service_digital_balancing_1791116616505.jpg',
      points: [
        'Diagnóstico dinámico y estático de alta sensibilidad',
        'Contrapesas calibradas de máxima fijación',
        'Protege los rodamientos y bujes de la masa de rueda',
      ],
    },
    {
      title: 'Tren Delantero & Suspensión',
      subtitle: 'Inspección técnica integral y recambio de componentes',
      description:
        'Revisión estructural minuciosa de cada pieza que conecta las ruedas con el chasis. Diagnosticamos holguras, fatiga de materiales y ruidos extraños antes de que se conviertan en fallas graves.',
      image: '/assets/images/service_front_suspension_1791116625797.jpg',
      points: [
        'Amortiguadores, cazoletas y espirales',
        'Rótulas, extremos de dirección y axiales (precaps)',
        'Bujes de parrilla, barra estabilizadora y cremallera hidráulica',
      ],
    },
  ];

  return (
    <section id="servicios" className="py-20 lg:py-28 bg-[#090909] border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-xs uppercase tracking-widest text-red-500 font-heading font-bold mb-2">
            Precisión y Seguridad Mecánica
          </p>
          <h2 className="text-3xl sm:text-4xl font-heading font-black text-white uppercase tracking-tight [text-wrap:balance]">
            Nuestros Servicios Profesionales
          </h2>
          <p className="mt-4 text-sm sm:text-base text-neutral-400 [text-wrap:balance]">
            Trabajamos con instrumental tecnológico avanzado para diagnosticar y dejar tu vehículo en condiciones óptimas para transitar cualquier camino.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {services.map((item, idx) => (
            <div
              key={idx}
              className="group flex flex-col bg-[#050505] rounded-xl border border-neutral-800 hover:border-red-600/50 transition-all duration-300 overflow-hidden shadow-lg shadow-black/60"
            >
              <div className="relative h-56 w-full overflow-hidden bg-neutral-900">
                <img
                  src={item.image}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
                <div className="absolute bottom-3 left-4 text-xs font-mono font-bold text-red-400">
                  {`0${idx + 1}. SERVICIO`}
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-heading font-black text-xl text-white uppercase tracking-wide group-hover:text-red-500 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-red-400/90 font-medium mt-1">
                    {item.subtitle}
                  </p>
                  <p className="mt-4 text-sm text-neutral-400 leading-relaxed">
                    {item.description}
                  </p>

                  <div className="mt-6 pt-5 border-t border-neutral-900 space-y-2.5">
                    {item.points.map((pt, pIdx) => (
                      <div key={pIdx} className="flex items-start gap-2.5 text-xs text-neutral-300">
                        <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <span>{pt}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-4">
                  <button
                    onClick={onScheduleClick}
                    className="w-full py-3 px-4 rounded bg-neutral-900 hover:bg-red-600 text-neutral-200 hover:text-white border border-neutral-800 hover:border-red-600 font-heading font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200"
                  >
                    <span>Solicitar Turno para este servicio</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
