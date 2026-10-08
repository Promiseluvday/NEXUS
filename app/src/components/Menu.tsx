// A dropdown menu: one button that opens a short list.
// Used to GROUP navigation and actions (＋ New, user menu) instead of
// filling the screen with buttons. Never used to hide status (see
// docs/ui-rules.md).
//
// Closes when you pick an item, tap outside it, or press Escape.
import { useEffect, useRef, useState, type ReactNode } from 'react';

type Props = {
  label: ReactNode;           // what the button shows
  ariaLabel?: string;
  align?: 'left' | 'right';   // which edge the list lines up with
  className?: string;
  children: (close: () => void) => ReactNode;
};

export function Menu({ label, ariaLabel, align = 'left', className = '', children }: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div className="menu" ref={box}>
      <button
        type="button"
        className={className}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label} <span aria-hidden className="menu-caret">▾</span>
      </button>
      {open && (
        <div className={`menu-list menu-${align}`} role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

// One line in a menu. "soon" items are shown greyed so people can see what
// is coming, but cannot be chosen.
export function MenuItem({ children, onSelect, soon = false }: { children: ReactNode; onSelect?: () => void; soon?: boolean }) {
  return (
    <button type="button" role="menuitem" className="menu-item" disabled={soon} onClick={onSelect}>
      {children}
      {soon && <span className="rail-tag">Soon</span>}
    </button>
  );
}
