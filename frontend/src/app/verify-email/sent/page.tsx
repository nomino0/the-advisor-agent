"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { toast } from "react-hot-toast";

export default function VerifyEmailSentPage() {
  const router = useRouter();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    // optional: auto-redirect to login after a timeout
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-md text-center">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800">
          <Suspense fallback={<p className="text-slate-600">Loading...</p>}>
            <VerifyEmailSentContent router={router} sending={sending} setSending={setSending} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function VerifyEmailSentContent({ router, sending, setSending }: { router: any, sending: boolean, setSending: any }) {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  return (
    <>
      <h1 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Activate your account</h1>
      <p className="text-slate-600 dark:text-slate-400 mb-4">
        We sent a verification email{email ? ` to ${email}` : ""}. Please check your inbox and click the
        verification link to activate your account.
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        If you don't see the email, check your spam folder or click resend on the sign-in page.
      </p>

      <div className="flex gap-2 justify-center">
        <Link
          href="/login"
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
        >
          Go to Sign in
        </Link>
        <button
          onClick={() => router.push('/register')}
          className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700"
        >
          Back
        </button>
      </div>

      <div className="mt-6 text-center">
        <button
          onClick={async () => {
            if (!email) return toast.error('Missing email to resend');
            setSending(true);
            try {
              await api('/api/v1/auth/resend-verification', { method: 'POST', body: { email } });
              toast.success('If the email exists, a verification link was sent.');
            } catch (e: any) {
              toast.error(e.message || 'Failed to resend verification');
            } finally {
              setSending(false);
            }
          }}
          className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700"
          disabled={sending}
        >
          {sending ? 'Resending...' : 'Resend verification email'}
        </button>
      </div>
    </>
  );
}
