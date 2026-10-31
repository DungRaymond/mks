import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Class Hub',
  description: 'Quản lý task, bài tập và thông báo lớp học',
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
