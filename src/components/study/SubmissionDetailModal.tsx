import { useEffect, useState } from 'react';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Layers,
  Sparkles,
  Star,
  Turtle,
  Volume2,
  X,
} from 'lucide-react';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { UserAvatar } from '@/components/ui/ThemeBadges';
import type {
  Assignment,
  ClassMember,
  LearningRecord,
  Lesson,
  LessonKeyword,
  QuizQuestion,
  SrsCardProgress,
  StudyClass,
} from '@/types/domain';
import { formatVietnameseDate, getTodayAndTomorrow } from '@/lib/date';
import {
  classifySrsCardBucket,
  inferDefaultTtsLang,
  makeSrsCardKey,
  speakTextWithTts,
} from '@/lib/studyAiAndSrs';
import { getStudentSrsStates } from '@/services/studyNestService';
import { SrsStatusBadge } from '@/components/study/InteractiveStudyModals';

interface SubmissionDetailModalProps {
  record: LearningRecord;
  studyClass: StudyClass;
  assignment?: Assignment | null;
  lesson?: Lesson | null;
  student?: ClassMember | null;
  isInstructorOrOwner: boolean;
  onClose: () => void;
  onConfirm?: (
    record: LearningRecord,
    stars: number,
    comment: string
  ) => Promise<void>;
  isConfirming?: boolean;
}

