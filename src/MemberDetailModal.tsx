import React from 'react';
import { X, Printer, Plus } from 'lucide-react';
import { Member, MonthlyContribution } from './types';
import { calculateAge, parseMonthYear } from './utils';

export const DEFAULT_AVATAR_URL =
  'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';

interface MemberDetailModalProps {
  member: Member | null;
  contributions: MonthlyContribution[];
  onClose: () => void;
  isAdmin?: boolean;
  onAddContributionForMember?: (member: Member) => void;
  onEditContribution?: (contrib: MonthlyContribution) => void;
  onDeleteContribution?: (contrib: MonthlyContribution) => void;
}

export const MemberDetailModal: React.FC<MemberDetailModalProps> = ({
  member,
  contributions,
  onClose,
  isAdmin = true,
  onAddContributionForMember,
  onEditContribution,
  onDeleteContribution,
}) => {
  if (!member) return null;

  // Sort Oldest to Newest (जुनी ते नवीन क्रम) just like 1111.png
  const memberContribs = contributions
    .filter((c) => c.memberDocId === member.docId)
    .sort((a, b) => parseMonthYear(a.month).getTime() - parseMonthYear(b.month).getTime());

  const totalContrib = memberContribs.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const avatarSrc = member.photo && member.photo.trim() !== '' ? member.photo : DEFAULT_AVATAR_URL;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl border border-slate-200 my-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header matching 1111.png with colorful Material touch */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 via-indigo-50/70 to-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">👤</span>
            <h3 className="text-lg sm:text-xl font-extrabold text-blue-700 tracking-tight">
              सभासद संपूर्ण माहिती व वर्गणी इतिहास
            </h3>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>प्रिंट</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-7 space-y-6 max-h-[82vh] overflow-y-auto">
          {/* Top Profile Grid: Left Avatar + ID Badge | Right Detailed Lines */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-5 rounded-2xl border border-slate-200/90 shadow-xs">
            {/* Left Column: Avatar Box + ID Pill */}
            <div className="md:col-span-4 flex flex-col items-center justify-center">
              <div className="w-36 h-36 rounded-3xl border-4 border-blue-600 bg-white p-1.5 shadow-lg overflow-hidden flex items-center justify-center">
                <img
                  src={avatarSrc}
                  alt={member.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain rounded-2xl"
                />
              </div>
              <div className="mt-3 px-4 py-1 rounded-lg bg-blue-600 text-white text-sm font-extrabold tracking-wide shadow-sm">
                ID: {member.id}
              </div>
            </div>

            {/* Right Column: Rich Line-by-Line Details */}
            <div className="md:col-span-8 space-y-2 text-left">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight uppercase">
                  {member.name}
                </h2>
                <div className="mt-1.5">
                  <span
                    className={`inline-block px-3.5 py-1 rounded-lg text-xs font-extrabold text-white shadow-xs ${
                      member.status === 'Active' ? 'bg-emerald-600' : 'bg-slate-500'
                    }`}
                  >
                    {member.status === 'Active' ? 'Active (सक्रिय)' : 'Inactive (निष्क्रिय)'}
                  </span>
                </div>
              </div>

              <div className="pt-1 space-y-1.5 text-sm text-slate-700">
                <p className="font-bold text-blue-700 flex items-center gap-2">
                  <span>💼</span>
                  <span>पद: {member.designation || '-'}</span>
                </p>

                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>🎂 जन्म तारीख:</span>
                  <strong className="text-slate-900 font-mono-num">{member.dob || '-'}</strong>
                  <span className="text-slate-400">|</span>
                  <span>वय:</span>
                  <strong className="text-slate-900">{calculateAge(member.dob)}</strong>
                </p>

                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>📧 ईमेल:</span>
                  <strong className="text-slate-900">{member.email || '-'}</strong>
                  <span className="text-slate-400">|</span>
                  <span>📞 मोबाईल:</span>
                  <strong className="text-slate-900 font-mono-num">{member.mobile || '-'}</strong>
                </p>

                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>💳 पॅन:</span>
                  <strong className="text-slate-900 font-mono-num uppercase">
                    {member.pan || '-'}
                  </strong>
                  {member.aadhaar && member.aadhaar !== '-' && (
                    <>
                      <span className="text-slate-400">|</span>
                      <span>🆔 आधार:</span>
                      <strong className="text-slate-900 font-mono-num">{member.aadhaar}</strong>
                    </>
                  )}
                </p>

                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>👤 युजरनेम:</span>
                  <strong className="text-slate-900 font-mono-num">
                    {member.loginUser || member.id}
                  </strong>
                  <span className="text-slate-400">|</span>
                  <span>🔑 पासवर्ड:</span>
                  <strong className="text-slate-900 font-mono-num">
                    {member.loginPass || '123456'}
                  </strong>
                </p>

                <p className="flex items-center gap-2">
                  <span>📅 सामील दिनांक:</span>
                  <strong className="text-slate-900 font-mono-num">
                    {member.joiningDate || '-'}
                  </strong>
                </p>

                <p className="flex items-start gap-2">
                  <span className="shrink-0">🏢 कार्यालय पत्ता:</span>
                  <strong className="text-slate-900">{member.officeAddress || '-'}</strong>
                </p>

                {member.homeAddress && member.homeAddress !== '-' && (
                  <p className="flex items-start gap-2">
                    <span className="shrink-0">🏠 घरचा पत्ता:</span>
                    <strong className="text-slate-900">{member.homeAddress}</strong>
                  </p>
                )}

                <p className="flex items-center gap-2">
                  <span>👥 वारसदार:</span>
                  <strong className="text-slate-900">{member.nominee || '-'}</strong>
                  {member.nomineeRelation && member.nomineeRelation !== '-' && (
                    <span className="text-slate-600 font-medium">({member.nomineeRelation})</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Two Summary Stat Boxes side-by-side matching 1111.png */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="px-5 py-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50/60 border border-emerald-200 flex items-center justify-between shadow-2xs">
              <span className="text-sm font-bold text-slate-700">शेअर कॅपिटल:</span>
              <span className="text-xl font-extrabold text-emerald-700 font-mono-num">
                ₹ {Number(member.share || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="px-5 py-4 rounded-2xl bg-gradient-to-r from-sky-50 to-blue-50/60 border border-sky-200 flex items-center justify-between shadow-2xs">
              <span className="text-sm font-bold text-slate-700">एकूण जमा वर्गणी:</span>
              <span className="text-xl font-extrabold text-sky-600 font-mono-num">
                ₹ {totalContrib.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Contribution History Section with "+ वर्गणी जोडा" button */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-sm sm:text-base font-extrabold text-slate-700 flex items-center gap-2">
                <span>🗓️</span>
                <span>वर्गणी इतिहास (जुनी ते नवीन क्रम)</span>
              </h4>

              {isAdmin && onAddContributionForMember && (
                <button
                  onClick={() => onAddContributionForMember(member)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-sm transition cursor-pointer no-print"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ वर्गणी जोडा</span>
                </button>
              )}
            </div>

            {/* Clean Centered Grid Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-300 shadow-2xs max-h-64">
              <table className="w-full border-collapse text-xs sm:text-sm text-center">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 sticky top-0 z-10">
                    <th className="py-3 px-3 font-extrabold border-r border-slate-200">अ.क्र.</th>
                    <th className="py-3 px-3 font-extrabold border-r border-slate-200">पावती क्र.</th>
                    <th className="py-3 px-3 font-extrabold border-r border-slate-200">दिनांक</th>
                    <th className="py-3 px-3 font-extrabold border-r border-slate-200">
                      महिना व वर्ष
                    </th>
                    <th className="py-3 px-3 font-extrabold border-r border-slate-200">रक्कम</th>
                    {isAdmin && (
                      <th className="py-3 px-3 font-extrabold no-print">कृती</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {memberContribs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isAdmin ? 6 : 5}
                        className="py-8 text-center text-slate-400 font-medium"
                      >
                        या सभासदाची कोणतीही मासिक वर्गणी अद्याप नोंदवलेली नाही.
                      </td>
                    </tr>
                  ) : (
                    memberContribs.map((c, idx) => (
                      <tr key={c.docId} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-3 px-3 font-mono-num font-semibold text-slate-700 border-r border-slate-200">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3 border-r border-slate-200">
                          <span className="inline-block px-2.5 py-0.5 rounded-md bg-blue-600 text-white text-xs font-extrabold font-mono-num shadow-2xs">
                            {c.receiptNo}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono-num text-slate-700 border-r border-slate-200">
                          {c.date}
                        </td>
                        <td className="py-3 px-3 font-extrabold text-slate-900 uppercase border-r border-slate-200">
                          {c.month}
                        </td>
                        <td className="py-3 px-3 font-mono-num font-extrabold text-emerald-700 border-r border-slate-200">
                          ₹ {Number(c.amount || 0).toLocaleString('en-IN')}
                        </td>
                        {isAdmin && (
                          <td className="py-2.5 px-3 no-print">
                            <div className="flex items-center justify-center gap-2">
                              {onEditContribution && (
                                <button
                                  onClick={() => onEditContribution(c)}
                                  className="px-3 py-1 rounded-lg border border-blue-500 text-blue-600 hover:bg-blue-600 hover:text-white text-xs font-bold transition cursor-pointer"
                                >
                                  सुधार
                                </button>
                              )}
                              {onDeleteContribution && (
                                <button
                                  onClick={() => onDeleteContribution(c)}
                                  className="px-3 py-1 rounded-lg border border-rose-500 text-rose-600 hover:bg-rose-600 hover:text-white text-xs font-bold transition cursor-pointer"
                                >
                                  डिलिट
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
