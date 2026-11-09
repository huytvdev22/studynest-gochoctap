import type { Timestamp } from 'firebase/firestore';

export type ClassRole = 'owner' | 'instructor' | 'student';

export type ClassThemeColor = 'emerald' | 'sky' | 'amber' | 'violet' | 'rose';

export type ClassThemeIcon = 'book-open' | 'star' | 'compass' | 'sparkles' | 'graduation-cap';

export type SessionOfDay = 'morning' | 'afternoon' | 'evening';

export type ScheduleType = 'regular' | 'tutoring' | 'extra';

export type LessonStatus = 'draft' | 'published';

export type StudySessionStatus = 'planned' | 'in_progress' | 'completed';

export type StudentSubmissionStatus = 'pending' | 'submitted';

export type InstructorReviewStatus = 'unverified' | 'confirmed' | 'needs_work';

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StudyClass {
  id: string;
  name: string;
  description: string;
  color: ClassThemeColor;
  icon: ClassThemeIcon;
  timezone: string; // Default: 'Asia/Ho_Chi_Minh'
  studyDaysOfWeek: number[]; // 0 (Chủ nhật) -> 6 (Thứ bảy), e.g., [1, 2, 3, 4, 5]
  ownerId: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ClassMember {
  uid: string;
  classId: string;
  role: ClassRole;
  status: 'active' | 'removed';
  displayName: string;
  avatarUrl: string;
  joinedAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ClassInvitation {
  id: string; // High-entropy random token
  classId: string;
  className: string;
  ownerName: string;
  codeHash: string; // lowercase hex SHA-256 of `${id}:${UPPERCASE_CODE}`
  status: 'active' | 'revoked';
  expiresAt: Timestamp;
  createdBy: string;
  createdAt: Timestamp;
}

export interface InvitationSecret {
  invitationId: string;
  classId: string;
  joinCode: string; // Stored only in owner-readable collection
  createdAt: Timestamp;
}

export interface JoinRequest {
  uid: string;
  classId: string;
  invitationId: string;
  submittedCode: string;
  displayName: string;
  avatarUrl: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ScheduleItem {
  id: string;
  classId: string;
  dayOfWeek: number; // 0 = Chủ nhật, 1 = Thứ 2, ..., 6 = Thứ 7
  sessionOfDay: SessionOfDay;
  periodNumber: number; // 1..12
  subject: string;
  type: ScheduleType; // 'regular' (Chính khóa ở trường) | 'extra' (Học thêm) | 'tutoring' (Học ở nhà)
  teacherName: string;
  materialsNote: string; // Sách vở / dụng cụ cần chuẩn bị
  startTime: string; // Optional e.g. '19:30'
  endTime: string; // Optional e.g. '20:30'
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ScheduleException {
  id: string; // YYYY-MM-DD
  classId: string;
  date: string; // YYYY-MM-DD
  reason: string;
  isDayOff: boolean;
  createdBy: string;
  createdAt: Timestamp;
}

export type SupportedTtsLang =
  | ''
  | 'en-US'
  | 'en-GB'
  | 'zh-CN'
  | 'ja-JP'
  | 'ko-KR'
  | 'fr-FR'
  | 'vi-VN';

export interface LessonKeyword {
  term: string;
  meaning: string;
  example: string;
  pronunciation?: string; // Phiên âm (IPA cho Tiếng Anh, Pinyin cho Tiếng Trung, Romaji cho Tiếng Nhật...)
  cardType?: 'vocab' | 'sentence' | 'concept';
  ttsLang?: SupportedTtsLang; // Mã ngôn ngữ đọc âm thanh (VD: 'en-US', 'zh-CN', '' nếu không bật loa)
}

export interface Lesson {
  id: string;
  classId: string;
  subject: string; // Tên Giáo trình / Môn học độc lập (VD: "Everybody Up 1", "Toán Lớp 3")
  unitTitle?: string; // Tên Unit / Chương (VD: "Unit 1: First Day", "Chương 1: Phép nhân")
  ttsLang?: SupportedTtsLang; // Ngôn ngữ phát âm mặc định của giáo trình/bài học ('' nếu tắt loa)
  title: string;
  goal: string;
  keywords: LessonKeyword[];
  explanation: string;
  resourceUrl: string; // Link PDF / tài liệu ngoài (không dùng Cloud Storage)
  status: LessonStatus; // 'draft' | 'published'
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[]; // 4 đáp án A, B, C, D
  correctIndex: number; // 0..3
  explanation: string;
  relatedTerm?: string; // Từ khóa/mẫu câu liên quan để cập nhật Đường cong quên lãng
}

export type SrsMemoryLevel = 0 | 1 | 2 | 3; // 0: Mới học, 1: Hay quên, 2: Đang nhớ/Sắp quên, 3: Đã nhớ kỹ

export interface SrsCardProgress {
  key: string;
  lessonId: string;
  subject: string;
  unitTitle: string;
  term: string;
  meaning: string;
  example: string;
  pronunciation?: string;
  ttsLang?: SupportedTtsLang;
  level: SrsMemoryLevel;
  streakCorrect: number;
  lastReviewedDate: string; // YYYY-MM-DD
  nextReviewDate: string; // YYYY-MM-DD
  lastRating?: 'forgot' | 'good' | 'easy';
  history?: Array<{
    date: string;
    rating: 'forgot' | 'good' | 'easy';
    intervalDays: number;
  }>;
}

export interface LessonNote {
  lessonId: string;
  classId: string;
  content: string; // Ghi chú riêng chỉ owner/instructor đọc được
  updatedBy: string;
  updatedAt: Timestamp;
}

export interface SessionChecklistItem {
  id: string;
  label: string;
  durationMinutes: number;
  completed: boolean;
}

export interface StudySession {
  id: string;
  classId: string;
  date: string; // YYYY-MM-DD theo múi giờ lớp
  title: string;
  goal: string;
  durationMinutes: number; // Mặc định 60 phút
  lessonIds: string[];
  checklist: SessionChecklistItem[];
  status: StudySessionStatus;
  summaryNote: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Assignment {
  id: string;
  classId: string;
  sessionId: string | null;
  lessonId: string | null;
  title: string;
  description: string;
  dueDate: string; // YYYY-MM-DD
  assignedStudentUids: string[]; // ['ALL'] hoặc danh sách uid học sinh
  starsReward: number; // 1..10
  taskType?: 'standard' | 'flashcard' | 'quiz';
  subject?: string;
  unitTitle?: string;
  ttsLang?: SupportedTtsLang;
  flashcards?: LessonKeyword[];
  quizQuestions?: QuizQuestion[];
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface LearningRecord {
  id: string; // `${assignmentId}_${studentUid}` hoặc `session_${sessionId}_${studentUid}` hoặc `srs_${studentUid}`
  classId: string;
  studentUid: string;
  studentName: string;
  type: 'assignment' | 'session';
  assignmentId: string | null;
  sessionId: string | null;
  title: string;
  date: string; // YYYY-MM-DD theo múi giờ lớp
  studentStatus: StudentSubmissionStatus;
  studentNote: string;
  submittedAt: Timestamp | null;
  instructorStatus: InstructorReviewStatus;
  instructorComment: string;
  starsAwarded: number;
  confirmedBy: string | null;
  confirmedAt: Timestamp | null;
  quizScore?: number;
  quizTotal?: number;
  srsStates?: Record<string, SrsCardProgress>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

