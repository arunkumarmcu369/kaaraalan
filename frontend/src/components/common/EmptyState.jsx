import LottieAnimation from './LottieAnimation'
import emptyAnim from '../../assets/lottie/empty.json'

export default function EmptyState({ title = 'Nothing here yet', description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-2 h-36 w-36">
        <LottieAnimation animationData={emptyAnim} loop />
      </div>
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
