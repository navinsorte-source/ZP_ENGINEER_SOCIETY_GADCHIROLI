import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Printer,
  X,
  Upload,
  Award,
  Users,
} from 'lucide-react';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { db, SOCIETY_OWNER_ID, handleFirestoreError, OperationType } from './firebase';
import { CommitteeMember, Member } from './types';
import { compressImageFile } from './utils';
import { DEFAULT_AVATAR_URL } from './MemberDetailModal';

interface SocietyDirectoryTabProps {
  members: Member[];
  committeeMembers: CommitteeMember[];
  isAdmin: boolean;
  onViewMember: (member: Member) => void;
  onDeleteCommitteeMember: (cm: CommitteeMember) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
  onMutated?: (memberDocId?: string, scope?: 'member' | 'directory' | 'all') => void;
}

const POST_SUGGESTIONS = [
  'अध्यक्ष',
  'उपाध्यक्ष',
  'सचिव',
  'सह-सचिव',
  'कोषाध्यक्ष',
  'खजिनदार',
  'संचालक',
  'कार्यकारी सदस्य',
  'सभासद',
];

export const SocietyDirectoryTab: React.FC<SocietyDirectoryTabProps> = ({
  members,
  committeeMembers,
  isAdmin,
  onViewMember,
  onDeleteCommitteeMember,
  onNotify,
  onMutated,
}) => {
  const [searchText, setSearchText] = useState('');

  // Modal state for Committee Member (Add / Edit)
  const [committeeModalOpen, setCommitteeModalOpen] = useState(false);
  const [editingCommittee, setEditingCommittee] = useState<CommitteeMember | null>(null);
  const [selectedSourceMemberDocId, setSelectedSourceMemberDocId] = useState('');
  const [cmName, setCmName] = useState('');
  const [cmPost, setCmPost] = useState('');
  const [cmOfficeDesig, setCmOfficeDesig] = useState('');
  const [cmMobile, setCmMobile] = useState('');
  const [cmOrder, setCmOrder] = useState('1');
  const [cmPhoto, setCmPhoto] = useState('');
  const [savingCm, setSavingCm] = useState(false);

  // Quick-Edit Modal state for Member Name / Society Post / Photo
  const [editingMemberCard, setEditingMemberCard] = useState<Member | null>(null);
  const [memCardName, setMemCardName] = useState('');
  const [memCardPost, setMemCardPost] = useState('');
  const [memCardPhoto, setMemCardPhoto] = useState('');
  const [savingMemCard, setSavingMemCard] = useState(false);

  const sortedCommittee = useMemo(() => {
    const q = searchText.toLowerCase().trim();
    return [...committeeMembers]
      .sort((a, b) => (Number(a.displayOrder) || 999) - (Number(b.displayOrder) || 999))
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.societyPost.toLowerCase().includes(q) ||
          (c.officeDesignation && c.officeDesignation.toLowerCase().includes(q))
      );
  }, [committeeMembers, searchText]);

  const filteredMembers = useMemo(() => {
    const q = searchText.toLowerCase().trim();
    return members.filter((m) => {
      const post = (m.societyPost || 'सभासद').toLowerCase();
      return (
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        post.includes(q) ||
        (m.designation && m.designation.toLowerCase().includes(q))
      );
    });
  }, [members, searchText]);

  const openAddCommitteeModal = () => {
    setEditingCommittee(null);
    setSelectedSourceMemberDocId('');
    setCmName('');
    setCmPost('');
    setCmOfficeDesig('');
    setCmMobile('');
    setCmOrder(String(committeeMembers.length + 1));
    setCmPhoto('');
    setCommitteeModalOpen(true);
  };

  const openEditCommitteeModal = (cm: CommitteeMember) => {
    setEditingCommittee(cm);
    setSelectedSourceMemberDocId(cm.memberDocId || '');
    setCmName(cm.name || '');
    setCmPost(cm.societyPost || '');
    setCmOfficeDesig(cm.officeDesignation || '');
    setCmMobile(cm.mobile || '');
    setCmOrder(String(cm.displayOrder || 1));
    setCmPhoto(cm.photo || '');
    setCommitteeModalOpen(true);
  };

  const handleSelectSourceMember = (memDocId: string) => {
    setSelectedSourceMemberDocId(memDocId);
    const found = members.find((m) => m.docId === memDocId);
    if (found) {
      setCmName(found.name || '');
      setCmOfficeDesig(found.designation || '');
      setCmMobile(found.mobile || '');
      if (found.photo) setCmPhoto(found.photo);
      if (found.societyPost && !cmPost.trim()) {
        setCmPost(found.societyPost);
      }
    }
  };

  const handleCmPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const b64 = await compressImageFile(e.target.files[0], 360);
        setCmPhoto(b64);
      } catch {
        onNotify('फोटो अपलोड करताना अडचण आली.', 'error');
      }
    }
  };

  const handleSaveCommittee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmName.trim() || !cmPost.trim()) {
      onNotify('कृपया पूर्ण नाव आणि संस्थेतील पद मॅन्युअली लिहा!', 'error');
      return;
    }

    setSavingCm(true);
    const payload = {
      name: cmName.trim().slice(0, 120),
      societyPost: cmPost.trim().slice(0, 80),
      officeDesignation: cmOfficeDesig.trim().slice(0, 100),
      mobile: cmMobile.trim().slice(0, 24),
      photo: cmPhoto.slice(0, 800000),
      displayOrder: Math.min(1000, Math.max(1, Number(cmOrder) || 1)),
      memberDocId: selectedSourceMemberDocId.slice(0, 128),
      ownerId: SOCIETY_OWNER_ID,
    };

    try {
      if (editingCommittee) {
        await updateDoc(doc(db, 'committee_members', editingCommittee.docId), payload);
        onMutated?.(undefined, 'directory');
        onNotify('पदाधिकारी माहिती यशस्वीरित्या अपडेट झाली! ✅', 'success');
      } else {
        await addDoc(collection(db, 'committee_members'), payload);
        onMutated?.(undefined, 'directory');
        onNotify('पदाधिकारी यशस्वीरित्या जोडला गेला! ✅', 'success');
      }
      setCommitteeModalOpen(false);
    } catch (error) {
      handleFirestoreError(
        error,
        editingCommittee ? OperationType.UPDATE : OperationType.CREATE,
        'committee_members'
      );
    } finally {
      setSavingCm(false);
    }
  };

  const openMemberCardEditor = (m: Member) => {
    setEditingMemberCard(m);
    setMemCardName(m.name || '');
    setMemCardPost(m.societyPost || 'सभासद');
    setMemCardPhoto(m.photo || '');
  };

  const handleMemCardPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const b64 = await compressImageFile(e.target.files[0], 360);
        setMemCardPhoto(b64);
      } catch {
        onNotify('फोटो अपलोड करताना अडचण आली.', 'error');
      }
    }
  };

  const handleSaveMemberCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMemberCard || !memCardName.trim()) {
      onNotify('कृपया सभासदाचे पूर्ण नाव भरा!', 'error');
      return;
    }

    setSavingMemCard(true);
    try {
      await updateDoc(doc(db, 'members', editingMemberCard.docId), {
        name: memCardName.trim().slice(0, 120),
        societyPost: (memCardPost.trim() || 'सभासद').slice(0, 80),
        photo: memCardPhoto.slice(0, 800000),
      });
      onMutated?.(editingMemberCard.docId, 'all');
      onNotify('सभासदाचे नाव, पद व फोटो यशस्वीरित्या अपडेट झाले! ✅', 'success');
      setEditingMemberCard(null);
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `members/${editingMemberCard.docId}`
      );
    } finally {
      setSavingMemCard(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              🏛️ संस्थेची कार्यकारिणी व सर्व सभासद फोटो यादी
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              जिल्हा परिषद अभियंता व तांत्रिक कर्मचारी सहकारी पत संस्था मर्या. गडचिरोली — अध्यक्ष,
              सचिव व सर्व सन्माननीय सभासद
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 no-print">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 px-3.5 py-2 text-xs font-bold transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>प्रिंट काढा</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={openAddCommitteeModal}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-4 py-2 text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>पदाधिकारी जोडा (अध्यक्ष / सचिव)</span>
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative no-print">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="अध्यक्ष, सचिव किंवा सभासदाचे नाव, संस्थेतील पद शोधा..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-4 py-2.5 text-xs sm:text-sm focus:bg-white focus:border-blue-600 focus:outline-none"
          />
        </div>
      </div>

      {/* SECTION 1: EXECUTIVE COMMITTEE (अध्यक्ष, सचिव व पदाधिकारी) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                संस्थेचे पदाधिकारी व कार्यकारिणी (अध्यक्ष / सचिव / संचालक)
              </h3>
              <p className="text-xs text-slate-500">
                फोटोसह मॅन्युअल नाव व संस्थेतील पद नोंदविलेले सन्माननीय पदाधिकारी
              </p>
            </div>
          </div>
          <span className="text-xs font-mono-num font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
            एकूण: {sortedCommittee.length}
          </span>
        </div>

        {sortedCommittee.length === 0 ? (
          <div className="rounded-2xl bg-amber-50/60 border border-dashed border-amber-300 p-8 text-center space-y-3">
            <p className="text-sm font-semibold text-amber-900">
              अद्याप कार्यकारिणी पदाधिकारी (अध्यक्ष / सचिव) जोडलेले नाहीत.
            </p>
            {isAdmin && (
              <button
                type="button"
                onClick={openAddCommitteeModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>+ पहिला पदाधिकारी जोडा (उदा. अध्यक्ष / सचिव)</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {sortedCommittee.map((cm, index) => {
              const avatarUrl = cm.photo && cm.photo.trim() !== '' ? cm.photo : DEFAULT_AVATAR_URL;
              const isTopLeader = index === 0 || cm.societyPost.includes('अध्यक्ष');

              return (
                <div
                  key={cm.docId}
                  className={`rounded-2xl border overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between bg-white ${
                    isTopLeader
                      ? 'border-amber-300 ring-2 ring-amber-100'
                      : 'border-indigo-200'
                  }`}
                >
                  <div>
                    {/* Colorful Top Banner */}
                    <div
                      className={`h-16 ${
                        isTopLeader
                          ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500'
                          : 'bg-gradient-to-r from-blue-700 via-indigo-700 to-teal-600'
                      }`}
                    />

                    {/* Photo Overlapping Banner */}
                    <div className="px-4 pb-4 -mt-12 text-center">
                      <div className="w-28 h-28 mx-auto rounded-2xl bg-white p-1 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center">
                        <img
                          src={avatarUrl}
                          alt={cm.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover rounded-xl"
                        />
                      </div>

                      {/* Society Post Badge Below Photo */}
                      <div className="mt-3">
                        <span
                          className={`inline-block px-3.5 py-1 rounded-full text-xs font-extrabold tracking-wide ${
                            isTopLeader
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                          }`}
                        >
                          {cm.societyPost}
                        </span>
                      </div>

                      {/* Full Name */}
                      <h4 className="mt-2.5 text-sm sm:text-base font-extrabold text-slate-900 leading-snug">
                        {cm.name}
                      </h4>

                      {/* Office Designation & Mobile */}
                      {cm.officeDesignation && (
                        <p className="text-xs text-slate-600 font-medium mt-1">
                          {cm.officeDesignation}
                        </p>
                      )}
                      {cm.mobile && (
                        <p className="text-[11px] text-slate-500 font-mono-num mt-0.5">
                          📞 {cm.mobile}
                        </p>
                      )}
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-2 no-print">
                      <button
                        type="button"
                        onClick={() => openEditCommitteeModal(cm)}
                        className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg border border-blue-500 text-blue-700 hover:bg-blue-600 hover:text-white text-xs font-bold transition cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>सुधार</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteCommitteeMember(cm)}
                        className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg border border-rose-400 text-rose-600 hover:bg-rose-600 hover:text-white text-xs font-bold transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>डिलिट</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: ALL SOCIETY MEMBERS PHOTO DIRECTORY */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-teal-600 text-white flex items-center justify-center shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                संस्थेचे सर्व सन्माननीय सभासद (फोटो, पूर्ण नाव व पद यादी)
              </h3>
              <p className="text-xs text-slate-500">
                फोटोवर क्लिक करून संपूर्ण पासबुक पाहा किंवा &apos;नाव / पद सुधार&apos; वर क्लिक करून मॅन्युअल बदल करा
              </p>
            </div>
          </div>
          <span className="text-xs font-mono-num font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
            एकूण सभासद: {filteredMembers.length}
          </span>
        </div>

        {filteredMembers.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            कोणताही सभासद सापडला नाही.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredMembers.map((m) => {
              const avatarUrl = m.photo && m.photo.trim() !== '' ? m.photo : DEFAULT_AVATAR_URL;
              const societyPostLabel = m.societyPost?.trim() || 'सभासद';

              return (
                <div
                  key={m.docId}
                  className="rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-md transition overflow-hidden flex flex-col justify-between"
                >
                  <div
                    onClick={() => {
                      if (isAdmin) onViewMember(m);
                    }}
                    className={`p-4 text-center flex-1 flex flex-col items-center ${
                      isAdmin ? 'cursor-pointer' : ''
                    }`}
                  >
                    {/* Member Photo */}
                    <div className="w-24 h-24 rounded-2xl bg-slate-50 border-2 border-blue-600 p-1 shadow-xs overflow-hidden flex items-center justify-center">
                      <img
                        src={avatarUrl}
                        alt={m.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover rounded-xl"
                      />
                    </div>

                    {/* Full Name */}
                    <h4 className="mt-3 text-sm font-extrabold text-slate-900 leading-snug">
                      {m.name}
                    </h4>

                    {/* Society Post */}
                    <span className="mt-1.5 inline-block px-3 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                      {societyPostLabel}
                    </span>

                    {/* Office Designation & Member ID */}
                    <p className="mt-1.5 text-[11px] text-slate-600 font-medium">
                      {m.designation}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400 font-mono-num">
                      आयडी: {m.id}
                      {m.status === 'Inactive' ? ' · निष्क्रिय' : ''}
                    </p>
                  </div>

                  {isAdmin && (
                    <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-center no-print">
                      <button
                        type="button"
                        onClick={() => openMemberCardEditor(m)}
                        className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-blue-500 text-blue-700 hover:bg-blue-600 hover:text-white text-xs font-bold transition cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>नाव / पद / फोटो सुधार</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Datalist for quick manual post suggestions */}
      <datalist id="society-post-suggestions">
        {POST_SUGGESTIONS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      {/* MODAL 1: Add / Edit Committee Member (Manual Name, Manual Post, Photo) */}
      {committeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 my-8 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4 text-white flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editingCommittee
                  ? 'पदाधिकारी माहिती संपादित करा'
                  : 'नवीन पदाधिकारी जोडा (अध्यक्ष / सचिव / इ.)'}
              </h3>
              <button
                type="button"
                onClick={() => setCommitteeModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCommittee} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  सध्याच्या सभासदांमधून माहिती भरा (ऐच्छिक — किंवा खाली मॅन्युअल टाईप करा)
                </label>
                <select
                  value={selectedSourceMemberDocId}
                  onChange={(e) => handleSelectSourceMember(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm"
                >
                  <option value="">-- स्वतः मॅन्युअल माहिती भरायची आहे --</option>
                  {members.map((m) => (
                    <option key={m.docId} value={m.docId}>
                      {m.id} — {m.name} ({m.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  संस्थेतील पद (Manual लिहा) *
                </label>
                <input
                  type="text"
                  required
                  list="society-post-suggestions"
                  value={cmPost}
                  onChange={(e) => setCmPost(e.target.value)}
                  placeholder="उदा. अध्यक्ष, उपाध्यक्ष, सचिव, कोषाध्यक्ष, संचालक..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:bg-white focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  पूर्ण नाव (Manual लिहा) *
                </label>
                <input
                  type="text"
                  required
                  value={cmName}
                  onChange={(e) => setCmName(e.target.value)}
                  placeholder="उदा. श्री. राजेश सुधाकर देशमुख"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    शासकीय पद / विभाग (ऐच्छिक)
                  </label>
                  <input
                    type="text"
                    value={cmOfficeDesig}
                    onChange={(e) => setCmOfficeDesig(e.target.value)}
                    placeholder="उदा. उपअभियंता"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    क्रम (Order) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={1000}
                    value={cmOrder}
                    onChange={(e) => setCmOrder(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono-num font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  मोबाईल नंबर (ऐच्छिक)
                </label>
                <input
                  type="text"
                  value={cmMobile}
                  onChange={(e) => setCmMobile(e.target.value)}
                  placeholder="98XXXXXXXX"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm font-mono-num"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-white border border-slate-300 overflow-hidden flex items-center justify-center shrink-0">
                  <img
                    src={cmPhoto && cmPhoto.trim() !== '' ? cmPhoto : DEFAULT_AVATAR_URL}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 text-xs font-bold cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>फोटो निवडा / अपलोड करा</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCmPhotoUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-slate-500">
                    फोटो अपलोड केल्यास कार्डवर थेट दिसेल.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingCm}
                className="w-full rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 py-3 text-sm font-bold text-white shadow-sm transition cursor-pointer"
              >
                {savingCm ? 'जतन होत आहे...' : 'पदाधिकारी माहिती जतन करा'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Quick Manual Edit for Member Name, Society Post, and Photo */}
      {editingMemberCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-6 py-4 text-white flex items-center justify-between">
              <h3 className="text-base font-bold">सभासद नाव, संस्थेतील पद व फोटो सुधार</h3>
              <button
                type="button"
                onClick={() => setEditingMemberCard(null)}
                className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMemberCard} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  पूर्ण नाव (Manual लिहा) *
                </label>
                <input
                  type="text"
                  required
                  value={memCardName}
                  onChange={(e) => setMemCardName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  संस्थेतील पद (Manual लिहा) *
                </label>
                <input
                  type="text"
                  required
                  list="society-post-suggestions"
                  value={memCardPost}
                  onChange={(e) => setMemCardPost(e.target.value)}
                  placeholder="उदा. सभासद, संचालक, अध्यक्ष, सचिव..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-bold focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-white border border-slate-300 overflow-hidden flex items-center justify-center shrink-0">
                  <img
                    src={
                      memCardPhoto && memCardPhoto.trim() !== ''
                        ? memCardPhoto
                        : DEFAULT_AVATAR_URL
                    }
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-bold cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>फोटो बदला</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleMemCardPhotoUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingMemCard}
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 py-3 text-sm font-bold text-white shadow-sm transition cursor-pointer"
              >
                {savingMemCard ? 'जतन होत आहे...' : 'बदल जतन करा'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
