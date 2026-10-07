import { useState, useEffect, useId } from 'react';
import { ItemStock, RepuestoUsado, CompraRepuesto } from '../types';
import { gasApi } from '../services/gasApi';
import { getFechaHoyArgentina, normalizarFechaArgentina, formatearFechaArgentina } from '../utils/dateFormatter';
import { REPUESTOS_TALLER_PIEZAS } from '../constants/workshopItems';
import { VEHICULOS_POR_MARCA } from '../constants/vehiclesArgentina';
import {
  Package,
  TrendingUp,
  AlertTriangle,
  PlusCircle,
  Search,
  ShoppingCart,
  Edit2,
  Trash2,
  X,
  Loader2,
  Sparkles,
  ArrowRight,
  Layers,
  RotateCw,
  DollarSign,
  Wrench,
  Truck,
  Calendar,
  Car,
  FileText,
  CheckCircle2,
  Filter,
} from 'lucide-react';

interface StockManagerProps {
  stockList: ItemStock[];
  onStockUpdated: (items: ItemStock[]) => void;
  onRegistrarGastoContabilidad?: (concepto: string, monto: number, metodoPago: string) => void;
  onShowToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void;
}

export const StockManager = ({
  stockList,
  onStockUpdated,
  onRegistrarGastoContabilidad,
  onShowToast,
}: StockManagerProps) => {
  // Pestaña activa dentro del módulo de Stock: Módulo 1 (Rotación/Usados) o Módulo 2 (Compras/Inventario)
  const [moduloActivo, setModuloActivo] = useState<'modulo1_usados' | 'modulo2_compras'>('modulo1_usados');

  // Listas locales sincronizadas
  const [repuestosUsados, setRepuestosUsados] = useState<RepuestoUsado[]>([]);
  const [comprasRepuestos, setComprasRepuestos] = useState<CompraRepuesto[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(false);

  // MÓDULO 1: Filtros de repuestos usados
  const [searchUsados, setSearchUsados] = useState('');
  const [filtroOrigenUsados, setFiltroOrigenUsados] = useState<'todos' | 'manual' | 'facturacion'>('todos');

  // MÓDULO 2: Filtros de catálogo de inventario
  const [searchCatalogo, setSearchCatalogo] = useState('');
  const [filtroEstadoStock, setFiltroEstadoStock] = useState<'todos' | 'con_stock' | 'bajo_stock' | 'sin_stock'>('todos');
  const [vistaModulo2, setVistaModulo2] = useState<'inventario' | 'historial_compras'>('inventario');

  // Modals de Módulo 1 (Cargar Repuesto Utilizado)
  const [showModalUsado, setShowModalUsado] = useState(false);
  const [guardandoUsado, setGuardandoUsado] = useState(false);
  const [usadoModo, setUsadoModo] = useState<'catalogo' | 'listas'>('catalogo');
  const [usadoItemId, setUsadoItemId] = useState<string>('');
  const [usadoPieza, setUsadoPieza] = useState<string>(REPUESTOS_TALLER_PIEZAS[0] || 'RÓTULA DE SUSPENSIÓN');
  const [usadoVehiculo, setUsadoVehiculo] = useState<string>('Peugeot 206');
  const [usadoCantidad, setUsadoCantidad] = useState('1');
  const [usadoPatente, setUsadoPatente] = useState('');
  const [usadoCliente, setUsadoCliente] = useState('');
  const [usadoFecha, setUsadoFecha] = useState(getFechaHoyArgentina());
  const [usadoObservaciones, setUsadoObservaciones] = useState('');

  // Modals de Módulo 2 (Registrar Compra de Repuestos)
  const [showModalCompra, setShowModalCompra] = useState(false);
  const [guardandoCompra, setGuardandoCompra] = useState(false);
  const [compraModoPieza, setCompraModoPieza] = useState<'existente' | 'nueva'>('existente');
  const [compraItemId, setCompraItemId] = useState<string>('');
  const [compraPieza, setCompraPieza] = useState<string>(REPUESTOS_TALLER_PIEZAS[0] || 'RÓTULA DE SUSPENSIÓN');
  const [compraVehiculo, setCompraVehiculo] = useState<string>('Peugeot 206');
  const [compraCategoria, setCompraCategoria] = useState('Tren Delantero / Suspensión');
  const [compraCantidad, setCompraCantidad] = useState('10');
  const [compraCostoTotal, setCompraCostoTotal] = useState('');
  const [compraProveedor, setCompraProveedor] = useState('');
  const [compraMetodoPago, setCompraMetodoPago] = useState('Efectivo');
  const [compraFecha, setCompraFecha] = useState(getFechaHoyArgentina());
  const [compraImpactaContabilidad, setCompraImpactaContabilidad] = useState(true);

  // Modal Item Catálogo (Nuevo / Editar pieza física)
  const [showModalItem, setShowModalItem] = useState(false);
  const [itemEnEdicion, setItemEnEdicion] = useState<ItemStock | null>(null);
  const [guardandoItem, setGuardandoItem] = useState(false);
  const [itemPieza, setItemPieza] = useState<string>(REPUESTOS_TALLER_PIEZAS[0] || 'RÓTULA DE SUSPENSIÓN');
  const [itemVehiculo, setItemVehiculo] = useState<string>('Peugeot 206');
  const [categoriaItem, setCategoriaItem] = useState('Tren Delantero / Suspensión');
  const [stockActualItem, setStockActualItem] = useState('0');
  const [stockMinimoItem, setStockMinimoItem] = useState('2');
  const [costoUnitarioItem, setCostoUnitarioItem] = useState('');
  const [precioVentaItem, setPrecioVentaItem] = useState('');

  const searchInputId = useId();
  const searchUsadosId = useId();

  // Carga inicial y listeners de sincronización
  const cargarListas = async () => {
    setCargandoDatos(true);
    try {
      const [resUsados, resCompras] = await Promise.all([
        gasApi.getRepuestosUsados(),
        gasApi.getComprasRepuestos(),
      ]);
      setRepuestosUsados(resUsados.items || []);
      setComprasRepuestos(resCompras.items || []);
    } catch (e) {
      console.warn('Error al cargar datos auxiliares de stock:', e);
    } finally {
      setCargandoDatos(false);
    }
  };

  useEffect(() => {
    cargarListas();

    const handleSync = () => {
      cargarListas();
    };

    window.addEventListener('taller_stock_sync', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('taller_stock_sync', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // ----------------------------------------------------
  // MANEJADORES: MÓDULO 1 (REPUESTOS UTILIZADOS)
  // ----------------------------------------------------
  const abrirModalNuevoUsado = () => {
    if (stockList.length > 0) {
      setUsadoModo('catalogo');
      setUsadoItemId(stockList[0]?.id || '');
      setUsadoVehiculo(stockList[0]?.vehiculoCompatibilidad || 'Peugeot 206');
    } else {
      setUsadoModo('listas');
      setUsadoPieza(REPUESTOS_TALLER_PIEZAS[0] || 'RÓTULA DE SUSPENSIÓN');
      setUsadoVehiculo('Peugeot 206');
    }
    setUsadoCantidad('1');
    setUsadoPatente('');
    setUsadoCliente('');
    setUsadoFecha(getFechaHoyArgentina());
    setUsadoObservaciones('');
    setShowModalUsado(true);
  };

  const handleGuardarRepuestoUsado = async (e: React.FormEvent) => {
    e.preventDefault();
    let piezaNombre = '';
    let vehiculo = '';

    if (usadoModo === 'catalogo') {
      const it = stockList.find((x) => x.id === usadoItemId);
      if (!it) {
        onShowToast('warning', 'Seleccioná un repuesto', 'Elegí un repuesto del menú desplegable.');
        return;
      }
      piezaNombre = it.nombre;
      vehiculo = it.vehiculoCompatibilidad || '';
    } else {
      if (!usadoPieza) {
        onShowToast('warning', 'Falta la pieza', 'Seleccioná la pieza del menú desplegable.');
        return;
      }
      if (!usadoVehiculo) {
        onShowToast('warning', 'Falta el vehículo', 'Seleccioná el modelo del vehículo del menú desplegable.');
        return;
      }
      piezaNombre = `${usadoPieza} - ${usadoVehiculo}`;
      vehiculo = usadoVehiculo;
    }

    const cant = parseInt(usadoCantidad, 10);
    if (!cant || cant <= 0) {
      onShowToast('warning', 'Cantidad inválida', 'La cantidad debe ser de al menos 1 unidad.');
      return;
    }

    setGuardandoUsado(true);
    try {
      const res = await gasApi.registrarRepuestoUsado({
        fecha: normalizarFechaArgentina(usadoFecha),
        repuestoNombre: piezaNombre,
        cantidad: cant,
        vehiculo: vehiculo || undefined,
        patente: usadoPatente.trim().toUpperCase() || undefined,
        cliente: usadoCliente.trim() || undefined,
        origen: 'manual',
        observaciones: usadoObservaciones.trim() || undefined,
      });

      if (res.success) {
        // Refrescar lista de stock en memoria
        const stockActualizado = await gasApi.getStockItems();
        onStockUpdated(stockActualizado.items);
        await cargarListas();

        onShowToast(
          'success',
          'Repuesto Utilizado Registrado',
          `Se descontó ${cant} unid. de "${piezaNombre}" y se sumó a la rotación. No afecta contabilidad.`
        );
        setShowModalUsado(false);
      } else {
        onShowToast('error', 'Error al registrar', res.error || 'No se pudo guardar el uso.');
      }
    } catch (err: any) {
      onShowToast('error', 'Error inesperado', err.message);
    } finally {
      setGuardandoUsado(false);
    }
  };

  const handleEliminarUso = async (id: string, nombrePieza: string, cantidad: number) => {
    if (
      !confirm(
        `¿Eliminar este registro de uso de "${nombrePieza}"?\n\nSe reintegrarán automáticamente ${cantidad} unidades al inventario físico.`
      )
    ) {
      return;
    }

    try {
      await gasApi.eliminarRepuestoUsado(id);
      const stockActualizado = await gasApi.getStockItems();
      onStockUpdated(stockActualizado.items);
      await cargarListas();
      onShowToast('info', 'Uso eliminado', `Se devolvieron ${cantidad} unidades al stock físico.`);
    } catch (err: any) {
      onShowToast('error', 'Error al eliminar', err.message);
    }
  };

  // ----------------------------------------------------
  // MANEJADORES: MÓDULO 2 (COMPRAS DE REPUESTOS)
  // ----------------------------------------------------
  const abrirModalCompraParaItem = (item?: ItemStock) => {
    if (item) {
      setCompraModoPieza('existente');
      setCompraItemId(item.id);
      setCompraCategoria(item.categoria || 'Tren Delantero / Suspensión');
      setCompraCantidad('10');
      setCompraCostoTotal(item.costoUnitario > 0 ? String(item.costoUnitario * 10) : '');
    } else {
      setCompraModoPieza(stockList.length > 0 ? 'existente' : 'nueva');
      setCompraItemId(stockList[0]?.id || '');
      setCompraPieza(REPUESTOS_TALLER_PIEZAS[0] || 'RÓTULA DE SUSPENSIÓN');
      setCompraVehiculo('Peugeot 206');
      setCompraCategoria('Tren Delantero / Suspensión');
      setCompraCantidad('10');
      setCompraCostoTotal('');
    }
    setCompraProveedor('');
    setCompraMetodoPago('Efectivo');
    setCompraFecha(getFechaHoyArgentina());
    setCompraImpactaContabilidad(true);
    setShowModalCompra(true);
  };

  const handleSeleccionarItemExistente = (id: string) => {
    setCompraItemId(id);
    const item = stockList.find((x) => x.id === id);
    if (item) {
      setCompraCategoria(item.categoria || 'Tren Delantero / Suspensión');
      const cant = parseInt(compraCantidad, 10) || 10;
      if (item.costoUnitario > 0) {
        setCompraCostoTotal(String(item.costoUnitario * cant));
      }
    }
  };

  const handleGuardarCompraRepuesto = async (e: React.FormEvent) => {
    e.preventDefault();
    let piezaNombre = '';
    let vehiculo = '';
    let categoria = compraCategoria;

    if (compraModoPieza === 'existente') {
      const it = stockList.find((x) => x.id === compraItemId);
      if (!it) {
        onShowToast('warning', 'Seleccioná un repuesto', 'Elegí un repuesto existente del menú desplegable.');
        return;
      }
      piezaNombre = it.nombre;
      vehiculo = it.vehiculoCompatibilidad || 'Multimarca';
      categoria = it.categoria || compraCategoria;
    } else {
      if (!compraPieza) {
        onShowToast('warning', 'Falta la pieza', 'Seleccioná la pieza del menú desplegable.');
        return;
      }
      if (!compraVehiculo) {
        onShowToast('warning', 'Falta el vehículo', 'Seleccioná el modelo del vehículo del menú desplegable.');
        return;
      }
      piezaNombre = `${compraPieza} - ${compraVehiculo}`;
      vehiculo = compraVehiculo;
    }

    const cant = parseInt(compraCantidad, 10);
    if (!cant || cant <= 0) {
      onShowToast('warning', 'Cantidad inválida', 'Ingresá una cantidad mayor a 0.');
      return;
    }

    const total = parseFloat(compraCostoTotal) || 0;
    const unitario = cant > 0 && total > 0 ? Math.round(total / cant) : 0;

    setGuardandoCompra(true);
    try {
      const res = await gasApi.registrarCompraRepuesto({
        fecha: normalizarFechaArgentina(compraFecha),
        repuestoNombre: piezaNombre,
        categoria,
        vehiculoCompatibilidad: vehiculo,
        cantidad: cant,
        costoUnitario: unitario,
        costoTotal: total,
        proveedor: compraProveedor.trim() || undefined,
        metodoPago: compraMetodoPago,
        impactaContabilidad: compraImpactaContabilidad,
      });

      if (res.success) {
        if (compraImpactaContabilidad && total > 0 && onRegistrarGastoContabilidad) {
          onRegistrarGastoContabilidad(
            `Compra Repuestos: ${cant}x ${piezaNombre}${compraProveedor ? ` (${compraProveedor})` : ''}`,
            total,
            compraMetodoPago
          );
        }

        const stockActualizado = await gasApi.getStockItems();
        onStockUpdated(stockActualizado.items);
        await cargarListas();

        onShowToast(
          'success',
          '¡Compra de Repuestos Registrada!',
          `Se sumaron +${cant} unidades a "${piezaNombre}".${
            compraImpactaContabilidad && total > 0
              ? ` Se cargó -$${total.toLocaleString('es-AR')} en Contabilidad.`
              : ''
          }`
        );
        setShowModalCompra(false);
      } else {
        onShowToast('error', 'Error en la compra', res.error || 'No se pudo guardar la compra.');
      }
    } catch (err: any) {
      onShowToast('error', 'Error al registrar compra', err.message);
    } finally {
      setGuardandoCompra(false);
    }
  };

  // ----------------------------------------------------
  // MANEJADORES: CATÁLOGO DE PIEZAS (ALTA / EDICIÓN MANUAL)
  // ----------------------------------------------------
  const abrirModalNuevoItemCatalogo = () => {
    setItemEnEdicion(null);
    setItemPieza(REPUESTOS_TALLER_PIEZAS[0] || 'RÓTULA DE SUSPENSIÓN');
    setItemVehiculo('Peugeot 206');
    setCategoriaItem('Tren Delantero / Suspensión');
    setStockActualItem('0');
    setStockMinimoItem('2');
    setCostoUnitarioItem('');
    setPrecioVentaItem('');
    setShowModalItem(true);
  };

  const abrirModalEditarItemCatalogo = (item: ItemStock) => {
    setItemEnEdicion(item);
    const partes = item.nombre.split(' - ');
    if (partes.length >= 2) {
      setItemPieza(partes[0].trim());
      setItemVehiculo(partes.slice(1).join(' - ').trim());
    } else {
      setItemPieza(item.nombre);
      setItemVehiculo(item.vehiculoCompatibilidad || 'Peugeot 206');
    }
    setCategoriaItem(item.categoria || 'Tren Delantero / Suspensión');
    setStockActualItem(String(item.stockActual || 0));
    setStockMinimoItem(String(item.stockMinimo || 2));
    setCostoUnitarioItem(item.costoUnitario ? String(item.costoUnitario) : '');
    setPrecioVentaItem(item.precioVenta ? String(item.precioVenta) : '');
    setShowModalItem(true);
  };

  const handleGuardarItemCatalogo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemPieza || !itemVehiculo) {
      onShowToast('warning', 'Campos requeridos', 'Seleccioná la pieza y el vehículo de los menús desplegables.');
      return;
    }

    const nombreUnificado = `${itemPieza} - ${itemVehiculo}`;

    setGuardandoItem(true);
    const itemGuardado: ItemStock = {
      id: itemEnEdicion ? itemEnEdicion.id : 'STOCK-' + Date.now(),
      nombre: nombreUnificado,
      categoria: categoriaItem.trim(),
      vehiculoCompatibilidad: itemVehiculo.trim(),
      stockActual: Math.max(0, parseInt(stockActualItem, 10) || 0),
      stockMinimo: Math.max(0, parseInt(stockMinimoItem, 10) || 2),
      costoUnitario: Math.max(0, parseFloat(costoUnitarioItem) || 0),
      precioVenta: Math.max(0, parseFloat(precioVentaItem) || 0),
      totalInstalados: itemEnEdicion ? itemEnEdicion.totalInstalados : 0,
      ultimoMovimiento: itemEnEdicion?.ultimoMovimiento || getFechaHoyArgentina(),
    };

    try {
      await gasApi.saveStockItem(itemGuardado);
      const res = await gasApi.getStockItems();
      onStockUpdated(res.items);
      onShowToast(
        'success',
        itemEnEdicion ? 'Pieza actualizada' : 'Pieza agregada al catálogo',
        `${itemGuardado.nombre} guardado correctamente.`
      );
      setShowModalItem(false);
    } catch (err: any) {
      onShowToast('error', 'Error al guardar', err.message || 'No se pudo guardar la pieza.');
    } finally {
      setGuardandoItem(false);
    }
  };

  const handleEliminarItemCatalogo = async (item: ItemStock) => {
    if (!confirm(`¿Eliminar definitivamente "${item.nombre}" del catálogo de repuestos?`)) return;
    try {
      await gasApi.deleteStockItem(item.id);
      const res = await gasApi.getStockItems();
      onStockUpdated(res.items);
      onShowToast('info', 'Repuesto eliminado', `${item.nombre} quitado del catálogo.`);
    } catch (e) {
      onShowToast('error', 'Error al borrar', 'No se pudo eliminar el repuesto.');
    }
  };

  // ----------------------------------------------------
  // ESTADÍSTICAS Y KPIS GLOBALES
  // ----------------------------------------------------
  const totalUnidadesFisicas = stockList.reduce((acc, it) => acc + (Number(it.stockActual) || 0), 0);
  const totalItemsCatalogo = stockList.length;
  const itemsBajoStock = stockList.filter(
    (it) => it.stockActual <= it.stockMinimo && it.stockActual > 0
  ).length;
  const itemsSinStock = stockList.filter((it) => Number(it.stockActual) === 0).length;

  const totalPiezasUsadasHistorico = repuestosUsados.reduce(
    (acc, it) => acc + (Number(it.cantidad) || 0),
    0
  );

  const totalInvertidoCompras = comprasRepuestos.reduce(
    (acc, it) => acc + (Number(it.costoTotal) || 0),
    0
  );

  // RADAR DE ROTACIÓN: TOP DE REPUESTOS MÁS USADOS EN TALLER
  // Calculado a partir de los registros de repuestos usados acumulados
  const rotacionPorRepuesto = repuestosUsados.reduce((acc, uso) => {
    const key = uso.repuestoNombre.trim().toUpperCase();
    acc[key] = (acc[key] || 0) + (Number(uso.cantidad) || 1);
    return acc;
  }, {} as Record<string, number>);

  // Si no hay usos registrados aún, tomar de `totalInstalados` de stockList como fallback inteligente
  stockList.forEach((it) => {
    const key = it.nombre.trim().toUpperCase();
    if (!rotacionPorRepuesto[key] && it.totalInstalados > 0) {
      rotacionPorRepuesto[key] = it.totalInstalados;
    }
  });

  const topRotacion = Object.entries(rotacionPorRepuesto)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([nombre, total]) => {
      const stockMatch = stockList.find((x) => x.nombre.trim().toUpperCase() === nombre);
      return {
        nombre,
        total,
        vehiculoCompatibilidad: stockMatch?.vehiculoCompatibilidad || 'Multimarca',
        stockActual: stockMatch?.stockActual || 0,
        stockMinimo: stockMatch?.stockMinimo || 2,
        stockItem: stockMatch,
      };
    });

  const maxRotacion = topRotacion[0]?.total || 1;

  // ----------------------------------------------------
  // FILTRADO DE LISTAS
  // ----------------------------------------------------
  // Módulo 1: Repuestos Usados
  const filteredUsados = repuestosUsados.filter((u) => {
    const term = searchUsados.toLowerCase().trim();
    if (term) {
      const n = (u.repuestoNombre || '').toLowerCase();
      const v = (u.vehiculo || '').toLowerCase();
      const p = (u.patente || '').toLowerCase();
      const c = (u.cliente || '').toLowerCase();
      if (!n.includes(term) && !v.includes(term) && !p.includes(term) && !c.includes(term)) {
        return false;
      }
    }
    if (filtroOrigenUsados === 'manual' && u.origen !== 'manual') return false;
    if (filtroOrigenUsados === 'facturacion' && u.origen !== 'facturacion') return false;
    return true;
  });

  // Módulo 2: Catálogo de Inventario
  const filteredStockList = stockList.filter((it) => {
    const term = searchCatalogo.toLowerCase().trim();
    if (term) {
      const nom = String(it.nombre || '').toLowerCase();
      const comp = String(it.vehiculoCompatibilidad || '').toLowerCase();
      const cat = String(it.categoria || '').toLowerCase();
      if (!nom.includes(term) && !comp.includes(term) && !cat.includes(term)) {
        return false;
      }
    }
    if (filtroEstadoStock === 'con_stock') return it.stockActual > 0;
    if (filtroEstadoStock === 'bajo_stock') return it.stockActual > 0 && it.stockActual <= it.stockMinimo;
    if (filtroEstadoStock === 'sin_stock') return it.stockActual === 0;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* HEADER PRINCIPAL CON IDENTIDAD DEL TALLER */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#0a0a0a] border border-neutral-800 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-red-500 text-xs font-heading font-black uppercase tracking-widest">
            <Package className="w-4 h-4" />
            <span>Sistema Integral de Repuestos del Taller</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-heading font-black text-white uppercase tracking-tight mt-1">
            Gestión de Stock, Rotación & Compras
          </h2>
          <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
            Control exacto dividido en 2 módulos: Repuestos que vas utilizando en cada trabajo (rotación de piezas) y Compras mayoristas para el stock del taller (con impacto en contabilidad).
          </p>
        </div>

        {/* BOTONES DE ACCIÓN RÁPIDA */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {moduloActivo === 'modulo1_usados' ? (
            <button
              type="button"
              onClick={abrirModalNuevoUsado}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-heading font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
            >
              <Wrench className="w-4 h-4" />
              <span>+ Cargar Repuesto Utilizado</span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => abrirModalCompraParaItem()}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-heading font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>+ Registrar Compra de Stock</span>
              </button>
              <button
                type="button"
                onClick={abrirModalNuevoItemCatalogo}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 font-heading font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Nueva Pieza Catálogo</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* KPI CARDS GLOBALES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stock Físico Actual */}
        <div className="p-5 rounded-xl bg-neutral-900/90 border border-neutral-800 border-t-4 border-t-emerald-500 shadow-xl">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-heading font-bold uppercase tracking-wider">
            <span>Stock Físico en Taller</span>
            <Package className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 font-mono text-2xl font-black text-emerald-400 tabular-nums">
            {totalUnidadesFisicas} <span className="text-sm font-normal text-neutral-400">unid.</span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">
            {totalItemsCatalogo} repuestos en catálogo físico
          </p>
        </div>

        {/* Repuestos Utilizados (Rotación) */}
        <div className="p-5 rounded-xl bg-neutral-900/90 border border-neutral-800 border-t-4 border-t-blue-500 shadow-xl">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-heading font-bold uppercase tracking-wider">
            <span>Repuestos Utilizados</span>
            <RotateCw className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3 font-mono text-2xl font-black text-blue-400 tabular-nums">
            {totalPiezasUsadasHistorico} <span className="text-sm font-normal text-neutral-400">piezas</span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">Instalados en reparaciones del taller</p>
        </div>

        {/* Alertas de Reposición */}
        <div className="p-5 rounded-xl bg-neutral-900/90 border border-neutral-800 border-t-4 border-t-rose-500 shadow-xl">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-heading font-bold uppercase tracking-wider">
            <span>Alertas de Reposición</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-3 font-mono text-2xl font-black text-rose-500 tabular-nums">
            {itemsBajoStock + itemsSinStock}
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">
            {itemsBajoStock} en stock crítico, {itemsSinStock} agotados
          </p>
        </div>

        {/* Inversión en Compras de Repuestos */}
        <div className="p-5 rounded-xl bg-neutral-900/90 border border-neutral-800 border-t-4 border-t-amber-500 shadow-xl">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-heading font-bold uppercase tracking-wider">
            <span>Inversión en Compras</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 font-mono text-2xl font-black text-amber-400 tabular-nums">
            ${totalInvertidoCompras.toLocaleString('es-AR')}
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">
            {comprasRepuestos.length} compras cargadas en Contabilidad
          </p>
        </div>
      </div>

      {/* SELECTOR DE LOS 2 MÓDULOS DE STOCK */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-1.5 rounded-2xl bg-neutral-950 border border-neutral-800">
        <div className="grid grid-cols-2 gap-2 flex-1">
          {/* BOTÓN MÓDULO 1 */}
          <button
            type="button"
            onClick={() => setModuloActivo('modulo1_usados')}
            className={`flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl font-heading font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
              moduloActivo === 'modulo1_usados'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-1 ring-blue-400'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <RotateCw className="w-4 h-4 shrink-0" />
            <span>MÓDULO 1: Repuestos Utilizados & Rotación</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                moduloActivo === 'modulo1_usados'
                  ? 'bg-blue-950 text-blue-200'
                  : 'bg-neutral-800 text-neutral-400'
              }`}
            >
              {repuestosUsados.length}
            </span>
          </button>

          {/* BOTÓN MÓDULO 2 */}
          <button
            type="button"
            onClick={() => setModuloActivo('modulo2_compras')}
            className={`flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl font-heading font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
              moduloActivo === 'modulo2_compras'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-1 ring-emerald-400'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Truck className="w-4 h-4 shrink-0" />
            <span>MÓDULO 2: Compras de Repuestos & Inventario</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                moduloActivo === 'modulo2_compras'
                  ? 'bg-emerald-950 text-emerald-200'
                  : 'bg-neutral-800 text-neutral-400'
              }`}
            >
              {stockList.length}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CONTENIDO DEL MÓDULO 1: REPUESTOS UTILIZADOS & ROTACIÓN                   */}
      {/* ========================================================================= */}
      {moduloActivo === 'modulo1_usados' && (
        <div className="space-y-6">
          {/* BANNER INFORMATIVO MÓDULO 1 */}
          <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-900/60 flex items-start gap-3">
            <RotateCw className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-neutral-300">
              <strong className="text-blue-400 font-heading uppercase block text-sm mb-0.5">
                Módulo 1: Control de Consumo de Repuestos en Taller
              </strong>
              <p>
                Acá registrás manualmente los repuestos que vas utilizando en cada auto (o ingresan automáticamente al facturar un trabajo).
                Al guardarse, <strong>descuenta 1 unidad del stock físico</strong> del taller y suma al <strong>radar de rotación</strong> para que sepas qué piezas se usan más.
                <span className="text-emerald-400 font-bold block mt-1">
                  ✓ NO genera gasto en Contabilidad, evitando doble cobro ya que el importe total del trabajo entra por la facturación del servicio.
                </span>
              </p>
            </div>
          </div>

          {/* RADAR DE MAYOR ROTACIÓN EN EL TALLER */}
          {topRotacion.length > 0 && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-neutral-950 via-[#0d0d0d] to-neutral-950 border border-blue-950/60 shadow-2xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h3 className="font-heading font-black text-white text-base uppercase tracking-tight">
                    🔥 Radar de Mayor Rotación en el Taller
                  </h3>
                </div>
                <span className="text-xs font-mono text-neutral-400 bg-neutral-900 px-3 py-1 rounded-full border border-neutral-800">
                  Ranking de piezas que más cambiás
                </span>
              </div>

              <p className="text-xs text-neutral-300">
                Estas son las piezas con mayor frecuencia de recambio en tu taller. Usalo como guía para comprar cajas cerradas a precio mayorista y no quedarte sin stock:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
                {topRotacion.map((item, idx) => {
                  const porcentaje = Math.round((item.total / maxRotacion) * 100);
                  const medallas = ['🥇', '🥈', '🥉', '4°', '5°'];

                  return (
                    <div
                      key={item.nombre}
                      className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 hover:border-neutral-700 transition-all flex flex-col justify-between gap-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base">{medallas[idx]}</span>
                            <strong className="text-sm font-heading font-black text-white uppercase tracking-wider">
                              {item.nombre}
                            </strong>
                          </div>
                          <span className="text-[11px] text-neutral-400 block mt-0.5 font-mono">
                            🚗 {item.vehiculoCompatibilidad}
                          </span>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono text-base font-black text-amber-400">
                            {item.total}
                          </span>
                          <span className="text-[10px] text-neutral-400 block uppercase font-bold">utilizados</span>
                        </div>
                      </div>

                      {/* Barra de rotación */}
                      <div className="space-y-1">
                        <div className="w-full h-2 rounded-full bg-neutral-950 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-600 via-amber-500 to-emerald-500 transition-all duration-500"
                            style={{ width: `${Math.max(12, porcentaje)}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 text-[11px]">
                        <span className="text-neutral-400">
                          En taller:{' '}
                          <strong
                            className={
                              item.stockActual > 0
                                ? 'text-emerald-400 font-mono'
                                : 'text-rose-500 font-mono'
                            }
                          >
                            {item.stockActual} unid.
                          </strong>
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            setModuloActivo('modulo2_compras');
                            abrirModalCompraParaItem(item.stockItem);
                          }}
                          className="text-emerald-400 hover:text-emerald-300 font-heading font-bold text-xs uppercase flex items-center gap-1 cursor-pointer"
                        >
                          <span>+ Comprar</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TABLA DE REPUESTOS UTILIZADOS */}
          <div className="p-6 rounded-2xl bg-[#0a0a0a] border border-neutral-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Buscador */}
              <div className="relative flex-1">
                <label htmlFor={searchUsadosId} className="sr-only">
                  Buscar repuesto usado
                </label>
                <Search className="w-4 h-4 text-neutral-500 absolute left-4 top-3.5" />
                <input
                  id={searchUsadosId}
                  type="text"
                  placeholder="BUSCAR POR REPUESTO, VEHÍCULO O PATENTE..."
                  value={searchUsados}
                  onChange={(e) => setSearchUsados(e.target.value)}
                  className="w-full bg-[#111] border border-neutral-800 focus:border-blue-600 focus:outline-none rounded-xl pl-11 pr-4 py-3 text-sm font-heading font-bold text-white placeholder-neutral-600 uppercase tracking-wider transition-colors shadow-inner"
                />
              </div>

              {/* Filtros de origen */}
              <div className="flex items-center gap-1.5 p-1 bg-neutral-900 rounded-lg text-xs font-heading font-bold uppercase shrink-0">
                <button
                  type="button"
                  onClick={() => setFiltroOrigenUsados('todos')}
                  className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                    filtroOrigenUsados === 'todos'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Todos ({repuestosUsados.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroOrigenUsados('manual')}
                  className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                    filtroOrigenUsados === 'manual'
                      ? 'bg-blue-700 text-white shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Cargados a Mano
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroOrigenUsados('facturacion')}
                  className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                    filtroOrigenUsados === 'facturacion'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Desde Presupuesto / Factura
                </button>
              </div>
            </div>

            {/* TABLA */}
            <div className="overflow-x-auto rounded-xl border border-neutral-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-900 text-neutral-400 font-heading font-bold uppercase tracking-wider border-b border-neutral-800">
                  <tr>
                    <th className="py-3.5 px-4">Fecha</th>
                    <th className="py-3.5 px-4">Repuesto / Pieza Utilizada</th>
                    <th className="py-3.5 px-4 text-center">Cant.</th>
                    <th className="py-3.5 px-4">Vehículo / Patente</th>
                    <th className="py-3.5 px-4">Origen</th>
                    <th className="py-3.5 px-4">Detalle / Notas</th>
                    <th className="py-3.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/80">
                  {filteredUsados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-neutral-500">
                        <Wrench className="w-8 h-8 mx-auto mb-2 text-neutral-600" />
                        <span>No hay repuestos utilizados registrados con este criterio.</span>
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={abrirModalNuevoUsado}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-heading font-bold text-xs uppercase cursor-pointer"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span>Cargar primer repuesto usado</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredUsados.map((uso) => (
                      <tr key={uso.id} className="hover:bg-neutral-900/50 transition-colors">
                        {/* Fecha */}
                        <td className="py-3.5 px-4 font-mono text-neutral-300 whitespace-nowrap">
                          {formatearFechaArgentina(uso.fecha)}
                        </td>

                        {/* Pieza */}
                        <td className="py-3.5 px-4">
                          <strong className="font-heading font-black text-white uppercase text-sm block">
                            {uso.repuestoNombre}
                          </strong>
                        </td>

                        {/* Cantidad */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full font-mono font-black text-xs bg-blue-950 text-blue-400 border border-blue-800">
                            {uso.cantidad} unid.
                          </span>
                        </td>

                        {/* Vehículo / Patente */}
                        <td className="py-3.5 px-4">
                          <div className="text-neutral-200 font-medium">
                            {uso.vehiculo || 'No especificado'}
                          </div>
                          {uso.patente && (
                            <span className="font-mono text-[11px] text-amber-400 font-bold block">
                              Patente: {uso.patente}
                            </span>
                          )}
                          {uso.cliente && (
                            <span className="text-[10px] text-neutral-400 block">
                              Cliente: {uso.cliente}
                            </span>
                          )}
                        </td>

                        {/* Origen */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {uso.origen === 'facturacion' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-heading font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Automático (Facturación)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-heading font-bold uppercase bg-blue-950 text-blue-300 border border-blue-800">
                              <Wrench className="w-3 h-3 text-blue-400" />
                              <span>Carga Manual</span>
                            </span>
                          )}
                        </td>

                        {/* Notas */}
                        <td className="py-3.5 px-4 text-neutral-400 text-[11px] max-w-xs truncate">
                          {uso.observaciones || uso.presupuestoId ? (
                            <span>{uso.observaciones || `Presupuesto #${uso.presupuestoId}`}</span>
                          ) : (
                            <span className="text-neutral-600">-</span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleEliminarUso(uso.id, uso.repuestoNombre, uso.cantidad)}
                            className="p-1.5 rounded-lg bg-neutral-900 hover:bg-red-950 border border-neutral-800 hover:border-red-800 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                            title="Eliminar y devolver unidades al stock físico"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONTENIDO DEL MÓDULO 2: COMPRAS DE REPUESTOS & INVENTARIO DE STOCK        */}
      {/* ========================================================================= */}
      {moduloActivo === 'modulo2_compras' && (
        <div className="space-y-6">
          {/* BANNER INFORMATIVO MÓDULO 2 */}
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/60 flex items-start gap-3">
            <Truck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-neutral-300">
              <strong className="text-emerald-400 font-heading uppercase block text-sm mb-0.5">
                Módulo 2: Compras Mayoristas & Stock en Estantería
              </strong>
              <p>
                Acá ingresás las compras de repuestos que adquirís para abastecer el taller (ej: 10 rótulas de Peugeot 206, 6 bieletas, etc.).
                Al registrar la compra, <strong>se suman las unidades al stock disponible</strong> del taller y{' '}
                <strong className="text-emerald-300">
                  SÍ impacta en Contabilidad como egreso negativo (categoría Repuestos / Repuesteros)
                </strong>{' '}
                para que tu balance de caja y gastos refleje la inversión real.
              </p>
            </div>
          </div>

          {/* SUB-PESTAÑAS DEL MÓDULO 2: INVENTARIO vs HISTORIAL DE COMPRAS */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 p-1 bg-neutral-900 rounded-xl">
              <button
                type="button"
                onClick={() => setVistaModulo2('inventario')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-heading font-bold uppercase transition-all cursor-pointer ${
                  vistaModulo2 === 'inventario'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Inventario Físico en Taller ({stockList.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setVistaModulo2('historial_compras')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-heading font-bold uppercase transition-all cursor-pointer ${
                  vistaModulo2 === 'historial_compras'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Historial de Compras Realizadas ({comprasRepuestos.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => abrirModalCompraParaItem()}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-black text-xs uppercase cursor-pointer shadow-lg shadow-emerald-600/30"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>+ Registrar Nueva Compra</span>
            </button>
          </div>

          {/* SUBVISTA A: INVENTARIO FÍSICO */}
          {vistaModulo2 === 'inventario' && (
            <div className="p-6 rounded-2xl bg-[#0a0a0a] border border-neutral-800 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Buscador */}
                <div className="relative flex-1">
                  <label htmlFor={searchInputId} className="sr-only">
                    Buscar repuesto en catálogo
                  </label>
                  <Search className="w-4 h-4 text-neutral-500 absolute left-4 top-3.5" />
                  <input
                    id={searchInputId}
                    type="text"
                    placeholder="BUSCAR EN CATÁLOGO POR NOMBRE O MODELO DE AUTO..."
                    value={searchCatalogo}
                    onChange={(e) => setSearchCatalogo(e.target.value)}
                    className="w-full bg-[#111] border border-neutral-800 focus:border-emerald-600 focus:outline-none rounded-xl pl-11 pr-4 py-3 text-sm font-heading font-bold text-white placeholder-neutral-600 uppercase tracking-wider transition-colors shadow-inner"
                  />
                </div>

                {/* Filtros de estado de stock */}
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-neutral-900 rounded-lg text-xs font-heading font-bold uppercase shrink-0">
                  <button
                    type="button"
                    onClick={() => setFiltroEstadoStock('todos')}
                    className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                      filtroEstadoStock === 'todos'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Todos ({stockList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroEstadoStock('con_stock')}
                    className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                      filtroEstadoStock === 'con_stock'
                        ? 'bg-emerald-700 text-white shadow'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Con Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroEstadoStock('bajo_stock')}
                    className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                      filtroEstadoStock === 'bajo_stock'
                        ? 'bg-amber-600 text-white shadow'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Poco Stock ({itemsBajoStock})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroEstadoStock('sin_stock')}
                    className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                      filtroEstadoStock === 'sin_stock'
                        ? 'bg-neutral-800 text-white shadow'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Agotados ({itemsSinStock})
                  </button>
                </div>
              </div>

              {/* TABLA DE INVENTARIO */}
              <div className="overflow-x-auto rounded-xl border border-neutral-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-900 text-neutral-400 font-heading font-bold uppercase tracking-wider border-b border-neutral-800">
                    <tr>
                      <th className="py-3.5 px-4">Pieza / Repuesto</th>
                      <th className="py-3.5 px-4">Vehículos</th>
                      <th className="py-3.5 px-4 text-center">Stock Físico</th>
                      <th className="py-3.5 px-4 text-center">Mínimo</th>
                      <th className="py-3.5 px-4 text-right">Costo Compra</th>
                      <th className="py-3.5 px-4 text-right">Precio Venta</th>
                      <th className="py-3.5 px-4 text-center">Rotación</th>
                      <th className="py-3.5 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/80">
                    {filteredStockList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-neutral-500">
                          <Package className="w-8 h-8 mx-auto mb-2 text-neutral-600" />
                          <span>No hay repuestos que coincidan con la búsqueda o filtro.</span>
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={abrirModalNuevoItemCatalogo}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-bold text-xs uppercase cursor-pointer"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                              <span>Crear primera pieza</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredStockList.map((item) => {
                        const tieneStock = item.stockActual > 0;
                        const stockCritico = tieneStock && item.stockActual <= item.stockMinimo;

                        return (
                          <tr key={item.id} className="hover:bg-neutral-900/50 transition-colors">
                            {/* Pieza */}
                            <td className="py-3.5 px-4">
                              <div className="font-heading font-black text-white uppercase text-sm">
                                {item.nombre}
                              </div>
                              <span className="text-[10px] text-neutral-400 block font-medium">
                                {item.categoria || 'Tren Delantero'}
                              </span>
                            </td>

                            {/* Compatibilidad */}
                            <td className="py-3.5 px-4 font-mono text-neutral-300">
                              {item.vehiculoCompatibilidad || 'Multimarca'}
                            </td>

                            {/* Stock Físico */}
                            <td className="py-3.5 px-4 text-center">
                              <span
                                className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full font-mono font-bold text-xs ${
                                  item.stockActual > item.stockMinimo
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                    : stockCritico
                                    ? 'bg-amber-950 text-amber-400 border border-amber-800 animate-pulse'
                                    : 'bg-rose-950 text-rose-400 border border-rose-800'
                                }`}
                              >
                                {item.stockActual} unid.
                              </span>
                            </td>

                            {/* Mínimo */}
                            <td className="py-3.5 px-4 text-center font-mono text-neutral-400">
                              {item.stockMinimo || 2}
                            </td>

                            {/* Costo Unitario */}
                            <td className="py-3.5 px-4 text-right font-mono text-neutral-400">
                              {item.costoUnitario > 0 ? `$${item.costoUnitario.toLocaleString('es-AR')}` : '-'}
                            </td>

                            {/* Precio Venta */}
                            <td className="py-3.5 px-4 text-right font-mono text-emerald-400 font-bold">
                              {item.precioVenta > 0 ? `$${item.precioVenta.toLocaleString('es-AR')}` : '-'}
                            </td>

                            {/* Rotación */}
                            <td className="py-3.5 px-4 text-center">
                              <span className="font-mono font-black text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                                {item.totalInstalados || 0}
                              </span>
                            </td>

                            {/* Acciones */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => abrirModalCompraParaItem(item)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-300 font-heading font-bold text-[11px] uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
                                  title="Ingresar compra de stock"
                                >
                                  <ShoppingCart className="w-3 h-3" />
                                  <span>+ Comprar</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => abrirModalEditarItemCatalogo(item)}
                                  className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                                  title="Editar pieza"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleEliminarItemCatalogo(item)}
                                  className="p-1.5 rounded-lg bg-neutral-900 hover:bg-red-950 border border-neutral-800 hover:border-red-800 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                                  title="Eliminar del catálogo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUBVISTA B: HISTORIAL DE COMPRAS REALIZADAS */}
          {vistaModulo2 === 'historial_compras' && (
            <div className="p-6 rounded-2xl bg-[#0a0a0a] border border-neutral-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-heading font-black text-white uppercase tracking-tight">
                    Historial de Compras de Repuestos Realizadas
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Registro de todas las compras ingresadas al taller con su respectivo gasto en Contabilidad.
                  </p>
                </div>

                <div className="font-mono text-sm font-black text-emerald-400 bg-neutral-900 px-3.5 py-1.5 rounded-xl border border-neutral-800">
                  Total Invertido: ${totalInvertidoCompras.toLocaleString('es-AR')}
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-neutral-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-900 text-neutral-400 font-heading font-bold uppercase tracking-wider border-b border-neutral-800">
                    <tr>
                      <th className="py-3.5 px-4">Fecha</th>
                      <th className="py-3.5 px-4">Repuesto Comprado</th>
                      <th className="py-3.5 px-4 text-center">Cantidad</th>
                      <th className="py-3.5 px-4">Proveedor / Repuestero</th>
                      <th className="py-3.5 px-4 text-right">Costo Unit.</th>
                      <th className="py-3.5 px-4 text-right">Total Pagado</th>
                      <th className="py-3.5 px-4">Medio de Pago</th>
                      <th className="py-3.5 px-4 text-center">Contabilidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/80">
                    {comprasRepuestos.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-neutral-500">
                          <Truck className="w-8 h-8 mx-auto mb-2 text-neutral-600" />
                          <span>Aún no hay compras de stock registradas.</span>
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() => abrirModalCompraParaItem()}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-bold text-xs uppercase cursor-pointer"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                              <span>Registrar primera compra</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      comprasRepuestos.map((compra) => (
                        <tr key={compra.id} className="hover:bg-neutral-900/50 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-neutral-300 whitespace-nowrap">
                            {formatearFechaArgentina(compra.fecha)}
                          </td>
                          <td className="py-3.5 px-4">
                            <strong className="font-heading font-black text-white uppercase text-sm block">
                              {compra.repuestoNombre}
                            </strong>
                            <span className="text-[10px] text-neutral-400 block font-mono">
                              {compra.vehiculoCompatibilidad || 'Multimarca'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-400">
                            +{compra.cantidad} unid.
                          </td>
                          <td className="py-3.5 px-4 text-neutral-300">
                            {compra.proveedor || 'Sin especificar'}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-neutral-400">
                            ${compra.costoUnitario?.toLocaleString('es-AR') || '-'}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-black text-rose-400">
                            -${compra.costoTotal.toLocaleString('es-AR')}
                          </td>
                          <td className="py-3.5 px-4 text-neutral-300 font-medium">
                            {compra.metodoPago}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {compra.impactaContabilidad ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-heading font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>Cargado en Gastos</span>
                              </span>
                            ) : (
                              <span className="text-neutral-500 text-[10px]">No cargado</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: REGISTRAR REPUESTO UTILIZADO (CONSUMO EN REPARACIONES)          */}
      {/* ========================================================================= */}
      {showModalUsado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-[#0d0d0d] border border-blue-600/80 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-blue-400" />
                <h3 className="font-heading font-black text-white text-base uppercase tracking-tight">
                  Registrar Repuesto Utilizado en Taller
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModalUsado(false)}
                className="text-neutral-500 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Aviso claro de que NO impacta en contabilidad */}
            <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/80 text-[11px] text-blue-300">
              <strong className="block font-heading uppercase text-xs text-blue-200 mb-0.5">
                💡 Carga de Uso de Repuestos:
              </strong>
              Este registro <strong>resta 1 unidad (o la cantidad indicada)</strong> del stock físico disponible y alimenta las <strong>estadísticas de rotación</strong>.
              <span className="block mt-1 font-bold text-emerald-300">
                ✓ NO impacta en Contabilidad (evita duplicar cobros porque el trabajo se factura por presupuesto/turno).
              </span>
            </div>

            <form onSubmit={handleGuardarRepuestoUsado} className="space-y-4">
              {/* Selector de modo si hay catálogo disponible */}
              {stockList.length > 0 && (
                <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-950 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setUsadoModo('catalogo')}
                    className={`py-2 rounded text-xs font-heading font-bold uppercase transition-all cursor-pointer ${
                      usadoModo === 'catalogo'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Repuesto en Catálogo ({stockList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUsadoModo('listas')}
                    className={`py-2 rounded text-xs font-heading font-bold uppercase transition-all cursor-pointer ${
                      usadoModo === 'listas'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Elegir Pieza + Auto
                  </button>
                </div>
              )}

              {/* Si es de Catálogo existente */}
              {usadoModo === 'catalogo' && stockList.length > 0 ? (
                <div>
                  <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                    Seleccionar Repuesto Utilizado (Menú Desplegable) *
                  </label>
                  <select
                    value={usadoItemId}
                    onChange={(e) => {
                      setUsadoItemId(e.target.value);
                      const it = stockList.find((x) => x.id === e.target.value);
                      if (it && it.vehiculoCompatibilidad) {
                        setUsadoVehiculo(it.vehiculoCompatibilidad);
                      }
                    }}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 text-xs text-white rounded-lg px-3 py-2.5 font-bold focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">-- Seleccionar de los repuestos del taller --</option>
                    {stockList.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nombre} (Stock actual: {item.stockActual} unid.)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                /* Si elige Pieza + Auto de los desplegables estandarizados */
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                      1. Pieza / Repuesto (Menú Desplegable) *
                    </label>
                    <select
                      value={usadoPieza}
                      onChange={(e) => setUsadoPieza(e.target.value)}
                      required
                      className="w-full bg-neutral-950 border border-neutral-800 text-xs text-white rounded-lg px-3 py-2.5 font-bold focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">-- Seleccionar Repuesto Estándar --</option>
                      {REPUESTOS_TALLER_PIEZAS.map((p) => (
                        <option key={p} value={p}>
                          🔩 {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                      2. Vehículo / Auto (Menú Desplegable) *
                    </label>
                    <select
                      value={usadoVehiculo}
                      onChange={(e) => setUsadoVehiculo(e.target.value)}
                      required
                      className="w-full bg-neutral-950 border border-neutral-800 text-xs text-white rounded-lg px-3 py-2.5 font-bold focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">-- Seleccionar Marca y Modelo de Argentina --</option>
                      {VEHICULOS_POR_MARCA.map((grupo) => (
                        <optgroup key={grupo.marca} label={`🚗 ${grupo.marca}`}>
                          {grupo.modelos.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  {/* Previsualización del nombre unificado */}
                  {usadoPieza && usadoVehiculo && (
                    <div className="p-2.5 rounded-lg bg-blue-950/30 border border-blue-800/60 text-xs flex items-center justify-between">
                      <span className="text-neutral-400 font-medium">Repuesto que se registrará:</span>
                      <strong className="text-blue-300 font-heading font-black uppercase">
                        {usadoPieza} - {usadoVehiculo}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              {/* Cantidad y Fecha */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                    Cantidad Utilizada *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={usadoCantidad}
                    onChange={(e) => setUsadoCantidad(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-600 focus:outline-none rounded-lg px-3 py-2 text-sm text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                    Fecha del Trabajo *
                  </label>
                  <input
                    type="date"
                    required
                    value={usadoFecha}
                    onChange={(e) => setUsadoFecha(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-600 focus:outline-none rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Patente y Cliente (Opcionales para seguimiento) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                    Patente (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: AA123BB"
                    value={usadoPatente}
                    onChange={(e) => setUsadoPatente(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-600 focus:outline-none rounded-lg px-3 py-2 text-xs text-white uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                    Cliente (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Nombre del cliente"
                    value={usadoCliente}
                    onChange={(e) => setUsadoCliente(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-600 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                  Observaciones / Notas
                </label>
                <input
                  type="text"
                  placeholder="Ej: Lado izquierdo / Rótula con juego"
                  value={usadoObservaciones}
                  onChange={(e) => setUsadoObservaciones(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-600 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowModalUsado(false)}
                  className="px-4 py-2 rounded-lg bg-neutral-900 text-neutral-300 font-heading font-bold text-xs uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoUsado}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-heading font-black text-xs uppercase flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-600/30"
                >
                  {guardandoUsado ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Confirmar Repuesto Utilizado</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: REGISTRAR COMPRA DE STOCK (CON IMPACTO EN CONTABILIDAD)           */}
      {/* ========================================================================= */}
      {showModalCompra && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-[#0d0d0d] border-2 border-emerald-600/80 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-heading font-black text-white text-base uppercase tracking-tight">
                  Registrar Compra de Repuestos para Taller
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModalCompra(false)}
                className="text-neutral-500 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector de si es pieza existente o nueva */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-950 rounded-lg">
              <button
                type="button"
                onClick={() => setCompraModoPieza('existente')}
                className={`py-2 rounded text-xs font-heading font-bold uppercase transition-all cursor-pointer ${
                  compraModoPieza === 'existente'
                    ? 'bg-emerald-600 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Pieza Existente en Catálogo
              </button>
              <button
                type="button"
                onClick={() => {
                  setCompraModoPieza('nueva');
                  setCompraItemId('');
                  setCompraPieza(REPUESTOS_TALLER_PIEZAS[0] || 'RÓTULA DE SUSPENSIÓN');
                  setCompraVehiculo('Peugeot 206');
                }}
                className={`py-2 rounded text-xs font-heading font-bold uppercase transition-all cursor-pointer ${
                  compraModoPieza === 'nueva'
                    ? 'bg-emerald-600 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                + Nueva Pieza Comprada
              </button>
            </div>

            <form onSubmit={handleGuardarCompraRepuesto} className="space-y-4">
              {compraModoPieza === 'existente' && stockList.length > 0 ? (
                <div>
                  <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                    Seleccionar Repuesto a Reponer (Menú Desplegable) *
                  </label>
                  <select
                    value={compraItemId}
                    onChange={(e) => handleSeleccionarItemExistente(e.target.value)}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 text-xs text-white rounded-lg px-3 py-2.5 font-bold focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">-- Seleccionar pieza --</option>
                    {stockList.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nombre} (Stock actual: {item.stockActual} | Costo habitual: ${item.costoUnitario || 0})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                      1. Pieza / Repuesto (Menú Desplegable) *
                    </label>
                    <select
                      value={compraPieza}
                      onChange={(e) => setCompraPieza(e.target.value)}
                      required
                      className="w-full bg-neutral-950 border border-neutral-800 text-xs text-white rounded-lg px-3 py-2.5 font-bold focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">-- Seleccionar Repuesto Estándar --</option>
                      {REPUESTOS_TALLER_PIEZAS.map((p) => (
                        <option key={p} value={p}>
                          🔩 {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                      2. Vehículo / Auto (Menú Desplegable) *
                    </label>
                    <select
                      value={compraVehiculo}
                      onChange={(e) => setCompraVehiculo(e.target.value)}
                      required
                      className="w-full bg-neutral-950 border border-neutral-800 text-xs text-white rounded-lg px-3 py-2.5 font-bold focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">-- Seleccionar Marca y Modelo de Argentina --</option>
                      {VEHICULOS_POR_MARCA.map((grupo) => (
                        <optgroup key={grupo.marca} label={`🚗 ${grupo.marca}`}>
                          {grupo.modelos.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                      3. Categoría (Menú Desplegable)
                    </label>
                    <select
                      value={compraCategoria}
                      onChange={(e) => setCompraCategoria(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 text-xs text-white rounded-lg px-3 py-2 focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="Tren Delantero / Suspensión">Tren Delantero / Suspensión</option>
                      <option value="Frenos">Frenos</option>
                      <option value="Caja de Dirección">Caja de Dirección</option>
                      <option value="Amortiguadores">Amortiguadores</option>
                      <option value="Otros Repuestos">Otros Repuestos</option>
                    </select>
                  </div>

                  {/* Previsualización del nombre unificado */}
                  {compraPieza && compraVehiculo && (
                    <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/60 text-xs flex items-center justify-between">
                      <span className="text-neutral-400 font-medium">Nombre que se guardará en Stock:</span>
                      <strong className="text-emerald-300 font-heading font-black uppercase">
                        {compraPieza} - {compraVehiculo}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              {/* Cantidad y Costo Total */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                    Cantidad Comprada (Unidades) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={compraCantidad}
                    onChange={(e) => setCompraCantidad(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 focus:outline-none rounded-lg px-3 py-2 text-sm text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                    Costo Total Abonado ($) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="Monto total pagado"
                    value={compraCostoTotal}
                    onChange={(e) => setCompraCostoTotal(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 focus:outline-none rounded-lg px-3 py-2 text-sm text-emerald-400 font-mono font-bold"
                  />
                  {parseFloat(compraCostoTotal) > 0 && parseInt(compraCantidad, 10) > 0 && (
                    <span className="text-[10px] text-neutral-400 block mt-0.5 font-mono">
                      Costo unitario: ${Math.round(parseFloat(compraCostoTotal) / parseInt(compraCantidad, 10)).toLocaleString('es-AR')}
                    </span>
                  )}
                </div>
              </div>

              {/* Proveedor y Fecha */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                    Proveedor / Repuestero (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Distribuidora Warnes, Sur Repuestos..."
                    value={compraProveedor}
                    onChange={(e) => setCompraProveedor(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                    Fecha de Compra *
                  </label>
                  <input
                    type="date"
                    required
                    value={compraFecha}
                    onChange={(e) => setCompraFecha(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 focus:outline-none rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Método de Pago */}
              <div>
                <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                  Método de Pago con el que se abonó
                </label>
                <select
                  value={compraMetodoPago}
                  onChange={(e) => setCompraMetodoPago(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 text-xs text-white rounded-lg px-3 py-2"
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                  <option value="Mercado Pago">Mercado Pago</option>
                  <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                </select>
              </div>

              {/* SWITCH CLAVE: IMPACTO EN CONTABILIDAD */}
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/80 space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={compraImpactaContabilidad}
                    onChange={(e) => setCompraImpactaContabilidad(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-neutral-900 border-neutral-700 cursor-pointer"
                  />
                  <span className="font-heading font-black text-xs uppercase text-emerald-300">
                    Impactar automáticamente en Contabilidad como GASTO NEGATIVO
                  </span>
                </label>
                <p className="text-[11px] text-neutral-400 pl-6">
                  Se asentará un egreso de{' '}
                  <strong className="text-white">
                    ${parseFloat(compraCostoTotal) > 0 ? parseFloat(compraCostoTotal).toLocaleString('es-AR') : '0'}
                  </strong>{' '}
                  bajo la categoría <em>&ldquo;Repuestos / Repuesteros&rdquo;</em> para descontar de tu saldo de caja.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowModalCompra(false)}
                  className="px-4 py-2 rounded-lg bg-neutral-900 text-neutral-300 font-heading font-bold text-xs uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoCompra}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-black text-xs uppercase flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/30"
                >
                  {guardandoCompra ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Confirmar Compra & Sumar a Stock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: NUEVA PIEZA EN CATÁLOGO / EDITAR                                 */}
      {/* ========================================================================= */}
      {showModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-[#0d0d0d] border border-neutral-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-red-500" />
                <h3 className="font-heading font-black text-white text-base uppercase tracking-tight">
                  {itemEnEdicion ? 'Editar Repuesto en Catálogo' : 'Nueva Pieza en Catálogo'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModalItem(false)}
                className="text-neutral-500 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarItemCatalogo} className="space-y-4">
              <div>
                <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                  1. Pieza / Repuesto (Menú Desplegable) *
                </label>
                <select
                  value={itemPieza}
                  onChange={(e) => setItemPieza(e.target.value)}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 text-xs text-white rounded-lg px-3 py-2.5 font-bold focus:border-red-600 focus:outline-none"
                >
                  <option value="">-- Seleccionar Repuesto Estándar --</option>
                  {REPUESTOS_TALLER_PIEZAS.map((p) => (
                    <option key={p} value={p}>
                      🔩 {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                  2. Vehículo / Auto (Menú Desplegable) *
                </label>
                <select
                  value={itemVehiculo}
                  onChange={(e) => setItemVehiculo(e.target.value)}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 text-xs text-white rounded-lg px-3 py-2.5 font-bold focus:border-red-600 focus:outline-none"
                >
                  <option value="">-- Seleccionar Marca y Modelo de Argentina --</option>
                  {VEHICULOS_POR_MARCA.map((grupo) => (
                    <optgroup key={grupo.marca} label={`🚗 ${grupo.marca}`}>
                      {grupo.modelos.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                  3. Categoría (Menú Desplegable)
                </label>
                <select
                  value={categoriaItem}
                  onChange={(e) => setCategoriaItem(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 text-xs text-white rounded-lg px-3 py-2 focus:border-red-600 focus:outline-none"
                >
                  <option value="Tren Delantero / Suspensión">Tren Delantero / Suspensión</option>
                  <option value="Frenos">Frenos</option>
                  <option value="Caja de Dirección">Caja de Dirección</option>
                  <option value="Amortiguadores">Amortiguadores</option>
                  <option value="Otros Repuestos">Otros Repuestos</option>
                </select>
              </div>

              {itemPieza && itemVehiculo && (
                <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs flex items-center justify-between">
                  <span className="text-neutral-400 font-medium">Pieza Unificada:</span>
                  <strong className="text-red-400 font-heading font-black uppercase">
                    {itemPieza} - {itemVehiculo}
                  </strong>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                    Stock Físico Inicial en Taller
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stockActualItem}
                    onChange={(e) => setStockActualItem(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                  <p className="text-[10px] text-neutral-400 mt-0.5">0 si no tenés stock físico aún</p>
                </div>

                <div>
                  <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                    Alerta de Stock Mínimo
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stockMinimoItem}
                    onChange={(e) => setStockMinimoItem(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                  <p className="text-[10px] text-neutral-400 mt-0.5">Avisa cuando queden pocas</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                    Costo Compra Unitario ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ej: 15000"
                    value={costoUnitarioItem}
                    onChange={(e) => setCostoUnitarioItem(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                    Precio Venta Sugerido ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ej: 28000"
                    value={precioVentaItem}
                    onChange={(e) => setPrecioVentaItem(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-xs text-emerald-400 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowModalItem(false)}
                  className="px-4 py-2 rounded-lg bg-neutral-900 text-neutral-300 font-heading font-bold text-xs uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoItem}
                  className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-heading font-black text-xs uppercase flex items-center gap-2 cursor-pointer shadow-lg shadow-red-600/30"
                >
                  {guardandoItem ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Guardar Pieza en Catálogo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
