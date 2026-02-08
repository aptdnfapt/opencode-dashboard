// frontend/src/components/charts/DonutChart.tsx
// D3-based donut chart with hover effects, center text, animated segments
import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"

interface DataPoint {
  label: string
  value: number
}

interface DonutChartProps {
  data: DataPoint[]
  height?: number
  colors?: string[]
  formatValue?: (v: number) => string
  centerLabel?: string
}

const DEFAULT_COLORS = [
  "#635bff", // indigo
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f43f5e", // rose
]

export function DonutChart({
  data,
  height = 280,
  colors = DEFAULT_COLORS,
  formatValue = (v) => `$${v.toFixed(2)}`,
  centerLabel = "TOTAL"
}: DonutChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: string; percent: string } | null>(null)
  const [width, setWidth] = useState(0)
  const [centerText, setCenterText] = useState<{ value: string; label: string; color: string }>({ value: "", label: centerLabel, color: "#635bff" })

  // Handle resize
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width)
    })
    observer.observe(containerRef.current)
    setWidth(containerRef.current.clientWidth)
    return () => observer.disconnect()
  }, [])

  // Calculate total
  const total = data.reduce((sum, d) => sum + d.value, 0)

  // Set initial center text
  useEffect(() => {
    setCenterText({ value: formatValue(total), label: centerLabel, color: "#635bff" })
  }, [total, formatValue, centerLabel])

  // Render chart
  useEffect(() => {
    if (!svgRef.current || !data.length || !width) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const size = Math.min(width, height)
    const radius = size / 2 - 20
    const innerRadius = radius * 0.6

    svg.attr("width", width).attr("height", height)

    const g = svg.append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`)

    const pie = d3.pie<DataPoint>()
      .value(d => d.value)
      .sort(null)
      .padAngle(0.02)

    const arc = d3.arc<d3.PieArcDatum<DataPoint>>()
      .innerRadius(innerRadius)
      .outerRadius(radius)

    const arcHover = d3.arc<d3.PieArcDatum<DataPoint>>()
      .innerRadius(innerRadius)
      .outerRadius(radius + 8)

    const pieData = pie(data)

    // Segments
    const paths = g.selectAll("path")
      .data(pieData)
      .enter()
      .append("path")
      .attr("fill", (_, i) => colors[i % colors.length])
      .attr("opacity", 0.9)
      .attr("stroke", "rgba(0,0,0,0.3)")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("pointerenter", function(event, d) {
        const color = colors[d.index % colors.length]
        d3.select(this)
          .interrupt()
          .transition().duration(150)
          .attr("d", arcHover(d))
          .attr("opacity", 1)

        const percent = total > 0 ? ((d.data.value / total) * 100).toFixed(1) : "0"
        setCenterText({ value: formatValue(d.data.value), label: d.data.label, color })

        const [px, py] = d3.pointer(event, containerRef.current)
        setTooltip({
          x: Math.min(px + 12, width - 140),
          y: Math.max(py - 60, 10),
          label: d.data.label,
          value: formatValue(d.data.value),
          percent: `${percent}%`
        })
      })
      .on("pointermove", function(event, d) {
        const [px, py] = d3.pointer(event, containerRef.current)
        const percent = total > 0 ? ((d.data.value / total) * 100).toFixed(1) : "0"
        setTooltip({
          x: Math.min(px + 12, width - 140),
          y: Math.max(py - 60, 10),
          label: d.data.label,
          value: formatValue(d.data.value),
          percent: `${percent}%`
        })
      })
      .on("pointerleave", function(_, d) {
        d3.select(this)
          .interrupt()
          .transition().duration(150)
          .attr("d", arc(d))
          .attr("opacity", 0.9)

        setCenterText({ value: formatValue(total), label: centerLabel, color: "#635bff" })
        setTooltip(null)
      })

    // Animate segments
    paths
      .transition()
      .duration(800)
      .attrTween("d", function(d) {
        const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d)
        return (t) => arc(interpolate(t)) || ""
      })

  }, [data, width, height, colors, total, formatValue, centerLabel])

  return (
    <div ref={containerRef} className="relative w-full">
      <svg ref={svgRef} />
      
      {/* Center text */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        style={{ top: 0, left: 0 }}
      >
        <span
          className="text-xl sm:text-2xl font-semibold font-mono transition-colors duration-150"
          style={{ color: centerText.color }}
        >
          {centerText.value}
        </span>
        <span className="text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-wider mt-1">
          {centerText.label}
        </span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-[hsl(230,12%,10%)] border border-[hsl(230,10%,18%)] rounded-md px-2 py-1.5 sm:px-3 sm:py-2 text-[10px] sm:text-xs z-10"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="text-white font-medium mb-1">{tooltip.label}</div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Cost</span>
            <span className="text-white">{tooltip.value}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Share</span>
            <span className="text-white">{tooltip.percent}</span>
          </div>
        </div>
      )}
    </div>
  )
}
