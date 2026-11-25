import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db, SOCIETY_OWNER_ID, handleFirestoreError, OperationType } from './firebase';
import {
  CommitteeMember,
  DirectoryChunk,
  DirectoryCommitteeItem,
  DirectoryMemberItem,
  Loan,
  LoanEmi,
  Member,
  MemberPassbook,
  MonthlyContribution,
} from './types';
import { parseMonthYear } from './utils';

const MAX_CHUNK_ITEMS = 25;
const MAX_CHUNK_BYTES = 650000;

export function normalizePassbookId(memberId: string): string {
  return String(memberId || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 32);
}

function buildSafePassbookMember(member: Member): Omit<Member, 'loginPass' | 'aadhaar'> {
  return {
    docId: String(member.docId || ''),
    id: String(member.id || '').slice(0, 32),
    name: String(member.name || '').slice(0, 120),
    designation: String(member.designation || '').slice(0, 80),
    email: String(member.email || '-').slice(0, 120),
    pan: String(member.pan || '-').slice(0, 32),
    loginUser: String(member.loginUser || member.id || '').slice(0, 64),
    dob: String(member.dob || '').slice(0, 32),
    joiningDate: String(member.joiningDate || '').slice(0, 32),
    mobile: String(member.mobile || '-').slice(0, 24),
    status: member.status === 'Inactive' ? 'Inactive' : 'Active',
    photo: typeof member.photo === 'string' && member.photo.length <= 750000 ? member.photo : '',
    officeAddress: String(member.officeAddress || '-').slice(0, 250),
    homeAddress: String(member.homeAddress || '-').slice(0, 250),
    nominee: String(member.nominee || '-').slice(0, 120),
    nomineeRelation: String(member.nomineeRelation || '-').slice(0, 64),
    share: Math.max(0, Number(member.share) || 0),
    societyPost: String(member.societyPost || '').slice(0, 80),
    ownerId: SOCIETY_OWNER_ID,
  };
}

function sanitizeContribution(c: MonthlyContribution): MonthlyContribution {
  return {
    docId: String(c.docId || ''),
    memberDocId: String(c.memberDocId || ''),
    receiptNo: String(c.receiptNo || ''),
    date: String(c.date || ''),
    memberId: String(c.memberId || ''),
    memberName: String(c.memberName || ''),
    month: String(c.month || ''),
    amount: Math.max(0, Number(c.amount) || 0),
    note: String(c.note || ''),
    ownerId: SOCIETY_OWNER_ID,
  };
}

function sanitizeLoan(l: Loan): Loan {
  return {
    docId: String(l.docId || ''),
    memberDocId: String(l.memberDocId || ''),
    memberName: String(l.memberName || ''),
    loanDate: String(l.loanDate || ''),
    principal: Math.max(0, Number(l.principal) || 0),
    interestRate: Math.max(0, Number(l.interestRate) || 0),
    months: Math.max(1, Number(l.months) || 12),
    totalInterest: Math.max(0, Number(l.totalInterest) || 0),
    totalPayable: Math.max(0, Number(l.totalPayable) || 0),
    monthlyEmi: Math.max(0, Number(l.monthlyEmi) || 0),
    startMonth: String(l.startMonth || ''),
    emiDay: Math.min(31, Math.max(1, Number(l.emiDay) || 1)),
    guarantor: String(l.guarantor || '-'),
    mortgage: String(l.mortgage || '-'),
    status: l.status === 'Closed' ? 'Closed' : 'Active',
    closureDate: String(l.closureDate || ''),
    closureAmount: Number(l.closureAmount) || 0,
    closureRemarks: String(l.closureRemarks || ''),
    ownerId: SOCIETY_OWNER_ID,
  };
}

function sanitizeEmiForPassbook(e: LoanEmi): LoanEmi {
  return {
    docId: String(e.docId || ''),
    loanDocId: String(e.loanDocId || ''),
    date: String(e.date || ''),
    month: String(e.month || ''),
    mode: e.mode || 'Cash',
    chequeNo: String(e.chequeNo || ''),
    amount: Math.max(0, Number(e.amount) || 0),
    daysCount: Number(e.daysCount) || 0,
    interestAmount: Number(e.interestAmount) || 0,
    principalAmount: Number(e.principalAmount) || 0,
    // Omit receipt photo inside passbook snapshot to keep single doc fast & well under 1 MB
    photo: '',
    ownerId: SOCIETY_OWNER_ID,
  };
}

