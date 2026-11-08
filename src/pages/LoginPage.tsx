import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Lock,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function LoginPage() {
  const {
    user,
    loading,
    error,
    isDemoMode,
    demoPersonas,
    signInWithGoogle,
    signInAsDemoPersona,
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/app/classes';

  useEffect(() => {
    if (!loading && user) {
      navigate(redirectTo, { replace: true });
    }
  }, [loading, user, navigate, redirectTo]);

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
      navigate(redirectTo, { replace: true });
    } catch {
      // Error is handled in AuthContext
    }
  };

  const handlePersonaLogin = async (uid: string) => {
    await signInAsDemoPersona(uid);
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/70 via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Cột trái: Giới thiệu sản phẩm */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-100/80 px-3.5 py-1.5 text-xs font-bold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200">
            <Sparkles className="h-3.5 w-3.5" />
            Góc học tập 60 phút mỗi tối cho gia đình & lớp kèm
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
            Đồng hành cùng em học tập mỗi tối thật{' '}
            <span className="text-emerald-600 dark:text-emerald-400">
              nhẹ nhàng & kỷ luật
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            <strong>StudyNest</strong> giúp anh chị, phụ huynh và giáo viên kèm cặp
            học sinh tiểu học theo nhịp 60 phút rõ ràng: xem hôm nay học gì, ôn từ
            khóa, làm nhiệm vụ, soạn cặp ngày mai và tích lũy chuỗi ngày học.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <Clock className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Buổi học 60 phút tập trung
                </h2>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  15p bài cũ • 30p bài mới • 10p soạn cặp • 5p tổng kết.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <Star className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Sao thưởng & Streak trung thực
                </h2>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  Chỉ cộng sao & chuỗi ngày học khi người hướng dẫn đã xác nhận.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <Users className="h-5 w-5 shrink-0 text-sky-600 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Nhiều lớp, phân quyền rõ ràng
                </h2>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  Mỗi người có thể vừa dạy lớp A, vừa là học viên ở lớp B.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <Lock className="h-5 w-5 shrink-0 text-violet-600 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  An toàn cho học sinh nhỏ tuổi
                </h2>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  Không mạng xã hội, không hồ sơ công khai, phê duyệt vào lớp.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Cột phải: Thẻ đăng nhập */}
        <div className="lg:col-span-5">
          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Đăng nhập StudyNest
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sử dụng tài khoản Google để vào góc học tập
                </p>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200"
              >
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleGoogleLogin()}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
                />
              </svg>
              Tiếp tục với tài khoản Google
            </button>

            {isDemoMode && (
              <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Trải nghiệm nhanh (Demo Local)
                  </span>
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    Không cần .env
                  </span>
                </div>
                <div className="space-y-2.5">
                  {demoPersonas.map((p) => (
                    <button
                      key={p.uid}
                      type="button"
                      onClick={() => void handlePersonaLogin(p.uid)}
                      className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-left transition hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:border-emerald-700"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          {p.displayName}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {p.roleHint}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-6 text-center text-[11px] text-slate-500 dark:text-slate-400">
              StudyNest chỉ lưu thông tin hồ sơ tối thiểu (Tên hiển thị, UID) để phân
              quyền lớp học. Không thu thập số điện thoại, ngày sinh hay địa chỉ của trẻ.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

