import { useEffect, useRef } from 'react';
import {
  Chart,
  ChartConfiguration,
  registerables,
} from 'chart.js';

Chart.register(...registerables);

interface ChartCanvasProps {
  config: ChartConfiguration;
  height?: number;
  isDark: boolean;
}

export function ChartCanvas({ config, height = 260, isDark }: ChartCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const textColor = isDark ? '#CBD5E1' : '#334155';
    const gridColor = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(15, 33, 64, 0.08)';

    const themedConfig: ChartConfiguration = {
      ...config,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...config.options,
        plugins: {
          ...config.options?.plugins,
          legend: {
            ...config.options?.plugins?.legend,
            labels: {
              color: textColor,
              font: { family: "'Public Sans', sans-serif", size: 12 },
              boxWidth: 12,
              padding: 14,
              ...config.options?.plugins?.legend?.labels,
            },
          },
          tooltip: {
            backgroundColor: isDark ? '#0F172A' : '#0F2140',
            titleColor: '#F8FAFC',
            bodyColor: '#E2E8F0',
            borderColor: isDark ? '#334155' : '#1E293B',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6,
            ...config.options?.plugins?.tooltip,
          },
        },
        scales: config.type === 'doughnut' || config.type === 'pie' || config.type === 'radar'
          ? config.type === 'radar'
            ? {
                r: {
                  angleLines: { color: gridColor },
                  grid: { color: gridColor },
                  pointLabels: { color: textColor, font: { family: "'Public Sans', sans-serif", size: 11 } },
                  ticks: { color: textColor, backdropColor: 'transparent', stepSize: 1 },
                  min: 0,
                  max: 5,
                },
              }
            : undefined
          : {
              x: {
                grid: { display: false },
                ticks: { color: textColor, font: { family: "'Public Sans', sans-serif", size: 11 } },
                ...(config.options?.scales?.x || {}),
              },
              y: {
                grid: { color: gridColor },
                ticks: { color: textColor, font: { family: "'JetBrains Mono', monospace", size: 11 } },
                beginAtZero: true,
                ...(config.options?.scales?.y || {}),
              },
            },
      },
    };

    chartRef.current = new Chart(canvas, themedConfig);

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [config, isDark]);

  return (
    <div style={{ height: `${height}px` }} className="relative w-full">
      <canvas ref={canvasRef} />
    </div>
  );
}
