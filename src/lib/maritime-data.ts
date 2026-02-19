/**
 * Predefined SMHI weather stations for wind data
 * Each entry has SMHI station id, name, and forecast coordinates
 */
export interface WeatherStation {
  id: string;
  name: string;
  lon: number;
  lat: number;
}

export const WEATHER_STATIONS: WeatherStation[] = [
  // Verified active SMHI Metobs stations with wind data (parameter 4)
  { id: '99450', name: 'Söderarm A', lon: 19.2058, lat: 59.7547 },
  { id: '98040', name: 'Berga', lon: 18.0842, lat: 59.3308 },
  { id: '87440', name: 'Landsort A', lon: 17.8658, lat: 58.7408 },
  { id: '97400', name: 'Gotska Sandön A', lon: 19.1994, lat: 58.3947 },
  { id: '99280', name: 'Hoburg A', lon: 18.1492, lat: 56.9208 },
  { id: '77210', name: 'Ölands norra udde A', lon: 17.0972, lat: 57.3667 },
  { id: '65090', name: 'Karlskrona-Söderstjerna', lon: 15.5861, lat: 56.1050 },
  { id: '89230', name: 'Falsterbo A', lon: 12.8167, lat: 55.3833 },
  { id: '86340', name: 'Malmö A', lon: 13.0672, lat: 55.5714 },
  { id: '78400', name: 'Visby Flygplats', lon: 18.3461, lat: 57.6628 },
  { id: '71380', name: 'Vinga A', lon: 11.6058, lat: 57.6328 },
  { id: '76420', name: 'Gladhammar A', lon: 16.3964, lat: 57.3611 },
  { id: '107440', name: 'Eggegrund A', lon: 17.5342, lat: 60.7300 },
  { id: '140460', name: 'Holmön A', lon: 20.8625, lat: 63.7939 },
  { id: '140480', name: 'Umeå Flygplats', lon: 20.2353, lat: 63.7917 },
  { id: '83420', name: 'Naven A (Vänern)', lon: 13.1084, lat: 58.6994 },
];

/**
 * UFS Chart numbers from Sjöfartsverket
 * Grouped by region for easier selection
 */
export interface UFSChart {
  value: string;
  label: string;
  region?: string;
}

