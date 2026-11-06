import React from 'react';
import { ExternalLink } from 'lucide-react';
import { GOOGLE_FORM_1_URL, isGoogleFormConfigured, APPLICATION_UNAVAILABLE_MESSAGE } from '../config/siteConfig';

export default function ApplyButton({
  children = 'Apply Now',
  className = '',
  disabledClassName = '',
  showNoteWhenDisabled = false,
  noteClassName = 'text-[11px] text-slate-500 mt-1 block text-center',
  showExternalIcon = false,
  onClick,
  title,
  ...props
}) {
  const isConfigured = isGoogleFormConfigured();

  if (isConfigured) {
    return (
      <a
        href={GOOGLE_FORM_1_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onClick}
        title={title || 'Apply via Google Form'}
        {...props}
      >
        <span>{children}</span>
        {showExternalIcon && <ExternalLink className="w-3.5 h-3.5 shrink-0" />}
      </a>
    );
  }

  const baseDisabledClasses = disabledClassName || `${className} opacity-60 cursor-not-allowed pointer-events-auto`;

  return (
    <div className="inline-flex flex-col items-center">
      <button
        type="button"
        disabled
        title={title || APPLICATION_UNAVAILABLE_MESSAGE}
        className={baseDisabledClasses}
        {...props}
      >
        <span>{children}</span>
        {showExternalIcon && <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-50" />}
      </button>
      {showNoteWhenDisabled && (
        <span className={noteClassName}>
          {APPLICATION_UNAVAILABLE_MESSAGE}
        </span>
      )}
    </div>
  );
}
