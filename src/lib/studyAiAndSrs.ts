import type {
  Lesson,
  LessonKeyword,
  QuizQuestion,
  SrsCardProgress,
  SrsMemoryLevel,
  SupportedTtsLang,
} from '@/types/domain';
import { addDaysToDateStr } from './date';

export const TTS_LANGUAGE_OPTIONS: Array<{
  value: SupportedTtsLang;
  label: string;
  shortBadge: string;
}> = [
  {
    value: '',
    label: 'Không bật loa đọc ngoại ngữ (Toán, Khoa học, Lịch sử...)',
    shortBadge: 'Tắt loa',
  },
  {
    value: 'en-US',
    label: 'Tiếng Anh – Mỹ (en-US)',
    shortBadge: 'EN-US',
  },
  {
    value: 'en-GB',
    label: 'Tiếng Anh – Anh (en-GB)',
    shortBadge: 'EN-GB',
  },
  {
    value: 'zh-CN',
    label: 'Tiếng Trung – Phổ thông (zh-CN)',
    shortBadge: 'ZH-CN',
  },
  {
    value: 'ja-JP',
    label: 'Tiếng Nhật (ja-JP)',
    shortBadge: 'JA-JP',
  },
  {
    value: 'ko-KR',
    label: 'Tiếng Hàn (ko-KR)',
    shortBadge: 'KO-KR',
  },
  {
    value: 'fr-FR',
    label: 'Tiếng Pháp (fr-FR)',
    shortBadge: 'FR-FR',
  },
  {
    value: 'vi-VN',
    label: 'Tiếng Việt (vi-VN)',
    shortBadge: 'VI-VN',
  },
];

const VALID_TTS_LANGS = new Set<SupportedTtsLang>([
  '',
  'en-US',
  'en-GB',
  'zh-CN',
  'ja-JP',
  'ko-KR',
  'fr-FR',
  'vi-VN',
]);

