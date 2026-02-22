"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading'|'success'|'error'>('loading');
  const [message, setMessage] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-md text-center">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800">
          <Suspense fallback={<p className="text-slate-600">Verifying...</p>}>
            <VerifyEmailContent setStatus={setStatus} setMessage={setMessage} status={status} message={message} router={router} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function VerifyEmailContent({ setStatus, setMessage, status, message, router }: { setStatus: any, setMessage: any, status: 'loading'|'success'|'error', message: string, router: any }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Missing token');
      return;
    }
    (async () => {
      try {
        await api(`/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`, { method: 'GET' });
        setStatus('success');
        setMessage('Email verified. You can now sign in.');
        setTimeout(() => router.push('/login'), 2500);
      } catch (e: any) {
        setStatus('error');
        setMessage(e.message || 'Verification failed');
      }
    })();
  }, [searchParams]);

  return (
    <>
      {status === 'loading' && <p className="text-slate-600">Verifying...</p>}
      {status === 'success' && <p className="text-green-600">{message}</p>}
      {status === 'error' && <p className="text-red-600">{message}</p>}
    </>
  );
}
