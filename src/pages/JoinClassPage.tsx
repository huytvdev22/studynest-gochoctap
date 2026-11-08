import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import type { ClassInvitation, JoinRequest } from '@/types/domain';
import { useAuth } from '@/contexts/AuthContext';
import {
  getClassContext,
  getInvitationByCompositeToken,
  getMyJoinRequest,
  submitJoinRequest,
} from '@/services/studyNestService';

export function JoinClassPage() {
  const { token = '' } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [invitation, setInvitation] = useState<ClassInvitation | null>(null);
  const [alreadyMember, setAlreadyMember] = useState<boolean>(false);
  const [existingRequest, setExistingRequest] = useState<JoinRequest | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState<string>('');
  const [message, setMessage] = useState<string>('Em xin phép tham gia lớp học ạ!');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadInviteStatus = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`/join/${token}`)}`, {
        replace: true,
      });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await getInvitationByCompositeToken(token);
      if (!res) {
        setError('Đường link lời mời không tồn tại hoặc không đúng định dạng.');
        setLoading(false);
        return;
      }
      setInvitation(res.invitation);

      const memberCtx = await getClassContext(res.classId, user.uid);
      if (memberCtx) {
        setAlreadyMember(true);
        setLoading(false);
        return;
      }

      const myReq = await getMyJoinRequest(res.classId, user.uid);
      setExistingRequest(myReq);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Không thể kiểm tra lời mời này.'
      );
    } finally {
      setLoading(false);
    }
  }, [authLoading, user, token, navigate]);

  useEffect(() => {
    void loadInviteStatus();
  }, [loadInviteStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const req = await submitJoinRequest({
        compositeToken: token,
        submittedCode: code,
        user: {
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
        },
        message,
      });
      setExistingRequest(req);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Mã tham gia không đúng hoặc lời mời đã hết hiệu lực.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="mx-auto my-12 max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
          Đang kiểm tra thông tin lời mời...
        </p>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="mx-auto my-12 max-w-md rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm dark:border-rose-900/60 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
          Lời mời không hợp lệ
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {error || 'Không tìm thấy lời mời tham gia lớp.'}
        </p>
        <Link
          to="/app/classes"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white dark:bg-white dark:text-slate-900"
        >
          Về trang Lớp của tôi
        </Link>
      </div>
    );
  }

  const isExpired = invitation.expiresAt.toMillis() <= Date.now();
  const isRevoked = invitation.status === 'revoked';

  if (alreadyMember) {
    return (
      <div className="mx-auto my-12 max-w-md rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-sm dark:border-emerald-900/60 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
          Bạn đã là thành viên của lớp này!
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Lớp: <strong>{invitation.className}</strong>
        </p>
        <Link
          to={`/app/classes/${invitation.classId}`}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
        >
          Vào lớp học ngay
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  if (existingRequest) {
    return (
      <div className="mx-auto my-12 max-w-md rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm dark:border-amber-900/60 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
          <Clock className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
          {existingRequest.status === 'pending'
            ? 'Đã gửi yêu cầu tham gia lớp'
            : existingRequest.status === 'approved'
            ? 'Yêu cầu đã được duyệt'
            : 'Yêu cầu tham gia đã bị từ chối'}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Lớp học: <strong>{invitation.className}</strong> (Chủ lớp:{' '}
          {invitation.ownerName})
        </p>
        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {existingRequest.status === 'pending'
            ? 'Để bảo vệ an toàn cho lớp học, chủ lớp sẽ xác nhận yêu cầu của bạn trước khi bạn có thể xem nội dung lớp.'
            : existingRequest.status === 'approved'
            ? 'Bạn đã được duyệt vào lớp.'
            : 'Vui lòng liên hệ người hướng dẫn nếu bạn cần hỗ trợ.'}
        </p>
        <Link
          to="/app/classes"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
        >
          Về trang Lớp của tôi
        </Link>
      </div>
    );
  }

  if (isExpired || isRevoked) {
    return (
      <div className="mx-auto my-12 max-w-md rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm dark:border-rose-900/60 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
          {isRevoked ? 'Lời mời này đã bị hủy' : 'Lời mời này đã hết hạn'}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Lời mời vào lớp <strong>{invitation.className}</strong> không còn hiệu
          lực. Vui lòng nhờ chủ lớp ({invitation.ownerName}) gửi đường link mới.
        </p>
        <Link
          to="/app/classes"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white dark:bg-white dark:text-slate-900"
        >
          Về trang Lớp của tôi
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto my-8 max-w-md rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
          <KeyRound className="h-6 w-6" />
        </div>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Lời mời tham gia lớp
          </span>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
            {invitation.className}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Người hướng dẫn: <strong>{invitation.ownerName}</strong>
          </p>
        </div>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
        {submitError && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
          >
            {submitError}
          </div>
        )}

        <div>
          <label
            htmlFor="join-code-input"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
          >
            Nhập mã tham gia (6 ký tự) *
          </label>
          <input
            id="join-code-input"
            type="text"
            required
            maxLength={16}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="VD: 3A2026"
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-center text-lg font-extrabold tracking-widest uppercase text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            (Gợi ý mã mẫu cho link demo <code>cls_toan_tv_lop3.inv_lop3_demo_token_2026</code>: nhập <strong>3A2026</strong>)
          </p>
        </div>

        <div>
          <label
            htmlFor="join-message-input"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
          >
            Lời nhắn gửi chủ lớp
          </label>
          <input
            id="join-message-input"
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              Sau khi gửi mã hợp lệ, yêu cầu của bạn sẽ ở trạng thái{' '}
              <strong>Chờ duyệt (Pending)</strong>. Chủ lớp cần xác nhận trước khi
              bạn chính thức trở thành học sinh trong lớp.
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? 'Đang kiểm tra & gửi yêu cầu...' : 'Gửi yêu cầu tham gia lớp'}
        </button>
      </form>
    </div>
  );
}

