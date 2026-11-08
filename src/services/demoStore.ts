import { Timestamp } from 'firebase/firestore';
import type {
  Assignment,
  ClassInvitation,
  ClassMember,
  InvitationSecret,
  JoinRequest,
  LearningRecord,
  Lesson,
  LessonNote,
  ScheduleException,
  ScheduleItem,
  StudyClass,
  StudySession,
  UserProfile,
} from '@/types/domain';
import { addDaysToDateString, formatDateInTimezone } from '@/lib/date';
import { DEFAULT_SESSION_CHECKLIST } from '@/lib/validation';

const STORAGE_KEY = 'studynest_demo_store_v1';
const ACTIVE_USER_KEY = 'studynest_demo_active_uid_v1';

export interface DemoPersona {
  uid: string;
  displayName: string;
  photoURL: string;
  roleHint: string;
}

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    uid: 'demo_user_anh_hai',
    displayName: 'Anh Hai Minh (Hướng dẫn)',
    photoURL: '',
    roleHint: 'Chủ lớp Toán & Tiếng Việt Lớp 3, Học sinh lớp Tiếng Anh Giao Tiếp',
  },
  {
    uid: 'demo_user_be_an',
    displayName: 'Bé An (Lớp 3A)',
    photoURL: '',
    roleHint: 'Học sinh lớp Toán & Tiếng Việt Lớp 3',
  },
  {
    uid: 'demo_user_be_binh',
    displayName: 'Bé Bình (Học sinh mới)',
    photoURL: '',
    roleHint: 'Tài khoản thử nghiệm luồng nhập mã mời /join/:token',
  },
];

interface RawDemoState {
  users: Record<string, UserProfile>;
  classes: Record<string, StudyClass>;
  members: Record<string, Record<string, ClassMember>>;
  invitations: Record<string, Record<string, ClassInvitation>>;
  invitationSecrets: Record<string, Record<string, InvitationSecret>>;
  joinRequests: Record<string, Record<string, JoinRequest>>;
  schedules: Record<string, Record<string, ScheduleItem>>;
  scheduleExceptions: Record<string, Record<string, ScheduleException>>;
  lessons: Record<string, Record<string, Lesson>>;
  lessonNotes: Record<string, Record<string, LessonNote>>;
  sessions: Record<string, Record<string, StudySession>>;
  assignments: Record<string, Record<string, Assignment>>;
  learningRecords: Record<string, Record<string, LearningRecord>>;
}

function reviveTimestamps<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (
    'seconds' in (obj as Record<string, unknown>) &&
    'nanoseconds' in (obj as Record<string, unknown>) &&
    Object.keys(obj as Record<string, unknown>).length === 2
  ) {
    const raw = obj as unknown as { seconds: number; nanoseconds: number };
    return new Timestamp(raw.seconds, raw.nanoseconds) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => reviveTimestamps(item)) as unknown as T;
  }
  const copy: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    copy[k] = reviveTimestamps(v);
  }
  return copy as T;
}

