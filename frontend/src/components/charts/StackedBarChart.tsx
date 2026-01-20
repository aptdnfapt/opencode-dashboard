// frontend/src/components/charts/StackedBarChart.tsx
// D3-based stacked bar chart for model usage over time
import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"

interface DataPoint {
  period: string
  total: number
  models: Record<string, number>
}

interface StackedBarChartProps {
  data: DataPoint[]
  height?: number
  formatValue?: (v: number) => string
  formatDate?: (d: string) => string
}

const COLORS = [
  "#635bff", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#f43f5e"
]

export function StackedBarChart({
  data,
  height = 280,
  formatValue = (v) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
    if (v >= 1000) return `${(v / 1000).toFixed(0)}k`
    return v.toString()
  },
  formatDate = (d) => {
    if (d.includes(" ")) return d.split(" ")[1]
    return new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" })
  }
}: StackedBarChartProps) {
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
  const allModels = [...new Set(data.flatMap(d => Object.keys(d.models || {})))]
  const colorMap = Object.fromEntries(allModels.map((m, i) => [m, COLORS[i % COLORS.length]]))

  // Render chart
  useEffect(() => {
    if (!svgRef.current || !data.length || !width) return

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
    const x = d3.scaleBand()
      .domain(data.map(d => d.period))
      .range([0, innerWidth])
      .padding(0.3)

    const maxValue = d3.max(data, d => d.total) || 0
    const y = d3.scaleLinear()
      .domain([0, maxValue * 1.1])
      .nice()
      .range([innerHeight, 0])

    // Grid
    g.append("g")
      .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(() => ""))
      .selectAll("line").attr("stroke", "rgba(255,255,255,0.06)")
    g.selectAll(".domain").remove()

    // Stack data
    const stackedData = data.map(d => {
      let y0 = 0
      return {
        period: d.period,
        total: d.total,
        models: d.models,
        stacks: allModels.map(model => {
          const value = d.models[model] || 0
          const stack = { model, y0, y1: y0 + value, value }
          y0 += value
          return stack
        }).filter(s => s.value > 0)
      }
    })

    // Draw bars
    stackedData.forEach(d => {
      const barGroup = g.append("g")
        .attr("transform", `translate(${x(d.period)}, 0)`)

      d.stacks.forEach((stack, i) => {
        barGroup.append("rect")
          .attr("x", 0)
          .attr("y", innerHeight)
          .attr("width", x.bandwidth())
          .attr("height", 0)
          .attr("fill", colorMap[stack.model])
          .attr("rx", i === d.stacks.length - 1 ? 3 : 0) // Round top corners
          .style("cursor", "pointer")
          .transition()
          .duration(600)
          .delay(data.indexOf(d) * 30)
          .attr("y", y(stack.y1))
          .attr("height", y(stack.y0) - y(stack.y1))
      })

      // Invisible rect for hover
      barGroup.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", x.bandwidth())
        .attr("height", innerHeight)
        .attr("fill", "transparent")
        .style("cursor", "pointer")
        .on("pointerenter", (event) => {
          const [px, py] = d3.pointer(event, containerRef.current)
          setTooltip({
            x: Math.min(px + 12, width - 180),
            y: Math.max(py - 20, 10),
            period: formatDate(d.period),
            models: d.stacks.map(s => ({
              name: s.model,
              value: formatValue(s.value),
              color: colorMap[s.model]
            })).reverse()
          })
        })
        .on("pointerleave", () => setTooltip(null))
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, width, height, allModels.join(",")])

  return (
    <div ref={containerRef} className="relative w-full">
      <svg ref={svgRef} />
      
      {/* Legend */}
      {allModels.length > 0 && (
        <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-white/10">
          {allModels.map(m => (
            <div key={m} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ background: colorMap[m] }} />
              <span className="text-xs text-gray-400 truncate max-w-[150px]">{m}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-[hsl(230,12%,10%)] border border-[hsl(230,10%,18%)] rounded-md px-3 py-2 text-xs z-10 min-w-[140px]"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="text-gray-400 mb-2">{tooltip.period}</div>
          {tooltip.models.map(m => (
            <div key={m.name} className="flex items-center justify-between gap-3 mb-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-sm" style={{ background: m.color }} />
                <span className="text-white truncate max-w-[80px]">{m.name.split('/').pop()}</span>
              </div>
              <span className="text-gray-300 font-mono">{m.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
