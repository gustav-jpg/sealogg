import { useCallback } from 'react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { CREW_ROLE_LABELS, CrewRole } from '@/lib/types';

interface Vessel {
  name: string;
  call_sign?: string;
  registration_number?: string;
}

interface Stop {
  stop_order: number;
  departure_time: string | null;
  departure_location: string | null;
  arrival_time: string | null;
  arrival_location: string | null;
  pax_on?: number | null;
  pax_off?: number | null;
  passenger_count?: number | null;
}

interface CrewMember {
  profile: { full_name: string } | null;
  role: string;
}

interface EngineHour {
  engine_name?: string;
  engine_type: string;
  engine_number: number;
  start_hours: number;
  stop_hours: number | null;
}

interface Exercise {
  exercise_type: string;
  notes?: string;
}

interface PassengerSummary {
  firstDeparture: string;
  lastDeparture: string;
  totalPaxOn: number;
  totalPaxOff: number;
  stopCount: number;
  stops: {
    order: number;
    time: string;
    dock: string;
    paxOn: number;
    paxOff: number;
  }[];
}

interface LogbookData {
  id: string;
  date: string;
  status: string;
  weather?: string;
  wind?: string;
  general_notes?: string;
  bunker_liters?: number;
  vessel: Vessel;
  created_by_profile?: { full_name: string };
}

interface PrintLogbookOptions {
  logbook: LogbookData;
  stops: Stop[];
  crewMembers: CrewMember[];
  engineHours: EngineHour[];
  exercises: Exercise[];
  passengerSummary?: PassengerSummary | null;
  signatures?: { signer_profile?: { full_name: string }; signed_at: string }[];
}

