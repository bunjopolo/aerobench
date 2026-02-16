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
                    Repeat the loop <strong>2 or more times</strong>.
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
            <p className="text-gray-500">Coming Soon</p>
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
