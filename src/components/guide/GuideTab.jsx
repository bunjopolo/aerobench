export const GuideTab = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Testing Guide</h2>
        <p className="text-gray-400 text-sm">
          How to get accurate results with the Chung Method
        </p>
      </div>

      {/* Main Content Card */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-8">
        {/* Icon */}
        <div className="text-center mb-8">
          <svg
            className="w-16 h-16 text-gray-600 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
        </div>

        {/* Methods Grid */}
        <div className="space-y-8">
          {/* Chung Method */}
          <section>
            <h3 className="text-lg font-medium text-white mb-2">Chung Method</h3>
            <p className="text-gray-400 text-sm mb-4">
              Documented by Robert Chung at:{" "}
              <a
                href="http://anonymous.coward.free.fr/wattage/cda/indirect-cda.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                indirect-cda.pdf
              </a>
            </p>

            <div className="ml-4 space-y-6">
              {/* 1. Equipment Requirements */}
              <div>
                <h4 className="text-sm font-medium text-white mb-2">
                  1. Equipment Requirements
                </h4>
                <ul className="text-gray-300 space-y-2 ml-4 list-disc">
                  <li>
                    <strong>Power Meter:</strong> Dual-sided is better, but
                    single-sided will work.
                  </li>
                  <li>
                    <strong>Speed Sensor:</strong> Use a wheel-based speed sensor.
                    GPS speed is not reliable for recording distance and speed.
                  </li>
                  <li>
                    <strong>Altimeter:</strong> Head units usually have these
                    built in.
                  </li>
                </ul>
              </div>

              {/* 2. Course Selection */}
              <div>
                <h4 className="text-sm font-medium text-white mb-2">
                  2. Course Selection
                </h4>
                <ul className="text-gray-300 space-y-2 ml-4 list-disc">
                  <li>
                    Select a course <strong>30 seconds to 5 minutes</strong> in
                    length with a consistent surface and low traffic.
                  </li>
                  <li>
                    Your loop should allow you to safely take turns without
                    hitting the brakes.
                  </li>
                </ul>
              </div>

              {/* 3. Testing Procedure */}
              <div>
                <h4 className="text-sm font-medium text-white mb-2">
                  3. Testing Procedure
                </h4>
                <ul className="text-gray-300 space-y-2 ml-4 list-disc">
                  <li>Test on a day with minimal to no wind.</li>
                  <li>
                    Repeat the loop <strong>2 or more times</strong>. The more
                    times you repeat, the better your results will be.
                  </li>
                  <li>Maintain the same position throughout all laps.</li>
                  <li>
                    <strong>Calibrate</strong> your power meter before testing.
                  </li>
                  <li>
                    Avoid hitting the brakes as this will create a virtual "hill"
                    in the virtual elevation.
                  </li>
                  <li>
                    For best results, record <strong>ambient temperature</strong>{" "}
                    and <strong>air pressure</strong>.
                  </li>
                  <li>
                    Head unit should be set to <strong>1-second recording
                    intervals</strong>. Disable "Smart Recording" or variable
                    intervals.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Shen Method */}
          <section>
            <h3 className="text-lg font-medium text-white mb-2">Shen Method</h3>
            <p className="text-gray-400 text-sm mb-4">
              A technique for separating Crr from CdA, documented by Andy Shen at:{" "}
              <a
                href="https://nyvelocity.com/articles/coachingfitness/the-shen-method/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                nyvelocity.com
              </a>
            </p>

            <div className="ml-4 space-y-6">
              {/* 1. Overview */}
              <div>
                <h4 className="text-sm font-medium text-white mb-2">
                  1. Overview
                </h4>
                <ul className="text-gray-300 space-y-2 ml-4 list-disc">
                  <li>
                    The Shen Method uses a <strong>Out and back course with a
                    turnaround</strong>—a practical option when no suitable loop
                    exists.
                  </li>
                  <li>
                    By completing efforts at varying intensities, you can leverage
                    the different speed dependencies of rolling resistance and
                    aerodynamic drag to isolate Crr from CdA.
                  </li>
                </ul>
              </div>

              {/* 2. The Key Insight */}
              <div>
                <h4 className="text-sm font-medium text-white mb-2">
                  2. The Key Insight
                </h4>
                <ul className="text-gray-300 space-y-2 ml-4 list-disc">
                  <li>
                    <strong>Rolling resistance</strong> is speed-independent. It
                    stays the same whether you're going 15 or 45 km/h.
                  </li>
                  <li>
                    <strong>Aerodynamic drag</strong> scales with the square of
                    velocity (proportional to v²).
                  </li>
                  <li>
                    At lower speeds, tire losses make up a larger share of total
                    resistance; at higher speeds, air resistance dominates.
                  </li>
                  <li>
                    When your Crr/CdA values are mismatched, discrepancies surface
                    at different effort levels instead of canceling out.
                  </li>
                </ul>
              </div>

              {/* 3. Equipment Requirements */}
              <div>
                <h4 className="text-sm font-medium text-white mb-2">
                  3. Equipment Requirements
                </h4>
                <ul className="text-gray-300 space-y-2 ml-4 list-disc">
                  <li>
                    <strong>Power Meter:</strong> Dual-sided is preferable, but
                    single-sided will work.
                  </li>
                  <li>
                    <strong>Speed Sensor:</strong> Use a wheel-based sensor.
                    GPS-derived speed lacks the precision needed for this analysis.
                  </li>
                  <li>
                    <strong>Altimeter:</strong> Most head units include one by
                    default.
                  </li>
                </ul>
              </div>

              {/* 4. Course Selection */}
              <div>
                <h4 className="text-sm font-medium text-white mb-2">
                  4. Course Selection
                </h4>
                <ul className="text-gray-300 space-y-2 ml-4 list-disc">
                  <li>
                    Find a <strong>flat, straight stretch of road</strong> where you
                    can ride out and back
                  </li>
                  <li>
                    Set up a marker to
                    mark where you'll reverse direction.
                  </li>
                  <li>
                    If possible, position your turnaround where terrain features
                    (a gentle rise or rough patch) let you scrub speed naturally.
                  </li>
                  <li>
                    Pick a route with uniform pavement and minimal traffic.
                  </li>
                </ul>
              </div>

              {/* 5. Testing Procedure */}
              <div>
                <h4 className="text-sm font-medium text-white mb-2">
                  5. Testing Procedure
                </h4>
                <ul className="text-gray-300 space-y-2 ml-4 list-disc">
                  <li>Choose a calm day with little to no wind.</li>
                  <li>
                    <strong>Calibrate</strong> your power meter before starting.
                  </li>
                  <li>
                    Configure your head unit for <strong>1-second recording
                    intervals</strong>. Turn off "Smart Recording" or any variable
                    sampling modes.
                  </li>
                  <li>
                    Complete the course <strong>three times</strong>, varying your
                    intensity each run—easy, moderate, and hard efforts.
                  </li>
                  <li>
                    Keep your body position unchanged throughout each effort.
                  </li>
                  <li>
                    <strong>At the turnaround:</strong> If you can't reverse
                    direction without stopping, apply heavy braking all at once.
                    This produces an obvious anomaly in your file that's simple to
                    remove during analysis.
                  </li>
                  <li>
                    Once you've turned, resume your effort and keep your position
                    consistent back to the start.
                  </li>
                </ul>
              </div>

              {/* 6. Data Analysis */}
              <div>
                <h4 className="text-sm font-medium text-white mb-2">
                  6. Data Analysis
                </h4>
                <ul className="text-gray-300 space-y-2 ml-4 list-disc">
                  <li>
                    You'll need to <strong>handle the data processing yourself</strong>{" "}
                    outside of your usual software—most analysis tools lack the
                    ability to overlay reversed segments automatically.
                  </li>
                  <li>
                    Remove any braking anomalies from the turnarounds before
                    running your calculations.
                  </li>
                  <li>
                    Compare the virtual elevation profiles from your easy, moderate,
                    and hard efforts.
                  </li>
                </ul>
              </div>

              {/* 7. Interpreting Results */}
              <div>
                <h4 className="text-sm font-medium text-white mb-2">
                  7. Interpreting Results
                </h4>
                <ul className="text-gray-300 space-y-2 ml-4 list-disc">
                  <li>
                    <strong>Crr too low (CdA too high):</strong> Virtual elevation
                    trends upward on easy efforts and downward on hard efforts.
                  </li>
                  <li>
                    <strong>Crr too high (CdA too low):</strong> Virtual elevation
                    trends downward on easy efforts and upward on hard efforts.
                  </li>
                  <li>
                    <strong>Correct values:</strong> All three efforts produce flat,
                    consistent profiles that return to zero elevation.
                  </li>
                  <li>
                    Refine both parameters until your plots are{" "}
                    <strong>level and uniform across all intensities</strong>—this
                    confirms accurate separation of Crr and CdA.
                  </li>
                </ul>
              </div>
            </div>
          </section>


          {/* Single Climb */}
          <section>
            <h3 className="text-lg font-medium text-white mb-2">Single Climb</h3>
            <p className="text-gray-500">Coming Soon</p>
          </section>

          {/* Coast Down */}
          <section>
            <h3 className="text-lg font-medium text-white mb-2">Coast Down</h3>
            <p className="text-gray-500">Coming Soon</p>
          </section>
        </div>
      </div>
    </div>
  );
};