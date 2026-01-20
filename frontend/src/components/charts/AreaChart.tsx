// frontend/src/components/charts/AreaChart.tsx
// D3-based area chart with gradient fill, animated line, hover tooltips
import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"

interface DataPoint {
  date: string
  value: number
}

interface AreaChartProps {
  data: DataPoint[]
  height?: number
  color?: string
  formatValue?: (v: number) => string
  formatDate?: (d: Date) => string
  label?: string
}

export function AreaChart({
  data,
  height = 200,
  color = "#635bff",
  formatValue = (v) => v.toLocaleString(),
  formatDate = (d) => d.toLocaleDateString("en", { month: "short", day: "numeric" }),
  label = "Value"
}: AreaChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; value: string } | null>(null)
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

  // Render chart
  useEffect(() => {
    if (!svgRef.current || !data.length || !width) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const margin = { top: 20, right: 20, bottom: 30, left: 50 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    // Parse dates
    const parsedData = data.map(d => ({
      date: new Date(d.date),
      value: d.value
    })).sort((a, b) => a.date.getTime() - b.date.getTime())

    // Scales
    const x = d3.scaleTime()
      .domain(d3.extent(parsedData, d => d.date) as [Date, Date])
      .range([0, innerWidth])

    const y = d3.scaleLinear()
      .domain([0, d3.max(parsedData, d => d.value) || 0])
      .nice()
      .range([innerHeight, 0])

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`)

    // Gradient
    const gradientId = `area-gradient-${Math.random().toString(36).slice(2)}`
    const defs = svg.append("defs")
    const gradient = defs.append("linearGradient")
      .attr("id", gradientId)
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "0%").attr("y2", "100%")
    gradient.append("stop").attr("offset", "0%").attr("stop-color", color).attr("stop-opacity", 0.3)
    gradient.append("stop").attr("offset", "100%").attr("stop-color", color).attr("stop-opacity", 0)

    // Grid lines
    g.append("g")
      .attr("class", "grid")
      .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(() => ""))
      .selectAll("line").attr("stroke", "rgba(255,255,255,0.06)")
    g.selectAll(".domain").remove()

    // Area
    const area = d3.area<{ date: Date; value: number }>()
      .x(d => x(d.date))
      .y0(innerHeight)
      .y1(d => y(d.value))
      .curve(d3.curveMonotoneX)

    g.append("path")
      .datum(parsedData)
      .attr("fill", `url(#${gradientId})`)
      .attr("d", area)
      .attr("opacity", 0)
      .transition().duration(800)
      .attr("opacity", 1)

    // Line
    const line = d3.line<{ date: Date; value: number }>()
      .x(d => x(d.date))
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX)

    const path = g.append("path")
      .datum(parsedData)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", 2)
      .attr("d", line)

    // Animate line drawing
    const totalLength = path.node()?.getTotalLength() || 0
    path
      .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
      .attr("stroke-dashoffset", totalLength)
      .transition().duration(1000).ease(d3.easeQuadOut)
      .attr("stroke-dashoffset", 0)

    // Dots
    g.selectAll(".dot")
      .data(parsedData)
      .enter().append("circle")
      .attr("cx", d => x(d.date))
      .attr("cy", d => y(d.value))
      .attr("r", 0)
      .attr("fill", color)
      .transition().delay((_, i) => i * 30).duration(200)
      .attr("r", 3)

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d => formatDate(d as Date)))
      .selectAll("text").attr("fill", "rgba(255,255,255,0.5)").attr("font-size", "10px")

    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => {
        const n = d as number
        if (n >= 1000000) return `${(n/1000000).toFixed(1)}M`
        if (n >= 1000) return `${(n/1000).toFixed(0)}k`
        return n.toString()
      }))
      .selectAll("text").attr("fill", "rgba(255,255,255,0.5)").attr("font-size", "10px")

    g.selectAll(".domain").attr("stroke", "rgba(255,255,255,0.1)")

    // Hover interaction
    const focus = g.append("g").style("display", "none")
    focus.append("line")
      .attr("y1", 0).attr("y2", innerHeight)
      .attr("stroke", "rgba(255,255,255,0.2)")
      .attr("stroke-dasharray", "3,3")
    focus.append("circle").attr("r", 5).attr("fill", "#000").attr("stroke", color).attr("stroke-width", 2)

    const bisect = d3.bisector((d: { date: Date }) => d.date).left

    g.append("rect")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .attr("fill", "transparent")
      .style("cursor", "crosshair")
      .on("pointerenter", () => focus.style("display", null))
      .on("pointerleave", () => { focus.style("display", "none"); setTooltip(null) })
      .on("pointermove", (event) => {
        const [mx] = d3.pointer(event)
        const x0 = x.invert(mx)
        const i = bisect(parsedData, x0, 1)
        const a = parsedData[i - 1]
        const b = parsedData[i] ?? a
        const d = x0.getTime() - a.date.getTime() > b.date.getTime() - x0.getTime() ? b : a

        const cx = x(d.date)
        const cy = y(d.value)
        focus.attr("transform", `translate(${cx},0)`)
        focus.select("circle").attr("cy", cy)

        const [px, py] = d3.pointer(event, containerRef.current)
        setTooltip({
          x: Math.min(px + 12, width - 120),
          y: Math.max(py - 50, 10),
          date: formatDate(d.date),
          value: formatValue(d.value)
        })
      })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, width, height, color])

  return (
    <div ref={containerRef} className="relative w-full">
      <svg ref={svgRef} />
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-[hsl(230,12%,10%)] border border-[hsl(230,10%,18%)] rounded-md px-2 py-1.5 sm:px-3 sm:py-2 text-[10px] sm:text-xs z-10"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="text-gray-400 mb-0.5 sm:mb-1">{tooltip.date}</div>
          <div className="text-white font-medium">{label}: {tooltip.value}</div>
        </div>
      )}
    </div>
  )
}
