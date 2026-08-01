import logo from '../../assets/brand/kaaraalan-logo.png'

/**
 * Brand mark for login, sidebar, and other chrome.
 * @param {'lg' | 'md' | 'sm'} size
 */
export default function BrandLogo({ size = 'md', className = '' }) {
  const sizes = {
    lg: 'h-32 w-auto max-w-[280px]',
    md: 'h-20 w-auto max-w-[180px]',
    sm: 'h-12 w-auto max-w-[130px]',
  }

  return (
    <img
      src={logo}
      alt="Kaaraalan Goli Soda"
      className={`${sizes[size] || sizes.md} object-contain ${className}`}
      decoding="async"
    />
  )
}
