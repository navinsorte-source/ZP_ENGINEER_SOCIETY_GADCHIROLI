import React, { useState, useRef } from 'react';
import {
  Cloud,
  CheckCircle2,
  Download,
  Upload,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Database,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import { collection, doc, setDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { db, SOCIETY_OWNER_ID, handleFirestoreError, OperationType } from './firebase';
import { Expense, Loan, LoanEmi, Member, MonthlyContribution } from './types';

interface FirebaseCloudModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  contributions: MonthlyContribution[];
  loans: Loan[];
  emis: LoanEmi[];
  expenses: Expense[];
  onSeedSampleData: () => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const FirebaseCloudModal: React.FC<FirebaseCloudModalProps> = ({
  isOpen,
  onClose,
  members,
  contributions,
  loans,
  emis,
  expenses,
  onSeedSampleData,
  onNotify,
}) => {
  const [importingOldDb, setImportingOldDb] = useState(false);
  const [restoringJson, setRestoringJson] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const totalRecords =
    members.length + contributions.length + loans.length + emis.length + expenses.length;

  // Export full cloud database to a single JSON backup file
  const handleDownloadFullBackup = () => {
    const backupPayload = {
      societyName: 'जिल्हा परिषद अभियंता व तांत्रिक कर्मचारी सहकारी पत संस्था मर्या. गडचिरोली',
      exportedAt: new Date().toISOString(),
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId,
      data: {
        members,
        monthly_contributions: contributions,
        loans,
        loan_emis: emis,
        expenses,
      },
    };

    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ZP_Society_Full_Cloud_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onNotify('संपूर्ण क्लाउड डेटाबेस बॅकअप (JSON) डाउनलोड झाला! ✅', 'success');
  };

  // Restore from JSON Backup file into Firebase Cloud
  const handleRestoreFromJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoringJson(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const data = parsed.data || parsed;

      let count = 0;

      if (Array.isArray(data.members)) {
        for (const m of data.members) {
          const docId = m.docId || `mem_${m.id || Math.random().toString(36).slice(2, 8)}`;
          const cleanId = String(m.id || 'M001').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
          await setDoc(doc(collection(db, 'members'), docId), {
            id: cleanId,
            name: String(m.name || 'सभासद').slice(0, 120),
            designation: String(m.designation || 'सभासद').slice(0, 80),
            email: String(m.email || '-').slice(0, 120),
            aadhaar: String(m.aadhaar || '-').slice(0, 32),
            pan: String(m.pan || '-').slice(0, 32),
            loginUser: String(m.loginUser || cleanId).slice(0, 64),
            loginPass: String(m.loginPass || '123456').slice(0, 64),
            dob: String(m.dob || '1988-01-01').slice(0, 32),
            joiningDate: String(m.joiningDate || '2020-01-01').slice(0, 32),
            mobile: String(m.mobile || '-').slice(0, 24),
            status: m.status === 'Inactive' ? 'Inactive' : 'Active',
            photo: String(m.photo || '').slice(0, 800000),
            officeAddress: String(m.officeAddress || '-').slice(0, 250),
            homeAddress: String(m.homeAddress || '-').slice(0, 250),
            nominee: String(m.nominee || '-').slice(0, 120),
            nomineeRelation: String(m.nomineeRelation || '-').slice(0, 64),
            share: Math.max(0, Number(m.share) || 0),
            ownerId: SOCIETY_OWNER_ID,
          });
          count++;
        }
      }

      if (Array.isArray(data.monthly_contributions)) {
        for (const c of data.monthly_contributions) {
          const docId = c.docId || `contrib_${Math.random().toString(36).slice(2, 9)}`;
          await setDoc(doc(collection(db, 'monthly_contributions'), docId), {
            memberDocId: String(c.memberDocId || '').slice(0, 128),
            receiptNo: String(c.receiptNo || 'REC-1000').slice(0, 64),
            date: String(c.date || '2026-01-01').slice(0, 32),
            memberId: String(c.memberId || 'M001').slice(0, 32),
            memberName: String(c.memberName || 'सभासद').slice(0, 120),
            month: String(c.month || 'JANUARY 2026').slice(0, 48),
            amount: Math.max(0, Number(c.amount) || 0),
            note: String(c.note || '').slice(0, 200),
            ownerId: SOCIETY_OWNER_ID,
          });
          count++;
        }
      }

      onNotify(`एकूण ${count} रेकॉर्ड्स Google Firebase क्लाउडमध्ये यशस्वीरित्या सेव्ह झाले! 🎉`, 'success');
    } catch (err) {
      console.error(err);
      onNotify('बॅकअप फाईल वाचताना त्रुटी आली. कृपया योग्य JSON फाईल निवडा.', 'error');
    } finally {
      setRestoringJson(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // One-click import from legacy project "zilla-parishad-society" via Firestore REST API
  const handleImportFromLegacyFirebase = async () => {
    setImportingOldDb(true);
    try {
      const legacyProjectId = 'zilla-parishad-society';
      const baseUrl = `https://firestore.googleapis.com/v1/projects/${legacyProjectId}/databases/(default)/documents`;

      const parseRestValue = (valObj: Record<string, unknown>): unknown => {
        if (!valObj) return '';
        if ('stringValue' in valObj) return valObj.stringValue;
        if ('integerValue' in valObj) return Number(valObj.integerValue);
        if ('doubleValue' in valObj) return Number(valObj.doubleValue);
        if ('booleanValue' in valObj) return Boolean(valObj.booleanValue);
        return '';
      };

      const fetchCollection = async (colName: string) => {
        const res = await fetch(`${baseUrl}/${colName}?pageSize=300`);
        if (!res.ok) return [];
        const json = await res.json();
        if (!json.documents) return [];
        return json.documents.map((docItem: { name: string; fields?: Record<string, Record<string, unknown>> }) => {
          const parts = docItem.name.split('/');
          const docId = parts[parts.length - 1].replace(/[^a-zA-Z0-9_-]/g, '');
          const fields = docItem.fields || {};
          const parsed: Record<string, unknown> = { docId };
          for (const k of Object.keys(fields)) {
            parsed[k] = parseRestValue(fields[k]);
          }
          return parsed;
        });
      };

      const oldMembers = await fetchCollection('members');
      const oldMonthly = await fetchCollection('monthly_contributions');
      const oldLoans = await fetchCollection('loans');
      const oldEmis = await fetchCollection('loan_emis');
      const oldExpenses = await fetchCollection('expenses');

      let importedCount = 0;

      for (const m of oldMembers) {
        const cleanDocId = String(m.docId || `mem_${importedCount}`);
        const cleanId = String(m.id || 'M001').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'M001';
        try {
          await setDoc(doc(collection(db, 'members'), cleanDocId), {
            id: cleanId,
            name: String(m.name || 'सभासद').slice(0, 120),
            designation: String(m.designation || 'सभासद').slice(0, 80),
            email: String(m.email || '-').slice(0, 120),
            aadhaar: String(m.aadhaar || '-').slice(0, 32),
            pan: String(m.pan || '-').slice(0, 32),
            loginUser: String(m.loginUser || cleanId).slice(0, 64),
            loginPass: String(m.loginPass || '123456').slice(0, 64),
            dob: String(m.dob || '1988-01-01').slice(0, 32),
            joiningDate: String(m.joiningDate || '2020-01-01').slice(0, 32),
            mobile: String(m.mobile || '-').slice(0, 24),
            status: m.status === 'Inactive' ? 'Inactive' : 'Active',
            photo: String(m.photo || '').slice(0, 800000),
            officeAddress: String(m.officeAddress || '-').slice(0, 250),
            homeAddress: String(m.homeAddress || '-').slice(0, 250),
            nominee: String(m.nominee || '-').slice(0, 120),
            nomineeRelation: String(m.nomineeRelation || '-').slice(0, 64),
            share: Math.max(0, Number(m.share) || 0),
            ownerId: SOCIETY_OWNER_ID,
          });
          importedCount++;
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, 'members');
        }
      }

      for (const c of oldMonthly) {
        const cleanDocId = String(c.docId || `contrib_${importedCount}`);
        const memDocId = String(c.memberDocId || '').replace(/[^a-zA-Z0-9_-]/g, '');
        if (!memDocId) continue;
        try {
          await setDoc(doc(collection(db, 'monthly_contributions'), cleanDocId), {
            memberDocId: memDocId.slice(0, 128),
            receiptNo: String(c.receiptNo || 'REC-1001').slice(0, 64),
            date: String(c.date || '2026-01-01').slice(0, 32),
            memberId: String(c.memberId || 'M001').slice(0, 32),
            memberName: String(c.memberName || 'सभासद').slice(0, 120),
            month: String(c.month || 'JANUARY 2026').slice(0, 48),
            amount: Math.max(0, Number(c.amount) || 0),
            note: String(c.note || '').slice(0, 200),
            ownerId: SOCIETY_OWNER_ID,
          });
          importedCount++;
        } catch {
          // Skip orphaned contribution if memberDocId wasn't found
        }
      }

      for (const l of oldLoans) {
        const cleanDocId = String(l.docId || `loan_${importedCount}`);
        const memDocId = String(l.memberDocId || '').replace(/[^a-zA-Z0-9_-]/g, '');
        if (!memDocId) continue;
        try {
          await setDoc(doc(collection(db, 'loans'), cleanDocId), {
            memberDocId: memDocId.slice(0, 128),
            memberName: String(l.memberName || 'सभासद').slice(0, 120),
            loanDate: String(l.loanDate || '2026-01-01').slice(0, 32),
            principal: Math.max(0, Number(l.principal) || 0),
            interestRate: Math.max(0, Number(l.interestRate) || 8),
            months: Math.max(1, Number(l.months) || 12),
            totalInterest: Math.max(0, Number(l.totalInterest) || 0),
            totalPayable: Math.max(0, Number(l.totalPayable) || 0),
            monthlyEmi: Math.max(0, Number(l.monthlyEmi) || 0),
            startMonth: String(l.startMonth || 'January 2026').slice(0, 48),
            guarantor: String(l.guarantor || '-').slice(0, 150),
            mortgage: String(l.mortgage || '-').slice(0, 200),
            status: l.status === 'Closed' ? 'Closed' : 'Active',
            ownerId: SOCIETY_OWNER_ID,
          });
          importedCount++;
        } catch {
          // Skip if parent member missing
        }
      }

      for (const em of oldEmis) {
        const cleanDocId = String(em.docId || `emi_${importedCount}`);
        const lnDocId = String(em.loanDocId || '').replace(/[^a-zA-Z0-9_-]/g, '');
        if (!lnDocId) continue;
        try {
          await setDoc(doc(collection(db, 'loan_emis'), cleanDocId), {
            loanDocId: lnDocId.slice(0, 128),
            date: String(em.date || '2026-01-01').slice(0, 32),
            month: String(em.month || 'January 2026').slice(0, 48),
            mode: ['Cash', 'Cheque', 'Bank Transfer', 'Salary Deduction'].includes(String(em.mode))
              ? String(em.mode)
              : 'Cash',
            chequeNo: String(em.chequeNo || '').slice(0, 64),
            amount: Math.max(0, Number(em.amount) || 0),
            photo: String(em.photo || '').slice(0, 800000),
            ownerId: SOCIETY_OWNER_ID,
          });
          importedCount++;
        } catch {
          // Skip if parent loan missing
        }
      }

      for (const ex of oldExpenses) {
        const cleanDocId = String(ex.docId || `exp_${importedCount}`);
        try {
          await setDoc(doc(collection(db, 'expenses'), cleanDocId), {
            voucherNo: String(ex.voucherNo || 'VOU-1001').slice(0, 64),
            date: String(ex.date || '2026-01-01').slice(0, 32),
            category: String(ex.category || 'इतर खर्च').slice(0, 120),
            description: String(ex.description || '-').slice(0, 250),
            amount: Math.max(0, Number(ex.amount) || 0),
            mode: ['Cash', 'Bank Transfer', 'Cheque', 'UPI'].includes(String(ex.mode))
              ? String(ex.mode)
              : 'Cash',
            photo: String(ex.photo || '').slice(0, 800000),
            ownerId: SOCIETY_OWNER_ID,
          });
          importedCount++;
        } catch {
          // ignore
        }
      }

      if (importedCount > 0) {
        onNotify(
          `जुन्या Firebase प्रोजेक्टमधून ${importedCount} रेकॉर्ड्स (सभासद, फोटो व वर्गणी) यशस्वीरित्या इम्पोर्ट झाले! 🎉`,
          'success'
        );
      } else {
        onNotify(
          'जुन्या डेटाबेसमध्ये रेकॉर्ड्स आढळले नाहीत किंवा आधीच लोड झाले आहेत.',
          'error'
        );
      }
    } catch (error) {
      console.error(error);
      onNotify('जुन्या Firebase मधून डेटा इम्पोर्ट करताना अडचण आली.', 'error');
    } finally {
      setImportingOldDb(false);
    }
  };

  const consoleUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-200 my-8 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-blue-800 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/30 flex items-center justify-center">
              <Cloud className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold">Google Firebase Cloud Connected</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-emerald-200 text-[11px] font-bold">
                  ● LIVE SYNC
                </span>
              </div>
              <p className="text-xs text-teal-100 mt-0.5">
                तुमचा सर्व डेटा आणि सभासदांचे फोटो Google Cloud Firestore मध्ये Lifetime Free सेव्ह होत आहेत
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold text-white cursor-pointer"
          >
            बंद करा ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Connection Details Box */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <Database className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-slate-500 font-medium">Firebase Project ID:</p>
                <p className="font-mono-num font-extrabold text-slate-900 text-sm">
                  {firebaseConfig.projectId}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <HardDrive className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-slate-500 font-medium">Cloud Plan & Cost:</p>
                <p className="font-extrabold text-emerald-700 text-sm">
                  Lifetime Free Tier (₹ 0 / कायमस्वरूपी मोफत)
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 sm:col-span-2 pt-1 border-t border-emerald-200/70">
              <ShieldCheck className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-slate-500 font-medium">Firestore Database ID:</p>
                <p className="font-mono-num font-bold text-slate-800 break-all">
                  {firebaseConfig.firestoreDatabaseId}
                </p>
              </div>
              <a
                href={consoleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0 shadow-2xs"
              >
                <span>Firebase Console उघडा</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Live Cloud Record Counters */}
          <div>
            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2.5">
              📊 सध्या क्लाउडवर सेव्ह असलेला लाईव्ह डेटा ({totalRecords} एकूण नोंदी)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <p className="text-lg font-extrabold text-blue-700 font-mono-num">
                  {members.length}
                </p>
                <p className="text-[11px] font-bold text-slate-600">सभासद (फोटोंसह)</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="text-lg font-extrabold text-emerald-700 font-mono-num">
                  {contributions.length}
                </p>
                <p className="text-[11px] font-bold text-slate-600">मासिक वर्गणी</p>
              </div>
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                <p className="text-lg font-extrabold text-indigo-700 font-mono-num">
                  {loans.length}
                </p>
                <p className="text-[11px] font-bold text-slate-600">मंजूर कर्जे</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-lg font-extrabold text-amber-700 font-mono-num">
                  {emis.length}
                </p>
                <p className="text-[11px] font-bold text-slate-600">कर्ज EMI हप्ते</p>
              </div>
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 col-span-2 sm:col-span-1">
                <p className="text-lg font-extrabold text-rose-700 font-mono-num">
                  {expenses.length}
                </p>
                <p className="text-[11px] font-bold text-slate-600">खर्च वाउचर्स</p>
              </div>
            </div>
          </div>

          {/* Legacy Migration & Cloud Backup Actions */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              ⚡ डेटा सिंक, जुना डेटा इम्पोर्ट आणि बॅकअप साधने
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Sync from Old Firebase Project */}
              <button
                type="button"
                disabled={importingOldDb}
                onClick={handleImportFromLegacyFirebase}
                className="p-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 hover:from-indigo-700 hover:to-blue-800 text-white text-left shadow-sm transition cursor-pointer disabled:opacity-60 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-blue-200">
                    Legacy Firebase Sync
                  </span>
                  <RefreshCw className={`w-4 h-4 ${importingOldDb ? 'animate-spin' : ''}`} />
                </div>
                <div className="mt-2">
                  <p className="text-sm font-extrabold">
                    {importingOldDb
                      ? 'जुन्या प्रोजेक्टमधून डेटा येत आहे...'
                      : 'जुन्या Firebase मधून डेटा इम्पोर्ट करा'}
                  </p>
                  <p className="text-[11px] text-blue-100 mt-0.5">
                    (zilla-parishad-society मधील जुने सभासद व वर्गणी थेट इथे आणा)
                  </p>
                </div>
              </button>

              {/* Download Full JSON Backup */}
              <button
                type="button"
                onClick={handleDownloadFullBackup}
                className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-left shadow-sm transition cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-200">
                    Offline Safety Backup
                  </span>
                  <Download className="w-4 h-4" />
                </div>
                <div className="mt-2">
                  <p className="text-sm font-extrabold">संपूर्ण डेटाबेस बॅकअप डाउनलोड करा</p>
                  <p className="text-[11px] text-emerald-100 mt-0.5">
                    (सर्व सभासद, फोटो, कर्ज व वर्गणी एका फाईलमध्ये सेव्ह करा)
                  </p>
                </div>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleRestoreFromJsonFile}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={restoringJson}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-blue-600" />
                  <span>
                    {restoringJson ? 'रिस्टोअर होत आहे...' : 'बॅकअप फाईल रिस्टोअर करा (Restore JSON)'}
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={async () => {
                  await onSeedSampleData();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 text-xs font-bold cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>नमुना डेटा जोडा (Sample Data)</span>
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-100 text-xs text-slate-600 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>टीप:</strong> तुम्ही अ‍ॅपमध्ये केलेला कोणताही बदल (नवीन सभासद, फोटो, वर्गणी किंवा कर्ज)
              एका सेकंदात थेट Google Firebase Cloud वर आपोआप सेव्ह होतो.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
