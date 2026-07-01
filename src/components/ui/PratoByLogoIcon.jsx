const SIZE_CLASSES = {
  tiny: {
    frame: 'h-7 w-7 rounded-lg',
    mark: 'h-5 w-5',
  },
  xs: {
    frame: 'h-8 w-8 rounded-xl',
    mark: 'h-6 w-6',
  },
  sm: {
    frame: 'h-10 w-10 rounded-2xl',
    mark: 'h-7 w-7',
  },
  md: {
    frame: 'h-11 w-11 rounded-2xl',
    mark: 'h-8 w-8',
  },
  lg: {
    frame: 'h-12 w-12 rounded-[1.35rem]',
    mark: 'h-8 w-8',
  },
  xl: {
    frame: 'h-14 w-14 rounded-3xl',
    mark: 'h-9 w-9',
  },
}

function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function PratoByLogoIcon({
  size = 'sm',
  alt = 'PratoBy',
  className = '',
  imageClassName = '',
  interactive = false,
}) {
  const classes = SIZE_CLASSES[size] || SIZE_CLASSES.sm

  return (
    <span
      className={cx(
        classes.frame,
        'grid shrink-0 place-items-center bg-white shadow-lg shadow-orange-600/15 ring-1 ring-orange-100/80',
        className
      )}
    >
      <img
        src="/icons/pratoby-mark-96.png"
        alt={alt}
        width="96"
        height="96"
        decoding="async"
        className={cx(
          classes.mark,
          'object-contain',
          interactive && 'transition duration-300 group-hover:scale-105',
          imageClassName
        )}
      />
    </span>
  )
}
