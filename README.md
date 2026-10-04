# La Casa de la Dirección - Web App & Taller Mecánico

Aplicación web integral para **La Casa de la Dirección** (General Alvear, Mendoza). Especialistas en **Alineación 3D computarizada**, **Balanceo Digital** y **Tren Delantero & Suspensión**.

Sistema conectado en tiempo real con **Google Sheets** (Base de Datos) vía **Google Apps Script** y pasarela de pago para señas con **Mercado Pago**.

---

## 🚀 Características Principales

- **Portal de Clientes**:
  - Consulta de servicios técnicos con imágenes y fichas detalladas.
  - Reserva de turnos online con control de horarios ocupados (evita domingos y citas en el mismo día).
  - Integración con Mercado Pago para abonar la seña requerida.
  - Ficha clínica histórica del vehículo: historial de trabajos realizados, kilómetros y montos.
- **Panel de Administración (Rodrigo Daniel Laset)**:
  - Detección automática de cuenta de administrador.
  - Buscador de turnos pendientes en tiempo real por patente o correo electrónico.
  - Selector de trabajos realizados con opciones predefinidas (AMORTIGUADOR, CAZOLETA, EXTREMO DE DIRECCIÓN, RULEMÁN DE MAZA, ALINEACIÓN Y BALANCEO, etc.) con selección múltiple.
  - **Módulo de Caja & Contabilidad**: Ingresos, Gastos (repuestos, luz, alquiler, insumos), Balance neto, y sincronización directa con la hoja `Contabilidad` de Google Sheets.
- **Canales de Atención**:
  - Enlace directo a WhatsApp oficial (+54 9 2625 532070).
  - Ubicación en Google Maps en General Alvear, Mendoza.

---

## 🛠️ Tecnologías Utilizadas

- **Frontend**: React 19, TypeScript, Vite.
- **Estilos**: Tailwind CSS v4, Lucide Icons, Tipografías *Chakra Petch* y *Plus Jakarta Sans*.
- **Backend / Database**: Google Apps Script (Web App) + Google Sheets (Hojas: `Usuarios`, `Turnos`, `Detalles_Turnos`, `Contabilidad`).
- **Pasarela de Cobro**: Mercado Pago Checkout Pro.

---

## 💻 Instalación y Desarrollo Local

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/TU-USUARIO/la-casa-de-la-direccion.git
   cd la-casa-de-la-direccion
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Iniciar el servidor de desarrollo:
   ```bash
   npm run dev
   ```

4. Generar el paquete de producción:
   ```bash
   npm run build
   ```

---

## 📁 Estructura del Proyecto

```
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── types.ts
│   ├── constants/
│   │   └── workshopItems.ts
│   ├── services/
│   │   └── gasApi.ts
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── Hero.tsx
│   │   ├── ServicesSection.tsx
│   │   ├── AboutSection.tsx
│   │   ├── ContactSection.tsx
│   │   ├── ClientDashboard.tsx
│   │   ├── AdminDashboard.tsx
│   │   ├── AuthModal.tsx
│   │   ├── Toast.tsx
│   │   └── Footer.tsx
│   └── assets/
│       └── images/
```
