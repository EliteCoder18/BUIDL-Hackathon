import type { HTMLAttributes, ReactNode } from "react";

export interface TechnicalPanelProps extends HTMLAttributes<HTMLElement> {
  eyebrow?: string;
  title?: string;
  action?: ReactNode;
  as?: "section" | "article" | "aside";
}

export function TechnicalPanel({
  eyebrow,
  title,
  action,
  as: Element = "section",
  className = "",
  children,
  ...props
}: TechnicalPanelProps) {
  return (
    <Element className={`technical-panel ${className}`.trim()} {...props}>
      {(eyebrow || title || action) && (
        <header className="technical-panel__header">
          <div>
            {eyebrow && <p className="technical-panel__eyebrow">{eyebrow}</p>}
            {title && <h2 className="technical-panel__title">{title}</h2>}
          </div>
          {action && <div className="technical-panel__action">{action}</div>}
        </header>
      )}
      <div className="technical-panel__body">{children}</div>
    </Element>
  );
}

