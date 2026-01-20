// frontend/src/components/charts/MultiLineChart.tsx
// D3-based multi-line chart for comparing model performance over time
import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"

interface DataPoint {
  period: string
  models: Record<string, number>
}

interface MultiLineChartProps {
  data: DataPoint[]
  height?: number
  colors?: string[]
  formatValue?: (v: number) => string
  formatDate?: (d: string) => string
  valueLabel?: string
  selectedModels?: string[]
}

const DEFAULT_COLORS = [
  "#635bff", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#f43f5e"
]

export function MultiLineChart({
  data,
  height = 280,
  colors = DEFAULT_COLORS,
  formatValue = (v) => `${(v / 1000).toFixed(1)}s`,
  formatDate = (d) => {
    // If period has time (e.g. "2026-01-20 02:00"), show hour
    if (d.includes(" ")) {
      const timePart = d.split(" ")[1]
      return timePart.slice(0, 5) // "02:00"
    }
    const date = new Date(d)
    return date.toLocaleDateString("en", { month: "short", day: "numeric" })
  },
  valueLabel = "Avg Duration",
  selectedModels = []
}: MultiLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; period: string; models: { name: string; value: string; color: string }[] } | null>(null)
  const [width, setWidth] = useState(0)

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

  // Extract all models
  const allModels = [...new Set(data.flatMap(d => Object.keys(d.models)))]
  const models = selectedModels.length > 0 
    ? allModels.filter(m => selectedModels.includes(m))
    : allModels

  const colorMap = Object.fromEntries(models.map((m, i) => [m, colors[i % colors.length]]))

  // Render chart
  useEffect(() => {
    if (!svgRef.current || !data.length || !width || !models.length) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const margin = { top: 20, right: 20, bottom: 30, left: 50 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`)

    // Scales
    const x = d3.scalePoint()
      .domain(data.map(d => d.period))
      .range([0, innerWidth])
      .padding(0.5)

    const allValues = data.flatMap(d => models.map(m => d.models[m] || 0).filter(v => v > 0))
    const maxValue = d3.max(allValues) || 1000

    const y = d3.scaleLinear()
      .domain([0, maxValue * 1.1])
      .nice()
      .range([innerHeight, 0])

    // Grid
    g.append("g")
      .attr("class", "grid")
      .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(() => ""))
      .selectAll("line").attr("stroke", "rgba(255,255,255,0.06)")
    g.selectAll(".domain").remove()

    // Lines for each model
    models.forEach((model) => {
      const lineData = data
        .filter(d => d.models[model] !== undefined && d.models[model] > 0)
        .map(d => ({ period: d.period, value: d.models[model] }))

      // Single point - just draw a dot
      if (lineData.length === 1) {
        g.append("circle")
          .attr("cx", x(lineData[0].period)!)
          .attr("cy", y(lineData[0].value))
          .attr("r", 5)
          .attr("fill", colorMap[model])
        return
      }

      const line = d3.line<{ period: string; value: number }>()
        .x(d => x(d.period)!)
        .y(d => y(d.value))
        .curve(d3.curveMonotoneX)

      const path = g.append("path")
        .datum(lineData)
        .attr("fill", "none")
        .attr("stroke", colorMap[model])
        .attr("stroke-width", 2)
        .attr("opacity", 0.85)
        .attr("d", line)

      // Animate line
      const totalLength = path.node()?.getTotalLength() || 0
      path
        .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
        .attr("stroke-dashoffset", totalLength)
        .transition().duration(1000).ease(d3.easeQuadOut)
        .attr("stroke-dashoffset", 0)

      // Dots
      g.selectAll(`.dot-${model.replace(/[^a-z0-9]/gi, '')}`)
        .data(lineData)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.period)!)
        .attr("cy", d => y(d.value))
        .attr("r", 0)
        .attr("fill", colorMap[model])
        .transition().delay((_, i) => i * 50 + 800).duration(200)
        .attr("r", 3)
    })

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickFormat(d => formatDate(d as string)))
      .selectAll("text")
      .attr("fill", "rgba(255,255,255,0.5)")
      .attr("font-size", "10px")

    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => formatValue(d as number)))
      .selectAll("text")
      .attr("fill", "rgba(255,255,255,0.5)")
      .attr("font-size", "10px")

    g.selectAll(".domain").attr("stroke", "rgba(255,255,255,0.1)")

    // Vertical hover line
    const focus = g.append("g").style("display", "none")
    focus.append("line")
      .attr("class", "hover-line")
      .attr("y1", 0).attr("y2", innerHeight)
      .attr("stroke", "rgba(255,255,255,0.3)")
      .attr("stroke-dasharray", "3,3")

    // Hover overlay
    g.append("rect")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .attr("fill", "transparent")
      .style("cursor", "crosshair")
      .on("pointerenter", () => focus.style("display", null))
      .on("pointerleave", () => { focus.style("display", "none"); setTooltip(null) })
      .on("pointermove", (event) => {
        const [mx] = d3.pointer(event)
        
        // Find closest data point
        const xDomain = x.domain()
        const xRange = x.range()
        const step = x.step() || 1
        const rangePoints = d3.range(xRange[0], xRange[1], step)
        const i = d3.bisectCenter(rangePoints, mx)
        const period = xDomain[Math.min(i, xDomain.length - 1)]
        
        const dataPoint = data.find(d => d.period === period)
        if (!dataPoint) return

        // Move vertical line
        const cx = x(period)!
        focus.select(".hover-line").attr("x1", cx).attr("x2", cx)

        const [px, py] = d3.pointer(event, containerRef.current)
        const tooltipModels = models
          .filter(m => dataPoint.models[m] !== undefined)
          .map(m => ({
            name: m,
            value: formatValue(dataPoint.models[m]),
            color: colorMap[m]
          }))
          .sort((a, b) => parseFloat(b.value) - parseFloat(a.value))

        setTooltip({
          x: Math.min(px + 12, width - 180),
          y: Math.max(py - 20, 10),
          period: formatDate(period),
          models: tooltipModels
        })
      })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, width, height, models.join(",")])

  return (
    <div ref={containerRef} className="relative w-full">
      <svg ref={svgRef} />
      
      {/* Legend */}
      {models.length > 0 && (
        <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-white/10">
          {models.map(m => (
            <div key={m} className="flex items-center gap-2">
              <div className="w-3 h-0.5 rounded" style={{ background: colorMap[m] }} />
              <span className="text-xs text-gray-400">{m}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-[hsl(230,12%,10%)] border border-[hsl(230,10%,18%)] rounded-md px-3 py-2 text-xs z-10 min-w-[150px]"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="text-gray-400 mb-2">{tooltip.period}</div>
          {tooltip.models.map(m => (
            <div key={m.name} className="flex items-center justify-between gap-3 mb-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                <span className="text-white truncate max-w-[80px]">{m.name}</span>
              </div>
              <span className="text-gray-300 font-mono">{m.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
