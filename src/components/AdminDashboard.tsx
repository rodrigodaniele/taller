import { useState, useEffect, useId, useTransition } from 'react';
import { TurnoAdmin, DatosTrabajoAdmin, MovimientoContable } from '../types';
import { gasApi } from '../services/gasApi';
import { WORKSHOP_ITEMS, GASTOS_PREDEFINIDOS } from '../constants/workshopItems';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Wrench,
  X,
  Loader2,
  Calendar,
  Clock,
  Car,
  Mail,
  CheckCircle2,
  ArrowLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  PlusCircle,
  MinusCircle,
  FileSpreadsheet,
  Trash2,
  Receipt,
  Copy,
  Check
} from 'lucide-react';

interface AdminDashboardProps {
  onBackToHome: () => void;
  onShowToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void;
}

export const AdminDashboard = ({ onBackToHome, onShowToast }: AdminDashboardProps) => {
  const [activeAdminTab, setActiveAdminTab] = useState<'turnos' | 'contabilidad' | 'script'>('turnos');
  const [, startTransition] = useTransition();

  // --- Turnos state ---
  const [turnos, setTurnos] = useState<TurnoAdmin[]>([]);
  const [loadingTurnos, setLoadingTurnos] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected turno modal & multi-select services
  const [selectedTurno, setSelectedTurno] = useState<TurnoAdmin | null>(null);
  const [kilometraje, setKilometraje] = useState('');
  const [selectedServicios, setSelectedServicios] = useState<string[]>([]);
  const [notasTrabajoAdicional, setNotasTrabajoAdicional] = useState('');
  const [montoCobrado, setMontoCobrado] = useState('');
  const [autoRegistrarContabilidad, setAutoRegistrarContabilidad] = useState(true);
  const [metodoPagoReparacion, setMetodoPagoReparacion] = useState('Efectivo');
  const [savingWork, setSavingWork] = useState(false);

  // --- Contabilidad state ---
  const [movimientos, setMovimientos] = useState<MovimientoContable[]>([]);
  const [loadingContabilidad, setLoadingContabilidad] = useState(false);
  const [filtroPeriodo, setFiltroPeriodo] = useState<'todos' | 'mes' | 'semana' | 'hoy'>('mes');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'ingreso' | 'gasto'>('todos');
  const [filtroBusquedaContable, setFiltroBusquedaContable] = useState('');

  // New movement modal state
  const [showModalMovimiento, setShowModalMovimiento] = useState(false);
  const [nuevoTipo, setNuevoTipo] = useState<'ingreso' | 'gasto'>('ingreso');
  const [nuevaFecha, setNuevaFecha] = useState(new Date().toISOString().split('T')[0]);
  const [itemPredefinidoSeleccionado, setItemPredefinidoSeleccionado] = useState('');
  const [nuevoConcepto, setNuevoConcepto] = useState('');
  const [nuevaCategoria, setNuevaCategoria] = useState('Mano de Obra / Taller');
  const [nuevoMonto, setNuevoMonto] = useState('');
  const [nuevoMetodoPago, setNuevoMetodoPago] = useState('Efectivo');
  const [nuevaReferencia, setNuevaReferencia] = useState('');
  const [guardandoMovimiento, setGuardandoMovimiento] = useState(false);

  // Script copy state
  const [copiedScript, setCopiedScript] = useState(false);

  // Form IDs
  const searchInputId = useId();
  const kmInputId = useId();
  const trabajoInputId = useId();
  const montoInputId = useId();
  const metodoPagoRepId = useId();

  const fechaMovId = useId();
  const conceptoMovId = useId();
  const catMovId = useId();
  const montoMovId = useId();
  const metodoPagoMovId = useId();
  const refMovId = useId();
  const busquedaContableId = useId();

  // Load turnos
  const fetchTurnos = async () => {
    setLoadingTurnos(true);
    try {
      const res = await gasApi.getAdminTurnos();
      if (res.success && Array.isArray(res.turnos)) {
        setTurnos(res.turnos);
      } else {
        setTurnos([]);
        if (res.error) onShowToast('error', 'Error en Google Sheets', res.error);
      }
    } catch (err: any) {
      console.error(err);
      onShowToast('error', 'Falla de conexión', 'No se pudieron consultar los turnos.');
    } finally {
      setLoadingTurnos(false);
    }
  };

  // Load contabilidad
  const fetchContabilidad = async () => {
    setLoadingContabilidad(true);
    try {
      const res = await gasApi.getAccountingMovements();
      if (res.success && Array.isArray(res.movimientos)) {
        setMovimientos(res.movimientos);
      } else {
        setMovimientos([]);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingContabilidad(false);
    }
  };

  useEffect(() => {
    fetchTurnos();
    fetchContabilidad();
  }, []);

  // Filter turnos
  const filteredTurnos = turnos.filter((t) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const pat = String(t.patente || '').toLowerCase();
    const em = String(t.email || '').toLowerCase();
    return pat.includes(term) || em.includes(term);
  });

  // Filter contabilidad movements by period, type, and search
  const filteredMovimientos = movimientos.filter((m) => {
    // Type filter
    if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) {
      return false;
    }

    // Search filter
    if (filtroBusquedaContable) {
      const term = filtroBusquedaContable.toLowerCase().trim();
      const conc = String(m.concepto || '').toLowerCase();
      const cat = String(m.categoria || '').toLowerCase();
      const ref = String(m.referencia || '').toLowerCase();
      if (!conc.includes(term) && !cat.includes(term) && !ref.includes(term)) {
        return false;
      }
    }

    // Period filter
    if (filtroPeriodo === 'todos') return true;

    try {
      const parts = String(m.fecha).replace("'", '').split('-');
      if (parts.length < 3) return true;
      const movDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const now = new Date();

      if (filtroPeriodo === 'hoy') {
        return (
          movDate.getFullYear() === now.getFullYear() &&
          movDate.getMonth() === now.getMonth() &&
          movDate.getDate() === now.getDate()
        );
      }

      if (filtroPeriodo === 'semana') {
        const diffTime = Math.abs(now.getTime() - movDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      }

      if (filtroPeriodo === 'mes') {
        return movDate.getFullYear() === now.getFullYear() && movDate.getMonth() === now.getMonth();
      }
    } catch (e) {
      return true;
    }

    return true;
  });

  // Financial calculations
  const totalIngresos = filteredMovimientos
    .filter((m) => m.tipo === 'ingreso')
    .reduce((sum, m) => sum + (Number(m.monto) || 0), 0);

  const totalGastos = filteredMovimientos
    .filter((m) => m.tipo === 'gasto')
    .reduce((sum, m) => sum + (Number(m.monto) || 0), 0);

  const balanceNeto = totalIngresos - totalGastos;

  // Multi-select toggle for workshop services
  const toggleServicio = (item: string) => {
    setSelectedServicios((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  // Predefined expense or income selector handler
  const handleItemPredefinidoChange = (val: string) => {
    setItemPredefinidoSeleccionado(val);
    if (!val) {
      setNuevoConcepto('');
      return;
    }

    if (nuevoTipo === 'gasto') {
      if (val === 'Otro Gasto (Personalizado)') {
        setNuevoConcepto('');
        setNuevaCategoria('Otro Gasto');
      } else if (val.includes('Boleta de Luz') || val.includes('Alquiler') || val.includes('Servicio de Internet')) {
        setNuevoConcepto(val);
        setNuevaCategoria('Alquiler / Servicios / Impuestos');
      } else if (val.includes('Insumos de Taller')) {
        setNuevoConcepto(val);
        setNuevaCategoria('Insumos de Taller');
      } else if (val.includes('Mantenimiento')) {
        setNuevoConcepto(val);
        setNuevaCategoria('Mantenimiento Máquinas / Rampa');
      } else if (val.includes('Sueldos')) {
        setNuevoConcepto(val);
        setNuevaCategoria('Sueldos / Ayudante');
      } else {
        // Es un repuesto (EXTREMO, AMORTIGUADOR, RULEMAN, etc.)
        setNuevoConcepto(`Compra de ${val}`);
        setNuevaCategoria('Repuestos / Repuesteros');
      }
    } else {
      if (val.includes('Otro')) {
        setNuevoConcepto('');
        setNuevaCategoria('Otro Ingreso');
      } else {
        setNuevoConcepto(`Cobro ${val}`);
        setNuevaCategoria('Mano de Obra / Taller');
      }
    }
  };

  // Save work from appointment modal
  const handleSaveWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTurno) return;

    if (!kilometraje) {
      onShowToast('warning', 'Kilometraje requerido', 'Ingresá los kilómetros actuales del vehículo.');
      return;
    }

    if (selectedServicios.length === 0) {
      onShowToast(
        'warning',
        'Seleccioná los trabajos realizados',
        'Elegí al menos un componente o servicio de la lista (ej: ALINEACIÓN Y BALANCEO, RULEMÁN DE MAZA, etc.).'
      );
      return;
    }

    if (!montoCobrado) {
      onShowToast('warning', 'Monto requerido', 'Ingresá el monto total cobrado.');
      return;
    }

    const trabajoFinal =
      selectedServicios.join(' + ') +
      (notasTrabajoAdicional.trim() ? ` [${notasTrabajoAdicional.trim()}]` : '');

    setSavingWork(true);
    try {
      const payload: DatosTrabajoAdmin = {
        email: selectedTurno.email,
        fecha: selectedTurno.fecha,
        horario: selectedTurno.horario,
        patente: selectedTurno.patente,
        kilometraje,
        trabajoRealizado: trabajoFinal,
        montoFinal: montoCobrado,
      };

      const res = await gasApi.saveAdminWork(payload);

      // Auto-register in contabilidad if checked
      if (autoRegistrarContabilidad && Number(montoCobrado) > 0) {
        const cleanFecha = String(selectedTurno.fecha).replace("'", '');
        const movimientoItem: MovimientoContable = {
          id: 'MOV-' + Date.now(),
          fecha: cleanFecha || new Date().toISOString().split('T')[0],
          tipo: 'ingreso',
          concepto: `Reparación: ${trabajoFinal.substring(0, 50)}`,
          categoria: 'Mano de Obra / Taller',
          monto: Number(montoCobrado),
          metodoPago: metodoPagoReparacion,
          referencia: selectedTurno.patente.toUpperCase(),
        };
        await gasApi.addAccountingMovement(movimientoItem);
        fetchContabilidad();
      }

      if (res.success) {
        onShowToast(
          'success',
          '¡Trabajo registrado y archivado!',
          `Vehículo ${selectedTurno.patente} pasado a Atendido con: ${trabajoFinal}.${
            autoRegistrarContabilidad ? ' Se sumó el cobro a Contabilidad.' : ''
          }`
        );
        setSelectedTurno(null);
        setSelectedServicios([]);
        setNotasTrabajoAdicional('');
        fetchTurnos();
      } else {
        onShowToast('error', 'Error al guardar', res.error || 'No se pudo actualizar la planilla.');
      }
    } catch (err: any) {
      onShowToast('error', 'Falla de red', err.message || 'Error al conectar con la WebApp.');
    } finally {
      setSavingWork(false);
    }
  };

  // Save new manual movement in contabilidad
  const handleSaveNuevoMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaFecha || !nuevoConcepto || !nuevoMonto) {
      onShowToast('warning', 'Campos requeridos', 'Completá fecha, concepto y monto.');
      return;
    }

    setGuardandoMovimiento(true);
    try {
      const movimientoItem: MovimientoContable = {
        id: 'MOV-' + Date.now(),
        fecha: nuevaFecha,
        tipo: nuevoTipo,
        concepto: nuevoConcepto.trim(),
        categoria: nuevaCategoria,
        monto: Math.abs(Number(nuevoMonto)),
        metodoPago: nuevoMetodoPago,
        referencia: nuevaReferencia.trim().toUpperCase(),
      };

      await gasApi.addAccountingMovement(movimientoItem);
      onShowToast(
        'success',
        nuevoTipo === 'ingreso' ? '¡Ingreso registrado!' : '¡Gasto registrado!',
        `Se agregó "${nuevoConcepto}" por $${Number(nuevoMonto).toLocaleString('es-AR')}`
      );

      // Reset modal form
      setShowModalMovimiento(false);
      setNuevoConcepto('');
      setNuevoMonto('');
      setNuevaReferencia('');
      fetchContabilidad();
    } catch (err: any) {
      onShowToast('error', 'Error al registrar', err.message);
    } finally {
      setGuardandoMovimiento(false);
    }
  };

  // Delete movement
  const handleDeleteMovement = async (id: string, concepto: string) => {
    const confirmDelete = window.confirm(`¿Estás seguro de eliminar el movimiento "${concepto}"?`);
    if (!confirmDelete) return;

    try {
      await gasApi.deleteAccountingMovement(id);
      onShowToast('info', 'Movimiento eliminado', concepto);
      setMovimientos((prev) => prev.filter((m) => m.id !== id));
    } catch (e: any) {
      onShowToast('error', 'Error al borrar', e.message);
    }
  };

  // Copy full Google Apps Script
  const fullAppsScriptCode = `// =========================================================================
// LA CASA DE LA DIRECCIÓN - GOOGLE APPS SCRIPT COMPLETO CON CONTABILIDAD
// =========================================================================
const MERCADOPAGO_ACCESS_TOKEN = "APP_USR-4589130827999167-092812-304c27d1e426c89f133eaac26d1354ed-13866330"; 
const MONTO_SEÑA = 10000; 

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetUsuarios = ss.getSheets()[0]; 
    var sheetTurnos = ss.getSheetByName("Turnos");
    var sheetContabilidad = ss.getSheetByName("Contabilidad") || ss.insertSheet("Contabilidad");
    var datos = JSON.parse(e.postData.contents);
    
    // --- ACCIÓN 1: REGISTRO DE USUARIOS ---
    if (datos.accion === "registrar") {
      var nuevaFila = [datos.nombre, datos.telefono, datos.email, datos.password, new Date()];
      sheetUsuarios.appendRow(nuevaFila);
      return ContentService.createTextOutput(JSON.stringify({"resultado": "ok"})).setMimeType(ContentService.MimeType.JSON);
    }
    
    // --- ACCIÓN 2: INICIAR SESIÓN Y BUSCAR HISTORIAL ---
    if (datos.accion === "login") {
      var rowsUsuarios = sheetUsuarios.getDataRange().getValues();
      var usuarioEncontrado = null;
      for (var i = 1; i < rowsUsuarios.length; i++) {
        if (rowsUsuarios[i][2].toString().toLowerCase() === datos.email.toLowerCase() && rowsUsuarios[i][3].toString() === datos.password) {
          usuarioEncontrado = { "nombre": rowsUsuarios[i][0], "telefono": rowsUsuarios[i][1], "email": rowsUsuarios[i][2] };
          break;
        }
      }
      if (!usuarioEncontrado) {
        return ContentService.createTextOutput(JSON.stringify({"resultado": "error", "mensaje": "Usuario o contraseña incorrectos"})).setMimeType(ContentService.MimeType.JSON);
      }
      var listaTurnos = [];
      if (sheetTurnos) {
        var rowsTurnos = sheetTurnos.getDataRange().getValues();
        for (var j = 1; j < rowsTurnos.length; j++) {
          if (rowsTurnos[j][0].toString().toLowerCase() === datos.email.toLowerCase()) {
            listaTurnos.push({
              "fecha": rowsTurnos[j][1],
              "horario": rowsTurnos[j][2],
              "patente": rowsTurnos[j][3],
              "estado": rowsTurnos[j][4] ? rowsTurnos[j][4].toString() : "Programado"
            });
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        "resultado": "ok", "nombre": usuarioEncontrado.nombre, "telefono": usuarioEncontrado.telefono, "email": usuarioEncontrado.email, "turnos": listaTurnos
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 3: OBTENER TURNOS OCUPADOS ---
    if (datos.accion === "obtenerOcupados") {
      var ocupados = [];
      if (sheetTurnos) {
        var rowsTurnos = sheetTurnos.getDataRange().getValues();
        for (var k = 1; k < rowsTurnos.length; k++) {
          var fechaFila = String(rowsTurnos[k][1]).includes('T') ? String(rowsTurnos[k][1]).split('T')[0] : String(rowsTurnos[k][1]);
          if (fechaFila === datos.fecha && String(rowsTurnos[k][4]).toLowerCase() !== "cancelado") {
            var horaFila = String(rowsTurnos[k][2]).includes('T') ? String(rowsTurnos[k][2]).split('T')[1].substring(0,5) : String(rowsTurnos[k][2]);
            ocupados.push(horaFila);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({"resultado": "ok", "ocupados": ocupados})).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 4: RESERVAR UN TURNO (MERCADO PAGO) ---
    if (datos.accion === "reservarTurno") {
      if (!sheetTurnos) {
        return ContentService.createTextOutput(JSON.stringify({"resultado": "error", "mensaje": "No se encontró la pestaña Turnos"})).setMimeType(ContentService.MimeType.JSON);
      }
      let urlScript = ScriptApp.getService().getUrl();
      let urlMercadoPago = "https://api.mercadopago.com/checkout/preferences";
      let payload = {
        items: [{ title: "Seña de Turno - La Casa de la Dirección", quantity: 1, currency_id: "ARS", unit_price: MONTO_SEÑA }],
        back_urls: {
          success: urlScript + "?status=approved&email=" + encodeURIComponent(datos.email) + "&fecha=" + datos.fecha + "&horario=" + datos.horario + "&patente=" + encodeURIComponent(datos.patente),
          failure: urlScript + "?status=failed",
          pending: urlScript + "?status=pending"
        },
        auto_return: "approved"
      };
      let opciones = {
        method: "post",
        contentType: "application/json",
        headers: { "Authorization": "Bearer " + MERCADOPAGO_ACCESS_TOKEN.trim(), "Accept": "application/json" },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };
      let respuesta = UrlFetchApp.fetch(urlMercadoPago, opciones);
      let jsonRes = JSON.parse(respuesta.getContentText());
      if (jsonRes.init_point) {
        return ContentService.createTextOutput(JSON.stringify({ resultado: "mercadopago", urlPago: jsonRes.init_point })).setMimeType(ContentService.MimeType.JSON);
      } else {
        let msgError = jsonRes.message || "Credenciales inválidas.";
        return ContentService.createTextOutput(JSON.stringify({ resultado: "error", mensaje: "Mercado Pago rechazó la orden: " + msgError })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // --- ACCIÓN 5: LISTAR TURNOS (ADMIN) ---
    if (datos.accion === "obtenerTurnosAdmin") {
      var resAdmin = obtenerTurnosAdmin();
      return ContentService.createTextOutput(JSON.stringify(resAdmin)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 6: ARCHIVAR TRABAJO (ADMIN) ---
    if (datos.accion === "guardarTrabajoAdmin") {
      var resTrabajo = registrarTrabajoAdmin(datos.datosTrabajo);
      ejecutarLimpiezaYOrdenamientoCompleto(); 
      return ContentService.createTextOutput(JSON.stringify(resTrabajo)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 7: VER HISTORIAL DE SERVICIOS (CLIENTE) ---
    if (datos.accion === "obtenerHistorialCliente") {
      var resHistorial = obtenerHistorialCliente(datos.emailCliente);
      return ContentService.createTextOutput(JSON.stringify(resHistorial)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 8: REGISTRAR MOVIMIENTO EN HOJA CONTABILIDAD ---
    if (datos.accion === "registrarMovimientoContable") {
      var resMov = registrarMovimientoContabilidad(datos.movimiento);
      return ContentService.createTextOutput(JSON.stringify(resMov)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 9: OBTENER MOVIMIENTOS DE CONTABILIDAD ---
    if (datos.accion === "obtenerMovimientosContables") {
      var resMovs = obtenerMovimientosContabilidad();
      return ContentService.createTextOutput(JSON.stringify(resMovs)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 10: ELIMINAR MOVIMIENTO DE CONTABILIDAD ---
    if (datos.accion === "eliminarMovimientoContable") {
      var resDel = eliminarMovimientoContabilidad(datos.id);
      return ContentService.createTextOutput(JSON.stringify(resDel)).setMimeType(ContentService.MimeType.JSON);
    }
                           
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({"resultado": "error", "mensaje": error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

// --- FUNCIONES CONTABILIDAD PARA LA NUEVA HOJA ---
function registrarMovimientoContabilidad(m) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Contabilidad") || ss.insertSheet("Contabilidad");
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["ID", "Fecha", "Tipo", "Concepto", "Categoria", "Monto", "MetodoPago", "Referencia"]);
  }
  
  var id = m.id || "MOV-" + new Date().getTime();
  sheet.appendRow([id, "'" + m.fecha, m.tipo, m.concepto, m.categoria, Number(m.monto), m.metodoPago, m.referencia || ""]);
  return { success: true, id: id };
}

function obtenerMovimientosContabilidad() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Contabilidad");
  if (!sheet) return { success: true, movimientos: [] };
  
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, movimientos: [] };
  
  var lista = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row[0] || row[3]) {
      lista.push({
        id: String(row[0] || i),
        fecha: String(row[1]).replace("'", ""),
        tipo: String(row[2]).toLowerCase(),
        concepto: String(row[3]),
        categoria: String(row[4] || "General"),
        monto: Number(row[5]) || 0,
        metodoPago: String(row[6] || "Efectivo"),
        referencia: String(row[7] || "")
      });
    }
  }
  lista.reverse(); // Más recientes primero
  return { success: true, movimientos: lista };
}

function eliminarMovimientoContabilidad(id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Contabilidad");
  if (!sheet) return { success: false, error: "Hoja no encontrada" };
  
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: true };
}

// --- CONFIRMACIÓN Y ESCRITURA EN EL EXCEL ---
function doGet(e) {
  let params = e.parameter;
  
  if (params.status === "approved") {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetTurnos = ss.getSheetByName("Turnos");
    
    if (sheetTurnos) {
      var fechaFormateada = "'" + params.fecha;
      var horarioFormateado = "'" + params.horario;
      sheetTurnos.appendRow([params.email, fechaFormateada, horarioFormateado, params.patente, "Programado"]);
      ejecutarLimpiezaYOrdenamientoCompleto();
    }
    
    // Auto-registrar la seña de $10.000 en Contabilidad como Ingreso
    try {
      registrarMovimientoContabilidad({
        id: "SEÑA-" + new Date().getTime(),
        fecha: params.fecha,
        tipo: "ingreso",
        concepto: "Seña Reserva de Turno Online (" + params.patente + ")",
        categoria: "Seña Mercado Pago",
        monto: MONTO_SEÑA,
        metodoPago: "Mercado Pago",
        referencia: params.patente
      });
    } catch(err) {}

    let htmlExito = "<html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'><title>Seña Confirmada</title><style>body{background:#000;color:#fff;font-family:sans-serif;text-align:center;padding:10px;} .card{border:2px solid #e31212;padding:35px 20px;max-width:420px;margin:40px auto;background:#0d0d0d;border-radius:8px;box-shadow:0 4px 15px rgba(227,18,18,0.2);} h1{color:#e31212;margin-top:0;font-size:24px;} .dato{background:#151515;padding:10px;margin:8px 0;border-radius:4px;text-align:left;border:1px solid #222;} .btn{display:inline-block;padding:12px 30px;background:#e31212;color:#fff;text-decoration:none;font-weight:bold;border-radius:4px;margin-top:20px;text-transform:uppercase;font-size:14px;}</style></head><body><div class='card'><h1>¡Seña de Turno Recibida!</h1><p style='color:#aaa;'>Tu pago fue aprobado. Agendamos tu vehículo en el taller con éxito.</p><div class='dato'>🚗 <strong>Patente:</strong> " + params.patente + "</div><div class='dato'>📅 <strong>Día:</strong> " + params.fecha + "</div><div class='dato'>⏰ <strong>Horario:</strong> " + params.horario + " hs</div><a href='#' onclick='window.close();' class='btn'>Finalizar y cerrar</a></div><script>if(window.opener){window.opener.location.reload();}</script></body></html>";
    return HtmlService.createHtmlOutput(htmlExito);
  }
  
  let htmlFallo = "<html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'><title>Pago Cancelado</title></head><body style='background:#000;color:#fff;text-align:center;font-family:sans-serif;padding:10px;'><div style='border:2px solid #555;padding:35px 20px;max-width:420px;margin:40px auto;background:#0d0d0d;border-radius:8px;'><h1 style='color:#ff3333;margin-top:0;'>Pago no Procesado</h1><p style='color:#aaa;'>No se pudo completar el cobro de la seña del turno. La reserva quedó cancelada y el horario sigue disponible.</p><a href='#' onclick='window.close();' style='color:#fff;font-weight:bold;'>Volver a intentar</a></div></body></html>";
  return HtmlService.createHtmlOutput(htmlFallo);
}

// CORRECCIÓN: PASA A ATENDIDO Y ORDENA (PENDIENTES ARRIBA, HISTORIAL ABAJO)
function ejecutarLimpiezaYOrdenamientoCompleto() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetTurnos = ss.getSheetByName("Turnos");
  if (!sheetTurnos) return;
  var lastRow = sheetTurnos.getLastRow();
  if (lastRow <= 1) return;
  
  var range = sheetTurnos.getRange(2, 1, lastRow - 1, 5);
  var data = range.getValues();
  var hoy = new Date(); hoy.setHours(0,0,0,0);
  
  for (var i = 0; i < data.length; i++) {
    if (data[i][1] && data[i][4].toString().toLowerCase() === "programado") {
      var fTurno = new Date(data[i][1].toString().replace("'", "") + "T00:00:00");
      if (fTurno < hoy) data[i][4] = "Atendido";
    }
  }
  
  var futuros = data.filter(function(r) { return r[4].toString().toLowerCase() === "programado"; });
  var pasados = data.filter(function(r) { return r[4].toString().toLowerCase() !== "programado"; });
  
  futuros.sort(function(a,b) { return new Date(a[1].toString().replace("'","")+"T"+a[2].toString().replace("'","")) - new Date(b[1].toString().replace("'","")+"T"+b[2].toString().replace("'","")); });
  pasados.sort(function(a,b) { return new Date(b[1].toString().replace("'","")+"T"+b[2].toString().replace("'","")) - new Date(a[1].toString().replace("'","")+"T"+a[2].toString().replace("'","")); });
  
  range.setValues(futuros.concat(pasados));
}

function obtenerTurnosAdmin() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Turnos");
  if (!sheet) return { success: true, turnos: [] };
  var datos = sheet.getDataRange().getValues();
  var pendientes = [];
  for (var i = 1; i < datos.length; i++) {
    var estadoCelda = datos[i][4] ? datos[i][4].toString().toLowerCase().trim() : "";
    if (estadoCelda === "programado") {
      pendientes.push({ 
        email: datos[i][0], 
        fecha: datos[i][1], 
        horario: datos[i][2], 
        patente: datos[i][3] 
      });
    }
  }
  return { success: true, turnos: pendientes };
}

function registrarTrabajoAdmin(datosTrabajo) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetTurnos = ss.getSheetByName("Turnos");
  var sheetDetalles = ss.getSheetByName("Detalles_Turnos") || ss.insertSheet("Detalles_Turnos");
  
  if (sheetDetalles.getLastRow() === 0) {
    sheetDetalles.appendRow(["Email", "Fecha", "Horario", "Patente", "Kilometraje", "Trabajo Realizado", "Monto Final"]);
  }
  
  sheetDetalles.appendRow([datosTrabajo.email, datosTrabajo.fecha, datosTrabajo.horario, datosTrabajo.patente, datosTrabajo.kilometraje, datosTrabajo.trabajoRealizado, datosTrabajo.montoFinal]);
  
  if (sheetTurnos) {
    var datosTurnos = sheetTurnos.getDataRange().getValues();
    for (var i = 1; i < datosTurnos.length; i++) {
      if (String(datosTurnos[i][3]).toLowerCase().trim() === datosTrabajo.patente.toLowerCase().trim()) {
        sheetTurnos.getRange(i + 1, 5).setValue("Atendido");
        break;
      }
    }
  }
  return { success: true };
}

function obtenerHistorialCliente(emailCliente) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetDetalles = ss.getSheetByName("Detalles_Turnos");
  if (!sheetDetalles) return { success: true, historial: [] };
  
  var datos = sheetDetalles.getDataRange().getValues();
  var historialUsuario = [];
  
  for (var i = 1; i < datos.length; i++) {
    if (datos[i][0].toString().toLowerCase().trim() === emailCliente.toLowerCase().trim()) {
      historialUsuario.push({
        fecha: datos[i][1].toString().replace("'", ""),
        horario: datos[i][2].toString(),
        patente: datos[i][3].toString().toUpperCase(),
        kilometraje: datos[i][4].toString(),
        trabajo: datos[i][5].toString(),
        monto: datos[i][6].toString()
      });
    }
  }
  historialUsuario.reverse();
  return { success: true, historial: historialUsuario };
}

function doOptions(e) {
  return ContentService.createTextOutput("")
                       .setHeaders({
                         'Access-Control-Allow-Origin': '*',
                         'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                         'Access-Control-Allow-Headers': 'Content-Type'
                       });
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullAppsScriptCode);
    setCopiedScript(true);
    onShowToast('success', '¡Código copiado al portapapeles!', 'Ya podés pegarlo en Extensiones > Apps Script.');
    setTimeout(() => setCopiedScript(false), 3000);
  };

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 bg-[#050505]">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-5">
          <button
            onClick={onBackToHome}
            className="inline-flex items-center gap-2 text-xs font-heading font-bold uppercase tracking-wider text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a la Web</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                fetchTurnos();
                fetchContabilidad();
                onShowToast('info', 'Sincronizado', 'Planillas actualizadas.');
              }}
              disabled={loadingTurnos || loadingContabilidad}
              className="flex items-center gap-2 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 font-heading font-bold text-xs uppercase tracking-wider rounded transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTurnos || loadingContabilidad ? 'animate-spin' : ''}`} />
              <span>Sincronizar Sheets</span>
            </button>
          </div>
        </div>

        {/* Header banner */}
        <div className="p-6 rounded-xl bg-neutral-900 border-2 border-red-600 shadow-2xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-red-950 border border-red-800/80 flex items-center justify-center text-red-500 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] font-heading font-black text-red-500 uppercase tracking-widest">
                Administración General · La Casa de la Dirección
              </div>
              <h1 className="text-xl sm:text-2xl font-heading font-black text-white uppercase tracking-tight">
                Panel de Control & Contabilidad
              </h1>
              <p className="text-xs text-neutral-400">
                Turnos, reparaciones y gestión de caja vinculada con tu Google Sheets.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                startTransition(() => {
                  setNuevoTipo('ingreso');
                  setShowModalMovimiento(true);
                });
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-heading font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-950"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Registrar Ingreso</span>
            </button>
            <button
              onClick={() => {
                startTransition(() => {
                  setNuevoTipo('gasto');
                  setShowModalMovimiento(true);
                });
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-neutral-950 hover:bg-red-950 text-red-400 border border-red-800/60 font-heading font-bold text-xs uppercase tracking-wider transition-all"
            >
              <MinusCircle className="w-4 h-4" />
              <span>- Registrar Gasto</span>
            </button>
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800">
          <button
            onClick={() => setActiveAdminTab('turnos')}
            className={`flex items-center gap-2 px-5 py-3 font-heading font-black text-sm uppercase tracking-wider border-b-2 transition-all ${
              activeAdminTab === 'turnos'
                ? 'border-red-600 text-red-500'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>Turnos Pendientes ({turnos.length})</span>
          </button>

          <button
            onClick={() => setActiveAdminTab('contabilidad')}
            className={`flex items-center gap-2 px-5 py-3 font-heading font-black text-sm uppercase tracking-wider border-b-2 transition-all ${
              activeAdminTab === 'contabilidad'
                ? 'border-red-600 text-red-500'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Caja & Contabilidad del Taller</span>
          </button>

          <button
            onClick={() => setActiveAdminTab('script')}
            className={`flex items-center gap-2 px-5 py-3 font-heading font-black text-sm uppercase tracking-wider border-b-2 transition-all ${
              activeAdminTab === 'script'
                ? 'border-red-600 text-red-500'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Código Google Apps Script</span>
          </button>
        </div>

        {/* TAB 1: TURNOS PENDIENTES */}
        {activeAdminTab === 'turnos' && (
          <div className="space-y-6">
            {/* Live Filter Search Input */}
            <div className="relative">
              <label htmlFor={searchInputId} className="sr-only">
                Buscar por patente o correo electrónico
              </label>
              <Search className="w-4 h-4 text-neutral-500 absolute left-4 top-3.5" />
              <input
                id={searchInputId}
                type="text"
                placeholder="BUSCAR EN TIEMPO REAL POR PATENTE O EMAIL..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-xl pl-11 pr-4 py-3 text-sm font-heading font-bold text-white placeholder-neutral-600 uppercase tracking-wider transition-colors shadow-inner"
              />
            </div>

            {/* Turnos List */}
            <div>
              {loadingTurnos ? (
                <div className="p-16 text-center text-neutral-400 text-xs">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-red-500" />
                  <span className="font-heading uppercase tracking-wider">Conectando con Google Sheets...</span>
                </div>
              ) : turnos.length === 0 ? (
                <div className="p-12 rounded-xl bg-neutral-900/40 border border-neutral-800 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <h3 className="font-heading font-bold text-white text-base uppercase">
                    🎉 ¡Excelente Rodrigo! No quedan turnos pendientes
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Todos los vehículos registrados han sido atendidos o aún no hay nuevas reservas con seña abonada.
                  </p>
                </div>
              ) : filteredTurnos.length === 0 ? (
                <div className="p-8 rounded-xl bg-neutral-900/40 border border-neutral-800 text-center text-neutral-400 text-xs">
                  No se encontraron vehículos que coincidan con &ldquo;{searchTerm}&rdquo;.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredTurnos.map((turno, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedTurno(turno);
                        setKilometraje('');
                        setSelectedServicios([]);
                        setNotasTrabajoAdicional('');
                        setMontoCobrado('');
                        setAutoRegistrarContabilidad(true);
                      }}
                      className="group p-5 rounded-xl bg-[#0a0a0a] border border-neutral-800 border-l-4 border-l-red-600 hover:border-red-600 hover:bg-neutral-900/90 transition-all cursor-pointer shadow-lg flex flex-col justify-between gap-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Car className="w-4 h-4 text-red-500" />
                            <span className="font-mono text-lg font-black text-white uppercase tracking-wider group-hover:text-red-400 transition-colors">
                              {turno.patente}
                            </span>
                          </div>
                          <div className="mt-2 text-xs text-neutral-400 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                              <span>{String(turno.fecha).replace("'", '')}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-neutral-500" />
                              <span className="text-white font-semibold">
                                {String(turno.horario).replace("'", '')} hs
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-neutral-500" />
                              <span className="truncate max-w-[200px]">{turno.email}</span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="inline-block px-2.5 py-1 rounded bg-neutral-900 text-red-400 border border-neutral-700 text-[10px] font-heading font-black uppercase tracking-wider group-hover:bg-red-600 group-hover:text-white transition-colors">
                            Cargar Trabajo →
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: CONTABILIDAD Y CAJA */}
        {activeAdminTab === 'contabilidad' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Ingresos */}
              <div className="p-5 rounded-xl bg-neutral-900/90 border border-neutral-800 border-t-4 border-t-emerald-500 shadow-xl">
                <div className="flex items-center justify-between text-xs text-neutral-400 font-heading font-bold uppercase tracking-wider">
                  <span>Ingresos Totales</span>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="mt-3 font-mono text-2xl font-black text-emerald-400 tabular-nums">
                  ${totalIngresos.toLocaleString('es-AR')}
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">Cobros de taller y señas</p>
              </div>

              {/* Gastos */}
              <div className="p-5 rounded-xl bg-neutral-900/90 border border-neutral-800 border-t-4 border-t-red-500 shadow-xl">
                <div className="flex items-center justify-between text-xs text-neutral-400 font-heading font-bold uppercase tracking-wider">
                  <span>Gastos Totales</span>
                  <TrendingDown className="w-4 h-4 text-red-400" />
                </div>
                <div className="mt-3 font-mono text-2xl font-black text-red-400 tabular-nums">
                  ${totalGastos.toLocaleString('es-AR')}
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">Repuestos, insumos y fijos</p>
              </div>

              {/* Balance Neto */}
              <div className="p-5 rounded-xl bg-neutral-900/90 border border-neutral-800 border-t-4 border-t-blue-500 shadow-xl">
                <div className="flex items-center justify-between text-xs text-neutral-400 font-heading font-bold uppercase tracking-wider">
                  <span>Balance Neto en Caja</span>
                  <DollarSign className="w-4 h-4 text-blue-400" />
                </div>
                <div
                  className={`mt-3 font-mono text-2xl font-black tabular-nums ${
                    balanceNeto >= 0 ? 'text-white' : 'text-rose-500'
                  }`}
                >
                  ${balanceNeto.toLocaleString('es-AR')}
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">Margen real de ganancia</p>
              </div>

              {/* Total Movimientos */}
              <div className="p-5 rounded-xl bg-neutral-900/90 border border-neutral-800 border-t-4 border-t-neutral-600 shadow-xl">
                <div className="flex items-center justify-between text-xs text-neutral-400 font-heading font-bold uppercase tracking-wider">
                  <span>Movimientos</span>
                  <Receipt className="w-4 h-4 text-neutral-400" />
                </div>
                <div className="mt-3 font-mono text-2xl font-black text-white tabular-nums">
                  {filteredMovimientos.length}
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">Operaciones en el período</p>
              </div>
            </div>

            {/* Filter controls */}
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-wrap items-center justify-between gap-4">
              {/* Period tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-neutral-900 rounded-lg text-xs font-heading font-bold uppercase">
                <button
                  onClick={() => setFiltroPeriodo('hoy')}
                  className={`px-3 py-1.5 rounded transition-colors ${
                    filtroPeriodo === 'hoy' ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Hoy
                </button>
                <button
                  onClick={() => setFiltroPeriodo('semana')}
                  className={`px-3 py-1.5 rounded transition-colors ${
                    filtroPeriodo === 'semana' ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Esta Semana
                </button>
                <button
                  onClick={() => setFiltroPeriodo('mes')}
                  className={`px-3 py-1.5 rounded transition-colors ${
                    filtroPeriodo === 'mes' ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Este Mes
                </button>
                <button
                  onClick={() => setFiltroPeriodo('todos')}
                  className={`px-3 py-1.5 rounded transition-colors ${
                    filtroPeriodo === 'todos' ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Histórico Todo
                </button>
              </div>

              {/* Type selector */}
              <div className="flex items-center gap-1.5 p-1 bg-neutral-900 rounded-lg text-xs font-heading font-bold uppercase">
                <button
                  onClick={() => setFiltroTipo('todos')}
                  className={`px-3 py-1.5 rounded transition-colors ${
                    filtroTipo === 'todos' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFiltroTipo('ingreso')}
                  className={`px-3 py-1.5 rounded transition-colors ${
                    filtroTipo === 'ingreso' ? 'bg-emerald-600 text-white' : 'text-neutral-400 hover:text-emerald-400'
                  }`}
                >
                  Ingresos
                </button>
                <button
                  onClick={() => setFiltroTipo('gasto')}
                  className={`px-3 py-1.5 rounded transition-colors ${
                    filtroTipo === 'gasto' ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-red-400'
                  }`}
                >
                  Gastos
                </button>
              </div>

              {/* Search in contabilidad */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-3" />
                <input
                  id={busquedaContableId}
                  type="text"
                  placeholder="Filtrar por concepto o patente..."
                  value={filtroBusquedaContable}
                  onChange={(e) => setFiltroBusquedaContable(e.target.value)}
                  className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-neutral-500"
                />
              </div>
            </div>

            {/* Movements Table / Cards */}
            <div>
              {loadingContabilidad ? (
                <div className="p-16 text-center text-neutral-400 text-xs">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-red-500" />
                  <span className="font-heading uppercase tracking-wider">Cargando registros contables...</span>
                </div>
              ) : filteredMovimientos.length === 0 ? (
                <div className="p-12 rounded-xl bg-neutral-900/40 border border-neutral-800 text-center">
                  <Receipt className="w-10 h-10 text-neutral-500 mx-auto mb-2" />
                  <h3 className="font-heading font-bold text-white text-base uppercase">
                    Sin movimientos registrados en este filtro
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Hacé clic en &ldquo;+ Registrar Ingreso&rdquo; o &ldquo;- Registrar Gasto&rdquo; para asentar un movimiento en la hoja de Google Sheets.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-neutral-800 bg-[#0a0a0a] overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-neutral-800 bg-neutral-950 font-heading font-bold uppercase tracking-wider text-neutral-400">
                          <th className="py-3 px-4">Fecha</th>
                          <th className="py-3 px-4">Tipo</th>
                          <th className="py-3 px-4">Concepto / Detalle</th>
                          <th className="py-3 px-4">Categoría</th>
                          <th className="py-3 px-4">Ref. / Patente</th>
                          <th className="py-3 px-4">Método</th>
                          <th className="py-3 px-4 text-right">Monto ($ ARS)</th>
                          <th className="py-3 px-3 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900">
                        {filteredMovimientos.map((m) => {
                          const isIngreso = m.tipo === 'ingreso';
                          return (
                            <tr key={m.id} className="hover:bg-neutral-900/60 transition-colors">
                              <td className="py-3 px-4 font-mono text-neutral-300 whitespace-nowrap">
                                {m.fecha}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1 font-heading font-black text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                                    isIngreso
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                                      : 'bg-red-950 text-red-400 border border-red-800/60'
                                  }`}
                                >
                                  {isIngreso ? '▲ Ingreso' : '▼ Gasto'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-white font-medium max-w-xs break-words">
                                {m.concepto}
                              </td>
                              <td className="py-3 px-4 text-neutral-400 whitespace-nowrap">
                                {m.categoria}
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-neutral-300 uppercase whitespace-nowrap">
                                {m.referencia || '—'}
                              </td>
                              <td className="py-3 px-4 text-neutral-400 whitespace-nowrap">
                                {m.metodoPago}
                              </td>
                              <td
                                className={`py-3 px-4 text-right font-mono font-bold text-sm tabular-nums whitespace-nowrap ${
                                  isIngreso ? 'text-emerald-400' : 'text-red-400'
                                }`}
                              >
                                {isIngreso ? '+' : '-'}${Number(m.monto).toLocaleString('es-AR')}
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <button
                                  onClick={() => handleDeleteMovement(m.id, m.concepto)}
                                  className="text-neutral-500 hover:text-red-400 p-1 rounded hover:bg-neutral-800 transition-colors"
                                  title="Eliminar este movimiento"
                                  aria-label="Eliminar movimiento"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SCRIPT DE GOOGLE SHEETS */}
        {activeAdminTab === 'script' && (
          <div className="space-y-6">
            <div className="p-6 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-heading font-black text-lg text-white uppercase tracking-wide">
                    Código de tu Google Apps Script con la Hoja &ldquo;Contabilidad&rdquo;
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Copiá este código y reemplazalo en tu archivo <strong>Code.gs</strong> de tu planilla de Google Sheets. El sistema creará automáticamente la pestaña <strong>Contabilidad</strong>.
                  </p>
                </div>

                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 px-5 py-2.5 rounded bg-red-600 hover:bg-red-700 active:scale-95 text-white font-heading font-black text-xs uppercase tracking-wider shadow-lg shadow-red-600/30 transition-all"
                >
                  {copiedScript ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedScript ? '¡Copiado!' : 'Copiar Código Completo'}</span>
                </button>
              </div>

              <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-300 space-y-2">
                <p className="font-heading font-bold uppercase text-white">Pasos para actualizar en Google Sheets:</p>
                <ol className="list-decimal pl-5 space-y-1 text-neutral-400">
                  <li>Abrí tu planilla <strong>&ldquo;Base de Datos Taller&rdquo;</strong> en Google Sheets.</li>
                  <li>Andá al menú superior <strong>Extensiones &gt; Apps Script</strong>.</li>
                  <li>Borrá todo el contenido de <code>Code.gs</code> y pegá este nuevo código.</li>
                  <li>Hacé clic en <strong>Guardar (icono de disco)</strong>.</li>
                  <li>
                    Hacé clic en <strong>Implementar &gt; Administrar implementaciones &gt; Editar (icono de lápiz)</strong> y en Versión seleccioná <strong>&ldquo;Nueva versión&rdquo;</strong>, luego <strong>Implementar</strong>.
                  </li>
                </ol>
              </div>

              <div className="relative rounded-lg overflow-hidden border border-neutral-800 bg-[#000] p-4">
                <pre className="text-[11px] font-mono text-neutral-300 overflow-x-auto max-h-[400px] leading-relaxed">
                  {fullAppsScriptCode}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: REGISTRAR REPARACIÓN DE UN TURNO */}
        {selectedTurno && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-[#0a0a0a] border-2 border-red-600 rounded-xl shadow-2xl p-6 sm:p-8">
              <button
                onClick={() => setSelectedTurno(null)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-900 transition-colors"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 text-red-500 mb-1">
                <Wrench className="w-5 h-5" />
                <span className="font-heading font-black text-xs uppercase tracking-widest">
                  Ficha Técnica de Reparación
                </span>
              </div>

              <h2 className="font-heading font-black text-xl text-white uppercase tracking-tight">
                Registrar Trabajo en Vehículo
              </h2>

              <div className="mt-3 p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-xs space-y-1">
                <div>
                  <span className="text-neutral-400">Patente: </span>
                  <strong className="text-white font-mono uppercase">{selectedTurno.patente}</strong>
                </div>
                <div>
                  <span className="text-neutral-400">Fecha/Hora: </span>
                  <span className="text-white">
                    {String(selectedTurno.fecha).replace("'", '')} — {selectedTurno.horario} hs
                  </span>
                </div>
                <div>
                  <span className="text-neutral-400">Cliente: </span>
                  <span className="text-white">{selectedTurno.email}</span>
                </div>
              </div>

              <form onSubmit={handleSaveWork} className="mt-5 space-y-4">
                <div>
                  <label htmlFor={kmInputId} className="block text-xs font-heading font-bold uppercase tracking-wider text-neutral-300 mb-1">
                    1. Kilometraje Actual
                  </label>
                  <input
                    id={kmInputId}
                    type="number"
                    required
                    placeholder="Ej: 145000"
                    value={kilometraje}
                    onChange={(e) => setKilometraje(e.target.value)}
                    className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-sm text-white font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-heading font-bold uppercase tracking-wider text-neutral-300">
                      2. Trabajos Realizados (Seleccioná uno o más)
                    </label>
                    <span className="text-[11px] font-mono font-bold text-red-400">
                      {selectedServicios.length} seleccionado{selectedServicios.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Multi-select items grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 bg-[#050505] rounded-lg border border-neutral-800">
                    {WORKSHOP_ITEMS.map((item) => {
                      const isSelected = selectedServicios.includes(item);
                      return (
                        <button
                          type="button"
                          key={item}
                          onClick={() => toggleServicio(item)}
                          className={`flex items-center gap-2 p-2 rounded text-left transition-all text-xs font-heading uppercase ${
                            isSelected
                              ? 'bg-red-600/25 border border-red-500 text-white font-bold'
                              : 'bg-neutral-900/60 border border-neutral-800/80 text-neutral-400 hover:text-white hover:border-neutral-700'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                              isSelected ? 'bg-red-600 border-red-500 text-white' : 'border-neutral-700 bg-neutral-950'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="truncate leading-tight text-[11px]">{item}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected summary */}
                  {selectedServicios.length > 0 && (
                    <div className="mt-2 p-2 rounded bg-red-950/30 border border-red-900/50 text-xs">
                      <span className="text-[10px] uppercase font-bold text-red-400 block mb-0.5">
                        Resumen seleccionado para la planilla:
                      </span>
                      <span className="font-semibold text-white break-words">
                        {selectedServicios.join(' + ')}
                      </span>
                    </div>
                  )}

                  {/* Optional notes */}
                  <div className="mt-2.5">
                    <label className="block text-[11px] font-heading font-medium text-neutral-400 uppercase mb-1">
                      Detalle adicional (opcional, ej: lado derecho, marca)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Delantero derecho, marca Corven..."
                      value={notasTrabajoAdicional}
                      onChange={(e) => setNotasTrabajoAdicional(e.target.value)}
                      className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none text-xs text-white rounded px-3 py-1.5"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor={montoInputId} className="block text-xs font-heading font-bold uppercase tracking-wider text-neutral-300 mb-1">
                    3. Monto Cobrado ($ ARS)
                  </label>
                  <input
                    id={montoInputId}
                    type="number"
                    required
                    placeholder="Ej: 45000"
                    value={montoCobrado}
                    onChange={(e) => setMontoCobrado(e.target.value)}
                    className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-sm text-white font-mono"
                  />
                </div>

                {/* Auto-accounting integration */}
                <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 space-y-2.5">
                  <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={autoRegistrarContabilidad}
                      onChange={(e) => setAutoRegistrarContabilidad(e.target.checked)}
                      className="rounded text-red-600 focus:ring-0 bg-neutral-900 border-neutral-700"
                    />
                    <span>Sumar automáticamente a Contabilidad como Ingreso</span>
                  </label>

                  {autoRegistrarContabilidad && (
                    <div>
                      <label htmlFor={metodoPagoRepId} className="block text-[11px] font-heading font-bold text-neutral-400 uppercase mb-1">
                        Método de Cobro
                      </label>
                      <select
                        id={metodoPagoRepId}
                        value={metodoPagoReparacion}
                        onChange={(e) => setMetodoPagoReparacion(e.target.value)}
                        className="w-full bg-[#111] border border-neutral-800 text-xs text-white rounded px-2.5 py-1.5"
                      >
                        <option value="Efectivo">Efectivo</option>
                        <option value="Mercado Pago / Transferencia">Mercado Pago / Transferencia</option>
                        <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                        <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-neutral-900">
                  <button
                    type="button"
                    onClick={() => setSelectedTurno(null)}
                    className="flex-1 py-2.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-heading font-bold text-xs uppercase tracking-wider transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingWork}
                    className="flex-2 py-2.5 rounded bg-red-600 hover:bg-red-700 active:scale-95 text-white font-heading font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all disabled:opacity-50"
                  >
                    {savingWork ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Guardando en Sheets...</span>
                      </>
                    ) : (
                      <>
                        <span>✅ Archivar como Atendido</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: NUEVO INGRESO / GASTO CONTABLE */}
        {showModalMovimiento && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-[#0a0a0a] border-2 border-red-600 rounded-xl shadow-2xl p-6 sm:p-8">
              <button
                onClick={() => setShowModalMovimiento(false)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-900 transition-colors"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 text-red-500 mb-1">
                <Receipt className="w-5 h-5" />
                <span className="font-heading font-black text-xs uppercase tracking-widest">
                  Gestión de Caja Taller
                </span>
              </div>

              <h2 className="font-heading font-black text-xl text-white uppercase tracking-tight">
                {nuevoTipo === 'ingreso' ? 'Registrar Nuevo Ingreso' : 'Registrar Nuevo Gasto'}
              </h2>

              {/* Segmented type control */}
              <div className="grid grid-cols-2 gap-2 mt-4 p-1 rounded-lg bg-neutral-950 border border-neutral-800">
                <button
                  type="button"
                  onClick={() => {
                    setNuevoTipo('ingreso');
                    setNuevaCategoria('Mano de Obra / Taller');
                  }}
                  className={`py-2 text-xs font-heading font-bold uppercase rounded transition-colors ${
                    nuevoTipo === 'ingreso'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  ▲ Ingreso (+)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNuevoTipo('gasto');
                    setNuevaCategoria('Repuestos / Repuesteros');
                  }}
                  className={`py-2 text-xs font-heading font-bold uppercase rounded transition-colors ${
                    nuevoTipo === 'gasto'
                      ? 'bg-red-600 text-white shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  ▼ Gasto (-)
                </button>
              </div>

              <form onSubmit={handleSaveNuevoMovimiento} className="mt-4 space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={fechaMovId} className="block text-xs font-heading font-bold uppercase text-neutral-400 mb-1">
                      Fecha
                    </label>
                    <input
                      id={fechaMovId}
                      type="date"
                      required
                      value={nuevaFecha}
                      onChange={(e) => setNuevaFecha(e.target.value)}
                      className="w-full bg-[#111] border border-neutral-800 text-xs text-white rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label htmlFor={montoMovId} className="block text-xs font-heading font-bold uppercase text-neutral-400 mb-1">
                      Monto ($ ARS)
                    </label>
                    <input
                      id={montoMovId}
                      type="number"
                      required
                      placeholder="Ej: 35000"
                      value={nuevoMonto}
                      onChange={(e) => setNuevoMonto(e.target.value)}
                      className="w-full bg-[#111] border border-neutral-800 text-xs font-mono font-bold text-white rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                {/* Dropdown selector for predefined parts or expenses */}
                <div>
                  <label className="block text-xs font-heading font-bold uppercase text-neutral-400 mb-1">
                    {nuevoTipo === 'gasto'
                      ? 'Elegir Repuesto o Tipo de Gasto (Menú Desplegable)'
                      : 'Elegir Trabajo o Servicio (Menú Desplegable)'}
                  </label>
                  <select
                    value={itemPredefinidoSeleccionado}
                    onChange={(e) => handleItemPredefinidoChange(e.target.value)}
                    className="w-full bg-[#111] border border-neutral-800 text-xs text-white rounded-lg px-2.5 py-2 font-medium focus:border-red-600 focus:outline-none"
                  >
                    <option value="">-- Seleccionar de la lista desplegable --</option>
                    {nuevoTipo === 'gasto' ? (
                      <>
                        <optgroup label="🔧 Repuestos de Taller">
                          {GASTOS_PREDEFINIDOS.filter((g) => !g.includes('Boleta') && !g.includes('Alquiler') && !g.includes('Insumos') && !g.includes('Servicio') && !g.includes('Mantenimiento') && !g.includes('Sueldos') && !g.includes('Otro')).map((rep) => (
                            <option key={rep} value={rep}>
                              {rep}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="🏢 Gastos Operativos y Fijos">
                          {GASTOS_PREDEFINIDOS.filter((g) => g.includes('Boleta') || g.includes('Alquiler') || g.includes('Insumos') || g.includes('Servicio') || g.includes('Mantenimiento') || g.includes('Sueldos') || g.includes('Otro')).map((gasto) => (
                            <option key={gasto} value={gasto}>
                              {gasto}
                            </option>
                          ))}
                        </optgroup>
                      </>
                    ) : (
                      <>
                        <optgroup label="🔧 Trabajos de Taller">
                          {WORKSHOP_ITEMS.map((srv) => (
                            <option key={srv} value={srv}>
                              {srv}
                            </option>
                          ))}
                        </optgroup>
                        <option value="Otro Ingreso (Personalizado)">Otro Ingreso (Personalizado)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor={conceptoMovId} className="block text-xs font-heading font-bold uppercase text-neutral-400 mb-1">
                    Concepto / Detalle en la Planilla
                  </label>
                  <input
                    id={conceptoMovId}
                    type="text"
                    required
                    placeholder={
                      nuevoTipo === 'ingreso'
                        ? 'Ej: Cobro ALINEACIÓN Y BALANCEO'
                        : 'Ej: Compra de EXTREMO DE DIRECCIÓN'
                    }
                    value={nuevoConcepto}
                    onChange={(e) => setNuevoConcepto(e.target.value)}
                    className="w-full bg-[#111] border border-neutral-800 text-xs text-white rounded-lg px-3 py-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={catMovId} className="block text-xs font-heading font-bold uppercase text-neutral-400 mb-1">
                      Categoría
                    </label>
                    <select
                      id={catMovId}
                      value={nuevaCategoria}
                      onChange={(e) => setNuevaCategoria(e.target.value)}
                      className="w-full bg-[#111] border border-neutral-800 text-xs text-white rounded-lg px-2.5 py-2"
                    >
                      {nuevoTipo === 'ingreso' ? (
                        <>
                          <option value="Mano de Obra / Taller">Mano de Obra / Taller</option>
                          <option value="Venta de Repuestos">Venta de Repuestos</option>
                          <option value="Seña Mercado Pago">Seña Mercado Pago</option>
                          <option value="Otro Ingreso">Otro Ingreso</option>
                        </>
                      ) : (
                        <>
                          <option value="Repuestos / Repuesteros">Repuestos / Repuesteros</option>
                          <option value="Insumos de Taller">Insumos de Taller</option>
                          <option value="Alquiler / Servicios / Impuestos">Alquiler / Servicios / Luz</option>
                          <option value="Mantenimiento Máquinas / Rampa">Mantenimiento Rampa / Máquinas</option>
                          <option value="Sueldos / Ayudante">Sueldos / Personal</option>
                          <option value="Otro Gasto">Otro Gasto</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label htmlFor={metodoPagoMovId} className="block text-xs font-heading font-bold uppercase text-neutral-400 mb-1">
                      Método de Pago
                    </label>
                    <select
                      id={metodoPagoMovId}
                      value={nuevoMetodoPago}
                      onChange={(e) => setNuevoMetodoPago(e.target.value)}
                      className="w-full bg-[#111] border border-neutral-800 text-xs text-white rounded-lg px-2.5 py-2"
                    >
                      <option value="Efectivo">Efectivo</option>
                      <option value="Mercado Pago / Transferencia">Mercado Pago / Transferencia</option>
                      <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                      <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                      <option value="Cuenta Corriente / Cheque">Cuenta Corriente / Cheque</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor={refMovId} className="block text-xs font-heading font-bold uppercase text-neutral-400 mb-1">
                    Patente o Referencia (Opcional)
                  </label>
                  <input
                    id={refMovId}
                    type="text"
                    placeholder="Ej: PEU534 o Factura #142"
                    value={nuevaReferencia}
                    onChange={(e) => setNuevaReferencia(e.target.value.toUpperCase())}
                    className="w-full bg-[#111] border border-neutral-800 text-xs font-mono text-white rounded-lg px-3 py-2 uppercase"
                  />
                </div>

                <div className="flex items-center gap-3 pt-3 border-t border-neutral-900">
                  <button
                    type="button"
                    onClick={() => setShowModalMovimiento(false)}
                    className="flex-1 py-2.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-heading font-bold text-xs uppercase tracking-wider transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardandoMovimiento || !nuevoConcepto || !nuevoMonto}
                    className={`flex-2 py-2.5 rounded font-heading font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 text-white ${
                      nuevoTipo === 'ingreso'
                        ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/40'
                        : 'bg-red-600 hover:bg-red-700 shadow-red-900/40'
                    }`}
                  >
                    {guardandoMovimiento ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <span>{nuevoTipo === 'ingreso' ? 'Asentar Ingreso' : 'Asentar Gasto'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
