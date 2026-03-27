import { useMemo } from "react";
import { Form, Input, Label, Text, TextArea, TextField } from "react-aria-components";
import { Button } from "../../../components/atoms/Button";
import { ProgressBar } from "../../../components/atoms/ProgressBar";
import {
  AutocompleteSelect,
  type AutocompleteSelectItem,
} from "../../../components/molecules/AutocompleteSelect";
import { SUPPORTED_LANGUAGES } from "../../../lib/provider-config";
import { input } from "../../../lib/recipes/input";

interface CloneFormProps {
  name: string;
  onNameChange: (value: string) => void;
  transcript: string;
  onTranscriptChange: (value: string) => void;
  language: string;
  onLanguageChange: (value: string) => void;
  submitting: boolean;
  elapsedLabel: string;
  onSubmit: () => void;
  onTryExample: () => void;
}

export function CloneForm({
  name,
  onNameChange,
  transcript,
  onTranscriptChange,
  language,
  onLanguageChange,
  submitting,
  elapsedLabel,
  onSubmit,
  onTryExample,
}: CloneFormProps) {
  const languageItems: AutocompleteSelectItem[] = useMemo(
    () => SUPPORTED_LANGUAGES.map((l) => ({ id: l, label: l })),
    [],
  );

  return (
    <>
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
          <Input
            name="name"
            autoComplete="off"
            placeholder="e.g. Duncan (calm, close-mic)..."
            className={input()}
          />
        </TextField>

        <TextField value={transcript} onChange={onTranscriptChange}>
          <Label className="mb-2 block label-style">Transcript</Label>
          <TextArea
            name="transcript"
            placeholder="Paste the transcript of the reference audio..."
            className={input({ multiline: true })}
          />
          <Text
            slot="description"
            className="mt-2 flex items-center justify-between text-xs text-faint"
          >
            {transcript.length} chars
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
          <Button variant="secondary" type="button" block onPress={() => void onTryExample()}>
            Try Example Voice
          </Button>
          <Button type="submit" block isDisabled={submitting}>
            {submitting ? `Cloning... ${elapsedLabel}` : "Clone Voice"}
          </Button>
        </div>
      </Form>

      {submitting ? (
        <div className="border border-border bg-subtle p-4 shadow-elevated">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <div className="font-medium uppercase tracking-wide">Progress</div>
              <div className="mt-1 text-sm text-muted-foreground">Cloning...</div>
            </div>
            <div className="text-xs text-faint">{elapsedLabel}</div>
          </div>
          <ProgressBar label="Cloning voice" isIndeterminate className="mt-3" />
        </div>
      ) : null}
    </>
  );
}
