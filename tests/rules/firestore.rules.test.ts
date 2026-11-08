import fs from 'node:fs';
import path from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { computeInvitationCodeHash } from '@/lib/crypto';

let testEnv: RulesTestEnvironment;

const OWNER_UID = 'user_owner_a';
const INSTRUCTOR_UID = 'user_instructor_i';
const STUDENT_B_UID = 'user_student_b';
const STUDENT_C_UID = 'user_student_c';
const OUTSIDER_UID = 'user_outsider_x';

const CLASS_1_ID = 'class_math_grade3';

beforeAll(async () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');

  testEnv = await initializeTestEnvironment({
    projectId: 'demo-studynest',
    firestore: {
      rules,
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

async function seedClassWithMembers() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const now = Timestamp.now();

    await setDoc(doc(db, 'classes', CLASS_1_ID), {
      id: CLASS_1_ID,
      name: 'Toán & Tiếng Việt Lớp 3',
      description: 'Học 60 phút mỗi tối',
      color: 'emerald',
      icon: 'book-open',
      timezone: 'Asia/Ho_Chi_Minh',
      studyDaysOfWeek: [1, 2, 3, 4, 5],
      ownerId: OWNER_UID,
      createdBy: OWNER_UID,
      createdAt: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'classes', CLASS_1_ID, 'members', OWNER_UID), {
      uid: OWNER_UID,
      classId: CLASS_1_ID,
      role: 'owner',
      status: 'active',
      displayName: 'Anh Hai (Owner)',
      avatarUrl: '',
      joinedAt: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'classes', CLASS_1_ID, 'members', INSTRUCTOR_UID), {
      uid: INSTRUCTOR_UID,
      classId: CLASS_1_ID,
      role: 'instructor',
      status: 'active',
      displayName: 'Cô Giáo Minh',
      avatarUrl: '',
      joinedAt: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'classes', CLASS_1_ID, 'members', STUDENT_B_UID), {
      uid: STUDENT_B_UID,
      classId: CLASS_1_ID,
      role: 'student',
      status: 'active',
      displayName: 'Bé An (Lớp 3)',
      avatarUrl: '',
      joinedAt: now,
      updatedAt: now,
    });
  });
}

describe('Firestore Security Rules – StudyNest', () => {
  it('1. Cho phép tạo lớp và membership owner đầu tiên atomically bằng writeBatch; từ chối nếu thiếu membership hoặc giả mạo owner', async () => {
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    const now = Timestamp.now();

    // Thất bại nếu chỉ tạo document lớp mà không tạo membership owner đi kèm
    await assertFails(
      setDoc(doc(ownerDb, 'classes', 'class_no_member'), {
        id: 'class_no_member',
        name: 'Lớp thiếu member',
        description: 'Mô tả',
        color: 'emerald',
        icon: 'book-open',
        timezone: 'Asia/Ho_Chi_Minh',
        studyDaysOfWeek: [1, 2, 3, 4, 5],
        ownerId: OWNER_UID,
        createdBy: OWNER_UID,
        createdAt: now,
        updatedAt: now,
      })
    );

    // Thành công khi tạo cả lớp và membership owner trong cùng một batch
    const batch = writeBatch(ownerDb);
    batch.set(doc(ownerDb, 'classes', CLASS_1_ID), {
      id: CLASS_1_ID,
      name: 'Toán Lớp 3',
      description: 'Kèm học tại nhà',
      color: 'emerald',
      icon: 'book-open',
      timezone: 'Asia/Ho_Chi_Minh',
      studyDaysOfWeek: [1, 2, 3, 4, 5],
      ownerId: OWNER_UID,
      createdBy: OWNER_UID,
      createdAt: now,
      updatedAt: now,
    });
    batch.set(doc(ownerDb, 'classes', CLASS_1_ID, 'members', OWNER_UID), {
      uid: OWNER_UID,
      classId: CLASS_1_ID,
      role: 'owner',
      status: 'active',
      displayName: 'Anh Hai',
      avatarUrl: '',
      joinedAt: now,
      updatedAt: now,
    });
    await assertSucceeds(batch.commit());
  });

  it('2. Chặn người ngoài lớp đọc dữ liệu lớp và chặn học sinh/instructor tự nâng quyền lên owner', async () => {
    await seedClassWithMembers();

    const outsiderDb = testEnv.authenticatedContext(OUTSIDER_UID).firestore();
    const studentDb = testEnv.authenticatedContext(STUDENT_B_UID).firestore();
    const instructorDb = testEnv.authenticatedContext(INSTRUCTOR_UID).firestore();

    // Người ngoài không đọc được lớp
    await assertFails(getDoc(doc(outsiderDb, 'classes', CLASS_1_ID)));

    // Học sinh đọc được lớp mình tham gia
    await assertSucceeds(getDoc(doc(studentDb, 'classes', CLASS_1_ID)));

    // Học sinh không thể tự nâng quyền mình lên instructor hoặc owner
    await assertFails(
      updateDoc(doc(studentDb, 'classes', CLASS_1_ID, 'members', STUDENT_B_UID), {
        role: 'instructor',
      })
    );

    // Instructor không thể tự nâng quyền mình lên owner hoặc chiếm quyền owner
    await assertFails(
      updateDoc(doc(instructorDb, 'classes', CLASS_1_ID, 'members', INSTRUCTOR_UID), {
        role: 'owner',
      })
    );
  });

  it('3. Luồng lời mời & yêu cầu tham gia: chặn lưu PIN plaintext, kiểm tra SHA-256 codeHash, chặn tự duyệt (self-approval)', async () => {
    await seedClassWithMembers();

    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    const candidateDb = testEnv.authenticatedContext(STUDENT_C_UID).firestore();

    const invId = 'inv_token_abcdef123456';
    const joinCode = '8K4M2P';
    const codeHash = await computeInvitationCodeHash(invId, joinCode);
    const now = Timestamp.now();
    const future = Timestamp.fromMillis(Date.now() + 7 * 24 * 3600 * 1000);

    // Chặn owner lưu plaintext joinCode vào document invitations
    await assertFails(
      setDoc(doc(ownerDb, 'classes', CLASS_1_ID, 'invitations', invId), {
        id: invId,
        classId: CLASS_1_ID,
        className: 'Toán & Tiếng Việt Lớp 3',
        ownerName: 'Anh Hai',
        codeHash,
        joinCode, // Bị cấm!
        status: 'active',
        expiresAt: future,
        createdBy: OWNER_UID,
        createdAt: now,
      })
    );

    // Cho phép tạo lời mời chỉ chứa codeHash và lưu joinCode vào invitationSecrets (chỉ owner đọc được)
    await assertSucceeds(
      setDoc(doc(ownerDb, 'classes', CLASS_1_ID, 'invitations', invId), {
        id: invId,
        classId: CLASS_1_ID,
        className: 'Toán & Tiếng Việt Lớp 3',
        ownerName: 'Anh Hai',
        codeHash,
        status: 'active',
        expiresAt: future,
        createdBy: OWNER_UID,
        createdAt: now,
      })
    );
    await assertSucceeds(
      setDoc(doc(ownerDb, 'classes', CLASS_1_ID, 'invitationSecrets', invId), {
        invitationId: invId,
        classId: CLASS_1_ID,
        joinCode,
        createdAt: now,
      })
    );

    // Người dùng ngoài không thể đọc invitationSecrets hoặc list toàn bộ invitations
    await assertFails(
      getDoc(doc(candidateDb, 'classes', CLASS_1_ID, 'invitationSecrets', invId))
    );
    await assertFails(
      getDocs(collection(candidateDb, 'classes', CLASS_1_ID, 'invitations'))
    );

    // Người dùng có token có thể getDoc lời mời cụ thể
    await assertSucceeds(
      getDoc(doc(candidateDb, 'classes', CLASS_1_ID, 'invitations', invId))
    );

    // Thất bại nếu nhập sai mã tham gia
    await assertFails(
      setDoc(doc(candidateDb, 'classes', CLASS_1_ID, 'joinRequests', STUDENT_C_UID), {
        uid: STUDENT_C_UID,
        classId: CLASS_1_ID,
        invitationId: invId,
        submittedCode: 'WRONG1',
        displayName: 'Bé Bình',
        avatarUrl: '',
        message: 'Em xin vào lớp ạ',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      })
    );

    // Thất bại nếu cố tình gửi yêu cầu với trạng thái approved (self-approval)
    await assertFails(
      setDoc(doc(candidateDb, 'classes', CLASS_1_ID, 'joinRequests', STUDENT_C_UID), {
        uid: STUDENT_C_UID,
        classId: CLASS_1_ID,
        invitationId: invId,
        submittedCode: joinCode,
        displayName: 'Bé Bình',
        avatarUrl: '',
        message: 'Em xin vào lớp ạ',
        status: 'approved',
        createdAt: now,
        updatedAt: now,
      })
    );

    // Thành công khi gửi yêu cầu đúng mã tham gia và trạng thái pending
    await assertSucceeds(
      setDoc(doc(candidateDb, 'classes', CLASS_1_ID, 'joinRequests', STUDENT_C_UID), {
        uid: STUDENT_C_UID,
        classId: CLASS_1_ID,
        invitationId: invId,
        submittedCode: joinCode,
        displayName: 'Bé Bình',
        avatarUrl: '',
        message: 'Em xin vào lớp ạ',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      })
    );

    // Ứng viên không thể tự thêm mình vào members hoặc tự sửa joinRequest thành approved
    await assertFails(
      setDoc(doc(candidateDb, 'classes', CLASS_1_ID, 'members', STUDENT_C_UID), {
        uid: STUDENT_C_UID,
        classId: CLASS_1_ID,
        role: 'student',
        status: 'active',
        displayName: 'Bé Bình',
        avatarUrl: '',
        joinedAt: now,
        updatedAt: now,
      })
    );

    // Owner duyệt yêu cầu atomically (cập nhật joinRequest -> approved + tạo member student)
    const approveBatch = writeBatch(ownerDb);
    approveBatch.update(
      doc(ownerDb, 'classes', CLASS_1_ID, 'joinRequests', STUDENT_C_UID),
      {
        status: 'approved',
        updatedAt: now,
      }
    );
    approveBatch.set(
      doc(ownerDb, 'classes', CLASS_1_ID, 'members', STUDENT_C_UID),
      {
        uid: STUDENT_C_UID,
        classId: CLASS_1_ID,
        role: 'student',
        status: 'active',
        displayName: 'Bé Bình',
        avatarUrl: '',
        joinedAt: now,
        updatedAt: now,
      }
    );
    await assertSucceeds(approveBatch.commit());
  });

  it('4. Bài học & Ghi chú giáo viên: học sinh chỉ đọc được bài published, không bao giờ đọc được draft hoặc lessonNotes', async () => {
    await seedClassWithMembers();

    const instructorDb = testEnv.authenticatedContext(INSTRUCTOR_UID).firestore();
    const studentDb = testEnv.authenticatedContext(STUDENT_B_UID).firestore();
    const now = Timestamp.now();

    // Instructor tạo 1 bài draft, 1 bài published và ghi chú riêng cho bài published
    await assertSucceeds(
      setDoc(doc(instructorDb, 'classes', CLASS_1_ID, 'lessons', 'lesson_draft'), {
        id: 'lesson_draft',
        classId: CLASS_1_ID,
        subject: 'Toán',
        title: 'Bài nháp phép chia',
        goal: 'Chưa công bố',
        keywords: [],
        explanation: 'Nội dung nháp',
        resourceUrl: '',
        status: 'draft',
        createdBy: INSTRUCTOR_UID,
        createdAt: now,
        updatedAt: now,
      })
    );

    await assertSucceeds(
      setDoc(doc(instructorDb, 'classes', CLASS_1_ID, 'lessons', 'lesson_pub'), {
        id: 'lesson_pub',
        classId: CLASS_1_ID,
        subject: 'Tiếng Việt',
        title: 'Từ chỉ đặc điểm',
        goal: 'Nhận biết từ chỉ đặc điểm trong câu',
        keywords: [
          {
            term: 'Từ chỉ đặc điểm',
            meaning: 'Từ miêu tả màu sắc, hình dáng, tính chất',
            example: 'Bầu trời xanh ngắt',
          },
        ],
        explanation: 'Giải thích chi tiết cho học sinh lớp 3',
        resourceUrl: 'https://example.com/tai-lieu.pdf',
        status: 'published',
        createdBy: INSTRUCTOR_UID,
        createdAt: now,
        updatedAt: now,
      })
    );

    await assertSucceeds(
      setDoc(doc(instructorDb, 'classes', CLASS_1_ID, 'lessonNotes', 'lesson_pub'), {
        lessonId: 'lesson_pub',
        classId: CLASS_1_ID,
        content: 'Ghi chú mật cho giáo viên: Bé An hay nhầm từ chỉ hoạt động với đặc điểm.',
        updatedBy: INSTRUCTOR_UID,
        updatedAt: now,
      })
    );

    // Học sinh đọc được bài published
    await assertSucceeds(
      getDoc(doc(studentDb, 'classes', CLASS_1_ID, 'lessons', 'lesson_pub'))
    );

    // Học sinh KHÔNG đọc được bài draft
    await assertFails(
      getDoc(doc(studentDb, 'classes', CLASS_1_ID, 'lessons', 'lesson_draft'))
    );

    // Học sinh KHÔNG đọc được lessonNotes kể cả của bài đã published
    await assertFails(
      getDoc(doc(studentDb, 'classes', CLASS_1_ID, 'lessonNotes', 'lesson_pub'))
    );

    // Học sinh KHÔNG sửa được bài học
    await assertFails(
      updateDoc(doc(studentDb, 'classes', CLASS_1_ID, 'lessons', 'lesson_pub'), {
        title: 'Học sinh tự sửa',
      })
    );
  });

  it('5. Nhiệm vụ & Nhật ký học tập: học sinh chỉ thấy bài giao cho mình, không thể tự chấm sao hay tự xác nhận', async () => {
    await seedClassWithMembers();

    const instructorDb = testEnv.authenticatedContext(INSTRUCTOR_UID).firestore();
    const studentBDb = testEnv.authenticatedContext(STUDENT_B_UID).firestore();
    const now = Timestamp.now();

    // Giao bài 1 cho STUDENT_B_UID, giao bài 2 riêng cho học sinh khác (STUDENT_C_UID)
    await assertSucceeds(
      setDoc(doc(instructorDb, 'classes', CLASS_1_ID, 'assignments', 'task_for_b'), {
        id: 'task_for_b',
        classId: CLASS_1_ID,
        sessionId: null,
        lessonId: null,
        title: 'Làm 5 phép nhân có nhớ',
        description: 'Vở bài tập Toán trang 18',
        dueDate: '2026-11-08',
        assignedStudentUids: [STUDENT_B_UID],
        starsReward: 3,
        createdBy: INSTRUCTOR_UID,
        createdAt: now,
        updatedAt: now,
      })
    );

    await assertSucceeds(
      setDoc(doc(instructorDb, 'classes', CLASS_1_ID, 'assignments', 'task_for_c_only'), {
        id: 'task_for_c_only',
        classId: CLASS_1_ID,
        sessionId: null,
        lessonId: null,
        title: 'Bài riêng cho bạn C',
        description: 'Ôn tập riêng',
        dueDate: '2026-11-08',
        assignedStudentUids: [STUDENT_C_UID],
        starsReward: 2,
        createdBy: INSTRUCTOR_UID,
        createdAt: now,
        updatedAt: now,
      })
    );

    // Học sinh B đọc được bài của mình nhưng bị từ chối đọc bài riêng của bạn C
    await assertSucceeds(
      getDoc(doc(studentBDb, 'classes', CLASS_1_ID, 'assignments', 'task_for_b'))
    );
    await assertFails(
      getDoc(doc(studentBDb, 'classes', CLASS_1_ID, 'assignments', 'task_for_c_only'))
    );

    const recordId = `task_for_b_${STUDENT_B_UID}`;

    // Kiểm tra xem học sinh có thể getDoc record trước khi tạo không
    await assertSucceeds(
      getDoc(doc(studentBDb, 'classes', CLASS_1_ID, 'learningRecords', recordId))
    );

    // Học sinh B cố tình tự chấm 5 sao hoặc tự đặt instructorStatus = 'confirmed' -> BỊ TỪ CHỐI
    await assertFails(
      setDoc(doc(studentBDb, 'classes', CLASS_1_ID, 'learningRecords', recordId), {
        id: recordId,
        classId: CLASS_1_ID,
        studentUid: STUDENT_B_UID,
        studentName: 'Bé An',
        type: 'assignment',
        assignmentId: 'task_for_b',
        sessionId: null,
        title: 'Làm 5 phép nhân có nhớ',
        date: '2026-11-07',
        studentStatus: 'submitted',
        studentNote: 'Em làm xong rồi ạ',
        submittedAt: now,
        instructorStatus: 'confirmed', // Gian lận!
        instructorComment: '',
        starsAwarded: 5, // Gian lận!
        confirmedBy: STUDENT_B_UID,
        confirmedAt: now,
        createdAt: now,
        updatedAt: now,
      })
    );

    // Học sinh B gửi báo cáo hoàn thành hợp lệ (unverified, 0 sao) -> THÀNH CÔNG
    await assertSucceeds(
      setDoc(doc(studentBDb, 'classes', CLASS_1_ID, 'learningRecords', recordId), {
        id: recordId,
        classId: CLASS_1_ID,
        studentUid: STUDENT_B_UID,
        studentName: 'Bé An',
        type: 'assignment',
        assignmentId: 'task_for_b',
        sessionId: null,
        title: 'Làm 5 phép nhân có nhớ',
        date: '2026-11-07',
        studentStatus: 'submitted',
        studentNote: 'Em đã làm xong vào vở ô ly ạ!',
        submittedAt: now,
        instructorStatus: 'unverified',
        instructorComment: '',
        starsAwarded: 0,
        confirmedBy: null,
        confirmedAt: null,
        createdAt: now,
        updatedAt: now,
      })
    );

    // Học sinh B cập nhật lại ghi chú bài nộp khi chưa được giáo viên duyệt -> THÀNH CÔNG
    await assertSucceeds(
      updateDoc(doc(studentBDb, 'classes', CLASS_1_ID, 'learningRecords', recordId), {
        studentStatus: 'submitted',
        studentNote: 'Em vừa kiểm tra lại kết quả và cập nhật ghi chú ạ!',
        updatedAt: now,
      })
    );

    // Học sinh B cố tình update để tự cộng sao sau khi tạo -> BỊ TỪ CHỐI
    await assertFails(
      updateDoc(doc(studentBDb, 'classes', CLASS_1_ID, 'learningRecords', recordId), {
        instructorStatus: 'confirmed',
        starsAwarded: 3,
      })
    );

    // Instructor xác nhận và thưởng 3 sao -> THÀNH CÔNG
    await assertSucceeds(
      updateDoc(doc(instructorDb, 'classes', CLASS_1_ID, 'learningRecords', recordId), {
        instructorStatus: 'confirmed',
        starsAwarded: 3,
        instructorComment: 'Chữ viết sạch đẹp, tính đúng cả 5 câu!',
        confirmedBy: INSTRUCTOR_UID,
        confirmedAt: now,
        updatedAt: now,
      })
    );

    // Sau khi đã được instructor xác nhận, học sinh không thể sửa đè record nữa -> BỊ TỪ CHỐI
    await assertFails(
      updateDoc(doc(studentBDb, 'classes', CLASS_1_ID, 'learningRecords', recordId), {
        studentNote: 'Sửa lại sau khi đã chốt',
      })
    );
  });

  it('6. Collection Group Query members: người dùng chỉ truy vấn được các membership của chính mình', async () => {
    await seedClassWithMembers();

    const studentBDb = testEnv.authenticatedContext(STUDENT_B_UID).firestore();
    const q = query(
      collection(studentBDb, 'classes', CLASS_1_ID, 'members'),
      where('uid', '==', STUDENT_B_UID)
    );
    await assertSucceeds(getDocs(q));
  });
});

