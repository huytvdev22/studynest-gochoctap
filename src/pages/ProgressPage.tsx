import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Flame,
  Plus,
  ShieldCheck,
  Star,
} from 'lucide-react';
import type {
  ClassMember,
  LearningRecord,
  ScheduleException,
} from '@/types/domain';
import { useAuth } from '@/contexts/AuthContext';
import { useClassContext } from '@/contexts/ClassContext';
import {
  confirmOrReviewLearningRecord,
  listClassMembers,
  listLearningRecords,
  listScheduleExceptions,
} from '@/services/studyNestService';
import {
  DAY_OF_WEEK_SHORT_LABELS,
  formatDateInTimezone,
  formatVietnameseDate,
} from '@/lib/date';
import { calculateStudentProgressAndStreak } from '@/lib/streak';
import { UserAvatar } from '@/components/ui/ThemeBadges';

export function ProgressPage() {
  const { user } = useAuth();
  const { studyClass, role, isInstructorOrOwner, isStudent } = useClassContext();

  const [records, setRecords] = useState<LearningRecord[]>([]);
  const [students, setStudents] = useState<ClassMember[]>([]);
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [selectedStudentUid, setSelectedStudentUid] = useState<string>('');
  const [maxRecords, setMaxRecords] = useState<number>(25);
  const [loading, setLoading] = useState<boolean>(true);

  // Form xác nhận buổi học trực tiếp & tặng sao (dành cho Instructor/Owner)
  const [awardDate, setAwardDate] = useState<string>('');
  const [awardTitle, setAwardTitle] = useState<string>(
    'Hoàn thành buổi học 60 phút buổi tối'
  );
  const [awardStars, setAwardStars] = useState<number>(3);
  const [awardComment, setAwardComment] = useState<string>(
    'Học tập tập trung, làm bài đầy đủ và soạn cặp gọn gàng!'
  );
  const [savingAward, setSavingAward] = useState<boolean>(false);

  const loadProgress = useCallback(async () => {
    if (!studyClass || !user || !role) return;
    setLoading(true);
    try {
      const today = formatDateInTimezone(new Date(), studyClass.timezone);
      setAwardDate((prev) => prev || today);

      const [recs, mems, excs] = await Promise.all([
        listLearningRecords(studyClass.id, user.uid, role, maxRecords),
        listClassMembers(studyClass.id),
        listScheduleExceptions(studyClass.id),
      ]);

      const studentMembers = mems.filter((m) => m.role === 'student');
      setRecords(recs);
      setStudents(studentMembers);
      setExceptions(excs);

      if (isStudent) {
        setSelectedStudentUid(user.uid);
      } else if (!selectedStudentUid && studentMembers.length > 0) {
        setSelectedStudentUid(studentMembers[0].uid);
      }
    } finally {
      setLoading(false);
    }
  }, [studyClass, user, role, maxRecords, isStudent, selectedStudentUid]);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  if (!studyClass || !user || !role) return null;

  const today = formatDateInTimezone(new Date(), studyClass.timezone);
  const dayOffDates = exceptions.filter((e) => e.isDayOff).map((e) => e.date);

  const studentRecords = selectedStudentUid
    ? records.filter((r) => r.studentUid === selectedStudentUid)
    : records;

  const summary = calculateStudentProgressAndStreak({
    records: studentRecords,
    todayDateStr: today,
    studyDaysOfWeek: studyClass.studyDaysOfWeek,
    dayOffDates,
  });

  const activeStudent = students.find((s) => s.uid === selectedStudentUid);

  const handleDirectAwardSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudent) return;
    setSavingAward(true);
    try {
      const recId = `session_${awardDate}_${activeStudent.uid}`;
      await confirmOrReviewLearningRecord({
        classId: studyClass.id,
        instructorUid: user.uid,
        recordId: recId,
        studentUid: activeStudent.uid,
        studentName: activeStudent.displayName,
        type: 'session',
        assignmentId: null,
        sessionId: null,
        title: awardTitle,
        date: awardDate,
        instructorStatus: 'confirmed',
        starsAwarded: awardStars,
        instructorComment: awardComment,
      });
      await loadProgress();
    } finally {
      setSavingAward(false);
    }
  };

  const handleConfirmPendingRecord = async (rec: LearningRecord) => {
    setSavingAward(true);
    try {
      await confirmOrReviewLearningRecord({
        classId: studyClass.id,
        instructorUid: user.uid,
        recordId: rec.id,
        studentUid: rec.studentUid,
        studentName: rec.studentName,
        type: rec.type,
        assignmentId: rec.assignmentId,
        sessionId: rec.sessionId,
        title: rec.title,
        date: rec.date,
        instructorStatus: 'confirmed',
        starsAwarded: 3,
        instructorComment: 'Đã xác nhận hoàn thành nhiệm vụ!',
      });
      await loadProgress();
    } finally {
      setSavingAward(false);
    }
  };

  const studyDaysLabels = studyClass.studyDaysOfWeek
    .map((d) => DAY_OF_WEEK_SHORT_LABELS[d])
    .join(', ');

  return (
    <div className="space-y-8">
      {/* Thanh chọn học sinh (Nếu là Instructor / Owner) */}
      {isInstructorOrOwner && (
        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Theo dõi Tiến độ & Chuỗi ngày học (Streak)
            </h2>
            <p className="text-xs text-slate-500">
              Chọn học sinh để xem nhật ký hoàn thành, xác nhận nhiệm vụ và thưởng sao.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {students.length === 0 ? (
              <span className="text-xs text-slate-500">
                Lớp chưa có học sinh nào tham gia.
              </span>
            ) : (
              students.map((st) => (
                <button
                  key={st.uid}
                  type="button"
                  onClick={() => setSelectedStudentUid(st.uid)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    selectedStudentUid === st.uid
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <UserAvatar
                    name={st.displayName}
                    avatarUrl={
                      st.avatarUrl || (st.uid === user.uid ? user.photoURL : '')
                    }
                    size="xs"
                  />
                  {st.displayName}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* 4 Thẻ chỉ số Sao & Streak */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-emerald-800 dark:text-emerald-300">
              Chuỗi hiện tại (Streak)
            </span>
            <Flame className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">
            {summary.currentStreak} ngày
          </div>
          <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Lịch tính streak: {studyDaysLabels}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-amber-800 dark:text-amber-300">
              Tổng sao tích lũy
            </span>
            <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
          </div>
          <div className="mt-2 flex items-center gap-2 text-3xl font-extrabold text-slate-900 dark:text-white">
            <span>{summary.totalStars}</span>
            <Star className="h-6 w-6 fill-amber-400 text-amber-500" />
          </div>
          <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Từ {summary.confirmedRecordsCount} mục đã xác nhận
          </div>
        </div>

        <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-5 dark:border-sky-900/50 dark:bg-sky-950/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-sky-800 dark:text-sky-300">
              Kỷ lục Streak dài nhất
            </span>
            <Award className="h-5 w-5 text-sky-600" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">
            {summary.longestStreak} ngày
          </div>
          <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Tổng cộng {summary.confirmedDaysCount} ngày học hợp lệ
          </div>
        </div>

        <div className="rounded-2xl border border-violet-200 bg-violet-50/80 p-5 dark:border-violet-900/50 dark:bg-violet-950/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-violet-800 dark:text-violet-300">
              Đang chờ xác nhận
            </span>
            <Clock className="h-5 w-5 text-violet-600" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">
            {summary.pendingConfirmationCount} mục
          </div>
          <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Chỉ tính streak sau khi GV xác nhận
          </div>
        </div>
      </div>

      {/* Ghi chú minh bạch quy tắc tính Streak */}
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div>
          <strong className="text-slate-900 dark:text-white">
            Cơ chế bảo vệ tính trung thực của Sao & Chuỗi ngày học:
          </strong>{' '}
          Một ngày chỉ được tính vào chuỗi Streak khi có ít nhất 1 buổi học hoặc
          nhiệm vụ đã được <strong>Người hướng dẫn xác nhận</strong>. Việc học
          sinh tự bấm “Đã làm” chưa làm tăng sao hay streak. Các ngày nghỉ cố định
          trong tuần ({studyDaysLabels} là ngày học) và {dayOffDates.length} ngày nghỉ
          lễ ngoại lệ sẽ tự động được bỏ qua, không làm đứt chuỗi của em.
        </div>
      </div>

      {/* Form cho Instructor/Owner chốt nhận xét & tặng sao buổi học theo ngày */}
      {isInstructorOrOwner && activeStudent && (
        <form
          onSubmit={(e) => void handleDirectAwardSession(e)}
          className="rounded-3xl border border-emerald-200 bg-emerald-50/40 p-6 space-y-4 dark:border-emerald-900/50 dark:bg-emerald-950/20"
        >
          <div className="flex items-center gap-2.5">
            <Plus className="h-5 w-5 text-emerald-600" />
            <UserAvatar
              name={activeStudent.displayName}
              avatarUrl={
                activeStudent.avatarUrl ||
                (activeStudent.uid === user.uid ? user.photoURL : '')
              }
              size="sm"
            />
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Xác nhận buổi học & Tưởng thưởng sao cho {activeStudent.displayName}
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label
                htmlFor="award-date"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Ngày học
              </label>
              <input
                id="award-date"
                type="date"
                required
                value={awardDate}
                onChange={(e) => setAwardDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="award-title"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Nội dung ghi nhận
              </label>
              <input
                id="award-title"
                type="text"
                required
                value={awardTitle}
                onChange={(e) => setAwardTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label
                htmlFor="award-stars"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Số sao thưởng (1 - 10)
              </label>
              <select
                id="award-stars"
                value={awardStars}
                onChange={(e) => setAwardStars(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-800"
              >
                {[1, 2, 3, 4, 5, 6, 8, 10].map((s) => (
                  <option key={s} value={s}>
                    +{s} sao
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              aria-label="Nhận xét buổi học"
              value={awardComment}
              onChange={(e) => setAwardComment(e.target.value)}
              placeholder="Lời khen hoặc dặn dò cho học sinh..."
              className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="submit"
              disabled={savingAward}
              className="shrink-0 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {savingAward ? 'Đang lưu...' : 'Xác nhận ngày học & Tặng sao'}
            </button>
          </div>
        </form>
      )}

      {/* Nhật ký tiến độ có giới hạn / phân trang */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-emerald-600" />
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Nhật ký học tập gần đây ({studentRecords.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Giới hạn tải {maxRecords} bản ghi mới nhất
          </span>
        </div>

        {loading ? (
          <div className="mt-4 h-40 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/60" />
        ) : studentRecords.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Chưa có bản ghi học tập nào.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {studentRecords.map((rec) => {
              const isConfirmed = rec.instructorStatus === 'confirmed';
              const recStudent = students.find((s) => s.uid === rec.studentUid);
              const recAvatarUrl =
                recStudent?.avatarUrl ||
                (rec.studentUid === user.uid ? user.photoURL : '');
              return (
                <div
                  key={rec.id}
                  className={`flex flex-col justify-between gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center ${
                    isConfirmed
                      ? 'border-emerald-200/80 bg-emerald-50/30 dark:border-emerald-900/50 dark:bg-emerald-950/15'
                      : 'border-amber-200/80 bg-amber-50/30 dark:border-amber-900/50 dark:bg-amber-950/15'
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                        {formatVietnameseDate(rec.date)}
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        <UserAvatar
                          name={rec.studentName}
                          avatarUrl={recAvatarUrl}
                          size="xs"
                        />
                        {rec.studentName}
                      </span>
                    </div>

                    <div className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                      {rec.title}
                    </div>

                    {rec.studentNote && (
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        Học sinh báo cáo: “{rec.studentNote}”
                      </p>
                    )}
                    {rec.instructorComment && (
                      <p className="mt-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                        Nhận xét của GV: “{rec.instructorComment}”
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isConfirmed ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-extrabold text-white">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                        +{rec.starsAwarded} sao • Đã xác nhận
                      </span>
                    ) : (
                      <>
                        <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-bold text-amber-950">
                          Chờ xác nhận
                        </span>
                        {isInstructorOrOwner && (
                          <button
                            type="button"
                            disabled={savingAward}
                            onClick={() => void handleConfirmPendingRecord(rec)}
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                            Xác nhận +3 sao
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {studentRecords.length >= maxRecords && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setMaxRecords((m) => m + 25)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  Tải thêm lịch sử học tập
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

