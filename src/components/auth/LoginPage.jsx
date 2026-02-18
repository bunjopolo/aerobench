import { useAuth } from '../../hooks/useAuth.jsx'

export const LoginPage = ({ onShowPrivacy, onShowTerms, onTryQuickTest }) => {
  const { signInWithGoogle } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg">
      <div className="card max-w-md w-full mx-4 p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-3">
            <svg className="w-10 h-10 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AeroBench
          </h1>
          <p className="text-gray-400 mt-2">
            Virtual Elevation Analysis & Performance Estimator
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-medium py-3 px-4 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <button
            type="button"
            onClick={onTryQuickTest}
            className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-4 rounded-lg border border-indigo-500 shadow-sm transition-colors"
          >
            Try Calculator (Saving Disabled)
          </button>
        </div>

        <div className="mt-5 rounded-lg border border-dark-border bg-dark-card/60 p-3">
          <p className="text-xs font-semibold text-gray-300 mb-2">Privacy note</p>
          <p className="text-xs text-gray-400">
            Your uploaded FIT ride files (and simulator route GPX files) stay in your browser and are not stored on AeroBench servers.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            We only store your account details and the results/settings you choose to save. If you use weather fetch, location/date is sent to Open-Meteo to get weather data.
          </p>
        </div>

        <p className="text-center text-xs text-gray-500 mt-8">
          By signing in, you agree to our{' '}
          <button onClick={onShowTerms} className="text-brand-primary hover:text-indigo-400 underline">
            Terms of Service
          </button>{' '}
          and{' '}
          <button onClick={onShowPrivacy} className="text-brand-primary hover:text-indigo-400 underline">
            Privacy Policy
          </button>
        </p>
      </div>
    </div>
  )
}
