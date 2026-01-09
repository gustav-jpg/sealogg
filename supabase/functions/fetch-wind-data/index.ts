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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stationId = '141' } = await req.json().catch(() => ({}));
    
    console.log(`Fetching wind data for station: ${stationId}`);

    // Fetch the station page to scrape data
    const response = await fetch(`https://viva.sjofartsverket.se/station/${stationId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch station data: ${response.status}`);
    }

    const html = await response.text();
    
    // Parse the HTML to extract wind data
    // The page structure contains values like "12.1 m/s" for wind speeds
    
    // Extract gust speed (Byvind)
    const gustMatch = html.match(/(\d+\.?\d*)\s*m\/s\s*<\/div>\s*<div[^>]*>\s*Byvind/i) ||
                      html.match(/>(\d+\.?\d*)\s*m\/s<[^>]*>[^<]*Byvind/i);
    
    // Extract average wind (Medelvind)  
    const avgMatch = html.match(/(\d+\.?\d*)\s*m\/s\s*<\/div>\s*<div[^>]*>\s*Medelvind/i) ||
                     html.match(/>(\d+\.?\d*)\s*m\/s<[^>]*>[^<]*Medelvind/i);
    
    // Extract wind direction
    const dirMatch = html.match(/([NSOVÖ]{1,2})\s*(\d+)°\s*<\/div>\s*<div[^>]*>\s*Vind/i) ||
                     html.match(/>([NSOVÖ]{1,2})\s*(\d+)°<[^>]*>[^<]*Vind/i);

    // Extract station name
    const nameMatch = html.match(/<title>([^<]+)<\/title>/i) ||
                      html.match(/<h1[^>]*>([^<]+)<\/h1>/i);

    // Extract timestamp
    const timeMatch = html.match(/(\d{2}:\d{2}:\d{2})/);

    // Alternative parsing - look for the data in script tags or JSON
    let gustSpeed = gustMatch ? gustMatch[1] : null;
    let avgSpeed = avgMatch ? avgMatch[1] : null;
    let direction = dirMatch ? `${dirMatch[1]} ${dirMatch[2]}°` : null;

    // If regex didn't work, try to find values near keywords
    if (!gustSpeed || !avgSpeed) {
      // Look for patterns like "12.1 m/s" followed by "Byvind"
      const windPattern = /(\d+\.?\d*)\s*m\/s/g;
      const speeds: string[] = [];
      let match;
      while ((match = windPattern.exec(html)) !== null) {
        speeds.push(match[1]);
      }
      
      // Usually the first two are gust and average
      if (speeds.length >= 2) {
        gustSpeed = gustSpeed || speeds[0];
        avgSpeed = avgSpeed || speeds[1];
      }
    }

    if (!direction) {
      // Look for direction pattern
      const dirPattern = /([NSOVÖ]{1,2})\s*(\d+)°/g;
      const dirMatch2 = dirPattern.exec(html);
      if (dirMatch2) {
        direction = `${dirMatch2[1]} ${dirMatch2[2]}°`;
      }
    }

    const windData: WindData = {
      stationName: nameMatch ? nameMatch[1].replace(' - ViVa', '').trim() : `Station ${stationId}`,
      gustSpeed: gustSpeed ? `${gustSpeed} m/s` : 'Ej tillgänglig',
      averageSpeed: avgSpeed ? `${avgSpeed} m/s` : 'Ej tillgänglig',
      direction: direction || 'Ej tillgänglig',
      timestamp: timeMatch ? timeMatch[1] : new Date().toLocaleTimeString('sv-SE'),
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
