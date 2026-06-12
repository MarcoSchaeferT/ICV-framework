"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

/**
 * Performance Indicator — real-time FPS counter + memory/DOM metric with D3.js live graphs.
 * Shows JS heap (Chrome/Edge) or DOM node count (Firefox/Safari) as a secondary metric.
 * Click to toggle graph. Double-click to hide (small dot remains to re-open).
 */

const MAX_HISTORY = 90;
const GRAPH_W = 140;
const GRAPH_H = 34;

/* Metric colors */
const MEM_COLOR = "#60a5fa"; // blue-400 for memory/DOM line

type MetricMode = "ram" | "dom";

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export default function FpsIndicator() {
  const [fps, setFps] = useState(0);
  const [metricValue, setMetricValue] = useState("—");
  const [metricMode, setMetricMode] = useState<MetricMode>("dom");
  const [visible, setVisible] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const frameTimesRef = useRef<number[]>([]);
  const lastTimeRef = useRef(performance.now());
  const rafRef = useRef<number>(0);

  const fpsHistoryRef = useRef<number[]>([]);
  const memHistoryRef = useRef<number[]>([]);    // raw values for graphing
  const svgRef = useRef<SVGSVGElement>(null);
  const d3InitedRef = useRef(false);
  const metricModeRef = useRef<MetricMode>("dom");

  // Detect metric mode once on mount
  useEffect(() => {
    const perf = performance as unknown as { memory?: PerformanceMemory };
    const mode: MetricMode = perf.memory ? "ram" : "dom";
    setMetricMode(mode);
    metricModeRef.current = mode;
  }, []);

  const getColor = useCallback((v: number) => {
    if (v >= 55) return "#4ade80";
    if (v >= 30) return "#facc15";
    return "#f87171";
  }, []);

  /** Read the secondary metric and return { label, display, raw } */
  const readMetric = useCallback(() => {
    const perf = performance as unknown as { memory?: PerformanceMemory };
    if (metricModeRef.current === "ram" && perf.memory) {
      const mb = perf.memory.usedJSHeapSize / (1024 * 1024);
      return { display: `${mb.toFixed(1)} MB`, raw: mb };
    }
    const count = document.querySelectorAll("*").length;
    if (count >= 1000) {
      return { display: `${(count / 1000).toFixed(1)}k`, raw: count };
    }
    return { display: `${count}`, raw: count };
  }, []);

  // rAF tick
  const tick = useCallback(() => {
    const now = performance.now();
    const delta = now - lastTimeRef.current;
    lastTimeRef.current = now;
    frameTimesRef.current.push(delta);

    if (frameTimesRef.current.length >= 15) {
      const avg =
        frameTimesRef.current.reduce((a, b) => a + b, 0) /
        frameTimesRef.current.length;
      const currentFps = Math.round(1000 / avg);
      setFps(currentFps);

      fpsHistoryRef.current.push(currentFps);
      if (fpsHistoryRef.current.length > MAX_HISTORY) {
        fpsHistoryRef.current.shift();
      }

      // Read secondary metric
      const metric = readMetric();
      setMetricValue(metric.display);
      memHistoryRef.current.push(metric.raw);
      if (memHistoryRef.current.length > MAX_HISTORY) {
        memHistoryRef.current.shift();
      }

      frameTimesRef.current = [];

      // Update D3 graph directly via refs
      updateGraph(currentFps);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [readMetric]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  // Initialize D3 elements once
  useEffect(() => {
    if (!svgRef.current || d3InitedRef.current) return;
    d3InitedRef.current = true;

    const svg = d3.select(svgRef.current);
    const defs = svg.append("defs");

    // FPS gradient
    const fpsGrad = defs
      .append("linearGradient")
      .attr("id", "fps-grad")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "0%").attr("y2", "100%");
    fpsGrad.append("stop").attr("offset", "0%").attr("class", "fps-grad-top").attr("stop-opacity", 0.3);
    fpsGrad.append("stop").attr("offset", "100%").attr("class", "fps-grad-bot").attr("stop-opacity", 0.02);

    // Memory/DOM gradient
    const memGrad = defs
      .append("linearGradient")
      .attr("id", "mem-grad")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "0%").attr("y2", "100%");
    memGrad.append("stop").attr("offset", "0%").attr("stop-color", MEM_COLOR).attr("stop-opacity", 0.2);
    memGrad.append("stop").attr("offset", "100%").attr("stop-color", MEM_COLOR).attr("stop-opacity", 0.02);

    // FPS paths
    svg.append("path").attr("class", "fps-area").attr("fill", "url(#fps-grad)");
    svg.append("path").attr("class", "fps-line").attr("fill", "none").attr("stroke-width", 1.5).attr("stroke-linejoin", "round");
    svg.append("circle").attr("class", "fps-dot").attr("r", 2.5);

    // Memory/DOM paths
    svg.append("path").attr("class", "mem-area").attr("fill", "url(#mem-grad)");
    svg.append("path").attr("class", "mem-line").attr("fill", "none").attr("stroke", MEM_COLOR).attr("stroke-width", 1.2).attr("stroke-linejoin", "round").attr("stroke-dasharray", "3,2");
    svg.append("circle").attr("class", "mem-dot").attr("r", 2).attr("fill", MEM_COLOR);
  }, [expanded]);

  // Reset D3 init flag when graph visibility toggles
  useEffect(() => {
    d3InitedRef.current = false;
  }, [expanded]);

  function updateGraph(currentFps: number) {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const fpsData = fpsHistoryRef.current;
    const memData = memHistoryRef.current;
    if (fpsData.length < 2) return;

    const fpsColor = getColor(currentFps);
    const yMax = Math.max(d3.max(fpsData) ?? 60, 60);

    const xScale = d3.scaleLinear().domain([0, MAX_HISTORY - 1]).range([0, GRAPH_W]);

    // FPS y-scale
    const yScaleFps = d3.scaleLinear().domain([0, yMax]).range([GRAPH_H, 0]);
    const fpsOffset = MAX_HISTORY - fpsData.length;

    const fpsLine = d3.line<number>()
      .x((_, i) => xScale(i + fpsOffset))
      .y((d) => yScaleFps(d))
      .curve(d3.curveMonotoneX);

    const fpsArea = d3.area<number>()
      .x((_, i) => xScale(i + fpsOffset))
      .y0(GRAPH_H)
      .y1((d) => yScaleFps(d))
      .curve(d3.curveMonotoneX);

    svg.select(".fps-area").datum(fpsData).attr("d", fpsArea);
    svg.select(".fps-line").datum(fpsData).attr("d", fpsLine).attr("stroke", fpsColor);
    svg.select(".fps-grad-top").attr("stop-color", fpsColor);
    svg.select(".fps-grad-bot").attr("stop-color", fpsColor);

    const fpsLastIdx = fpsData.length - 1;
    svg.select(".fps-dot")
      .attr("cx", xScale(fpsLastIdx + fpsOffset))
      .attr("cy", yScaleFps(fpsData[fpsLastIdx]))
      .attr("fill", fpsColor);

    // Memory/DOM y-scale (independent)
    if (memData.length >= 2) {
      const memMax = Math.max(d3.max(memData) ?? 1, 1) * 1.1; // 10% headroom
      const yScaleMem = d3.scaleLinear().domain([0, memMax]).range([GRAPH_H, 0]);
      const memOffset = MAX_HISTORY - memData.length;

      const memLine = d3.line<number>()
        .x((_, i) => xScale(i + memOffset))
        .y((d) => yScaleMem(d))
        .curve(d3.curveMonotoneX);

      const memArea = d3.area<number>()
        .x((_, i) => xScale(i + memOffset))
        .y0(GRAPH_H)
        .y1((d) => yScaleMem(d))
        .curve(d3.curveMonotoneX);

      svg.select(".mem-area").datum(memData).attr("d", memArea);
      svg.select(".mem-line").datum(memData).attr("d", memLine);

      const memLastIdx = memData.length - 1;
      svg.select(".mem-dot")
        .attr("cx", xScale(memLastIdx + memOffset))
        .attr("cy", yScaleMem(memData[memLastIdx]));
    }
  }

  if (!visible) {
    return (
      <div
        onClick={() => setVisible(true)}
        className="fixed bottom-3 right-3 w-2.5 h-2.5 rounded-full cursor-pointer z-[99999] opacity-60 transition-colors"
        style={{ backgroundColor: getColor(fps) }}
        title="Show FPS"
      />
    );
  }

  const color = getColor(fps);
  const metricLabel = metricMode === "ram" ? "RAM" : "DOM";

  return (
    <div
      onClick={() => setExpanded((e) => !e)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setVisible(false);
      }}
      className="fixed bottom-3 right-3 p-1.5 px-2.5 bg-black/75 backdrop-blur-sm rounded-lg cursor-pointer select-none z-[99999] leading-none transition-all duration-200 font-mono"
      style={{
        border: `1px solid ${color}33`,
        boxShadow: `0 0 12px ${color}22`,
      }}
      title="Click to toggle graph · Double-click to hide"
    >
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5" style={{ color }}>
          <span className="opacity-50 text-[10px]">FPS</span>
          <span className="text-xs font-semibold">{fps}</span>
        </div>
        <div className="flex items-center gap-1.5" style={{ color: MEM_COLOR }}>
          <span className="opacity-50 text-[10px]">{metricLabel}</span>
          <span className="text-xs font-semibold">{metricValue}</span>
        </div>
      </div>
      {expanded && (
        <svg
          ref={svgRef}
          width={GRAPH_W}
          height={GRAPH_H}
          className="block mt-1 opacity-90"
        />
      )}
    </div>
  );
}
