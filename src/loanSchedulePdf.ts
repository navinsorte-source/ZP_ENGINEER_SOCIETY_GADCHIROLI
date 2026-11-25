import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { Loan, Member } from './types';
import { DayWiseScheduleResult, DayWiseScheduleRow } from './utils';

function escapeHtml(value: string | number | undefined | null): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInr(amount: number): string {
  return `₹ ${Math.round(amount || 0).toLocaleString('en-IN')}`;
}

function buildRowsHtml(rows: DayWiseScheduleRow[]): string {
  return rows
    .map((row) => {
      const statusLabel =
        row.state === 'PAID'
          ? '<span style="color:#047857;font-weight:700;">✓ भरला (Paid)</span>'
          : row.state === 'PENDING'
          ? '<span style="color:#be123c;font-weight:700;">! थकीत (Pending)</span>'
          : '<span style="color:#475569;font-weight:600;">येणारा (Upcoming)</span>';

      const bg = row.index % 2 === 0 ? '#f8fafc' : '#ffffff';
      return `
        <tr style="background:${bg};border-bottom:1px solid #e2e8f0;">
          <td style="padding:6px 6px;text-align:center;color:#475569;font-weight:600;">${row.index}</td>
          <td style="padding:6px 8px;font-weight:600;color:#0f172a;">
            ${escapeHtml(row.month)}
            ${
              row.matchedEmi
                ? `<div style="font-size:9px;color:#64748b;font-weight:400;">${escapeHtml(row.matchedEmi.mode)}</div>`
                : ''
            }
          </td>
          <td style="padding:6px 6px;text-align:center;color:#0f172a;font-weight:600;">${escapeHtml(row.effectiveDate)}</td>
          <td style="padding:6px 6px;text-align:center;color:#3730a3;font-weight:600;">${row.daysCount} दिवस</td>
          <td style="padding:6px 8px;text-align:right;color:#334155;">${formatInr(row.openingBalance)}</td>
          <td style="padding:6px 8px;text-align:right;font-weight:700;color:#0f172a;">${formatInr(row.emiAmount)}</td>
          <td style="padding:6px 8px;text-align:right;font-weight:600;color:#047857;">${formatInr(row.principalComponent)}</td>
          <td style="padding:6px 8px;text-align:right;font-weight:600;color:#b45309;">${formatInr(row.interestComponent)}</td>
          <td style="padding:6px 8px;text-align:right;color:#334155;">${formatInr(row.closingBalance)}</td>
          <td style="padding:6px 6px;text-align:center;font-size:10px;">${statusLabel}</td>
        </tr>
      `;
    })
    .join('');
}