export const UFS_CHARTS: UFSChart[] = [
  // Bottenviken / Norra Kvarken / Ostkusten
  { value: '2331', label: '41', region: 'Bottenviken' },
  { value: '63', label: '4101', region: 'Bottenviken' },
  { value: '64', label: '411', region: 'Bottenviken' },
  { value: '65', label: '412', region: 'Bottenviken' },
  { value: '66', label: '413', region: 'Bottenviken' },
  { value: '67', label: '414', region: 'Bottenviken' },
  { value: '68', label: '414S', region: 'Bottenviken' },
  { value: '69', label: '415', region: 'Bottenviken' },
  { value: '70', label: '4151', region: 'Bottenviken' },
  { value: '2332', label: '42', region: 'Bottenviken' },
  { value: '72', label: '421', region: 'Bottenviken' },
  { value: '73', label: '4211', region: 'Bottenviken' },
  { value: '74', label: '422', region: 'Bottenviken' },
  { value: '4062', label: '429', region: 'Bottenviken' },

  // Bottenhavet
  { value: '75', label: '5', region: 'Bottenhavet' },
  { value: '77', label: '511', region: 'Bottenhavet' },
  { value: '78', label: '512', region: 'Bottenhavet' },
  { value: '79', label: '5121', region: 'Bottenhavet' },
  { value: '80', label: '513', region: 'Bottenhavet' },
  { value: '81', label: '514', region: 'Bottenhavet' },

  // Norra Östersjön
  { value: '83', label: '52', region: 'Norra Östersjön' },
  { value: '84', label: '522', region: 'Norra Östersjön' },
  { value: '85', label: '523', region: 'Norra Östersjön' },
  { value: '86', label: '524', region: 'Norra Östersjön' },
  { value: '87', label: '525', region: 'Norra Östersjön' },

  // Mellersta Östersjön (Gotland)
  { value: '88', label: '53', region: 'Mellersta Östersjön' },
  { value: '89', label: '532', region: 'Mellersta Östersjön' },
  { value: '90', label: '533', region: 'Mellersta Östersjön' },
  { value: '91', label: '5331', region: 'Mellersta Östersjön' },
  { value: '92', label: '534', region: 'Mellersta Östersjön' },
  { value: '4976', label: '5342', region: 'Mellersta Östersjön' },
  { value: '94', label: '535', region: 'Mellersta Östersjön' },
  { value: '95', label: '536', region: 'Mellersta Östersjön' },

  // Stockholmsområdet
  { value: '3370', label: '6', region: 'Stockholm' },
  { value: '683', label: '61', region: 'Stockholm' },
  { value: '98', label: '611', region: 'Stockholm' },
  { value: '99', label: '612', region: 'Stockholm' },
  { value: '100', label: '613', region: 'Stockholm' },
  { value: '101', label: '6141', region: 'Stockholm' },
  { value: '102', label: '6142', region: 'Stockholm' },
  { value: '103', label: '6143', region: 'Stockholm' },
  { value: '104', label: '6144', region: 'Stockholm' },
  { value: '105', label: '6145', region: 'Stockholm' },
  { value: '106', label: '615', region: 'Stockholm' },
  { value: '107', label: '616', region: 'Stockholm' },
  { value: '2792', label: '6162', region: 'Stockholm' },
  { value: '2793', label: '6163', region: 'Stockholm' },
  { value: '109', label: '617', region: 'Stockholm' },
  { value: '110', label: '6171', region: 'Stockholm' },
  { value: '111', label: '6172', region: 'Stockholm' },
  { value: '112', label: '6173', region: 'Stockholm' },
  { value: '113', label: '6181', region: 'Stockholm' },
  { value: '4030', label: '619', region: 'Stockholm' },

  // Mälaren
  { value: '4275', label: '62', region: 'Mälaren' },
  { value: '114', label: '621', region: 'Mälaren' },
  { value: '115', label: '6211', region: 'Mälaren' },
  { value: '116', label: '6212', region: 'Mälaren' },
  { value: '117', label: '622', region: 'Mälaren' },
  { value: '118', label: '623', region: 'Mälaren' },
  { value: '119', label: '6231', region: 'Mälaren' },
  { value: '120', label: '624', region: 'Mälaren' },
  { value: '121', label: '6241', region: 'Mälaren' },

  // Västkusten
  { value: '3446', label: '7', region: 'Västkusten' },
  { value: '4276', label: '71', region: 'Västkusten' },
  { value: '124', label: '711', region: 'Västkusten' },
  { value: '125', label: '712', region: 'Västkusten' },
  { value: '126', label: '713', region: 'Västkusten' },
  { value: '2661', label: '714', region: 'Västkusten' },
  { value: '130', label: '731', region: 'Västkusten' },
  { value: '4610', label: '741', region: 'Västkusten' },
  { value: '4031', label: '7411', region: 'Västkusten' },
  { value: '4056', label: '7413', region: 'Västkusten' },
  { value: '4609', label: '742', region: 'Västkusten' },
  { value: '4870', label: '7421', region: 'Västkusten' },
  { value: '4608', label: '743', region: 'Västkusten' },

  // Sydöstra / Södra Östersjön
  { value: '3650', label: '8', region: 'Södra Östersjön' },
  { value: '133', label: '8141', region: 'Södra Östersjön' },
  { value: '5006', label: '83', region: 'Södra Östersjön' },
  { value: '141', label: '839', region: 'Södra Östersjön' },

  // Kattegatt / Skagerrak
  { value: '5350', label: '91', region: 'Kattegatt / Skagerrak' },
  { value: '143', label: '92', region: 'Kattegatt / Skagerrak' },
  { value: '144', label: '921', region: 'Kattegatt / Skagerrak' },
  { value: '145', label: '9211', region: 'Kattegatt / Skagerrak' },
  { value: '146', label: '922', region: 'Kattegatt / Skagerrak' },
  { value: '147', label: '9221', region: 'Kattegatt / Skagerrak' },
  { value: '148', label: '923', region: 'Kattegatt / Skagerrak' },
  { value: '149', label: '924', region: 'Kattegatt / Skagerrak' },
  { value: '150', label: '925', region: 'Kattegatt / Skagerrak' },
  { value: '152', label: '93', region: 'Kattegatt / Skagerrak' },
  { value: '153', label: '931', region: 'Kattegatt / Skagerrak' },
  { value: '154', label: '9312', region: 'Kattegatt / Skagerrak' },
  { value: '155', label: '9313', region: 'Kattegatt / Skagerrak' },
  { value: '156', label: '932', region: 'Kattegatt / Skagerrak' },
  { value: '157', label: '9321', region: 'Kattegatt / Skagerrak' },
  { value: '158', label: '933', region: 'Kattegatt / Skagerrak' },
  { value: '159', label: '9331', region: 'Kattegatt / Skagerrak' },
  { value: '160', label: '934', region: 'Kattegatt / Skagerrak' },
  { value: '4050', label: '937', region: 'Kattegatt / Skagerrak' },

  // Vänern
  { value: '40', label: '13', region: 'Vänern' },
  { value: '41', label: '131', region: 'Vänern' },
  { value: '42', label: '132', region: 'Vänern' },
  { value: '43', label: '133', region: 'Vänern' },
  { value: '44', label: '1331', region: 'Vänern' },
  { value: '45', label: '134', region: 'Vänern' },
  { value: '46', label: '135', region: 'Vänern' },

  // Mälaren / Hjälmaren
  { value: '4735', label: '10', region: 'Mälaren' },
  { value: '3', label: '111', region: 'Mälaren' },
  { value: '4', label: '112', region: 'Mälaren' },
  { value: '5', label: '113', region: 'Mälaren' },
  { value: '6', label: '1131', region: 'Mälaren' },
  { value: '3839', label: '1133', region: 'Mälaren' },
  { value: '23', label: '114', region: 'Mälaren' },

  // Övriga
  { value: '24', label: '121', region: 'Vättern' },
  { value: '3781', label: '1352', region: 'Trollhätte kanal' },
  { value: '3782', label: '1353', region: 'Trollhätte kanal' },

  // Övriga generella
  { value: '3649', label: '2', region: 'Generellt' },
  { value: '4603', label: '4', region: 'Generellt' },
];

/**
 * Group UFS charts by region for display
 */
export function getUFSChartsByRegion(): Record<string, UFSChart[]> {
  const grouped: Record<string, UFSChart[]> = {};
  for (const chart of UFS_CHARTS) {
    const region = chart.region || 'Övrigt';
    if (!grouped[region]) grouped[region] = [];
    grouped[region].push(chart);
  }
  return grouped;
}
