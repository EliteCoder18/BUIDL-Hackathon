import { useId, type HTMLAttributes, type ReactNode } from "react";

export interface TechnicalPanelProps extends HTMLAttributes<HTMLElement> {
  eyebrow?: string;
  title?: string;
  explanation?: string;
  action?: ReactNode;
  as?: "section" | "article" | "aside";
}

export function TechnicalPanel({
  eyebrow,
  title,
  explanation,
  action,
  as: Element = "section",
  className = "",
  children,
  ...props
}: TechnicalPanelProps) {
  const hintId = useId();
  return (
    <Element className={`instrument-panel technical-panel ${className}`.trim()} {...props}>
      <span className="instrument-panel__arc instrument-panel__arc--top" aria-hidden="true" />
      <span className="instrument-panel__arc instrument-panel__arc--bottom" aria-hidden="true" />
      {(eyebrow || title || action || explanation) && (
        <header className="technical-panel__header">
          <div>
            {eyebrow && <p className="technical-panel__eyebrow">{eyebrow}</p>}
            {title && <h2 className="technical-panel__title">{title}</h2>}
          </div>
          {(action || explanation) && <div className="technical-panel__action">
            {action}
            {explanation && <span className="context-hint">
              <button type="button" aria-label={`Why ${title ?? eyebrow ?? "this section"} matters`} aria-describedby={hintId}>?</button>
              <span id={hintId} role="tooltip">{explanation}</span>
            </span>}
          </div>}
        </header>
      )}
      <div className="technical-panel__body">{children}</div>
    </Element>
  );
}
