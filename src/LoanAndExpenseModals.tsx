import React, { useState, useEffect } from 'react';
import { X, Calculator, Lock } from 'lucide-react';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { db, SOCIETY_OWNER_ID, handleFirestoreError, OperationType } from './firebase';
import { Loan, Member, MonthlyContribution } from './types';
import { compressImageFile, getCurrentMonthYearString, calculateAge } from './utils';

interface LoanSanctionModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const LoanSanctionModal: React.FC<LoanSanctionModalProps> = ({
  isOpen,
  onClose,
  members,
  onNotify,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [loanDate, setLoanDate] = useState(todayStr);
  const [memberDocId, setMemberDocId] = useState('');
  const [principal, setPrincipal] = useState('100000');
  const [interestRate, setInterestRate] = useState('8');
  const [months, setMonths] = useState('12');
  const [startMonth, setStartMonth] = useState(getCurrentMonthYearString());
  const [guarantor, setGuarantor] = useState('');
  const [mortgage, setMortgage] = useState('पगार हमीपत्र व शेअर तारण');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const selectedMember = members.find((m) => m.docId === memberDocId);
  const pVal = Math.max(0, Number(principal) || 0);
  const rVal = Math.max(0, Number(interestRate) || 8);
  const mVal = Math.max(1, Number(months) || 12);

  const deduction10 = Math.round(pVal * 0.1);
  const netDisbursed = pVal - deduction10;
  const totalInterest = Math.round((pVal * rVal * mVal) / (12 * 100));
  const totalPayable = pVal + totalInterest;
  const monthlyEmi = Math.round(totalPayable / mVal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !pVal || !mVal || !startMonth.trim()) {
      onNotify('कृपया कर्ज मंजुरीची सर्व आवश्यक माहिती भरा!', 'error');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'loans'), {
        memberDocId: selectedMember.docId,
        memberName: selectedMember.name.slice(0, 120),
        loanDate: loanDate.slice(0, 32),
        principal: pVal,
        interestRate: rVal,
        months: mVal,
        totalInterest,
        totalPayable,
        monthlyEmi,
        startMonth: startMonth.trim().slice(0, 48),
        guarantor: (guarantor.trim() || '-').slice(0, 150),
        mortgage: (mortgage.trim() || '-').slice(0, 200),
        status: 'Active',
        ownerId: SOCIETY_OWNER_ID,
      });
      onNotify('नवीन कर्ज यशस्वीरित्या मंजूर व जतन केले! ⚡', 'success');
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'loans');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 my-8 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-700 to-blue-700 px-6 py-4 text-white flex items-center justify-between">
          <h3 className="text-base font-bold">⚡ नवीन कर्ज मंजुरी (Loan Sanction)</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                मंजुरी दिनांक *
              </label>
              <input
                type="date"
                required
                value={loanDate}
                onChange={(e) => setLoanDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                हप्ता सुरू महिना *
              </label>
              <input
                type="text"
                required
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                placeholder="January 2026"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              सभासद निवडा *
            </label>
            <select
              required
              value={memberDocId}
              onChange={(e) => setMemberDocId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm"
            >
              <option value="">-- सभासद निवडा --</option>
              {members.map((m) => (
                <option key={m.docId} value={m.docId}>
                  {m.id} — {m.name} ({m.designation})
                </option>
              ))}
            </select>
            {selectedMember && (
              <p className="text-xs text-slate-500 mt-1">
                पत्ता: {selectedMember.officeAddress} · {selectedMember.homeAddress}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                कर्ज रक्कम (₹) *
              </label>
              <input
                type="number"
                required
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono-num font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                व्याजदर (%) *
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                महिने (Months) *
              </label>
              <input
                type="number"
                required
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono-num"
              />
            </div>
          </div>

          {/* Live Calculation Breakdown Box */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[11px] text-rose-600 font-medium">१०% वर्गणी कपात</p>
              <p className="text-sm font-bold text-rose-700 font-mono-num">
                ₹ {deduction10.toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-emerald-700 font-medium">प्रत्यक्ष वितरण रक्कम</p>
              <p className="text-sm font-bold text-emerald-800 font-mono-num">
                ₹ {netDisbursed.toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-blue-700 font-medium">मासिक EMI</p>
              <p className="text-sm font-bold text-blue-800 font-mono-num">
                ₹ {monthlyEmi.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                जामीनदार (Guarantor)
              </label>
              <input
                type="text"
                value={guarantor}
                onChange={(e) => setGuarantor(e.target.value)}
                placeholder="जामीनदाराचे नाव व पद"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                तारण तपशील (Mortgage)
              </label>
              <input
                type="text"
                value={mortgage}
                onChange={(e) => setMortgage(e.target.value)}
                placeholder="पगार हमीपत्र / शेअर तारण"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 py-3 text-sm font-bold text-white shadow-sm transition cursor-pointer"
          >
            {saving ? 'जतन होत आहे...' : 'कर्ज मंजूर व जतन करा'}
          </button>
        </form>
      </div>
    </div>
  );
};

interface PayEmiModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan | null;
  defaultMonth?: string;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const PayEmiModal: React.FC<PayEmiModalProps> = ({
  isOpen,
  onClose,
  loan,
  defaultMonth,
  onNotify,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayStr);
  const [month, setMonth] = useState('');
  const [mode, setMode] = useState<'Cash' | 'Cheque' | 'Bank Transfer' | 'Salary Deduction'>(
    'Salary Deduction'
  );
  const [chequeNo, setChequeNo] = useState('');
  const [amount, setAmount] = useState('');
  const [photo, setPhoto] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loan && isOpen) {
      setDate(todayStr);
      setMonth(defaultMonth || getCurrentMonthYearString());
      setAmount(String(loan.monthlyEmi || 0));
      setPhoto('');
      setChequeNo('');
    }
  }, [loan, defaultMonth, isOpen]);

  if (!isOpen || !loan) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const b64 = await compressImageFile(e.target.files[0], 400);
        setPhoto(b64);
      } catch {
        onNotify('पावती फोटो अपलोड करताना अडचण आली.', 'error');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !month.trim() || !amount) {
      onNotify('कृपया तारीख, महिना आणि हप्ता रक्कम भरा!', 'error');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'loan_emis'), {
        loanDocId: loan.docId,
        date: date.slice(0, 32),
        month: month.trim().slice(0, 48),
        mode,
        chequeNo: (chequeNo.trim() || '').slice(0, 64),
        amount: Math.max(0, Number(amount) || 0),
        photo: photo.slice(0, 800000),
        ownerId: SOCIETY_OWNER_ID,
      });
      onNotify('कर्ज हप्ता (EMI) यशस्वीरित्या जमा झाला! ✅', 'success');
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'loan_emis');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-700 to-teal-600 px-6 py-4 text-white flex items-center justify-between">
          <h3 className="text-base font-bold">💳 कर्जाचा हप्ता भरा (Pay EMI)</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">सभासदाचे नाव</label>
            <input
              type="text"
              readOnly
              value={loan.memberName}
              className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">दिनांक *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                महिना व वर्ष *
              </label>
              <input
                type="text"
                required
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                placeholder="January 2026"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                पेमेंट प्रकार (Mode)
              </label>
              <select
                value={mode}
                onChange={(e) =>
                  setMode(
                    e.target.value as 'Cash' | 'Cheque' | 'Bank Transfer' | 'Salary Deduction'
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
              >
                <option value="Salary Deduction">पगार कपात (Salary)</option>
                <option value="Cash">रोख (Cash)</option>
                <option value="Bank Transfer">बँक ट्रान्सफर / UPI</option>
                <option value="Cheque">चेक (Cheque)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                हप्ता रक्कम (₹) *
              </label>
              <input
                type="number"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm font-mono-num font-bold"
              />
            </div>
          </div>

          {mode === 'Cheque' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                चेक क्रमांक (Cheque No)
              </label>
              <input
                type="text"
                value={chequeNo}
                onChange={(e) => setChequeNo(e.target.value)}
                placeholder="चेक नंबर टाका"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              पावती किंवा चेकचा फोटो (ऐच्छिक)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 py-3 text-sm font-bold text-white shadow-sm transition cursor-pointer"
          >
            {saving ? 'जतन होत आहे...' : 'हप्ता जतन करा'}
          </button>
        </form>
      </div>
    </div>
  );
};

interface CloseLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan | null;
  currentBalance: number;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const CloseLoanModal: React.FC<CloseLoanModalProps> = ({
  isOpen,
  onClose,
  loan,
  currentBalance,
  onNotify,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [closureDate, setClosureDate] = useState(todayStr);
  const [closureAmount, setClosureAmount] = useState('0');
  const [closureRemarks, setClosureRemarks] = useState('कर्ज पूर्ण परतफेड करून खाते बंद केले.');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loan && isOpen) {
      setClosureDate(todayStr);
      setClosureAmount(String(currentBalance));
      setClosureRemarks('कर्ज पूर्ण परतफेड करून खाते बंद केले.');
    }
  }, [loan, currentBalance, isOpen]);

  if (!isOpen || !loan) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, 'loans', loan.docId), {
        status: 'Closed',
        closureDate: closureDate.slice(0, 32),
        closureAmount: Math.max(0, Number(closureAmount) || 0),
        closureRemarks: closureRemarks.trim().slice(0, 250),
      });
      onNotify('कर्ज खाते यशस्वीरित्या बंद करण्यात आले! 🔒', 'success');
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `loans/${loan.docId}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-rose-700 to-red-600 px-6 py-4 text-white flex items-center justify-between">
          <h3 className="text-base font-bold">🔒 कर्ज खाते बंद करणे (Loan Closure)</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">सभासदाचे नाव</label>
            <input
              type="text"
              readOnly
              value={loan.memberName}
              className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-sm font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                बंद केल्याची तारीख *
              </label>
              <input
                type="date"
                required
                value={closureDate}
                onChange={(e) => setClosureDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                अंतिम भरणा रक्कम (₹)
              </label>
              <input
                type="number"
                required
                value={closureAmount}
                onChange={(e) => setClosureAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm font-mono-num font-bold text-rose-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              शेरा / कारण (Remarks)
            </label>
            <input
              type="text"
              required
              value={closureRemarks}
              onChange={(e) => setClosureRemarks(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 py-3 text-sm font-bold text-white shadow-sm transition cursor-pointer"
          >
            {saving ? 'बंद करत आहे...' : 'कर्ज खाते यशस्वी बंद करा'}
          </button>
        </form>
      </div>
    </div>
  );
};

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const ExpenseFormModal: React.FC<ExpenseModalProps> = ({ isOpen, onClose, onNotify }) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [voucherNo, setVoucherNo] = useState('');
  const [date, setDate] = useState(todayStr);
  const [category, setCategory] = useState('स्टेशनरी खर्च (Stationery)');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'Cash' | 'Bank Transfer' | 'Cheque' | 'UPI'>('Cash');
  const [photo, setPhoto] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVoucherNo(`VOU-${Math.floor(1000 + Math.random() * 9000)}`);
      setDate(todayStr);
      setDescription('');
      setAmount('');
      setPhoto('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const b64 = await compressImageFile(e.target.files[0], 420);
        setPhoto(b64);
      } catch {
        onNotify('बिल फोटो प्रोसेस करताना अडचण आली.', 'error');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !description.trim() || !amount) {
      onNotify('कृपया दिनांक, तपशील आणि रक्कम भरा!', 'error');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'expenses'), {
        voucherNo: voucherNo.slice(0, 64),
        date: date.slice(0, 32),
        category: category.slice(0, 120),
        description: description.trim().slice(0, 250),
        amount: Math.max(0, Number(amount) || 0),
        mode,
        photo: photo.slice(0, 800000),
        ownerId: SOCIETY_OWNER_ID,
      });
      onNotify('खर्च वाउचर यशस्वीरित्या जतन केले! ✅', 'success');
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'expenses');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-rose-700 to-orange-600 px-6 py-4 text-white flex items-center justify-between">
          <h3 className="text-base font-bold">💸 कार्यालयीन खर्च व डिजिटल वाउचर नोंद</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                वाउचर क्र. (Auto)
              </label>
              <input
                type="text"
                readOnly
                value={voucherNo}
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-sm font-mono-num font-bold text-rose-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">दिनांक *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              खर्चाचा प्रकार (Category)
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm"
            >
              <option value="स्टेशनरी खर्च (Stationery)">स्टेशनरी खर्च (Stationery)</option>
              <option value="बँक चार्ज व कमीशन (Bank Charges)">
                बँक चार्ज व कमीशन (Bank Charges)
              </option>
              <option value="मीटिंग भत्ता व जलपान (Meeting & Refreshment)">
                मीटिंग भत्ता व जलपान (Meeting & Refreshment)
              </option>
              <option value="ऑडिट व कायदेशीर खर्च (Audit & Legal)">
                ऑडिट व कायदेशीर खर्च (Audit & Legal)
              </option>
              <option value="इतर कार्यालयीन खर्च (Other Expenses)">
                इतर कार्यालयीन खर्च (Other Expenses)
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              तपशील / देणाऱ्याचे नाव (Paid To / Description) *
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="उदा. श्री गणेश प्रिंटर्स / बँक कमिशन"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                रक्कम (₹) *
              </label>
              <input
                type="number"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1500"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm font-mono-num font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                पेमेंट पद्धत (Mode)
              </label>
              <select
                value={mode}
                onChange={(e) =>
                  setMode(e.target.value as 'Cash' | 'Bank Transfer' | 'Cheque' | 'UPI')
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
              >
                <option value="Cash">रोख (Cash)</option>
                <option value="UPI">UPI / Online</option>
                <option value="Bank Transfer">बँक ट्रान्सफर</option>
                <option value="Cheque">चेक (Cheque)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              खर्चाची बिल पावती अपलोड करा (Digital Voucher Photo)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 py-3 text-sm font-bold text-white shadow-sm transition cursor-pointer"
          >
            {saving ? 'जतन होत आहे...' : 'खर्च वाउचर जतन करा'}
          </button>
        </form>
      </div>
    </div>
  );
};
