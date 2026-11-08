import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Sparkles,
  Turtle,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from 'lucide-react';
import { ModalPortal } from '@/components/ui/ModalPortal';
import type {
  Lesson,
  LessonKeyword,
  QuizQuestion,
  SrsCardProgress,
  SupportedTtsLang,
} from '@/types/domain';
import {
  classifySrsCardBucket,
  computeNextSrsState,
  inferDefaultTtsLang,
  makeSrsCardKey,
  speakTextWithTts,
  type SrsBucket,
  type SrsReviewRating,
} from '@/lib/studyAiAndSrs';

export function SrsStatusBadge({
  bucket,
  nextReviewDate,
}: {
  bucket: SrsBucket;
  nextReviewDate?: string;
}) {
  if (bucket === 'struggling') {
    return (
      <span
        title={nextReviewDate ? `Hẹn ôn: ${nextReviewDate}` : undefined}
        className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800 dark:bg-rose-950/70 dark:text-rose-300"
      >
        <span className="h-2 w-2 rounded-full bg-rose-500" />
        Hay quên
      </span>
    );
  }
  if (bucket === 'due_soon') {
    return (
      <span
        title={nextReviewDate ? `Hẹn ôn: ${nextReviewDate}` : undefined}
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 dark:bg-amber-950/70 dark:text-amber-300"
      >
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        Sắp quên / Cần ôn
      </span>
    );
  }
  if (bucket === 'mastered') {
    return (
      <span
        title={nextReviewDate ? `Hẹn ôn: ${nextReviewDate}` : undefined}
        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        Đã nhớ kỹ
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      <span className="h-2 w-2 rounded-full bg-slate-400" />
      Mới học
    </span>
  );
}

export interface StudyDeckCard {
  lessonId: string;
  subject: string;
  unitTitle: string;
  keyword: LessonKeyword;
  ttsLang: SupportedTtsLang;
}

export function FlashcardStudyModal({
  title,
  cards,
  srsStates,
  todayStr,
  onClose,
  onSaveProgress,
}: {
  title: string;
  cards: StudyDeckCard[];
  srsStates: Record<string, SrsCardProgress>;
  todayStr: string;
  onClose: () => void;
  onSaveProgress: (params: {
    updatedSrsPatch: Record<string, SrsCardProgress>;
    summaryNote: string;
  }) => Promise<void>;
}) {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [flipped, setFlipped] = useState<boolean>(false);
  const [autoSpeechEnabled, setAutoSpeechEnabled] = useState<boolean>(true);
  const [localPatch, setLocalPatch] = useState<Record<string, SrsCardProgress>>(
    {}
  );
  const [ratingsByKey, setRatingsByKey] = useState<
    Record<string, SrsReviewRating>
  >({});
  const [finished, setFinished] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const currentCard = cards[currentIndex] || cards[0];
  const cardKey = currentCard
    ? makeSrsCardKey(currentCard.lessonId, currentCard.keyword.term)
    : '';
  const effectiveSrs = cardKey ? localPatch[cardKey] || srsStates[cardKey] : undefined;
  const currentBucket = classifySrsCardBucket(effectiveSrs, todayStr);
  const activeTtsLang = currentCard
    ? currentCard.keyword.ttsLang !== undefined
      ? currentCard.keyword.ttsLang
      : currentCard.ttsLang
    : '';

  // Dừng phát âm khi component unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Tự động phát âm khi: mở flashcard lần đầu, chuyển thẻ, hoặc lật thẻ (nếu có âm thanh và đang bật chế độ đọc)
  useEffect(() => {
    if (!autoSpeechEnabled || finished || !currentCard || !activeTtsLang) {
      return;
    }

    // Nếu lật sang mặt sau và có câu ví dụ, đọc câu ví dụ; nếu không thì đọc từ chính
    const textToSpeak =
      flipped && currentCard.keyword.example?.trim()
        ? currentCard.keyword.example.trim()
        : currentCard.keyword.term?.trim();

    if (textToSpeak) {
      const timer = setTimeout(() => {
        speakTextWithTts(textToSpeak, activeTtsLang, false);
      }, 140);

      return () => clearTimeout(timer);
    }
  }, [
    currentIndex,
    flipped,
    autoSpeechEnabled,
    finished,
    currentCard,
    activeTtsLang,
  ]);

  if (cards.length === 0) return null;

  const handleRateCard = (rating: SrsReviewRating) => {
    const nextState = computeNextSrsState({
      prev: effectiveSrs,
      rating,
      todayStr,
      lessonId: currentCard.lessonId,
      subject: currentCard.subject,
      unitTitle: currentCard.unitTitle,
      keyword: currentCard.keyword,
      lessonTtsLang: activeTtsLang,
    });

    const nextPatch = {
      ...localPatch,
      [cardKey]: nextState,
    };
    const nextRatings = {
      ...ratingsByKey,
      [cardKey]: rating,
    };
    setLocalPatch(nextPatch);
    setRatingsByKey(nextRatings);
    setFlipped(false);

    if (currentIndex + 1 < cards.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setFinished(true);
    }
  };

  const handleClose = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    onClose();
  };

  const handleCompleteSession = async () => {
    setSaving(true);
    try {
      const easyCount = Object.values(ratingsByKey).filter(
        (r) => r === 'easy'
      ).length;
      const goodCount = Object.values(ratingsByKey).filter(
        (r) => r === 'good'
      ).length;
      const forgotCount = Object.values(ratingsByKey).filter(
        (r) => r === 'forgot'
      ).length;

      const summaryNote = `Đã ôn xong ${cards.length} thẻ Flashcard (Nhớ kỹ: ${easyCount}, Tạm nhớ: ${goodCount}, Cần ôn lại: ${forgotCount}).`;
      await onSaveProgress({
        updatedSrsPatch: localPatch,
        summaryNote,
      });
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="my-6 w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              {currentCard.subject} • {currentCard.unitTitle}
            </span>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              {title}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {activeTtsLang && (
              <button
                type="button"
                onClick={() => setAutoSpeechEnabled((prev) => !prev)}
                title={autoSpeechEnabled ? 'Tắt tự động đọc' : 'Bật tự động đọc phát âm'}
                className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                  autoSpeechEnabled
                    ? 'border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'border border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {autoSpeechEnabled ? (
                  <>
                    <Volume2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Tự động đọc: Bật</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="h-3.5 w-3.5" />
                    <span>Tự động đọc: Tắt</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleClose}
              aria-label="Đóng"
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {finished ? (
          <div className="py-8 text-center space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <Sparkles className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Tuyệt vời! Em đã hoàn thành bộ Flashcard ({cards.length} thẻ)
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Hệ thống đã tính toán lịch hẹn ôn lại theo Đường cong quên lãng cho từng thẻ.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300">
                  {
                    Object.values(ratingsByKey).filter((r) => r === 'easy')
                      .length
                  }
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Nhớ kỹ (+14 ngày)
                </div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                <div className="text-xl font-extrabold text-amber-700 dark:text-amber-300">
                  {
                    Object.values(ratingsByKey).filter((r) => r === 'good')
                      .length
                  }
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-400">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Tạm nhớ (+3 ngày)
                </div>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3 dark:border-rose-900 dark:bg-rose-950/30">
                <div className="text-xl font-extrabold text-rose-700 dark:text-rose-300">
                  {
                    Object.values(ratingsByKey).filter((r) => r === 'forgot')
                      .length
                  }
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-800 dark:text-rose-400">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Cần ôn (+1 ngày)
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCurrentIndex(0);
                  setFlipped(false);
                  setFinished(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                <RotateCw className="h-4 w-4" />
                Lật ôn lại lần nữa
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleCompleteSession()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {saving ? 'Đang lưu tiến độ...' : 'Hoàn thành & Lưu kết quả'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {/* Thanh tiến độ */}
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>
                Thẻ {currentIndex + 1} / {cards.length}
              </span>
              <SrsStatusBadge
                bucket={currentBucket}
                nextReviewDate={effectiveSrs?.nextReviewDate}
              />
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{
                  width: `${Math.round(((currentIndex + 1) / cards.length) * 100)}%`,
                }}
              />
            </div>

            {/* Thẻ Flashcard chính */}
            <div
              onClick={() => setFlipped((f) => !f)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setFlipped((f) => !f);
                }
              }}
              className="group relative min-h-[250px] cursor-pointer rounded-3xl border-2 border-emerald-200/90 bg-gradient-to-br from-emerald-50/60 via-white to-sky-50/40 p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-sm transition hover:border-emerald-400 dark:border-emerald-900/70 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/30"
            >
              <span className="absolute top-3.5 left-4 rounded-lg bg-white/90 px-2.5 py-1 text-[11px] font-bold text-slate-500 shadow-2xs dark:bg-slate-800 dark:text-slate-300">
                {flipped ? 'Mặt sau (Nghĩa / Đáp án)' : 'Mặt trước (Từ / Mẫu câu / Câu hỏi)'}
              </span>

              <span className="absolute top-3.5 right-4 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                <RotateCw className="h-3.5 w-3.5" />
                Bấm vào thẻ để lật
              </span>

              <div className="mt-4 max-w-lg space-y-3">
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                  {currentCard.keyword.term}
                </div>

                {currentCard.keyword.pronunciation && (
                  <div className="text-sm font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                    {currentCard.keyword.pronunciation}
                  </div>
                )}

                {/* Nút phát âm ngoại ngữ (chỉ hiện khi có ttsLang) */}
                {activeTtsLang && (
                  <div
                    className="flex flex-wrap items-center justify-center gap-2 pt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        speakTextWithTts(
                          currentCard.keyword.term,
                          activeTtsLang,
                          false
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                    >
                      <Volume2 className="h-4 w-4" />
                      Nghe phát âm ({activeTtsLang})
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        speakTextWithTts(
                          currentCard.keyword.term,
                          activeTtsLang,
                          true
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-800 dark:text-emerald-300"
                    >
                      <Turtle className="h-4 w-4" />
                      Đọc chậm
                    </button>
                  </div>
                )}

                {flipped && (
                  <div className="mt-4 border-t border-emerald-200/80 pt-4 space-y-2 animate-fadeIn dark:border-emerald-900/60">
                    <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300">
                      {currentCard.keyword.meaning}
                    </div>
                    {currentCard.keyword.example && (
                      <div className="rounded-2xl bg-white/90 p-3 text-xs sm:text-sm text-slate-700 border border-slate-200/80 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
                        <strong>Ví dụ / Ghi chú:</strong>{' '}
                        {currentCard.keyword.example}
                        {activeTtsLang && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              speakTextWithTts(
                                currentCard.keyword.example,
                                activeTtsLang,
                                false
                              );
                            }}
                            className="ml-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                          >
                            <Volume2 className="h-3.5 w-3.5" /> Đọc câu
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 3 Nút tự đánh giá theo Đường cong quên lãng */}
            <div className="space-y-2">
              <div className="text-center text-xs font-bold text-slate-500">
                Đánh giá mức độ nhớ của em để hẹn ngày ôn lại (Đường cong quên lãng):
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => handleRateCard('forgot')}
                  className="flex flex-col items-center rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-rose-900 transition hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
                >
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Chưa thuộc / Hay quên
                  </span>
                  <span className="mt-0.5 text-[11px] opacity-80">
                    Ôn lại vào ngày mai (+1 ngày)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRateCard('good')}
                  className="flex flex-col items-center rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-amber-950 transition hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
                >
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Tạm nhớ
                  </span>
                  <span className="mt-0.5 text-[11px] opacity-80">
                    Ôn lại sau 3 – 7 ngày
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRateCard('easy')}
                  className="flex flex-col items-center rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-emerald-950 transition hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
                >
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Đã nhớ kỹ
                  </span>
                  <span className="mt-0.5 text-[11px] opacity-80">
                    Ôn lại sau 14 – 30 ngày
                  </span>
                </button>
              </div>
            </div>

            {/* Điều hướng qua lại giữa các thẻ */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => {
                  setFlipped(false);
                  setCurrentIndex((i) => Math.max(0, i - 1));
                }}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300"
              >
                <ChevronLeft className="h-4 w-4" /> Thẻ trước
              </button>

              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                className="rounded-xl bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
              >
                {flipped ? 'Ẩn đáp án' : 'Lật xem nghĩa / đáp án'}
              </button>

              <button
                type="button"
                disabled={currentIndex >= cards.length - 1}
                onClick={() => {
                  setFlipped(false);
                  setCurrentIndex((i) => Math.min(cards.length - 1, i + 1));
                }}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300"
              >
                Thẻ tiếp <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}

export function QuizTakeModal({
  title,
  subject,
  unitTitle,
  ttsLang,
  questions,
  lessons,
  srsStates,
  todayStr,
  onClose,
  onSubmitQuizResult,
}: {
  title: string;
  subject: string;
  unitTitle?: string;
  ttsLang?: SupportedTtsLang;
  questions: QuizQuestion[];
  lessons: Lesson[];
  srsStates: Record<string, SrsCardProgress>;
  todayStr: string;
  onClose: () => void;
  onSubmitQuizResult: (params: {
    score: number;
    total: number;
    studentNote: string;
    updatedSrsPatch: Record<string, SrsCardProgress>;
  }) => Promise<void>;
}) {
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, number>
  >({});
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const effectiveTtsLang = inferDefaultTtsLang(subject, ttsLang);

  const correctCount = questions.reduce((acc, q) => {
    return selectedAnswers[q.id] === q.correctIndex ? acc + 1 : acc;
  }, 0);

  const handleFinishQuiz = async () => {
    setSubmitted(true);
    setSaving(true);
    try {
      // Tự động cập nhật Đường cong quên lãng (SRS) dựa trên câu trả lời Đúng / Sai
      const srsPatch: Record<string, SrsCardProgress> = {};
      const wrongTerms: string[] = [];

      for (const q of questions) {
        const isCorrect = selectedAnswers[q.id] === q.correctIndex;
        const related = q.relatedTerm?.trim();
        if (!isCorrect && related) {
          wrongTerms.push(related);
        }
        if (!related) continue;

        // Tìm thẻ gốc trong danh sách bài học để cập nhật SRS
        let matchedLesson: Lesson | undefined;
        let matchedKw: LessonKeyword | undefined;
        for (const les of lessons) {
          const found = les.keywords.find(
            (k) => k.term.trim().toLowerCase() === related.toLowerCase()
          );
          if (found) {
            matchedLesson = les;
            matchedKw = found;
            break;
          }
        }

        const lessonId = matchedLesson?.id || 'quiz_general';
        const kw: LessonKeyword = matchedKw || {
          term: related,
          meaning: q.options[q.correctIndex] || '',
          example: q.explanation || '',
          ttsLang: effectiveTtsLang,
        };
        const key = makeSrsCardKey(lessonId, kw.term);
        const prev = srsPatch[key] || srsStates[key];

        srsPatch[key] = computeNextSrsState({
          prev,
          rating: isCorrect ? 'good' : 'forgot',
          todayStr,
          lessonId,
          subject: matchedLesson?.subject || subject || 'Chung',
          unitTitle: matchedLesson?.unitTitle || unitTitle || 'Chung',
          keyword: kw,
          lessonTtsLang: effectiveTtsLang,
        });
      }

      const wrongSummary =
        wrongTerms.length > 0
          ? ` • Cần ôn lại: ${wrongTerms.slice(0, 5).join(', ')}`
          : ' • Làm đúng toàn bộ!';
      const studentNote = `Kết quả trắc nghiệm: ${correctCount}/${questions.length} câu đúng${wrongSummary}`;

      await onSubmitQuizResult({
        score: correctCount,
        total: questions.length,
        studentNote,
        updatedSrsPatch: srsPatch,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="my-6 w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              {subject} {unitTitle ? `• ${unitTitle}` : ''}
            </span>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              {title} ({questions.length} câu)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {submitted && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 flex flex-wrap items-center justify-between gap-3 dark:border-emerald-900 dark:bg-emerald-950/40">
            <div>
              <div className="text-base font-extrabold text-slate-900 dark:text-white">
                Kết quả của em: {correctCount} / {questions.length} câu đúng (
                {Math.round((correctCount / (questions.length || 1)) * 100)}%)
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Các từ/mẫu câu làm sai đã tự động được xếp vào nhóm Hay quên để nhắc em ôn lại vào ngày mai.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
            >
              Đóng & Xem nhiệm vụ
            </button>
          </div>
        )}

        <div className="mt-4 space-y-5">
          {questions.map((q, qIdx) => {
            const chosen = selectedAnswers[q.id];
            const isCorrect = chosen === q.correctIndex;

            return (
              <div
                key={q.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                    Câu {qIdx + 1}: {q.question}
                  </div>
                  {effectiveTtsLang && q.relatedTerm && (
                    <button
                      type="button"
                      onClick={() =>
                        speakTextWithTts(q.relatedTerm!, effectiveTtsLang, false)
                      }
                      title={`Nghe phát âm: ${q.relatedTerm}`}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      Nghe
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {q.options.map((opt, oIdx) => {
                    const isSelected = chosen === oIdx;
                    let optionStyle =
                      'border-slate-200 bg-white text-slate-800 hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';

                    if (!submitted && isSelected) {
                      optionStyle =
                        'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/40 dark:bg-emerald-950/60 dark:text-emerald-200';
                    } else if (submitted) {
                      if (oIdx === q.correctIndex) {
                        optionStyle =
                          'border-emerald-600 bg-emerald-100/90 text-emerald-950 font-extrabold dark:bg-emerald-950/70 dark:text-emerald-200';
                      } else if (isSelected && oIdx !== q.correctIndex) {
                        optionStyle =
                          'border-rose-500 bg-rose-100/80 text-rose-900 line-through dark:bg-rose-950/60 dark:text-rose-200';
                      }
                    }

                    return (
                      <button
                        key={oIdx}
                        type="button"
                        disabled={submitted}
                        onClick={() =>
                          setSelectedAnswers((prev) => ({
                            ...prev,
                            [q.id]: oIdx,
                          }))
                        }
                        className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-xs sm:text-sm font-semibold transition ${optionStyle}`}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        <span className="flex-1">{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {submitted && (
                  <div
                    className={`rounded-xl p-3 text-xs ${
                      isCorrect
                        ? 'bg-emerald-100/70 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
                        : 'bg-rose-100/70 text-rose-900 dark:bg-rose-950/50 dark:text-rose-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-extrabold">
                      {isCorrect ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          Chính xác!
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-rose-600" />
                          Chưa đúng (Đáp án đúng là{' '}
                          {String.fromCharCode(65 + q.correctIndex)}:{' '}
                          {q.options[q.correctIndex]})
                        </>
                      )}
                    </div>
                    {q.explanation && (
                      <p className="mt-1 opacity-90">
                        <strong>Giải thích:</strong> {q.explanation}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!submitted && (
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500">
              Đã chọn {Object.keys(selectedAnswers).length} / {questions.length} câu
            </span>
            <button
              type="button"
              disabled={saving || Object.keys(selectedAnswers).length === 0}
              onClick={() => void handleFinishQuiz()}
              className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Đang chấm điểm & lưu...' : 'Nộp bài kiểm tra'}
            </button>
          </div>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}

