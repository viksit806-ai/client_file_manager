'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { LogIn } from 'lucide-react';

export default function LoginPage() {
  const { login, rememberEmail } = useAuth();

  const [email, setEmail] = useState(rememberEmail);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(!!rememberEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { user, mustChangePassword } = await login(
        email,
        password,
        remember
      );

      toast.success('Login successful');

      if (mustChangePassword) {
        router.push('/change-password');
      } else if (user.role === 'super_admin') {
        router.push('/admin/dashboard');
      } else if (user.role === 'department') {
        router.push('/department/dashboard');
      } else if (user.role === 'customer') {
        router.push('/customer/dashboard');
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.message || err.message || 'Login failed';

      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-950 via-black to-neutral-900 dark:from-neutral-100 dark:via-white dark:to-neutral-50 px-4 py-8 overflow-hidden">
      <div className="relative w-full max-w-md">
        <div className="bg-neutral-900 dark:bg-white rounded-2xl border border-neutral-700/50 dark:border-neutral-200 shadow-2xl shadow-black/30 dark:shadow-neutral-300/30 p-6 sm:p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20">
              <LogIn className="w-8 h-8 text-white" />
            </div>

            <h1 className="text-2xl font-bold text-white dark:text-neutral-900">
              CA Consultancy Portal
            </h1>

            <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-2">
              Sign in to your account
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-800/50 dark:border-red-200 bg-red-950/50 dark:bg-red-50 px-4 py-3 text-sm text-red-400 dark:text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-neutral-400 dark:text-neutral-600">
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-xl border border-neutral-700 dark:border-neutral-300 bg-neutral-800 dark:bg-neutral-100 px-4 py-3 text-neutral-100 dark:text-neutral-900 placeholder-neutral-500 outline-none transition focus:border-amber-500 dark:focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-neutral-400 dark:text-neutral-600">
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-xl border border-neutral-700 dark:border-neutral-300 bg-neutral-800 dark:bg-neutral-100 px-4 py-3 text-neutral-100 dark:text-neutral-900 placeholder-neutral-500 outline-none transition focus:border-amber-500 dark:focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  id="remember"
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-600 dark:border-neutral-300 text-amber-500 focus:ring-amber-500/30"
                />
                <span className="text-sm text-neutral-400 dark:text-neutral-600">
                  Remember me
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 font-semibold text-white transition hover:from-amber-600 hover:to-amber-700 disabled:cursor-not-allowed disabled:opacity-50 shadow-lg shadow-amber-500/20"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}