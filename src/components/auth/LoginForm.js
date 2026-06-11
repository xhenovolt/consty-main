/**
 * Login Form Component - Futuristic Glassmorphism
 * Handles user authentication with email and password,
 * and biometric (passkey) authentication via WebAuthn.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, ArrowRight, Fingerprint } from 'lucide-react';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // If user already has a valid session, skip the login page silently.
  // We check /api/auth/me here (not in middleware) because middleware cannot
  // query the DB — it can only see the cookie, which may be stale.
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => { if (r.ok) router.replace('/app/dashboard'); })
      .catch(() => {}); // silent — let the user log in normally if check fails
  }, [router]);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBioLoading, setIsBioLoading] = useState(false);
  const [error, setError] = useState('');
  const [bioSupported, setBioSupported] = useState(false);

  // Detect platform authenticator support
  useEffect(() => {
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(ok => setBioSupported(ok))
        .catch(() => setBioSupported(false));
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      // Redirect to forced password reset if flagged
      if (data.requirePasswordReset) {
        router.push('/setup-password');
        return;
      }

      router.push('/app/dashboard');
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const inputClasses = 'w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground dark:bg-white/[0.06] dark:border-white/[0.1] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 backdrop-blur-sm transition-all duration-200 disabled:opacity-50';

  // ── Biometric login ─────────────────────────────────────────────────────
  async function handleBiometricLogin() {
    setError('');
    setIsBioLoading(true);
    try {
      let startAuthentication;
      try {
        const mod = await import('@simplewebauthn/browser');
        startAuthentication = mod.startAuthentication;
      } catch {
        setError('WebAuthn library unavailable. Please use password login.');
        return;
      }

      // 1. Get authentication options (optionally pass email to scope credentials)
      const params = email ? `?email=${encodeURIComponent(email)}` : '';
      const optRes = await fetch(`/api/auth/passkeys/authenticate-options${params}`, {
        credentials: 'include',
      });
      const optData = await optRes.json();
      if (!optData.success) {
        setError(optData.error || 'Failed to start biometric login');
        return;
      }

      // 2. Invoke platform authenticator
      let credential;
      try {
        credential = await startAuthentication({ optionsJSON: optData.options });
      } catch (err) {
        if (err.name === 'NotAllowedError') {
          setError('Biometric prompt was dismissed. Please try again or use your password.');
        } else if (err.name === 'NotSupportedError') {
          setError('No registered biometric found for this device. Use password login.');
        } else {
          setError(`Biometric error: ${err.message}`);
        }
        return;
      }

      // 3. Verify on server → creates session → sets cookie
      const authRes = await fetch('/api/auth/passkeys/authenticate', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ credential, email }),
      });
      const authData = await authRes.json();
      if (!authRes.ok || !authData.success) {
        setError(authData.error || 'Biometric authentication failed');
        return;
      }

      router.push('/app/dashboard');
    } catch {
      setError('Biometric authentication failed. Please try again.');
    } finally {
      setIsBioLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 w-full">
      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-2">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          disabled={isLoading}
          className={inputClasses}
        />
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-muted-foreground mb-2">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={isLoading}
            className={inputClasses}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            disabled={isLoading}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading || !email || !password}
        className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 text-white font-medium rounded-xl transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            Sign In
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      {/* Biometric login — only shown when platform authenticator is available */}
      {bioSupported && (
        <>
          <div className="relative flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <button
            type="button"
            onClick={handleBiometricLogin}
            disabled={isBioLoading || isLoading}
            className="w-full py-3 px-4 border border-border bg-muted/30 hover:bg-muted/60 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-foreground font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isBioLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Fingerprint className="w-5 h-5 text-blue-500" />
                Sign in with Fingerprint / Face
              </>
            )}
          </button>
        </>
      )}

      {/* Access guidance */}
      <p className="text-center text-sm text-muted-foreground">
        Need access?{' '}
        <a href="/register" className="text-primary hover:text-primary/80 font:medium transition-colors">
          Contact your administrator
        </a>
      </p>
    </form>
  );
}
