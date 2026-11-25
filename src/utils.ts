import { Loan, LoanEmi, Member, MonthlyContribution } from './types';

export function calculateAge(dobString: string): string {
  if (!dobString) return '-';
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return '-';
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return `${age} वर्षे`;
}

export function isBirthdayThisMonth(dobString: string): boolean {
  if (!dobString) return false;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return false;
  const today = new Date();
  return dob.getMonth() === today.getMonth();
}

export function isTodayBirthday(dobString: string): boolean {
  if (!dobString) return false;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return false;
  const today = new Date();
  return dob.getDate() === today.getDate() && dob.getMonth() === today.getMonth();
}

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

const DISPLAY_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function parseMonthYear(mStr: string): Date {
  if (!mStr) return new Date(2000, 0, 1);
  const parts = mStr.trim().split(/\s+/);
  let mIndex = 0;
  let year = 2026;
  parts.forEach((p) => {
    const low = p.toLowerCase();
    if (MONTH_NAMES.includes(low)) {
      mIndex = MONTH_NAMES.indexOf(low);
    }
    const num = parseInt(p, 10);
    if (!isNaN(num) && p.length === 4) {
      year = num;
    }
  });
  return new Date(year, mIndex, 1);
}

export function getNextMonthString(startStr: string, addMonths: number): string {
  const baseDate = parseMonthYear(startStr);
  baseDate.setMonth(baseDate.getMonth() + addMonths);
  return `${DISPLAY_MONTHS[baseDate.getMonth()]} ${baseDate.getFullYear()}`;
}

export function getCurrentMonthYearString(): string {
  const now = new Date();
  return `${DISPLAY_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}

export function buildWhatsAppBirthdayUrl(memberName: string, mobileNumber: string): string {
  let cleanMobile = mobileNumber ? mobileNumber.replace(/[^0-9]/g, '') : '';
  if (cleanMobile.length === 10) {
    cleanMobile = '91' + cleanMobile;
  }
  const msg = `🌟 *वाढदिवसाच्या हार्दिक शुभेच्छा!* 🌟\n\nआदरणीय *${memberName} जी*,\n\nआपणास वाढदिवसाच्या निमित्ताने जिल्हा परिषद अभियंता व तांत्रिक कर्मचारी सहकारी पत संस्था मर्या. गडचिरोली परिवारच्या वतीने मनःपूर्वक हार्दिक शुभेच्छा! 💐🎂\n\nईश्वर आपल्याला उत्तम आरोग्य, दीर्घायुष्य आणि यशोश्री प्रदान करो, हीच सदिच्छा!\n\n- *अध्यक्ष*, \nजिल्हा परिषद अभियंता व तांत्रिक कर्मचारी सहकारी पत संस्था मर्या. गडचिरोली`;
  const encodedMsg = encodeURIComponent(msg);
  return cleanMobile
    ? `https://wa.me/${cleanMobile}?text=${encodedMsg}`
    : `https://wa.me/?text=${encodedMsg}`;
}

export function compressImageFile(file: File, maxDimension = 420): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.72);
          resolve(compressed);
        } else {
          resolve(event.target?.result as string);
        }
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

