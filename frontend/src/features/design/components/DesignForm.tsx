import { Form, Input, Label, Text, TextArea, TextField } from "react-aria-components";
import { Button } from "../../../components/atoms/Button";
import {
  AutocompleteSelect,
  type AutocompleteSelectItem,
} from "../../../components/molecules/AutocompleteSelect";
import { inputStyles } from "../../../lib/styles/input";

export interface DesignFormProps {
  name: string;
  onNameChange: (value: string) => void;
  instruct: string;
  onInstructChange: (value: string) => void;
  text: string;
  onTextChange: (value: string) => void;
  languageItems: AutocompleteSelectItem[];
  language: string;
  onLanguageChange: (lang: string) => void;
  examples: Array<{ title: string; name: string; instruct: string }>;
  isSubmittingPreview: boolean;
  savedVoiceId: string | null;
  isSavingVoice: boolean;
  onSubmit: () => void;
  onUseVoice: () => void;
}

export function DesignForm({
  name,
  onNameChange,
  instruct,
  onInstructChange,
  text,
  onTextChange,
  languageItems,
  language,
  onLanguageChange,
  examples,
  isSubmittingPreview,
  savedVoiceId,
  isSavingVoice,
  onSubmit,
  onUseVoice,
}: DesignFormProps) {
  return (
    <Form
      className="space-y-6"
      validationBehavior="aria"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <TextField value={name} onChange={onNameChange}>
        <Label className="mb-2 block label-style">Voice Name</Label>
        <Input name="name" autoComplete="off" className={inputStyles()} />
      </TextField>

      <TextField value={instruct} onChange={onInstructChange}>
        <Label className="mb-2 block label-style">Voice Description</Label>
        <TextArea
          name="instruct"
          placeholder="Describe the voice (tone, pacing, timbre, vibe)..."
          className={inputStyles({ multiline: true })}
        />
        <Text
          slot="description"
          className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-faint"
        >
          <span>{instruct.length}/500</span>
          <div className="flex flex-wrap gap-2">
            {examples.map((ex) => (
              <Button
                key={ex.title}
                variant="secondary"
                size="xs"
                onPress={() => {
                  onNameChange(ex.name);
                  onInstructChange(ex.instruct);
                }}
              >
                {ex.title}
              </Button>
            ))}
          </div>
        </Text>
      </TextField>

      <TextField value={text} onChange={onTextChange}>
        <Label className="mb-2 block label-style">Preview Text</Label>
        <TextArea
          name="text"
          placeholder="A short line to preview the voice..."
          className={inputStyles({ multiline: true })}
        />
        <Text slot="description" className="mt-2 text-xs text-faint">
          {text.length}/500
        </Text>
      </TextField>

      <AutocompleteSelect
        label="Language"
        items={languageItems}
        selectedKey={language}
        onSelectionChange={onLanguageChange}
        searchLabel="Search languages"
        searchPlaceholder="Search..."
      >
        {(item) => item.label}
      </AutocompleteSelect>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button type="submit" block isDisabled={isSubmittingPreview}>
          {isSubmittingPreview ? "Starting preview..." : "Generate Preview"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          block
          onPress={onUseVoice}
          isDisabled={!savedVoiceId || isSavingVoice}
        >
          Use Voice
        </Button>
      </div>
    </Form>
  );
}
