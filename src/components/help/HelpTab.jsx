import { useState } from 'react'

const Section = ({ title, icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border border-dark-border rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-dark-card hover:bg-dark-bg transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-primary/20 flex items-center justify-center text-brand-primary">
            {icon}
          </div>
          <h3 className="font-semibold text-white">{title}</h3>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="p-4 pt-0 bg-dark-card border-t border-dark-border">
          {children}
        </div>
      )}
    </div>
  )
}

const Tip = ({ children }) => (
  <div className="flex gap-2 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg text-sm">
    <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span className="text-gray-300">{children}</span>
  </div>
)

export const HelpTab = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Help</h2>
        <p className="text-gray-400 text-sm mt-1">
          Learn how to use AeroBench to measure and improve your aerodynamics
        </p>
      </div>

      {/* Quick Start */}
      <div className="bg-gradient-to-r from-brand-primary/20 to-dark-card rounded-xl border border-brand-primary/30 p-6 mb-8">
        <h3 className="text-lg font-bold text-white mb-3">Quick Start</h3>
        <ol className="space-y-3 text-gray-300">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary text-white text-sm flex items-center justify-center font-medium">1</span>
            <span><strong>Record a test ride</strong> with your power meter and speed sensor (see the Guide tab for test protocols)</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary text-white text-sm flex items-center justify-center font-medium">2</span>
            <span><strong>Upload your GPX file</strong> to Quick Test for immediate analysis, or create a Study to track multiple configurations</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary text-white text-sm flex items-center justify-center font-medium">3</span>
            <span><strong>Adjust the range sliders</strong> to select clean data segments, then click Auto-Fit to solve for CdA and Crr</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary text-white text-sm flex items-center justify-center font-medium">4</span>
            <span><strong>Save your results as a preset</strong> and use the Estimator to predict performance on different courses</span>
          </li>
        </ol>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {/* Dashboard */}
        <Section
          title="Dashboard"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          }
          defaultOpen={true}
        >
          <div className="mt-4 space-y-3 text-sm text-gray-300">
            <p>
              The Dashboard provides a quick overview of your recent activity and studies. From here you can:
            </p>
            <ul className="list-disc ml-5 space-y-1">
              <li>See your most recent studies at a glance</li>
              <li>Click on any study to open it directly</li>
              <li>Quickly navigate to create new studies or run quick tests</li>
            </ul>
          </div>
        </Section>

        {/* Quick Test */}
        <Section
          title="Quick Test"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        >
          <div className="mt-4 space-y-4 text-sm text-gray-300">
            <p>
              Quick Test lets you analyze a single GPX file without creating a study. Perfect for quick checks or one-off tests.
            </p>

            <div>
              <h4 className="font-medium text-white mb-2">Analysis Methods</h4>
              <ul className="space-y-2">
                <li><strong className="text-indigo-400">Chung Method:</strong> Standard virtual elevation analysis for typical rides with varying terrain and speeds. Best for loop courses.</li>
                <li><strong className="text-amber-400">Shen Method:</strong> Uses two acceleration runs on flat ground at different intensities to separate CdA from Crr. Requires two GPX files.</li>
                <li><strong className="text-emerald-400">Climb Method:</strong> Uses two runs up the same climb at different speeds. The speed difference helps isolate aerodynamic drag from rolling resistance.</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-white mb-2">How to Use</h4>
              <ol className="list-decimal ml-5 space-y-1">
                <li>Select your analysis method before uploading files</li>
                <li>Enter your system parameters (mass, efficiency, air density)</li>
                <li>Upload your GPX file(s)</li>
                <li>Use the range slider on the chart to select clean data</li>
                <li>Click Auto-Fit to solve for CdA and Crr</li>
                <li>Fine-tune manually with the sliders if needed</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium text-white mb-2">Reading the Charts</h4>
              <ul className="list-disc ml-5 space-y-1">
                <li><strong>Red line:</strong> GPS elevation from your file</li>
                <li><strong>Cyan line:</strong> Virtual elevation calculated from power</li>
                <li><strong>Purple area:</strong> Error (difference between GPS and virtual elevation)</li>
                <li><strong>RMSE:</strong> Root Mean Square Error - lower is better (aim for &lt;1m)</li>
                <li><strong>R²:</strong> How well the model fits - closer to 1.0 is better</li>
              </ul>
            </div>

            <Tip>
              After getting good results, click "Save as Preset" to store your CdA, Crr, and other values for use in the Estimator.
            </Tip>
          </div>
        </Section>

        {/* Studies */}
        <Section
          title="Studies"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        >
          <div className="mt-4 space-y-4 text-sm text-gray-300">
            <p>
              Studies let you organize and compare multiple test runs. Use them to track changes over time or compare different equipment configurations.
            </p>

            <div>
              <h4 className="font-medium text-white mb-2">Study Modes</h4>
              <ul className="space-y-2">
                <li><strong className="text-blue-400">Averaging Mode:</strong> Collect multiple runs of the same setup to get a reliable average CdA/Crr. Great for establishing a baseline.</li>
                <li><strong className="text-purple-400">Comparison Mode:</strong> Test different configurations (helmets, positions, wheels, etc.) and compare results side-by-side.</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-white mb-2">Creating a Study</h4>
              <ol className="list-decimal ml-5 space-y-1">
                <li>Click "New Study" and choose your mode</li>
                <li>Enter a name and your system mass</li>
                <li>For comparison studies, select what variable you're testing (helmet, position, etc.)</li>
                <li>Add configurations for each thing you want to test</li>
                <li>Add runs to each configuration by uploading GPX files</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium text-white mb-2">Best Practices</h4>
              <ul className="list-disc ml-5 space-y-1">
                <li>Do 3-5 runs per configuration for reliable averages</li>
                <li>Test on the same course and conditions when comparing</li>
                <li>Mark one configuration as "Baseline" to see relative differences</li>
                <li>Exclude outlier runs by clicking the checkmark icon</li>
              </ul>
            </div>

            <Tip>
              From any configuration with data, use the 3-dot menu to "Save as Preset" for use in the Estimator.
            </Tip>
          </div>
        </Section>

        {/* Estimator */}
        <Section
          title="Estimator"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          }
        >
          <div className="mt-4 space-y-4 text-sm text-gray-300">
            <p>
              The Estimator predicts your speed and time based on your CdA, Crr, and other parameters. Use it to plan races or see how equipment changes affect performance.
            </p>

            <div>
              <h4 className="font-medium text-white mb-2">Modes</h4>
              <ul className="space-y-2">
                <li><strong>Manual Mode:</strong> Enter power, gradient, and distance manually. Good for quick calculations.</li>
                <li><strong>Route File Mode:</strong> Upload a GPX route to simulate realistic terrain with climbs and descents.</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-white mb-2">Loading Presets</h4>
              <p>
                Click "Load Preset" at the top of the Physics Values section to quickly load saved CdA, Crr, mass, efficiency, and air density values from your previous tests.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-white mb-2">Route Simulation Features</h4>
              <ul className="list-disc ml-5 space-y-1">
                <li><strong>Coast Above:</strong> Stop pedaling when speed exceeds this (simulates descents)</li>
                <li><strong>Max Descent:</strong> Brake to stay below this speed</li>
                <li><strong>Min Climb:</strong> Minimum speed even on steep climbs</li>
                <li><strong>Wind:</strong> Set wind speed and direction for realistic predictions</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-white mb-2">Power Sensitivity Table</h4>
              <p>
                Shows how your predicted time changes with different power outputs. Useful for pacing strategy.
              </p>
            </div>
          </div>
        </Section>

        {/* Physics Presets */}
        <Section
          title="Physics Presets"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
          }
        >
          <div className="mt-4 space-y-4 text-sm text-gray-300">
            <p>
              Physics Presets let you save and reuse your tested CdA, Crr, mass, efficiency, and air density values.
            </p>

            <div>
              <h4 className="font-medium text-white mb-2">Saving Presets</h4>
              <ul className="list-disc ml-5 space-y-1">
                <li><strong>From Quick Test:</strong> After analysis, click "Save as Preset" in the Results Summary</li>
                <li><strong>From Studies:</strong> Open the 3-dot menu on any configuration with data and select "Save as Preset"</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-white mb-2">Loading Presets</h4>
              <p>
                In the Estimator tab, click "Load Preset" to select from your saved presets. All physics values will be populated automatically.
              </p>
            </div>

            <Tip>
              Create presets for different setups (TT bike, road bike, different positions) to quickly switch between them in the Estimator.
            </Tip>
          </div>
        </Section>

        {/* Air Density Calculator */}
        <Section
          title="Air Density Calculator"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          }
        >
          <div className="mt-4 space-y-4 text-sm text-gray-300">
            <p>
              Air density significantly affects aerodynamic drag. The built-in calculator helps you determine the correct value for your test conditions.
            </p>

            <div>
              <h4 className="font-medium text-white mb-2">Where to Find It</h4>
              <p>
                Click "Calculator" next to the Air Density field in Quick Test or the Estimator.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-white mb-2">Input Options</h4>
              <ul className="list-disc ml-5 space-y-1">
                <li><strong>Temperature:</strong> Ambient temperature in Celsius</li>
                <li><strong>Elevation:</strong> Your altitude above sea level, OR</li>
                <li><strong>Pressure:</strong> Barometric pressure in hPa (if you have it)</li>
                <li><strong>Humidity:</strong> Relative humidity percentage</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-white mb-2">Reference Values</h4>
              <ul className="list-disc ml-5 space-y-1">
                <li>Sea level at 15°C: 1.225 kg/m³</li>
                <li>Hot day (30°C, sea level): ~1.16 kg/m³</li>
                <li>High altitude (1500m, 20°C): ~1.05 kg/m³</li>
              </ul>
            </div>
          </div>
        </Section>

        {/* Guide */}
        <Section
          title="Testing Guide"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
        >
          <div className="mt-4 space-y-4 text-sm text-gray-300">
            <p>
              The Guide tab contains detailed protocols for conducting aero tests, including equipment requirements, course selection, and testing procedures for:
            </p>
            <ul className="list-disc ml-5 space-y-1">
              <li><strong>Chung Method:</strong> Loop-based testing with virtual elevation</li>
              <li><strong>Shen Method:</strong> Out-and-back testing to separate CdA and Crr</li>
              <li><strong>Climb Method:</strong> Using hills to isolate aerodynamic drag</li>
            </ul>
            <p className="mt-3">
              Check the Guide tab before your first test to ensure you get the best possible results.
            </p>
          </div>
        </Section>

        {/* Validation */}
        <Section
          title="Validation"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          <div className="mt-4 space-y-4 text-sm text-gray-300">
            <p>
              The Validation tab lets you verify the accuracy of AeroBench's calculations against known physics scenarios.
            </p>
            <p>
              This is useful for understanding how the app works and building confidence in your results.
            </p>
          </div>
        </Section>

        {/* Glossary */}
        <Section
          title="Glossary"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex gap-3">
              <span className="font-mono text-green-400 w-20 flex-shrink-0">CdA</span>
              <span className="text-gray-300">Coefficient of drag times frontal area (m²). Lower is more aerodynamic. Road positions: 0.30-0.40, TT positions: 0.20-0.28.</span>
            </div>
            <div className="flex gap-3">
              <span className="font-mono text-blue-400 w-20 flex-shrink-0">Crr</span>
              <span className="text-gray-300">Coefficient of rolling resistance. Typical values: 0.003-0.006 for road tires, lower for track.</span>
            </div>
            <div className="flex gap-3">
              <span className="font-mono text-cyan-400 w-20 flex-shrink-0">Rho (ρ)</span>
              <span className="text-gray-300">Air density in kg/m³. Standard is 1.225 at sea level, 15°C.</span>
            </div>
            <div className="flex gap-3">
              <span className="font-mono text-white w-20 flex-shrink-0">RMSE</span>
              <span className="text-gray-300">Root Mean Square Error. Measures how well the virtual elevation matches GPS elevation. Lower is better.</span>
            </div>
            <div className="flex gap-3">
              <span className="font-mono text-white w-20 flex-shrink-0">R²</span>
              <span className="text-gray-300">Coefficient of determination. 1.0 means perfect fit, 0.95+ is excellent.</span>
            </div>
            <div className="flex gap-3">
              <span className="font-mono text-white w-20 flex-shrink-0">Virtual Elevation</span>
              <span className="text-gray-300">Calculated elevation profile based on power, speed, and physics parameters. Should match GPS elevation when CdA/Crr are correct.</span>
            </div>
          </div>
        </Section>

        {/* Tips for Best Results */}
        <Section
          title="Tips for Best Results"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          }
        >
          <div className="mt-4 space-y-3 text-sm text-gray-300">
            <ul className="list-disc ml-5 space-y-2">
              <li><strong>Use a wheel speed sensor</strong> - GPS speed is too noisy for accurate analysis</li>
              <li><strong>Set 1-second recording intervals</strong> - Disable "smart recording" on your head unit</li>
              <li><strong>Calibrate your power meter</strong> before every test session</li>
              <li><strong>Test in calm conditions</strong> - Wind introduces significant error</li>
              <li><strong>Crop out bad data</strong> - Use the range slider to exclude starts, stops, and anomalies</li>
              <li><strong>Be consistent</strong> - Same position, same course, same conditions for valid comparisons</li>
              <li><strong>Do multiple runs</strong> - Average 3-5 runs for reliable CdA values</li>
              <li><strong>Know your total mass</strong> - Weigh yourself with all gear, bike, bottles, etc.</li>
              <li><strong>Record air conditions</strong> - Temperature and pressure affect air density significantly</li>
            </ul>
          </div>
        </Section>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          Need more help? Use the Contact / Feedback button in the sidebar to reach out.
        </p>
      </div>
    </div>
  )
}
