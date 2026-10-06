import { useState, useId } from 'react';
import { ItemStock } from '../types';
import { gasApi } from '../services/gasApi';
import { getFechaHoyArgentina } from '../utils/dateFormatter';
import { REPUESTOS_TALLER_PIEZAS } from '../constants/workshopItems';
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
  Percent,
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
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'con_stock' | 'bajo_stock' | 'sin_stock'>('todos');

  // Modals
  const [showModalItem, setShowModalItem] = useState(false);
  const [itemEnEdicion, setItemEnEdicion] = useState<ItemStock | null>(null);
  const [guardandoItem, setGuardandoItem] = useState(false);

  // Form Fields Item
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('Tren Delantero / Suspensión');
  const [vehiculoCompatibilidad, setVehiculoCompatibilidad] = useState('');
  const [stockActual, setStockActual] = useState('0');
  const [stockMinimo, setStockMinimo] = useState('2');
  const [costoUnitario, setCostoUnitario] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');

  // Modal Compra
  const [showModalCompra, setShowModalCompra] = useState(false);
  const [itemParaCompra, setItemParaCompra] = useState<ItemStock | null>(null);
  const [cantidadCompra, setCantidadCompra] = useState('10');
  const [costoTotalCompra, setCostoTotalCompra] = useState('');
  const [registrarEnContabilidad, setRegistrarEnContabilidad] = useState(true);
  const [metodoPagoCompra, setMetodoPagoCompra] = useState('Efectivo');
  const [guardandoCompra, setGuardandoCompra] = useState(false);

  const searchInputId = useId();

  // Abrir modal nuevo / editar
  const abrirModalNuevo = () => {
    setItemEnEdicion(null);
    setNombre('');
    setCategoria('Tren Delantero / Suspensión');
    setVehiculoCompatibilidad('');
    setStockActual('0');
    setStockMinimo('2');
    setCostoUnitario('');
    setPrecioVenta('');
    setShowModalItem(true);
  };

  const abrirModalEditar = (item: ItemStock) => {
    setItemEnEdicion(item);
    setNombre(item.nombre);
    setCategoria(item.categoria || 'Tren Delantero / Suspensión');
    setVehiculoCompatibilidad(item.vehiculoCompatibilidad || '');
    setStockActual(String(item.stockActual || 0));
    setStockMinimo(String(item.stockMinimo || 2));
    setCostoUnitario(item.costoUnitario ? String(item.costoUnitario) : '');
    setPrecioVenta(item.precioVenta ? String(item.precioVenta) : '');
    setShowModalItem(true);
  };

  const abrirModalCompra = (item: ItemStock) => {
    setItemParaCompra(item);
    setCantidadCompra('10');
    setCostoTotalCompra(item.costoUnitario ? String(item.costoUnitario * 10) : '');
    setRegistrarEnContabilidad(true);
    setMetodoPagoCompra('Efectivo');
    setShowModalCompra(true);
  };

  // Guardar Item
  const handleGuardarItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      onShowToast('warning', 'Falta el nombre', 'Ingresá el nombre del repuesto.');
      return;
    }

    setGuardandoItem(true);
    const itemGuardado: ItemStock = {
      id: itemEnEdicion ? itemEnEdicion.id : 'STOCK-' + Date.now(),
      nombre: nombre.trim().toUpperCase(),
      categoria: categoria.trim(),
      vehiculoCompatibilidad: vehiculoCompatibilidad.trim() || 'Multimarca',
      stockActual: Math.max(0, parseInt(stockActual, 10) || 0),
      stockMinimo: Math.max(0, parseInt(stockMinimo, 10) || 2),
      costoUnitario: Math.max(0, parseFloat(costoUnitario) || 0),
      precioVenta: Math.max(0, parseFloat(precioVenta) || 0),
      totalInstalados: itemEnEdicion ? itemEnEdicion.totalInstalados : 0,
      ultimoMovimiento: itemEnEdicion?.ultimoMovimiento || getFechaHoyArgentina(),
    };

    try {
      await gasApi.saveStockItem(itemGuardado);
      const res = await gasApi.getStockItems();
      onStockUpdated(res.items);
      onShowToast(
        'success',
        itemEnEdicion ? 'Repuesto actualizado' : 'Repuesto registrado',
        `${itemGuardado.nombre} guardado correctamente.`
      );
      setShowModalItem(false);
    } catch (err: any) {
      onShowToast('error', 'Error al guardar', err.message || 'No se pudo guardar la pieza.');
    } finally {
      setGuardandoItem(false);
    }
  };

  // Guardar Compra
  const handleGuardarCompra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemParaCompra) return;
    const cant = parseInt(cantidadCompra, 10);
    if (!cant || cant <= 0) {
      onShowToast('warning', 'Cantidad inválida', 'Ingresá una cantidad mayor a 0.');
      return;
    }

    const montoTotal = parseFloat(costoTotalCompra) || 0;

    setGuardandoCompra(true);
    try {
      await gasApi.ingresarCompraStock({
        id: itemParaCompra.id,
        cantidad: cant,
        costoTotal: montoTotal,
        costoUnitario: cant > 0 && montoTotal > 0 ? Math.round(montoTotal / cant) : undefined,
        registrarEnContabilidad,
        metodoPago: metodoPagoCompra,
      });

      if (registrarEnContabilidad && montoTotal > 0 && onRegistrarGastoContabilidad) {
        onRegistrarGastoContabilidad(
          `Compra Stock: ${cant}x ${itemParaCompra.nombre}`,
          montoTotal,
          metodoPagoCompra
        );
      }

      const res = await gasApi.getStockItems();
      onStockUpdated(res.items);

      onShowToast(
        'success',
        '¡Stock ingresado con éxito!',
        `Se sumaron ${cant} unidades a ${itemParaCompra.nombre}.${
          registrarEnContabilidad && montoTotal > 0 ? ` Se registró el gasto de $${montoTotal.toLocaleString('es-AR')} en Contabilidad.` : ''
        }`
      );
      setShowModalCompra(false);
    } catch (err: any) {
      onShowToast('error', 'Error en la compra', err.message);
    } finally {
      setGuardandoCompra(false);
    }
  };

  // Eliminar
  const handleEliminarItem = async (item: ItemStock) => {
    if (!confirm(`¿Eliminar ${item.nombre} del catálogo de stock?`)) return;
    try {
      await gasApi.deleteStockItem(item.id);
      const res = await gasApi.getStockItems();
      onStockUpdated(res.items);
      onShowToast('info', 'Repuesto eliminado', `${item.nombre} quitado del stock.`);
    } catch (e) {
      onShowToast('error', 'Error al borrar', 'No se pudo eliminar el repuesto.');
    }
  };

  // Estadísticas y KPIs
  const totalItems = stockList.length;
  const totalUnidadesFisicas = stockList.reduce((acc, it) => acc + (Number(it.stockActual) || 0), 0);
  const totalInstaladasHistorico = stockList.reduce((acc, it) => acc + (Number(it.totalInstalados) || 0), 0);
  const itemsBajoStock = stockList.filter(
    (it) => it.stockActual <= it.stockMinimo && it.stockActual > 0
  ).length;

  // Radar de Rotación: Top 5 piezas más instaladas
  const topRotacion = [...stockList]
    .filter((it) => (it.totalInstalados || 0) > 0)
    .sort((a, b) => (b.totalInstalados || 0) - (a.totalInstalados || 0))
    .slice(0, 5);

  const maxInstalados = topRotacion[0]?.totalInstalados || 1;

  // Filtro de lista
  const filteredList = stockList.filter((it) => {
    const term = searchTerm.toLowerCase().trim();
    if (term) {
      const nom = String(it.nombre || '').toLowerCase();
      const comp = String(it.vehiculoCompatibilidad || '').toLowerCase();
      const cat = String(it.categoria || '').toLowerCase();
      if (!nom.includes(term) && !comp.includes(term) && !cat.includes(term)) {
        return false;
      }
    }

    if (filtroEstado === 'con_stock') return it.stockActual > 0;
    if (filtroEstado === 'bajo_stock') return it.stockActual > 0 && it.stockActual <= it.stockMinimo;
    if (filtroEstado === 'sin_stock') return it.stockActual === 0;

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#0a0a0a] border border-neutral-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-red-500 text-xs font-heading font-black uppercase tracking-widest">
            <Package className="w-4 h-4" />
            <span>Módulo Inteligente de Repuestos</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-heading font-black text-white uppercase tracking-tight mt-0.5">
            Stock & Rotación de Piezas
          </h2>
          <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
            Control de inventario físico en estantería y radar automático de piezas más cambiadas para compras mayoristas inteligentes.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={abrirModalNuevo}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-heading font-black text-xs uppercase tracking-wider shadow-lg shadow-red-600/30 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Nueva Pieza en Catálogo</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Unidades Físicas */}
        <div className="p-5 rounded-xl bg-neutral-900/90 border border-neutral-800 border-t-4 border-t-emerald-500 shadow-xl">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-heading font-bold uppercase tracking-wider">
            <span>Stock Físico Actual</span>
            <Package className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 font-mono text-2xl font-black text-emerald-400 tabular-nums">
            {totalUnidadesFisicas} <span className="text-sm font-normal text-neutral-400">unid.</span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">Repuestos disponibles en taller</p>
        </div>

        {/* Total Piezas Registradas */}
        <div className="p-5 rounded-xl bg-neutral-900/90 border border-neutral-800 border-t-4 border-t-blue-500 shadow-xl">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-heading font-bold uppercase tracking-wider">
            <span>Catálogo de Piezas</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3 font-mono text-2xl font-black text-white tabular-nums">
            {totalItems} <span className="text-sm font-normal text-neutral-400">ítems</span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">Variedades de repuestos</p>
        </div>

        {/* Total Instaladas en Presupuestos (Rotación) */}
        <div className="p-5 rounded-xl bg-neutral-900/90 border border-neutral-800 border-t-4 border-t-amber-500 shadow-xl">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-heading font-bold uppercase tracking-wider">
            <span>Rotación Histórica</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 font-mono text-2xl font-black text-amber-400 tabular-nums">
            {totalInstaladasHistorico} <span className="text-sm font-normal text-neutral-400">colocadas</span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">Piezas cambiadas en reparaciones</p>
        </div>

        {/* Alerta Bajo Stock */}
        <div className="p-5 rounded-xl bg-neutral-900/90 border border-neutral-800 border-t-4 border-t-rose-500 shadow-xl">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-heading font-bold uppercase tracking-wider">
            <span>Alertas de Reposición</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-3 font-mono text-2xl font-black text-rose-500 tabular-nums">
            {itemsBajoStock}
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">Piezas en stock crítico / mínimo</p>
        </div>
      </div>

      {/* RADAR DE ROTACIÓN: TOP DE REPUESTOS MÁS CAMBIADOS */}
      {topRotacion.length > 0 && (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-neutral-950 via-[#0d0d0d] to-neutral-950 border border-red-950/60 shadow-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="font-heading font-black text-white text-base uppercase tracking-tight">
                🔥 Radar de Mayor Rotación en el Taller
              </h3>
            </div>
            <span className="text-xs font-mono text-neutral-400 bg-neutral-900 px-3 py-1 rounded-full border border-neutral-800">
              Datos extraídos de presupuestos facturados
            </span>
          </div>

          <p className="text-xs text-neutral-300">
            Estas son las piezas que más cambiás en las reparaciones de tus clientes. Te sirve como guía para comprar cajas cerradas a precio mayorista:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            {topRotacion.map((item, idx) => {
              const porcentaje = Math.round((item.totalInstalados / maxInstalados) * 100);
              const medallas = ['🥇', '🥈', '🥉', '4°', '5°'];

              return (
                <div
                  key={item.id}
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
                        🚗 Compatibilidad: {item.vehiculoCompatibilidad || 'Multimarca'}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono text-base font-black text-amber-400">
                        {item.totalInstalados}
                      </span>
                      <span className="text-[10px] text-neutral-400 block uppercase font-bold">instalados</span>
                    </div>
                  </div>

                  {/* Barra de rotación */}
                  <div className="space-y-1">
                    <div className="w-full h-2 rounded-full bg-neutral-950 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 transition-all duration-500"
                        style={{ width: `${Math.max(10, porcentaje)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span className="text-neutral-400">
                      Stock en taller: <strong className={item.stockActual > 0 ? 'text-emerald-400 font-mono' : 'text-neutral-500 font-mono'}>{item.stockActual} unid.</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => abrirModalCompra(item)}
                      className="text-red-400 hover:text-red-300 font-heading font-bold text-xs uppercase flex items-center gap-1 cursor-pointer"
                    >
                      <span>Comprar Stock</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TABLA DE INVENTARIO FÍSICO */}
      <div className="p-6 rounded-2xl bg-[#0a0a0a] border border-neutral-800 shadow-xl space-y-4">
        {/* Controles de búsqueda y filtros */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <label htmlFor={searchInputId} className="sr-only">
              Buscar repuesto por nombre o vehículo
            </label>
            <Search className="w-4 h-4 text-neutral-500 absolute left-4 top-3.5" />
            <input
              id={searchInputId}
              type="text"
              placeholder="BUSCAR REPUESTO POR NOMBRE O MODELO DE AUTO..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-xl pl-11 pr-4 py-3 text-sm font-heading font-bold text-white placeholder-neutral-600 uppercase tracking-wider transition-colors shadow-inner"
            />
          </div>

          {/* Filtros de estado de stock */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-neutral-900 rounded-lg text-xs font-heading font-bold uppercase shrink-0">
            <button
              type="button"
              onClick={() => setFiltroEstado('todos')}
              className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                filtroEstado === 'todos' ? 'bg-red-600 text-white shadow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Todos ({stockList.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstado('con_stock')}
              className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                filtroEstado === 'con_stock' ? 'bg-emerald-600 text-white shadow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Con Stock
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstado('bajo_stock')}
              className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                filtroEstado === 'bajo_stock' ? 'bg-amber-600 text-white shadow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Poco Stock ({itemsBajoStock})
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstado('sin_stock')}
              className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                filtroEstado === 'sin_stock' ? 'bg-neutral-800 text-white shadow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              A Pedido / Cero
            </button>
          </div>
        </div>

        {/* Tabla */}
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
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-500">
                    <Package className="w-8 h-8 mx-auto mb-2 text-neutral-600" />
                    <span>No hay repuestos que coincidan con la búsqueda o filtro.</span>
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => {
                  const tieneStock = item.stockActual > 0;
                  const stockCritico = tieneStock && item.stockActual <= item.stockMinimo;
                  const margenUnitario = (item.precioVenta || 0) - (item.costoUnitario || 0);

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
                              : 'bg-neutral-800 text-neutral-400'
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
                            onClick={() => abrirModalCompra(item)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-300 font-heading font-bold text-[11px] uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
                            title="Ingresar compra de stock"
                          >
                            <ShoppingCart className="w-3 h-3" />
                            <span>+ Comprar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => abrirModalEditar(item)}
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                            title="Editar repuesto"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleEliminarItem(item)}
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

      {/* MODAL NUEVO / EDITAR REPUESTO */}
      {showModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-[#0d0d0d] border border-neutral-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-red-500" />
                <h3 className="font-heading font-black text-white text-base uppercase tracking-tight">
                  {itemEnEdicion ? 'Editar Repuesto' : 'Nuevo Repuesto en Catálogo'}
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

            <form onSubmit={handleGuardarItem} className="space-y-4">
              {/* Opciones rápidas de Tren Delantero */}
              {!itemEnEdicion && (
                <div>
                  <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                    ⚡ Selección Rápida de Tren Delantero
                  </label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) setNombre(e.target.value);
                    }}
                    className="w-full bg-neutral-950 border border-neutral-800 text-xs text-white rounded-lg px-3 py-2 font-medium"
                  >
                    <option value="">-- Elegir de la lista de piezas comunes --</option>
                    {REPUESTOS_TALLER_PIEZAS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Nombre de la pieza */}
              <div>
                <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                  Nombre de la Pieza / Repuesto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: EXTREMO DE DIRECCIÓN, BIELETA, RÓTULA..."
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-xs text-white uppercase font-bold"
                />
              </div>

              {/* Compatibilidad de vehículo */}
              <div>
                <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                  Vehículo o Compatibilidad
                </label>
                <input
                  type="text"
                  placeholder="Ej: Peugeot 208 / 207, Gol Trend, Toyota Hilux o Multimarca"
                  value={vehiculoCompatibilidad}
                  onChange={(e) => setVehiculoCompatibilidad(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              {/* Stock Actual y Stock Mínimo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                    Stock Actual en Taller
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stockActual}
                    onChange={(e) => setStockActual(e.target.value)}
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
                    value={stockMinimo}
                    onChange={(e) => setStockMinimo(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                  <p className="text-[10px] text-neutral-400 mt-0.5">Avisa cuando queden pocas</p>
                </div>
              </div>

              {/* Costo Unitario y Precio Venta */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                    Costo Compra Mayorista ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ej: 15000"
                    value={costoUnitario}
                    onChange={(e) => setCostoUnitario(e.target.value)}
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
                    value={precioVenta}
                    onChange={(e) => setPrecioVenta(e.target.value)}
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
                  <span>Guardar Repuesto</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL INGRESAR COMPRA DE STOCK (CONECTADO A CONTABILIDAD) */}
      {showModalCompra && itemParaCompra && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-[#0d0d0d] border-2 border-emerald-600/80 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-400" />
                <h3 className="font-heading font-black text-white text-base uppercase tracking-tight">
                  Ingresar Compra de Stock
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

            <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
              <span className="text-[10px] text-neutral-400 uppercase font-bold block">Repuesto a reponer:</span>
              <strong className="text-white font-heading text-sm uppercase">{itemParaCompra.nombre}</strong>
              <span className="text-[11px] text-neutral-400 block mt-0.5 font-mono">
                Stock actual en taller: {itemParaCompra.stockActual} unidades
              </span>
            </div>

            <form onSubmit={handleGuardarCompra} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                    Cantidad Comprada *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={cantidadCompra}
                    onChange={(e) => {
                      const c = e.target.value;
                      setCantidadCompra(c);
                      if (itemParaCompra.costoUnitario > 0 && c) {
                        setCostoTotalCompra(String(itemParaCompra.costoUnitario * parseInt(c, 10)));
                      }
                    }}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 focus:outline-none rounded-lg px-3 py-2 text-sm text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                    Costo Total ($) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="Monto abonado"
                    value={costoTotalCompra}
                    onChange={(e) => setCostoTotalCompra(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 focus:outline-none rounded-lg px-3 py-2 text-sm text-emerald-400 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                  Método de Pago
                </label>
                <select
                  value={metodoPagoCompra}
                  onChange={(e) => setMetodoPagoCompra(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 text-xs text-white rounded-lg px-3 py-2"
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                  <option value="Mercado Pago">Mercado Pago</option>
                  <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                </select>
              </div>

              {/* CONEXIÓN AUTOMÁTICA CON CONTABILIDAD */}
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/80 space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={registrarEnContabilidad}
                    onChange={(e) => setRegistrarEnContabilidad(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-neutral-900 border-neutral-700"
                  />
                  <span className="font-heading font-black text-xs uppercase text-emerald-300">
                    Impactar automáticamente en Caja & Contabilidad
                  </span>
                </label>
                <p className="text-[11px] text-neutral-400 pl-6">
                  Se creará un registro de <strong>GASTO</strong> bajo la categoría <em>&ldquo;Repuestos / Repuesteros&rdquo;</em> para llevar tu balance en tiempo real.
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
                  <span>Confirmar Ingreso a Stock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
