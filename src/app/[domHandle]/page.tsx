// Dom profile page — built in Phase 4.
// This stub prevents a 404 while the layout is already wired up.

export const revalidate = 60

interface Props {
  params: Promise<{ domHandle: string }>
}

export default async function DomProfilePage({ params }: Props) {
  const { domHandle } = await params
  return (
    <div className="min-h-screen flex items-center justify-center pt-16">
      <p className="text-gray-600 text-sm">/{domHandle} — profile coming in Phase 4</p>
    </div>
  )
}
