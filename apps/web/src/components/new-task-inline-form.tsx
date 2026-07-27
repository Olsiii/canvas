import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export function NewTaskInlineForm({
  isPending,
  onSubmit,
  onCancel,
}: {
  isPending: boolean;
  onSubmit: (title: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) onSubmit(title.trim());
      }}
    >
      <Input
        autoFocus
        value={title}
        placeholder="Task title"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        onBlur={() => {
          if (!title.trim()) onCancel();
        }}
        className="h-7 text-xs"
      />
      <Button
        type="submit"
        size="sm"
        className="h-6 px-2 text-xs"
        disabled={isPending || !title.trim()}
      >
        Add
      </Button>
    </form>
  );
}
