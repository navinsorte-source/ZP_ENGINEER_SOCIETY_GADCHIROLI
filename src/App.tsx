/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import {
  Users,
  Calendar,
  Zap,
  Receipt,
  LogOut,
  Plus,
  Search,
  Download,
  Gift,
  MessageCircle,
  Trash2,
  Eye,
  Lock,
  Sparkles,
  CheckCircle2,
  XCircle,
  User,
  Shield,
  Menu,
  X,
  Printer,
  Award,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  ADMIN_EMAIL,
  auth,
  db,
  googleProvider,
  SOCIETY_OWNER_ID,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  CommitteeMember,
  Expense,
  Loan,
  LoanEmi,
  Member,
  MemberPassbook,
  MonthlyContribution,
} from './types';
import {
  buildWhatsAppBirthdayUrl,
  calculateAge,
  computeDayWiseLoanSchedule,
  exportMembersToCSV,
  isBirthdayThisMonth,
  isTodayBirthday,
  parseMonthYear,
} from './utils';
import { downloadLoanSchedulePdf } from './loanSchedulePdf';
import { PWAInstallButton, OfflineIndicator } from './PWAInstallButton';
import { MemberFormModal, MonthlyContributionModal } from './SocietyModals';
import {
  LoanSanctionModal,
  PayEmiModal,
  CloseLoanModal,
  ExpenseFormModal,
} from './LoanAndExpenseModals';
import { AmortizationScheduleView } from './AmortizationScheduleView';
import { MemberPortalView } from './MemberPortalView';
import { MemberDetailModal, DEFAULT_AVATAR_URL } from './MemberDetailModal';
import { FirebaseCloudModal } from './FirebaseCloudModal';
import { SocietyDirectoryTab } from './SocietyDirectoryTab';
import { seedSampleSocietyData } from './seedData';
import {
  deleteMemberPassbook,
  loadDirectoryChunks,
  normalizePassbookId,
  syncAllSnapshots,
  syncDirectoryChunks,
  syncSingleMemberPassbook,
} from './snapshots';

type ActiveTab = 'members' | 'monthly' | 'loans' | 'expenses' | 'directory' | 'memberPortal';
const PAGE_SIZE = 50;

