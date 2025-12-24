import { KpiCard } from '../components/KpiCard'
import { CreditsCard } from '../components/CreditsCard'
import { ScheduleCard } from '../components/ScheduleCard'
import { LegalDocsCard } from '../components/LegalDocsCard'
import { TodoCard } from '../components/TodoCard'
import { ResourcesCard } from '../components/ResourcesCard'

export default function DashboardPage() {
  return (
    <div>
      <div className="dashboard-grid-container">
        <KpiCard />
        <CreditsCard credits={12840} />
        <ScheduleCard />
        <LegalDocsCard />
        <TodoCard />
        <ResourcesCard />
      </div>
    </div>
  )
}