export function useLogbookPrint() {
  const printLogbook = useCallback((options: PrintLogbookOptions) => {
    const { logbook, stops, crewMembers, engineHours, exercises, passengerSummary, signatures } = options;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup-blockerare hindrade utskriften. Tillåt popup för denna sida.');
      return;
    }

    // Calculate running passenger count for stops
    const calculateOnboard = (currentIndex: number): number => {
      let total = 0;
      for (let i = 0; i <= currentIndex; i++) {
        const stop = stops[i];
        if (stop.pax_on !== null || stop.pax_off !== null) {
          total += stop.pax_on || 0;
          total -= stop.pax_off || 0;
        } else if (stop.passenger_count !== null) {
          total += stop.passenger_count || 0;
        }
      }
      return Math.max(0, total);
    };

    // Generate stops table - combine regular stops and passenger summary
    let stopsHtml = '';
    const sortedStops = [...stops].sort((a, b) => a.stop_order - b.stop_order);
    
    if (passengerSummary && passengerSummary.stops.length > 0) {
      // Use passenger summary stops
      let runningTotal = 0;
      const paxStopsRows = passengerSummary.stops.map((stop, i) => {
        runningTotal += stop.paxOn - stop.paxOff;
        return `
          <tr class="${i % 2 === 0 ? 'even-row' : ''}">
            <td class="cell-num">${stop.order}</td>
            <td class="cell-time">${stop.time}</td>
            <td class="cell-location">${stop.dock}</td>
            <td class="cell-pax-on">${stop.paxOn > 0 ? `+${stop.paxOn}` : '-'}</td>
            <td class="cell-pax-off">${stop.paxOff > 0 ? `-${stop.paxOff}` : '-'}</td>
            <td class="cell-onboard">${runningTotal}</td>
          </tr>
        `;
      }).join('');
      
      stopsHtml = `
        <div class="section">
          <div class="section-title">Stopp & passagerare</div>
          <div class="summary-stats">
            <div class="stat-box stat-primary">
              <div class="stat-label">Påstigande</div>
              <div class="stat-value">${passengerSummary.totalPaxOn}</div>
            </div>
            <div class="stat-box stat-destructive">
              <div class="stat-label">Avstigande</div>
              <div class="stat-value">${passengerSummary.totalPaxOff}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Antal stopp</div>
              <div class="stat-value">${passengerSummary.stopCount}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Tidspann</div>
              <div class="stat-value">${passengerSummary.firstDeparture} – ${passengerSummary.lastDeparture}</div>
            </div>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th class="w-num">#</th>
                <th class="w-time">Tid</th>
                <th>Plats</th>
                <th class="w-pax">Pax på</th>
                <th class="w-pax">Pax av</th>
                <th class="w-pax">Ombord</th>
              </tr>
            </thead>
            <tbody>
              ${paxStopsRows}
            </tbody>
          </table>
        </div>
      `;
    } else if (sortedStops.length > 0) {
      const usesNewFormat = sortedStops.some(s => s.pax_on !== null || s.pax_off !== null);
      
      const stopRows = sortedStops.map((stop, i) => {
        const onboard = calculateOnboard(i);
        const position = stop.departure_location || stop.arrival_location || '-';
        
        if (usesNewFormat) {
          return `
            <tr class="${i % 2 === 0 ? 'even-row' : ''}">
              <td class="cell-num">${stop.stop_order}</td>
              <td class="cell-time">${stop.departure_time || '-'}</td>
              <td class="cell-location">${position}</td>
              <td class="cell-pax-on">${stop.pax_on && stop.pax_on > 0 ? `+${stop.pax_on}` : '-'}</td>
              <td class="cell-pax-off">${stop.pax_off && stop.pax_off > 0 ? `-${stop.pax_off}` : '-'}</td>
              <td class="cell-onboard">${onboard}</td>
            </tr>
          `;
        } else {
          return `
            <tr class="${i % 2 === 0 ? 'even-row' : ''}">
              <td class="cell-num">${stop.stop_order}</td>
              <td class="cell-time">${stop.departure_time || '-'}</td>
              <td class="cell-location">${position}</td>
              <td class="cell-pax">${stop.passenger_count ?? '-'}</td>
              <td class="cell-onboard">${onboard}</td>
            </tr>
          `;
        }
      }).join('');
      
      const headers = usesNewFormat 
        ? `<th class="w-num">#</th><th class="w-time">Tid</th><th>Plats</th><th class="w-pax">Pax på</th><th class="w-pax">Pax av</th><th class="w-pax">Ombord</th>`
        : `<th class="w-num">#</th><th class="w-time">Tid</th><th>Plats</th><th class="w-pax">Pax</th><th class="w-pax">Ombord</th>`;
      
      stopsHtml = `
        <div class="section">
          <div class="section-title">Stopp & passagerare</div>
          <table class="data-table">
            <thead><tr>${headers}</tr></thead>
            <tbody>${stopRows}</tbody>
          </table>
        </div>
      `;
    }

    // Generate crew table
    let crewHtml = '';
    if (crewMembers.length > 0) {
      const crewRows = crewMembers.map((crew, i) => `
        <tr class="${i % 2 === 0 ? 'even-row' : ''}">
          <td class="crew-name">${crew.profile?.full_name || 'Okänd'}</td>
          <td class="crew-role">${CREW_ROLE_LABELS[crew.role as CrewRole] || crew.role}</td>
        </tr>
      `).join('');
      
      crewHtml = `
        <div class="section">
          <div class="section-title">Besättning</div>
          <table class="data-table">
            <thead>
              <tr>
                <th>Namn</th>
                <th class="w-role">Roll</th>
              </tr>
            </thead>
            <tbody>${crewRows}</tbody>
          </table>
        </div>
      `;
    }

    // Generate engine hours table
    let engineHtml = '';
    if (engineHours.length > 0) {
      const engineRows = engineHours.map((e, i) => {
        const label = e.engine_name || `${e.engine_type === 'auxiliary' ? 'Hjälpmaskin' : 'Huvudmaskin'} ${e.engine_number}`;
        const hours = e.stop_hours !== null ? (e.stop_hours - e.start_hours).toFixed(1) : '-';
        return `
          <tr class="${i % 2 === 0 ? 'even-row' : ''}">
            <td>${label}</td>
            <td class="cell-num">${e.start_hours}</td>
            <td class="cell-num">${e.stop_hours ?? '-'}</td>
            <td class="cell-num font-bold">${hours}</td>
          </tr>
        `;
      }).join('');
      
      engineHtml = `
        <div class="section">
          <div class="section-title">Maskintimmar</div>
          <table class="data-table">
            <thead>
              <tr>
                <th>Motor</th>
                <th class="w-hours">Start</th>
                <th class="w-hours">Stopp</th>
                <th class="w-hours">Timmar</th>
              </tr>
            </thead>
            <tbody>${engineRows}</tbody>
          </table>
        </div>
      `;
    }

    // Generate exercises section
    let exercisesHtml = '';
    if (exercises.length > 0) {
      const exerciseItems = exercises.map(e => `
        <div class="exercise-item">
          <span class="exercise-badge">${e.exercise_type}</span>
          ${e.notes ? `<span class="exercise-notes">${e.notes}</span>` : ''}
        </div>
      `).join('');
      
      exercisesHtml = `
        <div class="section">
          <div class="section-title">Genomförda övningar</div>
          <div class="exercises-list">${exerciseItems}</div>
        </div>
      `;
    }

    // Parse quick entries (bunkring, färskvatten, septik) from notes
    let quickEntriesHtml = '';
    let remainingNotes = logbook.general_notes || '';
    
    const quickEntryPatterns = [
      { pattern: /^(\d{2}:\d{2})\s*-\s*Bunkrat\s+(\d+)\s*liter\s+vid\s+(\d+)\s*h\s*\(([^)]+)\)$/gm, type: 'bunkring', icon: '⛽' },
      { pattern: /^(\d{2}:\d{2})\s*-\s*Färskvatten:\s*(.+)$/gm, type: 'farskvatten', icon: '💧' },
      { pattern: /^(\d{2}:\d{2})\s*-\s*Septik:\s*(.+)$/gm, type: 'septik', icon: '🚽' },
    ];
    
    const parsedEntries: { type: string; icon: string; time: string; text: string }[] = [];
    
    for (const { pattern, type, icon } of quickEntryPatterns) {
      let match;
      const regex = new RegExp(pattern.source, 'gm');
      while ((match = regex.exec(logbook.general_notes || '')) !== null) {
        const time = match[1];
        let text = '';
        if (type === 'bunkring') {
          text = `${match[2]} liter vid ${match[3]} h (${match[4]})`;
        } else {
          text = match[2];
        }
        parsedEntries.push({ type, icon, time, text });
        remainingNotes = remainingNotes.replace(match[0], '').trim();
      }
    }
    
    // Clean up extra newlines from remaining notes
    remainingNotes = remainingNotes.replace(/\n{3,}/g, '\n\n').trim();
    
    if (parsedEntries.length > 0) {
      const entryRows = parsedEntries.map((e, i) => `
        <tr class="${i % 2 === 0 ? 'even-row' : ''}">
          <td class="cell-time">${e.time}</td>
          <td>
            <span class="quick-entry-badge ${e.type}">${e.icon} ${e.type === 'bunkring' ? 'Bunkring' : e.type === 'farskvatten' ? 'Färskvatten' : 'Septik'}</span>
          </td>
          <td>${e.text}</td>
        </tr>
      `).join('');
      
      quickEntriesHtml = `
        <div class="section">
          <div class="section-title">Bunkring & tankning</div>
          <table class="data-table">
            <thead>
              <tr>
                <th class="w-time">Tid</th>
                <th class="w-type">Typ</th>
                <th>Detaljer</th>
              </tr>
            </thead>
            <tbody>${entryRows}</tbody>
          </table>
        </div>
      `;
    }

    // Notes section (with quick entries removed)
    let notesHtml = '';
    if (remainingNotes) {
      notesHtml = `
        <div class="section">
          <div class="section-title">Anteckningar</div>
          <div class="notes-content">${remainingNotes}</div>
        </div>
      `;
    }

    // Signature section
    let signatureHtml = '';
    if (signatures && signatures.length > 0) {
      const sig = signatures[0];
      signatureHtml = `
        <div class="signature-box">
          <div class="signature-label">Signerad & stängd</div>
          <div class="signature-name">${sig.signer_profile?.full_name || 'Okänd'}</div>
          <div class="signature-date">${format(new Date(sig.signed_at), "d MMMM yyyy 'kl.' HH:mm", { locale: sv })}</div>
        </div>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="sv">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Loggbok - ${logbook.vessel.name} - ${format(new Date(logbook.date), 'd MMMM yyyy', { locale: sv })}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap');
            
            * { box-sizing: border-box; margin: 0; padding: 0; }
            
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
              padding: 32px 40px;
              max-width: 210mm;
              margin: 0 auto;
              color: #1a1a1a;
              font-size: 11px;
              line-height: 1.5;
              background: white;
            }
            
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 3px solid #1e3a5f;
              padding-bottom: 16px;
              margin-bottom: 24px;
            }
            
            .header-left h1 {
              font-family: 'Playfair Display', serif;
              font-size: 26px;
              font-weight: 700;
              color: #1e3a5f;
              margin-bottom: 4px;
            }
            
            .header-left .date {
              font-size: 15px;
              color: #334155;
              font-weight: 500;
            }
            
            .header-left .vessel-info {
              font-size: 11px;
              color: #64748b;
              margin-top: 4px;
            }
            
            .header-right {
              text-align: right;
            }
            
            .header-right .logo-img {
              height: 32px;
              width: auto;
            }
            
            .header-right .print-date {
              font-size: 10px;
              color: #94a3b8;
              margin-top: 4px;
            }
            
            .status-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 20px;
              font-size: 10px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.3px;
              margin-top: 8px;
            }
            
            .status-open { background: #dcfce7; color: #166534; }
            .status-closed { background: #e0e7ff; color: #3730a3; }
            
            .info-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
              margin-bottom: 24px;
            }
            
            .info-box {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 12px;
            }
            
            .info-label {
              font-size: 10px;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            
            .info-value {
              font-size: 13px;
              font-weight: 600;
              color: #1e3a5f;
            }
            
            .section {
              margin-bottom: 20px;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              overflow: hidden;
            }
            
            .section-title {
              font-family: 'Playfair Display', serif;
              font-size: 14px;
              font-weight: 600;
              color: white;
              background: linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 100%);
              padding: 10px 16px;
            }
            
            .summary-stats {
              display: flex;
              gap: 12px;
              padding: 12px 16px;
              background: #f8fafc;
              border-bottom: 1px solid #e2e8f0;
            }
            
            .stat-box {
              flex: 1;
              text-align: center;
              padding: 8px;
              background: white;
              border-radius: 6px;
              border: 1px solid #e2e8f0;
            }
            
            .stat-primary { border-color: #1e3a5f; background: #f0f9ff; }
            .stat-destructive { border-color: #dc2626; background: #fef2f2; }
            
            .stat-label { font-size: 9px; color: #64748b; text-transform: uppercase; }
            .stat-value { font-size: 16px; font-weight: 700; color: #1e3a5f; }
            .stat-destructive .stat-value { color: #dc2626; }
            
            .data-table {
              width: 100%;
              border-collapse: collapse;
            }
            
            .data-table th {
              background: #f1f5f9;
              font-weight: 600;
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 0.3px;
              color: #475569;
              padding: 10px 12px;
              text-align: left;
              border-bottom: 1px solid #e2e8f0;
            }
            
            .data-table td {
              padding: 10px 12px;
              border-bottom: 1px solid #f1f5f9;
            }
            
            .data-table .even-row { background: #fafafa; }
            
            .w-num { width: 40px; text-align: center; }
            .w-time { width: 60px; }
            .w-pax { width: 60px; text-align: center; }
            .w-role { width: 120px; }
            .w-hours { width: 70px; text-align: right; }
            .w-type { width: 100px; }
            
            .quick-entry-badge {
              display: inline-block;
              padding: 3px 8px;
              border-radius: 12px;
              font-size: 10px;
              font-weight: 600;
            }
            .quick-entry-badge.bunkring { background: #fef3c7; color: #92400e; }
            .quick-entry-badge.farskvatten { background: #dbeafe; color: #1e40af; }
            .quick-entry-badge.septik { background: #f3e8ff; color: #7c3aed; }
            
            .cell-num { text-align: center; color: #64748b; }
            .cell-time { font-family: monospace; font-size: 11px; }
            .cell-location { font-weight: 500; }
            .cell-pax-on { text-align: center; color: #16a34a; font-weight: 500; }
            .cell-pax-off { text-align: center; color: #dc2626; font-weight: 500; }
            .cell-pax { text-align: center; }
            .cell-onboard { text-align: center; font-weight: 600; color: #1e3a5f; }
            
            .crew-name { font-weight: 500; }
            .crew-role { color: #64748b; }
            
            .font-bold { font-weight: 700; }
            
            .exercises-list {
              padding: 12px 16px;
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
            }
            
            .exercise-item {
              display: flex;
              align-items: center;
              gap: 8px;
            }
            
            .exercise-badge {
              background: #e0e7ff;
              color: #3730a3;
              padding: 4px 10px;
              border-radius: 16px;
              font-size: 10px;
              font-weight: 600;
            }
            
            .exercise-notes {
              font-size: 10px;
              color: #64748b;
            }
            
            .notes-content {
              padding: 16px;
              background: #fafafa;
              white-space: pre-wrap;
              font-size: 11px;
              line-height: 1.6;
            }
            
            .signature-box {
              margin-top: 24px;
              padding: 16px;
              background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
              border: 1px solid #86efac;
              border-radius: 10px;
              text-align: center;
            }
            
            .signature-label {
              font-size: 10px;
              color: #166534;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 8px;
            }
            
            .signature-name {
              font-size: 16px;
              font-weight: 600;
              color: #166534;
            }
            
            .signature-date {
              font-size: 11px;
              color: #15803d;
              margin-top: 4px;
            }
            
            .footer {
              margin-top: 32px;
              padding-top: 12px;
              border-top: 1px solid #e2e8f0;
              display: flex;
              justify-content: space-between;
              font-size: 9px;
              color: #94a3b8;
            }
            
            @media print {
              body { padding: 16px; }
              .section { page-break-inside: avoid; }
              @page { margin: 1cm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-left">
              <h1>${logbook.vessel.name}</h1>
              <div class="date">${format(new Date(logbook.date), 'EEEE d MMMM yyyy', { locale: sv })}</div>
              ${logbook.vessel.call_sign || logbook.vessel.registration_number 
                ? `<div class="vessel-info">${[logbook.vessel.call_sign, logbook.vessel.registration_number].filter(Boolean).join(' • ')}</div>` 
                : ''}
              <div class="status-badge ${logbook.status === 'oppen' ? 'status-open' : 'status-closed'}">
                ${logbook.status === 'oppen' ? 'Öppen' : 'Stängd'}
              </div>
            </div>
            <div class="header-right">
              <img src="${window.location.origin}/sealog-logo.png" alt="SeaLogg" class="logo-img" />
              <div class="print-date">Utskriven ${format(new Date(), "d MMM yyyy HH:mm", { locale: sv })}</div>
            </div>
          </div>
          
          <div class="info-grid">
            <div class="info-box">
              <div class="info-label">Väder</div>
              <div class="info-value">${logbook.weather || '-'}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Vind</div>
              <div class="info-value">${logbook.wind || '-'}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Bunkring</div>
              <div class="info-value">${logbook.bunker_liters ? `${logbook.bunker_liters} L` : '-'}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Befäl</div>
              <div class="info-value">${logbook.created_by_profile?.full_name || '-'}</div>
            </div>
          </div>
          
          ${stopsHtml}
          ${crewHtml}
          ${engineHtml}
          ${quickEntriesHtml}
          ${exercisesHtml}
          ${notesHtml}
          ${signatureHtml}
          
          <div class="footer">
            <span>Genererad från SeaLogg</span>
            <span>Loggbok ID: ${logbook.id.slice(0, 8)}</span>
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

  return { printLogbook };
}
