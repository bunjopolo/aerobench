import { useMemo } from 'react'
import Plot from 'react-plotly.js'
import { getVariableType } from '../../lib/variableTypes'

export const StudyResults = ({ study, variations, onBack }) => {
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

  // Calculate Y-axis range with padding for labels
  const cdaValues = rankedVariations.map(v => v.avg_cda)
  const cdaErrors = rankedVariations.map(v => v.std_cda || 0)
  const cdaMin = Math.min(...cdaValues)
  const cdaMax = Math.max(...cdaValues.map((v, i) => v + cdaErrors[i]))
  const cdaPadding = (cdaMax - cdaMin) * 0.15

  const crrValues = rankedVariations.map(v => v.avg_crr || 0).filter(v => v > 0)
  const crrErrors = rankedVariations.map(v => v.std_crr || 0)
  const crrMin = crrValues.length > 0 ? Math.min(...crrValues) : 0
  const crrMax = crrValues.length > 0 ? Math.max(...crrValues.map((v, i) => v + crrErrors[i])) : 0.01
  const crrPadding = (crrMax - crrMin) * 0.15

  // Consistent color palette for configurations
  const colorPalette = [
    '#10b981', // emerald (best)
    '#6366f1', // indigo
    '#f59e0b', // amber
    '#ec4899', // pink
    '#14b8a6', // teal
    '#8b5cf6', // violet
    '#f97316', // orange
    '#06b6d4', // cyan
  ]

  // Assign consistent colors to each variation
  const getVariationColor = (variation, index) => {
    if (variation.is_baseline) return '#6366f1' // Baseline always indigo
    if (index === 0) return '#10b981' // Best always emerald
    // Use palette for others, cycling if needed
    const paletteIndex = (index - 1) % (colorPalette.length - 2) + 2
    return colorPalette[paletteIndex]
  }

  const variationColors = rankedVariations.map((v, i) => getVariationColor(v, i))

  // Bar chart data
  const cdaChartData = {
    x: rankedVariations.map(v => v.name),
    y: rankedVariations.map(v => v.avg_cda),
    type: 'bar',
    marker: {
      color: variationColors
    },
    error_y: {
      type: 'data',
      array: rankedVariations.map(v => v.std_cda || 0),
      visible: true,
      color: '#94a3b8'
    },
    text: rankedVariations.map(v => v.avg_cda.toFixed(4)),
    textposition: 'inside',
    textangle: 0,
    textfont: { color: '#ffffff', size: 11 },
    insidetextanchor: 'end',
    hovertemplate: '%{x}<br>CdA: %{y:.4f}<extra></extra>'
  }

  const crrChartData = {
    x: rankedVariations.map(v => v.name),
    y: rankedVariations.map(v => v.avg_crr),
    type: 'bar',
    marker: {
      color: variationColors
    },
    error_y: {
      type: 'data',
      array: rankedVariations.map(v => v.std_crr || 0),
      visible: true,
      color: '#94a3b8'
    },
    text: rankedVariations.map(v => v.avg_crr?.toFixed(5) || 'N/A'),
    textposition: 'inside',
    textangle: 0,
    textfont: { color: '#ffffff', size: 11 },
    insidetextanchor: 'end',
    hovertemplate: '%{x}<br>Crr: %{y:.5f}<extra></extra>'
  }

  const chartLayout = {
    paper_bgcolor: '#0f172a',
    plot_bgcolor: '#0f172a',
    font: { color: '#94a3b8', size: 11 },
    margin: { t: 20, l: 60, r: 20, b: 100 },
    xaxis: {
      tickangle: -45,
      gridcolor: '#1e293b',
      automargin: true
    },
    yaxis: {
      gridcolor: '#1e293b',
      automargin: true
    },
    bargap: 0.3
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
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
            <span className="text-xs text-gray-400 uppercase">Potential Savings</span>
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

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* CdA Chart */}
        <div className="bg-dark-card rounded-xl border border-dark-border p-4">
          <h3 className="text-lg font-bold text-white mb-4">CdA Comparison</h3>
          <Plot
            data={[cdaChartData]}
            layout={{
              ...chartLayout,
              yaxis: {
                ...chartLayout.yaxis,
                title: 'CdA (m²)',
                range: [Math.max(0, cdaMin - cdaPadding * 2), cdaMax + cdaPadding],
                zeroline: false
              }
            }}
            style={{ width: '100%', height: 300 }}
            config={{ displayModeBar: false, responsive: true }}
          />
        </div>

        {/* Crr Chart */}
        <div className="bg-dark-card rounded-xl border border-dark-border p-4">
          <h3 className="text-lg font-bold text-white mb-4">Crr Comparison</h3>
          <Plot
            data={[crrChartData]}
            layout={{
              ...chartLayout,
              yaxis: {
                ...chartLayout.yaxis,
                title: 'Crr',
                range: [Math.max(0, crrMin - crrPadding * 2), crrMax + crrPadding],
                zeroline: false
              }
            }}
            style={{ width: '100%', height: 300 }}
            config={{ displayModeBar: false, responsive: true }}
          />
        </div>
      </div>

      {/* Detailed Rankings Table */}
      <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
        <div className="p-4 border-b border-dark-border">
          <h3 className="text-lg font-bold text-white">Detailed Rankings</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase border-b border-dark-border">
                <th className="p-4">Rank</th>
                <th className="p-4">Variation</th>
                <th className="p-4">{variableType.label}</th>
                <th className="p-4">CdA</th>
                <th className="p-4">± StdDev</th>
                <th className="p-4">Crr</th>
                <th className="p-4">Crr ± StdDev</th>
                <th className="p-4">Runs</th>
                <th className="p-4">vs Baseline</th>
                <th className="p-4">Watts @40km/h</th>
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
                    <td className="p-4">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        isBest ? 'bg-green-600 text-white' : 'bg-dark-bg text-gray-400'
                      }`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{v.name}</span>
                        {isBaseline && (
                          <span className="text-xxs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                            Baseline
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-gray-400 text-sm">
                      {variableType.formatValue(v)}
                    </td>
                    <td className="p-4">
                      <span className={`font-mono font-bold ${isBest ? 'text-green-400' : 'text-white'}`}>
                        {v.avg_cda.toFixed(4)}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400 font-mono text-sm">
                      {v.std_cda ? `±${v.std_cda.toFixed(4)}` : '-'}
                    </td>
                    <td className="p-4 text-blue-400 font-mono">
                      {v.avg_crr?.toFixed(5) || '-'}
                    </td>
                    <td className="p-4 text-gray-400 font-mono text-sm">
                      {v.std_crr ? `±${v.std_crr.toFixed(5)}` : '-'}
                    </td>
                    <td className="p-4 text-gray-400">
                      {v.run_count}
                    </td>
                    <td className="p-4">
                      {baselineCda && !isBaseline ? (
                        <span className={`font-mono ${cdaDiff < 0 ? 'text-green-400' : cdaDiff > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                          {cdaDiff > 0 ? '+' : ''}{(cdaDiff * 100 / baselineCda).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="p-4">
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

      {/* Methodology Note */}
      <div className="mt-6 p-4 bg-dark-bg rounded-xl border border-dark-border text-xs text-gray-500">
        <p className="mb-1"><strong className="text-gray-400">Note:</strong> Watts saved calculated using P = ½ρCdAv³ at reference speed of 40 km/h.</p>
        <p>Speed gains are approximate and depend on terrain, rider position, and other factors.</p>
      </div>
    </div>
  )
}
