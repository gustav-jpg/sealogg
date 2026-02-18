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
  source: string;
}

const DEFAULT_SMHI_STATION = '98040';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stationId = DEFAULT_SMHI_STATION } = await req.json().catch(() => ({}));
    
    console.log(`Fetching wind data from SMHI for station: ${stationId}`);

    const result = await fetchFromSMHI(stationId);
    return new Response(
      JSON.stringify({ success: true, data: result }),
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

async function fetchFromSMHI(stationId: string): Promise<WindData> {
  const PARAM_WIND_SPEED = 4;
  const PARAM_WIND_DIRECTION = 3;
  const PARAM_WIND_GUST = 21;
  
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
  let stationName = `SMHI Station ${stationId}`;

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
  }

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
  }

  if (gustRes.ok) {
    const gustData = await gustRes.json();
    const values = gustData.value || [];
    if (values.length > 0) {
      const latest = values[values.length - 1];
      gustSpeed = `${latest.value} m/s`;
    }
  }

  return {
    stationName,
    gustSpeed,
    averageSpeed: avgSpeed,
    direction,
    timestamp,
    source: 'SMHI',
  };
}

function degreesToCompass(degrees: number): string {
  const directions = ['N', 'NO', 'O', 'SO', 'S', 'SV', 'V', 'NV'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}
