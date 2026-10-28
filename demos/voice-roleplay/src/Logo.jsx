let uid = 0
export default function Logo() {
  const id = `ntsg-${uid++}`
  return (
    <svg viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f9bd8" />
          <stop offset="1" stopColor="#0a5ea3" />
        </linearGradient>
      </defs>
      <text x="30" y="24" textAnchor="middle" fontFamily="Georgia,'Times New Roman',serif" fontSize="27" fontStyle="italic" fontWeight="700" fill={`url(#${id})`} letterSpacing="1.5">NTS</text>
    </svg>
  )
}