export function normalizeTtsLang(raw?: string | null): SupportedTtsLang {
  if (!raw) return '';
  const trimmed = raw.trim() as SupportedTtsLang;
  if (VALID_TTS_LANGS.has(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('en-gb')) return 'en-GB';
  if (lower.startsWith('en')) return 'en-US';
  if (lower.startsWith('zh')) return 'zh-CN';
  if (lower.startsWith('ja')) return 'ja-JP';
  if (lower.startsWith('ko')) return 'ko-KR';
  if (lower.startsWith('fr')) return 'fr-FR';
  if (lower.startsWith('vi')) return 'vi-VN';
  return '';
}

export function inferDefaultTtsLang(
  subject: string,
  explicitLang?: SupportedTtsLang
): SupportedTtsLang {
  if (explicitLang !== undefined) {
    return normalizeTtsLang(explicitLang);
  }
  const s = subject.toLowerCase();
  if (
    s.includes('tiếng anh') ||
    s.includes('english') ||
    s.includes('everybody up') ||
    s.includes('family and friends') ||
    s.includes('oxford') ||
    s.includes('cambridge') ||
    s.includes('phonics')
  ) {
    return 'en-US';
  }
  if (s.includes('tiếng trung') || s.includes('chinese') || s.includes('hsk') || s.includes('hán ngữ')) {
    return 'zh-CN';
  }
  if (s.includes('tiếng nhật') || s.includes('japanese') || s.includes('jlpt')) {
    return 'ja-JP';
  }
  if (s.includes('tiếng hàn') || s.includes('korean') || s.includes('topik')) {
    return 'ko-KR';
  }
  if (s.includes('tiếng pháp') || s.includes('french')) {
    return 'fr-FR';
  }
  return '';
}

/**
 * Phát âm văn bản bằng chuẩn Web Speech API (SpeechSynthesis) tích hợp sẵn trên trình duyệt.
 * Hoàn toàn miễn phí, không cần gọi API ngoài, hỗ trợ đọc tốc độ thường và tốc độ chậm (slow = true).
 */
export function speakTextWithTts(
  text: string,
  lang: SupportedTtsLang,
  slow = false
): boolean {
  if (
    typeof window === 'undefined' ||
    !('speechSynthesis' in window) ||
    !lang ||
    !text.trim()
  ) {
    return false;
  }

  try {
    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = lang;
    utterance.rate = slow ? 0.72 : 0.92;
    utterance.pitch = 1;

    const voices = synth.getVoices();
    const langPrefix = lang.split('-')[0].toLowerCase();
    const matchedVoice =
      voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));

    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    synth.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Đường cong quên lãng (Ebbinghaus Forgetting Curve / Spaced Repetition - SRS)
// ============================================================================

export type SrsBucket = 'new' | 'struggling' | 'due_soon' | 'mastered';

export type SrsReviewRating = 'forgot' | 'good' | 'easy';

export function makeSrsCardKey(lessonId: string, term: string): string {
  const cleanTerm = term
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .slice(0, 80);
  return `${lessonId}::${cleanTerm}`;
}

export function classifySrsCardBucket(
  card: SrsCardProgress | undefined,
  todayStr: string
): SrsBucket {
  if (!card || card.level === 0) return 'new';
  if (card.level === 1) return 'struggling';
  if (card.nextReviewDate <= todayStr || card.level === 2) return 'due_soon';
  return 'mastered';
}

export function computeNextSrsState(params: {
  prev?: SrsCardProgress;
  rating: SrsReviewRating;
  todayStr: string;
  lessonId: string;
  subject: string;
  unitTitle?: string;
  keyword: LessonKeyword;
  lessonTtsLang?: SupportedTtsLang;
}): SrsCardProgress {
  const {
    prev,
    rating,
    todayStr,
    lessonId,
    subject,
    unitTitle = 'Chung',
    keyword,
    lessonTtsLang,
  } = params;

  const key = makeSrsCardKey(lessonId, keyword.term);
  const prevStreak = prev?.streakCorrect || 0;

  let nextLevel: SrsMemoryLevel = 1;
  let nextStreak = 0;
  let intervalDays = 1;

  if (rating === 'forgot') {
    // Quên hoặc làm sai -> Hạ về Mức 1 (Hay quên), bắt buộc ôn lại vào ngày mai (+1 ngày)
    nextLevel = 1;
    nextStreak = 0;
    intervalDays = 1;
  } else if (rating === 'good') {
    // Tạm nhớ -> Lên Mức 2 (Đang nhớ), hẹn ôn sau 3 ngày hoặc 7 ngày nếu đã nhớ liên tiếp
    nextStreak = prevStreak + 1;
    nextLevel = nextStreak >= 3 ? 3 : 2;
    intervalDays = nextStreak >= 2 ? 7 : 3;
  } else {
    // Nhớ kỹ ('easy') -> Lên Mức 3 (Đã nhớ kỹ), hẹn ôn sau 14 ngày hoặc 30 ngày
    nextStreak = prevStreak + 1;
    nextLevel = 3;
    intervalDays = nextStreak >= 3 ? 30 : 14;
  }

  const nextReviewDate = addDaysToDateStr(todayStr, intervalDays);
  const resolvedTts =
    keyword.ttsLang !== undefined
      ? keyword.ttsLang
      : inferDefaultTtsLang(subject, lessonTtsLang);

  return {
    key,
    lessonId,
    subject,
    unitTitle: unitTitle || 'Chung',
    term: keyword.term,
    meaning: keyword.meaning,
    example: keyword.example || '',
    pronunciation: keyword.pronunciation || '',
    ttsLang: resolvedTts,
    level: nextLevel,
    streakCorrect: nextStreak,
    lastReviewedDate: todayStr,
    nextReviewDate,
  };
}

export interface EnrichedFlashcardItem {
  key: string;
  lessonId: string;
  lessonTitle: string;
  subject: string;
  unitTitle: string;
  keyword: LessonKeyword;
  ttsLang: SupportedTtsLang;
  srs?: SrsCardProgress;
  bucket: SrsBucket;
}

export function buildCurriculumSrsOverview(params: {
  lessons: Lesson[];
  srsStates: Record<string, SrsCardProgress>;
  todayStr: string;
  subjectFilter?: string;
  unitFilter?: string;
}): {
  allCards: EnrichedFlashcardItem[];
  counts: Record<SrsBucket, number>;
  reviewDueCards: EnrichedFlashcardItem[];
} {
  const {
    lessons,
    srsStates,
    todayStr,
    subjectFilter = 'ALL',
    unitFilter = 'ALL',
  } = params;

  const allCards: EnrichedFlashcardItem[] = [];
  const counts: Record<SrsBucket, number> = {
    new: 0,
    struggling: 0,
    due_soon: 0,
    mastered: 0,
  };

  for (const lesson of lessons) {
    if (subjectFilter !== 'ALL' && lesson.subject !== subjectFilter) continue;
    const lessonUnit = lesson.unitTitle?.trim() || 'Chưa phân Unit';
    if (unitFilter !== 'ALL' && lessonUnit !== unitFilter) continue;

    const lessonTts = inferDefaultTtsLang(lesson.subject, lesson.ttsLang);

    for (const kw of lesson.keywords) {
      if (!kw.term.trim()) continue;
      const key = makeSrsCardKey(lesson.id, kw.term);
      const srs = srsStates[key];
      const bucket = classifySrsCardBucket(srs, todayStr);
      counts[bucket] += 1;

      allCards.push({
        key,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        subject: lesson.subject,
        unitTitle: lessonUnit,
        keyword: kw,
        ttsLang: kw.ttsLang !== undefined ? kw.ttsLang : lessonTts,
        srs,
        bucket,
      });
    }
  }

  // Các thẻ cần ưu tiên ôn tập theo Đường cong quên lãng: Hay quên -> Sắp quên -> Mới học
  const priorityOrder: Record<SrsBucket, number> = {
    struggling: 0,
    due_soon: 1,
    new: 2,
    mastered: 3,
  };

  const reviewDueCards = allCards
    .filter((c) => c.bucket === 'struggling' || c.bucket === 'due_soon' || c.bucket === 'new')
    .sort((a, b) => priorityOrder[a.bucket] - priorityOrder[b.bucket]);

  return {
    allCards,
    counts,
    reviewDueCards,
  };
}

// ============================================================================
// AI Prompt & JSON Parser #1: Tạo Bài học + Bộ thẻ Flashcard
// ============================================================================

export function buildFlashcardAiPrompt(params: {
  subject: string;
  unitTitle: string;
  lessonTitle: string;
  ttsLang: SupportedTtsLang;
  rawNotes: string;
}): string {
  const { subject, unitTitle, lessonTitle, ttsLang, rawNotes } = params;
  const hasForeignTts = Boolean(ttsLang);

  return `Bạn là trợ lý biên soạn bài học và thẻ ghi nhớ (Flashcard) cho học sinh tiểu học trên hệ thống StudyNest.
Hãy dựa vào thông tin buổi học (và ảnh chụp trang sách nếu có đính kèm) để tạo nội dung bài học và danh sách thẻ Flashcard.

THÔNG TIN BÀI HỌC:
- Giáo trình / Môn học: "${subject || 'Everybody Up'}"
- Chương / Unit: "${unitTitle || 'Unit 1'}"
- Tên bài học (Lesson): "${lessonTitle || 'Lesson 1'}"
- Mã ngôn ngữ phát âm (ttsLang): "${ttsLang}"
- Ghi chú buổi học / Từ mới / Mẫu câu cần nhớ:
"""
${rawNotes.trim() || 'Hãy trích xuất toàn bộ từ vựng mới, mẫu câu hỏi - đáp và điểm ngữ pháp quan trọng từ ảnh chụp trang sách đính kèm.'}
"""

YÊU CẦU ĐẦU RA:
Chỉ trả về duy nhất 1 khối codeblock \`\`\`json hợp lệ theo đúng cấu trúc dưới đây:

\`\`\`json
{
  "subject": "${subject || 'Everybody Up'}",
  "unitTitle": "${unitTitle || 'Unit 1: First Day'}",
  "title": "${lessonTitle || 'Lesson 1: School Supplies'}",
  "ttsLang": "${ttsLang}",
  "goal": "Mục tiêu ngắn gọn học sinh cần nắm được sau bài học",
  "explanation": "Tóm tắt kiến thức / mẫu câu / ngữ pháp trọng tâm trình bày rõ ràng, dễ hiểu cho học sinh",
  "keywords": [
    {
      "term": "${hasForeignTts ? 'Từ mới hoặc Mẫu câu ngoại ngữ (VD: eraser / What is it? - It\'s a pen.)' : 'Câu hỏi / Khái niệm / Công thức mặt trước'}",
      "pronunciation": "${hasForeignTts ? 'Phiên âm IPA / Pinyin / Romaji (VD: /ɪˈreɪ.zər/)' : ''}",
      "meaning": "Nghĩa tiếng Việt hoặc Đáp án mặt sau ngắn gọn, dễ nhớ",
      "example": "Câu ví dụ minh họa hoặc mẹo ghi nhớ nhanh",
      "cardType": "vocab"
    }
  ]
}
\`\`\`

QUY TẮC:
1. Bao gồm cả các từ vựng mới ("cardType": "vocab") VÀ các mẫu câu quan trọng cần học thuộc ("cardType": "sentence") hoặc khái niệm/công thức ("cardType": "concept").
2. Giữ ngôn từ trong sáng, ngắn gọn, phù hợp học sinh tiểu học.`;
}

export interface ParsedFlashcardLessonResult {
  subject: string;
  unitTitle: string;
  title: string;
  ttsLang: SupportedTtsLang;
  goal: string;
  explanation: string;
  keywords: LessonKeyword[];
  error?: string;
}

function extractJsonBlock(rawText: string): string {
  const trimmed = rawText.trim();
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    return codeBlockMatch[1].trim();
  }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

export function parseFlashcardAiResponse(
  rawText: string,
  fallbackSubject = 'Everybody Up',
  fallbackUnit = 'Unit 1'
): ParsedFlashcardLessonResult {
  if (!rawText || !rawText.trim()) {
    return {
      subject: fallbackSubject,
      unitTitle: fallbackUnit,
      title: '',
      ttsLang: inferDefaultTtsLang(fallbackSubject),
      goal: '',
      explanation: '',
      keywords: [],
      error: 'Vui lòng dán nội dung JSON từ AI vào ô.',
    };
  }

  try {
    const jsonStr = extractJsonBlock(rawText);
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    const subject =
      typeof parsed.subject === 'string' && parsed.subject.trim()
        ? parsed.subject.trim()
        : fallbackSubject;
    const unitTitle =
      typeof parsed.unitTitle === 'string' && parsed.unitTitle.trim()
        ? parsed.unitTitle.trim()
        : fallbackUnit;
    const title =
      typeof parsed.title === 'string' && parsed.title.trim()
        ? parsed.title.trim()
        : 'Bài học mới';
    const ttsLang =
      typeof parsed.ttsLang === 'string'
        ? normalizeTtsLang(parsed.ttsLang)
        : inferDefaultTtsLang(subject);
    const goal =
      typeof parsed.goal === 'string' ? parsed.goal.trim() : '';
    const explanation =
      typeof parsed.explanation === 'string' ? parsed.explanation.trim() : '';

    const rawKeywords = Array.isArray(parsed.keywords)
      ? parsed.keywords
      : Array.isArray(parsed.flashcards)
      ? parsed.flashcards
      : [];

    const keywords: LessonKeyword[] = [];
    for (const item of rawKeywords) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const term =
        typeof rec.term === 'string'
          ? rec.term.trim()
          : typeof rec.front === 'string'
          ? rec.front.trim()
          : '';
      const meaning =
        typeof rec.meaning === 'string'
          ? rec.meaning.trim()
          : typeof rec.back === 'string'
          ? rec.back.trim()
          : '';
      if (!term || !meaning) continue;

      const example =
        typeof rec.example === 'string' ? rec.example.trim() : '';
      const pronunciation =
        typeof rec.pronunciation === 'string'
          ? rec.pronunciation.trim()
          : typeof rec.ipa === 'string'
          ? rec.ipa.trim()
          : '';
      const rawCardType =
        typeof rec.cardType === 'string' ? rec.cardType.trim() : 'vocab';
      const cardType: 'vocab' | 'sentence' | 'concept' =
        rawCardType === 'sentence' || rawCardType === 'concept'
          ? rawCardType
          : 'vocab';

      keywords.push({
        term,
        meaning,
        example,
        pronunciation,
        cardType,
        ttsLang,
      });
    }

    if (keywords.length === 0) {
      return {
        subject,
        unitTitle,
        title,
        ttsLang,
        goal,
        explanation,
        keywords: [],
        error: 'Không tìm thấy thẻ Flashcard hợp lệ trong JSON (cần có term và meaning).',
      };
    }

    return {
      subject,
      unitTitle,
      title,
      ttsLang,
      goal,
      explanation,
      keywords: keywords.slice(0, 30),
    };
  } catch (err: unknown) {
    return {
      subject: fallbackSubject,
      unitTitle: fallbackUnit,
      title: '',
      ttsLang: inferDefaultTtsLang(fallbackSubject),
      goal: '',
      explanation: '',
      keywords: [],
      error:
        err instanceof Error
          ? `Lỗi đọc JSON từ AI: ${err.message}`
          : 'JSON không đúng định dạng.',
    };
  }
}

