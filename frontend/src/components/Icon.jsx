import React from 'react';

/**
 * Accessible SVG icon wrapper.
 * By default marks icons as decorative (aria-hidden="true").
 * When role="img" or aria-label is supplied, exposes proper accessibility semantics.
 */
export default function Icon({
  children,
  className = '',
  role,
  'aria-label': ariaLabel,
  'aria-hidden': ariaHidden,
  ...props
}) {
  const isMeaningful = role === 'img' || Boolean(ariaLabel);
  const defaultHidden = isMeaningful ? undefined : true;

  if (React.isValidElement(children)) {
    return React.cloneElement(children, {
      role: isMeaningful ? 'img' : children.props.role,
      'aria-label': ariaLabel || children.props['aria-label'],
      'aria-hidden':
        ariaHidden !== undefined
          ? ariaHidden
          : isMeaningful
          ? undefined
          : (children.props['aria-hidden'] ?? defaultHidden),
      className: className
        ? `${children.props.className || ''} ${className}`.trim()
        : children.props.className,
      ...props,
    });
  }

  return (
    <span
      role={isMeaningful ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden !== undefined ? ariaHidden : defaultHidden}
      className={`inline-flex items-center justify-center shrink-0 ${className}`.trim()}
      {...props}
    >
      {children}
    </span>
  );
}
