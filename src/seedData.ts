import { collection, doc, setDoc } from 'firebase/firestore';
import { db, SOCIETY_OWNER_ID, handleFirestoreError, OperationType } from './firebase';

export async function seedSampleSocietyData(): Promise<void> {
  const todayStr = new Date().toISOString().split('T')[0];

  const members = [
    {
      docId: 'mem_m001',
      id: 'M001',
      name: 'अभियंता राजेश सुधाकर देशमुख',
      designation: 'उपअभियंता (Deputy Engineer)',
      email: 'rajesh.deshmukh@zpgadchiroli.in',
      aadhaar: '4589-2314-7890',
      pan: 'ABCDE1234F',
      loginUser: 'M001',
      loginPass: '123456',
      dob: `1984-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
      joiningDate: '2018-06-15',
      mobile: '9823012345',
      status: 'Active',
      photo: '',
      officeAddress: 'बांधकाम विभाग, जिल्हा परिषद गडचिरोली',
      homeAddress: 'धानोरा रोड, कॉम्प्लेक्स जवळ, गडचिरोली',
      nominee: 'सौ. प्रणाली राजेश देशमुख',
      nomineeRelation: 'पत्नी',
      share: 25000,
      ownerId: SOCIETY_OWNER_ID,
    },
    {
      docId: 'mem_m002',
      id: 'M002',
      name: 'अभियंता सचिन वसंतराव गेडाम',
      designation: 'शाखा अभियंता (Section Engineer)',
      email: 'sachin.gedam@zpgadchiroli.in',
      aadhaar: '7812-6543-9012',
      pan: 'FGHIJ5678K',
      loginUser: 'M002',
      loginPass: '123456',
      dob: `1989-${String(new Date().getMonth() + 1).padStart(2, '0')}-24`,
      joiningDate: '2019-11-01',
      mobile: '9422154321',
      status: 'Active',
      photo: '',
      officeAddress: 'ग्रामीण पाणी पुरवठा विभाग, जि.प. गडचिरोली',
      homeAddress: 'चंद्रपूर रोड, इंदिरा नगर, गडचिरोली',
      nominee: 'सौ. स्वाती सचिन गेडाम',
      nomineeRelation: 'पत्नी',
      share: 20000,
      ownerId: SOCIETY_OWNER_ID,
    },
    {
      docId: 'mem_m003',
      id: 'M003',
      name: 'श्रीमती पल्लवी निलेश मेश्राम',
      designation: 'कनिष्ठ अभियंता (Junior Engineer)',
      email: 'pallavi.meshram@zpgadchiroli.in',
      aadhaar: '6321-8945-1122',
      pan: 'KLMNO9012P',
      loginUser: 'M003',
      loginPass: '123456',
      dob: '1992-03-14',
      joiningDate: '2021-01-10',
      mobile: '9765432109',
      status: 'Active',
      photo: '',
      officeAddress: 'लघु पाटबंधारे विभाग, पंचायत समिती चामोर्शी',
      homeAddress: 'गोकुळ नगर, गडचिरोली',
      nominee: 'श्री. निलेश मेश्राम',
      nomineeRelation: 'पती',
      share: 15000,
      ownerId: SOCIETY_OWNER_ID,
    },
  ];

  for (const m of members) {
    try {
      const { docId, ...data } = m;
      await setDoc(doc(collection(db, 'members'), docId), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'members');
    }
  }

  const contributions = [
    {
      docId: 'contrib_1',
      memberDocId: 'mem_m001',
      receiptNo: 'RCP-1001',
      date: todayStr,
      memberId: 'M001',
      memberName: 'अभियंता राजेश सुधाकर देशमुख',
      month: 'January 2026',
      amount: 2000,
      note: 'पगारातून कपात',
      ownerId: SOCIETY_OWNER_ID,
    },
    {
      docId: 'contrib_2',
      memberDocId: 'mem_m001',
      receiptNo: 'RCP-1008',
      date: todayStr,
      memberId: 'M001',
      memberName: 'अभियंता राजेश सुधाकर देशमुख',
      month: 'February 2026',
      amount: 2000,
      note: 'पगारातून कपात',
      ownerId: SOCIETY_OWNER_ID,
    },
    {
      docId: 'contrib_3',
      memberDocId: 'mem_m002',
      receiptNo: 'RCP-1002',
      date: todayStr,
      memberId: 'M002',
      memberName: 'अभियंता सचिन वसंतराव गेडाम',
      month: 'January 2026',
      amount: 2000,
      note: 'पगारातून कपात',
      ownerId: SOCIETY_OWNER_ID,
    },
    {
      docId: 'contrib_4',
      memberDocId: 'mem_m003',
      receiptNo: 'RCP-1003',
      date: todayStr,
      memberId: 'M003',
      memberName: 'श्रीमती पल्लवी निलेश मेश्राम',
      month: 'January 2026',
      amount: 2000,
      note: 'पगारातून कपात',
      ownerId: SOCIETY_OWNER_ID,
    },
  ];

  for (const c of contributions) {
    try {
      const { docId, ...data } = c;
      await setDoc(doc(collection(db, 'monthly_contributions'), docId), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'monthly_contributions');
    }
  }

  const loans = [
    {
      docId: 'loan_1',
      memberDocId: 'mem_m001',
      memberName: 'अभियंता राजेश सुधाकर देशमुख',
      loanDate: '2026-01-05',
      principal: 100000,
      interestRate: 8,
      months: 12,
      totalInterest: 8000,
      totalPayable: 108000,
      monthlyEmi: 9000,
      startMonth: 'January 2026',
      guarantor: 'अभियंता सचिन गेडाम (M002)',
      mortgage: 'पगार हमीपत्र व शेअर तारण',
      status: 'Active',
      ownerId: SOCIETY_OWNER_ID,
    },
  ];

  for (const l of loans) {
    try {
      const { docId, ...data } = l;
      await setDoc(doc(collection(db, 'loans'), docId), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'loans');
    }
  }

  const emis = [
    {
      docId: 'emi_1',
      loanDocId: 'loan_1',
      date: '2026-01-31',
      month: 'January 2026',
      mode: 'Salary Deduction',
      chequeNo: '',
      amount: 9000,
      photo: '',
      ownerId: SOCIETY_OWNER_ID,
    },
    {
      docId: 'emi_2',
      loanDocId: 'loan_1',
      date: '2026-02-28',
      month: 'February 2026',
      mode: 'Salary Deduction',
      chequeNo: '',
      amount: 9000,
      photo: '',
      ownerId: SOCIETY_OWNER_ID,
    },
  ];

  for (const e of emis) {
    try {
      const { docId, ...data } = e;
      await setDoc(doc(collection(db, 'loan_emis'), docId), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'loan_emis');
    }
  }

  const expenses = [
    {
      docId: 'exp_1',
      voucherNo: 'VOU-2001',
      date: todayStr,
      category: 'स्टेशनरी खर्च (Stationery)',
      description: 'श्री साई प्रिंटर्स गडचिरोली - सभासद पासबुक व पावती पुस्तके छपाई',
      amount: 1450,
      mode: 'UPI',
      photo: '',
      ownerId: SOCIETY_OWNER_ID,
    },
  ];

  for (const ex of expenses) {
    try {
      const { docId, ...data } = ex;
      await setDoc(doc(collection(db, 'expenses'), docId), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'expenses');
    }
  }
}
