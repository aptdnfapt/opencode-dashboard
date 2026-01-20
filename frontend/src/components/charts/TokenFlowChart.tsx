// frontend/src/components/charts/TokenFlowChart.tsx
// D3-based dual area chart showing input vs output tokens over time
import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"

interface DataPoint {
  period: string
  input: number
  output: number
}

interface TokenFlowChartProps {
  data: DataPoint[]
  height?: number
}

export function TokenFlowChart({ data, height = 200 }: TokenFlowChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; period: string; input: string; output: string } | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width)
    })
    observer.observe(containerRef.current)
    setWidth(containerRef.current.clientWidth)
    return () => observer.disconnect()
  }, [])

  const formatPeriod = (p: string) => {
    if (p.includes(" ")) return p.split(" ")[1]
    return new Date(p).toLocaleDateString("en", { month: "short", day: "numeric" })
  }

  const formatTokens = (n: number) => {
    if (n >= 1000000) return `${(n/1000000).toFixed(1)}M`
    if (n >= 1000) return `${(n/1000).toFixed(0)}k`
    return n.toString()
  }

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

    const maxValue = d3.max(data, d => Math.max(d.input, d.output)) || 0
    const y = d3.scaleLinear()
      .domain([0, maxValue * 1.1])
      .nice()
      .range([innerHeight, 0])

    // Grid
    g.append("g")
      .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(() => ""))
      .selectAll("line").attr("stroke", "rgba(255,255,255,0.06)")
    g.selectAll(".domain").remove()

    // Always show line chart (even for single data point)
    const defs = svg.append("defs")
      
      const inputGradient = defs.append("linearGradient")
        .attr("id", "input-gradient")
        .attr("x1", "0%").attr("y1", "0%").attr("x2", "0%").attr("y2", "100%")
      inputGradient.append("stop").attr("offset", "0%").attr("stop-color", "#635bff").attr("stop-opacity", 0.3)
      inputGradient.append("stop").attr("offset", "100%").attr("stop-color", "#635bff").attr("stop-opacity", 0)

      const outputGradient = defs.append("linearGradient")
        .attr("id", "output-gradient")
        .attr("x1", "0%").attr("y1", "0%").attr("x2", "0%").attr("y2", "100%")
      outputGradient.append("stop").attr("offset", "0%").attr("stop-color", "#10b981").attr("stop-opacity", 0.3)
      outputGradient.append("stop").attr("offset", "100%").attr("stop-color", "#10b981").attr("stop-opacity", 0)

      const x = d3.scalePoint()
        .domain(data.map(d => d.period))
        .range([0, innerWidth])
        .padding(0.5)

      const areaInput = d3.area<DataPoint>()
        .x(d => x(d.period)!)
        .y0(innerHeight)
        .y1(d => y(d.input))
        .curve(d3.curveMonotoneX)

      const areaOutput = d3.area<DataPoint>()
        .x(d => x(d.period)!)
        .y0(innerHeight)
        .y1(d => y(d.output))
        .curve(d3.curveMonotoneX)

      g.append("path").datum(data).attr("fill", "url(#input-gradient)").attr("d", areaInput)
      g.append("path").datum(data).attr("fill", "url(#output-gradient)").attr("d", areaOutput)

      const lineInput = d3.line<DataPoint>().x(d => x(d.period)!).y(d => y(d.input)).curve(d3.curveMonotoneX)
      const lineOutput = d3.line<DataPoint>().x(d => x(d.period)!).y(d => y(d.output)).curve(d3.curveMonotoneX)

      g.append("path").datum(data).attr("fill", "none").attr("stroke", "#635bff").attr("stroke-width", 2).attr("d", lineInput)
      g.append("path").datum(data).attr("fill", "none").attr("stroke", "#10b981").attr("stroke-width", 2).attr("d", lineOutput)

      // Add dots for each data point (essential for single point visibility)
      data.forEach(d => {
        g.append("circle")
          .attr("cx", x(d.period)!)
          .attr("cy", y(d.input))
          .attr("r", 4)
          .attr("fill", "#635bff")
        g.append("circle")
          .attr("cx", x(d.period)!)
          .attr("cy", y(d.output))
          .attr("r", 4)
          .attr("fill", "#10b981")
      })

      g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).tickFormat(d => formatPeriod(d as string)))
        .selectAll("text").attr("fill", "rgba(255,255,255,0.5)").attr("font-size", "10px")

    // Vertical hover line + dots
    const focus = g.append("g").style("display", "none")
    focus.append("line")
      .attr("class", "hover-line")
      .attr("y1", 0).attr("y2", innerHeight)
      .attr("stroke", "rgba(255,255,255,0.3)")
      .attr("stroke-dasharray", "3,3")
    focus.append("circle").attr("class", "input-dot").attr("r", 5).attr("fill", "#635bff")
    focus.append("circle").attr("class", "output-dot").attr("r", 5).attr("fill", "#10b981")

    // Hover
    g.append("rect")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .attr("fill", "transparent")
      .style("cursor", "crosshair")
      .on("pointerenter", () => focus.style("display", null))
      .on("pointerleave", () => { focus.style("display", "none"); setTooltip(null) })
      .on("pointermove", (event) => {
        const [mx] = d3.pointer(event)
        const xDomain = x.domain()
        const xRange = x.range()
        const step = x.step() || 1
        const rangePoints = d3.range(xRange[0], xRange[1], step)
        const i = d3.bisectCenter(rangePoints, mx)
        const period = xDomain[Math.min(i, xDomain.length - 1)]
        const dataPoint = data.find(d => d.period === period)
        if (!dataPoint) return

        const cx = x(period)!
        focus.select(".hover-line").attr("x1", cx).attr("x2", cx)
        focus.select(".input-dot").attr("cx", cx).attr("cy", y(dataPoint.input))
        focus.select(".output-dot").attr("cx", cx).attr("cy", y(dataPoint.output))

        const [px, py] = d3.pointer(event, containerRef.current)
        setTooltip({
          x: Math.min(px + 12, width - 150),
          y: Math.max(py - 60, 10),
          period: formatPeriod(period),
          input: dataPoint.input.toLocaleString(),
          output: dataPoint.output.toLocaleString()
        })
      })

    // Y axis
    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => formatTokens(d as number)))
      .selectAll("text").attr("fill", "rgba(255,255,255,0.5)").attr("font-size", "10px")

    g.selectAll(".domain").attr("stroke", "rgba(255,255,255,0.1)")

  }, [data, width, height])

  return (
    <div ref={containerRef} className="relative w-full">
      <svg ref={svgRef} />
      <div className="flex gap-4 mt-3 pt-3 border-t border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 rounded bg-[#635bff]" />
          <span className="text-xs text-gray-400">Input</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 rounded bg-[#10b981]" />
          <span className="text-xs text-gray-400">Output</span>
        </div>
      </div>
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-[hsl(230,12%,10%)] border border-[hsl(230,10%,18%)] rounded-md px-3 py-2 text-xs z-10"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="text-gray-400 mb-1">{tooltip.period}</div>
          <div className="flex justify-between gap-4">
            <span className="text-[#635bff]">Input</span>
            <span className="text-white">{tooltip.input}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#10b981]">Output</span>
            <span className="text-white">{tooltip.output}</span>
          </div>
        </div>
      )}
    </div>
  )
}
