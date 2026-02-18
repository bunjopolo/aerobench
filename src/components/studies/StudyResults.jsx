import { useMemo } from 'react'
import { getVariableType } from '../../lib/variableTypes'

export const StudyResults = ({ study, variations, onBack, embedded = false, showMethodologyNote = true }) => {
  const variableType = getVariableType(study.variable_type)

  // Filter to only variations with valid data
  const validVariations = useMemo(() => {
    return variations.filter(v => v.avg_cda !== null && v.run_count > 0)
  }, [variations])

  // Find baseline and calculate deltas
  const baseline = validVariations.find(v => v.is_baseline)
  const baselineCda = baseline?.avg_cda || validVariations[0]?.avg_cda

  // Sort by CdA for ranking
  const rankedVariations = useMemo(() => {
    return [...validVariations].sort((a, b) => a.avg_cda - b.avg_cda)
  }, [validVariations])

  // Calculate speed differences (approximate: 1% CdA reduction = ~0.3% speed increase at 40km/h)
  const calculateSpeedDelta = (cdaDiff) => {
    const cdaPercent = (cdaDiff / baselineCda) * 100
    const speedDelta = -cdaPercent * 0.3 // negative CdA diff = positive speed
    return speedDelta
  }

  // Watts saved calculation (P = 0.5 * rho * CdA * v^3)
  const calculateWattsSaved = (cdaDiff) => {
    const rho = 1.225
    const v = 40 / 3.6 // 40 km/h in m/s
    const wattsDiff = 0.5 * rho * cdaDiff * Math.pow(v, 3)
    return -wattsDiff // negative CdA diff = positive watts saved
  }

  if (validVariations.length < 2) {
    if (embedded) {
      return (
        <div className="mb-6 bg-dark-card rounded-xl border border-dark-border p-4">
          <h3 className="text-lg font-bold text-white mb-2">Detailed Rankings</h3>
          <p className="text-gray-400 text-sm">
            Complete at least 2 configurations with valid runs to see comparison results.
          </p>
        </div>
      )
    }

    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-2xl font-bold text-white flex-1">Study Results</h2>
        </div>

        <div className="text-center py-12 bg-dark-card rounded-xl border border-dark-border">
          <h3 className="text-lg font-medium text-white mb-2">Not enough data</h3>
          <p className="text-gray-400">
            Complete at least 2 variations with valid runs to see comparison results.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={embedded ? 'mb-6' : 'p-6 max-w-6xl mx-auto'}>
      {!embedded && (
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white">{study.name} - Results</h2>
            <p className="text-gray-400 text-sm">Comparing {validVariations.length} variations</p>
          </div>
        </div>
      )}

      {embedded && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-gray-500">{validVariations.length} configurations with valid runs</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Best Variation */}
        <div className="bg-gradient-to-r from-green-900/30 to-dark-card rounded-xl border border-green-500/30 p-4">
          <span className="text-xs text-green-400 uppercase">Best</span>
          <h3 className="text-xl font-bold text-white mt-1">{rankedVariations[0]?.name}</h3>
          <p className="text-green-400 font-mono text-lg">{rankedVariations[0]?.avg_cda.toFixed(4)} CdA</p>
          {baselineCda && rankedVariations[0]?.avg_cda < baselineCda && (
            <p className="text-xs text-green-400 mt-1">
              {((baselineCda - rankedVariations[0].avg_cda) / baselineCda * 100).toFixed(1)}% better than baseline
            </p>
          )}
        </div>

        {/* Baseline */}
        {baseline && (
          <div className="bg-dark-card rounded-xl border border-dark-border p-4">
            <span className="text-xs text-gray-400 uppercase">Baseline</span>
            <h3 className="text-xl font-bold text-white mt-1">{baseline.name}</h3>
            <p className="text-indigo-400 font-mono text-lg">{baseline.avg_cda.toFixed(4)} CdA</p>
            <p className="text-xs text-gray-500 mt-1">{baseline.run_count} runs</p>
          </div>
        )}

        {/* Potential Savings */}
        {baselineCda && rankedVariations[0]?.avg_cda < baselineCda && (
          <div className="bg-dark-card rounded-xl border border-dark-border p-4">
            <span className="text-xs text-gray-400 uppercase">Potential Savings Over Baseline</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-amber-400">
                {calculateWattsSaved(rankedVariations[0].avg_cda - baselineCda).toFixed(1)}W
              </span>
              <span className="text-gray-500 text-sm">at 40 km/h</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              +{calculateSpeedDelta(rankedVariations[0].avg_cda - baselineCda).toFixed(2)} km/h potential
            </p>
          </div>
        )}
      </div>

      {/* Detailed Rankings Table */}
      <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
        <div className="p-4 border-b border-dark-border">
          <h3 className="text-lg font-bold text-white">Detailed Rankings</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase border-b border-dark-border">
                <th className="px-3 py-2.5">Rank</th>
                <th className="px-3 py-2.5">Variation</th>
                <th className="px-3 py-2.5">{variableType.label}</th>
                <th className="px-3 py-2.5">CdA</th>
                <th className="px-3 py-2.5">± StdDev</th>
                <th className="px-3 py-2.5">Crr</th>
                <th className="px-3 py-2.5">Crr ± StdDev</th>
                <th className="px-3 py-2.5">Runs</th>
                <th className="px-3 py-2.5">vs Baseline</th>
                <th className="px-3 py-2.5">Watts @40km/h</th>
              </tr>
            </thead>
            <tbody>
              {rankedVariations.map((v, idx) => {
                const cdaDiff = baselineCda ? v.avg_cda - baselineCda : 0
                const wattsDiff = calculateWattsSaved(cdaDiff)
                const isBaseline = v.is_baseline
                const isBest = idx === 0

                return (
                  <tr
                    key={v.id}
                    className={`border-b border-dark-border ${
                      isBaseline ? 'bg-indigo-900/20' : isBest ? 'bg-green-900/20' : ''
                    }`}
                  >
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        isBest ? 'bg-green-600 text-white' : 'bg-dark-bg text-gray-400'
                      }`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{v.name}</span>
                        {isBaseline && (
                          <span className="text-xxs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                            Baseline
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 text-sm">
                      {variableType.formatValue(v)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`font-mono font-bold ${isBest ? 'text-green-400' : 'text-white'}`}>
                        {v.avg_cda.toFixed(4)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 font-mono text-sm">
                      {v.std_cda ? `±${v.std_cda.toFixed(4)}` : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-blue-400 font-mono">
                      {v.avg_crr?.toFixed(5) || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 font-mono text-sm">
                      {v.std_crr ? `±${v.std_crr.toFixed(5)}` : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400">
                      {v.run_count}
                    </td>
                    <td className="px-3 py-2.5">
                      {baselineCda && !isBaseline ? (
                        <span className={`font-mono ${cdaDiff < 0 ? 'text-green-400' : cdaDiff > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                          {cdaDiff > 0 ? '+' : ''}{(cdaDiff * 100 / baselineCda).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {baselineCda && !isBaseline ? (
                        <span className={`font-mono ${wattsDiff > 0 ? 'text-green-400' : wattsDiff < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                          {wattsDiff > 0 ? '+' : ''}{wattsDiff.toFixed(1)}W
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showMethodologyNote && (
        <div className="mt-6 p-4 bg-dark-bg rounded-xl border border-dark-border text-xs text-gray-500">
          <p className="mb-1"><strong className="text-gray-400">Note:</strong> Watts saved calculated using P = ½ρCdAv³ at reference speed of 40 km/h.</p>
          <p>Speed gains are approximate and highly dependant on your testing procedure, consistency and data integrity.</p>
        </div>
      )}
    </div>
  )
}
