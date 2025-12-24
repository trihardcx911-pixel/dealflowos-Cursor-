import ResourceCard from '../../components/resources/ResourceCard'

export default function ResourcesBeginner() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-12 pb-12">
      <ResourceCard title="What Wholesaling Really Is">
        <ul className="space-y-2">
          <li>• You find a discounted property</li>
          <li>• You put it under contract</li>
          <li>• You sell the contract to an investor</li>
          <li>• You get paid a fee</li>
        </ul>
      </ResourceCard>

      <ResourceCard title="What Makes a Good Deal">
        <ul className="space-y-2">
          <li>• Distressed property</li>
          <li>• Motivated seller</li>
          <li>• Below-market price</li>
          <li>• Clear title</li>
        </ul>
      </ResourceCard>

      <ResourceCard title="Best Places to Get Data">
        <ul className="space-y-2">
          <li>• County records</li>
          <li>• PropStream / Batch Leads</li>
          <li>• Driving for Dollars</li>
          <li>• Zillow (for quick comps)</li>
        </ul>
      </ResourceCard>

      <ResourceCard title="How to Talk to Sellers">
        <ul className="space-y-2">
          <li>• Keep it simple</li>
          <li>• Ask about their timeline</li>
          <li>• Ask why they're considering selling</li>
          <li>• Ask what they want next</li>
        </ul>
      </ResourceCard>

      <ResourceCard title="Rules to NOT Get Sued">
        <ul className="space-y-2">
          <li>• Don't act like an agent</li>
          <li>• Don't promise repairs</li>
          <li>• Don't give financial advice</li>
          <li>• Be honest about your role</li>
        </ul>
      </ResourceCard>
    </div>
  )
}

