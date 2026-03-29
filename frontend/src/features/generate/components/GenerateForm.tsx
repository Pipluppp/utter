import { Form, Label, Text, TextArea, TextField } from "react-aria-components";
import { Button } from "../../../components/atoms/Button";
import {
    AutocompleteSelect,
    type AutocompleteSelectItem,
} from "../../../components/molecules/AutocompleteSelect";
import { cn } from "../../../lib/cn";
import { TTS_PROVIDER } from "../../../lib/provider-config";
import { inputStyles } from "../../../lib/styles/input";
import type { VoiceOptionItem } from "../../voices/queries";

export interface GenerateFormProps {
  voiceItems: VoiceOptionItem[];
  voiceId: string;
  onVoiceIdChange: (id: string) => void;
  languageItems: AutocompleteSelectItem[];
  language: string;
  onLanguageChange: (lang: string) => void;
  text: string;
  onTextChange: (text: string) => void;
  maxTextChars: number;
  loadingVoices: boolean;
  canSubmit: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
  voicePlaceholder: string;
}

export function GenerateForm({
  voiceItems,
  voiceId,
  onVoiceIdChange,
  languageItems,
  language,
  onLanguageChange,
  text,
  onTextChange,
  maxTextChars,
  loadingVoices,
  canSubmit,
  isSubmitting,
  onSubmit,
  voicePlaceholder,
}: GenerateFormProps) {
  const charCount = text.length;

  return (
    <Form
      className="space-y-6"
      validationBehavior="aria"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <AutocompleteSelect
        label="Voice"
        items={voiceItems}
        selectedKey={voiceId || null}
        onSelectionChange={(key) => onVoiceIdChange(key)}
        isDisabled={loadingVoices || voiceItems.length === 0}
        placeholder={voicePlaceholder}
        filterKey="name"
        searchLabel="Search voices"
        searchPlaceholder="Search..."
      >
        {(v) => {
          const voiceProvider = v.tts_provider ?? "qwen";
          const incompatible = voiceProvider !== TTS_PROVIDER;
          return (
            <div className={cn("flex flex-col gap-0.5", incompatible && "opacity-50")}>
              <div className="flex items-center gap-2">
                <span className="truncate">{v.name}</span>
                {v.language ? (
                  <span className="shrink-0 border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {v.language}
                  </span>
                ) : null}
              </div>
              {incompatible ? (
                <span className="text-xs text-faint">Not available in this runtime</span>
              ) : v.description ? (
                <span className="truncate text-xs text-faint">{v.description}</span>
              ) : null}
            </div>
          );
        }}
      </AutocompleteSelect>

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

      <TextField value={text} onChange={onTextChange}>
        <Label className="mb-2 block label-style">Text</Label>
        <TextArea
          name="text"
          placeholder="Type what you want the voice to say..."
          className={inputStyles({ multiline: true, className: "min-h-64" })}
        />
        <Text
          slot="description"
          className="mt-2 flex items-center justify-between text-xs text-faint"
        >
          <span className={cn(charCount > maxTextChars && "text-status-error")}>
            {charCount}/{maxTextChars}
          </span>
          <span>Max {maxTextChars.toLocaleString()} characters</span>
        </Text>
      </TextField>

      <Button type="submit" block isDisabled={!canSubmit} isPending={isSubmitting}>
        Generate Speech
      </Button>
    </Form>
  );
}
