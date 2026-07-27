import type { AppRouter } from "@canvas/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { ChevronDown, ChevronRight, Folder, Hash, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Space = RouterOutputs["hierarchy"]["tree"]["spaces"][number];
type Folder = RouterOutputs["hierarchy"]["tree"]["folders"][number];
type List = RouterOutputs["hierarchy"]["tree"]["lists"][number];

export function HierarchySidebar({
  workspaceId,
  activeListId,
}: {
  workspaceId: string;
  activeListId?: string;
}) {
  const utils = trpc.useUtils();
  const tree = trpc.hierarchy.tree.useQuery({ workspaceId });
  const [addingSpace, setAddingSpace] = useState(false);

  const invalidate = () => utils.hierarchy.tree.invalidate({ workspaceId });

  const createSpace = trpc.hierarchy.space.create.useMutation({
    onSuccess: () => {
      invalidate();
      setAddingSpace(false);
    },
  });

  if (tree.isLoading) {
    return <p className="text-muted-foreground p-3 text-sm">Loading…</p>;
  }

  return (
    <nav className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-2 pb-1">
        <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
          Spaces
        </span>
        <button
          type="button"
          onClick={() => setAddingSpace((v) => !v)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="New space"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {addingSpace && (
        <NewItemForm
          placeholder="Space name"
          isPending={createSpace.isPending}
          onCancel={() => setAddingSpace(false)}
          onSubmit={(name) => createSpace.mutate({ workspaceId, name })}
        />
      )}

      {tree.data?.spaces.length === 0 && !addingSpace && (
        <p className="text-muted-foreground px-1 text-sm">No spaces yet.</p>
      )}

      {tree.data?.spaces.map((space) => (
        <SpaceSection
          key={space.id}
          workspaceId={workspaceId}
          space={space}
          folders={tree.data.folders.filter((f) => f.spaceId === space.id)}
          lists={tree.data.lists.filter((l) => l.spaceId === space.id)}
          activeListId={activeListId}
          onChanged={invalidate}
        />
      ))}
    </nav>
  );
}

function SpaceSection({
  workspaceId,
  space,
  folders,
  lists,
  activeListId,
  onChanged,
}: {
  workspaceId: string;
  space: Space;
  folders: Folder[];
  lists: List[];
  activeListId?: string;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [addingFolder, setAddingFolder] = useState(false);
  const [addingList, setAddingList] = useState(false);

  const rename = trpc.hierarchy.space.update.useMutation({
    onSuccess: () => {
      onChanged();
      setRenaming(false);
    },
  });
  const del = trpc.hierarchy.space.delete.useMutation({ onSuccess: onChanged });
  const createFolder = trpc.hierarchy.folder.create.useMutation({
    onSuccess: () => {
      onChanged();
      setAddingFolder(false);
    },
  });
  const createList = trpc.hierarchy.list.create.useMutation({
    onSuccess: () => {
      onChanged();
      setAddingList(false);
    },
  });

  const rootLists = lists.filter((l) => l.folderId === null);

  return (
    <div className="space-y-0.5">
      <div className="group flex items-center gap-1 rounded px-1 py-1">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground flex w-3 items-center justify-center"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3" aria-hidden />
          ) : (
            <ChevronRight className="h-3 w-3" aria-hidden />
          )}
        </button>

        {renaming ? (
          <RenameForm
            initialName={space.name}
            isPending={rename.isPending}
            onCancel={() => setRenaming(false)}
            onSubmit={(name) => rename.mutate({ spaceId: space.id, name })}
          />
        ) : (
          <span className="flex-1 truncate text-sm font-medium">
            {space.icon ? `${space.icon} ` : ""}
            {space.name}
          </span>
        )}

        {!renaming && (
          <div className="hidden gap-1 group-hover:flex">
            <IconAction label="New folder" onClick={() => setAddingFolder((v) => !v)}>
              <Folder className="h-3.5 w-3.5" aria-hidden />
            </IconAction>
            <IconAction label="New list" onClick={() => setAddingList((v) => !v)}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </IconAction>
            <IconAction label="Rename space" onClick={() => setRenaming(true)}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </IconAction>
            <IconAction label="Delete space" onClick={() => setConfirmingDelete(true)}>
              <X className="h-3.5 w-3.5" aria-hidden />
            </IconAction>
          </div>
        )}
      </div>

      {confirmingDelete && (
        <ConfirmDelete
          label={`Delete "${space.name}" and everything in it?`}
          isPending={del.isPending}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => del.mutate({ spaceId: space.id })}
        />
      )}

      {expanded && (
        <div className="ml-4 space-y-0.5 border-l border-border pl-2">
          {addingFolder && (
            <NewItemForm
              placeholder="Folder name"
              isPending={createFolder.isPending}
              onCancel={() => setAddingFolder(false)}
              onSubmit={(name) => createFolder.mutate({ spaceId: space.id, name })}
            />
          )}

          {folders.map((folder) => (
            <FolderSection
              key={folder.id}
              workspaceId={workspaceId}
              folder={folder}
              lists={lists.filter((l) => l.folderId === folder.id)}
              activeListId={activeListId}
              onChanged={onChanged}
            />
          ))}

          {addingList && (
            <NewItemForm
              placeholder="List name"
              isPending={createList.isPending}
              onCancel={() => setAddingList(false)}
              onSubmit={(name) => createList.mutate({ spaceId: space.id, name })}
            />
          )}

          {rootLists.map((list) => (
            <ListRow
              key={list.id}
              workspaceId={workspaceId}
              list={list}
              active={list.id === activeListId}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FolderSection({
  workspaceId,
  folder,
  lists,
  activeListId,
  onChanged,
}: {
  workspaceId: string;
  folder: Folder;
  lists: List[];
  activeListId?: string;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [addingList, setAddingList] = useState(false);

  const rename = trpc.hierarchy.folder.update.useMutation({
    onSuccess: () => {
      onChanged();
      setRenaming(false);
    },
  });
  const del = trpc.hierarchy.folder.delete.useMutation({ onSuccess: onChanged });
  const createList = trpc.hierarchy.list.create.useMutation({
    onSuccess: () => {
      onChanged();
      setAddingList(false);
    },
  });

  return (
    <div className="space-y-0.5">
      <div className="group flex items-center gap-1 rounded px-1 py-1">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground flex w-3 items-center justify-center"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3" aria-hidden />
          ) : (
            <ChevronRight className="h-3 w-3" aria-hidden />
          )}
        </button>

        {renaming ? (
          <RenameForm
            initialName={folder.name}
            isPending={rename.isPending}
            onCancel={() => setRenaming(false)}
            onSubmit={(name) => rename.mutate({ folderId: folder.id, name })}
          />
        ) : (
          <span className="flex flex-1 items-center gap-1.5 truncate text-sm">
            <Folder className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
            {folder.name}
          </span>
        )}

        {!renaming && (
          <div className="hidden gap-1 group-hover:flex">
            <IconAction label="New list" onClick={() => setAddingList((v) => !v)}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </IconAction>
            <IconAction label="Rename folder" onClick={() => setRenaming(true)}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </IconAction>
            <IconAction label="Delete folder" onClick={() => setConfirmingDelete(true)}>
              <X className="h-3.5 w-3.5" aria-hidden />
            </IconAction>
          </div>
        )}
      </div>

      {confirmingDelete && (
        <ConfirmDelete
          label={`Delete "${folder.name}" and its lists?`}
          isPending={del.isPending}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => del.mutate({ folderId: folder.id })}
        />
      )}

      {expanded && (
        <div className="ml-4 space-y-0.5 border-l border-border pl-2">
          {addingList && (
            <NewItemForm
              placeholder="List name"
              isPending={createList.isPending}
              onCancel={() => setAddingList(false)}
              onSubmit={(name) =>
                createList.mutate({ spaceId: folder.spaceId, folderId: folder.id, name })
              }
            />
          )}
          {lists.map((list) => (
            <ListRow
              key={list.id}
              workspaceId={workspaceId}
              list={list}
              active={list.id === activeListId}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ListRow({
  workspaceId,
  list,
  active,
  onChanged,
}: {
  workspaceId: string;
  list: List;
  active: boolean;
  onChanged: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const rename = trpc.hierarchy.list.update.useMutation({
    onSuccess: () => {
      onChanged();
      setRenaming(false);
    },
  });
  const del = trpc.hierarchy.list.delete.useMutation({ onSuccess: onChanged });

  if (renaming) {
    return (
      <RenameForm
        initialName={list.name}
        isPending={rename.isPending}
        onCancel={() => setRenaming(false)}
        onSubmit={(name) => rename.mutate({ listId: list.id, name })}
      />
    );
  }

  return (
    <div>
      <div className="group flex items-center gap-1 rounded px-1 py-1">
        <Link
          to="/w/$workspaceId/l/$listId"
          params={{ workspaceId, listId: list.id }}
          className={`flex flex-1 items-center gap-1.5 truncate text-sm ${active ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Hash className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {list.name}
        </Link>
        <div className="hidden gap-1 group-hover:flex">
          <IconAction label="Rename list" onClick={() => setRenaming(true)}>
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </IconAction>
          <IconAction label="Delete list" onClick={() => setConfirmingDelete(true)}>
            <X className="h-3.5 w-3.5" aria-hidden />
          </IconAction>
        </div>
      </div>
      {confirmingDelete && (
        <ConfirmDelete
          label={`Delete "${list.name}"?`}
          isPending={del.isPending}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => del.mutate({ listId: list.id })}
        />
      )}
    </div>
  );
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="text-muted-foreground hover:text-foreground flex items-center"
    >
      {children}
    </button>
  );
}

function NewItemForm({
  placeholder,
  isPending,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  isPending: boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  return (
    <form
      className="flex gap-1 px-1 py-0.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSubmit(name.trim());
      }}
    >
      <Input
        autoFocus
        value={name}
        placeholder={placeholder}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        className="h-7 text-xs"
      />
      <Button
        type="submit"
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={isPending || !name.trim()}
      >
        Add
      </Button>
    </form>
  );
}

function RenameForm({
  initialName,
  isPending,
  onSubmit,
  onCancel,
}: {
  initialName: string;
  isPending: boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  return (
    <form
      className="flex flex-1 gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSubmit(name.trim());
      }}
    >
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        onBlur={onCancel}
        className="h-7 text-xs"
        disabled={isPending}
      />
    </form>
  );
}

function ConfirmDelete({
  label,
  isPending,
  onConfirm,
  onCancel,
}: {
  label: string;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="ml-4 flex items-center gap-2 px-1 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <button type="button" className="text-red-500" disabled={isPending} onClick={onConfirm}>
        Delete
      </button>
      <button type="button" className="text-muted-foreground" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
