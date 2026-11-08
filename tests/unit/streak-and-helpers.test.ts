import { describe, expect, it } from 'vitest';
import {
  addDaysToDateString,
  formatDateInTimezone,
  formatVietnameseDate,
  getDayOfWeekFromDateString,
  getTodayAndTomorrow,
  isValidDateString,
} from '@/lib/date';
import {
  calculateStudentProgressAndStreak,
  isScheduledStudyDay,
} from '@/lib/streak';
import {
  computeInvitationCodeHash,
  decodeCompositeInviteToken,
  encodeCompositeInviteToken,
  generateJoinCode,
  generateRandomToken,
} from '@/lib/crypto';
import {
  validateAssignmentInput,
  validateClassInput,
  validateLessonInput,
  validateSessionInput,
} from '@/lib/validation';
import { parseScheduleJsonFromAiResponse } from '@/lib/scheduleAiParser';
import {
  classifySrsCardBucket,
  computeNextSrsState,
  inferDefaultTtsLang,
  makeSrsCardKey,
  parseFlashcardAiResponse,
  parseQuizAiResponse,
} from '@/lib/studyAiAndSrs';

describe('Date & Timezone Helpers (Asia/Ho_Chi_Minh)', () => {
  it('chuyển đổi chính xác UTC sang ngày theo múi giờ Asia/Ho_Chi_Minh (+07:00)', () => {
    // 2026-11-07 18:30:00 UTC -> 2026-11-08 01:30:00 ICT (+07:00)
    const utcLateNight = new Date('2026-11-07T18:30:00.000Z');
    expect(formatDateInTimezone(utcLateNight, 'Asia/Ho_Chi_Minh')).toBe('2026-11-08');
  });

  it('kiểm tra định dạng YYYY-MM-DD và ngày hợp lệ (bao gồm năm nhuận)', () => {
    expect(isValidDateString('2026-11-07')).toBe(true);
    expect(isValidDateString('2024-02-29')).toBe(true);
    expect(isValidDateString('2026-02-29')).toBe(false);
    expect(isValidDateString('07-11-2026')).toBe(false);
  });

  it('tính đúng thứ trong tuần và cộng/trừ ngày', () => {
    // 2026-11-07 là Thứ Bảy (6)
    expect(getDayOfWeekFromDateString('2026-11-07')).toBe(6);
    expect(addDaysToDateString('2026-11-07', 1)).toBe('2026-11-08');
    expect(getDayOfWeekFromDateString('2026-11-08')).toBe(0); // Chủ Nhật
    expect(formatVietnameseDate('2026-11-07')).toBe('Thứ Bảy, 07/11/2026');
  });

  it('getTodayAndTomorrow trả về đúng cặp ngày hôm nay và ngày mai', () => {
    const sample = new Date('2026-11-07T12:00:00+07:00');
    const res = getTodayAndTomorrow(sample, 'Asia/Ho_Chi_Minh');
    expect(res.today).toBe('2026-11-07');
    expect(res.tomorrow).toBe('2026-11-08');
    expect(res.todayDayOfWeek).toBe(6);
    expect(res.tomorrowDayOfWeek).toBe(0);
  });
});

