const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WindData {
  stationName: string;
  gustSpeed: string;
  averageSpeed: string;
  direction: string;
  timestamp: string;
}

// SMHI Parameter IDs
const PARAM_WIND_SPEED = 4;      // Vindhastighet (momentan)
const PARAM_WIND_DIRECTION = 3;  // Vindriktning (momentan)  
const PARAM_WIND_GUST = 21;      // Vindby (max under senaste timmen)

// Stockholm-Bromma station ID for SMHI
const DEFAULT_SMHI_STATION = '97400'; // Stockholm-Bromma flygplats

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stationId = DEFAULT_SMHI_STATION } = await req.json().catch(() => ({}));
    
    console.log(`Fetching wind data from SMHI for station: ${stationId}`);

    // Fetch wind speed, direction, and gust in parallel
    const baseUrl = 'https://opendata-download-metobs.smhi.se/api/version/1.0';
    
    const [speedRes, dirRes, gustRes] = await Promise.all([
      fetch(`${baseUrl}/parameter/${PARAM_WIND_SPEED}/station/${stationId}/period/latest-hour/data.json`),
      fetch(`${baseUrl}/parameter/${PARAM_WIND_DIRECTION}/station/${stationId}/period/latest-hour/data.json`),
      fetch(`${baseUrl}/parameter/${PARAM_WIND_GUST}/station/${stationId}/period/latest-hour/data.json`),
    ]);

    let avgSpeed = 'Ej tillgänglig';
    let direction = 'Ej tillgänglig';
    let gustSpeed = 'Ej tillgänglig';
    let timestamp = new Date().toLocaleTimeString('sv-SE');
    let stationName = `Station ${stationId}`;

    // Parse wind speed
    if (speedRes.ok) {
      const speedData = await speedRes.json();
      stationName = speedData.station?.name || stationName;
      const values = speedData.value || [];
      if (values.length > 0) {
        const latest = values[values.length - 1];
        avgSpeed = `${latest.value} m/s`;
        if (latest.date) {
          timestamp = new Date(latest.date).toLocaleTimeString('sv-SE');
        }
      }
    } else {
      console.log(`Wind speed fetch failed: ${speedRes.status}`);
    }

    // Parse wind direction
    if (dirRes.ok) {
      const dirData = await dirRes.json();
      const values = dirData.value || [];
      if (values.length > 0) {
        const latest = values[values.length - 1];
        const degrees = parseFloat(latest.value);
        if (!isNaN(degrees)) {
          const compassDir = degreesToCompass(degrees);
          direction = `${compassDir} ${Math.round(degrees)}°`;
        }
      }
    } else {
      console.log(`Wind direction fetch failed: ${dirRes.status}`);
    }

    // Parse wind gust
    if (gustRes.ok) {
      const gustData = await gustRes.json();
      const values = gustData.value || [];
      if (values.length > 0) {
        const latest = values[values.length - 1];
        gustSpeed = `${latest.value} m/s`;
      }
    } else {
      console.log(`Wind gust fetch failed: ${gustRes.status}`);
    }

    const windData: WindData = {
      stationName,
      gustSpeed,
      averageSpeed: avgSpeed,
      direction,
      timestamp,
    };

    console.log('Parsed wind data:', windData);

    return new Response(
      JSON.stringify({ success: true, data: windData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching wind data:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch wind data' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function degreesToCompass(degrees: number): string {
  const directions = ['N', 'NO', 'O', 'SO', 'S', 'SV', 'V', 'NV'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}
