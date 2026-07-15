'use client';

import Link from 'next/link';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';

import type { GameRuntimeSnapshot } from '@/game/engine/game-runtime';
import { GAME_RUNTIME_SNAPSHOT_EVENT } from '@/game/engine/runtime-snapshot-event';
import { navigationLabels, siteLabels } from '@/lib/labels';

type MetricIconName = 'capacity' | 'food' | 'larvae' | 'workers';

interface MetricDefinition {
  readonly icon: MetricIconName;
  readonly label: string;
  readonly tooltipDetail: string;
  readonly value: string;
}

interface HoveredMetricState {
  readonly anchorBottom: number;
  readonly anchorTop: number;
  readonly label: string;
  readonly tooltipDetail: string;
  readonly x: number;
}

interface TooltipPosition {
  readonly left: number;
  readonly top: number;
}

const hourlyFormatter = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 0,
});

function MetricIcon({ name }: { readonly name: MetricIconName }) {
  const commonProps = {
    className: 'main-navigation__metric-icon-svg',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.7,
    viewBox: '0 0 24 24',
  };

  switch (name) {
    case 'food':
      return (
        <svg {...commonProps}>
          <path d="M8 14c0-4.5 3.3-7.9 8.5-8-0.2 5.5-3.4 9-8.5 9-2 0-3.5-1.2-3.5-3.1 0-2.4 2.2-4.2 5.5-4.2" />
          <path d="M8 14c1.2 0.2 2.3 1 3 2.4" />
        </svg>
      );
    case 'capacity':
      return (
        <svg {...commonProps}>
          <path d="M5 8.5h14v10H5z" />
          <path d="M8 8.5V6h8v2.5" />
          <path d="M5 12h14" />
        </svg>
      );
    case 'larvae':
      return (
        <svg {...commonProps}>
          <path d="M7.5 14.5c0 1.9 1.6 3.5 4.5 3.5s4.5-1.6 4.5-3.5c0-1.4-0.9-2.3-2.4-3.2 1-0.7 1.6-1.5 1.6-2.8C15.7 6.6 14 5 12 5S8.3 6.6 8.3 8.5c0 1.3 0.6 2.1 1.6 2.8-1.5 0.9-2.4 1.8-2.4 3.2Z" />
        </svg>
      );
    case 'workers':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="7" r="2.3" />
          <circle cx="12" cy="12" r="2.8" />
          <circle cx="12" cy="18" r="3.4" />
        </svg>
      );
  }
}

function buildMetrics(snapshot: GameRuntimeSnapshot | null): readonly MetricDefinition[] {
  if (snapshot === null) {
    return [
      {
        icon: 'food',
        label: 'Nourriture',
        tooltipDetail: 'Génération : -- /h',
        value: '--',
      },
      {
        icon: 'capacity',
        label: 'Capacité',
        tooltipDetail: 'Capacité maximale de stockage',
        value: '--',
      },
      {
        icon: 'larvae',
        label: 'Larves',
        tooltipDetail: 'Production : -- /h',
        value: '--',
      },
      {
        icon: 'workers',
        label: 'Ouvrières',
        tooltipDetail: 'Incubation : -- /h',
        value: '--',
      },
    ] as const;
  }

  const { colony } = snapshot;
  const foodPerHour = colony.roomCounts.fungusFarmCount * 0.8 * 3600;
  const larvaePerHour = colony.roomCounts.queenChamberCount * (3600 / 10);
  const workersPerHour = colony.roomCounts.broodChamberCount * (3600 / 12);

  return [
    {
      icon: 'food',
      label: 'Nourriture',
      tooltipDetail: `Génération : +${hourlyFormatter.format(foodPerHour)} /h`,
      value: colony.food.toFixed(1),
    },
    {
      icon: 'capacity',
      label: 'Capacité',
      tooltipDetail: 'Capacité maximale de stockage',
      value: `${colony.foodCapacity}`,
    },
    {
      icon: 'larvae',
      label: 'Larves',
      tooltipDetail: `Production : +${hourlyFormatter.format(larvaePerHour)} /h`,
      value: `${colony.larvae}`,
    },
    {
      icon: 'workers',
      label: 'Ouvrières',
      tooltipDetail: `Incubation : +${hourlyFormatter.format(workersPerHour)} /h`,
      value: `${colony.workers}`,
    },
  ] as const;
}

