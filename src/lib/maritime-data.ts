/**
 * Predefined weather stations from Sjöfartsverket ViVa
 * Each entry has id, name, and SMHI forecast coordinates
 */
export interface WeatherStation {
  id: string;
  name: string;
  lon: number;
  lat: number;
}

export const WEATHER_STATIONS: WeatherStation[] = [
  { id: '141', name: 'Stockholm', lon: 18.0686, lat: 59.3293 },
  { id: '105', name: 'Gothenburg (Göteborg)', lon: 11.9746, lat: 57.7089 },
  { id: '130', name: 'Malmö', lon: 13.0038, lat: 55.6050 },
  { id: '143', name: 'Landsort', lon: 17.8600, lat: 58.7400 },
  { id: '142', name: 'Sandhamn', lon: 18.9159, lat: 59.2844 },
  { id: '116', name: 'Vinga', lon: 11.6050, lat: 57.6320 },
  { id: '115', name: 'Väderöarna', lon: 11.3290, lat: 58.5690 },
  { id: '144', name: 'Hävringe', lon: 17.2960, lat: 58.5990 },
  { id: '146', name: 'Ölands norra udde', lon: 17.0970, lat: 57.3660 },
  { id: '148', name: 'Utklippan', lon: 15.7130, lat: 55.9530 },
  { id: '150', name: 'Falsterbo', lon: 12.8260, lat: 55.3830 },
  { id: '152', name: 'Hallands Väderö', lon: 12.5630, lat: 56.4440 },
  { id: '113', name: 'Skagen', lon: 10.5870, lat: 57.7260 },
  { id: '109', name: 'Marstrand', lon: 11.5810, lat: 57.8870 },
  { id: '158', name: 'Svenska Högarna', lon: 19.5060, lat: 59.4430 },
  { id: '160', name: 'Söderarm', lon: 19.4030, lat: 59.7540 },
  { id: '161', name: 'Grundkallen', lon: 18.9100, lat: 60.2890 },
  { id: '163', name: 'Finngrundet', lon: 18.5820, lat: 60.9080 },
  { id: '165', name: 'Holmön', lon: 20.8660, lat: 63.7950 },
  { id: '167', name: 'Bjuröklubb', lon: 21.5750, lat: 64.4780 },
  { id: '169', name: 'Ratan', lon: 20.8950, lat: 64.0010 },
  { id: '171', name: 'Brämön', lon: 17.6640, lat: 62.3250 },
  { id: '155', name: 'Gotska Sandön', lon: 19.2010, lat: 58.3350 },
  { id: '156', name: 'Visby', lon: 18.2840, lat: 57.6390 },
  { id: '154', name: 'Hoburg', lon: 18.1490, lat: 56.9210 },
  { id: '100', name: 'Trollhättan (Vänern)', lon: 12.2880, lat: 58.2840 },
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
