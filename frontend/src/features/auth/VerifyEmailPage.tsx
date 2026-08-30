import React, { useState, useEffect, useRef } from 'react';
import {
  Landmark,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  RotateCw,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { verifyEmail, resendVerificationOtp } from './api';

interface VerifyEmailPageProps {
  email: string;
  onNavigateToLogin: (verifiedMessage?: string) => void;
  onNavigateToRegister: () => void;
  onChangeEmail?: () => void;
}

export default function VerifyEmailPage({
  email: initialEmail,
  onNavigateToLogin,
  onNavigateToRegister,
}: VerifyEmailPageProps) {
  const [email, setEmail] = useState(initialEmail || '');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(60);
  const [isEditingEmail, setIsEditingEmail] = useState(!initialEmail);
  const [tempEmail, setTempEmail] = useState(initialEmail || '');

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 60-second countdown timer for resend cooldown
  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const interval = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  // Focus the first input on mount
  useEffect(() => {
    if (!isEditingEmail && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [isEditingEmail]);

  const handleDigitChange = (index: number, value: string) => {
    // If multiple digits pasted into a single box
    const cleanValue = value.replace(/[^0-9]/g, '');

    if (cleanValue.length > 1) {
      const pastedDigits = cleanValue.slice(0, 6).split('');
      const newDigits = [...otpDigits];
      pastedDigits.forEach((digit, i) => {
        if (index + i < 6) {
          newDigits[index + i] = digit;
        }
      });
      setOtpDigits(newDigits);
      const nextFocus = Math.min(index + pastedDigits.length, 5);
      inputRefs.current[nextFocus]?.focus();
      return;
    }

    const singleDigit = cleanValue.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = singleDigit;
    setOtpDigits(newDigits);

    // Auto-advance focus
    if (singleDigit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    if (!pastedData) return;

    const digits = pastedData.split('');
    const newDigits = ['', '', '', '', '', ''];
    digits.forEach((d, idx) => {
      newDigits[idx] = d;
    });
    setOtpDigits(newDigits);

    const nextIndex = Math.min(digits.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setSuccessMessage('');

    const completeOtp = otpDigits.join('');
    if (completeOtp.length !== 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    if (!email.trim()) {
      setError('Please enter a valid email address.');
      setIsEditingEmail(true);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await verifyEmail({
        email: email.trim().toLowerCase(),
        otp: completeOtp,
      });

      setSuccessMessage(res.message || 'Email verified successfully! Redirecting to login...');
      setTimeout(() => {
        onNavigateToLogin('Email verified successfully! Please log in to your account.');
      }, 1500);
    } catch (err: unknown) {
      let msg = 'Invalid or expired verification code. Please check and try again.';
      if (
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'data' in err.response &&
        err.response.data &&
        typeof err.response.data === 'object' &&
        'message' in err.response.data
      ) {
        msg = String(err.response.data.message);
      }
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldownSeconds > 0 || isResending) return;
    setError('');
    setSuccessMessage('');
    setIsResending(true);

    try {
      const res = await resendVerificationOtp({
        email: email.trim().toLowerCase(),
      });
      setSuccessMessage(res.message || 'A new verification code has been sent to your email.');
      setCooldownSeconds(60);
      setOtpDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err: unknown) {
      let msg = 'Failed to resend verification code. Please try again.';
      if (
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'data' in err.response &&
        err.response.data &&
        typeof err.response.data === 'object' &&
        'message' in err.response.data
      ) {
        msg = String(err.response.data.message);
      }
      setError(msg);
    } finally {
      setIsResending(false);
    }
  };

  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempEmail.trim() || !tempEmail.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }
    setEmail(tempEmail.trim());
    setIsEditingEmail(false);
    setError('');
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
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-3 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white flex items-center justify-center gap-2">
              Verify Your Email <Sparkles className="w-4 h-4 text-amber-400" />
            </h3>
            
            {isEditingEmail ? (
              <form onSubmit={handleSaveEmail} className="mt-3">
                <p className="text-xs text-slate-400 mb-2">Enter your registered email address:</p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={tempEmail}
                    onChange={(e) => setTempEmail(e.target.value)}
                    placeholder="name@business.com"
                    className="flex-1 px-3 py-2 bg-slate-950/60 border border-slate-700/70 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
                  >
                    Set
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-2 text-xs text-slate-400 flex items-center justify-center gap-1.5 flex-wrap">
                <span>We sent a 6-digit code to</span>
                <span className="font-semibold text-indigo-300 bg-indigo-950/50 px-2 py-0.5 rounded-lg border border-indigo-500/20">
                  {email || 'your email'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingEmail(true)}
                  className="text-slate-400 hover:text-indigo-300 underline text-[11px] ml-1"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-start gap-3 animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">{successMessage}</div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-6">
            {/* 6-Digit OTP Inputs */}
            <div>
              <label className="block text-center text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                Enter 6-Digit Code
              </label>
              <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => { inputRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    disabled={isSubmitting}
                    className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold bg-slate-950/70 border border-slate-700/80 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-inner transition-all disabled:opacity-50"
                  />
                ))}
              </div>
              <p className="text-[11px] text-center text-slate-500 mt-2">
                This verification code will expire in 10 minutes.
              </p>
            </div>

            {/* Verify Button */}
            <button
              type="submit"
              disabled={isSubmitting || otpDigits.join('').length !== 6}
              className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-indigo-600/30 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.99]"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying Account...
                </>
              ) : (
                <>
                  Verify &amp; Activate Account
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Resend OTP Section with Cooldown Timer */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-slate-400">Didn't receive the email code?</span>
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldownSeconds > 0 || isResending}
                className="font-medium text-xs text-indigo-400 hover:text-indigo-300 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                {cooldownSeconds > 0
                  ? `Resend Code in ${cooldownSeconds}s`
                  : isResending
                  ? 'Sending new code...'
                  : 'Resend Verification Code'}
              </button>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="mt-6 pt-4 border-t border-slate-800/40 flex items-center justify-between text-xs text-slate-400">
            <button
              type="button"
              onClick={() => onNavigateToLogin()}
              className="hover:text-slate-200 transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
            </button>
            <button
              type="button"
              onClick={onNavigateToRegister}
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              New Registration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
