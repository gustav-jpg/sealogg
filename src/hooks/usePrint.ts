import { useCallback } from 'react';

interface PrintOptions {
  title: string;
  subtitle?: string;
}

export function usePrint() {
  const printContent = useCallback((contentId: string, options: PrintOptions) => {
    const content = document.getElementById(contentId);
    if (!content) {
      console.error('Print content not found');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup-blockerare hindrade utskriften. Tillåt popup för denna sida.');
      return;
    }

    const styles = `
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', Arial, sans-serif;
          padding: 24px 32px;
          max-width: 210mm;
          margin: 0 auto;
          color: #1a1a1a;
          font-size: 11px;
          line-height: 1.6;
          background: white;
        }
        .print-header {
          border-bottom: 3px solid #1e3a5f;
          padding-bottom: 16px;
          margin-bottom: 24px;
        }
        .print-header h1 {
          font-size: 22px;
          font-weight: 700;
          margin: 0 0 4px 0;
          color: #1e3a5f;
        }
        .print-header p {
          color: #4b5563;
          margin: 0;
          font-size: 13px;
          font-weight: 500;
        }
        .print-date {
          font-size: 10px;
          color: #6b7280;
          margin-top: 8px;
        }
        
        /* Hide interactive elements */
        button, [role="button"], input, textarea, select,
        .no-print, [data-state], svg {
          display: none !important;
        }
        
        /* Card styling for print */
        .print-section {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px 20px;
          margin-bottom: 16px;
          page-break-inside: avoid;
          background: #fff;
        }
        .print-section-title {
          font-size: 14px;
          font-weight: 700;
          color: #1e3a5f;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e5e7eb;
        }
        
        /* Data rows */
        .print-row {
          display: flex;
          padding: 6px 0;
          border-bottom: 1px solid #f3f4f6;
        }
        .print-row:last-child {
          border-bottom: none;
        }
        .print-label {
          font-weight: 600;
          color: #374151;
          width: 140px;
          flex-shrink: 0;
        }
        .print-value {
          color: #1f2937;
          flex: 1;
        }
        
        /* Grid layout */
        .print-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 24px;
        }
        .print-grid-item {
          padding: 4px 0;
        }
        
        /* Tables */
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 8px 0;
          font-size: 10px;
        }
        th, td {
          border: 1px solid #d1d5db;
          padding: 8px 10px;
          text-align: left;
        }
        th {
          background-color: #f3f4f6;
          font-weight: 600;
          color: #374151;
        }
        tr:nth-child(even) {
          background-color: #f9fafb;
        }
        
        /* Badges */
        .badge, [class*="badge"], [class*="Badge"] {
          display: inline-block !important;
          padding: 2px 10px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
          background: #e0e7ff;
          color: #3730a3;
          border: none;
        }
        
        /* Crew list */
        .crew-item {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          border-bottom: 1px solid #f3f4f6;
        }
        .crew-name {
          font-weight: 500;
        }
        .crew-role {
          color: #6b7280;
          font-size: 10px;
        }
        
        /* Engine hours table */
        .engine-table {
          margin-top: 8px;
        }
        
        /* Notes section */
        .notes-content {
          background: #f9fafb;
          padding: 12px;
          border-radius: 6px;
          white-space: pre-wrap;
          font-size: 11px;
          line-height: 1.5;
        }
        
        /* Stop/Journey cards */
        .stop-card {
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 10px;
          background: #fafafa;
        }
        .stop-header {
          font-weight: 600;
          color: #1e3a5f;
          margin-bottom: 8px;
          font-size: 12px;
        }
        
        /* Footer */
        .print-footer {
          margin-top: 32px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
          font-size: 9px;
          color: #9ca3af;
          text-align: center;
        }
        
        @media print {
          body {
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-section {
            break-inside: avoid;
          }
        }
      </style>
    `;

    // Clone and clean content for printing
    const clonedContent = content.cloneNode(true) as HTMLElement;
    
    // Remove all buttons, inputs, and interactive elements
    const removeSelectors = [
      'button', 'input', 'textarea', 'select', 
      '[role="button"]', '[data-state]', 
      '.no-print', 'svg'
    ];
    removeSelectors.forEach(selector => {
      clonedContent.querySelectorAll(selector).forEach(el => el.remove());
    });
    
    // Transform Card components to print-friendly format
    clonedContent.querySelectorAll('[class*="card"], [class*="Card"]').forEach(card => {
      card.className = 'print-section';
    });
    
    // Transform CardHeader/CardTitle
    clonedContent.querySelectorAll('[class*="card-header"], [class*="CardHeader"]').forEach(header => {
      header.className = '';
    });
    clonedContent.querySelectorAll('[class*="card-title"], [class*="CardTitle"]').forEach(title => {
      title.className = 'print-section-title';
    });
    
    // Clean up empty elements
    clonedContent.querySelectorAll('*').forEach(el => {
      if (el.textContent?.trim() === '' && !el.querySelector('table, img')) {
        // Keep structural elements even if empty
        if (!['DIV', 'SECTION', 'ARTICLE'].includes(el.tagName)) {
          el.remove();
        }
      }
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="sv">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${options.title}</title>
          ${styles}
        </head>
        <body>
          <div class="print-header">
            <h1>${options.title}</h1>
            ${options.subtitle ? `<p>${options.subtitle}</p>` : ''}
            <div class="print-date">Utskriven: ${new Date().toLocaleString('sv-SE')}</div>
          </div>
          ${clonedContent.innerHTML}
          <div class="print-footer">
            Genererad från SeaLog • ${new Date().toLocaleDateString('sv-SE')}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    
    // Wait for content to load, then print
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }, []);

  return { printContent };
}
