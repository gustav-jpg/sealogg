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
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          padding: 20px;
          max-width: 210mm;
          margin: 0 auto;
          color: #1a1a1a;
          font-size: 12px;
          line-height: 1.5;
        }
        .print-header {
          border-bottom: 2px solid #1a1a1a;
          padding-bottom: 16px;
          margin-bottom: 24px;
        }
        .print-header h1 {
          font-size: 24px;
          margin: 0 0 4px 0;
        }
        .print-header p {
          color: #666;
          margin: 0;
          font-size: 14px;
        }
        .print-date {
          font-size: 11px;
          color: #888;
          margin-top: 8px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
          font-size: 11px;
        }
        th {
          background-color: #f5f5f5;
          font-weight: 600;
        }
        tr:nth-child(even) {
          background-color: #fafafa;
        }
        .badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 500;
        }
        .badge-destructive {
          background: #fee2e2;
          color: #dc2626;
        }
        .badge-default {
          background: #e0e7ff;
          color: #4338ca;
        }
        .badge-secondary {
          background: #f3f4f6;
          color: #4b5563;
        }
        .badge-outline {
          background: transparent;
          border: 1px solid #d1d5db;
          color: #6b7280;
        }
        .card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 12px;
          page-break-inside: avoid;
        }
        .card-title {
          font-weight: 600;
          margin-bottom: 8px;
        }
        .card-meta {
          color: #6b7280;
          font-size: 11px;
        }
        .section {
          margin-bottom: 24px;
        }
        .section-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e5e7eb;
        }
        @media print {
          body {
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
        }
      </style>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${options.title}</title>
          ${styles}
        </head>
        <body>
          <div class="print-header">
            <h1>${options.title}</h1>
            ${options.subtitle ? `<p>${options.subtitle}</p>` : ''}
            <div class="print-date">Utskriven: ${new Date().toLocaleString('sv-SE')}</div>
          </div>
          ${content.innerHTML}
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
