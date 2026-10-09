export interface User {
  nombre: string;
  telefono: string;
  email: string;
}

export interface Turno {
  fecha: string;
  horario: string;
  patente: string;
  estado: string;
}

export interface HistorialServicio {
  fecha: string;
  horario: string;
  patente: string;
  modelo?: string;
  kilometraje: string;
  trabajo: string;
  monto: string;
}

export interface TurnoAdmin {
  email: string;
  fecha: string;
  horario: string;
  patente: string;
  nombre?: string;
  telefono?: string;
  estado?: string;
}

export interface DatosTrabajoAdmin {
  email: string;
  fecha: string;
  horario: string;
  patente: string;
  kilometraje: string;
  trabajoRealizado: string;
  montoFinal: string;
}

export interface MovimientoContable {
  id: string;
  fecha: string;
  tipo: 'ingreso' | 'gasto';
  concepto: string;
  categoria: string;
  monto: number;
  metodoPago: string;
  referencia?: string;
}

export interface ItemPresupuesto {
  id: string;
  tipo: 'mano_de_obra' | 'repuesto';
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface ItemStock {
  id: string;
  nombre: string;
  categoria?: string;
  vehiculoCompatibilidad?: string;
  stockActual: number;
  stockMinimo: number;
  costoUnitario: number;
  precioVenta: number;
  totalInstalados: number; // Rotación histórica
  ultimoMovimiento?: string;
}

export interface RepuestoUsado {
  id: string;
  fecha: string;
  repuestoNombre: string;
  cantidad: number;
  vehiculo?: string;
  patente?: string;
  cliente?: string;
  origen: 'manual' | 'facturacion' | 'presupuesto';
  presupuestoId?: string;
  observaciones?: string;
}

export interface CompraRepuesto {
  id: string;
  fecha: string;
  repuestoNombre: string;
  categoria?: string;
  vehiculoCompatibilidad?: string;
  cantidad: number;
  costoUnitario: number;
  costoTotal: number;
  proveedor?: string;
  metodoPago: string;
  comprobante?: string;
  impactaContabilidad: boolean;
}

export interface Presupuesto {
  id: string;
  numero: string;
  fecha: string;
  validezDias: number;
  clienteNombre: string;
  clienteTelefono: string;
  clienteEmail?: string;
  vehiculoModelo?: string;
  patente: string;
  kilometraje?: string;
  items: ItemPresupuesto[];
  descuentoPorcentaje?: number;
  total: number;
  estado:
    | 'pendiente'
    | 'aprobado'
    | 'ingreso_taller'
    | 'en_reparacion'
    | 'trabajo_terminado'
    | 'facturado'
    | 'a_cuenta_corriente'
    | 'rechazado';
  observaciones?: string;
  turnoRef?: string;
  createdAt: string;
}

export interface CuentaCorrienteItem {
  id: string;
  fecha: string;
  clienteNombre?: string;
  clienteEmail: string;
  patente: string;
  concepto: string;
  montoTotal: number;
  montoPagado: number;
  saldoPendiente: number;
  estado: 'pendiente' | 'parcial' | 'pagado';
  presupuestoId?: string;
  observaciones?: string;
  ultimoPagoFecha?: string;
  metodoUltimoPago?: string;
}

export interface ApiResponse<T = any> {
  resultado?: 'ok' | 'error' | 'mercadopago';
  success?: boolean;
  mensaje?: string;
  error?: string;
  nombre?: string;
  telefono?: string;
  email?: string;
  turnos?: Turno[];
  ocupados?: string[];
  urlPago?: string;
  historial?: HistorialServicio[];
  movimientos?: MovimientoContable[];
  [key: string]: any;
}
