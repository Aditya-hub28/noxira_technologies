import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { APPLICATION_UNAVAILABLE_MESSAGE, APPLICATION_NEUTRAL_MESSAGE } from '../config/siteConfig';

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
  const { googleForm1Url, isFormConfigured, loading, error } = useSiteSettings();

  const noteMessage = (loading || error)
    ? APPLICATION_NEUTRAL_MESSAGE
    : APPLICATION_UNAVAILABLE_MESSAGE;

  if (isFormConfigured) {
    return (
      <a
        href={googleForm1Url}
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
        title={title || noteMessage}
        className={baseDisabledClasses}
        {...props}
      >
        <span>{children}</span>
        {showExternalIcon && <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-50" />}
      </button>
      {showNoteWhenDisabled && (
        <span className={noteClassName}>
          {noteMessage}
        </span>
      )}
    </div>
  );
}
