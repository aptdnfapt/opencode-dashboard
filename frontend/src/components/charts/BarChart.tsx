// frontend/src/components/charts/BarChart.tsx
// D3-based horizontal bar chart with animated bars, tooltips
import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"

interface DataPoint {
  label: string
  value: number
  secondary?: number // optional second value (e.g., lines removed)
}

interface BarChartProps {
  data: DataPoint[]
  height?: number
  color?: string
  secondaryColor?: string
  formatValue?: (v: number) => string
  formatSecondary?: (v: number) => string
  valueLabel?: string
  secondaryLabel?: string
  showSecondary?: boolean
}

// Language colors (GitHub-style)
const LANGUAGE_COLORS: Record<string, string> = {
  ts: "#3178c6",
  tsx: "#3178c6",
  js: "#f7df1e",
  jsx: "#f7df1e",
  py: "#3572A5",
  rs: "#dea584",
  go: "#00ADD8",
  rb: "#701516",
  java: "#b07219",
  cpp: "#f34b7d",
  c: "#555555",
  cs: "#178600",
  php: "#4F5D95",
  swift: "#F05138",
  kt: "#A97BFF",
  vue: "#41b883",
  svelte: "#ff3e00",
  html: "#e34c26",
  css: "#563d7c",
  scss: "#c6538c",
  json: "#292929",
  yaml: "#cb171e",
  md: "#083fa1",
  sql: "#e38c00",
  sh: "#89e051",
  dockerfile: "#384d54",
}

export function BarChart({
  data,
  height = 300,
  color = "#635bff",
  secondaryColor = "#ef4444",
  formatValue = (v) => v.toLocaleString(),
  formatSecondary = (v) => v.toLocaleString(),
  valueLabel = "Value",
  secondaryLabel = "Secondary",
  showSecondary = false
}: BarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: string; secondary?: string } | null>(null)
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

    const margin = { top: 10, right: 80, bottom: 10, left: 70 }
    const innerWidth = width - margin.left - margin.right
    const barHeight = 24
    const barGap = 8
    const chartHeight = data.length * (barHeight + barGap) - barGap
    const totalHeight = chartHeight + margin.top + margin.bottom

    svg.attr("width", width).attr("height", totalHeight)

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`)

    // Scales
    const maxValue = d3.max(data, d => d.value) || 0
    const x = d3.scaleLinear()
      .domain([0, maxValue])
      .range([0, innerWidth])

    const y = d3.scaleBand()
      .domain(data.map(d => d.label))
      .range([0, chartHeight])
      .padding(0.25)

    // Background bars (track)
    g.selectAll(".track")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", 0)
      .attr("y", d => y(d.label)!)
      .attr("width", innerWidth)
      .attr("height", y.bandwidth())
      .attr("fill", "rgba(255,255,255,0.03)")
      .attr("rx", 4)

    // Value bars
    const bars = g.selectAll(".bar")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", 0)
      .attr("y", d => y(d.label)!)
      .attr("width", 0)
      .attr("height", y.bandwidth())
      .attr("fill", d => LANGUAGE_COLORS[d.label] || color)
      .attr("rx", 4)
      .attr("opacity", 0.85)
      .style("cursor", "pointer")
      .on("pointerenter", function(event, d) {
        d3.select(this).attr("opacity", 1)
        const [px, py] = d3.pointer(event, containerRef.current)
        setTooltip({
          x: Math.min(px + 12, width - 150),
          y: py - 40,
          label: d.label,
          value: formatValue(d.value),
          secondary: showSecondary && d.secondary !== undefined ? formatSecondary(d.secondary) : undefined
        })
      })
      .on("pointermove", function(event, d) {
        const [px, py] = d3.pointer(event, containerRef.current)
        setTooltip({
          x: Math.min(px + 12, width - 150),
          y: py - 40,
          label: d.label,
          value: formatValue(d.value),
          secondary: showSecondary && d.secondary !== undefined ? formatSecondary(d.secondary) : undefined
        })
      })
      .on("pointerleave", function() {
        d3.select(this).attr("opacity", 0.85)
        setTooltip(null)
      })

    // Animate bars
    bars.transition()
      .duration(600)
      .delay((_, i) => i * 50)
      .attr("width", d => x(d.value))

    // Labels (left)
    g.selectAll(".label")
      .data(data)
      .enter()
      .append("text")
      .attr("x", -8)
      .attr("y", d => y(d.label)! + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .attr("fill", "rgba(255,255,255,0.7)")
      .attr("font-size", "11px")
      .text(d => d.label.length > 8 ? d.label.slice(0, 8) + "…" : d.label)

    // Value labels (right)
    g.selectAll(".value")
      .data(data)
      .enter()
      .append("text")
      .attr("x", innerWidth + 8)
      .attr("y", d => y(d.label)! + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("fill", "rgba(255,255,255,0.5)")
      .attr("font-size", "11px")
      .attr("font-family", "JetBrains Mono, monospace")
      .text(d => formatValue(d.value))
      .attr("opacity", 0)
      .transition()
      .delay((_, i) => i * 50 + 400)
      .duration(200)
      .attr("opacity", 1)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, width, color, showSecondary])

  const chartHeight = data.length * 32 + 20

  return (
    <div ref={containerRef} className="relative w-full" style={{ minHeight: chartHeight }}>
      <svg ref={svgRef} />
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-[hsl(230,12%,10%)] border border-[hsl(230,10%,18%)] rounded-md px-3 py-2 text-xs z-10"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="text-white font-medium mb-1">.{tooltip.label}</div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">{valueLabel}</span>
            <span className="text-emerald-400">+{tooltip.value}</span>
          </div>
          {tooltip.secondary !== undefined && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">{secondaryLabel}</span>
              <span className="text-red-400">-{tooltip.secondary}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
