import { KpiCard } from '../components/KpiCard'
import { LeadsOverviewCard } from '../components/LeadsOverviewCard'
import { ScheduleCard } from '../components/ScheduleCard'
import { TodoCard } from '../components/TodoCard'
import { ResourcesCard } from '../components/ResourcesCard'
import { NeedsAttentionTasksCard } from '../components/NeedsAttentionTasksCard'

export default function DashboardPage() {
  return (
    <div className="w-full px-dfos-6 py-dfos-6">
      <div className="dashboard-grid-container grid grid-cols-12 gap-dfos-4">
        <div className="col-span-12 md:col-span-6 xl:col-span-4 h-[280px] relative z-0">
          <KpiCard />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-4 h-[280px] relative z-0">
          <NeedsAttentionTasksCard />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-4 h-[280px] relative z-0">
          <LeadsOverviewCard />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-4 h-[280px] relative z-0">
          <ScheduleCard />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-4 h-[280px] relative z-0">
          <TodoCard />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-4 h-[280px] relative z-0">
          <ResourcesCard />
        </div>
      </div>
    </div>
  )
}
