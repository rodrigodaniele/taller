export interface MarcaVehiculo {
  marca: string;
  modelos: string[];
}

export const VEHICULOS_POR_MARCA: MarcaVehiculo[] = [
  {
    marca: 'Toyota',
    modelos: [
      'Toyota Hilux (Todas las versiones)',
      'Toyota Hilux 4x2',
      'Toyota Hilux 4x4',
      'Toyota Corolla',
      'Toyota Corolla Cross',
      'Toyota Yaris',
      'Toyota Etios',
      'Toyota SW4',
      'Toyota RAV4',
    ],
  },
  {
    marca: 'Volkswagen',
    modelos: [
      'Volkswagen Amarok (Todas las versiones)',
      'Volkswagen Amarok V6 / 2.0 TDI',
      'Volkswagen Gol / Gol Trend',
      'Volkswagen Polo',
      'Volkswagen Suran',
      'Volkswagen Fox',
      'Volkswagen Saveiro',
      'Volkswagen Voyage',
      'Volkswagen Vento',
      'Volkswagen Bora',
      'Volkswagen Taos',
      'Volkswagen T-Cross',
      'Volkswagen Nivus',
      'Volkswagen Up!',
      'Volkswagen Tiguan',
    ],
  },
  {
    marca: 'Ford',
    modelos: [
      'Ford Ranger (Todas las versiones)',
      'Ford Ranger 4x2 / 4x4',
      'Ford EcoSport',
      'Ford Fiesta / Kinetic',
      'Ford Focus (I, II, III)',
      'Ford Ka / Ka+',
      'Ford F-100',
      'Ford F-150',
      'Ford Maverick',
      'Ford Territory',
      'Ford Kuga',
    ],
  },
  {
    marca: 'Chevrolet',
    modelos: [
      'Chevrolet S10',
      'Chevrolet Onix / Onix Plus',
      'Chevrolet Prisma',
      'Chevrolet Cruze',
      'Chevrolet Corsa / Classic',
      'Chevrolet Tracker',
      'Chevrolet Spin',
      'Chevrolet Aveo',
      'Chevrolet Celta / Agile',
      'Chevrolet Montana',
      'Chevrolet Trailblazer',
    ],
  },
  {
    marca: 'Renault',
    modelos: [
      'Renault Kangoo / Express',
      'Renault Sandero / Stepway',
      'Renault Duster 4x2 / 4x4',
      'Renault Logan',
      'Renault Clio / Mio',
      'Renault Alaskan',
      'Renault Oroch',
      'Renault Master',
      'Renault Captur',
      'Renault Fluence',
      'Renault Kwid',
    ],
  },
  {
    marca: 'Fiat',
    modelos: [
      'Fiat Cronos',
      'Fiat Toro',
      'Fiat Strada',
      'Fiat Fiorino',
      'Fiat Palio / Weekend / Adventure',
      'Fiat Siena / Grand Siena',
      'Fiat Uno / Fire / Way',
      'Fiat Mobi',
      'Fiat Pulse',
      'Fiat Fastback',
      'Fiat Argo',
      'Fiat Punto',
    ],
  },
  {
    marca: 'Peugeot',
    modelos: [
      'Peugeot 208',
      'Peugeot Partner / Furgón',
      'Peugeot 206',
      'Peugeot 207 Compact',
      'Peugeot 308',
      'Peugeot 408',
      'Peugeot 2008',
      'Peugeot 3008',
      'Peugeot Boxer',
    ],
  },
  {
    marca: 'Citroën',
    modelos: [
      'Citroën Berlingo / Multispace',
      'Citroën C3 / Aircross',
      'Citroën C4 Cactus',
      'Citroën C4 / C4 Lounge',
      'Citroën Jumpy',
    ],
  },
  {
    marca: 'Nissan',
    modelos: [
      'Nissan Frontier',
      'Nissan Kicks',
      'Nissan Versa',
      'Nissan Sentra',
      'Nissan March',
      'Nissan Tiida',
      'Nissan X-Trail',
    ],
  },
  {
    marca: 'Jeep & RAM',
    modelos: [
      'Jeep Renegade',
      'Jeep Compass',
      'Jeep Commander',
      'Jeep Grand Cherokee',
      'RAM 1500',
      'RAM Rampage',
    ],
  },
  {
    marca: 'Honda & Hyundai',
    modelos: [
      'Honda Civic',
      'Honda HR-V',
      'Honda Fit',
      'Honda CR-V',
      'Honda City',
      'Hyundai Tucson',
      'Hyundai Creta',
      'Hyundai HB20',
    ],
  },
  {
    marca: 'Otros Utilitarios & Comerciales',
    modelos: [
      'Mercedes-Benz Sprinter',
      'Iveco Daily',
    ],
  },
];

export const VEHICULOS_ARGENTINA: string[] = VEHICULOS_POR_MARCA.flatMap(
  (grupo) => grupo.modelos
);
