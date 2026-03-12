import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { cn } from '../../lib/cn'

export function SVGBlobs({
  isGenerating,
  className,
  density = 'medium',
  animateOnEnter = true,
  dotScale = 'normal',
}: {
  isGenerating?: boolean
  className?: string
  density?: 'dense' | 'medium' | 'sparse'
  animateOnEnter?: boolean
  dotScale?: 'normal' | 'small' | 'tiny'
}) {
  const containerRef = useRef<SVGSVGElement>(null)
  const [hasAnimated, setHasAnimated] = useState(false)
  const wasGeneratingRef = useRef(false)
  const ids = useId().replace(/:/g, '')
  const filterId = `innerGlow-${ids}`
  const gradientId = `blobFill-${ids}`
  const densityStep = useMemo(() => {
    if (density === 'dense') return 1
    if (density === 'sparse') return 4
    return 2
  }, [density])
  const baseRadius = dotScale === 'tiny' ? 7 : dotScale === 'small' ? 18 : 34

  useEffect(() => {
    const svg = containerRef.current
    if (!svg) return
    const circles = svg.querySelectorAll('circle')
    circles.forEach((circle, index) => {
      const keep = index % densityStep === 0
      circle.style.display = keep ? '' : 'none'
    })
  }, [densityStep])

  useEffect(() => {
    const svg = containerRef.current
    if (!svg || animateOnEnter) return

    const circles = svg.querySelectorAll('circle')
    circles.forEach((circle) => {
      circle.setAttribute('r', String(baseRadius))
    })
  }, [animateOnEnter, baseRadius])

  useEffect(() => {
    const svg = containerRef.current
    if (!svg || animateOnEnter) return

    const circles = svg.querySelectorAll('circle')
    const expandedRadius =
      dotScale === 'tiny' ? 10 : dotScale === 'small' ? 24 : baseRadius

    if (isGenerating && !wasGeneratingRef.current) {
      circles.forEach((circle) => {
        const animate = circle.querySelector('animate')
        if (!animate) return

        const currentRadius = Number.parseFloat(
          circle.getAttribute('r') ?? String(baseRadius),
        )
        const startRadius = Number.isFinite(currentRadius)
          ? currentRadius
          : baseRadius

        animate.setAttribute(
          'values',
          `${startRadius};${expandedRadius};${baseRadius}`,
        )
        animate.setAttribute('dur', '1.8s')
        animate.setAttribute('keyTimes', '0;0.55;1')
        animate.setAttribute('repeatCount', '1')

        const animation = animate as SVGAnimationElement
        if (typeof animation.beginElement === 'function') {
          animation.beginElement()
        }
      })
    }

    if (!isGenerating) {
      circles.forEach((circle) => {
        circle.setAttribute('r', String(baseRadius))
      })
    }

    wasGeneratingRef.current = Boolean(isGenerating)
  }, [animateOnEnter, baseRadius, dotScale, isGenerating])

  useEffect(() => {
    if (!containerRef.current || hasAnimated || !animateOnEnter) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setHasAnimated(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 },
    )

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [animateOnEnter, hasAnimated])

  useEffect(() => {
    if (hasAnimated && containerRef.current && animateOnEnter) {
      const animates = containerRef.current.querySelectorAll('animate')
      animates.forEach((a) => {
        const animation = a as SVGAnimationElement
        if (typeof animation.beginElement === 'function') {
          animation.beginElement()
        }
      })
    }
  }, [animateOnEnter, hasAnimated])

  return (
    <svg
      ref={containerRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1646 642"
      fill="none"
      className={cn('h-auto w-full', className)}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.02" />
          <stop offset="68%" stopColor="currentColor" stopOpacity="0.1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.18" />
        </radialGradient>
        <filter
          id={filterId}
          filterUnits="userSpaceOnUse"
          x="-2000"
          y="-2000"
          width="4290"
          height="4340"
        >
          <feGaussianBlur
            in="SourceAlpha"
            stdDeviation="8.5"
            result="blur"
          ></feGaussianBlur>
          <feComposite
            in="SourceAlpha"
            in2="blur"
            operator="arithmetic"
            k2="1"
            k3="-1"
            result="innerRim"
          ></feComposite>
          <feFlood
            floodColor="currentColor"
            floodOpacity="0.09"
            result="color"
            className="text-white"
          ></feFlood>
          <feComposite
            in="color"
            in2="innerRim"
            operator="in"
            result="glow"
          ></feComposite>
          <feComposite
            in="glow"
            in2="SourceGraphic"
            operator="over"
          ></feComposite>
        </filter>
      </defs>
      <g
        filter={`url(#${filterId})`}
        className={cn(
          'text-foreground/72 dark:text-foreground/78',
          isGenerating && 'animate-pulse',
        )}
        style={isGenerating ? { animationDuration: '4s' } : undefined}
        fill={`url(#${gradientId})`}
      >
        <circle cx="189.951" cy="83.7442" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="242.963" cy="83.7442" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="506.729" cy="83.7442" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="612.752" cy="137.119" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="928.238" cy="137.119" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="453.717" cy="137.119" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="559.74" cy="188.65" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="981.25" cy="188.65" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="928.238" cy="188.65" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="85.2207" cy="137.119" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="453.717" cy="188.65" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="506.729" cy="188.65" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="189.951" cy="137.119" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1087.27" cy="242.029" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1034.37" cy="242.029" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="296.881" cy="242.029" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="348.777" cy="188.65" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1087.27" cy="293.561" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1140.29" cy="293.561" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1034.26" cy="293.561" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="243.867" cy="242.029" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="453.717" cy="293.561" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="296.881" cy="293.561" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="349.893" cy="293.561" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="243.867" cy="293.561" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="85.2207" cy="188.65" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="138.232" cy="188.65" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="85.2207" cy="242.029" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="32.209" cy="242.029" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="32.209" cy="293.561" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="138.232" cy="293.561" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1614.8" cy="32.209" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1666.53" cy="83.7442" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1614.8" cy="83.7442" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1561.79" cy="83.7442" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1666.53" cy="137.119" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1402.76" cy="137.119" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1561.79" cy="137.119" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1508.78" cy="137.119" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1614.8" cy="188.65" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1455.77" cy="188.65" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1402.76" cy="188.65" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1561.79" cy="188.65" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1455.77" cy="242.029" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1561.79" cy="242.029" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1455.77" cy="293.561" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1561.79" cy="293.561" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1508.78" cy="293.561" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1351.04" cy="293.561" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1245.25" cy="347.857" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1404.28" cy="347.857" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1298.26" cy="399.389" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1404.28" cy="399.389" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1351.27" cy="399.389" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1298.26" cy="452.764" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1668.05" cy="347.857" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1298.26" cy="504.303" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1404.28" cy="504.303" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1351.27" cy="504.303" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1245.25" cy="557.678" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1087.5" cy="557.678" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1140.52" cy="557.678" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1034.49" cy="557.678" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1193.53" cy="557.678" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1298.26" cy="609.209" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1087.5" cy="609.209" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1456" cy="609.209" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1404.28" cy="609.209" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1351.27" cy="609.209" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1193.53" cy="609.209" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1668.05" cy="557.678" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1615.04" cy="557.678" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="822.168" cy="201.537" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="664.426" cy="201.537" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="875.18" cy="253.072" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="769.156" cy="253.072" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="1562.02" cy="609.209" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="822.168" cy="305.525" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="769.156" cy="305.525" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="664.426" cy="305.525" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="85.4511" cy="347.857" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="138.463" cy="347.857" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="85.4511" cy="399.389" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="32.4394" cy="399.389" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="138.463" cy="399.389" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="32.4394" cy="452.764" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="32.4394" cy="504.303" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="85.4511" cy="609.209" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="191.414" cy="556.756" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="243.867" cy="398.471" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="243.867" cy="503.381" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="243.867" cy="609.209" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="297.242" cy="398.471" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="297.242" cy="503.381" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="297.242" cy="609.209" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="349.697" cy="398.471" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="349.697" cy="503.381" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="349.697" cy="609.209" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="403.072" cy="450.928" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="403.072" cy="503.381" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="403.072" cy="556.756" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="403.072" cy="609.209" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="455.527" cy="398.471" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="455.527" cy="609.209" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="507.982" cy="398.471" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="507.982" cy="609.209" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="561.357" cy="319.326" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="561.357" cy="398.471" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="561.357" cy="450.928" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="561.357" cy="503.381" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="561.357" cy="556.756" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="561.357" cy="609.209" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="613.813" cy="609.209" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="667.186" cy="609.209" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="719.641" cy="398.471" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="719.641" cy="609.209" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="772.096" cy="450.928" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="772.096" cy="503.381" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="772.096" cy="556.756" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="772.096" cy="609.209" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="825.471" cy="398.471" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="825.471" cy="609.209" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="877.926" cy="398.471" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="877.926" cy="609.209" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
        <circle cx="931.301" cy="450.928" r="0">
          <animate
            values="0;34"
            attributeName="r"
            keyTimes="0;1"
            dur="4s"
            repeatCount="1"
            calcMode="spline"
            keySplines="0.2 0 0.2 1;"
            fill="freeze"
            begin="indefinite"
          ></animate>
        </circle>
      </g>
    </svg>
  )
}
