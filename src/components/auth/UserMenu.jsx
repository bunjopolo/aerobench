import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth.jsx'
import { AlertDialog, Dialog } from '../ui'

export const UserMenu = () => {
  const { user, signOut, deleteAccount } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [errorDialog, setErrorDialog] = useState({ open: false, title: 'Error', message: '' })
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!user) return null

  const avatarUrl = user.user_metadata?.avatar_url
  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 p-1 rounded-lg hover:bg-slate-700/50 transition-colors"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white font-medium">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-dark-card rounded-lg shadow-lg border border-dark-border py-1 z-50 animate-fade-in">
          <div className="px-4 py-2 border-b border-dark-border">
            <p className="text-sm text-white font-medium truncate">{displayName}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
          <button
            onClick={() => {
              setShowSettings(true)
              setIsOpen(false)
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-slate-700/50 transition-colors"
          >
            Settings
          </button>
          <button
            onClick={async () => {
              setIsOpen(false)
              setSigningOut(true)
              try {
                await signOut()
              } catch (err) {
                setErrorDialog({
                  open: true,
                  title: 'Error Signing Out',
                  message: err?.message || 'Failed to sign out. Please try again.'
                })
              } finally {
                setSigningOut(false)
              }
            }}
            disabled={signingOut}
            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700/50 transition-colors"
          >
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      )}

      {/* Settings Modal */}
      <Dialog
        isOpen={showSettings}
        onClose={() => {
          setShowSettings(false)
          setConfirmDelete(false)
          setDeleteText('')
        }}
      >
            <div className="flex justify-between items-center p-4 border-b border-dark-border">
              <h2 className="text-lg font-bold text-white">Settings</h2>
              <button
                onClick={() => {
                  setShowSettings(false)
                  setConfirmDelete(false)
                  setDeleteText('')
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Account Info */}
              <div>
                <h3 className="label-sm mb-2">Account</h3>
                <div className="bg-dark-bg p-3 rounded-lg border border-dark-border">
                  <p className="text-sm text-white">{displayName}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
              </div>

              {/* Danger Zone */}
              <div>
                <h3 className="label-sm mb-2 text-red-400">Danger Zone</h3>
                <div className="bg-red-900/20 p-4 rounded-lg border border-red-900/50">
                  {!confirmDelete ? (
                    <>
                      <p className="text-sm text-gray-300 mb-3">
                        Permanently delete your account and all associated data including setups, analyses, and comparisons.
                      </p>
                      <button
                        onClick={() => setConfirmDelete(true)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded transition-colors"
                      >
                        Delete Account
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-red-300 mb-3">
                        This action cannot be undone. Type <span className="font-mono font-bold">DELETE</span> to confirm.
                      </p>
                      <input
                        type="text"
                        value={deleteText}
                        onChange={(e) => setDeleteText(e.target.value)}
                        placeholder="Type DELETE to confirm"
                        className="input-dark w-full mb-3"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setConfirmDelete(false)
                            setDeleteText('')
                          }}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium rounded transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            if (deleteText !== 'DELETE') return
                            setDeleting(true)
                            try {
                              await deleteAccount()
                            } catch (err) {
                              setErrorDialog({
                                open: true,
                                title: 'Error Deleting Account',
                                message: err.message
                              })
                              setDeleting(false)
                            }
                          }}
                          disabled={deleteText !== 'DELETE' || deleting}
                          className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                            deleteText === 'DELETE' && !deleting
                              ? 'bg-red-600 hover:bg-red-500 text-white'
                              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {deleting ? 'Deleting...' : 'Permanently Delete'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
      </Dialog>

      {/* Error Alert Dialog */}
      <AlertDialog
        isOpen={errorDialog.open}
        onClose={() => setErrorDialog({ open: false, title: 'Error', message: '' })}
        title={errorDialog.title}
        message={errorDialog.message}
        variant="error"
      />
    </div>
  )
}
