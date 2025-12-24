import { KpiCard } from '../components/KpiCard'
import { LeadsOverviewCard } from '../components/LeadsOverviewCard'
import { ScheduleCard } from '../components/ScheduleCard'
import { TodoCard } from '../components/TodoCard'
import { ResourcesCard } from '../components/ResourcesCard'
import { NeedsAttentionCard } from '../components/NeedsAttentionCard'

export default function DashboardPage() {
  return (
    <div className="w-full">
      <div className="dashboard-grid-container">
        <KpiCard />
        <NeedsAttentionCard />
        <LeadsOverviewCard />
        <ScheduleCard />
        <TodoCard />
        <ResourcesCard />
      </div>
    </div>
  )
}