// ============================================================================
// AI Prompt & JSON Parser #2: Tạo Bài kiểm tra Trắc nghiệm (Unit Quiz / SRS Quiz)
// ============================================================================

export function buildQuizAiPrompt(params: {
  subject: string;
  unitTitle: string;
  questionCount: number;
  cards: Array<{
    term: string;
    meaning: string;
    example?: string;
    pronunciation?: string;
    bucket?: SrsBucket;
  }>;
  extraNotes?: string;
}): string {
  const { subject, unitTitle, questionCount, cards, extraNotes = '' } = params;

  const cardsText = cards
    .map((c, idx) => {
      const statusTag =
        c.bucket === 'struggling'
          ? ' [HAY QUÊN - ƯU TIÊN HỎI]'
          : c.bucket === 'due_soon'
          ? ' [SẮP QUÊN - CẦN ÔN]'
          : '';
      return `${idx + 1}. "${c.term}"${c.pronunciation ? ` (${c.pronunciation})` : ''} -> Nghĩa/Đáp án: "${c.meaning}"${c.example ? ` | Ví dụ: "${c.example}"` : ''}${statusTag}`;
    })
    .join('\n');

  return `Bạn là giáo viên biên soạn đề kiểm tra trắc nghiệm cho học sinh tiểu học trên hệ thống StudyNest.
Hãy tạo một đề kiểm tra trắc nghiệm gồm ${questionCount} câu hỏi dựa trên danh sách kiến thức / từ vựng / mẫu câu đã học dưới đây.

THÔNG TIN ĐỀ KIỂM TRA:
- Giáo trình / Môn học: "${subject}"
- Phạm vi kiểm tra: "${unitTitle}"
${extraNotes.trim() ? `- Yêu cầu thêm của người hướng dẫn: "${extraNotes.trim()}"\n` : ''}
DANH SÁCH TỪ MỚI / MẪU CÂU / KIẾN THỨC ĐÃ HỌC (${cards.length} mục):
${cardsText || '(Chưa có thẻ nào, hãy tạo câu hỏi phù hợp với chủ đề trên)'}

YÊU CẦU ĐẦU RA:
Chỉ trả về duy nhất 1 khối codeblock \`\`\`json hợp lệ theo đúng cấu trúc dưới đây:

\`\`\`json
{
  "title": "Kiểm tra trắc nghiệm: ${unitTitle}",
  "description": "Bài kiểm tra ôn tập kiến thức ${subject} - ${unitTitle}",
  "questions": [
    {
      "question": "Nội dung câu hỏi rõ ràng, phù hợp học sinh (VD: Từ 'eraser' có nghĩa là gì? hoặc Điền vào chỗ trống: It's ___ eraser.)",
      "options": [
        "Đáp án A",
        "Đáp án B",
        "Đáp án C",
        "Đáp án D"
      ],
      "correctIndex": 0,
      "explanation": "Giải thích ngắn gọn vì sao đáp án đó đúng để học sinh hiểu bài",
      "relatedTerm": "Từ gốc hoặc mẫu câu gốc nằm trong danh sách trên (VD: eraser)"
    }
  ]
}
\`\`\`

QUY TẮC:
1. Mỗi câu hỏi phải có đúng 4 lựa chọn trong mảng "options", và "correctIndex" là số nguyên từ 0 đến 3 chỉ vị trí đáp án đúng.
2. Đa dạng hóa dạng câu hỏi: hỏi nghĩa từ, điền từ vào câu, hỏi - đáp theo mẫu câu, hoặc tình huống vận dụng.
3. Ưu tiên ra câu hỏi kỹ hơn cho các mục có nhãn [HAY QUÊN] hoặc [SẮP QUÊN].
4. Trường "relatedTerm" phải khớp chính xác với từ/cụm từ gốc trong danh sách để hệ thống tự động cập nhật Đường cong quên lãng sau khi học sinh nộp bài.`;
}

