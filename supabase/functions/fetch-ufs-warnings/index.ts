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
    .replace(/&quot;/g, '"');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 10 } = await req.json().catch(() => ({ limit: 10 }));
    
    const response = await fetch(
      'https://ufs.sjofartsverket.se/Notice/Search/?SearchFormModel.ChartNumbers=99&SearchFormModel.SearchTimePeriod=0',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
      }
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const warnings: UFSWarning[] = [];
    
    const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch) {
      return new Response(JSON.stringify({ success: true, data: [] }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    
    while ((rowMatch = rowRegex.exec(tbodyMatch[1])) !== null && warnings.length < limit) {
      const rowHtml = rowMatch[1];
      const hrefMatch = rowHtml.match(/href=["']([^"']+)["']/i);
      
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells: string[] = [];
      let tdMatch;
      while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
        cells.push(decodeHtmlEntities(tdMatch[1].replace(/<[^>]+>/g, '').trim()));
      }
      
      // cells[0]=NotisNr, cells[1]=Sjökort, cells[2]=Publicerat, cells[3]=Rubrik
      if (cells.length >= 4 && /^\d/.test(cells[0])) {
        const noticeCell = cells[0];
        const noticeNumber = noticeCell.replace(/[^0-9]/g, '');
        
        warnings.push({
          noticeNumber: noticeCell.replace(/\s+/g, ' ').trim(),
          chartNumber: cells[1] || '',
          publishedDate: cells[2] || '',
          headline: cells[3] || '',
          isTemporary: noticeCell.includes('(T)'),
          isPreliminary: noticeCell.includes('(P)'),
          url: hrefMatch ? `https://ufs.sjofartsverket.se${hrefMatch[1]}` : `https://ufs.sjofartsverket.se/Notice/Details/${noticeNumber}`,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, data: warnings }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
