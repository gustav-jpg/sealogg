const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UFSWarning {
  noticeNumber: string;
  chartNumber: string;
  publishedDate: string;
  headline: string;
  isTemporary: boolean;
  isPreliminary: boolean;
  url: string;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&aring;/gi, 'å')
    .replace(/&auml;/gi, 'ä')
    .replace(/&ouml;/gi, 'ö')
    .replace(/&Aring;/g, 'Å')
    .replace(/&Auml;/g, 'Ä')
    .replace(/&Ouml;/g, 'Ö')
    .replace(/&nbsp;/g, ' ');
}

function cleanText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 10, chartNumbers = '99' } = await req.json().catch(() => ({ limit: 10, chartNumbers: '99' }));
    
    // chartNumbers can be comma-separated string like "99,612,6" or array
    const chartNumStr = Array.isArray(chartNumbers) ? chartNumbers.join(',') : chartNumbers;
    
    console.log(`Fetching UFS warnings for charts: ${chartNumStr}, limit: ${limit}`);
    
    // Sjöfartsverket expects separate query params for each chart number (multi-select)
    const chartParams = chartNumStr.split(',').map(c => `SearchFormModel.ChartNumbers=${encodeURIComponent(c.trim())}`).join('&');
    
    const response = await fetch(
      `https://ufs.sjofartsverket.se/Notice/Search/?${chartParams}&SearchFormModel.SearchTimePeriod=0`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
        },
      }
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('utf-8');
    const html = decoder.decode(buffer);
    
    const warnings: UFSWarning[] = [];
    
    const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch) {
      console.log('No tbody found');
      return new Response(JSON.stringify({ success: true, data: [] }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } });
    }
    
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    
    while ((rowMatch = rowRegex.exec(tbodyMatch[1])) !== null && warnings.length < limit) {
      const rowHtml = rowMatch[1];
      
      const thMatch = rowHtml.match(/<th[^>]*>[\s\S]*?<a\s+href=["']([^"']+)["'][^>]*>(\d+)<\/a>[\s\S]*?<\/th>/i);
      if (!thMatch) continue;
      
      const url = `https://ufs.sjofartsverket.se${thMatch[1]}`;
      const notisNr = thMatch[2];
      
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells: string[] = [];
      let tdMatch;
      while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
        cells.push(cleanText(tdMatch[1]));
      }
      
      if (cells.length >= 3) {
        const chartInfo = cells[0] || '';
        const publishedDate = cells[1] || '';
        const headline = cells[2] || '';
        
        const chartNumberMatch = chartInfo.match(/^(\d+)/);
        const chartNumber = chartNumberMatch ? chartNumberMatch[1] : chartInfo;
        
        const isTemporary = chartInfo.includes('(T)');
        const isPreliminary = chartInfo.includes('(P)');
        
        warnings.push({
          noticeNumber: notisNr,
          chartNumber,
          publishedDate,
          headline,
          isTemporary,
          isPreliminary,
          url,
        });
      }
    }

    console.log('Total warnings found:', warnings.length);

    return new Response(JSON.stringify({ success: true, data: warnings }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } });
  }
});