export function exportMembersToCSV(
  members: Member[],
  contributions: MonthlyContribution[]
): void {
  const headers = [
    'अ.क्र.',
    'सभासद आयडी',
    'पूर्ण नाव',
    'पद (Designation)',
    'मोबाईल नंबर',
    'ईमेल',
    'पॅन कार्ड',
    'आधार नंबर',
    'जन्मतारीख',
    'सामील दिनांक',
    'स्थिती',
    'शेअर कॅपिटल (₹)',
    'एकूण जमा वर्गणी (₹)',
    'कार्यालय पत्ता',
    'घरचा पत्ता',
    'वारसदार (Nominee)',
    'नाते',
  ];

  const rows = members.map((m, idx) => {
    const totalContrib = contributions
      .filter((c) => c.memberDocId === m.docId)
      .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    return [
      idx + 1,
      m.id,
      m.name,
      m.designation,
      m.mobile,
      m.email,
      m.pan,
      m.aadhaar,
      m.dob,
      m.joiningDate,
      m.status,
      m.share,
      totalContrib,
      m.officeAddress,
      m.homeAddress,
      m.nominee,
      m.nomineeRelation,
    ]
      .map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`)
      .join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'ZillaParishad_Members_List.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function buildDueDateString(monthYearStr: string, emiDay: number): string {
  const base = parseMonthYear(monthYearStr);
  const year = base.getFullYear();
  const monthIdx = base.getMonth();
  const maxDayInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const clampedDay = Math.min(maxDayInMonth, Math.max(1, Math.floor(emiDay || 1)));
  return `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

export function diffDaysISO(fromDateStr: string, toDateStr: string): number {
  if (!fromDateStr || !toDateStr) return 0;
  const parseUTC = (s: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
    if (!m) return NaN;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };
  const fromMs = parseUTC(fromDateStr);
  const toMs = parseUTC(toDateStr);
  if (isNaN(fromMs) || isNaN(toMs)) return 0;
  return Math.max(0, Math.round((toMs - fromMs) / 86400000));
}

export interface DayWiseScheduleRow {
  index: number;
  month: string;
  dueDate: string;
  prevDate: string;
  effectiveDate: string;
  daysCount: number;
  openingBalance: number;
  emiAmount: number;
  principalComponent: number;
  interestComponent: number;
  closingBalance: number;
  state: 'PAID' | 'PENDING' | 'UPCOMING';
  matchedEmi?: LoanEmi;
  isCustomDate: boolean;
}

export interface DayWiseScheduleResult {
  rows: DayWiseScheduleRow[];
  emiDay: number;
  totalPaidAmount: number;
  paidEmiCount: number;
  missedCount: number;
  remainingPrincipal: number;
  totalInterestAccrued: number;
}

export function computeDayWiseLoanSchedule(
  loan: Loan,
  emis: LoanEmi[],
  manualDatesByIndex: Record<number, string> = {},
  customAmountByIndex: Record<number, number> = {}
): DayWiseScheduleResult {
  const loanEmis = emis
    .filter((e) => e.loanDocId === loan.docId)
    .sort((a, b) => parseMonthYear(a.month).getTime() - parseMonthYear(b.month).getTime());

  const totalPaidAmount = loanEmis.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const paidEmiCount = loanEmis.length;
  const totalEmiMonths = Number(loan.months) || 12;

  const startMonStr = loan.startMonth || 'January 2026';
  const emiDay = Math.min(31, Math.max(1, Number(loan.emiDay) || 1));
  const monthlyEmiVal = Number(loan.monthlyEmi) || 0;
  const annualRate = Number(loan.interestRate) || 8;

  const currentDate = new Date();
  const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

  let balance = Number(loan.principal) || 0;
  let prevDate = loan.loanDate || buildDueDateString(startMonStr, emiDay);
  let remainingPrincipalAfterPaid = balance;
  let missedCount = 0;
  let totalInterestAccrued = 0;

  const rows: DayWiseScheduleRow[] = [];

  for (let i = 0; i < totalEmiMonths; i++) {
    const rowIndex = i + 1;
    const targetMonthStr = getNextMonthString(startMonStr, i);
    const matchedEmi = loanEmis.find(
      (e) => e.month && e.month.toLowerCase().trim() === targetMonthStr.toLowerCase().trim()
    );

    const rawDueDate = buildDueDateString(targetMonthStr, emiDay);
    const defaultUnpaidDate = rawDueDate < prevDate ? prevDate : rawDueDate;
    const manualDate = manualDatesByIndex[rowIndex];
    const effectiveDate = matchedEmi
      ? matchedEmi.date || defaultUnpaidDate
      : manualDate || defaultUnpaidDate;
    const isCustomDate = !matchedEmi && !!manualDate && manualDate !== defaultUnpaidDate;

    const daysCount = diffDaysISO(prevDate, effectiveDate);
    const openingBalance = balance;
    const emiAmount = matchedEmi
      ? Number(matchedEmi.amount) || 0
      : customAmountByIndex[rowIndex] !== undefined
      ? customAmountByIndex[rowIndex]
      : monthlyEmiVal;

    const interestComponent =
      openingBalance > 0
        ? Math.round((openingBalance * annualRate * daysCount) / (365 * 100))
        : 0;
    const principalComponent = Math.min(
      openingBalance,
      Math.max(0, emiAmount - interestComponent)
    );
    const closingBalance = Math.max(0, openingBalance - principalComponent);

    balance = closingBalance;
    totalInterestAccrued += interestComponent;

    let state: 'PAID' | 'PENDING' | 'UPCOMING' = 'UPCOMING';
    if (matchedEmi) {
      state = 'PAID';
      remainingPrincipalAfterPaid = closingBalance;
    } else if (parseMonthYear(targetMonthStr) <= currentMonthStart && loan.status !== 'Closed') {
      state = 'PENDING';
      missedCount++;
    }

    rows.push({
      index: rowIndex,
      month: targetMonthStr,
      dueDate: defaultUnpaidDate,
      prevDate,
      effectiveDate,
      daysCount,
      openingBalance,
      emiAmount,
      principalComponent,
      interestComponent,
      closingBalance,
      state,
      matchedEmi,
      isCustomDate,
    });

    prevDate = effectiveDate;
  }

  return {
    rows,
    emiDay,
    totalPaidAmount,
    paidEmiCount,
    missedCount,
    remainingPrincipal: loan.status === 'Closed' ? 0 : remainingPrincipalAfterPaid,
    totalInterestAccrued,
  };
}
