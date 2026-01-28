import { useState, useEffect } from 'react'
import { useStudies } from '../../hooks/useStudies'
import { useAuth } from '../../hooks/useAuth.jsx'
import { getVariableType } from '../../lib/variableTypes'
import { CreateStudyModal } from './CreateStudyModal'
import { StudyDetail } from './StudyDetail'
import { ConfirmDialog } from '../ui'

const StudyCard = ({ study, onClick, onDelete }) => {
  const varType = getVariableType(study.variable_type)
  const isAveraging = study.study_mode === 'averaging'

  const handleDelete = (e) => {
    e.stopPropagation() // Prevent card click
    onDelete(study)
  }

  return (
    <div className="group w-full text-left bg-dark-card rounded-xl border border-dark-border p-4 hover:border-brand-primary/50 transition-all">
      <div className="flex items-start justify-between">
        <button onClick={onClick} className="flex-1 text-left">
          <h3 className="font-bold text-white mb-1">{study.name}</h3>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className={`px-2 py-0.5 rounded ${isAveraging ? 'bg-blue-900/30 text-blue-400' : 'bg-dark-bg'}`}>
              {isAveraging ? 'Averaging' : varType.label}
            </span>
            {!isAveraging && (
              <span>{study.variation_count || 0} configurations</span>
            )}
            <span className="text-gray-500">{study.mass}kg</span>
          </div>
          {study.description && (
            <p className="text-xs text-gray-500 mt-2 line-clamp-2">{study.description}</p>
          )}
        </button>
        <div className="flex items-center gap-2 ml-4">
          <span className="text-xs text-gray-500">
            {new Date(study.created_at).toLocaleDateString()}
          </span>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-lg bg-dark-bg border border-dark-border text-gray-500 hover:text-red-400 hover:border-red-500/50 hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
            title="Delete study"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export const StudiesTab = ({ initialStudyId, onStudyOpened, presetsHook }) => {
  const { user } = useAuth()
  const { studies, loading, createStudy, deleteStudy } = useStudies()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [viewingStudyId, setViewingStudyId] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, study: null })

  // Handle navigation from Dashboard
  useEffect(() => {
    if (initialStudyId) {
      setViewingStudyId(initialStudyId)
      onStudyOpened?.()
    }
  }, [initialStudyId, onStudyOpened])

  // Handle delete from list view
  const handleDeleteClick = (study) => {
    setDeleteDialog({ open: true, study })
  }

  const confirmDelete = async () => {
    if (deleteDialog.study) {
      await deleteStudy(deleteDialog.study.id)
      setDeleteDialog({ open: false, study: null })
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Studies</h2>
          <p className="text-gray-400 mb-6">
            Create studies to organize your testing, compare equipment, and track your aerodynamic improvements over time.
          </p>
          <p className="text-sm text-gray-500">
            Sign in from the Dashboard to use this feature.
          </p>
        </div>
      </div>
    )
  }

  // Show study detail view
  if (viewingStudyId) {
    return (
      <StudyDetail
        studyId={viewingStudyId}
        onBack={() => setViewingStudyId(null)}
        onDelete={async () => {
          await deleteStudy(viewingStudyId)
          setViewingStudyId(null)
        }}
        presetsHook={presetsHook}
      />
    )
  }

  const handleCreate = async (studyData) => {
    const study = await createStudy(studyData)
    setShowCreateModal(false)
    setViewingStudyId(study.id)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Studies</h2>
          <p className="text-gray-400 text-sm">Test and compare equipment variables</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <span>+</span> New Study
        </button>
      </div>

      {/* Studies List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading studies...</p>
        </div>
      ) : studies.length === 0 ? (
        <div className="text-center py-12 bg-dark-card rounded-xl border border-dark-border">
          <h3 className="text-lg font-medium text-white mb-2">No studies yet</h3>
          <p className="text-gray-400 mb-4">Create a study to start testing equipment variables</p>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            Create Your First Study
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {studies.map(study => (
            <StudyCard
              key={study.id}
              study={study}
              onClick={() => setViewingStudyId(study.id)}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateStudyModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, study: null })}
        onConfirm={confirmDelete}
        title="Delete Study"
        message={`Are you sure you want to delete "${deleteDialog.study?.name}"? This will also delete all variations and runs within this study. This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}
