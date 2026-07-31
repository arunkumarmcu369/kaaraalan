import { useLottie } from 'lottie-react'

export default function LottieAnimation({ animationData, loop = true, className = '', style }) {
  const options = {
    animationData,
    loop,
    autoplay: true,
  }
  const { View } = useLottie(options, style)

  if (!animationData) return null
  return <div className={className}>{View}</div>
}
