import type { ReactNode } from 'react'
import type { StateType } from '../linear/model'

type IconProps = { className?: string }

function Svg({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={className} aria-hidden="true">
      {children}
    </svg>
  )
}

/** Linear's status glyphs: dashed for backlog, empty for todo, half for started, check / cross when closed. */
export function StatusIcon({ type, color }: { type: StateType; color: string }) {
  if (type === 'backlog' || type === 'triage') {
    return (
      <Svg>
        <circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.5" strokeDasharray="2 1.6" />
      </Svg>
    )
  }
  if (type === 'unstarted') {
    return (
      <Svg>
        <circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.5" />
      </Svg>
    )
  }
  if (type === 'started') {
    return (
      <Svg>
        <circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.5" />
        <path d="M7 3.5a3.5 3.5 0 0 1 0 7z" fill={color} />
      </Svg>
    )
  }
  if (type === 'completed') {
    return (
      <Svg>
        <circle cx="7" cy="7" r="6" fill={color} />
        <path d="M4.5 7.2l1.7 1.7 3.3-3.6" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    )
  }
  return (
    <Svg>
      <circle cx="7" cy="7" r="6" fill={color} />
      <path d="M5 5l4 4M9 5l-4 4" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
    </Svg>
  )
}

/** 0 none, 1 urgent, 2 high, 3 medium, 4 low. */
export function PriorityIcon({ priority, className }: { priority: number } & IconProps) {
  if (priority === 0) {
    return (
      <Svg className={className}>
        <path d="M2.5 7h2M6 7h2M9.5 7h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
      </Svg>
    )
  }
  if (priority === 1) {
    return (
      <Svg className={className}>
        <rect x="1.5" y="1.5" width="11" height="11" rx="2.5" fill="#f2994a" />
        <path d="M7 4v3.6" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="7" cy="9.9" r="0.9" fill="white" />
      </Svg>
    )
  }
  const filledBars = 5 - priority
  return (
    <Svg className={className}>
      {[0, 1, 2].map((bar) => (
        <rect
          key={bar}
          x={2 + bar * 3.6}
          y={8.5 - bar * 3}
          width="2.4"
          height={3.5 + bar * 3}
          rx="0.8"
          fill="currentColor"
          opacity={bar < filledBars ? 1 : 0.3}
        />
      ))}
    </Svg>
  )
}

export function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) return <img src={avatarUrl} alt="" className="size-4 rounded-full object-cover" />
  const initial = name.trim().charAt(0).toUpperCase()
  return (
    <span className="flex size-4 items-center justify-center rounded-full bg-[var(--color-border-strong)] text-[9px] font-semibold">
      {initial}
    </span>
  )
}

export function ColorDot({ color }: { color: string }) {
  return <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
}

export function PersonIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="7" cy="7" r="5.75" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 1.5" />
      <circle cx="7" cy="5.8" r="1.7" fill="currentColor" />
      <path d="M4.2 10.2c.6-1.2 1.6-1.8 2.8-1.8s2.2.6 2.8 1.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </Svg>
  )
}

export function ProjectIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M7 1.6l4.9 2.6v5.6L7 12.4 2.1 9.8V4.2z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M2.3 4.3L7 6.8l4.7-2.5M7 6.8v5.4" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
    </Svg>
  )
}

export function TagIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M5 3.5h5.5a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a1.2 1.2 0 0 1-.9-.4L1.8 7.5a.8.8 0 0 1 0-1l2.3-2.6A1.2 1.2 0 0 1 5 3.5z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function EstimateIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M7 1.8l5.3 9.6H1.7z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M7 1.8v9.6H1.7z" fill="currentColor" />
    </Svg>
  )
}

export function CycleIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="7" cy="7" r="5.6" stroke="currentColor" strokeWidth="1.25" />
      <path d="M5.8 4.9v4.2L9.2 7z" fill="currentColor" />
    </Svg>
  )
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="2" y="3" width="10" height="9" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 6h10M5 1.5v3M9 1.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </Svg>
  )
}

export function ParentIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 2v4.5a2 2 0 0 0 2 2h6M8.5 6l2.5 2.5L8.5 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function PaperclipIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M11.5 6.5l-4.6 4.6a2.8 2.8 0 0 1-4-4L7.6 2.4a1.9 1.9 0 0 1 2.7 2.7L5.7 9.7a.9.9 0 0 1-1.3-1.3L8.6 4.2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </Svg>
  )
}

export function CameraIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M1.8 4.5a1 1 0 0 1 1-1h1.7L5.5 2h3l1 1.5h1.7a1 1 0 0 1 1 1V11a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1z" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="7" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.3" />
    </Svg>
  )
}

export function CloseIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </Svg>
  )
}

export function MoreIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="3" cy="7" r="1.1" fill="currentColor" />
      <circle cx="7" cy="7" r="1.1" fill="currentColor" />
      <circle cx="11" cy="7" r="1.1" fill="currentColor" />
    </Svg>
  )
}

/** Linear's default team badge: a rounded square in the team colour with a person inside. */
export function TeamIcon({ color }: { color: string }) {
  return (
    <Svg>
      <rect x="1.5" y="1.5" width="11" height="11" rx="2.5" stroke={color} strokeWidth="1.3" />
      <circle cx="7" cy="5.6" r="1.6" fill={color} />
      <path d="M4.3 10.2c.5-1.3 1.5-2 2.7-2s2.2.7 2.7 2" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </Svg>
  )
}

export function CheckIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 7.3l2.6 2.6L11 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function PlayIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4.5 2.8v8.4l7-4.2z" fill="currentColor" />
    </Svg>
  )
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5.5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}