export async function downloadLoanSchedulePdf(
  loan: Loan,
  schedule: DayWiseScheduleResult,
  member?: Member
): Promise<void> {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const deduction10Percent = Math.round((loan.principal || 0) * 0.1);
  const netDisbursed = (loan.principal || 0) - deduction10Percent;
  const totalEmiSum = schedule.rows.reduce((s, r) => s + r.emiAmount, 0);
  const totalPrincipalSum = schedule.rows.reduce((s, r) => s + r.principalComponent, 0);
  const totalInterestSum = schedule.rows.reduce((s, r) => s + r.interestComponent, 0);
  const todayFormatted = new Date().toISOString().split('T')[0];

  // Split rows cleanly across pages so no row is ever clipped mid-line
  const FIRST_PAGE_ROWS = 16;
  const NEXT_PAGE_ROWS = 24;
  const chunks: DayWiseScheduleRow[][] = [];
  if (schedule.rows.length <= FIRST_PAGE_ROWS) {
    chunks.push(schedule.rows);
  } else {
    chunks.push(schedule.rows.slice(0, FIRST_PAGE_ROWS));
    for (let i = FIRST_PAGE_ROWS; i < schedule.rows.length; i += NEXT_PAGE_ROWS) {
      chunks.push(schedule.rows.slice(i, i + NEXT_PAGE_ROWS));
    }
  }

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-12000px';
  wrapper.style.top = '0';
  wrapper.style.zIndex = '-1';
  wrapper.style.background = '#ffffff';
  document.body.appendChild(wrapper);

  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    for (let pageIdx = 0; pageIdx < chunks.length; pageIdx++) {
      const isFirst = pageIdx === 0;
      const isLast = pageIdx === chunks.length - 1;
      const pageRows = chunks[pageIdx];

      const pageEl = document.createElement('div');
      pageEl.style.width = '794px';
      pageEl.style.padding = '28px 32px';
      pageEl.style.boxSizing = 'border-box';
      pageEl.style.background = '#ffffff';
      pageEl.style.color = '#0f172a';
      pageEl.style.fontFamily = "'Plus Jakarta Sans', 'Noto Sans Devanagari', sans-serif";

      const headerHtml = isFirst
        ? `
          <div style="background:linear-gradient(90deg,#1e3a8a,#3730a3);color:#ffffff;padding:16px 20px;border-radius:12px;margin-bottom:14px;">
            <div style="font-size:11px;color:#bfdbfe;font-weight:600;">
              जिल्हा परिषद अभियंता व तांत्रिक कर्मचारी सहकारी पत संस्था मर्या. गडचिरोली
            </div>
            <div style="font-size:17px;font-weight:800;margin-top:3px;">
              कर्ज परतफेड वेळापत्रक व हप्ते तक्ता (EMI Amortization Schedule)
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;font-size:11px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:12px 14px;">
            <div style="line-height:1.65;">
              <div><span style="color:#64748b;">सभासदाचे नाव:</span> <strong>${escapeHtml(member?.name || loan.memberName)}</strong></div>
              <div><span style="color:#64748b;">सभासद आयडी:</span> <strong>${escapeHtml(member?.id || '-')}</strong> · <span style="color:#64748b;">पद:</span> <strong>${escapeHtml(member?.designation || '-')}</strong></div>
              <div><span style="color:#64748b;">मोबाईल:</span> <strong>${escapeHtml(member?.mobile || '-')}</strong></div>
              <div><span style="color:#64748b;">जामीनदार:</span> <strong>${escapeHtml(loan.guarantor || '-')}</strong></div>
            </div>
            <div style="line-height:1.65;">
              <div><span style="color:#64748b;">मंजुरी दिनांक:</span> <strong>${escapeHtml(loan.loanDate)}</strong> · <span style="color:#64748b;">EMI तारीख:</span> <strong>दरमहा ${schedule.emiDay} तारीख</strong></div>
              <div><span style="color:#64748b;">व्याजदर:</span> <strong>${escapeHtml(loan.interestRate)}% वार्षिक (Day-Wise)</strong> · <span style="color:#64748b;">कालावधी:</span> <strong>${escapeHtml(loan.months)} महिने</strong></div>
              <div><span style="color:#64748b;">तारण:</span> <strong>${escapeHtml(loan.mortgage || '-')}</strong></div>
              <div><span style="color:#64748b;">स्थिती:</span> <strong>${loan.status === 'Closed' ? 'खाते बंद (Closed)' : 'सक्रिय (Active)'}</strong></div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;">
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 10px;">
              <div style="font-size:10px;color:#1d4ed8;font-weight:600;">मंजूर कर्ज रक्कम</div>
              <div style="font-size:14px;font-weight:800;color:#0f172a;margin-top:2px;">${formatInr(loan.principal)}</div>
              <div style="font-size:9.5px;color:#475569;">१०% कपात: ${formatInr(deduction10Percent)}</div>
            </div>
            <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:8px 10px;">
              <div style="font-size:10px;color:#047857;font-weight:600;">प्रत्यक्ष वितरण रक्कम</div>
              <div style="font-size:14px;font-weight:800;color:#065f46;margin-top:2px;">${formatInr(netDisbursed)}</div>
              <div style="font-size:9.5px;color:#047857;">भरलेले हप्ते: ${schedule.paidEmiCount} / ${loan.months}</div>
            </div>
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 10px;">
              <div style="font-size:10px;color:#b45309;font-weight:600;">मासिक EMI हप्ता</div>
              <div style="font-size:14px;font-weight:800;color:#78350f;margin-top:2px;">${formatInr(loan.monthlyEmi)}</div>
              <div style="font-size:9.5px;color:#b45309;">जमा रक्कम: ${formatInr(schedule.totalPaidAmount)}</div>
            </div>
            <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;padding:8px 10px;">
              <div style="font-size:10px;color:#be123c;font-weight:600;">शिल्लक मुद्दल</div>
              <div style="font-size:14px;font-weight:800;color:#881337;margin-top:2px;">${formatInr(schedule.remainingPrincipal)}</div>
              <div style="font-size:9.5px;color:#be123c;">प्रलंबित हप्ते: ${schedule.missedCount}</div>
            </div>
          </div>
        `
        : `
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1e3a8a;padding-bottom:6px;margin-bottom:12px;font-size:11px;">
            <strong style="color:#1e3a8a;">जिल्हा परिषद अभियंता व तांत्रिक कर्मचारी सहकारी पत संस्था मर्या. गडचिरोली</strong>
            <span style="color:#475569;">${escapeHtml(member?.name || loan.memberName)} — पान ${pageIdx + 1}/${chunks.length}</span>
          </div>
        `;

      const tfootHtml = isLast
        ? `
          <tfoot>
            <tr style="background:#e2e8f0;font-weight:800;color:#0f172a;border-top:2px solid #94a3b8;">
              <td colspan="5" style="padding:7px 8px;text-align:right;">एकूण बेरीज (Total):</td>
              <td style="padding:7px 8px;text-align:right;">${formatInr(totalEmiSum)}</td>
              <td style="padding:7px 8px;text-align:right;color:#047857;">${formatInr(totalPrincipalSum)}</td>
              <td style="padding:7px 8px;text-align:right;color:#b45309;">${formatInr(totalInterestSum)}</td>
              <td colspan="2" style="padding:7px 8px;text-align:right;font-size:10px;color:#475569;">शिल्लक: ${formatInr(schedule.remainingPrincipal)}</td>
            </tr>
          </tfoot>
        `
        : '';

      const footerHtml = isLast
        ? `
          <div style="margin-top:28px;display:grid;grid-template-columns:repeat(3,1fr);gap:24px;text-align:center;font-size:11px;color:#334155;">
            <div>
              <div style="border-top:1px solid #64748b;padding-top:6px;margin-top:28px;font-weight:700;">कर्जदार / सभासद स्वाक्षरी</div>
              <div style="font-size:9.5px;color:#64748b;">(${escapeHtml(member?.name || loan.memberName)})</div>
            </div>
            <div>
              <div style="border-top:1px solid #64748b;padding-top:6px;margin-top:28px;font-weight:700;">सचिव स्वाक्षरी</div>
              <div style="font-size:9.5px;color:#64748b;">जि.प. अभियंता पत संस्था गडचिरोली</div>
            </div>
            <div>
              <div style="border-top:1px solid #64748b;padding-top:6px;margin-top:28px;font-weight:700;">अध्यक्ष स्वाक्षरी</div>
              <div style="font-size:9.5px;color:#64748b;">दिनांक: ${todayFormatted}</div>
            </div>
          </div>
        `
        : '';

      pageEl.innerHTML = `
        ${headerHtml}
        <table style="width:100%;border-collapse:collapse;font-size:10.5px;border:1px solid #cbd5e1;">
          <thead>
            <tr style="background:#f1f5f9;color:#1e293b;border-bottom:2px solid #cbd5e1;">
              <th style="padding:7px 6px;text-align:center;">क्र.</th>
              <th style="padding:7px 8px;text-align:left;">महिना</th>
              <th style="padding:7px 6px;text-align:center;">दिनांक</th>
              <th style="padding:7px 6px;text-align:center;">दिवस</th>
              <th style="padding:7px 8px;text-align:right;">सुरुवातीची शिल्लक</th>
              <th style="padding:7px 8px;text-align:right;">EMI (₹)</th>
              <th style="padding:7px 8px;text-align:right;">मुद्दल (₹)</th>
              <th style="padding:7px 8px;text-align:right;">व्याज (₹)</th>
              <th style="padding:7px 8px;text-align:right;">अखेरची शिल्लक</th>
              <th style="padding:7px 6px;text-align:center;">स्थिती</th>
            </tr>
          </thead>
          <tbody>
            ${buildRowsHtml(pageRows)}
          </tbody>
          ${tfootHtml}
        </table>
        ${footerHtml}
      `;

      wrapper.innerHTML = '';
      wrapper.appendChild(pageEl);

      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const maxPageHeight = pdf.internal.pageSize.getHeight();
      const renderHeight = Math.min(pdfHeight, maxPageHeight);
      const renderWidth = pdfHeight > maxPageHeight ? (pdfWidth * maxPageHeight) / pdfHeight : pdfWidth;
      const xOffset = (pdfWidth - renderWidth) / 2;

      if (pageIdx > 0) {
        pdf.addPage();
      }
      pdf.addImage(imgData, 'JPEG', xOffset, 0, renderWidth, renderHeight);
    }

    const safeId = (member?.id || loan.docId || 'Loan').replace(/[^a-zA-Z0-9_-]/g, '');
    const safeDate = (loan.loanDate || todayFormatted).replace(/[^0-9-]/g, '');
    pdf.save(`EMI_Schedule_${safeId}_${safeDate}.pdf`);
  } finally {
    wrapper.remove();
  }
}