export function MainNavigation() {
  const [snapshot, setSnapshot] = useState<GameRuntimeSnapshot | null>(null);
  const [hoveredMetric, setHoveredMetric] = useState<HoveredMetricState | null>(
    null,
  );
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(
    null,
  );
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleSnapshot = (event: Event) => {
      setSnapshot((event as CustomEvent<GameRuntimeSnapshot>).detail);
    };

    window.addEventListener(GAME_RUNTIME_SNAPSHOT_EVENT, handleSnapshot);

    return () => {
      window.removeEventListener(GAME_RUNTIME_SNAPSHOT_EVENT, handleSnapshot);
    };
  }, []);

  const metrics = buildMetrics(snapshot);
  const canUseDom = typeof document !== 'undefined';

  useLayoutEffect(() => {
    if (hoveredMetric === null || tooltipRef.current === null) {
      setTooltipPosition(null);
      return;
    }

    const tooltipBounds = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12;
    const offset = 10;
    const preferredLeft = hoveredMetric.x - tooltipBounds.width / 2;
    const clampedLeft = Math.min(
      Math.max(margin, preferredLeft),
      viewportWidth - tooltipBounds.width - margin,
    );
    const hasRoomBelow =
      hoveredMetric.anchorBottom + offset + tooltipBounds.height + margin <=
      viewportHeight;
    const hasRoomAbove =
      hoveredMetric.anchorTop - offset - tooltipBounds.height - margin >= 0;
    const top = hasRoomBelow || !hasRoomAbove
      ? hoveredMetric.anchorBottom + offset
      : hoveredMetric.anchorTop - tooltipBounds.height - offset;

    setTooltipPosition({
      left: clampedLeft,
      top: Math.max(
        margin,
        Math.min(top, viewportHeight - tooltipBounds.height - margin),
      ),
    });
  }, [hoveredMetric]);

  const handleMetricMouseEnter = (
    event: ReactMouseEvent<HTMLDivElement>,
    metric: MetricDefinition,
  ) => {
    const bounds = event.currentTarget.getBoundingClientRect();

    setHoveredMetric({
      anchorBottom: bounds.bottom,
      anchorTop: bounds.top,
      label: metric.label,
      tooltipDetail: metric.tooltipDetail,
      x: bounds.left + bounds.width / 2,
    });
  };

  const handleMetricMouseMove = (
    event: ReactMouseEvent<HTMLDivElement>,
    metric: MetricDefinition,
  ) => {
    const bounds = event.currentTarget.getBoundingClientRect();

    setHoveredMetric({
      anchorBottom: bounds.bottom,
      anchorTop: bounds.top,
      label: metric.label,
      tooltipDetail: metric.tooltipDetail,
      x: bounds.left + bounds.width / 2,
    });
  };

  const handleMetricMouseLeave = () => {
    setHoveredMetric(null);
    setTooltipPosition(null);
  };

  return (
    <nav
      className="main-navigation"
      aria-label={navigationLabels.mainNavigation}
    >
      <Link className="main-navigation__brand" href="/">
        {siteLabels.applicationName}
      </Link>
      <div className="main-navigation__metrics" aria-label="Métriques colonie">
        {metrics.map((metric) => (
          <div
            className="main-navigation__metric"
            key={metric.label}
            role="presentation"
            onMouseEnter={(event) => {
              handleMetricMouseEnter(event, metric);
            }}
            onMouseMove={(event) => {
              handleMetricMouseMove(event, metric);
            }}
            onMouseLeave={handleMetricMouseLeave}
          >
            <div className="main-navigation__metric-main">
              <span
                className="main-navigation__metric-icon"
                aria-hidden="true"
              >
                <MetricIcon name={metric.icon} />
              </span>
              <span className="main-navigation__metric-value">{metric.value}</span>
            </div>
          </div>
        ))}
      </div>
      {canUseDom && hoveredMetric !== null
        ? createPortal(
            <div
              ref={tooltipRef}
              className="main-navigation__metric-tooltip"
              role="tooltip"
              style={{
                left:
                  tooltipPosition === null
                    ? '-9999px'
                    : `${tooltipPosition.left}px`,
                top:
                  tooltipPosition === null
                    ? '-9999px'
                    : `${tooltipPosition.top}px`,
              }}
            >
              <span className="main-navigation__metric-tooltip-title">
                {hoveredMetric.label}
              </span>
              <span className="main-navigation__metric-tooltip-value">
                {hoveredMetric.tooltipDetail}
              </span>
            </div>,
            document.body,
          )
        : null}
    </nav>
  );
}
