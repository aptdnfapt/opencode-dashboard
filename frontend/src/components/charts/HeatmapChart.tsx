// frontend/src/components/charts/HeatmapChart.tsx
// D3-based GitHub-style calendar heatmap
import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"

interface DataPoint {
  date: string
  tokens: number
  cost?: number
  requests?: number
}

interface HeatmapChartProps {
  data: DataPoint[]
  height?: number
  color?: string
  formatValue?: (v: number) => string
}

export function HeatmapChart({
  data,
  height = 140,
  color = "#635bff",
  formatValue = (v) => v.toLocaleString()
}: HeatmapChartProps) {
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
    if (!svgRef.current || !width) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const cellSize = 12
    const cellGap = 3
    const margin = { top: 20, right: 20, bottom: 10, left: 40 }

    // Create date map
    const dataMap = new Map(data.map(d => [d.date, d.tokens]))

    // Generate all dates for past year
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 364)

    const dates: Date[] = []
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d))
    }

    // Calculate weeks
    const weeks = d3.groups(dates, d => d3.timeWeek.floor(d).getTime())

    const chartWidth = weeks.length * (cellSize + cellGap) + margin.left + margin.right
    const chartHeight = 7 * (cellSize + cellGap) + margin.top + margin.bottom

    svg.attr("width", Math.max(chartWidth, width)).attr("height", chartHeight)

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`)

    // Color scale
    const maxValue = d3.max(data, d => d.tokens) || 1
    const colorScale = d3.scaleSequential()
      .domain([0, maxValue])
      .interpolator(d3.interpolate("rgba(255,255,255,0.05)", color))

    // Day labels
    const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""]
    g.selectAll(".day-label")
      .data(dayLabels)
      .enter()
      .append("text")
      .attr("x", -8)
      .attr("y", (_, i) => i * (cellSize + cellGap) + cellSize / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .attr("fill", "rgba(255,255,255,0.4)")
      .attr("font-size", "9px")
      .text(d => d)

    // Month labels
    const monthStarts = weeks.filter((_, i, arr) => {
      if (i === 0) return true
      const prevWeek = arr[i - 1][1][0]
      const thisWeek = weeks[i][1][0]
      return prevWeek.getMonth() !== thisWeek.getMonth()
    })

    g.selectAll(".month-label")
      .data(monthStarts)
      .enter()
      .append("text")
      .attr("x", (d, i) => {
        const weekIndex = weeks.findIndex(w => w[0] === d[0])
        return weekIndex * (cellSize + cellGap)
      })
      .attr("y", -6)
      .attr("fill", "rgba(255,255,255,0.4)")
      .attr("font-size", "9px")
      .text(d => d3.timeFormat("%b")(d[1][0]))

    // Cells
    weeks.forEach((week, weekIndex) => {
      week[1].forEach(date => {
        const dayOfWeek = date.getDay()
        const dateStr = d3.timeFormat("%Y-%m-%d")(date)
        const value = dataMap.get(dateStr) || 0

        g.append("rect")
          .attr("x", weekIndex * (cellSize + cellGap))
          .attr("y", dayOfWeek * (cellSize + cellGap))
          .attr("width", cellSize)
          .attr("height", cellSize)
          .attr("rx", 2)
          .attr("fill", value > 0 ? colorScale(value) : "rgba(255,255,255,0.05)")
          .attr("stroke", "rgba(0,0,0,0.2)")
          .attr("stroke-width", 0.5)
          .style("cursor", "pointer")
          .on("pointerenter", function(event) {
            d3.select(this).attr("stroke", "rgba(255,255,255,0.5)").attr("stroke-width", 1)
            const [px, py] = d3.pointer(event, containerRef.current)
            setTooltip({
              x: Math.min(px + 12, width - 150),
              y: py - 50,
              date: d3.timeFormat("%b %d, %Y")(date),
              value: formatValue(value)
            })
          })
          .on("pointerleave", function() {
            d3.select(this).attr("stroke", "rgba(0,0,0,0.2)").attr("stroke-width", 0.5)
            setTooltip(null)
          })
      })
    })

    // Legend
    const legendWidth = 100
    const legendX = width - margin.right - legendWidth - 20
    const legendG = svg.append("g")
      .attr("transform", `translate(${legendX},${chartHeight - 20})`)

    const legendScale = d3.scaleLinear().domain([0, 4]).range([0, legendWidth])
    const legendData = [0, 1, 2, 3, 4]

    legendG.append("text")
      .attr("x", -30)
      .attr("y", 8)
      .attr("fill", "rgba(255,255,255,0.4)")
      .attr("font-size", "9px")
      .text("Less")

    legendData.forEach((_, i) => {
      legendG.append("rect")
        .attr("x", i * 14)
        .attr("y", 0)
        .attr("width", 12)
        .attr("height", 12)
        .attr("rx", 2)
        .attr("fill", colorScale((maxValue / 4) * i))
    })

    legendG.append("text")
      .attr("x", 5 * 14 + 4)
      .attr("y", 8)
      .attr("fill", "rgba(255,255,255,0.4)")
      .attr("font-size", "9px")
      .text("More")

  }, [data, width, color, formatValue])

  return (
    <div ref={containerRef} className="relative w-full overflow-x-auto">
      <svg ref={svgRef} />
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-[hsl(230,12%,10%)] border border-[hsl(230,10%,18%)] rounded-md px-2 py-1.5 sm:px-3 sm:py-2 text-[10px] sm:text-xs z-10"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="text-white font-medium">{tooltip.date}</div>
          <div className="text-gray-400">{tooltip.value} tokens</div>
        </div>
      )}
    </div>
  )
}