function createInitialSeed(): RawDemoState {
  const now = Timestamp.now();
  const today = formatDateInTimezone(new Date(), 'Asia/Ho_Chi_Minh');
  const yesterday = addDaysToDateString(today, -1);
  const twoDaysAgo = addDaysToDateString(today, -2);
  const tomorrow = addDaysToDateString(today, 1);

  const class1Id = 'cls_toan_tv_lop3';
  const class2Id = 'cls_clb_doc_sach';

  const anhHaiUid = 'demo_user_anh_hai';
  const beAnUid = 'demo_user_be_an';
  const coLanUid = 'demo_user_co_lan';

  const lesson1Id = 'les_phep_nhan_3_chu_so';
  const lesson2Id = 'les_tu_chi_dac_diem';
  const lesson3Id = 'les_nhap_chia_het';

  const sessionTodayId = 'ses_buoi_hoc_hom_nay';
  const sessionTomorrowId = 'ses_buoi_hoc_ngay_mai';

  const task1Id = 'tsk_toan_trang_42';
  const task2Id = 'tsk_tv_5_cau_ke';

  const defaultInviteId = 'inv_lop3_demo_token_2026';
  // SHA-256 of "inv_lop3_demo_token_2026:3A2026"
  const defaultCodeHash =
    'f21d2b716df92f66fc3ad52703dbe97e12ed084efb58f1995e06c255e35eb268';

  return {
    users: {
      [anhHaiUid]: {
        uid: anhHaiUid,
        displayName: 'Anh Hai Minh (Hướng dẫn)',
        photoURL: '',
        createdAt: now,
        updatedAt: now,
      },
      [beAnUid]: {
        uid: beAnUid,
        displayName: 'Bé An (Lớp 3A)',
        photoURL: '',
        createdAt: now,
        updatedAt: now,
      },
      demo_user_be_binh: {
        uid: 'demo_user_be_binh',
        displayName: 'Bé Bình (Học sinh mới)',
        photoURL: '',
        createdAt: now,
        updatedAt: now,
      },
    },
    classes: {
      [class1Id]: {
        id: class1Id,
        name: 'Góc học tập Lớp 3 – Bé An & Anh Hai',
        description:
          'Đồng hành 60 phút mỗi tối (19:30 – 20:30): Ôn Toán, Tiếng Việt, rèn chữ và chuẩn bị sách vở ngày mai.',
        color: 'emerald',
        icon: 'book-open',
        timezone: 'Asia/Ho_Chi_Minh',
        studyDaysOfWeek: [1, 2, 3, 4, 5],
        ownerId: anhHaiUid,
        createdBy: anhHaiUid,
        createdAt: now,
        updatedAt: now,
      },
      [class2Id]: {
        id: class2Id,
        name: 'CLB Đọc sách & Kể chuyện cuối tuần',
        description:
          'Lớp đọc sách thiếu nhi và tóm tắt câu chuyện sáng Thứ Bảy (Anh Hai tham gia với vai trò học viên).',
        color: 'sky',
        icon: 'sparkles',
        timezone: 'Asia/Ho_Chi_Minh',
        studyDaysOfWeek: [6],
        ownerId: coLanUid,
        createdBy: coLanUid,
        createdAt: now,
        updatedAt: now,
      },
    },
    members: {
      [class1Id]: {
        [anhHaiUid]: {
          uid: anhHaiUid,
          classId: class1Id,
          role: 'owner',
          status: 'active',
          displayName: 'Anh Hai Minh (Hướng dẫn)',
          avatarUrl: '',
          joinedAt: now,
          updatedAt: now,
        },
        [beAnUid]: {
          uid: beAnUid,
          classId: class1Id,
          role: 'student',
          status: 'active',
          displayName: 'Bé An (Lớp 3A)',
          avatarUrl: '',
          joinedAt: now,
          updatedAt: now,
        },
      },
      [class2Id]: {
        [coLanUid]: {
          uid: coLanUid,
          classId: class2Id,
          role: 'owner',
          status: 'active',
          displayName: 'Cô Lan Phương',
          avatarUrl: '',
          joinedAt: now,
          updatedAt: now,
        },
        [anhHaiUid]: {
          uid: anhHaiUid,
          classId: class2Id,
          role: 'student',
          status: 'active',
          displayName: 'Anh Hai Minh (Hướng dẫn)',
          avatarUrl: '',
          joinedAt: now,
          updatedAt: now,
        },
      },
    },
    invitations: {
      [class1Id]: {
        [defaultInviteId]: {
          id: defaultInviteId,
          classId: class1Id,
          className: 'Góc học tập Lớp 3 – Bé An & Anh Hai',
          ownerName: 'Anh Hai Minh (Hướng dẫn)',
          codeHash: defaultCodeHash,
          status: 'active',
          expiresAt: Timestamp.fromMillis(Date.now() + 14 * 24 * 3600 * 1000),
          createdBy: anhHaiUid,
          createdAt: now,
        },
      },
    },
    invitationSecrets: {
      [class1Id]: {
        [defaultInviteId]: {
          invitationId: defaultInviteId,
          classId: class1Id,
          joinCode: '3A2026',
          createdAt: now,
        },
      },
    },
    joinRequests: {
      [class1Id]: {},
    },
    schedules: {
      [class1Id]: {
        sch_1: {
          id: 'sch_1',
          classId: class1Id,
          dayOfWeek: 1,
          sessionOfDay: 'morning',
          periodNumber: 1,
          subject: 'Toán',
          type: 'regular',
          teacherName: 'Cô Thu Hà',
          materialsNote: 'SGK Toán 3 tập 1, vở ô ly Toán, bảng con, thước kẻ',
          startTime: '07:30',
          endTime: '08:05',
          createdBy: anhHaiUid,
          createdAt: now,
          updatedAt: now,
        },
        sch_2: {
          id: 'sch_2',
          classId: class1Id,
          dayOfWeek: 1,
          sessionOfDay: 'morning',
          periodNumber: 2,
          subject: 'Tiếng Việt',
          type: 'regular',
          teacherName: 'Cô Thu Hà',
          materialsNote: 'SGK Tiếng Việt 3 tập 1, vở chính tả',
          startTime: '08:15',
          endTime: '08:50',
          createdBy: anhHaiUid,
          createdAt: now,
          updatedAt: now,
        },
        sch_3: {
          id: 'sch_3',
          classId: class1Id,
          dayOfWeek: 1,
          sessionOfDay: 'evening',
          periodNumber: 1,
          subject: 'Kèm Toán & Tiếng Việt (60p)',
          type: 'tutoring',
          teacherName: 'Anh Hai Minh',
          materialsNote: 'Vở bài tập Toán, vở rèn chữ, hộp bút màu',
          startTime: '19:30',
          endTime: '20:30',
          createdBy: anhHaiUid,
          createdAt: now,
          updatedAt: now,
        },
        sch_4: {
          id: 'sch_4',
          classId: class1Id,
          dayOfWeek: 2,
          sessionOfDay: 'morning',
          periodNumber: 1,
          subject: 'Tiếng Anh',
          type: 'regular',
          teacherName: 'Thầy Nam',
          materialsNote: 'Sách Tiếng Anh Global Success 3, vở từ vựng',
          startTime: '07:30',
          endTime: '08:05',
          createdBy: anhHaiUid,
          createdAt: now,
          updatedAt: now,
        },
        sch_5: {
          id: 'sch_5',
          classId: class1Id,
          dayOfWeek: 2,
          sessionOfDay: 'evening',
          periodNumber: 1,
          subject: 'Kèm Tiếng Anh & Toán đố (60p)',
          type: 'tutoring',
          teacherName: 'Anh Hai Minh',
          materialsNote: 'Flashcard từ vựng, vở nháp Toán',
          startTime: '19:30',
          endTime: '20:30',
          createdBy: anhHaiUid,
          createdAt: now,
          updatedAt: now,
        },
        sch_6: {
          id: 'sch_6',
          classId: class1Id,
          dayOfWeek: 3,
          sessionOfDay: 'evening',
          periodNumber: 1,
          subject: 'Kèm Đọc hiểu & Tập làm văn (60p)',
          type: 'tutoring',
          teacherName: 'Anh Hai Minh',
          materialsNote: 'Vở Tập làm văn, SGK Tiếng Việt 3',
          startTime: '19:30',
          endTime: '20:30',
          createdBy: anhHaiUid,
          createdAt: now,
          updatedAt: now,
        },
        sch_7: {
          id: 'sch_7',
          classId: class1Id,
          dayOfWeek: 4,
          sessionOfDay: 'evening',
          periodNumber: 1,
          subject: 'Kèm Toán Hình học & Đơn vị đo (60p)',
          type: 'tutoring',
          teacherName: 'Anh Hai Minh',
          materialsNote: 'Thước thẳng có vạch cm/mm, ê-ke, vở Toán',
          startTime: '19:30',
          endTime: '20:30',
          createdBy: anhHaiUid,
          createdAt: now,
          updatedAt: now,
        },
        sch_8: {
          id: 'sch_8',
          classId: class1Id,
          dayOfWeek: 5,
          sessionOfDay: 'evening',
          periodNumber: 1,
          subject: 'Tổng ôn cuối tuần & Thưởng sao (60p)',
          type: 'tutoring',
          teacherName: 'Anh Hai Minh',
          materialsNote: 'Phiếu ôn tập tuần, sổ sticker thưởng sao',
          startTime: '19:30',
          endTime: '20:30',
          createdBy: anhHaiUid,
          createdAt: now,
          updatedAt: now,
        },
        sch_9: {
          id: 'sch_9',
          classId: class1Id,
          dayOfWeek: 0,
          sessionOfDay: 'evening',
          periodNumber: 1,
          subject: 'Soạn cặp & Chuẩn bị bài sáng Thứ Hai',
          type: 'tutoring',
          teacherName: 'Anh Hai Minh',
          materialsNote: 'SGK Toán 3, SGK Tiếng Việt 3, khăn quàng, bình nước',
          startTime: '20:00',
          endTime: '20:30',
          createdBy: anhHaiUid,
          createdAt: now,
          updatedAt: now,
        },
      },
    },
    scheduleExceptions: {
      [class1Id]: {},
    },
    lessons: {
      [class1Id]: {
        [lesson1Id]: {
          id: lesson1Id,
          classId: class1Id,
          subject: 'Toán',
          title: 'Nhân số có ba chữ số với số có một chữ số (có nhớ)',
          goal: 'Biết đặt tính thẳng cột, nhân lần lượt từ phải sang trái và cộng phần nhớ chính xác.',
          keywords: [
            {
              term: 'Đặt tính thẳng hàng',
              meaning: 'Viết thừa số thứ hai dưới thừa số thứ nhất sao cho các hàng đơn vị thẳng cột với nhau.',
              example: '215 × 3: chữ số 3 viết thẳng cột dưới chữ số 5.',
            },
            {
              term: 'Nhân từ phải sang trái',
              meaning: 'Thực hiện nhân lần lượt hàng đơn vị, hàng chục rồi đến hàng trăm.',
              example: '3 × 5 = 15 (viết 5 nhớ 1); 3 × 1 = 3 thêm 1 bằng 4 (viết 4); 3 × 2 = 6 (viết 6) -> 645.',
            },
          ],
          explanation:
            'Bước 1: Đặt tính sao cho chữ số hàng đơn vị thẳng cột.\nBước 2: Nhân số có một chữ số với từng chữ số của số có ba chữ số theo thứ tự từ phải sang trái (hàng đơn vị -> hàng chục -> hàng trăm).\nBước 3: Nếu tích ở một hàng lớn hơn hoặc bằng 10, viết chữ số hàng đơn vị và nhớ chữ số hàng chục sang hàng kế tiếp bên trái.',
          resourceUrl: 'https://hanhtrangso.nxbgd.vn/',
          status: 'published',
          createdBy: anhHaiUid,
          createdAt: now,
          updatedAt: now,
        },
        [lesson2Id]: {
          id: lesson2Id,
          classId: class1Id,
          subject: 'Tiếng Việt',
          title: 'Mở rộng vốn từ: Từ chỉ đặc điểm & Câu khiến',
          goal: 'Phân biệt được từ chỉ đặc điểm (màu sắc, hình dáng, tính nết) và biết đặt câu khiến lịch sự.',
          keywords: [
            {
              term: 'Từ chỉ đặc điểm',
              meaning: 'Từ miêu tả màu sắc, hình dáng, kích thước hoặc tính tình của sự vật, con người.',
              example: 'xanh biếc, tròn xoe, chăm chỉ, hiền lành',
            },
            {
              term: 'Câu khiến',
              meaning: 'Câu dùng để nêu yêu cầu, đề nghị, mong muốn với người khác, cuối câu thường có dấu chấm than (!).',
              example: 'Anh ơi, chỉ giúp em bài toán này với ạ!',
            },
          ],
          explanation:
            '1. Khi tìm từ chỉ đặc điểm, em hãy tự đặt câu hỏi: "Sự vật đó có màu gì? Hình dáng thế nào? Tính chất ra sao?".\n2. Khi viết câu khiến, hãy thêm các từ lịch sự như "hãy", "vui lòng", "nhé", "ạ" để câu văn lễ phép hơn.',
          resourceUrl: 'https://hanhtrangso.nxbgd.vn/',
          status: 'published',
          createdBy: anhHaiUid,
          createdAt: now,
          updatedAt: now,
        },
        [lesson3Id]: {
          id: lesson3Id,
          classId: class1Id,
          subject: 'Toán',
          title: '[Bản nháp] Phép chia hết và phép chia có dư',
          goal: 'Hiểu số dư luôn nhỏ hơn số chia (Chưa công bố cho học sinh).',
          keywords: [
            {
              term: 'Số dư',
              meaning: 'Phần còn lại sau khi chia, luôn bé hơn số chia.',
              example: '17 : 5 = 3 (dư 2), số dư 2 < 5.',
            },
          ],
          explanation: 'Đang biên soạn ví dụ minh họa bằng kẹo cho Bé An dễ hiểu...',
          resourceUrl: '',
          status: 'draft',
          createdBy: anhHaiUid,
          createdAt: now,
          updatedAt: now,
        },
      },
    },
    lessonNotes: {
      [class1Id]: {
        [lesson1Id]: {
          lessonId: lesson1Id,
          classId: class1Id,
          content:
            'Ghi chú riêng cho Anh Hai: Bé An thường quên cộng số nhớ ở hàng chục. Nhắc em chấm nhẹ số nhớ bằng bút chì trên đầu hàng chục trước khi nhân tiếp.',
          updatedBy: anhHaiUid,
          updatedAt: now,
        },
        [lesson2Id]: {
          lessonId: lesson2Id,
          classId: class1Id,
          content:
            'Ghi chú riêng cho Anh Hai: Cho An lấy ví dụ ngay từ đồ vật trên bàn học (cây thước dài, cục tẩy trắng) để em nhớ nhanh.',
          updatedBy: anhHaiUid,
          updatedAt: now,
        },
      },
    },
    sessions: {
      [class1Id]: {
        [sessionTodayId]: {
          id: sessionTodayId,
          classId: class1Id,
          date: today,
          title: 'Buổi học 60 phút tối nay: Nhân số có 3 chữ số & Từ chỉ đặc điểm',
          goal: 'Làm thành thạo 5 phép nhân có nhớ và đặt được 3 câu có từ chỉ đặc điểm.',
          durationMinutes: 60,
          lessonIds: [lesson1Id, lesson2Id],
          checklist: DEFAULT_SESSION_CHECKLIST.map((item, idx) => ({
            ...item,
            completed: idx === 0,
          })),
          status: 'in_progress',
          summaryNote: 'Kiểm tra bài cũ 15p đầu buổi rất tốt, đang sang phần bài mới.',
          createdBy: anhHaiUid,
          createdAt: now,
          updatedAt: now,
        },
        [sessionTomorrowId]: {
          id: sessionTomorrowId,
          classId: class1Id,
          date: tomorrow,
          title: 'Buổi học tối mai: Luyện giải toán có lời văn bằng hai phép tính',
          goal: 'Tóm tắt đề toán bằng sơ đồ đoạn thẳng và trình bày lời giải rõ ràng.',
          durationMinutes: 60,
          lessonIds: [lesson1Id],
          checklist: DEFAULT_SESSION_CHECKLIST,
          status: 'planned',
          summaryNote: '',
          createdBy: anhHaiUid,
          createdAt: now,
          updatedAt: now,
        },
      },
    },
    assignments: {
      [class1Id]: {
        [task1Id]: {
          id: task1Id,
          classId: class1Id,
          sessionId: sessionTodayId,
          lessonId: lesson1Id,
          title: 'Làm 5 phép nhân có nhớ vào vở ô ly Toán',
          description:
            'Đặt tính rồi tính: 126 × 3; 218 × 4; 307 × 2; 145 × 5; 234 × 3. Nhớ kẻ chân bài làm sạch đẹp!',
          dueDate: today,
          assignedStudentUids: [beAnUid],
          starsReward: 3,
          createdBy: anhHaiUid,
          createdAt: now,
          updatedAt: now,
        },
        [task2Id]: {
          id: task2Id,
          classId: class1Id,
          sessionId: sessionTodayId,
          lessonId: lesson2Id,
          title: 'Viết 3 câu miêu tả góc học tập có dùng từ chỉ đặc điểm',
          description:
            'Gạch chân dưới các từ chỉ đặc điểm mà em đã sử dụng trong 3 câu vừa viết.',
          dueDate: today,
          assignedStudentUids: ['ALL'],
          starsReward: 2,
          createdBy: anhHaiUid,
          createdAt: now,
          updatedAt: now,
        },
      },
    },
    learningRecords: {
      [class1Id]: {
        rec_past_1: {
          id: 'rec_past_1',
          classId: class1Id,
          studentUid: beAnUid,
          studentName: 'Bé An (Lớp 3A)',
          type: 'session',
          assignmentId: null,
          sessionId: null,
          title: 'Hoàn thành buổi học ôn bảng nhân 8, 9',
          date: twoDaysAgo,
          studentStatus: 'submitted',
          studentNote: 'Em thuộc hết bảng nhân 8 và 9 rồi ạ!',
          submittedAt: now,
          instructorStatus: 'confirmed',
          instructorComment: 'Thuộc bài rất nhanh, thưởng 3 sao!',
          starsAwarded: 3,
          confirmedBy: anhHaiUid,
          confirmedAt: now,
          createdAt: now,
          updatedAt: now,
        },
        rec_past_2: {
          id: 'rec_past_2',
          classId: class1Id,
          studentUid: beAnUid,
          studentName: 'Bé An (Lớp 3A)',
          type: 'session',
          assignmentId: null,
          sessionId: null,
          title: 'Hoàn thành buổi học Luyện viết chính tả & Toán đố',
          date: yesterday,
          studentStatus: 'submitted',
          studentNote: 'Hôm nay em viết không sai lỗi chính tả nào ạ.',
          submittedAt: now,
          instructorStatus: 'confirmed',
          instructorComment: 'Chữ viết tròn đều, soạn cặp đầy đủ.',
          starsAwarded: 4,
          confirmedBy: anhHaiUid,
          confirmedAt: now,
          createdAt: now,
          updatedAt: now,
        },
        [`${task1Id}_${beAnUid}`]: {
          id: `${task1Id}_${beAnUid}`,
          classId: class1Id,
          studentUid: beAnUid,
          studentName: 'Bé An (Lớp 3A)',
          type: 'assignment',
          assignmentId: task1Id,
          sessionId: sessionTodayId,
          title: 'Làm 5 phép nhân có nhớ vào vở ô ly Toán',
          date: today,
          studentStatus: 'submitted',
          studentNote: 'Em đã làm xong cả 5 câu vào vở ô ly, nhờ anh Hai kiểm tra giúp em ạ!',
          submittedAt: now,
          instructorStatus: 'unverified',
          instructorComment: '',
          starsAwarded: 0,
          confirmedBy: null,
          confirmedAt: null,
          createdAt: now,
          updatedAt: now,
        },
      },
    },
  };
}

export function loadDemoState(): RawDemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = createInitialSeed();
      saveDemoState(seed);
      return seed;
    }
    const parsed = JSON.parse(raw) as RawDemoState;
    return reviveTimestamps(parsed);
  } catch {
    const seed = createInitialSeed();
    return seed;
  }
}

export function saveDemoState(state: RawDemoState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors in private mode
  }
}

export function resetDemoState(): RawDemoState {
  const seed = createInitialSeed();
  saveDemoState(seed);
  return seed;
}

export function getActiveDemoUid(): string | null {
  try {
    return localStorage.getItem(ACTIVE_USER_KEY);
  } catch {
    return null;
  }
}

export function setActiveDemoUid(uid: string | null): void {
  try {
    if (uid) {
      localStorage.setItem(ACTIVE_USER_KEY, uid);
    } else {
      localStorage.removeItem(ACTIVE_USER_KEY);
    }
  } catch {
    // Ignore
  }
}
