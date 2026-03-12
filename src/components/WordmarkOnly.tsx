import Link from 'next/link'

export default function WordmarkOnly() {
  return (
    <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="p-5">
        <Link
          href="/"
          className="pointer-events-auto text-white font-bold text-xl tracking-tight hover:opacity-80 transition-opacity"
        >
          Tribute
        </Link>
      </div>
    </div>
  )
}
