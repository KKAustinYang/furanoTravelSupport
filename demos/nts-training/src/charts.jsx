import { radarAxes } from './data.js'
import { CountUp } from './anim.jsx'

export function Radar({ vals, size = 200 }) {
  const cx = size / 2, cy = size / 2, R = size * 0.35, N = vals.length
  const pt = (v, i) => { const a = -Math.PI/2 + i*2*Math.PI/N; return [cx+Math.cos(a)*R*v/100, cy+Math.sin(a)*R*v/100] }
  const rings = [0.25,0.5,0.75,1].map((f,ri)=>{
    const p = radarAxes.map((_,i)=>{ const a=-Math.PI/2+i*2*Math.PI/N; return (cx+Math.cos(a)*R*f)+','+(cy+Math.sin(a)*R*f) }).join(' ')
    return <polygon key={ri} points={p} fill="none" stroke="#EAE5DA" strokeWidth="1" />
  })
  const axes = radarAxes.map((lb,i)=>{ const a=-Math.PI/2+i*2*Math.PI/N; return <line key={i} x1={cx} y1={cy} x2={cx+Math.cos(a)*R} y2={cy+Math.sin(a)*R} stroke="#EAE5DA" strokeWidth="1" /> })
  const labels = radarAxes.map((lb,i)=>{ const a=-Math.PI/2+i*2*Math.PI/N; const lx=cx+Math.cos(a)*(R+16), ly=cy+Math.sin(a)*(R+16); return <text key={i} x={lx} y={ly} fontSize="10" fill="#78828F" textAnchor="middle" dominantBaseline="middle" fontWeight="500">{lb}</text> })
  const poly = vals.map((v,i)=>pt(v,i).join(',')).join(' ')
  const dots = vals.map((v,i)=>{ const [x,y]=pt(v,i); return <circle key={i} cx={x} cy={y} r="3.4" fill="#0F8C7E" stroke="#fff" strokeWidth="1.5" /> })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs><radialGradient id="rdg"><stop offset="0" stopColor="rgba(15,140,126,.28)" /><stop offset="1" stopColor="rgba(15,140,126,.10)" /></radialGradient></defs>
      {rings}{axes}
      <g style={{ transformBox:'fill-box', transformOrigin:'center', animation:'radarIn .9s cubic-bezier(.22,1,.36,1)' }}>
        <polygon points={poly} fill="url(#rdg)" stroke="#0F8C7E" strokeWidth="2" />{dots}
      </g>{labels}
    </svg>
  )
}

export function LineChart({ data, labels }) {
  const W=520, H=190, pad=28, min=60, max=90
  const x = i => pad + i*(W-pad*2)/(data.length-1)
  const y = v => H-pad-(v-min)/(max-min)*(H-pad*2)
  const pass = 76
  const grid = []
  for (let g=60; g<=90; g+=10) { const yy=y(g); grid.push(<line key={'g'+g} x1={pad} y1={yy} x2={W-pad} y2={yy} stroke="#F1E9DA" />); grid.push(<text key={'t'+g} x="6" y={yy+3} fontSize="9" fill="#A79F8F" fontFamily="'Roboto Mono'">{g}</text>) }
  const line = data.map((v,i)=>`${x(i)},${y(v)}`).join(' ')
  const area = `${pad},${H-pad} ${line} ${W-pad},${H-pad}`
  const drawDur = 1.4
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
      <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgba(15,140,126,.24)" /><stop offset="1" stopColor="rgba(15,140,126,0)" /></linearGradient></defs>
      {grid}
      <line x1={pad} y1={y(pass)} x2={W-pad} y2={y(pass)} stroke="#C5502A" strokeWidth="1.4" strokeDasharray="4 4" />
      {/* 面グラフはラインが描かれた後にふわっと出す */}
      <polygon points={area} fill="url(#ag)" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur="0.9s" begin="0.5s" fill="freeze" />
      </polygon>
      {/* ラインを左から右へ描画 */}
      <polyline points={line} fill="none" stroke="#0F8C7E" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset="1">
        <animate attributeName="stroke-dashoffset" from="1" to="0" dur={`${drawDur}s`} begin="0.1s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.5 0 0.15 1" />
      </polyline>
      {/* 各データ点はラインが到達したタイミングでポップ */}
      {data.map((v,i)=>{
        const rr = i===data.length-1?4.5:3.2
        const begin = (0.1 + (i/(data.length-1))*drawDur).toFixed(2)
        return (
          <circle key={i} cx={x(i)} cy={y(v)} r="0" fill="#0F8C7E" stroke="#fff" strokeWidth="1.6">
            <animate attributeName="r" from="0" to={rr} dur="0.45s" begin={`${begin}s`} fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.22 1 0.36 1" />
          </circle>
        )
      })}
      {labels.map((l,i)=><text key={i} x={x(i)} y={H-8} fontSize="9" fill="#A79F8F" textAnchor="middle" fontFamily="'Roboto Mono'">{l}</text>)}
    </svg>
  )
}

export function Donut({ items }) {
  const total = items.reduce((a,b)=>a+b.n,0)
  const size=130, sw=18, r=(size-sw)/2, cx=size/2, cy=size/2, C=2*Math.PI*r
  const gap=1.5 // セグメント間の微小な隙間（度）
  let acc = 0
  const segs = items.map((s,i)=>{
    const frac = s.n/total
    const dash = Math.max(frac*C - gap, 0)
    const rot = acc/total*360 - 90
    acc += s.n
    return { s, dash, rot, i }
  })
  return (
    <div className="donut-wrap">
      <div className="donut-svg" style={{ width:size, height:size }}>
        <svg width={size} height={size}>
          {segs.map(({s,dash,rot,i})=>(
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.c} strokeWidth={sw} strokeLinecap="round"
              strokeDasharray={`0 ${C}`} transform={`rotate(${rot} ${cx} ${cy})`}>
              <animate attributeName="stroke-dasharray" from={`0 ${C}`} to={`${dash} ${C-dash}`} dur="0.85s" begin={`${0.15*i}s`} fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.22 1 0.36 1" />
            </circle>
          ))}
        </svg>
        <div className="dc"><b><CountUp end={total} duration={1200} delay={200} /></b><s>名</s></div>
      </div>
      <div className="donut-legend">
        {items.map((s,i)=>(
          <div className="dl-row" key={i}><span className="sw" style={{ background:s.c }} /><span className="nm">{s.nm}</span><span className="n">{s.n} 名</span></div>
        ))}
      </div>
    </div>
  )
}
