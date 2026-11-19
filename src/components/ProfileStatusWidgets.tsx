import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit3,
  FileCheck2,
  Send,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { ProfileApprovalStatus } from '../types';

export function formatApprovalStatusLabel(status: ProfileApprovalStatus | string): string {
  switch (status) {
    case 'WAITING_FOR_APPROVAL':
      return 'WAITING FOR APPROVAL';
    case 'APPROVED':
      return 'APPROVED';
    case 'REJECTED':
      return 'REJECTED';
    case 'CORRECTION_REQUESTED':
      return 'CORRECTION REQUESTED';
    case 'DRAFT':
      return 'DRAFT';
    default:
      return String(status || 'APPROVED').replace(/_/g, ' ');
  }
}

export function ProfileApprovalBadge({ status }: { status: ProfileApprovalStatus | string }) {
  const s = status || 'APPROVED';
  if (s === 'APPROVED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>APPROVED</span>
      </span>
    );
  }
  if (s === 'WAITING_FOR_APPROVAL') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/80 whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>WAITING FOR APPROVAL</span>
      </span>
    );
  }
  if (s === 'REJECTED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/80 whitespace-nowrap">
        <XCircle className="w-3.5 h-3.5 shrink-0" />
        <span>REJECTED</span>
      </span>
    );
  }
  if (s === 'CORRECTION_REQUESTED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide bg-orange-50 text-orange-800 border border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-700/80 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>CORRECTION REQUESTED</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 whitespace-nowrap">
      <Edit3 className="w-3.5 h-3.5 shrink-0" />
      <span>DRAFT</span>
    </span>
  );
}

export function ProfileProgressTimeline({
  status,
  hasAnySubmission = true,
}: {
  status: ProfileApprovalStatus | string;
  hasAnySubmission?: boolean;
}) {
  const s = status || 'APPROVED';
  // 5 stages:
  // 1: Profile Edited
  // 2: Submitted
  // 3: Faculty Review
  // 4: Approved (or Rejected / Corrections Requested)
  // 5: Official Profile Updated
  let activeStage = 5;
  if (!hasAnySubmission && s === 'APPROVED') {
    activeStage = 5;
  } else if (s === 'DRAFT') {
    activeStage = 1;
  } else if (s === 'WAITING_FOR_APPROVAL') {
    activeStage = 3;
  } else if (s === 'REJECTED' || s === 'CORRECTION_REQUESTED') {
    activeStage = 3;
  } else if (s === 'APPROVED') {
    activeStage = 5;
  }

  const stage4Label =
    s === 'REJECTED' ? 'Rejected' : s === 'CORRECTION_REQUESTED' ? 'Corrections Needed' : 'Approved';

  const stages = [
    { step: 1, label: 'Profile Edited', icon: Edit3 },
    { step: 2, label: 'Submitted', icon: Send },
    { step: 3, label: 'Faculty Review', icon: UserCheck },
    { step: 4, label: stage4Label, icon: s === 'REJECTED' ? XCircle : s === 'CORRECTION_REQUESTED' ? AlertTriangle : ShieldCheck },
    { step: 5, label: 'Official Profile Updated', icon: FileCheck2 },
  ];

  return (
    <div className="w-full overflow-x-auto pb-1">
      <div className="min-w-[540px] grid grid-cols-5 gap-2 items-start">
        {stages.map((st, idx) => {
          const Icon = st.icon;
          const isCompleted =
            s === 'APPROVED'
              ? true
              : s === 'DRAFT'
              ? st.step === 1
              : s === 'WAITING_FOR_APPROVAL'
              ? st.step <= 2
              : st.step <= 3;
          const isCurrent =
            (s === 'WAITING_FOR_APPROVAL' && st.step === 3) ||
            (s === 'DRAFT' && st.step === 1) ||
            ((s === 'REJECTED' || s === 'CORRECTION_REQUESTED') && st.step === 4) ||
            (s === 'APPROVED' && st.step === 5);

          const isNegative = (s === 'REJECTED' || s === 'CORRECTION_REQUESTED') && st.step === 4;

          return (
            <div key={st.step} className="relative flex flex-col items-center text-center">
              {idx < stages.length - 1 && (
                <div
                  className={`absolute top-4 left-[55%] right-[-45%] h-0.5 ${
                    st.step < activeStage && !isNegative
                      ? 'bg-emerald-500 dark:bg-emerald-500/80'
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              )}
              <div
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border text-xs font-bold transition-colors ${
                  isNegative
                    ? s === 'REJECTED'
                      ? 'bg-red-50 border-red-400 text-red-700 dark:bg-red-950/60 dark:border-red-700 dark:text-red-300'
                      : 'bg-orange-50 border-orange-400 text-orange-700 dark:bg-orange-950/60 dark:border-orange-700 dark:text-orange-300'
                    : isCurrent && s === 'WAITING_FOR_APPROVAL'
                    ? 'bg-amber-50 border-amber-400 text-amber-700 dark:bg-amber-950/60 dark:border-amber-600 dark:text-amber-300'
                    : isCompleted
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-white dark:bg-[#101827] border-slate-300 dark:border-slate-700 text-slate-400'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span
                className={`mt-1.5 text-[11px] font-medium leading-tight px-1 ${
                  isNegative
                    ? s === 'REJECTED'
                      ? 'text-red-700 dark:text-red-300 font-semibold'
                      : 'text-orange-700 dark:text-orange-300 font-semibold'
                    : isCurrent
                    ? 'text-[#101A35] dark:text-white font-semibold'
                    : isCompleted
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {st.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
