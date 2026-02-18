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
  // Alla vatten
  { value: '99', label: '99 – Alla vatten', region: 'Generellt' },
  
  // Bottenviken / Norra Kvarken
  { value: '413', label: '413', region: 'Bottenviken' },
  { value: '414', label: '414', region: 'Bottenviken' },
  { value: '415', label: '415', region: 'Bottenviken' },
  
  // Bottenhavet
  { value: '51', label: '51', region: 'Bottenhavet' },
  { value: '511', label: '511', region: 'Bottenhavet' },
  { value: '512', label: '512', region: 'Bottenhavet' },
  { value: '513', label: '513', region: 'Bottenhavet' },
  { value: '514', label: '514', region: 'Bottenhavet' },
  
  // Stockholmsområdet
  { value: '6', label: '6', region: 'Stockholm' },
  { value: '61', label: '61', region: 'Stockholm' },
  { value: '611', label: '611', region: 'Stockholm' },
  { value: '612', label: '612', region: 'Stockholm' },
  { value: '613', label: '613', region: 'Stockholm' },
  { value: '614', label: '614', region: 'Stockholm' },
  { value: '6142', label: '6142', region: 'Stockholm' },
  { value: '6143', label: '6143', region: 'Stockholm' },
  { value: '6144', label: '6144', region: 'Stockholm' },
  { value: '6145', label: '6145', region: 'Stockholm' },
  { value: '615', label: '615', region: 'Stockholm' },
  { value: '616', label: '616', region: 'Stockholm' },
  { value: '6162', label: '6162', region: 'Stockholm' },
  { value: '6163', label: '6163', region: 'Stockholm' },
  { value: '617', label: '617', region: 'Stockholm' },
  { value: '6171', label: '6171', region: 'Stockholm' },
  { value: '6172', label: '6172', region: 'Stockholm' },
  { value: '6173', label: '6173', region: 'Stockholm' },
  { value: '618', label: '618', region: 'Stockholm' },
  { value: '619', label: '619', region: 'Stockholm' },
  
  // Mälaren
  { value: '62', label: '62', region: 'Mälaren' },
  { value: '621', label: '621', region: 'Mälaren' },
  { value: '6211', label: '6211', region: 'Mälaren' },
  { value: '6212', label: '6212', region: 'Mälaren' },
  { value: '622', label: '622', region: 'Mälaren' },
  { value: '623', label: '623', region: 'Mälaren' },
  { value: '6231', label: '6231', region: 'Mälaren' },
  { value: '624', label: '624', region: 'Mälaren' },
  
  // Norra Östersjön
  { value: '52', label: '52', region: 'Norra Östersjön' },
  { value: '521', label: '521', region: 'Norra Östersjön' },
  { value: '522', label: '522', region: 'Norra Östersjön' },
  { value: '523', label: '523', region: 'Norra Östersjön' },
  { value: '524', label: '524', region: 'Norra Östersjön' },
  { value: '525', label: '525', region: 'Norra Östersjön' },
  
  // Mellersta Östersjön (Gotland)
  { value: '53', label: '53', region: 'Mellersta Östersjön' },
  { value: '531', label: '531', region: 'Mellersta Östersjön' },
  { value: '532', label: '532', region: 'Mellersta Östersjön' },
  { value: '533', label: '533', region: 'Mellersta Östersjön' },
  { value: '5331', label: '5331', region: 'Mellersta Östersjön' },
  { value: '534', label: '534', region: 'Mellersta Östersjön' },
  { value: '5342', label: '5342', region: 'Mellersta Östersjön' },
  { value: '535', label: '535', region: 'Mellersta Östersjön' },
  { value: '536', label: '536', region: 'Mellersta Östersjön' },
  
  // Sydöstra / Södra Östersjön
  { value: '81', label: '81', region: 'Södra Östersjön' },
  { value: '83', label: '83', region: 'Södra Östersjön' },
  { value: '839', label: '839', region: 'Södra Östersjön' },

  // Kattegatt / Skagerrak
  { value: '91', label: '91', region: 'Kattegatt / Skagerrak' },
  { value: '92', label: '92', region: 'Kattegatt / Skagerrak' },
  { value: '921', label: '921', region: 'Kattegatt / Skagerrak' },
  { value: '9211', label: '9211', region: 'Kattegatt / Skagerrak' },
  { value: '922', label: '922', region: 'Kattegatt / Skagerrak' },
  { value: '9221', label: '9221', region: 'Kattegatt / Skagerrak' },
  { value: '923', label: '923', region: 'Kattegatt / Skagerrak' },
  { value: '924', label: '924', region: 'Kattegatt / Skagerrak' },
  { value: '925', label: '925', region: 'Kattegatt / Skagerrak' },
  { value: '93', label: '93', region: 'Kattegatt / Skagerrak' },
  { value: '931', label: '931', region: 'Kattegatt / Skagerrak' },
  { value: '9312', label: '9312', region: 'Kattegatt / Skagerrak' },
  { value: '9313', label: '9313', region: 'Kattegatt / Skagerrak' },
  { value: '932', label: '932', region: 'Kattegatt / Skagerrak' },
  { value: '9321', label: '9321', region: 'Kattegatt / Skagerrak' },
  { value: '933', label: '933', region: 'Kattegatt / Skagerrak' },
  { value: '9331', label: '9331', region: 'Kattegatt / Skagerrak' },
  { value: '934', label: '934', region: 'Kattegatt / Skagerrak' },
  { value: '937', label: '937', region: 'Kattegatt / Skagerrak' },
  
  // Västkusten
  { value: '71', label: '71', region: 'Västkusten' },
  { value: '711', label: '711', region: 'Västkusten' },
  { value: '712', label: '712', region: 'Västkusten' },
  { value: '713', label: '713', region: 'Västkusten' },
  { value: '714', label: '714', region: 'Västkusten' },
  { value: '731', label: '731', region: 'Västkusten' },
  { value: '741', label: '741', region: 'Västkusten' },
  { value: '7411', label: '7411', region: 'Västkusten' },
  { value: '7413', label: '7413', region: 'Västkusten' },
  { value: '742', label: '742', region: 'Västkusten' },
  { value: '7421', label: '7421', region: 'Västkusten' },
  { value: '743', label: '743', region: 'Västkusten' },
  
  // Vänern
  { value: '10', label: '10', region: 'Vänern' },
  { value: '111', label: '111', region: 'Vänern' },
  { value: '112', label: '112', region: 'Vänern' },
  { value: '113', label: '113', region: 'Vänern' },
  { value: '1131', label: '1131', region: 'Vänern' },
  { value: '1133', label: '1133', region: 'Vänern' },
  { value: '114', label: '114', region: 'Vänern' },
  
  // Övriga
  { value: '121', label: '121', region: 'Trollhätte kanal' },
  { value: '13', label: '13', region: 'Göta kanal' },
  { value: '131', label: '131', region: 'Göta kanal' },
  { value: '132', label: '132', region: 'Göta kanal' },
  { value: '133', label: '133', region: 'Göta kanal' },
  { value: '1331', label: '1331', region: 'Göta kanal' },
  { value: '134', label: '134', region: 'Göta kanal' },
  { value: '135', label: '135', region: 'Göta kanal' },
  { value: '1352', label: '1352', region: 'Göta kanal' },
  { value: '1353', label: '1353', region: 'Göta kanal' },

  // Ostkusten
  { value: '24', label: '24', region: 'Ostkusten' },
  { value: '41', label: '41', region: 'Ostkusten' },
  { value: '410', label: '410', region: 'Ostkusten' },
  { value: '411', label: '411', region: 'Ostkusten' },
  { value: '412', label: '412', region: 'Ostkusten' },
  { value: '4141', label: '4141', region: 'Ostkusten' },
  { value: 'S415', label: 'S415', region: 'Ostkusten' },
  { value: '42', label: '42', region: 'Ostkusten' },
  { value: '421', label: '421', region: 'Ostkusten' },
  { value: '4211', label: '4211', region: 'Ostkusten' },
  { value: '422', label: '422', region: 'Ostkusten' },
  { value: '4295', label: '4295', region: 'Ostkusten' },
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
