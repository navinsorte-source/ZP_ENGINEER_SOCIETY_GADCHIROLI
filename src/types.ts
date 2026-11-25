export interface Member {
  docId: string;
  id: string;
  name: string;
  designation: string;
  email: string;
  aadhaar: string;
  pan: string;
  loginUser: string;
  loginPass: string;
  dob: string;
  joiningDate: string;
  mobile: string;
  status: 'Active' | 'Inactive';
  photo: string;
  officeAddress: string;
  homeAddress: string;
  nominee: string;
  nomineeRelation: string;
  share: number;
  societyPost?: string;
  ownerId: string;
}

export interface CommitteeMember {
  docId: string;
  name: string;
  societyPost: string;
  officeDesignation?: string;
  mobile?: string;
  photo?: string;
  displayOrder: number;
  memberDocId?: string;
  ownerId: string;
}

export interface MonthlyContribution {
  docId: string;
  memberDocId: string;
  receiptNo: string;
  date: string;
  memberId: string;
  memberName: string;
  month: string;
  amount: number;
  note?: string;
  ownerId: string;
}

export interface Loan {
  docId: string;
  memberDocId: string;
  memberName: string;
  loanDate: string;
  principal: number;
  interestRate: number;
  months: number;
  totalInterest: number;
  totalPayable: number;
  monthlyEmi: number;
  startMonth: string;
  emiDay?: number;
  guarantor: string;
  mortgage: string;
  status: 'Active' | 'Closed';
  closureDate?: string;
  closureAmount?: number;
  closureRemarks?: string;
  ownerId: string;
}

export interface LoanEmi {
  docId: string;
  loanDocId: string;
  date: string;
  month: string;
  mode: 'Cash' | 'Cheque' | 'Bank Transfer' | 'Salary Deduction';
  chequeNo?: string;
  amount: number;
  daysCount?: number;
  interestAmount?: number;
  principalAmount?: number;
  photo?: string;
  ownerId: string;
}

export interface Expense {
  docId: string;
  voucherNo: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  mode: 'Cash' | 'Bank Transfer' | 'Cheque' | 'UPI';
  photo?: string;
  ownerId: string;
}

export interface MemberPassbook {
  docId: string;
  memberDocId: string;
  memberId: string;
  loginPass: string;
  member: Omit<Member, 'loginPass' | 'aadhaar'>;
  contributions: MonthlyContribution[];
  loans: Loan[];
  emis: LoanEmi[];
  updatedAt: string;
  ownerId: string;
}

export interface DirectoryMemberItem {
  docId: string;
  id: string;
  name: string;
  designation: string;
  societyPost?: string;
  status: 'Active' | 'Inactive';
  photo?: string;
}

export interface DirectoryCommitteeItem {
  docId: string;
  name: string;
  societyPost: string;
  officeDesignation?: string;
  photo?: string;
  displayOrder: number;
  memberDocId?: string;
}

export interface DirectoryChunk {
  docId: string;
  chunkType: 'members' | 'committee';
  chunkIndex: number;
  items: (DirectoryMemberItem | DirectoryCommitteeItem)[];
  updatedAt: string;
  ownerId: string;
}
