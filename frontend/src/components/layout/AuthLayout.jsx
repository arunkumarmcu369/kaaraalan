import { Outlet } from 'react-router-dom'
import BrandLogo from '../common/BrandLogo'

export default function AuthLayout() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f7f8fa] px-4 py-10">
      <div className="login-glass w-full max-w-[380px] rounded-[1.5rem] px-7 py-9 sm:px-8 sm:py-10">
        <div className="mb-7 flex flex-col items-center text-center">
          <BrandLogo size="lg" className="block" />
          <p className="mt-4 text-sm text-muted">Sign in to continue</p>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
