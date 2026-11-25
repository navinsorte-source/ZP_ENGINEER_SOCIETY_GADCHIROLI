import React, { useState, useMemo } from 'react';
import { Printer, X, CheckCircle2, AlertCircle, Clock, RotateCcw } from 'lucide-react';
import { Loan, LoanEmi, Member } from './types';
import { computeDayWiseLoanSchedule } from './utils';

interface AmortizationTableProps {
  loan: Loan;
  emis: LoanEmi[];
  member?: Member;
  onClose?: () => void;
  onPayEmiClick?: (loan: Loan, targetMonth: string, targetDate?: string) => void;
  isAdmin?: boolean;
}

export const AmortizationScheduleView: React.FC<AmortizationTableProps> = ({
  loan,
  emis,
  member,
  onClose,
  onPayEmiClick,
  isAdmin = false,
}) => {
  // Manual date overrides per EMI row index (1-based) for live Day-Wise Interest preview & deposit
  const [manualDatesByIndex, setManualDatesByIndex] = useState<Record<number, string>>({});

  const schedule = useMemo(
    () => computeDayWiseLoanSchedule(loan, emis, manualDatesByIndex),
    [loan, emis, manualDatesByIndex]
  );

  const {
    rows: scheduleRows,
    emiDay,
    totalPaidAmount,
    paidEmiCount,
    missedCount,
    remainingPrincipal,
  } = schedule;

  const totalEmiMonths = Number(loan.months) || 12;
  const deduction10Percent = Math.round(loan.principal * 0.1);
  const netDisbursed = loan.principal - deduction10Percent;

  const handleManualDateChange = (rowIndex: number, newDate: string) => {
    setManualDatesByIndex((prev) => {
      if (!newDate) {
        const next = { ...prev };
        delete next[rowIndex];
        return next;
      }
      return { ...prev, [rowIndex]: newDate };
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header Bar */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-800 to-blue-800 px-6 py-4 text-white flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-blue-200">
            जिल्हा परिषद अभियंता व तांत्रिक कर्मचारी सहकारी पत संस्था मर्या. गडचिरोली
          </p>
          <h3 className="text-lg font-bold tracking-tight mt-0.5">
            {member?.name || loan.memberName} — कर्ज लेजर व हप्ते शेड्यूल
          </h3>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 px-3.5 py-2 text-xs font-semibold text-white transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>प्रिंट / PDF सेव्ह करा</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Key Metrics Strip */}
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200">
            <p className="text-xs font-medium text-blue-700">मंजूर कर्ज / एकूण देय</p>
            <p className="text-lg font-bold text-slate-900 font-mono-num mt-1">
              ₹ {loan.principal.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-slate-600 font-mono-num mt-0.5">
              एकूण देय: ₹ {loan.totalPayable.toLocaleString('en-IN')}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <p className="text-xs font-medium text-emerald-700">भरलेले हप्ते (Paid EMIs)</p>
            <p className="text-lg font-bold text-emerald-800 font-mono-num mt-1">
              {paidEmiCount} / {totalEmiMonths} हप्ते
            </p>
            <p className="text-xs text-emerald-700 font-mono-num mt-0.5">
              जमा: ₹ {totalPaidAmount.toLocaleString('en-IN')}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200">
            <p className="text-xs font-medium text-amber-800">शिल्लक कर्ज (Remaining Balance)</p>
            <p className="text-lg font-bold text-amber-900 font-mono-num mt-1">
              ₹ {remainingPrincipal.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-amber-700 font-mono-num mt-0.5">
              मासिक EMI: ₹ {loan.monthlyEmi.toLocaleString('en-IN')}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200">
            <p className="text-xs font-medium text-rose-700">थकीत / प्रलंबित हप्ते (Missed)</p>
            <p className="text-lg font-bold text-rose-800 font-mono-num mt-1">
              {missedCount} हप्ते
            </p>
            <p className="text-xs text-rose-700 mt-0.5">
              स्थिती: {loan.status === 'Closed' ? 'खाते बंद (Closed)' : 'सक्रिय (Active)'}
            </p>
          </div>
        </div>

        {/* Metadata bar */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200">
          <span>
            मंजुरी दिनांक: <strong className="text-slate-900 font-mono-num">{loan.loanDate}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            EMI तारीख: <strong className="text-indigo-700 font-mono-num">दरमहा {emiDay} तारीख</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            व्याजदर: <strong className="text-slate-900 font-mono-num">{loan.interestRate}% वार्षिक (Day-Wise)</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            १०% वर्गणी कपात: <strong className="text-rose-700 font-mono-num">₹ {deduction10Percent.toLocaleString('en-IN')}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            प्रत्यक्ष दिलेली रक्कम: <strong className="text-emerald-700 font-mono-num">₹ {netDisbursed.toLocaleString('en-IN')}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            जामीनदार: <strong className="text-slate-900">{loan.guarantor || '-'}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            तारण: <strong className="text-slate-900">{loan.mortgage || '-'}</strong>
          </span>
        </div>

        {loan.status === 'Closed' && (
          <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2">
            <div>
              <strong className="text-slate-900">कर्ज खाते बंद तपशील:</strong> बंद दिनांक:{' '}
              <span className="font-mono-num">{loan.closureDate || '-'}</span> · अंतिम भरणा: ₹{' '}
              <span className="font-mono-num">{(loan.closureAmount || 0).toLocaleString('en-IN')}</span>
            </div>
            <div>शेरा: {loan.closureRemarks || 'पूर्ण परतफेड'}</div>
          </div>
        )}

        {/* Amortization Table */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h4 className="text-sm font-bold text-slate-800">
              महिनानिहाय कर्ज परतफेड तक्ता (Day-Wise Amortization Schedule)
            </h4>
            {Object.keys(manualDatesByIndex).length > 0 && (
              <button
                type="button"
                onClick={() => setManualDatesByIndex({})}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold cursor-pointer no-print"
              >
                <RotateCcw className="w-3 h-3" />
                <span>मूळ तारखा रीसेट करा</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <th className="py-3 px-3 font-semibold">क्र.</th>
                  <th className="py-3 px-3 font-semibold">महिना (Month)</th>
                  <th className="py-3 px-3 font-semibold">जमा दिनांक (Date)</th>
                  <th className="py-3 px-3 font-semibold text-right">सुरुवातीची शिल्लक (₹)</th>
                  <th className="py-3 px-3 font-semibold text-right">मासिक EMI (₹)</th>
                  <th className="py-3 px-3 font-semibold text-right">मुद्दल (Principal ₹)</th>
                  <th className="py-3 px-3 font-semibold text-right">व्याज (Interest ₹)</th>
                  <th className="py-3 px-3 font-semibold text-right">अखेरची शिल्लक (₹)</th>
                  <th className="py-3 px-3 font-semibold">स्थिती (Status)</th>
                  {isAdmin && loan.status === 'Active' && (
                    <th className="py-3 px-3 font-semibold text-center no-print">कृती</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {scheduleRows.map((row) => (
                  <tr
                    key={row.index}
                    className={`transition-colors ${
                      row.isCustomDate ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono-num text-slate-500">{row.index}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {row.month}
                      {row.matchedEmi && (
                        <div className="text-[11px] font-normal text-slate-500">
                          {row.matchedEmi.mode}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {row.state === 'PAID' && row.matchedEmi ? (
                        <div>
                          <div className="font-mono-num font-semibold text-slate-800">
                            {row.matchedEmi.date}
                          </div>
                          <div className="text-[11px] font-mono-num text-emerald-700">
                            {row.daysCount} दिवस
                          </div>
                        </div>
                      ) : isAdmin && loan.status === 'Active' ? (
                        <div className="space-y-0.5">
                          <input
                            type="date"
                            value={row.effectiveDate}
                            onChange={(e) => handleManualDateChange(row.index, e.target.value)}
                            className={`rounded-lg border px-2 py-1 text-[11px] font-mono-num font-semibold focus:outline-none focus:ring-1 ${
                              row.isCustomDate
                                ? 'border-amber-400 bg-amber-50 text-amber-900 focus:ring-amber-500'
                                : 'border-slate-300 bg-white text-slate-800 focus:border-indigo-500 focus:ring-indigo-500'
                            }`}
                          />
                          <div className="flex items-center gap-1.5 text-[11px] font-mono-num">
                            <span
                              className={
                                row.isCustomDate ? 'text-amber-700 font-bold' : 'text-slate-500'
                              }
                            >
                              {row.daysCount} दिवस
                            </span>
                            {row.isCustomDate && (
                              <button
                                type="button"
                                onClick={() => handleManualDateChange(row.index, '')}
                                className="text-indigo-600 hover:underline font-sans text-[10px] cursor-pointer no-print"
                                title="नियोजित तारखेवर परत या"
                              >
                                रीसेट
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="font-mono-num text-slate-700">{row.effectiveDate}</div>
                          <div className="text-[11px] font-mono-num text-slate-500">
                            {row.daysCount} दिवस
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-slate-700">
                      ₹ {row.openingBalance.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num font-semibold text-slate-900">
                      ₹ {row.emiAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-emerald-700 font-medium">
                      ₹ {row.principalComponent.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-amber-700 font-medium">
                      ₹ {row.interestComponent.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-slate-700">
                      ₹ {row.closingBalance.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3">
                      {row.state === 'PAID' && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>भरला (Paid)</span>
                        </span>
                      )}
                      {row.state === 'PENDING' && (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-semibold">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>थकीत (Pending)</span>
                        </span>
                      )}
                      {row.state === 'UPCOMING' && (
                        <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>येणारा (Upcoming)</span>
                        </span>
                      )}
                    </td>
                    {isAdmin && loan.status === 'Active' && (
                      <td className="py-2.5 px-3 text-center no-print">
                        {row.state !== 'PAID' && onPayEmiClick ? (
                          <button
                            onClick={() => onPayEmiClick(loan, row.month, row.effectiveDate)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition cursor-pointer whitespace-nowrap"
                          >
                            + हप्ता भरा
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">✓ पूर्ण</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
