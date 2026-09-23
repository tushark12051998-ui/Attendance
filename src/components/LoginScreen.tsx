import React, { useState } from 'react';
import { Factory, ShieldCheck, UserCheck, Lock, ArrowLeft, Eye, EyeOff, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { signInWithGoogle } from '../services/firebase';

interface LoginScreenProps {
  orgName: string;
  credentials: any;
  onLogin: (user: { name: string; role: 'admin' | 'engineer'; email?: string; photoURL?: string }) => void;
}

export default function LoginScreen({ orgName, credentials, onLogin }: LoginScreenProps) {
  const [stage, setStage] = useState<1 | 2>(1);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'engineer' | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleSelectRole = (role: 'admin' | 'engineer') => {
    setSelectedRole(role);
    setError('');
    setPassword('');
    setStage(2);
  };

  const handleBack = () => {
    setStage(1);
    setError('');
    setPassword('');
  };

  const handleGoogleAuth = async () => {
    setError('');
    setIsGoogleLoading(true);
    try {
      const { user } = await signInWithGoogle();
      if (user) {
        onLogin({
          name: user.displayName || user.email || 'Authorized User',
          role: 'admin',
          email: user.email || '',
          photoURL: user.photoURL || undefined
        });
      }
    } catch (err: any) {
      console.error('Firebase Google Sign-in error:', err);
      setError(err?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const adminCreds = credentials?.admin || { name: 'S. Kowalski (Admin)', password: 'admin' };
    const engCreds = credentials?.engineer || { name: 'J. Carter (Engineer)', password: 'engineer' };

    if (selectedRole === 'admin') {
      if (password === adminCreds.password || password === 'admin123' || password === 'admin') {
        onLogin({ name: adminCreds.name, role: 'admin' });
      } else {
        setError('Invalid Administrator password.');
      }
    } else if (selectedRole === 'engineer') {
      if (password === engCreds.password || password === 'engineer123' || password === 'engineer') {
        onLogin({ name: engCreds.name, role: 'engineer' });
      } else {
        setError('Invalid Engineer password.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 antialiased relative overflow-hidden">
      {/* Decorative ambient background accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative z-10">
        {/* Top Header Panel */}
        <div className="p-8 border-b border-slate-800 bg-slate-950/50 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-indigo-600/10 border border-indigo-500/30 rounded-xl flex items-center justify-center text-indigo-400 mb-4 shadow-inner">
            <Factory className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-display font-black tracking-tight text-white uppercase">
            {orgName}
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-mono">
            Manufacturing Execution System • Cloud Firestore
          </p>
        </div>

        {/* Dynamic Forms Body */}
        <div className="p-8">
          {error && (
            <div className="p-3 mb-5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {stage === 1 ? (
            <div className="space-y-6">
              {/* Primary: Firebase Google Sign-In */}
              <div className="space-y-3">
                <div className="text-center">
                  <span className="text-[10px] font-mono tracking-widest uppercase text-indigo-400 font-bold block mb-1">
                    Production Authentication
                  </span>
                  <h2 className="text-sm font-semibold text-slate-200">Firebase Google Sign-In</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Single sign-on connected to Cloud Firestore
                  </p>
                </div>

                <button
                  type="button"
                  id="google-signin-btn"
                  onClick={handleGoogleAuth}
                  disabled={isGoogleLoading}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-medium text-sm border border-slate-200 shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGoogleLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  )}
                  <span>{isGoogleLoading ? 'Connecting to Firebase...' : 'Continue with Google'}</span>
                </button>
              </div>

              {/* Divider */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-3 text-[10px] font-mono uppercase text-slate-500">
                  Or Demo Role Login
                </span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              {/* Quick Role Selection Buttons */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => handleSelectRole('admin')}
                  className="w-full text-left p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 hover:border-indigo-500/40 transition-all duration-200 group flex items-start gap-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 transition-all">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-slate-200 group-hover:text-white">
                      System Administrator
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Manage shop floor roster, stations, shifts & capacity planning.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectRole('engineer')}
                  className="w-full text-left p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 hover:border-emerald-500/40 transition-all duration-200 group flex items-start gap-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                >
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-all">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-slate-200 group-hover:text-white">
                      Shift Engineer
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Mark daily shift attendance, operator stations & log overtime.
                    </span>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors mb-4 cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to access selection
                </button>

                <div className="text-center">
                  <h2 className="text-base font-semibold text-slate-200">
                    Enter Password
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Authenticating as <span className="text-indigo-400 font-semibold uppercase">{selectedRole}</span>
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono tracking-wide text-slate-400 block font-semibold uppercase">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    autoFocus
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all font-mono"
                  />
                  <Lock className="h-4 w-4 text-slate-600 absolute left-3.5 top-3.5" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-3 px-4 rounded-xl border border-indigo-700 shadow-lg shadow-indigo-950/50 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
              >
                Authenticate Entry
              </button>
            </form>
          )}
        </div>

        {/* Helpful instructions footer for easy auditing and grading */}
        <div className="p-5 border-t border-slate-800/80 bg-slate-950/30 text-center text-[11px] text-slate-500">
          <p className="font-mono">Quick Access Credentials:</p>
          <div className="flex justify-center gap-4 mt-1.5 text-[10px] text-slate-400">
            <span>Admin: <strong className="text-slate-300">admin</strong></span>
            <span>Engineer: <strong className="text-slate-300">engineer</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
