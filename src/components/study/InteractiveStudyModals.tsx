import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  PartyPopper,
  RotateCw,
  Sparkles,
  Turtle,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from 'lucide-react';
import { ModalPortal } from '@/components/ui/ModalPortal';
import {
  triggerEncouragingFeedbackBurst,
  triggerGoodFeedbackBurst,
  triggerGrandConfetti,
  triggerMiniConfetti,
} from '@/lib/confetti';
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
  detectTextTtsLang,
  inferDefaultTtsLang,
  isVietnameseText,
  makeSrsCardKey,
  speakTextWithTts,
  type SrsBucket,
  type SrsReviewRating,
} from '@/lib/studyAiAndSrs';

export function SrsStatusBadge({
  bucket,
  nextReviewDate,
  rating,
}: {
  bucket?: SrsBucket;
  nextReviewDate?: string;
  rating?: SrsReviewRating;
}) {
  // Nếu có đánh giá trực tiếp từ học sinh (rating)
  if (rating === 'forgot') {
    return (
      <span
        title={nextReviewDate ? `Hẹn ôn: ${nextReviewDate}` : undefined}
        className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800 dark:bg-rose-950/70 dark:text-rose-300"
      >
        <span className="h-2 w-2 rounded-full bg-rose-500" />
        Chưa thuộc
      </span>
    );
  }
  if (rating === 'good') {
    return (
      <span
        title={nextReviewDate ? `Hẹn ôn: ${nextReviewDate}` : undefined}
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 dark:bg-amber-950/70 dark:text-amber-300"
      >
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        Tạm nhớ
      </span>
    );
  }
  if (rating === 'easy') {
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

  // Fallback theo bucket tích lũy của SRS
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
        Tạm nhớ
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

  const [clickedRating, setClickedRating] = useState<SrsReviewRating | null>(
    null
  );
  const [cheerFeedback, setCheerFeedback] = useState<{
    text: string;
    pillClass: string;
    emoji: string;
  } | null>(null);
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev' | null>(
    null
  );

  // Kích hoạt pháo giấy chúc mừng rực rỡ khi hoàn thành toàn bộ bài học
  useEffect(() => {
    if (finished) {
      triggerGrandConfetti();
    }
  }, [finished]);

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

  // Tự động phát âm từ/mẫu câu chính ở mặt trước khi mở flashcard hoặc chuyển thẻ
  useEffect(() => {
    // Chỉ tự động đọc từ/mẫu câu ngoại ngữ ở mặt trước; mặt sau để học sinh nhìn nghĩa và ghi chú
    if (
      !autoSpeechEnabled ||
      finished ||
      !currentCard ||
      !activeTtsLang ||
      flipped
    ) {
      return;
    }

    const textToSpeak = currentCard.keyword.term?.trim();
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

  const handleRateCard = (
    rating: SrsReviewRating,
    event?: React.MouseEvent
  ) => {
    setClickedRating(rating);

    const origin = event
      ? { x: event.clientX, y: event.clientY }
      : undefined;

    // Kích hoạt hiệu ứng Chibi Reaction Emoji bay lên cho từng trường hợp (Bộ Ý Tưởng 4)
    if (rating === 'easy') {
      triggerMiniConfetti(origin);
      setCheerFeedback({
        text: 'Xuất sắc! Thuộc làu làu rồi!',
        pillClass: 'bg-emerald-600 text-white shadow-emerald-500/30',
        emoji: '🏆',
      });
    } else if (rating === 'good') {
      triggerGoodFeedbackBurst(origin);
      setCheerFeedback({
        text: 'Giỏi lắm nè! Sắp thuộc làu rồi!',
        pillClass: 'bg-amber-500 text-white shadow-amber-500/30',
        emoji: '⭐',
      });
    } else if (rating === 'forgot') {
      triggerEncouragingFeedbackBurst(origin);
      setCheerFeedback({
        text: 'Không sao cả, ngày mai nhớ ngay nha!',
        pillClass: 'bg-rose-500 text-white shadow-rose-500/30',
        emoji: '🌱',
      });
    }

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

    // Chờ 550ms để các emoji chibi nảy lên và học sinh đọc lời khen rồi chuyển thẻ
    setTimeout(() => {
      setClickedRating(null);
      setCheerFeedback(null);
      setFlipped(false);

      if (currentIndex + 1 < cards.length) {
        setSlideDirection('next');
        setCurrentIndex((prev) => prev + 1);
      } else {
        setFinished(true);
      }
    }, 550);
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
                className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold transition active:scale-95 ${
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
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 active:scale-95 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {finished ? (
          <div className="py-8 text-center space-y-5 animate-card-next">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 shadow-inner dark:bg-emerald-950 dark:text-emerald-400 animate-bounce">
              <PartyPopper className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                Tuyệt vời! Em đã hoàn thành bộ Flashcard ({cards.length} thẻ)
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Hệ thống đã tự động tính toán lịch hẹn ôn lại theo Đường cong quên lãng cho từng thẻ của em.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 shadow-2xs dark:border-emerald-900 dark:bg-emerald-950/30">
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
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
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 shadow-2xs dark:border-amber-900 dark:bg-amber-950/30">
                <div className="text-2xl font-black text-amber-700 dark:text-amber-300">
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
              <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3 shadow-2xs dark:border-rose-900 dark:bg-rose-950/30">
                <div className="text-2xl font-black text-rose-700 dark:text-rose-300">
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
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 transition dark:border-slate-700 dark:text-slate-300"
              >
                <RotateCw className="h-4 w-4" />
                Lật ôn lại lần nữa
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleCompleteSession()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition disabled:opacity-50"
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
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-300 shadow-xs"
                style={{
                  width: `${Math.round(((currentIndex + 1) / cards.length) * 100)}%`,
                }}
              />
            </div>

            {/* Thẻ Flashcard chính với hiệu ứng chuyển thẻ và 3D Flip mượt mà tương thích Safari/WebKit */}
            <div
              key={currentIndex}
              className={`w-full ${
                slideDirection === 'next'
                  ? 'animate-card-next'
                  : slideDirection === 'prev'
                  ? 'animate-card-prev'
                  : ''
              }`}
            >
              <div className="perspective-1000 w-full min-h-[290px] select-none">
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
                  aria-label={flipped ? 'Lật về mặt trước' : 'Lật xem mặt sau'}
                  className={`relative w-full min-h-[290px] cursor-pointer transition-transform duration-500 preserve-3d ${
                    flipped ? 'rotate-y-180' : ''
                  }`}
                >
                  {/* Mặt trước của Thẻ Flashcard */}
                  <div
                    className={`absolute inset-0 w-full h-full backface-hidden rounded-3xl border-2 border-emerald-200/90 bg-gradient-to-br from-emerald-50/70 via-white to-sky-50/40 p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-md hover:shadow-lg hover:border-emerald-400 transition-all duration-300 dark:border-emerald-900/70 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/30 ${
                      flipped
                        ? 'opacity-0 invisible pointer-events-none'
                        : 'opacity-100 visible pointer-events-auto'
                    }`}
                  >
                    <span className="absolute top-3.5 left-4 rounded-lg bg-white/95 px-2.5 py-1 text-[11px] font-bold text-slate-500 shadow-2xs dark:bg-slate-800 dark:text-slate-300">
                      Mặt trước (Từ / Mẫu câu / Câu hỏi)
                    </span>

                    <span className="absolute top-3.5 right-4 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      <RotateCw className="h-3.5 w-3.5" />
                      Bấm để lật thẻ
                    </span>

                    <div className="mt-4 max-w-lg space-y-3 w-full">
                      <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                        {currentCard.keyword.term}
                      </div>

                      {currentCard.keyword.pronunciation && (
                        <div className="text-sm sm:text-base font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                          {currentCard.keyword.pronunciation}
                        </div>
                      )}

                      {/* Nút phát âm ngoại ngữ (chỉ hiện khi có ttsLang) */}
                      {activeTtsLang && (
                        <div
                          className="flex flex-wrap items-center justify-center gap-2 pt-2"
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
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition"
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
                            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 active:scale-95 transition dark:border-emerald-800 dark:bg-slate-800 dark:text-emerald-300"
                          >
                            <Turtle className="h-4 w-4" />
                            Đọc chậm
                          </button>
                        </div>
                      )}

                      <div className="pt-2 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                        Chạm vào thẻ hoặc bấm nút Lật bên dưới để xem nghĩa
                      </div>
                    </div>
                  </div>

                  {/* Mặt sau của Thẻ Flashcard */}
                  <div
                    className={`absolute inset-0 w-full h-full backface-hidden rotate-y-180 rounded-3xl border-2 border-teal-300/90 bg-gradient-to-br from-teal-50/80 via-white to-emerald-50/50 p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-md hover:shadow-lg hover:border-teal-400 transition-all duration-300 dark:border-teal-900/70 dark:from-slate-900 dark:via-slate-900 dark:to-teal-950/30 overflow-y-auto ${
                      !flipped
                        ? 'opacity-0 invisible pointer-events-none'
                        : 'opacity-100 visible pointer-events-auto'
                    }`}
                  >
                    <span className="absolute top-3.5 left-4 rounded-lg bg-white/95 px-2.5 py-1 text-[11px] font-bold text-teal-700 shadow-2xs dark:bg-slate-800 dark:text-teal-300">
                      Mặt sau (Nghĩa / Đáp án)
                    </span>

                    <span className="absolute top-3.5 right-4 inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                      <RotateCw className="h-3.5 w-3.5" />
                      Bấm để quay lại
                    </span>

                    <div className="mt-4 max-w-lg space-y-3 w-full">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {currentCard.keyword.term}
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <span className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-300">
                          {currentCard.keyword.meaning}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            speakTextWithTts(
                              currentCard.keyword.meaning,
                              'vi-VN',
                              false
                            );
                          }}
                          title="Nghe đọc nghĩa tiếng Việt (vi-VN)"
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-200 active:scale-95 dark:bg-emerald-950 dark:text-emerald-300 transition"
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                          <span>Đọc nghĩa</span>
                        </button>
                      </div>

                      {currentCard.keyword.example && (() => {
                        const exampleTtsLang = detectTextTtsLang(
                          currentCard.keyword.example,
                          activeTtsLang
                        );
                        const isExampleVi = isVietnameseText(
                          currentCard.keyword.example
                        );

                        return (
                          <div className="rounded-2xl bg-white/90 p-3.5 text-xs sm:text-sm text-slate-700 border border-slate-200/80 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 shadow-2xs text-left">
                            <strong>Ví dụ / Ghi chú:</strong>{' '}
                            {currentCard.keyword.example}
                            {exampleTtsLang && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  speakTextWithTts(
                                    currentCard.keyword.example,
                                    exampleTtsLang,
                                    false
                                  );
                                }}
                                className="ml-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline active:scale-95 dark:text-emerald-400"
                              >
                                <Volume2 className="h-3.5 w-3.5" />
                                {isExampleVi
                                  ? 'Đọc ghi chú'
                                  : `Đọc câu (${exampleTtsLang})`}
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3 Nút tự đánh giá theo Đường cong quên lãng */}
            <div className="relative space-y-2">
              {cheerFeedback && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none transition-all duration-200 animate-bounce">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold shadow-lg ${cheerFeedback.pillClass}`}
                  >
                    <span>{cheerFeedback.emoji}</span>
                    <span>{cheerFeedback.text}</span>
                  </span>
                </div>
              )}
              <div className="text-center text-xs font-bold text-slate-500">
                Đánh giá mức độ nhớ của em để hẹn ngày ôn lại (Đường cong quên lãng):
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={(e) => handleRateCard('forgot', e)}
                  className={`group relative flex flex-col items-center rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-rose-900 transition-all duration-150 hover:bg-rose-100 hover:shadow-md hover:-translate-y-0.5 active:scale-95 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200 ${
                    clickedRating === 'forgot'
                      ? 'animate-btn-shake ring-4 ring-rose-400/50'
                      : ''
                  }`}
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
                  onClick={(e) => handleRateCard('good', e)}
                  className={`group relative flex flex-col items-center rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-amber-950 transition-all duration-150 hover:bg-amber-100 hover:shadow-md hover:-translate-y-0.5 active:scale-95 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 ${
                    clickedRating === 'good'
                      ? 'animate-btn-pop ring-4 ring-amber-400/50'
                      : ''
                  }`}
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
                  onClick={(e) => handleRateCard('easy', e)}
                  className={`group relative flex flex-col items-center rounded-2xl border-2 border-emerald-400 bg-emerald-50 px-4 py-3 text-emerald-950 shadow-xs transition-all duration-150 hover:bg-emerald-100 hover:shadow-md hover:-translate-y-0.5 active:scale-95 dark:border-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-200 ${
                    clickedRating === 'easy'
                      ? 'animate-btn-pop ring-4 ring-emerald-500/60 scale-105'
                      : ''
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                    Đã nhớ kỹ
                  </span>
                  <span className="mt-0.5 text-[11px] font-semibold text-emerald-700/90 dark:text-emerald-400">
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
                  setSlideDirection('prev');
                  setFlipped(false);
                  setCurrentIndex((i) => Math.max(0, i - 1));
                }}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 active:scale-95 transition disabled:opacity-40 dark:text-slate-300"
              >
                <ChevronLeft className="h-4 w-4" /> Thẻ trước
              </button>

              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 active:scale-95 transition dark:bg-slate-800 dark:text-slate-200"
              >
                <RotateCw className="h-3.5 w-3.5 text-slate-500" />
                {flipped ? 'Lật về mặt trước' : 'Lật xem nghĩa / đáp án'}
              </button>

              <button
                type="button"
                disabled={currentIndex >= cards.length - 1}
                onClick={() => {
                  setSlideDirection('next');
                  setFlipped(false);
                  setCurrentIndex((i) => Math.min(cards.length - 1, i + 1));
                }}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 active:scale-95 transition disabled:opacity-40 dark:text-slate-300"
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
  const [isEvaluated, setIsEvaluated] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const effectiveTtsLang = inferDefaultTtsLang(subject, ttsLang);

  const answeredCount = Object.keys(selectedAnswers).length;
  const correctCount = questions.reduce((acc, q) => {
    return selectedAnswers[q.id] === q.correctIndex ? acc + 1 : acc;
  }, 0);
  const scorePercentage = Math.round(
    (correctCount / (questions.length || 1)) * 100
  );

  const handleEvaluate = () => {
    if (answeredCount === 0) return;
    setIsEvaluated(true);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleRetake = () => {
    setSelectedAnswers({});
    setIsEvaluated(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmitResult = async () => {
    setSubmitting(true);
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
      const studentNote = `Kết quả trắc nghiệm: ${correctCount}/${questions.length} câu đúng (${scorePercentage}%)${wrongSummary}`;

      await onSubmitQuizResult({
        score: correctCount,
        total: questions.length,
        studentNote,
        updatedSrsPatch: srsPatch,
      });

      onClose();
    } catch (err) {
      console.error('Lỗi khi nộp bài trắc nghiệm:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-150"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => {
          if (e.target === e.currentTarget && !submitting) onClose();
        }}
      >
        <div
          className="relative flex flex-col w-full max-w-3xl max-h-[92vh] rounded-3xl bg-white shadow-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
        >
          {/* Header Modal - Cố định ở đỉnh (Sticky Header) */}
          <div className="relative shrink-0 flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 sm:px-6 py-4 dark:border-slate-800 dark:bg-slate-900/90 z-10">
            <div className="space-y-0.5 pr-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  {subject} {unitTitle ? `• ${unitTitle}` : ''}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/80 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Đã làm {answeredCount}/{questions.length} câu
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white line-clamp-1">
                {title} ({questions.length} câu)
              </h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                aria-label="Đóng bài trắc nghiệm"
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Thanh tiến độ trực quan mỏng ở mép dưới Header */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-200/60 dark:bg-slate-800">
              <div
                className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                style={{
                  width: `${Math.round((answeredCount / (questions.length || 1)) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Vùng cuộn nội dung câu hỏi */}
          <div
            ref={scrollContainerRef}
            className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5 space-y-5"
          >
            {/* Banner kết quả khi đã chấm điểm */}
            {isEvaluated && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 shadow-xs dark:border-emerald-900/60 dark:bg-emerald-950/40">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      Kết quả làm bài
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white">
                      {correctCount} / {questions.length} câu đúng{' '}
                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        ({scorePercentage}%)
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {scorePercentage === 100
                        ? 'Xuất sắc! Em đã trả lời đúng tất cả các câu hỏi.'
                        : scorePercentage >= 80
                        ? 'Rất tốt! Em đã nắm vững hầu hết kiến thức của bài.'
                        : scorePercentage >= 50
                        ? 'Khá tốt! Hãy xem lại các câu chưa đúng bên dưới để nhớ sâu hơn nhé.'
                        : 'Hãy xem lại lời giải thích bên dưới hoặc làm lại bài để cải thiện điểm số nhé.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleRetake}
                      disabled={submitting}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition"
                    >
                      <RotateCw className="h-4 w-4" />
                      Làm lại bài
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSubmitResult()}
                      disabled={submitting}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {submitting ? 'Đang nộp...' : 'Nộp bài & Lưu kết quả'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Danh sách câu hỏi */}
            {questions.map((q, qIdx) => {
              const chosen = selectedAnswers[q.id];
              const isAnswered = chosen !== undefined;
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
                        className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 transition"
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

                      if (!isEvaluated && isSelected) {
                        optionStyle =
                          'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/40 dark:bg-emerald-950/60 dark:text-emerald-200';
                      } else if (isEvaluated) {
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
                          disabled={isEvaluated}
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

                  {/* Giải thích khi đã chấm điểm */}
                  {isEvaluated && (
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
                            {isAnswered
                              ? `Chưa đúng (Đáp án đúng là ${String.fromCharCode(
                                  65 + q.correctIndex
                                )}: ${q.options[q.correctIndex]})`
                              : `Chưa chọn đáp án (Đáp án đúng là ${String.fromCharCode(
                                  65 + q.correctIndex
                                )}: ${q.options[q.correctIndex]})`}
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

          {/* Footer Modal - Cố định ở đáy (Sticky/Fixed Footer) */}
          <div className="shrink-0 border-t border-slate-200 bg-slate-50/90 px-5 sm:px-6 py-3.5 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/90 z-10">
            {!isEvaluated ? (
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {answeredCount === questions.length ? (
                    <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Đã chọn đủ {questions.length}/{questions.length} câu
                    </span>
                  ) : (
                    <span>
                      Đã chọn <strong className="text-slate-900 dark:text-white">{answeredCount}</strong> / {questions.length} câu
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={answeredCount === 0}
                  onClick={handleEvaluate}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition disabled:opacity-50 disabled:pointer-events-none"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Chấm điểm & Xem kết quả
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleRetake}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 active:scale-95 transition disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <RotateCw className="h-4 w-4" />
                  Làm lại bài kiểm tra
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmitResult()}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {submitting ? 'Đang nộp bài...' : 'Nộp bài & Lưu kết quả'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

