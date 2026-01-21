import { useCallback } from 'react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface LogbookForPrint {
  id: string;
  date: string;
  status: string;
  vessel?: { name: string };
  creator_name?: string;
}

interface PrintLogbooksOptions {
  title: string;
  subtitle?: string;
  vesselFilter?: string;
  creatorFilter?: string;
}

const STATUS_LABELS: Record<string, string> = {
  oppen: 'Öppen',
  stangd: 'Stängd',
};

export function useLogbooksPrint() {
  const printLogbooks = useCallback((logbooks: LogbookForPrint[], options: PrintLogbooksOptions) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup-blockerare hindrade utskriften. Tillåt popup för denna sida.');
      return;
    }

    const filterInfo = [
      options.vesselFilter && options.vesselFilter !== 'all' ? `Fartyg: ${options.vesselFilter}` : null,
      options.creatorFilter && options.creatorFilter !== 'all' ? `Befäl: ${options.creatorFilter}` : null,
    ].filter(Boolean).join(' • ');

    const tableRows = logbooks.map((logbook, index) => `
      <tr class="${index % 2 === 0 ? 'even-row' : ''}">
        <td class="cell-num">${index + 1}</td>
        <td class="cell-date">${format(new Date(logbook.date), 'd MMMM yyyy', { locale: sv })}</td>
        <td class="cell-vessel">${logbook.vessel?.name || 'Okänt fartyg'}</td>
        <td class="cell-creator">${logbook.creator_name || 'Okänd'}</td>
        <td class="cell-status">
          <span class="status-badge ${logbook.status === 'oppen' ? 'status-open' : 'status-closed'}">
            ${STATUS_LABELS[logbook.status] || logbook.status}
          </span>
        </td>
      </tr>
    `).join('');

    // Group by vessel for summary
    const vesselSummary = logbooks.reduce((acc, l) => {
      const vesselName = l.vessel?.name || 'Okänt fartyg';
      if (!acc[vesselName]) acc[vesselName] = { total: 0, open: 0, closed: 0 };
      acc[vesselName].total++;
      if (l.status === 'oppen') acc[vesselName].open++;
      else acc[vesselName].closed++;
      return acc;
    }, {} as Record<string, { total: number; open: number; closed: number }>);

    const summaryRows = Object.entries(vesselSummary).map(([vessel, stats]) => `
      <tr>
        <td class="summary-vessel">${vessel}</td>
        <td class="summary-num">${stats.total}</td>
        <td class="summary-num">${stats.open}</td>
        <td class="summary-num">${stats.closed}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html lang="sv">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${options.title}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap');
            
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
              padding: 40px 48px;
              max-width: 210mm;
              margin: 0 auto;
              color: #1a1a1a;
              font-size: 12px;
              line-height: 1.5;
              background: white;
            }
            
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 3px solid #1e3a5f;
              padding-bottom: 20px;
              margin-bottom: 32px;
            }
            
            .header-left h1 {
              font-family: 'Playfair Display', serif;
              font-size: 28px;
              font-weight: 700;
              color: #1e3a5f;
              margin-bottom: 4px;
            }
            
            .header-left .subtitle {
              color: #64748b;
              font-size: 14px;
              font-weight: 500;
            }
            
            .header-left .filter-info {
              color: #94a3b8;
              font-size: 11px;
              margin-top: 4px;
            }
            
            .header-right {
              text-align: right;
            }
            
            .header-right .logo {
              font-family: 'Playfair Display', serif;
              font-size: 18px;
              font-weight: 600;
              color: #1e3a5f;
            }
            
            .header-right .print-date {
              font-size: 10px;
              color: #94a3b8;
              margin-top: 4px;
            }
            
            .stats-bar {
              display: flex;
              gap: 24px;
              background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 16px 24px;
              margin-bottom: 24px;
            }
            
            .stat-item {
              text-align: center;
            }
            
            .stat-value {
              font-size: 24px;
              font-weight: 700;
              color: #1e3a5f;
            }
            
            .stat-label {
              font-size: 11px;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            
            .main-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 32px;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            }
            
            .main-table thead {
              background: linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 100%);
            }
            
            .main-table th {
              color: white;
              font-weight: 600;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              padding: 14px 16px;
              text-align: left;
            }
            
            .main-table th:first-child {
              width: 40px;
              text-align: center;
            }
            
            .main-table td {
              padding: 12px 16px;
              border-bottom: 1px solid #e2e8f0;
            }
            
            .main-table .even-row {
              background: #f8fafc;
            }
            
            .cell-num {
              text-align: center;
              color: #94a3b8;
              font-size: 11px;
            }
            
            .cell-date {
              font-weight: 500;
              color: #334155;
            }
            
            .cell-vessel {
              font-weight: 600;
              color: #1e3a5f;
            }
            
            .cell-creator {
              color: #64748b;
            }
            
            .cell-status {
              text-align: center;
            }
            
            .status-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 20px;
              font-size: 10px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            
            .status-open {
              background: #dcfce7;
              color: #166534;
            }
            
            .status-closed {
              background: #e0e7ff;
              color: #3730a3;
            }
            
            .summary-section {
              margin-top: 32px;
            }
            
            .summary-title {
              font-family: 'Playfair Display', serif;
              font-size: 16px;
              font-weight: 600;
              color: #1e3a5f;
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 2px solid #e2e8f0;
            }
            
            .summary-table {
              width: 100%;
              max-width: 400px;
              border-collapse: collapse;
            }
            
            .summary-table th {
              text-align: left;
              padding: 8px 12px;
              background: #f1f5f9;
              font-size: 10px;
              text-transform: uppercase;
              color: #64748b;
              font-weight: 600;
            }
            
            .summary-table td {
              padding: 8px 12px;
              border-bottom: 1px solid #e2e8f0;
            }
            
            .summary-vessel {
              font-weight: 500;
              color: #1e3a5f;
            }
            
            .summary-num {
              text-align: center;
              color: #64748b;
            }
            
            .footer {
              margin-top: 40px;
              padding-top: 16px;
              border-top: 1px solid #e2e8f0;
              display: flex;
              justify-content: space-between;
              font-size: 9px;
              color: #94a3b8;
            }
            
            @media print {
              body {
                padding: 20px;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              
              .main-table {
                page-break-inside: auto;
              }
              
              .main-table tr {
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-left">
              <h1>${options.title}</h1>
              ${options.subtitle ? `<div class="subtitle">${options.subtitle}</div>` : ''}
              ${filterInfo ? `<div class="filter-info">${filterInfo}</div>` : ''}
            </div>
            <div class="header-right">
              <div class="logo">⚓ SeaLog</div>
              <div class="print-date">Utskriven ${format(new Date(), "d MMMM yyyy 'kl.' HH:mm", { locale: sv })}</div>
            </div>
          </div>
          
          <div class="stats-bar">
            <div class="stat-item">
              <div class="stat-value">${logbooks.length}</div>
              <div class="stat-label">Totalt</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${logbooks.filter(l => l.status === 'oppen').length}</div>
              <div class="stat-label">Öppna</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${logbooks.filter(l => l.status === 'stangd').length}</div>
              <div class="stat-label">Stängda</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${Object.keys(vesselSummary).length}</div>
              <div class="stat-label">Fartyg</div>
            </div>
          </div>
          
          <table class="main-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Datum</th>
                <th>Fartyg</th>
                <th>Befäl</th>
                <th style="text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          
          <div class="summary-section">
            <div class="summary-title">Sammanfattning per fartyg</div>
            <table class="summary-table">
              <thead>
                <tr>
                  <th>Fartyg</th>
                  <th style="text-align: center;">Totalt</th>
                  <th style="text-align: center;">Öppna</th>
                  <th style="text-align: center;">Stängda</th>
                </tr>
              </thead>
              <tbody>
                ${summaryRows}
              </tbody>
            </table>
          </div>
          
          <div class="footer">
            <span>Genererad från SeaLog</span>
            <span>Sida 1</span>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }, []);

  return { printLogbooks };
}
