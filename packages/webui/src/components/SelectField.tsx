import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";

export interface SelectOption { value: string; label: string; description?: string }

export function SelectField({ name, value, defaultValue = "", options, disabled = false, ariaLabel, ariaDescribedBy, ariaInvalid = false, onChange }: { name?: string; value?: string; defaultValue?: string; options: SelectOption[]; disabled?: boolean; ariaLabel: string; ariaDescribedBy?: string; ariaInvalid?: boolean; onChange?: (value: string) => void }) {
  const [internal, setInternal] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const selectedValue = value ?? internal;
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === selectedValue));
  const selected = options[selectedIndex] ?? { value: "", label: "" };
  useEffect(() => { if (open) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: "nearest" }); }, [active, id, open]);
  const choose = (index: number) => {
    const option = options[index];
    if (option === undefined) return;
    if (value === undefined) setInternal(option.value);
    onChange?.(option.value);
    setOpen(false);
    trigger.current?.focus();
  };
  const move = (offset: number) => {
    if (options.length === 0) return;
    setOpen(true);
    setActive((current) => ((open ? current : selectedIndex) + offset + options.length) % options.length);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case "ArrowDown": event.preventDefault(); move(1); break;
      case "ArrowUp": event.preventDefault(); move(-1); break;
      case "Enter": case " ": event.preventDefault(); if (open) choose(active); else { setActive(selectedIndex); setOpen(true); } break;
      case "Escape": event.preventDefault(); setOpen(false); break;
      case "Home": event.preventDefault(); setOpen(true); setActive(0); break;
      case "End": event.preventDefault(); setOpen(true); setActive(Math.max(0, options.length - 1)); break;
    }
  };
  return <div className="select-field" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    {name !== undefined && <input type="hidden" name={name} value={selectedValue} disabled={disabled} />}
    <button ref={trigger} type="button" className="select-trigger" role="combobox" aria-label={ariaLabel} aria-controls={id} aria-expanded={open} aria-haspopup="listbox" aria-autocomplete="none" aria-activedescendant={open ? `${id}-option-${active}` : undefined} aria-describedby={ariaDescribedBy} aria-invalid={ariaInvalid || undefined} disabled={disabled} onKeyDown={onKeyDown} onClick={() => { setActive(selectedIndex); setOpen((current) => !current); }}>
      <span>{selected.label}</span><span className="select-chevron" aria-hidden="true" />
    </button>
    {open && <div className="select-popover"><ul id={id} role="listbox" aria-label={ariaLabel}>
      {options.map((option, index) => <li id={`${id}-option-${index}`} key={option.value} role="option" aria-selected={option.value === selectedValue} className={index === active ? "active" : ""} onMouseEnter={() => setActive(index)} onMouseDown={(event) => { event.preventDefault(); choose(index); }}><span>{option.label}</span>{option.description !== undefined && <small>{option.description}</small>}<span className="select-check" aria-hidden="true">{option.value === selectedValue ? "✓" : ""}</span></li>)}
    </ul></div>}
  </div>;
}
