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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 10 } = await req.json().catch(() => ({ limit: 10 }));

    console.log('Fetching UFS warnings from Sjöfartsverket...');
    
    const response = await fetch(
      'https://ufs.sjofartsverket.se/Notice/Search/?SearchFormModel.ChartNumbers=99&SearchFormModel.SearchTimePeriod=0',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SeaLog/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch UFS page: ${response.status}`);
    }

    const html = await response.text();
    
    // Parse the HTML table to extract warnings
    const warnings: UFSWarning[] = [];
    
    // Find the table body with notices
    const tableMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/gi);
    
    if (tableMatch) {
      for (const tbody of tableMatch) {
        // Extract each row
        const rowMatches = tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
        
        for (const rowMatch of rowMatches) {
          const row = rowMatch[1];
          
          // Extract cells
          const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1]);
          
          if (cells.length >= 4) {
            // Extract notice number and link
            const noticeCell = cells[0];
            const linkMatch = noticeCell.match(/href="([^"]+)"[^>]*>([^<]+)/);
            const noticeNumber = linkMatch ? linkMatch[2].trim() : '';
            const noticeUrl = linkMatch ? `https://ufs.sjofartsverket.se${linkMatch[1]}` : '';
            
            // Check for (T) or (P) markers
            const isTemporary = noticeCell.includes('(T)');
            const isPreliminary = noticeCell.includes('(P)');
            
            // Extract other fields
            const chartNumber = cells[1].replace(/<[^>]+>/g, '').trim();
            const publishedDate = cells[2].replace(/<[^>]+>/g, '').trim();
            const headline = cells[3].replace(/<[^>]+>/g, '').trim();
            
            if (noticeNumber && headline) {
              warnings.push({
                noticeNumber,
                chartNumber,
                publishedDate,
                headline,
                isTemporary,
                isPreliminary,
                url: noticeUrl,
              });
            }
          }
          
          if (warnings.length >= limit) break;
        }
        
        if (warnings.length >= limit) break;
      }
    }

    console.log(`Found ${warnings.length} UFS warnings`);

    return new Response(
      JSON.stringify({ success: true, data: warnings }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching UFS warnings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch UFS warnings';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