export function SubmissionDetailModal({
  record,
  studyClass,
  assignment,
  lesson,
  student,
  isInstructorOrOwner,
  onClose,
  onConfirm,
  isConfirming = false,
}: SubmissionDetailModalProps) {
  const [stars, setStars] = useState<number>(record.starsAwarded > 0 ? record.starsAwarded : 3);
  const [comment, setComment] = useState<string>(
    record.instructorComment || 'Làm bài rất tốt, tiếp tục phát huy nhé!'
  );
  const [studentSrs, setStudentSrs] = useState<Record<string, SrsCardProgress>>({});
  const [loadingSrs, setLoadingSrs] = useState<boolean>(false);

  const { today } = getTodayAndTomorrow(new Date(), studyClass.timezone);

  const isFlashcard =
    assignment?.taskType === 'flashcard' ||
    record.title.toLowerCase().includes('flashcard') ||
    record.studentNote.toLowerCase().includes('flashcard') ||
    record.studentNote.toLowerCase().includes('thẻ');

  const isQuiz =
    assignment?.taskType === 'quiz' ||
    typeof record.quizScore === 'number' ||
    record.title.toLowerCase().includes('trắc nghiệm') ||
    record.title.toLowerCase().includes('quiz');

  // Lấy danh sách thẻ Flashcard từ assignment hoặc lesson
  const flashcardList: LessonKeyword[] =
    assignment?.flashcards && assignment.flashcards.length > 0
      ? assignment.flashcards
      : lesson?.keywords && lesson.keywords.length > 0
      ? lesson.keywords
      : [];

  // Lấy danh sách câu hỏi trắc nghiệm từ assignment
  const quizQuestions: QuizQuestion[] = assignment?.quizQuestions || [];

  const ttsLang =
    assignment?.ttsLang ||
    lesson?.ttsLang ||
    inferDefaultTtsLang(assignment?.subject || lesson?.subject || '');

  // Load SRS của học sinh này nếu là bài Flashcard
  useEffect(() => {
    if (!isFlashcard || !record.studentUid || !studyClass.id) return;
    let isCancelled = false;
    setLoadingSrs(true);

    getStudentSrsStates(studyClass.id, record.studentUid)
      .then((data) => {
        if (!isCancelled) {
          setStudentSrs(data);
        }
      })
      .catch((err) => {
        console.error('Lỗi khi tải dữ liệu SRS của học sinh:', err);
      })
      .finally(() => {
        if (!isCancelled) setLoadingSrs(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isFlashcard, record.studentUid, studyClass.id]);

  const isPending = record.instructorStatus === 'unverified';

  // Tính tỷ lệ điểm Quiz nếu có
  const quizScore = record.quizScore;
  const quizTotal = record.quizTotal || quizQuestions.length;
  const quizPercentage =
    typeof quizScore === 'number' && quizTotal > 0
      ? Math.round((quizScore / quizTotal) * 100)
      : null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="relative flex flex-col w-full max-w-3xl max-h-[92vh] rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Header Modal */}
          <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-5 dark:border-slate-800 dark:bg-slate-850/80">
            <div className="flex items-center gap-3">
              <UserAvatar
                name={record.studentName}
                avatarUrl={student?.avatarUrl}
                size="md"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {record.studentName}
                  </h3>
                  {isFlashcard ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      <Layers className="h-3 w-3" />
                      Bộ Flashcard
                    </span>
                  ) : isQuiz ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                      <ClipboardCheck className="h-3 w-3" />
                      Trắc nghiệm
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                      <BookOpen className="h-3 w-3" />
                      Nhiệm vụ
                    </span>
                  )}

                  {isPending ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                      <Clock className="h-3 w-3" />
                      Chờ xác nhận
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                      Đã tặng +{record.starsAwarded} sao
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {record.title}
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatVietnameseDate(record.date, false)}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body Modal: Chi tiết bài làm */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Lời nhắn báo cáo nộp bài của học sinh */}
            <div
              className={`rounded-2xl p-4 text-xs ${
                isFlashcard
                  ? 'border border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200'
                  : isQuiz
                  ? 'border border-violet-200 bg-violet-50/70 text-violet-950 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-200'
                  : 'border border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5 mb-1.5 text-sm">
                <Sparkles className="h-4 w-4" />
                <span>Báo cáo kết quả của học sinh</span>
              </div>
              <p className="text-sm font-medium leading-relaxed">
                “{record.studentNote || 'Học sinh không để lại ghi chú.'}”
              </p>
            </div>

            {/* PHẦN 1: BÀI TRẮC NGHIỆM */}
            {isQuiz && (
              <div className="space-y-4">
                {/* Thống kê điểm số */}
                {typeof quizScore === 'number' && (
                  <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                        Điểm bài kiểm tra
                      </span>
                      <span className="text-base font-black text-violet-800 dark:text-violet-200">
                        {quizScore} / {quizTotal} câu đúng ({quizPercentage}%)
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-violet-100 dark:bg-violet-950">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          (quizPercentage ?? 0) >= 80
                            ? 'bg-emerald-500'
                            : (quizPercentage ?? 0) >= 50
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${quizPercentage ?? 0}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Danh sách các câu hỏi trong đề */}
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                    Đề bài & Đáp án chi tiết ({quizQuestions.length} câu)
                  </h4>

                  {quizQuestions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-slate-800">
                      Đề trắc nghiệm này không lưu kèm bộ câu hỏi chi tiết. Kết quả bài làm được ghi nhận theo điểm số báo cáo ở trên.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {quizQuestions.map((q, qIdx) => (
                        <div
                          key={q.id || qIdx}
                          className="rounded-2xl border border-slate-200 bg-white p-4 text-xs dark:border-slate-800 dark:bg-slate-850"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-bold text-slate-900 dark:text-white text-sm">
                              <span className="text-violet-600 dark:text-violet-400 mr-1.5">
                                Câu {qIdx + 1}:
                              </span>
                              {q.question}
                            </div>
                            {q.relatedTerm && (
                              <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {q.relatedTerm}
                              </span>
                            )}
                          </div>

                          {/* 4 phương án */}
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {q.options.map((opt, optIdx) => {
                              const isCorrect = optIdx === q.correctIndex;
                              const optLetter = String.fromCharCode(65 + optIdx); // A, B, C, D
                              return (
                                <div
                                  key={optIdx}
                                  className={`flex items-center gap-2 rounded-xl border p-2.5 transition ${
                                    isCorrect
                                      ? 'border-emerald-400 bg-emerald-50/80 font-bold text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
                                      : 'border-slate-200 bg-slate-50/50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300'
                                  }`}
                                >
                                  <span
                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                                      isCorrect
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                                    }`}
                                  >
                                    {optLetter}
                                  </span>
                                  <span className="flex-1">{opt}</span>
                                  {isCorrect && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      Đúng
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Giải thích câu hỏi */}
                          {q.explanation && (
                            <div className="mt-2.5 rounded-xl bg-slate-50 p-2.5 text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                Giải thích:{' '}
                              </span>
                              {q.explanation}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PHẦN 2: BỘ FLASHCARD */}
            {isFlashcard && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Danh sách thẻ trong bài ({flashcardList.length} thẻ)
                  </h4>
                  {loadingSrs && (
                    <span className="text-xs text-slate-400">Đang tải lịch sử nhớ SRS...</span>
                  )}
                </div>

                {flashcardList.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-slate-800">
                    Bài học này không chứa danh sách từ khóa cố định. Học sinh đã hoàn thành ôn tập theo ghi chú ở trên.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {flashcardList.map((card, idx) => {
                      const lessonIdForSrs = assignment?.lessonId || lesson?.id || '';
                      const cardKey = lessonIdForSrs
                        ? makeSrsCardKey(lessonIdForSrs, card.term)
                        : '';
                      const srsProg = studentSrs[cardKey];
                      const srsBucket = srsProg
                        ? classifySrsCardBucket(srsProg, today)
                        : 'new';

                      const cardLang = card.ttsLang || ttsLang;

                      return (
                        <div
                          key={idx}
                          className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-850"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-base font-extrabold text-slate-900 dark:text-white">
                                  {card.term}
                                </span>
                                {card.pronunciation && (
                                  <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    /{card.pronunciation}/
                                  </span>
                                )}
                              </div>

                              <SrsStatusBadge
                                bucket={srsBucket}
                                nextReviewDate={srsProg?.nextReviewDate}
                              />
                            </div>

                            <p className="mt-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                              {card.meaning}
                            </p>

                            {card.example && (
                              <p className="mt-1.5 text-[11px] italic text-slate-500 dark:text-slate-400">
                                “{card.example}”
                              </p>
                            )}
                          </div>

                          {/* Nút phát âm Web Speech API */}
                          {cardLang && (
                            <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                              <button
                                type="button"
                                onClick={() => speakTextWithTts(card.term, cardLang, false)}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 transition"
                              >
                                <Volume2 className="h-3.5 w-3.5" />
                                <span>Phát âm</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => speakTextWithTts(card.term, cardLang, true)}
                                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition"
                              >
                                <Turtle className="h-3.5 w-3.5" />
                                <span>Chậm</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* PHẦN 3: NHIỆM VỤ THƯỜNG KHÔNG PHẢI QUIZ/FLASHCARD */}
            {!isQuiz && !isFlashcard && assignment && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs dark:border-slate-800 dark:bg-slate-850 space-y-2">
                <div className="font-bold text-slate-900 dark:text-white text-sm">
                  Yêu cầu nhiệm vụ
                </div>
                <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {assignment.description || 'Không có mô tả chi tiết.'}
                </p>
                <div className="mt-3 flex items-center gap-4 text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span>Hạn nộp: {formatVietnameseDate(assignment.dueDate, false)}</span>
                  <span>•</span>
                  <span>Thưởng: tối đa {assignment.starsReward} sao</span>
                </div>
              </div>
            )}

            {/* PHẦN 4: ĐÁNH GIÁ CỦA GIÁO VIÊN */}
            {record.instructorStatus === 'confirmed' ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Đánh giá của bạn
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                    +{record.starsAwarded} sao
                  </span>
                </div>
                <p className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                  “{record.instructorComment || 'Đã xác nhận hoàn thành.'}”
                </p>
                {record.confirmedAt && (
                  <p className="mt-2 text-[10px] text-slate-400">
                    Xác nhận lúc {formatVietnameseDate(record.date, false)}
                  </p>
                )}
              </div>
            ) : isInstructorOrOwner && onConfirm ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-900/50 dark:bg-amber-950/20 space-y-3">
                <div className="font-bold text-xs uppercase tracking-wider text-amber-900 dark:text-amber-300">
                  Duyệt & Tặng sao cho học sinh
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Số sao thưởng:
                    </label>
                    <select
                      value={stars}
                      onChange={(e) => setStars(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      {[1, 2, 3, 4, 5].map((s) => (
                        <option key={s} value={s}>
                          Thưởng +{s} sao
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-8">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Lời nhận xét khích lệ:
                    </label>
                    <input
                      type="text"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="VD: Làm bài rất tốt, tiếp tục phát huy nhé!..."
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    disabled={isConfirming}
                    onClick={async () => {
                      await onConfirm(record, stars, comment);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-xs transition"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{isConfirming ? 'Đang lưu...' : 'Xác nhận & Tặng sao'}</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Footer Modal */}
          <div className="flex items-center justify-end border-t border-slate-200 bg-slate-50 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-850">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
