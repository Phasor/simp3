export default function DomHandleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-black text-white">
      {children}
    </div>
  )
}