export async function syncSingleMemberPassbook(
  member: Member,
  allContributions: MonthlyContribution[],
  allLoans: Loan[],
  allEmis: LoanEmi[]
): Promise<void> {
  const passbookId = normalizePassbookId(member.id);
  if (!passbookId || !member.docId) return;

  const memberContribs = allContributions
    .filter((c) => c.memberDocId === member.docId)
    .sort((a, b) => parseMonthYear(b.month).getTime() - parseMonthYear(a.month).getTime())
    .slice(0, 500)
    .map(sanitizeContribution);

  const memberLoans = allLoans
    .filter((l) => l.memberDocId === member.docId)
    .slice(0, 100)
    .map(sanitizeLoan);

  const loanIds = new Set(memberLoans.map((l) => l.docId));
  const memberEmis = allEmis
    .filter((e) => loanIds.has(e.loanDocId))
    .slice(0, 1000)
    .map(sanitizeEmiForPassbook);

  const payload: Omit<MemberPassbook, 'docId'> = {
    memberDocId: member.docId.slice(0, 128),
    memberId: member.id.slice(0, 32),
    loginPass: (member.loginPass || '123456').slice(0, 64),
    member: buildSafePassbookMember(member),
    contributions: memberContribs,
    loans: memberLoans,
    emis: memberEmis,
    updatedAt: new Date().toISOString().slice(0, 48),
    ownerId: SOCIETY_OWNER_ID,
  };

  try {
    await setDoc(doc(db, 'member_passbooks', passbookId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `member_passbooks/${passbookId}`);
  }
}

export async function deleteMemberPassbook(memberId: string): Promise<void> {
  const passbookId = normalizePassbookId(memberId);
  if (!passbookId) return;
  try {
    await deleteDoc(doc(db, 'member_passbooks', passbookId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `member_passbooks/${passbookId}`);
  }
}

function packIntoByteSafeChunks<T>(items: T[]): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  let current: T[] = [];
  let currentBytes = 0;

  for (const item of items) {
    const itemBytes = JSON.stringify(item).length;
    if (
      current.length > 0 &&
      (current.length >= MAX_CHUNK_ITEMS || currentBytes + itemBytes > MAX_CHUNK_BYTES)
    ) {
      chunks.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(item);
    currentBytes += itemBytes;
  }

  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

export async function syncDirectoryChunks(
  members: Member[],
  committeeMembers: CommitteeMember[]
): Promise<number> {
  const safeMembers: DirectoryMemberItem[] = [...members]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((m) => ({
      docId: String(m.docId || ''),
      id: String(m.id || ''),
      name: String(m.name || ''),
      designation: String(m.designation || ''),
      societyPost: String(m.societyPost || ''),
      status: m.status === 'Inactive' ? 'Inactive' : 'Active',
      photo: typeof m.photo === 'string' && m.photo.length <= 750000 ? m.photo : '',
    }));

  const safeCommittee: DirectoryCommitteeItem[] = [...committeeMembers]
    .sort((a, b) => (Number(a.displayOrder) || 999) - (Number(b.displayOrder) || 999))
    .map((cm) => ({
      docId: String(cm.docId || ''),
      name: String(cm.name || ''),
      societyPost: String(cm.societyPost || ''),
      officeDesignation: String(cm.officeDesignation || ''),
      photo: typeof cm.photo === 'string' && cm.photo.length <= 750000 ? cm.photo : '',
      displayOrder: Math.min(1000, Math.max(1, Number(cm.displayOrder) || 1)),
      memberDocId: String(cm.memberDocId || ''),
    }));

  const memChunks = packIntoByteSafeChunks(safeMembers);
  const cmChunks = packIntoByteSafeChunks(safeCommittee);
  const nowIso = new Date().toISOString().slice(0, 48);

  const activeDocIds = new Set<string>();
  let written = 0;

  try {
    for (let i = 0; i < memChunks.length; i++) {
      const docId = `mem_chunk_${i}`;
      activeDocIds.add(docId);
      const chunkPayload: Omit<DirectoryChunk, 'docId'> = {
        chunkType: 'members',
        chunkIndex: i,
        items: memChunks[i],
        updatedAt: nowIso,
        ownerId: SOCIETY_OWNER_ID,
      };
      await setDoc(doc(db, 'directory_chunks', docId), chunkPayload);
      written++;
    }

    for (let i = 0; i < cmChunks.length; i++) {
      const docId = `committee_chunk_${i}`;
      activeDocIds.add(docId);
      const chunkPayload: Omit<DirectoryChunk, 'docId'> = {
        chunkType: 'committee',
        chunkIndex: i,
        items: cmChunks[i],
        updatedAt: nowIso,
        ownerId: SOCIETY_OWNER_ID,
      };
      await setDoc(doc(db, 'directory_chunks', docId), chunkPayload);
      written++;
    }

    // Remove any stale higher-index chunks from previous larger lists
    const existingSnap = await getDocs(
      query(collection(db, 'directory_chunks'), where('ownerId', '==', SOCIETY_OWNER_ID))
    );
    for (const d of existingSnap.docs) {
      if (!activeDocIds.has(d.id)) {
        await deleteDoc(doc(db, 'directory_chunks', d.id));
      }
    }

    return written;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'directory_chunks');
  }
}

export async function syncAllSnapshots(
  members: Member[],
  contributions: MonthlyContribution[],
  loans: Loan[],
  emis: LoanEmi[],
  committeeMembers: CommitteeMember[]
): Promise<{ passbooks: number; chunks: number }> {
  let passbooks = 0;
  for (const m of members) {
    if (normalizePassbookId(m.id)) {
      await syncSingleMemberPassbook(m, contributions, loans, emis);
      passbooks++;
    }
  }
  const chunks = await syncDirectoryChunks(members, committeeMembers);
  return { passbooks, chunks };
}

export async function loadDirectoryChunks(): Promise<{
  directoryMembers: Member[];
  directoryCommittee: CommitteeMember[];
}> {
  try {
    const snap = await getDocs(
      query(collection(db, 'directory_chunks'), where('ownerId', '==', SOCIETY_OWNER_ID))
    );

    const memberChunks: DirectoryChunk[] = [];
    const committeeChunks: DirectoryChunk[] = [];

    snap.forEach((d) => {
      const data = d.data() as Omit<DirectoryChunk, 'docId'>;
      const chunk: DirectoryChunk = { docId: d.id, ...data };
      if (chunk.chunkType === 'members') {
        memberChunks.push(chunk);
      } else if (chunk.chunkType === 'committee') {
        committeeChunks.push(chunk);
      }
    });

    memberChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
    committeeChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

    const directoryMembers: Member[] = [];
    for (const ch of memberChunks) {
      for (const raw of ch.items as DirectoryMemberItem[]) {
        directoryMembers.push({
          docId: raw.docId,
          id: raw.id,
          name: raw.name,
          designation: raw.designation,
          societyPost: raw.societyPost,
          status: raw.status === 'Inactive' ? 'Inactive' : 'Active',
          photo: raw.photo || '',
          email: '-',
          aadhaar: '-',
          pan: '-',
          loginUser: raw.id,
          loginPass: '',
          dob: '',
          joiningDate: '',
          mobile: '-',
          officeAddress: '-',
          homeAddress: '-',
          nominee: '-',
          nomineeRelation: '-',
          share: 0,
          ownerId: SOCIETY_OWNER_ID,
        });
      }
    }

    const directoryCommittee: CommitteeMember[] = [];
    for (const ch of committeeChunks) {
      for (const raw of ch.items as DirectoryCommitteeItem[]) {
        directoryCommittee.push({
          docId: raw.docId,
          name: raw.name,
          societyPost: raw.societyPost,
          officeDesignation: raw.officeDesignation,
          photo: raw.photo || '',
          displayOrder: raw.displayOrder,
          memberDocId: raw.memberDocId,
          ownerId: SOCIETY_OWNER_ID,
        });
      }
    }

    return { directoryMembers, directoryCommittee };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'directory_chunks');
  }
}
