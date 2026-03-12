import WordmarkOnly from '@/components/WordmarkOnly'

// Public dom profile pages always use WordmarkOnly, regardless of auth state.
// NavSwitcher in the root layout is bypassed here because [domHandle] routes
// are matched before the global nav logic fires — and WordmarkOnly is rendered
// directly in this layout.

export default function DomHandleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-black text-white">
      <WordmarkOnly />
      {children}
    </div>
  )
}
