import { connection } from 'next/server'
import HomeDashboard from './HomeDashboard'

export default async function Home() {
  await connection()
  return <HomeDashboard initialNow={new Date().toISOString()} />
}