export interface ParsedQuizResult {
  title: string;
  description: string;
  questions: QuizQuestion[];
  error?: string;
}

export function parseQuizAiResponse(
  rawText: string,
  fallbackTitle = 'Bài kiểm tra trắc nghiệm'
): ParsedQuizResult {
  if (!rawText || !rawText.trim()) {
    return {
      title: fallbackTitle,
      description: '',
      questions: [],
      error: 'Vui lòng dán nội dung JSON đề kiểm tra từ AI vào ô.',
    };
  }

  try {
    const jsonStr = extractJsonBlock(rawText);
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    const title =
      typeof parsed.title === 'string' && parsed.title.trim()
        ? parsed.title.trim()
        : fallbackTitle;
    const description =
      typeof parsed.description === 'string'
        ? parsed.description.trim()
        : '';

    const rawQuestions = Array.isArray(parsed.questions)
      ? parsed.questions
      : [];

    const questions: QuizQuestion[] = [];
    rawQuestions.forEach((item, idx) => {
      if (!item || typeof item !== 'object') return;
      const rec = item as Record<string, unknown>;
      const question =
        typeof rec.question === 'string' ? rec.question.trim() : '';
      if (!question) return;

      const rawOpts = Array.isArray(rec.options) ? rec.options : [];
      const options = rawOpts
        .map((o) => String(o ?? '').trim())
        .filter((o) => o.length > 0)
        .slice(0, 4);

      while (options.length < 4) {
        options.push(`Phương án ${options.length + 1}`);
      }

      const rawCorrect = Number(rec.correctIndex);
      const correctIndex =
        Number.isInteger(rawCorrect) && rawCorrect >= 0 && rawCorrect <= 3
          ? rawCorrect
          : 0;

      const explanation =
        typeof rec.explanation === 'string' ? rec.explanation.trim() : '';
      const relatedTerm =
        typeof rec.relatedTerm === 'string' ? rec.relatedTerm.trim() : '';

      questions.push({
        id: `q_${idx + 1}_${Date.now()}`,
        question,
        options,
        correctIndex,
        explanation,
        relatedTerm,
      });
    });

    if (questions.length === 0) {
      return {
        title,
        description,
        questions: [],
        error: 'Không tìm thấy câu hỏi trắc nghiệm hợp lệ trong JSON.',
      };
    }

    return {
      title,
      description,
      questions,
    };
  } catch (err: unknown) {
    return {
      title: fallbackTitle,
      description: '',
      questions: [],
      error:
        err instanceof Error
          ? `Lỗi đọc JSON đề trắc nghiệm: ${err.message}`
          : 'JSON không đúng định dạng.',
    };
  }
}

