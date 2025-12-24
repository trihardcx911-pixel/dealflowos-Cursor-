import ResourceCard from '../../components/resources/ResourceCard'

export default function ResourcesAdvanced() {
  // Dummy static data for charts and analytics
  const dealProbabilityData = [
    { lead: '123 Main St', score: 87, probability: 'High' },
    { lead: '456 Oak Ave', score: 62, probability: 'Medium' },
    { lead: '789 Pine Rd', score: 45, probability: 'Low' },
  ]

  const marketVelocityData = [
    { zip: '90210', velocity: 4.2, trend: '↑' },
    { zip: '10001', velocity: 3.8, trend: '→' },
    { zip: '60601', velocity: 5.1, trend: '↑' },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-12 pb-12">
      <ResourceCard title="Deal Probability Scoring">
        <div className="space-y-3">
          <p>AI-weighted scoring model based on seller motivation, property condition, market velocity, and investor demand.</p>
          <div className="space-y-2">
            {dealProbabilityData.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-2 bg-white/5 rounded">
                <span className="text-sm">{item.lead}</span>
                <span className="text-sm font-semibold">{item.score}/100 ({item.probability})</span>
              </div>
            ))}
          </div>
        </div>
      </ResourceCard>

      <ResourceCard title="Lead Time Decay Curve">
        <p>Probability of closing decreases exponentially after initial contact. Day 0-7: 65% close rate. Day 8-14: 35%. Day 15-30: 15%. Beyond 30 days: &lt;5%.</p>
      </ResourceCard>

      <ResourceCard title="Market Velocity Index">
        <div className="space-y-2">
          {marketVelocityData.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center">
              <span>ZIP {item.zip}</span>
              <span className="font-semibold">{item.velocity} {item.trend}</span>
            </div>
          ))}
          <p className="text-xs text-zinc-500 mt-2">Index measures average days-on-market for distressed properties. Lower = faster market.</p>
        </div>
      </ResourceCard>

      <ResourceCard title="Pricing Elasticity by ZIP">
        <p>Price sensitivity varies by market. Urban cores show 0.8 elasticity (10% price drop = 8% demand increase). Suburban: 1.2. Rural: 1.5. Use elasticity to optimize assignment fees.</p>
      </ResourceCard>

      <ResourceCard title="Investor Demand Weighting">
        <ul className="space-y-2">
          <li>• Active buyers: 40% weight</li>
          <li>• Recent purchase history: 30% weight</li>
          <li>• Preferred property types: 20% weight</li>
          <li>• Geographic proximity: 10% weight</li>
        </ul>
      </ResourceCard>

      <ResourceCard title="AI-Ranked Repairs → ARV Modifiers">
        <ul className="space-y-2">
          <li>• Critical repairs (roof, foundation): -15% to -25% ARV</li>
          <li>• Structural issues: -10% to -20% ARV</li>
          <li>• Cosmetic updates: +5% to +12% ARV potential</li>
          <li>• Modern systems (HVAC, electrical): +8% to +15% ARV</li>
        </ul>
      </ResourceCard>

      <ResourceCard title="KPI Heatmaps">
        <p>Visual representation of deal density, conversion rates, and profit margins across geographic regions. Red zones = high activity, low margins. Green zones = optimal balance.</p>
      </ResourceCard>

      <ResourceCard title="Assignment Optimization">
        <p>Dynamic fee calculation based on investor's target ROI, market conditions, and deal complexity. Optimal range: 8-12% of ARV for standard deals, 5-8% for high-value properties.</p>
      </ResourceCard>

      <ResourceCard title="Lead Quality Funnels">
        <p>Track conversion from initial contact → qualified lead → under contract → assignment closed. Industry average: 100 contacts → 10 qualified → 3 contracts → 1 assignment. Optimize each stage.</p>
      </ResourceCard>

      <ResourceCard title="Trendline Projection Graphs">
        <p>Time-series analysis of market trends, seasonal patterns, and predictive modeling. Uses historical data to forecast 30/60/90-day market conditions and pricing movements.</p>
      </ResourceCard>
    </div>
  )
}

