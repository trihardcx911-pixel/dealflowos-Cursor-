import BackToDashboard from '../components/BackToDashboard'
import ResourcesBeginner from './resources/ResourcesBeginner'
import ResourcesIntermediate from './resources/ResourcesIntermediate'
import ResourcesAdvanced from './resources/ResourcesAdvanced'

export default function ResourcesPage() {
  const userTier: 'bronze' | 'silver' | 'gold' = 'bronze' // temporary

  return (
    <>
      <BackToDashboard />
      <header className="space-y-2 mb-6" style={{ paddingLeft: '3rem', paddingRight: '3rem' }}>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Library</p>
        <h1 className="text-xl font-semibold tracking-tight text-white">Resources</h1>
        <p className="text-sm text-white/50">Learn and improve your wholesaling skills</p>
      </header>
      <div className="dashboard-grid-container resources-grid">
        {userTier === 'bronze' && <ResourcesBeginner />}
        {userTier === 'silver' && <ResourcesIntermediate />}
        {userTier === 'gold' && <ResourcesAdvanced />}
      </div>
    </>
  )
}


