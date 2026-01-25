export const ValidationTab = () => {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8 space-y-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white mb-3">Validation & Testing</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Real-world testing and validation of AeroBench's virtual elevation analysis methods.
          </p>
        </div>

        {/* Overview Section */}
        <section className="card">
          <h2 className="text-xl font-bold text-white mb-4">Overview</h2>
          <p className="text-gray-400 leading-relaxed">
            This section documents the testing performed to validate the accuracy of both the
            Chung method and Shen method implementations in AeroBench. Testing was performed
            using real ride data collected under controlled conditions.
          </p>
        </section>

        {/* Chung Method Validation */}
        <section className="card">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 rounded bg-indigo-600 text-white text-sm font-medium">Chung Method</span>
            <h2 className="text-xl font-bold text-white">Standard Ride Testing</h2>
          </div>

          <div className="space-y-4 text-gray-400">
            {/* Placeholder for images */}
            <div className="bg-dark-bg rounded-lg p-8 border border-dark-border border-dashed text-center">
              <svg className="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-500 text-sm">Chung method test results and screenshots</p>
            </div>

            {/* Results table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-border">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Test Ride</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Calculated CdA</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Calculated Crr</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">RMSE</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">R²</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-dark-border/50">
                    <td className="py-3 px-4 text-gray-300">Test 1</td>
                    <td className="py-3 px-4 text-green-400 font-mono">—</td>
                    <td className="py-3 px-4 text-blue-400 font-mono">—</td>
                    <td className="py-3 px-4 text-gray-300 font-mono">—</td>
                    <td className="py-3 px-4 text-gray-300 font-mono">—</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Writeup text box */}
            <div className="bg-dark-bg rounded-lg p-4 border border-dark-border">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Analysis & Notes</h4>
              <p className="text-gray-400 leading-relaxed text-sm">
                {/* Add your Chung method writeup here */}
                Writeup coming soon...
              </p>
            </div>
          </div>
        </section>

        {/* Shen Method Validation */}
        <section className="card">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 rounded bg-amber-600 text-white text-sm font-medium">Shen Method</span>
            <h2 className="text-xl font-bold text-white">Acceleration/Deceleration Testing</h2>
          </div>

          <div className="space-y-4 text-gray-400">
            {/* Placeholder for images */}
            <div className="bg-dark-bg rounded-lg p-8 border border-dark-border border-dashed text-center">
              <svg className="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-500 text-sm">Shen method test results and screenshots</p>
            </div>

            {/* Results table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-border">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Test Ride</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Calculated CdA</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Calculated Crr</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Net Elev</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Bow</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-dark-border/50">
                    <td className="py-3 px-4 text-gray-300">Test 1</td>
                    <td className="py-3 px-4 text-green-400 font-mono">—</td>
                    <td className="py-3 px-4 text-blue-400 font-mono">—</td>
                    <td className="py-3 px-4 text-gray-300 font-mono">—</td>
                    <td className="py-3 px-4 text-gray-300 font-mono">—</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Writeup text box */}
            <div className="bg-dark-bg rounded-lg p-4 border border-dark-border">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Analysis & Notes</h4>
              <p className="text-gray-400 leading-relaxed text-sm">
                {/* Add your Shen method writeup here */}
                Writeup coming soon...
              </p>
            </div>
          </div>
        </section>

        {/* Coast Down Method Validation */}
        <section className="card">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 rounded bg-cyan-600 text-white text-sm font-medium">Coast Down</span>
            <h2 className="text-xl font-bold text-white">Coast Down Testing</h2>
          </div>

          <div className="space-y-4 text-gray-400">
            {/* Placeholder for images */}
            <div className="bg-dark-bg rounded-lg p-8 border border-dark-border border-dashed text-center">
              <svg className="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-500 text-sm">Coast down test results and screenshots</p>
            </div>

            {/* Results table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-border">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Test Ride</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Calculated CdA</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Assumed Crr</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">R²</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Data Points</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-dark-border/50">
                    <td className="py-3 px-4 text-gray-300">Test 1</td>
                    <td className="py-3 px-4 text-green-400 font-mono">—</td>
                    <td className="py-3 px-4 text-blue-400 font-mono">—</td>
                    <td className="py-3 px-4 text-gray-300 font-mono">—</td>
                    <td className="py-3 px-4 text-gray-300 font-mono">—</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Writeup text box */}
            <div className="bg-dark-bg rounded-lg p-4 border border-dark-border">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Analysis & Notes</h4>
              <p className="text-gray-400 leading-relaxed text-sm">
                {/* Add your coast down method writeup here */}
                Writeup coming soon...
              </p>
            </div>
          </div>
        </section>

        {/* Single Direction Climb Validation */}
        <section className="card">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 rounded bg-emerald-600 text-white text-sm font-medium">Single Direction</span>
            <h2 className="text-xl font-bold text-white">Single Direction Climb Testing</h2>
          </div>

          <div className="space-y-4 text-gray-400">
            {/* Placeholder for images */}
            <div className="bg-dark-bg rounded-lg p-8 border border-dark-border border-dashed text-center">
              <svg className="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-500 text-sm">Single direction climb test results and screenshots</p>
            </div>

            {/* Results table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-border">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Test Ride</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Calculated CdA</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Calculated Crr</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">RMSE</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">R²</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-dark-border/50">
                    <td className="py-3 px-4 text-gray-300">Test 1</td>
                    <td className="py-3 px-4 text-green-400 font-mono">—</td>
                    <td className="py-3 px-4 text-blue-400 font-mono">—</td>
                    <td className="py-3 px-4 text-gray-300 font-mono">—</td>
                    <td className="py-3 px-4 text-gray-300 font-mono">—</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Writeup text box */}
            <div className="bg-dark-bg rounded-lg p-4 border border-dark-border">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Analysis & Notes</h4>
              <p className="text-gray-400 leading-relaxed text-sm">
                {/* Add your single direction climb writeup here */}
                Writeup coming soon...
              </p>
            </div>
          </div>
        </section>

        {/* Test Conditions */}
        <section className="card">
          <h2 className="text-xl font-bold text-white mb-4">Test Conditions</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-2">Equipment</h3>
              <ul className="text-gray-400 text-sm space-y-1">
                <li>• Bike: —</li>
                <li>• Power meter: —</li>
                <li>• GPS device: —</li>
                <li>• Total system mass: — kg</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-2">Environment</h3>
              <ul className="text-gray-400 text-sm space-y-1">
                <li>• Location: —</li>
                <li>• Weather conditions: —</li>
                <li>• Air density: — kg/m³</li>
                <li>• Wind: —</li>
              </ul>
            </div>
          </div>

          {/* Writeup text box */}
          <div className="bg-dark-bg rounded-lg p-4 border border-dark-border mt-4">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Additional Notes</h4>
            <p className="text-gray-400 leading-relaxed text-sm">
              {/* Add your test conditions writeup here */}
              Writeup coming soon...
            </p>
          </div>
        </section>

        {/* Conclusions */}
        <section className="card">
          <h2 className="text-xl font-bold text-white mb-4">Conclusions</h2>
          <div className="bg-dark-bg rounded-lg p-4 border border-dark-border">
            <p className="text-gray-400 leading-relaxed text-sm">
              {/* Add your conclusions here */}
              Conclusions coming soon...
            </p>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm py-8">
          <p>Last updated: —</p>
        </div>
      </div>
    </div>
  )
}