describe('Streak & Progress Engine', () => {
  it('KHÔNG tính streak hoặc sao khi học sinh chỉ tự bấm hoàn thành mà chưa được instructor xác nhận', () => {
    const summary = calculateStudentProgressAndStreak({
      todayDateStr: '2026-11-06',
      studyDaysOfWeek: [1, 2, 3, 4, 5],
      records: [
        {
          date: '2026-11-05',
          studentStatus: 'submitted',
          instructorStatus: 'unverified',
          starsAwarded: 5,
        },
        {
          date: '2026-11-06',
          studentStatus: 'submitted',
          instructorStatus: 'unverified',
          starsAwarded: 3,
        },
      ],
    });

    expect(summary.currentStreak).toBe(0);
    expect(summary.longestStreak).toBe(0);
    expect(summary.totalStars).toBe(0);
    expect(summary.pendingConfirmationCount).toBe(2);
  });

  it('tính đúng chuỗi ngày học liên tiếp khi có xác nhận của instructor', () => {
    // 2026-11-02 (T2), 2026-11-03 (T3), 2026-11-04 (T4)
    const summary = calculateStudentProgressAndStreak({
      todayDateStr: '2026-11-04',
      studyDaysOfWeek: [1, 2, 3, 4, 5],
      records: [
        {
          date: '2026-11-02',
          studentStatus: 'submitted',
          instructorStatus: 'confirmed',
          starsAwarded: 2,
        },
        {
          date: '2026-11-03',
          studentStatus: 'submitted',
          instructorStatus: 'confirmed',
          starsAwarded: 3,
        },
        {
          date: '2026-11-04',
          studentStatus: 'submitted',
          instructorStatus: 'confirmed',
          starsAwarded: 4,
        },
      ],
    });

    expect(summary.currentStreak).toBe(3);
    expect(summary.longestStreak).toBe(3);
    expect(summary.totalStars).toBe(9);
    expect(summary.isTodayConfirmed).toBe(true);
  });

  it('KHÔNG làm đứt streak qua ngày cuối tuần (T7, CN) hoặc ngày nghỉ ngoại lệ (dayOffDates)', () => {
    // Học T6 (2026-11-06), nghỉ cuối tuần T7 (07/11) & CN (08/11), nghỉ lễ T2 (09/11), học T3 (10/11)
    const summary = calculateStudentProgressAndStreak({
      todayDateStr: '2026-11-10',
      studyDaysOfWeek: [1, 2, 3, 4, 5], // Chỉ học T2 -> T6
      dayOffDates: ['2026-11-09'], // T2 nghỉ ngoại lệ
      records: [
        {
          date: '2026-11-05', // T5
          studentStatus: 'submitted',
          instructorStatus: 'confirmed',
          starsAwarded: 2,
        },
        {
          date: '2026-11-06', // T6
          studentStatus: 'submitted',
          instructorStatus: 'confirmed',
          starsAwarded: 3,
        },
        {
          date: '2026-11-10', // T3 tuần kế tiếp
          studentStatus: 'submitted',
          instructorStatus: 'confirmed',
          starsAwarded: 5,
        },
      ],
    });

    expect(isScheduledStudyDay('2026-11-07', [1, 2, 3, 4, 5])).toBe(false);
    expect(
      isScheduledStudyDay('2026-11-09', [1, 2, 3, 4, 5], new Set(['2026-11-09']))
    ).toBe(false);
    expect(summary.currentStreak).toBe(3);
    expect(summary.longestStreak).toBe(3);
    expect(summary.totalStars).toBe(10);
  });

  it('làm đứt currentStreak nếu bỏ lỡ một ngày học có lịch trong quá khứ nhưng vẫn giữ longestStreak', () => {
    // Học T2 (02/11), T3 (03/11), T4 (04/11) -> nghỉ không phép T5 (05/11) -> học T6 (06/11)
    const summary = calculateStudentProgressAndStreak({
      todayDateStr: '2026-11-06',
      studyDaysOfWeek: [1, 2, 3, 4, 5],
      records: [
        {
          date: '2026-11-02',
          studentStatus: 'submitted',
          instructorStatus: 'confirmed',
          starsAwarded: 2,
        },
        {
          date: '2026-11-03',
          studentStatus: 'submitted',
          instructorStatus: 'confirmed',
          starsAwarded: 2,
        },
        {
          date: '2026-11-04',
          studentStatus: 'submitted',
          instructorStatus: 'confirmed',
          starsAwarded: 2,
        },
        // Bỏ trống 2026-11-05 (Thứ Năm)
        {
          date: '2026-11-06',
          studentStatus: 'submitted',
          instructorStatus: 'confirmed',
          starsAwarded: 3,
        },
      ],
    });

    expect(summary.currentStreak).toBe(1);
    expect(summary.longestStreak).toBe(3);
    expect(summary.totalStars).toBe(9);
  });

  it('giữ nguyên streak của ngày hôm qua nếu hôm nay chưa kết thúc / chưa được xác nhận', () => {
    const summary = calculateStudentProgressAndStreak({
      todayDateStr: '2026-11-04',
      studyDaysOfWeek: [1, 2, 3, 4, 5],
      records: [
        {
          date: '2026-11-02',
          studentStatus: 'submitted',
          instructorStatus: 'confirmed',
          starsAwarded: 2,
        },
        {
          date: '2026-11-03',
          studentStatus: 'submitted',
          instructorStatus: 'confirmed',
          starsAwarded: 3,
        },
      ],
    });

    expect(summary.currentStreak).toBe(2);
    expect(summary.isTodayConfirmed).toBe(false);
  });
});

