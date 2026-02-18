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

// Default station - Blockhusudden
const DEFAULT_VIVA_STATION = '141';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stationId = DEFAULT_VIVA_STATION, source = 'viva' } = await req.json().catch(() => ({}));
    
    console.log(`Fetching wind data from ${source} for station: ${stationId}`);

    // Try ViVa first
    if (source === 'viva') {
      const vivaResult = await fetchFromViVa(stationId);
      if (vivaResult) {
        return new Response(
          JSON.stringify({ success: true, data: vivaResult }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('ViVa failed, falling back to SMHI...');
    }

    // Fallback to SMHI
    const smhiResult = await fetchFromSMHI(stationId === DEFAULT_VIVA_STATION ? '98040' : stationId);
    return new Response(
      JSON.stringify({ success: true, data: smhiResult }),
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

async function fetchFromViVa(stationId: string): Promise<WindData | null> {
  try {
    const url = `https://services.viva.sjofartsverket.se:8080/output/vivaoutputservice.svc/vivastation/${stationId}`;
    console.log('Trying ViVa URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.log(`ViVa response not OK: ${response.status}`);
      return null;
    }

    const text = await response.text();
    console.log('ViVa response (first 500 chars):', text.substring(0, 500));

    // Check if it's HTML (error page)
    if (text.trim().startsWith('<!') || text.trim().startsWith('<html')) {
      console.log('ViVa returned HTML, not JSON');
      return null;
    }

    const data = JSON.parse(text);
    const stationData = data.GetSingleStationResult || data;
    
    let avgSpeed = 'Ej tillgänglig';
    let gustSpeed = 'Ej tillgänglig';
    let direction = 'Ej tillgänglig';
    let timestamp = new Date().toLocaleTimeString('sv-SE');
    const stationName = stationData.Name || `ViVa Station ${stationId}`;

    // Parse samples
    const samples = stationData.Samples || [];
    for (const sample of samples) {
      const name = (sample.Name || '').toLowerCase();
      const value = sample.Value;

      if (name === 'medelvind') {
        if (value) {
          // Value format: "NV 3.2 m/s" or similar
          const parts = value.split(' ');
          if (parts.length >= 2) {
            const numPart = parts.find((p: string) => !isNaN(parseFloat(p)));
            avgSpeed = numPart ? `${numPart} m/s` : value;
            // Extract direction from value string
            const dirPart = parts[0];
            if (isNaN(parseFloat(dirPart))) {
              const heading = sample.Heading;
              direction = heading !== undefined ? `${dirPart} ${Math.round(heading)}°` : dirPart;
            }
          } else {
            avgSpeed = value;
          }
        }
      }

      if (name === 'byvind') {
        if (value) {
          const parts = value.split(' ');
          const numPart = parts.find((p: string) => !isNaN(parseFloat(p)));
          gustSpeed = numPart ? `${numPart} m/s` : value;
        }
      }

      if (name === 'vindriktning' || name === 'riktning') {
        if (value) {
          const degrees = parseFloat(value);
          if (!isNaN(degrees)) {
            const compassDir = degreesToCompass(degrees);
            direction = `${compassDir} ${Math.round(degrees)}°`;
          }
        }
      }

      if (sample.Updated || sample.Time) {
        const updated = new Date(sample.Updated || sample.Time);
        if (!isNaN(updated.getTime())) {
          timestamp = updated.toLocaleTimeString('sv-SE');
        }
      }
    }

    return {
      stationName,
      gustSpeed,
      averageSpeed: avgSpeed,
      direction,
      timestamp,
      source: 'Sjöfartsverket ViVa',
    };
  } catch (error) {
    console.error('ViVa fetch error:', error);
    return null;
  }
}

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
