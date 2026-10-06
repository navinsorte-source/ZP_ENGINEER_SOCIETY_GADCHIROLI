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
