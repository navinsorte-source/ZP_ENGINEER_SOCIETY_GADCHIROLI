import React, { useState, useEffect } from 'react';
import { X, Upload, User, Calculator, Lock } from 'lucide-react';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { db, SOCIETY_OWNER_ID, handleFirestoreError, OperationType } from './firebase';
import { Expense, Loan, Member } from './types';
import { compressImageFile, getCurrentMonthYearString, calculateAge, parseMonthYear } from './utils';
import { MonthlyContribution } from './types';

interface MemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingMember: Member | null;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const MemberFormModal: React.FC<MemberModalProps> = ({
  isOpen,
  onClose,
  editingMember,
  onNotify,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [email, setEmail] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [pan, setPan] = useState('');
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('123456');
  const [dob, setDob] = useState('1988-01-01');
  const [joiningDate, setJoiningDate] = useState(todayStr);
  const [mobile, setMobile] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [photo, setPhoto] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [nominee, setNominee] = useState('');
  const [nomineeRelation, setNomineeRelation] = useState('');
  const [share, setShare] = useState('10000');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingMember) {
      setId(editingMember.id || '');
      setName(editingMember.name || '');
      setDesignation(editingMember.designation || '');
      setEmail(editingMember.email || '');
      setAadhaar(editingMember.aadhaar || '');
      setPan(editingMember.pan || '');
      setLoginUser(editingMember.loginUser || '');
      setLoginPass(editingMember.loginPass || '123456');
      setDob(editingMember.dob || '1988-01-01');
      setJoiningDate(editingMember.joiningDate || todayStr);
      setMobile(editingMember.mobile || '');
      setStatus(editingMember.status || 'Active');
      setPhoto(editingMember.photo || '');
      setOfficeAddress(editingMember.officeAddress || '');
      setHomeAddress(editingMember.homeAddress || '');
      setNominee(editingMember.nominee || '');
      setNomineeRelation(editingMember.nomineeRelation || '');
      setShare(String(editingMember.share ?? 0));
    } else {
      setId('');
      setName('');
      setDesignation('');
      setEmail('');
      setAadhaar('');
      setPan('');
      setLoginUser('');
      setLoginPass('123456');
      setDob('1988-01-01');
      setJoiningDate(todayStr);
      setMobile('');
      setStatus('Active');
      setPhoto('');
      setOfficeAddress('');
      setHomeAddress('');
      setNominee('');
      setNomineeRelation('');
      setShare('10000');
    }
  }, [editingMember, isOpen]);

  if (!isOpen) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const b64 = await compressImageFile(e.target.files[0], 360);
        setPhoto(b64);
      } catch {
        onNotify('फोटो प्रोसेस करताना अडचण आली.', 'error');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = id.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (!cleanId || !name.trim() || !designation.trim() || !dob || !joiningDate) {
      onNotify('कृपया सभासद आयडी, नाव, पद, जन्मतारीख आणि सामील तारीख भरा!', 'error');
      return;
    }

    setSaving(true);
    const payload = {
      id: cleanId.slice(0, 32),
      name: name.trim().slice(0, 120),
      designation: designation.trim().slice(0, 80),
      email: (email.trim() || '-').slice(0, 120),
      aadhaar: (aadhaar.trim() || '-').slice(0, 32),
      pan: (pan.trim().toUpperCase() || '-').slice(0, 32),
      loginUser: (loginUser.trim() || cleanId).slice(0, 64),
      loginPass: (loginPass.trim() || '123456').slice(0, 64),
      dob: dob.slice(0, 32),
      joiningDate: joiningDate.slice(0, 32),
      mobile: (mobile.trim() || '-').slice(0, 24),
      status,
      photo: photo.slice(0, 800000),
      officeAddress: (officeAddress.trim() || '-').slice(0, 250),
      homeAddress: (homeAddress.trim() || '-').slice(0, 250),
      nominee: (nominee.trim() || '-').slice(0, 120),
      nomineeRelation: (nomineeRelation.trim() || '-').slice(0, 64),
      share: Math.max(0, Number(share) || 0),
      ownerId: SOCIETY_OWNER_ID,
    };

    try {
      if (editingMember) {
        await updateDoc(doc(db, 'members', editingMember.docId), payload);
        onNotify('सभासद माहिती यशस्वीरित्या अपडेट झाली! ✅', 'success');
      } else {
        await addDoc(collection(db, 'members'), payload);
        onNotify('नवीन सभासद यशस्वीरित्या जोडला गेला! ✅', 'success');
      }
      onClose();
    } catch (error) {
      handleFirestoreError(
        error,
        editingMember ? OperationType.UPDATE : OperationType.CREATE,
        'members'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 my-8 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-800 to-indigo-700 px-6 py-4 text-white flex items-center justify-between">
          <h3 className="text-base font-bold">
            {editingMember ? 'सभासद माहिती संपादित करा' : 'नवीन सभासद नोंदणी (New Member)'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                सभासद आयडी (Member ID) *
              </label>
              <input
                type="text"
                required
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="उदा. M004"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                सभासदाचे पूर्ण नाव *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="पूर्ण नाव टाका"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                पद / श्रेणी (Designation) *
              </label>
              <input
                type="text"
                required
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="उदा. उपअभियंता / कनिष्ठ अभियंता"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ईमेल आयडी (Email ID)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                आधार कार्ड नंबर
              </label>
              <input
                type="text"
                value={aadhaar}
                onChange={(e) => setAadhaar(e.target.value)}
                placeholder="XXXX-XXXX-XXXX"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                पॅन कार्ड नंबर (PAN No)
              </label>
              <input
                type="text"
                value={pan}
                onChange={(e) => setPan(e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm uppercase focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                लॉगिन युजरनेम (Login Username)
              </label>
              <input
                type="text"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                placeholder="उदा. M004"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                लॉगिन पासवर्ड (Login Password)
              </label>
              <input
                type="text"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder="पासवर्ड टाका"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                जन्मतारीख (DOB) *
              </label>
              <input
                type="date"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                सभासदत्व दिनांक (Joining Date) *
              </label>
              <input
                type="date"
                required
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                मोबाईल नंबर
              </label>
              <input
                type="text"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="98XXXXXXXX"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                खाते स्थिती (Status)
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm focus:bg-white focus:border-blue-600 focus:outline-none"
              >
                <option value="Active">सक्रिय (Active)</option>
                <option value="Inactive">निष्क्रिय (Inactive)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                शेअर कॅपिटल रक्कम (₹)
              </label>
              <input
                type="number"
                value={share}
                onChange={(e) => setShare(e.target.value)}
                placeholder="10000"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm font-mono-num focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                कार्यालयाचा पत्ता (Office Address)
              </label>
              <input
                type="text"
                value={officeAddress}
                onChange={(e) => setOfficeAddress(e.target.value)}
                placeholder="बांधकाम विभाग, जि.प. गडचिरोली"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                घरचा पत्ता (Home Address)
              </label>
              <input
                type="text"
                value={homeAddress}
                onChange={(e) => setHomeAddress(e.target.value)}
                placeholder="गडचिरोली"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                वारसदार / नॉमिनीचे नाव
              </label>
              <input
                type="text"
                value={nominee}
                onChange={(e) => setNominee(e.target.value)}
                placeholder="नॉमिनीचे पूर्ण नाव"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                नाते (Relation)
              </label>
              <input
                type="text"
                value={nomineeRelation}
                onChange={(e) => setNomineeRelation(e.target.value)}
                placeholder="उदा. पत्नी / पती / मुलगा"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-300 overflow-hidden flex items-center justify-center shrink-0">
              {photo ? (
                <img
                  src={photo}
                  alt="Preview"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-6 h-6 text-slate-400" />
              )}
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                सभासदाचा स्पष्ट फोटो अपलोड करा
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              रद्द करा
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-xs font-bold text-white shadow-sm cursor-pointer"
            >
              {saving ? 'जतन होत आहे...' : 'माहिती जतन करा'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface MonthlyModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  preselectedMemberDocId?: string;
  editingContribution?: MonthlyContribution | null;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const MonthlyContributionModal: React.FC<MonthlyModalProps> = ({
  isOpen,
  onClose,
  members,
  preselectedMemberDocId,
  editingContribution,
  onNotify,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [receiptNo, setReceiptNo] = useState('');
  const [date, setDate] = useState(todayStr);
  const [memberDocId, setMemberDocId] = useState('');
  const [month, setMonth] = useState(getCurrentMonthYearString());
  const [amount, setAmount] = useState('2050');
  const [note, setNote] = useState('पगारातून मासिक वर्गणी कपात');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editingContribution) {
        setReceiptNo(editingContribution.receiptNo || `REC-${Math.floor(1000 + Math.random() * 9000)}`);
        setDate(editingContribution.date || todayStr);
        setMemberDocId(editingContribution.memberDocId);
        setMonth(editingContribution.month || getCurrentMonthYearString());
        setAmount(String(editingContribution.amount ?? 2050));
        setNote(editingContribution.note || 'पगारातून मासिक वर्गणी कपात');
      } else {
        setReceiptNo(`REC-${Math.floor(1000 + Math.random() * 9000)}`);
        setDate(todayStr);
        setMemberDocId(preselectedMemberDocId || '');
        setMonth(getCurrentMonthYearString());
        setAmount('2050');
        setNote('पगारातून मासिक वर्गणी कपात');
      }
    }
  }, [isOpen, editingContribution, preselectedMemberDocId]);

  if (!isOpen) return null;

  const selectedMember = members.find((m) => m.docId === memberDocId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !month.trim() || !amount) {
      onNotify('कृपया सभासद, महिना आणि रक्कम निवडा!', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editingContribution) {
        await updateDoc(doc(db, 'monthly_contributions', editingContribution.docId), {
          date: date.slice(0, 32),
          month: month.trim().toUpperCase().slice(0, 48),
          amount: Math.max(0, Number(amount) || 0),
          note: (note.trim() || '').slice(0, 200),
        });
        onNotify('मासिक वर्गणी नोंद यशस्वीरित्या सुधारली! ✅', 'success');
      } else {
        await addDoc(collection(db, 'monthly_contributions'), {
          memberDocId: selectedMember.docId,
          receiptNo: receiptNo.slice(0, 64),
          date: date.slice(0, 32),
          memberId: selectedMember.id.slice(0, 32),
          memberName: selectedMember.name.slice(0, 120),
          month: month.trim().toUpperCase().slice(0, 48),
          amount: Math.max(0, Number(amount) || 0),
          note: (note.trim() || '').slice(0, 200),
          ownerId: SOCIETY_OWNER_ID,
        });
        onNotify('मासिक वर्गणी यशस्वीरित्या जतन केली! ✅', 'success');
      }
      onClose();
    } catch (error) {
      handleFirestoreError(
        error,
        editingContribution ? OperationType.UPDATE : OperationType.CREATE,
        'monthly_contributions'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-700 via-teal-600 to-cyan-600 px-6 py-4 text-white flex items-center justify-between">
          <h3 className="text-base font-bold">
            {editingContribution ? '✏️ वर्गणी नोंद सुधारा (Edit Contribution)' : '📅 मासिक वर्गणी जमा नोंद'}
          </h3>
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
              <label className="block text-xs font-bold text-slate-700 mb-1">
                पावती क्र. (Auto)
              </label>
              <input
                type="text"
                readOnly
                value={receiptNo}
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm font-mono-num font-bold text-blue-700"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">दिनांक *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              सभासद निवडा *
            </label>
            <select
              required
              disabled={!!editingContribution}
              value={memberDocId}
              onChange={(e) => setMemberDocId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:border-emerald-600 focus:outline-none disabled:opacity-70"
            >
              <option value="">-- सभासद निवडा --</option>
              {members.map((m) => (
                <option key={m.docId} value={m.docId}>
                  {m.id} — {m.name} ({m.designation})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                महिना व वर्ष *
              </label>
              <input
                type="text"
                required
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                placeholder="JULY 2026"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                वर्गणी रक्कम (₹) *
              </label>
              <input
                type="number"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="2050"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-mono-num font-bold text-emerald-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">तपशील / शेरा</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="पगारातून मासिक वर्गणी कपात"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 py-3 text-sm font-bold text-white shadow-md transition cursor-pointer"
          >
            {saving ? 'जतन होत आहे...' : editingContribution ? 'बदल जतन करा (Update)' : 'वर्गणी जतन करा'}
          </button>
        </form>
      </div>
    </div>
  );
};
