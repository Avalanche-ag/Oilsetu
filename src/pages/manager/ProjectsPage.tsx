import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { getProjects, getAssignments, getDelays } from '../../services/api'
import { Card, CardHeader, CardBody, PageHeader, Button, ProgressBar, Icon } from '../../components/ui'

export function ProjectsPage() {
  const { t } = useTranslation()
  const { data: projects = [], isLoading } = useQuery({ queryKey: ['projects'], queryFn: getProjects })

  return (
    <div>
      <PageHeader title={t('projects.title')} action={<Link to="/m/projects/new"><Button variant="primary" icon="plus">{t('projects.newProject')}</Button></Link>} />
      {isLoading ? null : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
          <Link to="/m/projects/new" className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-slate-500 transition-colors hover:border-brand-300 hover:bg-brand-50/30 hover:text-brand-700">
            <Icon name="plus" size={32} className="mb-2" />
            <span className="text-sm font-medium">{t('projects.newProject')}</span>
          </Link>
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project }: { project: { id: string; name: string; code: string; client: string; location: string; status: string; progress?: number } }) {
  const { t } = useTranslation()
  const { data: assignments = [] } = useQuery({ queryKey: ['assignments', project.id], queryFn: () => getAssignments(project.id) })
  const { data: delays = [] } = useQuery({ queryKey: ['delays', project.id], queryFn: () => getDelays(project.id) })

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader
        title={project.name}
        subtitle={`${project.code} · ${project.location}`}
        action={<span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase text-emerald-700">{t(`projects.${project.status.toLowerCase()}`)}</span>}
      />
      <CardBody className="space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>{t('dashboard.overallProgress')}</span>
            <span>{project.progress ?? 0}%</span>
          </div>
          <ProgressBar value={project.progress ?? 0} />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{assignments.length} {t('common.assigned').toLowerCase()}</span>
          <span className={delays.filter((d) => d.status === 'OPEN').length > 0 ? 'text-rose-600' : ''}>
            {delays.filter((d) => d.status === 'OPEN').length} {t('projects.open').toLowerCase()} {t('delays.openDelays').toLowerCase()}
          </span>
        </div>
        <Link to={`/m/dashboard?project=${project.id}`} className="block w-full">
          <Button variant="secondary" size="sm" className="w-full">{t('common.details')}</Button>
        </Link>
      </CardBody>
    </Card>
  )
}
