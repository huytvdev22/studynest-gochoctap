import React from 'react';
import {
  BookOpen,
  Compass,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Star,
  UserCheck,
} from 'lucide-react';
import type { ClassRole, ClassThemeColor, ClassThemeIcon } from '@/types/domain';

// eslint-disable-next-line react-refresh/only-export-components
export const THEME_COLOR_STYLES: Record<
  ClassThemeColor,
  {
    bgSoft: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    iconBg: string;
    accentBar: string;
  }
> = {
  emerald: {
    bgSoft: 'bg-emerald-50/70 dark:bg-emerald-950/30',
    border: 'border-emerald-200/80 dark:border-emerald-800/60',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-900/60',
    badgeText: 'text-emerald-800 dark:text-emerald-200',
    iconBg: 'bg-emerald-600 text-white',
    accentBar: 'bg-emerald-500',
  },
  sky: {
    bgSoft: 'bg-sky-50/70 dark:bg-sky-950/30',
    border: 'border-sky-200/80 dark:border-sky-800/60',
    badgeBg: 'bg-sky-100 dark:bg-sky-900/60',
    badgeText: 'text-sky-800 dark:text-sky-200',
    iconBg: 'bg-sky-600 text-white',
    accentBar: 'bg-sky-500',
  },
  amber: {
    bgSoft: 'bg-amber-50/70 dark:bg-amber-950/30',
    border: 'border-amber-200/80 dark:border-amber-800/60',
    badgeBg: 'bg-amber-100 dark:bg-amber-900/60',
    badgeText: 'text-amber-800 dark:text-amber-200',
    iconBg: 'bg-amber-500 text-white',
    accentBar: 'bg-amber-500',
  },
  violet: {
    bgSoft: 'bg-violet-50/70 dark:bg-violet-950/30',
    border: 'border-violet-200/80 dark:border-violet-800/60',
    badgeBg: 'bg-violet-100 dark:bg-violet-900/60',
    badgeText: 'text-violet-800 dark:text-violet-200',
    iconBg: 'bg-violet-600 text-white',
    accentBar: 'bg-violet-500',
  },
  rose: {
    bgSoft: 'bg-rose-50/70 dark:bg-rose-950/30',
    border: 'border-rose-200/80 dark:border-rose-800/60',
    badgeBg: 'bg-rose-100 dark:bg-rose-900/60',
    badgeText: 'text-rose-800 dark:text-rose-200',
    iconBg: 'bg-rose-600 text-white',
    accentBar: 'bg-rose-500',
  },
};

export function ClassIconView({
  icon,
  className = 'h-5 w-5',
}: {
  icon: ClassThemeIcon;
  className?: string;
}) {
  switch (icon) {
    case 'star':
      return <Star className={className} />;
    case 'compass':
      return <Compass className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
    case 'graduation-cap':
      return <GraduationCap className={className} />;
    case 'book-open':
    default:
      return <BookOpen className={className} />;
  }
}

export function RoleBadge({ role }: { role: ClassRole }) {
  if (role === 'owner') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
        <ShieldCheck className="h-3.5 w-3.5" />
        Chủ lớp
      </span>
    );
  }
  if (role === 'instructor') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800 dark:bg-sky-900/60 dark:text-sky-200">
        <UserCheck className="h-3.5 w-3.5" />
        Người hướng dẫn
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
      <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
      Học sinh
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center dark:border-slate-800 dark:bg-slate-900/50">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
        {icon}
      </div>
      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      <p className="mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
