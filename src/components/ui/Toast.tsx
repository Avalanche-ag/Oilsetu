import { useToast } from '../../store/toast'
import { Icon } from './Icon'
import { cn } from '../../utils/cn'

export function Toaster() {
  const { toasts, remove } = useToast()
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg',
            toast.type === 'success' && 'bg-emerald-700 text-white',
            toast.type === 'error' && 'bg-rose-700 text-white',
            toast.type === 'info' && 'bg-slate-800 text-white'
          )}
        >
          {toast.type === 'success' && <Icon name="check" size={16} />}
          {toast.type === 'error' && <Icon name="alertCircle" size={16} />}
          {toast.type === 'info' && <Icon name="info" size={16} />}
          {toast.message}
          <button onClick={() => remove(toast.id)} className="ml-2 rounded p-0.5 hover:bg-white/20">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
