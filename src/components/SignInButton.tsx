'use client';

import { signInWithGoogle } from '@/lib/useSession';

export function SignInButton({ label = 'Sign in with Google' }: { label?: string }) {
  return (
    <button
      onClick={() => signInWithGoogle()}
      className="w-full rounded-xl border border-slate-300 bg-white px-5 py-4 text-lg font-semibold text-slate-700 shadow-sm active:scale-[0.99]"
    >
      {label}
    </button>
  );
}