describe('Crypto, Invitation Token & Form Validation Helpers', () => {
  it('tạo token ngẫu nhiên, mã tham gia và băm SHA-256 nhất quán', async () => {
    const token = generateRandomToken(24);
    const code = generateJoinCode(6);
    expect(token).toHaveLength(24);
    expect(code).toHaveLength(6);

    const hashUpper = await computeInvitationCodeHash(token, code);
    const hashLowerWithSpace = await computeInvitationCodeHash(
      token,
      `  ${code.toLowerCase()} `
    );
    expect(hashUpper).toHaveLength(64);
    expect(hashUpper).toBe(hashLowerWithSpace);

    const composite = encodeCompositeInviteToken('cls_1234', token);
    expect(decodeCompositeInviteToken(composite)).toEqual({
      classId: 'cls_1234',
      invitationId: token,
    });
    expect(decodeCompositeInviteToken('invalid-token-without-dot')).toBeNull();
  });

  it('kiểm tra dữ liệu đầu vào cho Class, Lesson, Session, Assignment', () => {
    expect(
      validateClassInput({
        name: 'A',
        description: '',
        color: 'emerald',
        icon: 'book-open',
        studyDaysOfWeek: [1, 2, 3],
      }).valid
    ).toBe(false);

    expect(
      validateClassInput({
        name: 'Toán & Tiếng Việt Lớp 3',
        description: 'Học 60 phút mỗi tối cùng anh hai',
        color: 'emerald',
        icon: 'book-open',
        studyDaysOfWeek: [1, 2, 3, 4, 5],
      }).valid
    ).toBe(true);

    expect(
      validateLessonInput({
        title: 'Phép nhân trong phạm vi 1000',
        subject: 'Toán',
        goal: 'Nắm vững cách đặt tính rồi tính',
        explanation: 'Nhân lần lượt từ hàng đơn vị...',
        resourceUrl: 'javascript:alert(1)',
      }).valid
    ).toBe(false);

    expect(
      validateSessionInput({
        title: 'Buổi học tối thứ Hai',
        date: '2026-11-09',
        durationMinutes: 60,
      }).valid
    ).toBe(true);

    expect(
      validateAssignmentInput({
        title: 'Làm bài tập trang 42',
        dueDate: '2026-11-09',
        starsReward: 3,
        assignedStudentUids: ['ALL'],
      }).valid
    ).toBe(true);
  });

  it('bóc tách chính xác JSON từ phản hồi codeblock của AI và chuẩn hóa tiết chiều 6-8 về 1-3', () => {
    const sampleAiOutput = `
Dưới đây là kết quả trích xuất thời khóa biểu từ ảnh bạn gửi:

\`\`\`json
[
  {
    "dayOfWeek": "Thứ Hai",
    "sessionOfDay": "morning",
    "periodNumber": 1,
    "subject": "Chào cờ",
    "materialsNote": "Đội mũ ca lô",
    "startTime": "07:00",
    "endTime": "07:35",
    "type": "school"
  },
  {
    "dayOfWeek": 2,
    "sessionOfDay": "Chiều",
    "periodNumber": 6,
    "subject": "Tiếng Anh",
    "materialsNote": "SGK Tiếng Anh",
    "startTime": "",
    "endTime": "",
    "type": "school"
  }
]
\`\`\`
Hy vọng thông tin này giúp ích cho bạn!`;

    const parsed = parseScheduleJsonFromAiResponse(sampleAiOutput);
    expect(parsed.error).toBeUndefined();
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0].dayOfWeek).toBe(1);
    expect(parsed.items[0].sessionOfDay).toBe('morning');
    expect(parsed.items[0].periodNumber).toBe(1);
    expect(parsed.items[0].subject).toBe('Chào cờ');

    expect(parsed.items[1].dayOfWeek).toBe(2);
    expect(parsed.items[1].sessionOfDay).toBe('afternoon');
    expect(parsed.items[1].periodNumber).toBe(1); // Tiết 6 buổi chiều -> Tiết 1 buổi chiều
    expect(parsed.items[1].startTime).toBe('');
  });

  it('tính đúng Đường cong quên lãng Ebbinghaus (SRS) và bóc tách JSON Flashcard + Quiz đa ngôn ngữ', () => {
    expect(inferDefaultTtsLang('Everybody Up 1')).toBe('en-US');
    expect(inferDefaultTtsLang('Tiếng Trung HSK 1')).toBe('zh-CN');
    expect(inferDefaultTtsLang('Toán lớp 3')).toBe('');

    const sampleKeyword = {
      term: 'pencil case',
      pronunciation: '/ˈpensl keɪs/',
      meaning: 'hộp bút',
      example: "It's a pencil case.",
    };

    const key = makeSrsCardKey('les_1', sampleKeyword.term);
    expect(classifySrsCardBucket(undefined, '2026-11-08')).toBe('new');

    // Lần 1 bấm "Tạm nhớ" (good) -> Mức 2, hẹn ôn sau +3 ngày
    const s1 = computeNextSrsState({
      prev: undefined,
      rating: 'good',
      todayStr: '2026-11-08',
      lessonId: 'les_1',
      subject: 'Everybody Up 1',
      unitTitle: 'Unit 1: First Day',
      keyword: sampleKeyword,
      lessonTtsLang: 'en-US',
    });
    expect(s1.key).toBe(key);
    expect(s1.level).toBe(2);
    expect(s1.nextReviewDate).toBe('2026-11-11');
    expect(classifySrsCardBucket(s1, '2026-11-08')).toBe('due_soon');

    // Lần 2 bấm "Đã nhớ kỹ" (easy) -> Mức 3, hẹn ôn sau +14 ngày
    const s2 = computeNextSrsState({
      prev: s1,
      rating: 'easy',
      todayStr: '2026-11-11',
      lessonId: 'les_1',
      subject: 'Everybody Up 1',
      unitTitle: 'Unit 1: First Day',
      keyword: sampleKeyword,
      lessonTtsLang: 'en-US',
    });
    expect(s2.level).toBe(3);
    expect(s2.nextReviewDate).toBe('2026-11-25');
    expect(classifySrsCardBucket(s2, '2026-11-11')).toBe('mastered');
    expect(classifySrsCardBucket(s2, '2026-11-25')).toBe('due_soon');

    // Nếu làm bài kiểm tra sai (forgot) -> hạ về Mức 1 (struggling, +1 ngày)
    const sForgot = computeNextSrsState({
      prev: s2,
      rating: 'forgot',
      todayStr: '2026-11-12',
      lessonId: 'les_1',
      subject: 'Everybody Up 1',
      unitTitle: 'Unit 1: First Day',
      keyword: sampleKeyword,
      lessonTtsLang: 'en-US',
    });
    expect(sForgot.level).toBe(1);
    expect(sForgot.nextReviewDate).toBe('2026-11-13');
    expect(classifySrsCardBucket(sForgot, '2026-11-12')).toBe('struggling');

    // Kiểm tra bóc tách JSON Flashcard từ AI (dùng ttsLang thay vì hardcode tiếng Anh)
    const flashcardAi = parseFlashcardAiResponse(
      `\`\`\`json
{
  "subject": "Everybody Up 1",
  "unitTitle": "Unit 1: First Day",
  "title": "Lesson 1: School Supplies",
  "goal": "Nhớ 2 từ vựng đồ dùng học tập",
  "explanation": "Cấu trúc What is it? It's a...",
  "ttsLang": "en-US",
  "keywords": [
    {
      "term": "pencil case",
      "pronunciation": "/ˈpensl keɪs/",
      "meaning": "hộp bút",
      "example": "It's a pencil case.",
      "cardType": "vocab"
    }
  ]
}
\`\`\``,
      'Everybody Up 1',
      'Unit 1: First Day'
    );
    expect(flashcardAi.error).toBeUndefined();
    expect(flashcardAi.ttsLang).toBe('en-US');
    expect(flashcardAi.keywords).toHaveLength(1);
    expect(flashcardAi.keywords[0].pronunciation).toBe('/ˈpensl keɪs/');

    // Kiểm tra bóc tách JSON Đề trắc nghiệm từ AI
    const quizAi = parseQuizAiResponse(
      `\`\`\`json
{
  "title": "Đề kiểm tra Unit 1",
  "description": "Chọn đáp án đúng nhất",
  "questions": [
    {
      "question": "Nghĩa của từ 'pencil case' là gì?",
      "options": ["Hộp bút", "Cục tẩy", "Thước kẻ", "Bút chì"],
      "correctIndex": 0,
      "explanation": "Pencil case nghĩa là hộp bút.",
      "relatedTerm": "pencil case"
    }
  ]
}
\`\`\``,
      'Đề kiểm tra Unit 1'
    );
    expect(quizAi.error).toBeUndefined();
    expect(quizAi.questions).toHaveLength(1);
    expect(quizAi.questions[0].correctIndex).toBe(0);
    expect(quizAi.questions[0].relatedTerm).toBe('pencil case');
  });
});

