import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { usePreferences } from '../../hooks/usePreferences';

const ChartComponent =
  (ReactApexChart as unknown as { default?: typeof ReactApexChart }).default ?? ReactApexChart;

class ChartErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center rounded border border-border bg-background/50 text-xs text-muted-foreground">
          Não foi possível renderizar este gráfico.
        </div>
      );
    }
    return this.props.children;
  }
}

type ChartType =
  | 'line'
  | 'area'
  | 'bar'
  | 'pie'
  | 'donut'
  | 'radialBar'
  | 'scatter'
  | 'bubble'
  | 'heatmap'
  | 'candlestick'
  | 'boxPlot'
  | 'radar'
  | 'polarArea'
  | 'rangeBar'
  | 'rangeArea'
  | 'treemap';

interface ApexChartWrapperProps {
  type: ChartType;
  series: NonNullable<ApexOptions['series']>;
  options?: ApexOptions;
  height?: number | string;
}

export function ApexChartWrapper({
  type,
  series,
  options,
  height = '100%',
}: ApexChartWrapperProps) {
  const { preferences, resolvedTheme } = usePreferences();
  const isDark = resolvedTheme === 'dark';
  const reduceMotion =
    preferences.reduceMotion === 'reduce' ||
    (preferences.reduceMotion === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const animate = !reduceMotion;

  const mergedOptions = useMemo<ApexOptions>(() => {
    const borderColor = isDark ? '#252B33' : '#E2E8F0';
    const labelColor = isDark ? '#94A3B8' : '#64748B';
    const isLineLike = type === 'line' || type === 'area';

    return {
      ...options,
      theme: {
        mode: resolvedTheme,
        ...options?.theme,
      },
      chart: {
        background: 'transparent',
        fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: {
          enabled: animate,
          speed: 650,
          animateGradually: {
            enabled: animate,
            delay: 90,
          },
          dynamicAnimation: {
            enabled: animate,
            speed: 500,
          },
        },
        ...options?.chart,
      },
      states: {
        hover: {
          filter: {
            type: 'lighten',
            value: isDark ? 0.12 : 0.08,
          },
        },
        ...options?.states,
      },
      markers: {
        hover: { sizeOffset: 3 },
        ...options?.markers,
      },
      grid: {
        borderColor,
        strokeDashArray: 3,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        ...options?.grid,
      },
      dataLabels: {
        enabled: false,
        ...options?.dataLabels,
      },
      tooltip: {
        theme: resolvedTheme,
        style: {
          fontSize: '12px',
          fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
        },
        ...options?.tooltip,
      },
      xaxis: {
        axisBorder: { color: borderColor },
        axisTicks: { color: borderColor },
        crosshairs: isLineLike
          ? {
              show: true,
              stroke: {
                color: isDark ? '#475569' : '#94A3B8',
                width: 1,
                dashArray: 3,
              },
            }
          : undefined,
        labels: {
          style: {
            colors: labelColor,
            fontSize: '11px',
            fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
          },
          ...options?.xaxis?.labels,
        },
        ...options?.xaxis,
      },
      yaxis: Array.isArray(options?.yaxis)
        ? options.yaxis
        : {
            labels: {
              style: {
                colors: labelColor,
                fontSize: '11px',
                fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
              },
              ...options?.yaxis?.labels,
            },
            ...options?.yaxis,
          },
      legend: {
        labels: {
          colors: labelColor,
        },
        fontSize: '11px',
        onItemClick: {
          toggleDataSeries: true,
        },
        onItemHover: {
          highlightDataSeries: true,
        },
        ...options?.legend,
      },
    };
  }, [animate, isDark, options, resolvedTheme, type]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const isFirstRenderRef = useRef(true);

  const seriesSignature = useMemo(() => {
    if (!Array.isArray(series)) return '';
    return series
      .map((s) => {
        if (typeof s === 'number') return String(s);
        const dataArr = Array.isArray(s.data) ? s.data : [];
        const first = dataArr[0];
        const last = dataArr[dataArr.length - 1];
        return `${s.name ?? ''}:${dataArr.length}:${JSON.stringify(first)}:${JSON.stringify(last)}`;
      })
      .join('|');
  }, [series]);

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    const el = wrapperRef.current;
    if (!animate || !el || typeof el.animate !== 'function') return;

    const anim = el.animate([{ opacity: 0.35 }, { opacity: 1 }], {
      duration: 240,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    });
    return () => anim.cancel();
  }, [animate, seriesSignature, type]);

  return (
    <div ref={wrapperRef} className="h-full w-full">
      <ChartErrorBoundary>
        <ChartComponent
          type={type}
          series={series}
          options={mergedOptions}
          height={height}
          width="100%"
        />
      </ChartErrorBoundary>
    </div>
  );
}
