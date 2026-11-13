'use client'

import { useState, type ComponentProps } from 'react'
import Link from 'next/link'

// Keep automatic shell prefetching, but fetch the full dynamic page on intent
// instead of querying every card's details as soon as the feed appears.
export default function ItemLink(props: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false)
  return <Link {...props} prefetch={intent ? true : null}
    onMouseEnter={(event) => { setIntent(true); props.onMouseEnter?.(event) }}
    onFocus={(event) => { setIntent(true); props.onFocus?.(event) }}
    onTouchStart={(event) => { setIntent(true); props.onTouchStart?.(event) }} />
}
