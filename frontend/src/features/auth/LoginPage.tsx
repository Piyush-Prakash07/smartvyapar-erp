import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import {
  Landmark,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Lock,
  UserCheck,
  Eye,
  EyeOff,
} from 'lucide-react';

interface LoginPageProps {
  onNavigateToRegister: () => void;
  onNavigateToVerifyEmail?: (email: string) => void;
  initialMessage?: string;
}

export default function LoginPage({
  onNavigateToRegister,
  onNavigateToVerifyEmail,
  initialMessage,
}: LoginPageProps) {
  const { login } = useAuth();

  // Input states
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status states
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState(initialMessage || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Please enter your email or mobile number and password.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setInfoMessage('');

    try {
      await login({
        identifier: identifier.trim(),
        password,
      });
    } catch (err: unknown) {
      let message = 'Login failed. Please check your credentials and try again.';
      let requiresVerification = false;
      let userEmail = identifier.includes('@') ? identifier.trim() : '';

      if (
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'data' in err.response &&
        err.response.data &&
        typeof err.response.data === 'object'
      ) {
        const data = err.response.data as Record<string, unknown>;
        if (data.message) {
          message = String(data.message);
        }
        if (data.requiresEmailVerification === true) {
          requiresVerification = true;
          if (data.email && typeof data.email === 'string') {
            userEmail = data.email;
          }
        }
      }

      if (requiresVerification && onNavigateToVerifyEmail) {
        onNavigateToVerifyEmail(userEmail);
        return;
      }

      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glowing gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="flex justify-center items-center gap-3 mb-2">
          <div className="p-3 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-2xl shadow-xl shadow-indigo-500/25 ring-1 ring-white/20">
            <Landmark className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              SmartVyapar <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">ERP</span>
            </h2>
          </div>
        </div>
        <p className="text-center text-sm text-slate-400">
          Smart Business &amp; GST Accounting Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="bg-slate-900/80 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-3xl border border-slate-800/80 sm:px-10">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              Welcome Back <Sparkles className="w-5 h-5 text-amber-400" />
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Sign in with your registered email address or 10-digit mobile number
            </p>
          </div>

          {/* Success / Info Message */}
          {infoMessage && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-start gap-3 animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">{infoMessage}</div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email or Mobile Number Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Email Address or Mobile Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <UserCheck className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. name@company.com or 9876543210"
                  autoComplete="username"
                  className="block w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-slate-700/70 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="block w-full pl-10 pr-11 py-3 bg-slate-950/60 border border-slate-700/70 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-indigo-600/30 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.99]"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing In...
                </>
              ) : (
                <>
                  Sign In to ERP
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Switch to Register */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
            <p className="text-sm text-slate-400">
              Don't have a SmartVyapar account?{' '}
              <button
                type="button"
                onClick={onNavigateToRegister}
                className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1"
              >
                Register your business <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
