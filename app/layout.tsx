import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Quản lý lịch học',
  description: 'Quản lý học viên, học phí và lịch học',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  )
}
