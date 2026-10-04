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
  kilometraje: string;
  trabajo: string;
  monto: string;
}

export interface TurnoAdmin {
  email: string;
  fecha: string;
  horario: string;
  patente: string;
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
