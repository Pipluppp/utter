import { ChevronDown } from "lucide-react";
import type { Key } from "react-aria-components";
import {
  Select as AriaSelect,
  Button,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  SelectValue,
} from "react-aria-components";

export { selectStyles } from "./Select.styles";

export interface SelectItem {
  id: string;
  label: string;
}

export interface SelectProps {
  label?: string;
  items: SelectItem[];
  selectedKey: string | null;
  onSelectionChange: (key: string) => void;
  isDisabled?: boolean;
  isRequired?: boolean;
  name?: string;
  placeholder?: string;
  className?: string;
}

export function Select({
  label,
  items,
  selectedKey,
  onSelectionChange,
  isDisabled,
  isRequired,
  name,
  placeholder = "Select an option",
  className,
}: SelectProps) {
  const empty = items.length === 0;
  const styles = selectStyles();

  return (
    <AriaSelect
      selectedKey={selectedKey}
      onSelectionChange={(key: Key | null) => {
        if (key !== null) onSelectionChange(key as string);
      }}
      isDisabled={isDisabled || empty}
      isRequired={isRequired}
      name={name}
      placeholder={empty ? "No options available" : placeholder}
      className={styles.root({ className })}
    >
      {label ? <Label className="mb-2 block label-style">{label}</Label> : null}
      <Button className={styles.trigger()}>
        <SelectValue className={styles.value()} />
        <ChevronDown size={16} className={styles.icon()} aria-hidden="true" />
      </Button>
      <Popover shouldFlip className={styles.popover()}>
        <ListBox items={items} className="max-h-60 overflow-y-auto p-1">
          {(item) => (
            <ListBoxItem id={item.id} textValue={item.label} className={styles.item()}>
              {item.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}
