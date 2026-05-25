import React, { useId } from 'react'
import { motion } from 'framer-motion'

export default function AnimatedSegmentedControl({
  options = [],
  value,
  onChange,
  size = 'md',
  variant = 'primary', // 'primary' | 'neutral'
  fullWidth = false,
  className = '',
  ariaLabel = 'Segmented Control',
}) {
  const uniqueId = useId()
  const layoutId = `segmented-indicator-${uniqueId}`

  const sizeClasses = {
    sm: 'h-8 text-[11px] px-1',
    md: 'h-10 text-xs px-1.5',
    lg: 'h-12 text-sm px-2',
  }

  const optionPaddingClasses = {
    sm: 'px-3',
    md: 'px-4',
    lg: 'px-5',
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`relative flex items-center rounded-full bg-gray-100 p-1 border border-gray-200/50 dark:border-zinc-800 dark:bg-zinc-900 ${sizeClasses[size]} ${fullWidth ? 'w-full' : 'inline-flex'} ${className}`}
    >
      {options.map((option) => {
        const isActive = value === option.value
        const isDisabled = option.disabled

        // Variantes de cores e estilos
        let activeTextColor = 'text-zinc-900 dark:text-white'
        let indicatorClass = 'bg-white shadow-sm dark:bg-zinc-700'

        if (variant === 'primary') {
          activeTextColor = 'text-white'
          indicatorClass = 'bg-[#f97316] shadow-sm dark:bg-orange-500'
        }

        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={isActive}
            disabled={isDisabled}
            onClick={() => !isDisabled && onChange(option.value)}
            className={`relative flex h-full items-center justify-center rounded-full font-bold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${fullWidth ? 'flex-1' : ''} ${optionPaddingClasses[size]} ${
              isDisabled 
                ? 'cursor-not-allowed opacity-50' 
                : 'cursor-pointer'
            } ${
              isActive
                ? activeTextColor
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className={`absolute inset-0 rounded-full ${indicatorClass}`}
                transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5 whitespace-nowrap">
              {option.icon && <option.icon size={size === 'sm' ? 12 : size === 'md' ? 14 : 16} />}
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
