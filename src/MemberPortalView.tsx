import React, { useState } from 'react';
import {
  User,
  Phone,
  Mail,
  Building2,
  Home,
  Calendar,
  ShieldCheck,
  KeyRound,
  Wallet,
  TrendingUp,
  CheckCircle2,
  Printer,
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Loan, LoanEmi, Member, MonthlyContribution } from './types';
import { calculateAge, parseMonthYear } from './utils';
import { AmortizationScheduleView } from './AmortizationScheduleView';
import { DEFAULT_AVATAR_URL } from './MemberDetailModal';

interface MemberPortalViewProps {
  member: Member;
  contributions: MonthlyContribution[];
  loans: Loan[];
  emis: LoanEmi[];
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const MemberPortalView: React.FC<MemberPortalViewProps> = ({
  member,
  contributions,
  loans,
  emis,
  onNotify,
}) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPass, setIsUpdatingPass] = useState(false);

  const memberContribs = contributions
    .filter((c) => c.memberDocId === member.docId)
    .sort((a, b) => parseMonthYear(b.month).getTime() - parseMonthYear(a.month).getTime());

  const totalContribSum = memberContribs.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const memberLoans = loans.filter((l) => l.memberDocId === member.docId);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentStoredPass = member.loginPass || '123456';
    if (!oldPassword.trim() || !newPassword.trim()) {
      onNotify('कृपया जुना आणि नवीन पासवर्ड दोन्ही भरा!', 'error');
      return;
    }
    if (oldPassword.trim() !== currentStoredPass) {
      onNotify('चुकीचा जुना पासवर्ड! कृपया योग्य जुना पासवर्ड टाका.', 'error');
      return;
    }
    if (newPassword.trim().length < 4) {
      onNotify('नवीन पासवर्ड किमान ४ अक्षरांचा असावा.', 'error');
      return;
    }

    setIsUpdatingPass(true);
    try {
      await updateDoc(doc(db, 'members', member.docId), {
        loginPass: newPassword.trim(),
      });
      setOldPassword('');
      setNewPassword('');
      onNotify('पासवर्ड यशस्वीरित्या बदलला गेला आहे! ✅', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `members/${member.docId}`);
    } finally {
      setIsUpdatingPass(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="bg-gradient-to-r from-blue-800 via-indigo-700 to-teal-700 px-6 py-6 text-white">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-28 h-28 rounded-2xl bg-white p-1.5 border-4 border-white/60 overflow-hidden flex items-center justify-center shrink-0 shadow-lg">
              <img
                src={member.photo && member.photo.trim() !== '' ? member.photo : DEFAULT_AVATAR_URL}
                alt={member.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain rounded-xl"
              />
            </div>
            <div className="text-center md:text-left flex-1">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs text-blue-100">
                <span className="font-mono-num font-semibold">सभासद आयडी: {member.id}</span>
                <span aria-hidden="true">·</span>
                <span>{member.designation}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {member.status === 'Active' ? 'सक्रिय सभासद' : 'निष्क्रिय'}
                </span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight mt-1">{member.name}</h2>
              <div className="mt-3 flex flex-wrap items-center justify-center md:justify-start gap-x-5 gap-y-1.5 text-xs text-blue-100">
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  <span className="font-mono-num">{member.mobile || '-'}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  <span>{member.email || '-'}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    जन्म: <span className="font-mono-num">{member.dob}</span> ({calculateAge(member.dob)})
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>पॅन: <span className="font-mono-num">{member.pan || '-'}</span></span>
                </span>
              </div>
            </div>
            <div className="no-print">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 px-4 py-2.5 text-xs font-semibold text-white transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>प्रोफाइल प्रिंट करा</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/60 border-t border-slate-200">
          <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">माझे शेअर कॅपिटल (Share Capital)</p>
              <p className="text-2xl font-bold text-emerald-700 font-mono-num mt-1">
                ₹ {Number(member.share || 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wallet className="w-6 h-6" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">एकूण जमा मासिक वर्गणी</p>
              <p className="text-2xl font-bold text-blue-700 font-mono-num mt-1">
                ₹ {totalContribSum.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs space-y-1.5 text-slate-600">
            <div className="flex items-start gap-2">
              <Building2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-800">कार्यालय:</strong> {member.officeAddress || '-'}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Home className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-800">निवास:</strong> {member.homeAddress || '-'}
              </span>
            </div>
            <div className="pt-1 text-slate-500">
              <strong className="text-slate-800">वारसदार:</strong> {member.nominee || '-'} (
              {member.nomineeRelation || '-'})
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                मासिक वर्गणी जमा इतिहास (Contribution Passbook)
              </h3>
              <p className="text-xs text-slate-500">पगारातून जमा झालेल्या सर्व मासिक वर्गणीची नोंद</p>
            </div>
            <span className="text-xs font-mono-num font-semibold text-slate-600">
              एकूण नोंदी: {memberContribs.length}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-80">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 sticky top-0">
                  <th className="py-3 px-3.5 font-semibold">अ.क्र.</th>
                  <th className="py-3 px-3.5 font-semibold">पावती क्र.</th>
                  <th className="py-3 px-3.5 font-semibold">दिनांक</th>
                  <th className="py-3 px-3.5 font-semibold">महिना व वर्ष</th>
                  <th className="py-3 px-3.5 font-semibold text-right">रक्कम (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {memberContribs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      कोणतीही मासिक वर्गणी अद्याप नोंदवली नाही.
                    </td>
                  </tr>
                ) : (
                  memberContribs.map((c, idx) => (
                    <tr key={c.docId} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3.5 font-mono-num text-slate-500">{idx + 1}</td>
                      <td className="py-2.5 px-3.5 font-mono-num font-semibold text-blue-700">
                        {c.receiptNo}
                      </td>
                      <td className="py-2.5 px-3.5 font-mono-num text-slate-600">{c.date}</td>
                      <td className="py-2.5 px-3.5 font-semibold text-slate-900">{c.month}</td>
                      <td className="py-2.5 px-3.5 text-right font-mono-num font-bold text-emerald-700">
                        ₹ {Number(c.amount).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 no-print">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">पासवर्ड बदला</h3>
              <p className="text-xs text-slate-500">तुमचा वैयक्तिक लॉगिन पासवर्ड अपडेट करा</p>
            </div>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                जुना पासवर्ड (Old Password)
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="जुना पासवर्ड टाका"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                नवीन पासवर्ड (New Password)
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="नवीन पासवर्ड टाका"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isUpdatingPass}
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 py-2.5 text-sm font-semibold text-white shadow-xs transition cursor-pointer"
            >
              {isUpdatingPass ? 'अपडेट होत आहे...' : 'पासवर्ड अपडेट करा'}
            </button>
          </form>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-base font-bold text-slate-900">
          माझे कर्ज खाते व परतफेड शेड्यूल (My Loan Ledger)
        </h3>
        {memberLoans.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
            सध्या तुमच्या नावावर कोणतेही कर्ज मंजूर नाही.
          </div>
        ) : (
          memberLoans.map((l) => (
            <AmortizationScheduleView
              key={l.docId}
              loan={l}
              emis={emis}
              member={member}
              isAdmin={false}
            />
          ))
        )}
      </div>
    </div>
  );
};
