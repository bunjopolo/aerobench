import { useState } from 'react'
import { useStudies } from '../../hooks/useStudies'
import { useAuth } from '../../hooks/useAuth.jsx'
import { getVariableType } from '../../lib/variableTypes'
import { CreateStudyModal } from './CreateStudyModal'
import { StudyDetail } from './StudyDetail'

const StudyCard = ({ study, onClick }) => {
  const varType = getVariableType(study.variable_type)
  const isAveraging = study.study_mode === 'averaging'

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-dark-card rounded-xl border border-dark-border p-4 hover:border-brand-primary/50 transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
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
        </div>
        <span className="text-xs text-gray-500">
          {new Date(study.created_at).toLocaleDateString()}
        </span>
      </div>
    </button>
  )
}

export const StudiesTab = () => {
  const { user } = useAuth()
  const { studies, loading, createStudy, deleteStudy } = useStudies()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [viewingStudyId, setViewingStudyId] = useState(null)

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Please sign in to view studies</p>
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
    </div>
  )
}
