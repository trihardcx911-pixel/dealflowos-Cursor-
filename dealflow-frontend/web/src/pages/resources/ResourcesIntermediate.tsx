import ResourceCard from '../../components/resources/ResourceCard'

export default function ResourcesIntermediate() {
  return (
    <div className="contents">
      <ResourceCard title="How to Qualify a Lead">
        <p>Evaluate seller motivation, property condition, and market position. Check for liens, back taxes, and structural issues. Verify seller's timeline and financial pressure points.</p>
      </ResourceCard>

      <ResourceCard title="How to Run Simple Comps">
        <p>Use recent sales within 1 mile, same property type, within 90 days. Adjust for condition, square footage, and lot size. Average 3-5 comparable properties for baseline ARV.</p>
      </ResourceCard>

      <ResourceCard title="ARV Formula Basics">
        <ul className="space-y-2">
          <li>• ARV = After Repair Value</li>
          <li>• ARV = Average comp price × condition multiplier</li>
          <li>• Max offer = (ARV × 0.70) - Repairs - Assignment fee</li>
          <li>• Target 20-30% equity spread</li>
        </ul>
      </ResourceCard>

      <ResourceCard title="Repair Estimate Quick Guide">
        <ul className="space-y-2">
          <li>• Cosmetic: $5,000 - $15,000</li>
          <li>• Light rehab: $15,000 - $40,000</li>
          <li>• Heavy rehab: $40,000 - $80,000+</li>
          <li>• Always add 15% buffer for surprises</li>
        </ul>
      </ResourceCard>

      <ResourceCard title="Assignment Fee Expectations">
        <p>Typical fees range from $5,000 to $15,000 depending on deal size and market. Higher-value properties (over $200k ARV) can command $15k-$30k. Always negotiate based on investor's margin.</p>
      </ResourceCard>

      <ResourceCard title="Follow-up Cadence Models">
        <ul className="space-y-2">
          <li>• Day 1: Initial contact</li>
          <li>• Day 3: Follow-up call</li>
          <li>• Day 7: Offer presentation</li>
          <li>• Day 14: Final check-in</li>
          <li>• Monthly: Nurture for future deals</li>
        </ul>
      </ResourceCard>

      <ResourceCard title="Motivation Tiers">
        <ul className="space-y-2">
          <li>• Tier 1: Divorce, job loss, death (highest urgency)</li>
          <li>• Tier 2: Relocation, downsizing (moderate urgency)</li>
          <li>• Tier 3: Investment property, inherited (lower urgency)</li>
        </ul>
      </ResourceCard>

      <ResourceCard title="Market Type Identification">
        <ul className="space-y-2">
          <li>• Urban: High density, fast turnover, competitive</li>
          <li>• Suburban: Steady demand, family-oriented, stable pricing</li>
          <li>• Rural: Lower competition, longer hold times, niche investors</li>
        </ul>
      </ResourceCard>
    </div>
  )
}

