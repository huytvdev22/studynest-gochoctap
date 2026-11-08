import React, { useCallback, useEffect, useState } from 'react';
import {
  Ban,
  Check,
  Copy,
  KeyRound,
  Settings,
  ShieldAlert,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {
  ClassInvitation,
  ClassMember,
  ClassThemeColor,
  ClassThemeIcon,
  JoinRequest,
} from '@/types/domain';
import { useAuth } from '@/contexts/AuthContext';
import { useClassContext } from '@/contexts/ClassContext';
import {
  approveJoinRequestAtomic,
  createInvitation,
  listClassInvitationsWithSecrets,
  listClassMembers,
  listJoinRequests,
  rejectJoinRequest,
  removeClassMember,
  revokeInvitation,
  updateClassSettings,
  updateMemberRole,
} from '@/services/studyNestService';
import {
  DAY_OF_WEEK_SHORT_LABELS,
  ORDERED_DAYS_OF_WEEK,
} from '@/lib/date';
import {
  ALLOWED_CLASS_COLORS,
  ALLOWED_CLASS_ICONS,
  validateClassInput,
} from '@/lib/validation';
import {
  ClassIconView,
  RoleBadge,
  THEME_COLOR_STYLES,
  UserAvatar,
} from '@/components/ui/ThemeBadges';

export function MembersAndSettingsPage() {
  const { user } = useAuth();
  const { studyClass, isOwner, refreshClass } = useClassContext();

  const [members, setMembers] = useState<ClassMember[]>([]);
  const [invitations, setInvitations] = useState<
    Array<{
      invitation: ClassInvitation;
      joinCode?: string;
      compositeToken: string;
    }>
  >([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Tạo lời mời mới
  const [expiresInDays, setExpiresInDays] = useState<number>(7);
  const [creatingInvite, setCreatingInvite] = useState<boolean>(false);

  // Chỉnh sửa thông tin lớp (dành cho Owner)
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [color, setColor] = useState<ClassThemeColor>('emerald');
  const [icon, setIcon] = useState<ClassThemeIcon>('book-open');
  const [studyDays, setStudyDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!studyClass) return;
    setLoading(true);
    try {
      setName(studyClass.name);
      setDescription(studyClass.description);
      setColor(studyClass.color);
      setIcon(studyClass.icon);
      setStudyDays(studyClass.studyDaysOfWeek);

      const mems = await listClassMembers(studyClass.id);
      setMembers(mems);

      if (isOwner) {
        const [invs, reqs] = await Promise.all([
          listClassInvitationsWithSecrets(studyClass.id),
          listJoinRequests(studyClass.id),
        ]);
        setInvitations(invs);
        setJoinRequests(reqs);
      }
    } finally {
      setLoading(false);
    }
  }, [studyClass, isOwner]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (!studyClass || !user) return null;

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCreateInvite = async () => {
    setCreatingInvite(true);
    try {
      await createInvitation(
        studyClass.id,
        studyClass.name,
        user.uid,
        user.displayName,
        expiresInDays
      );
      await loadData();
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleRevokeInvite = async (invitationId: string) => {
    await revokeInvitation(studyClass.id, invitationId);
    await loadData();
  };

  const handleApproveRequest = async (req: JoinRequest) => {
    await approveJoinRequestAtomic(studyClass.id, req);
    await loadData();
  };

  const handleRejectRequest = async (requestUid: string) => {
    await rejectJoinRequest(studyClass.id, requestUid);
    await loadData();
  };

  const handleChangeRole = async (
    targetUid: string,
    newRole: 'instructor' | 'student'
  ) => {
    await updateMemberRole(studyClass.id, targetUid, newRole);
    await loadData();
  };

  const handleRemoveMember = async (targetUid: string) => {
    await removeClassMember(studyClass.id, targetUid);
    await loadData();
  };

  const toggleStudyDay = (d: number) => {
    setStudyDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsMessage(null);
    const v = validateClassInput({
      name,
      description,
      color,
      icon,
      studyDaysOfWeek: studyDays,
    });
    if (!v.valid) {
      setSettingsMessage(v.error || 'Dữ liệu cài đặt không hợp lệ.');
      return;
    }

    setSavingSettings(true);
    try {
      await updateClassSettings(studyClass.id, {
        name,
        description,
        color,
        icon,
        timezone: studyClass.timezone,
        studyDaysOfWeek: studyDays,
      });
      await refreshClass();
      setSettingsMessage('Đã lưu cài đặt lớp học thành công!');
    } finally {
      setSavingSettings(false);
    }
  };

  const pendingReqs = joinRequests.filter((r) => r.status === 'pending');

  return (
    <div className="space-y-8">
      {/* Phần 1: Yêu cầu tham gia lớp chờ duyệt (Chỉ Owner) */}
      {isOwner && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50/50 p-6 shadow-xs dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <UserPlus className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Yêu cầu xin vào lớp chờ xác nhận ({pendingReqs.length})
              </h2>
            </div>
            <span className="rounded-full bg-amber-200/80 px-3 py-0.5 text-xs font-bold text-amber-950">
              Chốt chặn bảo mật Owner Approval
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            Người học đã nhập đúng mã mời sẽ nằm trong danh sách chờ dưới đây. Họ chỉ có quyền truy cập lớp sau khi bạn bấm <strong>Chấp nhận</strong>.
          </p>

          {pendingReqs.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-white/80 p-4 text-xs font-medium text-slate-500 dark:bg-slate-900/60">
              Hiện chưa có yêu cầu tham gia mới nào đang chờ duyệt.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {pendingReqs.map((req) => (
                <div
                  key={req.uid}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-amber-300 bg-white p-4 sm:flex-row sm:items-center dark:border-amber-800 dark:bg-slate-900"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      name={req.displayName}
                      avatarUrl={req.avatarUrl}
                      size="lg"
                    />
                    <div>
                      <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {req.displayName}
                      </div>
                      {req.message && (
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          Lời nhắn: “{req.message}”
                        </div>
                      )}
                      <div className="mt-1 text-[11px] text-slate-400">
                        Mã đã xác thực: <strong>{req.submittedCode}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleApproveRequest(req)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Chấp nhận làm Học sinh
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRejectRequest(req.uid)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                    >
                      <X className="h-3.5 w-3.5" />
                      Từ chối
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Phần 2: Quản lý Lời mời & Mã tham gia (Chỉ Owner) */}
      {isOwner && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <KeyRound className="h-5 w-5 text-emerald-600" />
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Đường link lời mời & Mã tham gia
                </h2>
                <p className="text-xs text-slate-500">
                  Mã tham gia được băm SHA-256 trong tài liệu công khai và lưu bản gốc trong kho riêng của Chủ lớp.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                aria-label="Thời hạn lời mời"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
              >
                <option value={1}>Hết hạn sau 1 ngày</option>
                <option value={7}>Hết hạn sau 7 ngày</option>
                <option value={14}>Hết hạn sau 14 ngày</option>
                <option value={30}>Hết hạn sau 30 ngày</option>
              </select>

              <button
                type="button"
                disabled={creatingInvite}
                onClick={() => void handleCreateInvite()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <UserPlus className="h-3.5 w-3.5" />
                {creatingInvite ? 'Đang tạo...' : 'Tạo lời mời mới'}
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {invitations.map(({ invitation, joinCode, compositeToken }) => {
              const joinUrl = `${window.location.origin}/join/${compositeToken}`;
              const isExpired = invitation.expiresAt.toMillis() <= Date.now();
              const isActive = invitation.status === 'active' && !isExpired;

              return (
                <div
                  key={invitation.id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 lg:flex-row lg:items-center dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {isActive
                          ? 'Đang hoạt động'
                          : invitation.status === 'revoked'
                          ? 'Đã hủy'
                          : 'Đã hết hạn'}
                      </span>
                      {joinCode && (
                        <span className="rounded-lg bg-amber-100 px-2.5 py-0.5 font-mono text-xs font-extrabold text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                          Mã tham gia: {joinCode}
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-mono text-slate-600 dark:text-slate-300 break-all">
                      Link: {joinUrl}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void copyToClipboard(joinUrl, `url-${invitation.id}`)
                      }
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiedKey === `url-${invitation.id}`
                        ? 'Đã chép Link!'
                        : 'Chép Link'}
                    </button>

                    {joinCode && (
                      <button
                        type="button"
                        onClick={() =>
                          void copyToClipboard(
                            joinCode,
                            `code-${invitation.id}`
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {copiedKey === `code-${invitation.id}`
                          ? 'Đã chép Mã!'
                          : 'Chép Mã'}
                      </button>
                    )}

                    {isActive && (
                      <button
                        type="button"
                        onClick={() => void handleRevokeInvite(invitation.id)}
                        className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Hủy lời mời
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Phần 3: Danh sách Thành viên & Phân vai */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2.5">
          <Users className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            Thành viên trong lớp ({members.length})
          </h2>
        </div>

        {loading ? (
          <div className="mt-4 h-32 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/60" />
        ) : (
          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {members.map((m) => (
              <div
                key={m.uid}
                className="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-3">
                  <UserAvatar
                    name={m.displayName}
                    avatarUrl={
                      m.avatarUrl || (m.uid === user.uid ? user.photoURL : '')
                    }
                    size="lg"
                  />
                  <div>
                    <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {m.displayName} {m.uid === user.uid && '(Bạn)'}
                    </div>
                    <div className="mt-0.5">
                      <RoleBadge role={m.role} />
                    </div>
                  </div>
                </div>

                {isOwner && m.role !== 'owner' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void handleChangeRole(
                          m.uid,
                          m.role === 'instructor' ? 'student' : 'instructor'
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      {m.role === 'instructor'
                        ? 'Chuyển thành Học sinh'
                        : 'Phân quyền Người hướng dẫn'}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleRemoveMember(m.uid)}
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                      Xóa khỏi lớp
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Phần 4: Cài đặt lớp học (Chỉ Owner chỉnh sửa) */}
      {isOwner && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <Settings className="h-5 w-5 text-slate-600" />
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Cài đặt thông tin lớp & Ngày học tính Streak
            </h2>
          </div>

          <form
            onSubmit={(e) => void handleSaveSettings(e)}
            className="mt-4 space-y-4"
          >
            {settingsMessage && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-900">
                {settingsMessage}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="edit-class-name"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Tên lớp học
                </label>
                <input
                  id="edit-class-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-class-desc"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Mô tả lớp
                </label>
                <input
                  id="edit-class-desc"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Màu chủ đề
                </span>
                <div className="mt-2 flex items-center gap-2">
                  {ALLOWED_CLASS_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-8 w-8 rounded-full ${
                        THEME_COLOR_STYLES[c].iconBg
                      } ${
                        color === c
                          ? 'ring-2 ring-slate-900 ring-offset-2 dark:ring-white'
                          : 'opacity-70'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Biểu tượng
                </span>
                <div className="mt-2 flex items-center gap-2">
                  {ALLOWED_CLASS_ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setIcon(ic)}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                        icon === ic
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 text-slate-500'
                      }`}
                    >
                      <ClassIconView icon={ic} className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Các ngày học cố định trong tuần (Dùng cho tính năng Streak)
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {ORDERED_DAYS_OF_WEEK.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleStudyDay(d)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                      studyDays.includes(d)
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {DAY_OF_WEEK_SHORT_LABELS[d]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
              >
                {savingSettings ? 'Đang lưu...' : 'Lưu cài đặt lớp học'}
              </button>
            </div>
          </form>
        </section>
      )}

      {!isOwner && (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <ShieldAlert className="h-4 w-4 text-slate-400" />
          Chỉ Chủ lớp (Owner) mới có quyền tạo đường link mời, phê duyệt học sinh mới và thay đổi phân quyền thành viên.
        </div>
      )}
    </div>
  );
}

