import { useState } from 'react'

export const CookieNotice = ({ onShowPrivacy }) => {
  const [visible, setVisible] = useState(() => !localStorage.getItem('cookiesAccepted'))

  const acceptCookies = () => {
    localStorage.setItem('cookiesAccepted', 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-dark-card border-t border-dark-border shadow-2xl animate-fade-in">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex-1 text-sm text-gray-300">
          <p>
            <strong className="text-white">Cookie Notice:</strong> We use essential cookies to keep you 
            signed in and remember your preferences. We also use cookies to understand how you use our 
            app so we can improve it. By continuing to use AeroBench, you consent to our use of cookies.{' '}
            <button
              onClick={onShowPrivacy}
              className="text-brand-primary hover:text-indigo-400 underline"
            >
              Learn more in our Privacy Policy
            </button>
          </p>
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <button
            onClick={acceptCookies}
            className="px-6 py-2 bg-brand-primary hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