export default function App() {
  // Real-time Firestore state (loaded ONLY for authenticated Admin)
  const [members, setMembers] = useState<Member[]>([]);
  const [committeeMembers, setCommitteeMembers] = useState<CommitteeMember[]>([]);
  const [contributions, setContributions] = useState<MonthlyContribution[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [emis, setEmis] = useState<LoanEmi[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);

  // Scoped Member Passbook & Lazy Directory state (loaded ONLY for logged-in Member)
  const [memberPassbookMember, setMemberPassbookMember] = useState<Member | null>(null);
  const [directoryMembers, setDirectoryMembers] = useState<Member[]>([]);
  const [directoryCommittee, setDirectoryCommittee] = useState<CommitteeMember[]>([]);
  const [directoryLoaded, setDirectoryLoaded] = useState(false);
  const [directoryLoading, setDirectoryLoading] = useState(false);

  // Auth / Session state
  const [authReady, setAuthReady] = useState(false);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginRole, setLoginRole] = useState<'admin' | 'member'>('member');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [adminSigningIn, setAdminSigningIn] = useState(false);
  const [memberLoggingIn, setMemberLoggingIn] = useState(false);
  const [loggedInMemberId, setLoggedInMemberId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('members');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');
  const [membersPage, setMembersPage] = useState(1);
  const [monthlyMonthFilter, setMonthlyMonthFilter] = useState('');
  const [monthlyPage, setMonthlyPage] = useState(1);

  // Modals state
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [viewingMember, setViewingMember] = useState<Member | null>(null);

  const [monthlyModalOpen, setMonthlyModalOpen] = useState(false);
  const [preselectedMemberForMonthly, setPreselectedMemberForMonthly] = useState<string | undefined>(undefined);
  const [editingMonthlyContrib, setEditingMonthlyContrib] = useState<MonthlyContribution | null>(null);
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);

  const [payEmiModalLoan, setPayEmiModalLoan] = useState<Loan | null>(null);
  const [payEmiDefaultMonth, setPayEmiDefaultMonth] = useState<string | undefined>(undefined);
  const [payEmiDefaultDate, setPayEmiDefaultDate] = useState<string | undefined>(undefined);
  const [closeLoanModalTarget, setCloseLoanModalTarget] = useState<{
    loan: Loan;
    balance: number;
  } | null>(null);
  const [viewingLoanLedger, setViewingLoanLedger] = useState<Loan | null>(null);
  const [downloadingLoanPdfId, setDownloadingLoanPdfId] = useState<string | null>(null);
  const [viewingVoucherPhoto, setViewingVoucherPhoto] = useState<string | null>(null);
  const [cloudModalOpen, setCloudModalOpen] = useState(false);

  // In-app confirmation & toast notifications
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    title: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Refs for debounced snapshot syncing
  const latestDataRef = useRef({
    members,
    contributions,
    loans,
    emis,
    committeeMembers,
  });
  latestDataRef.current = {
    members,
    contributions,
    loans,
    emis,
    committeeMembers,
  };
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSnapshotCheckedRef = useRef(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => {
      setToast((prev) => (prev?.msg === msg ? null : prev));
    }, 3500);
  };

  // Firebase Auth listener & redirect completion for verified Admin session
  useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (!result?.user) return;
        const email = (result.user.email || '').toLowerCase();
        if (!result.user.emailVerified || email !== ADMIN_EMAIL.toLowerCase()) {
          await signOut(auth);
          showToast(
            `केवळ अधिकृत अ‍ॅडमिन ईमेल (${ADMIN_EMAIL}) ला प्रवेश आहे!`,
            'error'
          );
        }
      })
      .catch((err) => {
        console.error(err);
        const code = (err as { code?: string })?.code || '';
        if (code === 'auth/unauthorized-domain') {
          showToast(
            `डोमेन (${window.location.hostname}) Firebase Authorized domains मध्ये जोडलेले नाही!`,
            'error'
          );
        }
      });

    const unsub = onAuthStateChanged(auth, (user) => {
      const validAdmin =
        !!user &&
        !!user.emailVerified &&
        (user.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();

      setIsAdminVerified(validAdmin);
      if (validAdmin) {
        setLoggedInMemberId(null);
        setMemberPassbookMember(null);
        setIsLoggedIn(true);
        setActiveTab((prev) => (prev === 'memberPortal' ? 'members' : prev));
      }
      setAuthReady(true);
    });
    return () => {
      unsub();
      if (snapshotTimerRef.current) {
        clearTimeout(snapshotTimerRef.current);
        snapshotTimerRef.current = null;
      }
    };
  }, []);

  // Real-time Firestore listeners ONLY attached when verified Admin is logged in (0 reads before login!)
  useEffect(() => {
    if (!isLoggedIn || loggedInMemberId || !isAdminVerified) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const qMembers = query(
      collection(db, 'members'),
      where('ownerId', '==', SOCIETY_OWNER_ID)
    );
    const unsubMembers = onSnapshot(
      qMembers,
      (snap) => {
        const list: Member[] = [];
        snap.forEach((d) => list.push({ docId: d.id, ...(d.data() as Omit<Member, 'docId'>) }));
        list.sort((a, b) => a.id.localeCompare(b.id));
        setMembers(list);
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'members')
    );

    const qMonthly = query(
      collection(db, 'monthly_contributions'),
      where('ownerId', '==', SOCIETY_OWNER_ID)
    );
    const unsubMonthly = onSnapshot(
      qMonthly,
      (snap) => {
        const list: MonthlyContribution[] = [];
        snap.forEach((d) =>
          list.push({ docId: d.id, ...(d.data() as Omit<MonthlyContribution, 'docId'>) })
        );
        list.sort(
          (a, b) => parseMonthYear(b.month).getTime() - parseMonthYear(a.month).getTime()
        );
        setContributions(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'monthly_contributions')
    );

    const qLoans = query(
      collection(db, 'loans'),
      where('ownerId', '==', SOCIETY_OWNER_ID)
    );
    const unsubLoans = onSnapshot(
      qLoans,
      (snap) => {
        const list: Loan[] = [];
        snap.forEach((d) => list.push({ docId: d.id, ...(d.data() as Omit<Loan, 'docId'>) }));
        setLoans(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'loans')
    );

    const qEmis = query(
      collection(db, 'loan_emis'),
      where('ownerId', '==', SOCIETY_OWNER_ID)
    );
    const unsubEmis = onSnapshot(
      qEmis,
      (snap) => {
        const list: LoanEmi[] = [];
        snap.forEach((d) => list.push({ docId: d.id, ...(d.data() as Omit<LoanEmi, 'docId'>) }));
        setEmis(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'loan_emis')
    );

    const qExpenses = query(
      collection(db, 'expenses'),
      where('ownerId', '==', SOCIETY_OWNER_ID)
    );
    const unsubExpenses = onSnapshot(
      qExpenses,
      (snap) => {
        const list: Expense[] = [];
        snap.forEach((d) => list.push({ docId: d.id, ...(d.data() as Omit<Expense, 'docId'>) }));
        setExpenses(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'expenses')
    );

    const qCommittee = query(
      collection(db, 'committee_members'),
      where('ownerId', '==', SOCIETY_OWNER_ID)
    );
    const unsubCommittee = onSnapshot(
      qCommittee,
      (snap) => {
        const list: CommitteeMember[] = [];
        snap.forEach((d) =>
          list.push({ docId: d.id, ...(d.data() as Omit<CommitteeMember, 'docId'>) })
        );
        setCommitteeMembers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'committee_members')
    );

    return () => {
      unsubMembers();
      unsubMonthly();
      unsubLoans();
      unsubEmis();
      unsubExpenses();
      unsubCommittee();
    };
  }, [isLoggedIn, loggedInMemberId, isAdminVerified]);

  const handleSyncAllSnapshots = useCallback(async () => {
    const {
      members: curMembers,
      contributions: curContribs,
      loans: curLoans,
      emis: curEmis,
      committeeMembers: curCommittee,
    } = latestDataRef.current;
    return await syncAllSnapshots(
      curMembers,
      curContribs,
      curLoans,
      curEmis,
      curCommittee
    );
  }, []);

  const scheduleSnapshotSync = useCallback(
    (memberDocId?: string, scope: 'member' | 'directory' | 'all' = 'member') => {
      if (snapshotTimerRef.current) {
        clearTimeout(snapshotTimerRef.current);
      }
      snapshotTimerRef.current = setTimeout(async () => {
        const {
          members: curMembers,
          contributions: curContribs,
          loans: curLoans,
          emis: curEmis,
          committeeMembers: curCommittee,
        } = latestDataRef.current;

        try {
          if ((scope === 'member' || scope === 'all') && memberDocId) {
            const target = curMembers.find((m) => m.docId === memberDocId);
            if (target) {
              await syncSingleMemberPassbook(target, curContribs, curLoans, curEmis);
            }
          }
          if (scope === 'directory' || scope === 'all') {
            await syncDirectoryChunks(curMembers, curCommittee);
          }
        } catch (err) {
          console.error('Snapshot sync error:', err);
        }
      }, 750);
    },
    []
  );

  // Auto-initialize snapshots once when Admin logs in if directory_chunks is empty
  useEffect(() => {
    if (
      !isLoggedIn ||
      loggedInMemberId ||
      !isAdminVerified ||
      loading ||
      initialSnapshotCheckedRef.current
    ) {
      return;
    }
    if (members.length === 0 && committeeMembers.length === 0) {
      return;
    }

    initialSnapshotCheckedRef.current = true;
    const timer = setTimeout(async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'directory_chunks'), where('ownerId', '==', SOCIETY_OWNER_ID))
        );
        if (snap.empty) {
          await handleSyncAllSnapshots();
        }
      } catch (err) {
        console.error('Initial snapshot check skipped:', err);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    isLoggedIn,
    loggedInMemberId,
    isAdminVerified,
    loading,
    members.length,
    committeeMembers.length,
    handleSyncAllSnapshots,
  ]);

  // Lazy-load chunked public directory ONLY when a Member opens the Directory tab
  useEffect(() => {
    if (!isLoggedIn || !loggedInMemberId || activeTab !== 'directory' || directoryLoaded) {
      return;
    }
    let cancelled = false;
    setDirectoryLoading(true);
    loadDirectoryChunks()
      .then(({ directoryMembers: dm, directoryCommittee: dc }) => {
        if (cancelled) return;
        setDirectoryMembers(dm);
        setDirectoryCommittee(dc);
        setDirectoryLoaded(true);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) {
          showToast('कार्यकारिणी यादी लोड करताना अडचण आली.', 'error');
        }
      })
      .finally(() => {
        if (!cancelled) setDirectoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, loggedInMemberId, activeTab, directoryLoaded]);

  // Reset pagination when filters change
  useEffect(() => {
    setMembersPage(1);
  }, [searchQuery, designationFilter]);

  useEffect(() => {
    setMonthlyPage(1);
  }, [monthlyMonthFilter]);

  // Computed Summaries
  const activeMembersCount = useMemo(
    () => members.filter((m) => m.status !== 'Inactive').length,
    [members]
  );

  const totalShareCapital = useMemo(
    () =>
      members
        .filter((m) => m.status !== 'Inactive')
        .reduce((sum, m) => sum + (Number(m.share) || 0), 0),
    [members]
  );

  const totalContributionPool = useMemo(
    () => contributions.reduce((sum, c) => sum + (Number(c.amount) || 0), 0),
    [contributions]
  );

  const totalExpensesSum = useMemo(
    () => expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [expenses]
  );

  const netBalancePool = totalContributionPool - totalExpensesSum;

  const designationsList = useMemo(() => {
    const s = new Set<string>();
    members.forEach((m) => {
      if (m.designation) s.add(m.designation);
    });
    return Array.from(s);
  }, [members]);

  const birthdayMembersThisMonth = useMemo(
    () => members.filter((m) => isBirthdayThisMonth(m.dob)),
    [members]
  );

  const todayBirthdayMembers = useMemo(
    () => members.filter((m) => isTodayBirthday(m.dob)),
    [members]
  );

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (loggedInMemberId && m.docId !== loggedInMemberId) return false;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        (m.mobile && m.mobile.toLowerCase().includes(q)) ||
        (m.email && m.email.toLowerCase().includes(q)) ||
        (m.pan && m.pan.toLowerCase().includes(q)) ||
        (m.officeAddress && m.officeAddress.toLowerCase().includes(q));
      const matchesDeg = !designationFilter || m.designation === designationFilter;
      return matchesSearch && matchesDeg;
    });
  }, [members, searchQuery, designationFilter, loggedInMemberId]);

  const totalMembersPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const paginatedMembers = useMemo(() => {
    const start = (membersPage - 1) * PAGE_SIZE;
    return filteredMembers.slice(start, start + PAGE_SIZE);
  }, [filteredMembers, membersPage]);

  const availableContributionMonths = useMemo(() => {
    const set = new Set<string>();
    contributions.forEach((c) => {
      if (c.month) set.add(c.month.toUpperCase());
    });
    return Array.from(set).sort(
      (a, b) => parseMonthYear(b).getTime() - parseMonthYear(a).getTime()
    );
  }, [contributions]);

  const filteredContributions = useMemo(() => {
    if (!monthlyMonthFilter) return contributions;
    return contributions.filter(
      (c) => (c.month || '').toUpperCase() === monthlyMonthFilter.toUpperCase()
    );
  }, [contributions, monthlyMonthFilter]);

  const totalMonthlyPages = Math.max(1, Math.ceil(filteredContributions.length / PAGE_SIZE));
  const paginatedContributions = useMemo(() => {
    const start = (monthlyPage - 1) * PAGE_SIZE;
    return filteredContributions.slice(start, start + PAGE_SIZE);
  }, [filteredContributions, monthlyPage]);

  const loggedInMemberObj = useMemo(
    () => memberPassbookMember || members.find((m) => m.docId === loggedInMemberId) || null,
    [memberPassbookMember, members, loggedInMemberId]
  );

  // Handlers
  const handleAdminGoogleLogin = async () => {
    setAdminSigningIn(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const email = (result.user.email || '').toLowerCase();
      if (!result.user.emailVerified || email !== ADMIN_EMAIL.toLowerCase()) {
        await signOut(auth);
        showToast(
          `केवळ अधिकृत अ‍ॅडमिन ईमेल (${ADMIN_EMAIL}) ला प्रवेश आहे!`,
          'error'
        );
        return;
      }
      setLoggedInMemberId(null);
      setMemberPassbookMember(null);
      setIsAdminVerified(true);
      setIsLoggedIn(true);
      setActiveTab('members');
      showToast('स्वागत आहे! Executive Admin पॅनेल उघडले आहे.', 'success');
    } catch (err) {
      console.error(err);
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/unauthorized-domain') {
        showToast(
          `डोमेन (${window.location.hostname}) Firebase Authorized domains मध्ये जोडलेले नाही! कृपया Firebase Console मध्ये जोडा.`,
          'error'
        );
      } else if (code === 'auth/popup-blocked') {
        if (window.self === window.top) {
          await signInWithRedirect(auth, googleProvider);
          return;
        }
        showToast('ब्राउझरने Pop-up ब्लॉक केले आहे. कृपया Pop-up ला परवानगी द्या.', 'error');
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        showToast('Google लॉगिन विंडो बंद केली गेली.', 'error');
      } else {
        showToast(`Google लॉगिन त्रुटी: ${code || 'कृपया पुन्हा प्रयत्न करा.'}`, 'error');
      }
    } finally {
      setAdminSigningIn(false);
    }
  };

  const handleMemberLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = usernameInput.trim();
    const p = passwordInput.trim();

    const memberIdKey = normalizePassbookId(u);
    if (!memberIdKey) {
      showToast('कृपया आपला वैध सभासद आयडी टाका (उदा. M001)!', 'error');
      return;
    }

    setMemberLoggingIn(true);
    try {
      // ONLY 1 Firestore Read for complete member profile + contributions + loans + EMIs!
      const passbookSnap = await getDoc(doc(db, 'member_passbooks', memberIdKey));
      if (!passbookSnap.exists()) {
        showToast(
          'हा सभासद आयडी सापडला नाही! कृपया अचूक आयडी टाका (किंवा Admin कडून Snapshot सिंक करून घ्या).',
          'error'
        );
        return;
      }

      const data = passbookSnap.data() as Omit<MemberPassbook, 'docId'>;
      const storedPass = (data.loginPass || '123456').trim();
      if (!p || storedPass !== p) {
        showToast('चुकीचा पासवर्ड! कृपया योग्य पासवर्ड टाका.', 'error');
        return;
      }

      const fullMemberObj: Member = {
        ...data.member,
        docId: data.memberDocId,
        aadhaar: '-',
        loginPass: storedPass,
      };

      setMemberPassbookMember(fullMemberObj);
      setContributions(data.contributions || []);
      setLoans(data.loans || []);
      setEmis(data.emis || []);
      setDirectoryLoaded(false);
      setDirectoryMembers([]);
      setDirectoryCommittee([]);
      setLoggedInMemberId(data.memberDocId);
      setIsLoggedIn(true);
      setActiveTab('memberPortal');
      showToast(`स्वागत आहे, ${fullMemberObj.name}!`, 'success');
    } catch (err) {
      console.error(err);
      showToast('लॉगिन तपासताना तांत्रिक अडचण आली.', 'error');
    } finally {
      setMemberLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (snapshotTimerRef.current) {
      clearTimeout(snapshotTimerRef.current);
      snapshotTimerRef.current = null;
    }
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch (err) {
      console.error(err);
    }
    initialSnapshotCheckedRef.current = false;
    setIsAdminVerified(false);
    setIsLoggedIn(false);
    setLoggedInMemberId(null);
    setMemberPassbookMember(null);
    setMembers([]);
    setCommitteeMembers([]);
    setContributions([]);
    setLoans([]);
    setEmis([]);
    setExpenses([]);
    setDirectoryMembers([]);
    setDirectoryCommittee([]);
    setDirectoryLoaded(false);
    setUsernameInput('');
    setPasswordInput('');
  };

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      await seedSampleSocietyData();
      setTimeout(() => {
        handleSyncAllSnapshots().catch(console.error);
      }, 1200);
      showToast('नमुना सभासद, वर्गणी व कर्ज डेटा यशस्वीरित्या लोड झाला! 🎉', 'success');
    } catch {
      showToast('डेटा लोड करताना त्रुटी आली.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  // Login Screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-950 via-indigo-900 to-teal-900 flex flex-col justify-center items-center p-4 relative overflow-hidden">
        <OfflineIndicator />

        {/* Ambient decorative background circles */}
        <div className="w-96 h-96 rounded-full bg-blue-500/15 blur-3xl absolute -top-20 -left-20 pointer-events-none" />
        <div className="w-96 h-96 rounded-full bg-teal-400/15 blur-3xl absolute -bottom-20 -right-20 pointer-events-none" />

        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-white/20 overflow-hidden z-10">
          {/* Colorful Material Header */}
          <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-teal-600 p-6 text-center text-white">
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-xs border border-white/30 mx-auto flex items-center justify-center mb-3 shadow-inner">
              <span className="text-3xl">🏛️</span>
            </div>
            <h1 className="text-lg font-extrabold leading-snug text-balance">
              जिल्हा परिषद अभियंता व तांत्रिक कर्मचारी सहकारी पत संस्था मर्या. गडचिरोली
            </h1>
            <p className="text-xs text-blue-100 mt-1.5 font-medium tracking-wide">
              ENGINEERS CONNECT · SMART CLOUD PORTAL
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-5">
            {/* Segmented Role Switcher */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">
                युजर प्रकार निवडा (Select User Role)
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setLoginRole('member')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    loginRole === 'member'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>सभासद (Member)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLoginRole('admin')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    loginRole === 'admin'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>अ‍ॅडमिन (Admin)</span>
                </button>
              </div>
            </div>

            {loginRole === 'admin' ? (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1.5">
                  <p className="font-bold">🔐 सुरक्षित Google Admin लॉगिन</p>
                  <p className="text-blue-800/90 leading-relaxed">
                    अधिकृत संस्थेच्या अ‍ॅडमिन खात्याने (<span className="font-mono-num font-bold">{ADMIN_EMAIL}</span>) Google Sign-In करून संपूर्ण डॅशबोर्ड उघडा.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!authReady || adminSigningIn}
                  onClick={handleAdminGoogleLogin}
                  className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 disabled:opacity-60 py-3.5 text-sm font-bold text-white shadow-md transition cursor-pointer"
                >
                  <Shield className="w-4 h-4" />
                  <span>
                    {adminSigningIn ? 'Google लॉगिन सुरू आहे...' : 'Google ने Admin लॉगिन करा'}
                  </span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleMemberLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    सभासद आयडी (Member ID)
                  </label>
                  <input
                    type="text"
                    required
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="उदा. M001"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium uppercase focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    पासवर्ड (Password)
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={memberLoggingIn}
                  className="w-full rounded-xl bg-gradient-to-r from-teal-600 via-emerald-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 disabled:opacity-60 py-3.5 text-sm font-bold text-white shadow-md transition cursor-pointer"
                >
                  {memberLoggingIn ? 'तपासत आहे...' : 'लॉगिन करा (Login to Portal)'}
                </button>
              </form>
            )}

            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>१-रीड फास्ट पासबुक सुरक्षा सक्रिय</span>
              <PWAInstallButton />
            </div>
          </div>
        </div>

        {/* Toast on Login Screen */}
        {toast && (
          <div
            className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs font-bold text-white ${
              toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
            }`}
          >
            {toast.type === 'error' ? (
              <XCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{toast.msg}</span>
          </div>
        )}
      </div>
    );
  }

  const isAdmin = !loggedInMemberId && isAdminVerified;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row">
      <OfflineIndicator />

      {/* Sidebar Navigation (Desktop) */}
      <aside className="hidden lg:flex lg:w-68 xl:w-72 bg-gradient-to-b from-blue-950 via-indigo-950 to-slate-900 text-white flex-col justify-between p-5 shrink-0 no-print">
        <div>
          <div className="flex items-center gap-3 pb-5 border-b border-white/10">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xl shadow-md shrink-0">
              🏛️
            </div>
            <div>
              <h1 className="text-sm font-extrabold leading-tight">
                जि.प. अभियंता पत संस्था
              </h1>
              <p className="text-[11px] text-blue-300 mt-0.5">गडचिरोली · मर्यादित</p>
            </div>
          </div>

          <nav className="mt-6 space-y-1.5">
            {isAdmin && (
              <>
                <button
                  onClick={() => setActiveTab('members')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeTab === 'members'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                      : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span>१. सभासद यादी व प्रोफाइल</span>
                </button>

                <button
                  onClick={() => setActiveTab('monthly')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeTab === 'monthly'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                      : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>२. मासिक वर्गणी ट्रॅकिंग</span>
                </button>
              </>
            )}

            <button
              onClick={() => setActiveTab('loans')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'loans'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                  : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Zap className="w-4 h-4 shrink-0" />
              <span>{isAdmin ? '३. कर्ज व हप्ते (Loan Ledger)' : 'कर्ज व हप्ते लेजर'}</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab('expenses')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'expenses'
                    ? 'bg-gradient-to-r from-rose-600 to-orange-600 text-white shadow-md'
                    : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Receipt className="w-4 h-4 shrink-0" />
                <span>४. खर्च व जमा (Vouchers)</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('directory')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'directory'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md'
                  : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Award className="w-4 h-4 shrink-0" />
              <span>
                {isAdmin ? '५. कार्यकारिणी व सभासद' : 'कार्यकारिणी व सभासद यादी'}
              </span>
            </button>

            {!isAdmin && (
              <button
                onClick={() => setActiveTab('memberPortal')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'memberPortal'
                    ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md'
                    : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <User className="w-4 h-4 shrink-0" />
                <span>माझे प्रोफाइल (Member Portal)</span>
              </button>
            )}
          </nav>
        </div>

        <div className="space-y-3 pt-6 border-t border-white/10">
          {isAdmin && members.length === 0 && (
            <button
              onClick={handleSeedData}
              disabled={seeding}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-bold transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{seeding ? 'लोड होत आहे...' : 'नमुना डेटा लोड करा'}</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-rose-600 text-white text-xs font-bold transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>लॉगआउट (Logout)</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: 3 Zones */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-30 no-print">
          {/* Zone 1: Brand Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <span className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 truncate">
              {isAdmin
                ? 'Executive Management Dashboard'
                : `स्वागत आहे, ${loggedInMemberObj?.name || 'सभासद'}`}
            </span>
          </div>

          {/* Zone 2: Quick Nav Links on Tablet/Mobile */}
          <nav className="hidden md:flex lg:hidden items-center gap-4 text-xs font-semibold text-slate-600">
            {isAdmin ? (
              <>
                <button
                  onClick={() => setActiveTab('members')}
                  className={activeTab === 'members' ? 'text-blue-600 font-bold' : ''}
                >
                  सभासद
                </button>
                <button
                  onClick={() => setActiveTab('monthly')}
                  className={activeTab === 'monthly' ? 'text-emerald-600 font-bold' : ''}
                >
                  मासिक वर्गणी
                </button>
                <button
                  onClick={() => setActiveTab('loans')}
                  className={activeTab === 'loans' ? 'text-indigo-600 font-bold' : ''}
                >
                  कर्ज लेजर
                </button>
                <button
                  onClick={() => setActiveTab('expenses')}
                  className={activeTab === 'expenses' ? 'text-rose-600 font-bold' : ''}
                >
                  खर्च
                </button>
                <button
                  onClick={() => setActiveTab('directory')}
                  className={activeTab === 'directory' ? 'text-amber-600 font-bold' : ''}
                >
                  कार्यकारिणी
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setActiveTab('memberPortal')}
                  className={activeTab === 'memberPortal' ? 'text-teal-600 font-bold' : ''}
                >
                  माझे प्रोफाइल
                </button>
                <button
                  onClick={() => setActiveTab('loans')}
                  className={activeTab === 'loans' ? 'text-indigo-600 font-bold' : ''}
                >
                  कर्ज लेजर
                </button>
                <button
                  onClick={() => setActiveTab('directory')}
                  className={activeTab === 'directory' ? 'text-amber-600 font-bold' : ''}
                >
                  कार्यकारिणी
                </button>
              </>
            )}
          </nav>

          {/* Zone 3: Primary Actions */}
          <div className="flex items-center gap-2.5">
            {isAdmin && (
              <button
                onClick={() => setCloudModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-extrabold transition cursor-pointer whitespace-nowrap shadow-2xs"
                title="Google Firebase Cloud Status & Backup"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>☁️ Firebase Connected</span>
              </button>
            )}
            <PWAInstallButton />
            <button
              onClick={handleLogout}
              className="lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-xs font-bold text-slate-700 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>बाहेर</span>
            </button>
          </div>
        </header>

        {/* Mobile Drawer Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-blue-950 text-white px-4 py-3 space-y-1.5 border-b border-blue-900 no-print">
            {isAdmin && (
              <>
                <button
                  onClick={() => {
                    setActiveTab('members');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-white/10"
                >
                  १. सभासद यादी व प्रोफाइल
                </button>
                <button
                  onClick={() => {
                    setActiveTab('monthly');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-white/10"
                >
                  २. मासिक वर्गणी ट्रॅकिंग
                </button>
              </>
            )}
            <button
              onClick={() => {
                setActiveTab('loans');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-white/10"
            >
              ३. कर्ज व हप्ते (Loan Ledger)
            </button>
            {isAdmin && (
              <button
                onClick={() => {
                  setActiveTab('expenses');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-white/10"
              >
                ४. खर्च व जमा (Vouchers)
              </button>
            )}
            <button
              onClick={() => {
                setActiveTab('directory');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-white/10"
            >
              {isAdmin ? '५. कार्यकारिणी व सभासद' : 'कार्यकारिणी व सभासद यादी'}
            </button>
            {!isAdmin && (
              <button
                onClick={() => {
                  setActiveTab('memberPortal');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-white/10"
              >
                माझे प्रोफाइल (Member Portal)
              </button>
            )}
          </div>
        )}

        {/* Main Viewport Content */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto space-y-6">
          {/* TAB 1: MEMBERS DIRECTORY */}
          {activeTab === 'members' && (
            <>
              {/* Colorful Material Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white shadow-md flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-blue-100">
                      एकूण सक्रिय सभासद (Active Members)
                    </p>
                    <p className="text-3xl font-extrabold font-mono-num mt-1">
                      {activeMembersCount}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                </div>

                <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white shadow-md flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-emerald-100">
                      संस्थेचे एकूण शेअर कॅपिटल
                    </p>
                    <p className="text-3xl font-extrabold font-mono-num mt-1">
                      ₹ {totalShareCapital.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center text-xl font-bold">
                    ₹
                  </div>
                </div>

                <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 p-5 text-white shadow-md flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-violet-100">
                      एकूण जमा वर्गणी (Total Contribution)
                    </p>
                    <p className="text-3xl font-extrabold font-mono-num mt-1">
                      ₹ {totalContributionPool.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>

              {/* Birthday Alerts & WhatsApp Greeter */}
              {birthdayMembersThisMonth.length > 0 && (
                <div className="rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 border border-amber-200 p-5 space-y-3 no-print">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                    <Gift className="w-5 h-5 text-rose-600 shrink-0" />
                    <span>
                      {todayBirthdayMembers.length > 0
                        ? '🎉 आज वाढदिवस असलेले व या महिन्यातील सन्माननीय सभासद:'
                        : '🎂 या महिन्यात वाढदिवस असलेले सन्माननीय सभासद:'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {birthdayMembersThisMonth.map((bm) => {
                      const isToday = isTodayBirthday(bm.dob);
                      return (
                        <div
                          key={bm.docId}
                          className={`p-3.5 rounded-xl bg-white border flex items-center justify-between gap-3 ${
                            isToday ? 'border-rose-400 ring-2 ring-rose-100' : 'border-amber-200'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {isToday ? '🌟 आज वाढदिवस: ' : '🎂 '}
                              {bm.name}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {bm.designation} · दिनांक:{' '}
                              <span className="font-mono-num font-semibold">{bm.dob}</span>
                            </p>
                          </div>
                          <a
                            href={buildWhatsAppBirthdayUrl(bm.name, bm.mobile)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 transition shadow-xs"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp शुभेच्छा</span>
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Members Table Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      सभासदांची सविस्तर यादी व प्रोफाइल
                    </h2>
                    <p className="text-xs text-slate-500">
                      पदांनुसार फिल्टर करा किंवा नावावर क्लिक करून संपूर्ण पासबुक पाहा
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 no-print">
                    <select
                      value={designationFilter}
                      onChange={(e) => setDesignationFilter(e.target.value)}
                      className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:bg-white focus:border-blue-600 focus:outline-none"
                    >
                      <option value="">-- सर्व पदे (All Designations) --</option>
                      {designationsList.map((deg) => (
                        <option key={deg} value={deg}>
                          {deg}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => exportMembersToCSV(members, contributions)}
                      className="flex items-center gap-1.5 rounded-xl border border-emerald-600 text-emerald-700 hover:bg-emerald-50 px-3.5 py-2 text-xs font-bold transition cursor-pointer whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Excel / CSV</span>
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => {
                          setEditingMember(null);
                          setMemberModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold shadow-xs transition cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4" />
                        <span>नवीन सभासद</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Search Input */}
                <div className="relative no-print">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="सभासदाचे नाव, आयडी (M001), मोबाईल, ईमेल, पॅन किंवा पत्ता शोधा..."
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-4 py-2.5 text-xs sm:text-sm focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>

                {/* High-Density Colorful Material Data Table */}
                <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
                  <table className="w-full border-collapse text-xs sm:text-[13px] text-center align-middle">
                    <thead>
                      <tr className="bg-gradient-to-r from-slate-100 via-blue-50/60 to-indigo-50/50 text-slate-700 border-b border-slate-200 uppercase tracking-wider text-[11px] font-extrabold">
                        <th className="py-3.5 px-2.5 w-12">अ.क्र.</th>
                        <th className="py-3.5 px-2.5 w-16">फोटो</th>
                        <th className="py-3.5 px-3 text-left min-w-[180px]">आयडी, नाव व पद</th>
                        <th className="py-3.5 px-3 text-left min-w-[170px]">ओळख (Email / PAN)</th>
                        <th className="py-3.5 px-2.5 min-w-[125px]">जन्मतारीख / वय</th>
                        <th className="py-3.5 px-2.5 min-w-[130px]">मोबाईल / जॉईनिंग</th>
                        <th className="py-3.5 px-3 text-left min-w-[190px]">पत्ता व नॉमिनी</th>
                        <th className="py-3.5 px-2.5 w-24">स्टेटस</th>
                        <th className="py-3.5 px-3 w-28">शेअर कॅपिटल (₹)</th>
                        <th className="py-3.5 px-3 w-28">जमा वर्गणी (₹)</th>
                        {isAdmin && (
                          <th className="py-3.5 px-3 w-32 no-print">कृती</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/90">
                      {filteredMembers.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="py-12 text-center text-slate-500 font-medium">
                            कोणताही सभासद सापडला नाही.
                            {members.length === 0 && isAdmin && (
                              <div className="mt-3">
                                <button
                                  onClick={handleSeedData}
                                  disabled={seeding}
                                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer shadow-sm"
                                >
                                  {seeding ? 'लोड होत आहे...' : 'नमुना सभासद डेटा लोड करा'}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : (
                        paginatedMembers.map((m, idx) => {
                          const globalIdx = (membersPage - 1) * PAGE_SIZE + idx + 1;
                          const memContrib = contributions
                            .filter((c) => c.memberDocId === m.docId)
                            .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

                          const avatarUrl =
                            m.photo && m.photo.trim() !== '' ? m.photo : DEFAULT_AVATAR_URL;

                          return (
                            <tr
                              key={m.docId}
                              className="hover:bg-blue-50/50 transition-colors group"
                            >
                              <td className="py-3.5 px-2.5 font-mono-num font-bold text-slate-500">
                                {globalIdx}
                              </td>
                              <td className="py-3.5 px-2.5">
                                <div
                                  onClick={() => setViewingMember(m)}
                                  className="w-11 h-11 mx-auto rounded-xl bg-white border-2 border-blue-600 p-0.5 shadow-xs overflow-hidden flex items-center justify-center cursor-pointer group-hover:scale-105 transition-transform"
                                >
                                  <img
                                    src={avatarUrl}
                                    alt={m.name}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-contain rounded-lg"
                                  />
                                </div>
                              </td>
                              <td className="py-3.5 px-3 text-left">
                                <span className="inline-block px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-mono-num text-[11px] font-extrabold mb-1">
                                  {m.id}
                                </span>
                                <div>
                                  <button
                                    onClick={() => setViewingMember(m)}
                                    className="font-extrabold text-blue-700 hover:text-blue-900 hover:underline text-left text-sm leading-snug cursor-pointer"
                                  >
                                    {m.name}
                                  </button>
                                </div>
                                <div className="text-xs font-semibold text-indigo-600 mt-0.5">
                                  💼 {m.designation}
                                </div>
                              </td>
                              <td className="py-3.5 px-3 text-left">
                                <div className="text-xs text-slate-700 font-medium break-all">
                                  📧 {m.email || '-'}
                                </div>
                                <div className="font-mono-num text-xs font-bold text-slate-600 mt-1">
                                  💳 पॅन: {m.pan || '-'}
                                </div>
                              </td>
                              <td className="py-3.5 px-2.5">
                                <div className="font-mono-num font-bold text-slate-800 text-xs">
                                  📅 {m.dob}
                                </div>
                                <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold">
                                  वय: {calculateAge(m.dob)}
                                </span>
                              </td>
                              <td className="py-3.5 px-2.5">
                                <div className="font-mono-num font-extrabold text-slate-900 text-xs">
                                  📞 {m.mobile}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono-num mt-1">
                                  जॉईन: {m.joiningDate}
                                </div>
                              </td>
                              <td className="py-3.5 px-3 text-left max-w-[230px]">
                                <div className="text-xs text-slate-700 font-medium leading-snug">
                                  🏢 {m.officeAddress || '-'}
                                </div>
                                {m.homeAddress && m.homeAddress !== '-' && (
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    🏠 {m.homeAddress}
                                  </div>
                                )}
                                <div className="text-[11px] text-slate-600 mt-1">
                                  <strong className="text-slate-800">नॉमिनी:</strong>{' '}
                                  {m.nominee || '-'} ({m.nomineeRelation || '-'})
                                </div>
                              </td>
                              <td className="py-3.5 px-2.5">
                                <span
                                  className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-extrabold text-white shadow-2xs ${
                                    m.status === 'Active' ? 'bg-emerald-600' : 'bg-slate-400'
                                  }`}
                                >
                                  {m.status === 'Active' ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="py-3.5 px-3 font-mono-num font-extrabold text-emerald-700 text-sm whitespace-nowrap">
                                ₹ {Number(m.share || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="py-3.5 px-3 font-mono-num font-extrabold text-sky-600 text-sm whitespace-nowrap">
                                ₹ {memContrib.toLocaleString('en-IN')}
                              </td>
                              {isAdmin && (
                                <td className="py-3.5 px-3 no-print">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => {
                                        setEditingMember(m);
                                        setMemberModalOpen(true);
                                      }}
                                      className="px-2.5 py-1 rounded-lg border border-blue-500 text-blue-600 hover:bg-blue-600 hover:text-white text-xs font-bold transition cursor-pointer"
                                    >
                                      सुधार
                                    </button>
                                    <button
                                      onClick={() =>
                                        setConfirmDelete({
                                          title: `सभासद "${m.name}" डिलिट करायचा का?`,
                                          onConfirm: async () => {
                                            try {
                                              await deleteDoc(doc(db, 'members', m.docId));
                                              await deleteMemberPassbook(m.id);
                                              scheduleSnapshotSync(undefined, 'directory');
                                              showToast('सभासद रेकॉर्ड डिलिट केले.', 'success');
                                            } catch (err) {
                                              handleFirestoreError(
                                                err,
                                                OperationType.DELETE,
                                                `members/${m.docId}`
                                              );
                                            }
                                          },
                                        })
                                      }
                                      className="px-2.5 py-1 rounded-lg border border-rose-500 text-rose-600 hover:bg-rose-600 hover:text-white text-xs font-bold transition cursor-pointer"
                                    >
                                      डिलिट
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {filteredMembers.length > PAGE_SIZE && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-600 no-print">
                    <span className="font-mono-num font-semibold">
                      पान {membersPage} / {totalMembersPages} (एकूण {filteredMembers.length} सभासद)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={membersPage <= 1}
                        onClick={() => setMembersPage((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-40 font-bold cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>मागे</span>
                      </button>
                      <button
                        type="button"
                        disabled={membersPage >= totalMembersPages}
                        onClick={() => setMembersPage((p) => Math.min(totalMembersPages, p + 1))}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-40 font-bold cursor-pointer"
                      >
                        <span>पुढे</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 2: MONTHLY CONTRIBUTIONS */}
          {activeTab === 'monthly' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-emerald-800">
                    कर्मचारी मासिक वर्गणी ट्रॅकिंग (Monthly Contribution)
                  </h2>
                  <p className="text-xs text-slate-500">
                    प्रत्येक महिन्याला कर्मचाऱ्यांच्या पगारातून जमा होणाऱ्या वर्गणीची नोंद
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    value={monthlyMonthFilter}
                    onChange={(e) => setMonthlyMonthFilter(e.target.value)}
                    className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 focus:bg-white focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="">-- सर्व महिने ({contributions.length}) --</option>
                    {availableContributionMonths.map((mon) => (
                      <option key={mon} value={mon}>
                        {mon}
                      </option>
                    ))}
                  </select>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setPreselectedMemberForMonthly(undefined);
                        setEditingMonthlyContrib(null);
                        setMonthlyModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-xs font-bold shadow-xs transition cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ नवीन वर्गणी जोडा</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
                <table className="w-full text-center border-collapse text-xs sm:text-sm align-middle">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-100 via-emerald-50/60 to-teal-50/50 text-slate-700 border-b border-slate-200 uppercase text-[11px] font-extrabold">
                      <th className="py-3.5 px-3">अ.क्र.</th>
                      <th className="py-3.5 px-3">पावती क्र.</th>
                      <th className="py-3.5 px-3">दिनांक</th>
                      <th className="py-3.5 px-3">सभासद आयडी</th>
                      <th className="py-3.5 px-3 text-left">सभासदाचे नाव</th>
                      <th className="py-3.5 px-3">महिना व वर्ष</th>
                      <th className="py-3.5 px-3">वर्गणी रक्कम (₹)</th>
                      {isAdmin && (
                        <th className="py-3.5 px-3">कृती</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredContributions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-400">
                          कोणतीही मासिक वर्गणी नोंद सापडली नाही.
                        </td>
                      </tr>
                    ) : (
                      paginatedContributions.map((c, idx) => (
                        <tr key={c.docId} className="hover:bg-emerald-50/30 transition-colors">
                          <td className="py-3 px-3 font-mono-num font-bold text-slate-500">
                            {(monthlyPage - 1) * PAGE_SIZE + idx + 1}
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-block px-2.5 py-0.5 rounded-md bg-blue-600 text-white text-xs font-extrabold font-mono-num shadow-2xs">
                              {c.receiptNo}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono-num text-slate-700 font-medium">
                            {c.date}
                          </td>
                          <td className="py-3 px-3 font-mono-num font-bold text-slate-700">
                            {c.memberId}
                          </td>
                          <td className="py-3 px-3 text-left font-extrabold text-slate-900">
                            {c.memberName}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-extrabold text-slate-900 uppercase">
                              {c.month}
                            </span>
                            {c.note && (
                              <div className="text-[11px] text-slate-500">{c.note}</div>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono-num font-extrabold text-emerald-700">
                            ₹ {Number(c.amount || 0).toLocaleString('en-IN')}
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-3">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => {
                                    setEditingMonthlyContrib(c);
                                    setMonthlyModalOpen(true);
                                  }}
                                  className="px-3 py-1 rounded-lg border border-blue-500 text-blue-600 hover:bg-blue-600 hover:text-white text-xs font-bold transition cursor-pointer"
                                >
                                  सुधार
                                </button>
                                <button
                                  onClick={() =>
                                    setConfirmDelete({
                                      title: `पावती क्र. "${c.receiptNo}" ची वर्गणी नोंद डिलिट करायची का?`,
                                      onConfirm: async () => {
                                        try {
                                          await deleteDoc(
                                            doc(db, 'monthly_contributions', c.docId)
                                          );
                                          scheduleSnapshotSync(c.memberDocId, 'member');
                                          showToast('वर्गणी नोंद डिलिट केली.', 'success');
                                        } catch (err) {
                                          handleFirestoreError(
                                            err,
                                            OperationType.DELETE,
                                            `monthly_contributions/${c.docId}`
                                          );
                                        }
                                      },
                                    })
                                  }
                                  className="px-3 py-1 rounded-lg border border-rose-500 text-rose-600 hover:bg-rose-600 hover:text-white text-xs font-bold transition cursor-pointer"
                                >
                                  डिलिट
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {filteredContributions.length > PAGE_SIZE && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-600 no-print">
                  <span className="font-mono-num font-semibold">
                    पान {monthlyPage} / {totalMonthlyPages} (एकूण {filteredContributions.length} नोंदी)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={monthlyPage <= 1}
                      onClick={() => setMonthlyPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-40 font-bold cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>मागे</span>
                    </button>
                    <button
                      type="button"
                      disabled={monthlyPage >= totalMonthlyPages}
                      onClick={() => setMonthlyPage((p) => Math.min(totalMonthlyPages, p + 1))}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-40 font-bold cursor-pointer"
                    >
                      <span>पुढे</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LOANS & EMI LEDGER */}
          {activeTab === 'loans' && (
            <div className="space-y-6">
              {viewingLoanLedger ? (
                <AmortizationScheduleView
                  loan={viewingLoanLedger}
                  emis={emis}
                  member={
                    loggedInMemberObj?.docId === viewingLoanLedger.memberDocId
                      ? loggedInMemberObj
                      : members.find((m) => m.docId === viewingLoanLedger.memberDocId)
                  }
                  onClose={() => setViewingLoanLedger(null)}
                  isAdmin={isAdmin}
                  onPayEmiClick={(ln, targetMonth, targetDate) => {
                    setPayEmiDefaultMonth(targetMonth);
                    setPayEmiDefaultDate(targetDate);
                    setPayEmiModalLoan(ln);
                  }}
                />
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-base font-bold text-indigo-900">
                        ⚡ कर्मचारी कर्ज आणि हप्ते व्यवस्थापन (Loan Ledger)
                      </h2>
                      <p className="text-xs text-slate-500">
                        सभासदांचे मंजूर कर्ज, १०% वर्गणी कपात, जामीनदार, EMI आणि महिनानिहाय शेड्यूल
                      </p>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => setLoanModalOpen(true)}
                        className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-xs font-bold shadow-xs transition cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4" />
                        <span>नवीन कर्ज मंजूर करा</span>
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                          <th className="py-3 px-3 font-semibold">अ.क्र.</th>
                          <th className="py-3 px-3 font-semibold">मंजूर दिनांक</th>
                          <th className="py-3 px-3 font-semibold">सभासद नाव व आयडी</th>
                          <th className="py-3 px-3 font-semibold text-right">कर्ज रक्कम (₹)</th>
                          <th className="py-3 px-3 font-semibold">व्याजदर व कालावधी</th>
                          <th className="py-3 px-3 font-semibold text-right">मासिक EMI (₹)</th>
                          <th className="py-3 px-3 font-semibold text-right">शिल्लक कर्ज (₹)</th>
                          <th className="py-3 px-3 font-semibold">स्थिती</th>
                          <th className="py-3 px-3 font-semibold text-center">EMI / शेड्यूल</th>
                          {isAdmin && (
                            <th className="py-3 px-3 font-semibold text-center">कृती</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {loans.filter((l) => !loggedInMemberId || l.memberDocId === loggedInMemberId)
                          .length === 0 ? (
                          <tr>
                            <td colSpan={10} className="py-10 text-center text-slate-400">
                              कोणतेही कर्ज रेकॉर्ड सापडले नाही.
                            </td>
                          </tr>
                        ) : (
                          loans
                            .filter(
                              (l) => !loggedInMemberId || l.memberDocId === loggedInMemberId
                            )
                            .map((l, idx) => {
                              const mem =
                                loggedInMemberObj?.docId === l.memberDocId
                                  ? loggedInMemberObj
                                  : members.find((m) => m.docId === l.memberDocId);
                              const balance = computeDayWiseLoanSchedule(l, emis).remainingPrincipal;
                              const isClosed = l.status === 'Closed' || balance === 0;

                              return (
                                <tr key={l.docId} className="hover:bg-slate-50">
                                  <td className="py-3 px-3 font-mono-num text-slate-500">
                                    {idx + 1}
                                  </td>
                                  <td className="py-3 px-3 font-mono-num text-slate-700">
                                    {l.loanDate}
                                  </td>
                                  <td className="py-3 px-3">
                                    <button
                                      onClick={() => setViewingLoanLedger(l)}
                                      className="font-bold text-indigo-700 hover:underline text-left cursor-pointer"
                                    >
                                      {mem?.name || l.memberName}
                                    </button>
                                    <div className="text-[11px] text-slate-500 font-mono-num">
                                      ID: {mem?.id || '-'} · जामीनदार: {l.guarantor || '-'}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono-num font-bold text-slate-900">
                                    ₹ {Number(l.principal || 0).toLocaleString('en-IN')}
                                  </td>
                                  <td className="py-3 px-3 font-mono-num text-slate-700">
                                    <div>{l.interestRate}% · {l.months} महिने</div>
                                    <div className="text-[11px] text-indigo-600">
                                      EMI तारीख: दरमहा {l.emiDay || 1}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono-num font-bold text-emerald-700">
                                    ₹ {Number(l.monthlyEmi || 0).toLocaleString('en-IN')}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono-num font-bold text-rose-700">
                                    ₹ {balance.toLocaleString('en-IN')}
                                  </td>
                                  <td className="py-3 px-3">
                                    <span
                                      className={`font-semibold ${
                                        isClosed ? 'text-slate-500' : 'text-emerald-700'
                                      }`}
                                    >
                                      {isClosed ? 'बंद (Closed)' : 'सक्रिय (Active)'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                                      {isAdmin && !isClosed && (
                                        <button
                                          onClick={() => {
                                            setPayEmiDefaultMonth(undefined);
                                            setPayEmiDefaultDate(undefined);
                                            setPayEmiModalLoan(l);
                                          }}
                                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer whitespace-nowrap"
                                        >
                                          + EMI भरा
                                        </button>
                                      )}
                                      <button
                                        onClick={() => setViewingLoanLedger(l)}
                                        className="px-2.5 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-[11px] font-bold cursor-pointer whitespace-nowrap"
                                      >
                                        लेजर / शेड्यूल
                                      </button>
                                      <button
                                        onClick={() => {
                                          setViewingLoanLedger(l);
                                          setTimeout(() => window.print(), 250);
                                        }}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-[11px] font-bold cursor-pointer whitespace-nowrap"
                                        title="EMI शेड्यूल प्रिंट काढा"
                                      >
                                        <Printer className="w-3.5 h-3.5" />
                                        <span>प्रिंट</span>
                                      </button>
                                      <button
                                        disabled={downloadingLoanPdfId === l.docId}
                                        onClick={async () => {
                                          setDownloadingLoanPdfId(l.docId);
                                          try {
                                            const sched = computeDayWiseLoanSchedule(l, emis);
                                            await downloadLoanSchedulePdf(l, sched, mem);
                                            showToast('EMI शेड्यूल PDF डाउनलोड झाली! 📥', 'success');
                                          } catch {
                                            showToast('PDF तयार करताना अडचण आली.', 'error');
                                          } finally {
                                            setDownloadingLoanPdfId(null);
                                          }
                                        }}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[11px] font-bold cursor-pointer whitespace-nowrap"
                                        title="EMI शेड्यूल PDF डाउनलोड करा"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>
                                          {downloadingLoanPdfId === l.docId ? '...' : 'PDF'}
                                        </span>
                                      </button>
                                    </div>
                                  </td>
                                  {isAdmin && (
                                    <td className="py-3 px-3 text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        {!isClosed && (
                                          <button
                                            onClick={() =>
                                              setCloseLoanModalTarget({ loan: l, balance })
                                            }
                                            className="p-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 cursor-pointer"
                                            title="कर्ज खाते बंद करा"
                                          >
                                            <Lock className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                        <button
                                          onClick={() =>
                                            setConfirmDelete({
                                              title: `"${l.memberName}" चे कर्ज रेकॉर्ड डिलिट करायचे का?`,
                                              onConfirm: async () => {
                                                try {
                                                  await deleteDoc(doc(db, 'loans', l.docId));
                                                  scheduleSnapshotSync(l.memberDocId, 'member');
                                                  showToast('कर्ज रेकॉर्ड डिलिट केले.', 'success');
                                                } catch (err) {
                                                  handleFirestoreError(
                                                    err,
                                                    OperationType.DELETE,
                                                    `loans/${l.docId}`
                                                  );
                                                }
                                              },
                                            })
                                          }
                                          className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                                          title="डिलिट करा"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              );
                            })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: EXPENSES & DIGITAL VOUCHERS */}
          {activeTab === 'expenses' && isAdmin && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl bg-gradient-to-br from-rose-600 to-orange-600 p-5 text-white shadow-md flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-rose-100">
                      एकूण कार्यालयीन खर्च (Total Expenses)
                    </p>
                    <p className="text-3xl font-extrabold font-mono-num mt-1">
                      ₹ {totalExpensesSum.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
                    <Receipt className="w-6 h-6 text-white" />
                  </div>
                </div>

                <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white shadow-md flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-emerald-100">
                      निव्वळ शिल्लक निधी (Net Balance Pool)
                    </p>
                    <p className="text-3xl font-extrabold font-mono-num mt-1">
                      ₹ {netBalancePool.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center text-xl font-bold">
                    💼
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-rose-800">
                      💸 संस्थेचा खर्च व जमा ताळेबंद (Digital Voucher & Expenses)
                    </h2>
                    <p className="text-xs text-slate-500">
                      बँक खर्च, स्टेशनरी, ऑडिट फी, मीटिंग भत्ता व इतर कार्यालयीन खर्चाची नोंद
                    </p>
                  </div>
                  <button
                    onClick={() => setExpenseModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 text-xs font-bold shadow-xs transition cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>नवीन खर्च नोंदवा (Voucher)</span>
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                        <th className="py-3 px-3.5 font-semibold">अ.क्र.</th>
                        <th className="py-3 px-3.5 font-semibold">वाउचर क्र.</th>
                        <th className="py-3 px-3.5 font-semibold">दिनांक</th>
                        <th className="py-3 px-3.5 font-semibold">खर्चाचा प्रकार (Category)</th>
                        <th className="py-3 px-3.5 font-semibold">तपशील / देणाऱ्याचे नाव</th>
                        <th className="py-3 px-3.5 font-semibold text-right">रक्कम (₹)</th>
                        <th className="py-3 px-3.5 font-semibold">पेमेंट मोड</th>
                        <th className="py-3 px-3.5 font-semibold text-center">डिजिटल पावती</th>
                        <th className="py-3 px-3.5 font-semibold text-center">कृती</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {expenses.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-10 text-center text-slate-400">
                            कोणताही खर्च वाउचर नोंदवलेला नाही.
                          </td>
                        </tr>
                      ) : (
                        expenses.map((e, idx) => (
                          <tr key={e.docId} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3.5 font-mono-num text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3.5 font-mono-num font-bold text-rose-700">
                              {e.voucherNo}
                            </td>
                            <td className="py-2.5 px-3.5 font-mono-num text-slate-600">{e.date}</td>
                            <td className="py-2.5 px-3.5 font-semibold text-slate-900">
                              {e.category}
                            </td>
                            <td className="py-2.5 px-3.5 text-slate-700">{e.description}</td>
                            <td className="py-2.5 px-3.5 text-right font-mono-num font-bold text-rose-700">
                              ₹ {Number(e.amount || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 px-3.5 text-slate-600">{e.mode}</td>
                            <td className="py-2.5 px-3.5 text-center">
                              {e.photo ? (
                                <button
                                  onClick={() => setViewingVoucherPhoto(e.photo || null)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>पाहा</span>
                                </button>
                              ) : (
                                <span className="text-slate-400">नाही</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3.5 text-center">
                              <button
                                onClick={() =>
                                  setConfirmDelete({
                                    title: `वाउचर क्र. "${e.voucherNo}" डिलिट करायचे का?`,
                                    onConfirm: async () => {
                                      try {
                                        await deleteDoc(doc(db, 'expenses', e.docId));
                                        showToast('खर्च वाउचर डिलिट केले.', 'success');
                                      } catch (err) {
                                        handleFirestoreError(
                                          err,
                                          OperationType.DELETE,
                                          `expenses/${e.docId}`
                                        );
                                      }
                                    },
                                  })
                                }
                                className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SOCIETY EXECUTIVE COMMITTEE & MEMBERS PHOTO DIRECTORY */}
          {activeTab === 'directory' && (
            directoryLoading && !isAdmin ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm font-semibold text-slate-500">
                संस्थेची कार्यकारिणी व सभासद यादी लोड होत आहे...
              </div>
            ) : (
              <SocietyDirectoryTab
                members={isAdmin ? members : directoryMembers}
                committeeMembers={isAdmin ? committeeMembers : directoryCommittee}
                isAdmin={isAdmin}
                onViewMember={(m) => {
                  if (isAdmin) setViewingMember(m);
                }}
                onDeleteCommitteeMember={(cm) =>
                  setConfirmDelete({
                    title: `"${cm.name}" (${cm.societyPost}) यांना कार्यकारिणी यादीतून डिलिट करायचे का?`,
                    onConfirm: async () => {
                      try {
                        await deleteDoc(doc(db, 'committee_members', cm.docId));
                        scheduleSnapshotSync(undefined, 'directory');
                        showToast('पदाधिकारी नोंद डिलिट केली.', 'success');
                      } catch (err) {
                        handleFirestoreError(
                          err,
                          OperationType.DELETE,
                          `committee_members/${cm.docId}`
                        );
                      }
                    },
                  })
                }
                onNotify={showToast}
                onMutated={(memberDocId, scope) => scheduleSnapshotSync(memberDocId, scope || 'directory')}
              />
            )
          )}

          {/* TAB 6: EXCLUSIVE MEMBER PORTAL */}
          {activeTab === 'memberPortal' && loggedInMemberObj && (
            <MemberPortalView
              member={loggedInMemberObj}
              contributions={contributions}
              loans={loans}
              emis={emis}
              onNotify={showToast}
            />
          )}
        </main>
      </div>

      {/* MODALS */}
      <MemberFormModal
        isOpen={memberModalOpen}
        onClose={() => setMemberModalOpen(false)}
        editingMember={editingMember}
        onNotify={showToast}
        onMutated={(memberDocId, scope) => scheduleSnapshotSync(memberDocId, scope || 'all')}
      />

      <MonthlyContributionModal
        isOpen={monthlyModalOpen}
        onClose={() => {
          setMonthlyModalOpen(false);
          setEditingMonthlyContrib(null);
          setPreselectedMemberForMonthly(undefined);
        }}
        members={members}
        preselectedMemberDocId={preselectedMemberForMonthly}
        editingContribution={editingMonthlyContrib}
        onNotify={showToast}
        onMutated={(memberDocId) => scheduleSnapshotSync(memberDocId, 'member')}
      />

      <LoanSanctionModal
        isOpen={loanModalOpen}
        onClose={() => setLoanModalOpen(false)}
        members={members}
        onNotify={showToast}
        onMutated={(memberDocId) => scheduleSnapshotSync(memberDocId, 'member')}
      />

      <PayEmiModal
        isOpen={!!payEmiModalLoan}
        onClose={() => {
          setPayEmiModalLoan(null);
          setPayEmiDefaultDate(undefined);
        }}
        loan={payEmiModalLoan}
        emis={emis}
        defaultMonth={payEmiDefaultMonth}
        defaultDate={payEmiDefaultDate}
        onNotify={showToast}
        onMutated={(memberDocId) => scheduleSnapshotSync(memberDocId, 'member')}
      />

      <CloseLoanModal
        isOpen={!!closeLoanModalTarget}
        onClose={() => setCloseLoanModalTarget(null)}
        loan={closeLoanModalTarget?.loan || null}
        currentBalance={closeLoanModalTarget?.balance || 0}
        onNotify={showToast}
        onMutated={(memberDocId) => scheduleSnapshotSync(memberDocId, 'member')}
      />

      <ExpenseFormModal
        isOpen={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        onNotify={showToast}
      />

      <MemberDetailModal
        member={viewingMember ? members.find((m) => m.docId === viewingMember.docId) || viewingMember : null}
        contributions={contributions}
        onClose={() => setViewingMember(null)}
        isAdmin={isAdmin}
        onAddContributionForMember={(m) => {
          setEditingMonthlyContrib(null);
          setPreselectedMemberForMonthly(m.docId);
          setMonthlyModalOpen(true);
        }}
        onEditContribution={(c) => {
          setEditingMonthlyContrib(c);
          setMonthlyModalOpen(true);
        }}
        onDeleteContribution={(c) => {
          setConfirmDelete({
            title: `पावती क्र. "${c.receiptNo}" (${c.month}) ची वर्गणी नोंद डिलिट करायची का?`,
            onConfirm: async () => {
              try {
                await deleteDoc(doc(db, 'monthly_contributions', c.docId));
                scheduleSnapshotSync(c.memberDocId, 'member');
                showToast('वर्गणी नोंद यशस्वीरित्या डिलिट केली.', 'success');
              } catch (err) {
                handleFirestoreError(
                  err,
                  OperationType.DELETE,
                  `monthly_contributions/${c.docId}`
                );
              }
            },
          });
        }}
      />

      <FirebaseCloudModal
        isOpen={cloudModalOpen}
        onClose={() => setCloudModalOpen(false)}
        members={members}
        contributions={contributions}
        loans={loans}
        emis={emis}
        expenses={expenses}
        onSeedSampleData={handleSeedData}
        onSyncAllSnapshots={handleSyncAllSnapshots}
        onNotify={showToast}
      />

      {/* Digital Voucher Photo Lightbox */}
      {viewingVoucherPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4">
          <div className="bg-white rounded-2xl p-4 max-w-lg w-full space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">डिजिटल वाउचर / बिल पावती</h4>
              <button
                onClick={() => setViewingVoucherPhoto(null)}
                className="p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-200 max-h-[70vh] flex items-center justify-center bg-slate-50">
              <img
                src={viewingVoucherPhoto}
                alt="Voucher"
                referrerPolicy="no-referrer"
                className="max-h-[65vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* In-App Delete Confirmation Dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h4 className="text-base font-bold text-slate-900">{confirmDelete.title}</h4>
            <p className="text-xs text-slate-500">
              ही कृती पुन्हा पूर्ववत करता येणार नाही. तुम्हाला खात्री आहे का?
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                रद्द करा
              </button>
              <button
                onClick={async () => {
                  const fn = confirmDelete.onConfirm;
                  setConfirmDelete(null);
                  await fn();
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white cursor-pointer"
              >
                होय, डिलिट करा
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs font-bold text-white ${
            toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
          }`}
        >
          {toast.type === 'error' ? (
            <XCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
