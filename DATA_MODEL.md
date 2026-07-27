# DATA_MODEL.md — Postgres schema (Drizzle-ready)

Conventions: UUIDv7 PKs (`id`), `created_at`/`updated_at` timestamptz on all tables, `deleted_at` for soft-deletable entities. FKs `on delete cascade` unless noted.

## Core

```sql
users            (id, email uniq, name, avatar_url, password_hash null, created_at, updated_at)
sessions         (id, user_id fk, expires_at)
workspaces       (id, name, slug uniq, plan text default 'internal', created_at)
memberships      (id, workspace_id fk, user_id fk, role enum('owner','admin','member','guest'),
                  uniq(workspace_id, user_id))

spaces           (id, workspace_id fk, name, icon, order_key,
                  brand_kit_id fk brand_settings null,                     -- overrides workspace default kit
                  deleted_at)
folders          (id, space_id fk, name, order_key, deleted_at)          -- optional layer
lists            (id, space_id fk, folder_id fk null, name, order_key, deleted_at)

statuses         (id, list_id fk, name, color, kind enum('open','active','done','closed'),
                  order_key)                                             -- custom per list
tasks            (id, list_id fk, parent_task_id fk null,                -- subtasks
                  title, description_json jsonb,                         -- rich text (TipTap JSON)
                  status_id fk, priority enum('urgent','high','normal','low') null,
                  start_date, due_date, order_key,
                  created_by fk users, deleted_at)
task_assignees   (task_id fk, user_id fk, uniq pair)
task_watchers    (task_id fk, user_id fk, uniq pair)
task_dependencies(id, task_id fk, depends_on_task_id fk,
                  kind enum('blocks','waiting_on'), uniq(task_id, depends_on_task_id))

checklists       (id, task_id fk, name, order_key)
checklist_items  (id, checklist_id fk, text, done bool, order_key)

comments         (id, task_id fk, parent_comment_id fk null, author_id fk,
                  body_json jsonb, deleted_at)
reactions        (id, comment_id fk, user_id fk, emoji, uniq(comment_id,user_id,emoji))

tags             (id, workspace_id fk, name, color, uniq(workspace_id,name))
task_tags        (task_id fk, tag_id fk, uniq pair)

custom_field_defs(id, workspace_id fk, list_id fk null,   -- null = workspace-wide
                  name, type enum('text','number','date','dropdown','label','checkbox',
                                  'url','currency','image'),
                  options_json jsonb, order_key)
custom_field_values(id, field_def_id fk, task_id fk, value_json jsonb, uniq(field_def_id,task_id))

attachments      (id, workspace_id fk, task_id fk null, comment_id fk null,
                  uploader_id fk, image_asset_id fk null,  -- set when attachment is an image
                  file_key, file_name, mime, size_bytes)

activity         (id, workspace_id fk, actor_id fk, entity_type, entity_id,
                  verb, payload_json jsonb, created_at)     -- append-only
notifications    (id, user_id fk, activity_id fk, read_at null)
```

## Image Brain

```sql
brand_settings   (id, workspace_id fk, name text default 'Default',        -- "brand kits": many per workspace
                  is_default boolean default false,                       -- workspace's fallback kit
                  palette_json jsonb, tone text,
                  logo_asset_id fk null, guidelines text)

image_assets     (id, workspace_id fk, created_by fk,
                  origin enum('upload','generation'),
                  current_version_id fk null,               -- set after first version
                  alt_text, tags_json jsonb, deleted_at)

image_versions   (id, asset_id fk, parent_version_id fk null,   -- tree
                  source enum('upload','generate','edit'),
                  prompt text null, instruction text null,
                  provider, model,
                  file_key, thumb_key, blurhash, width, height,
                  created_by fk, created_at)

brain_conversations(id, workspace_id fk, context_type enum('task','doc','channel','global'),
                    context_id uuid null, created_by fk)
brain_messages   (id, conversation_id fk, role enum('user','assistant','tool'),
                  content_json jsonb,                       -- text + tool calls + image refs
                  image_version_ids uuid[] null, created_at)

ai_usage         (id, workspace_id fk, user_id fk, kind enum('generate','edit','chat','vision'),
                  provider, model, credits int, cost_usd_est numeric, created_at)
```

## Phase 3+ (create when the phase starts, listed for foresight)

```sql
time_entries     (id, task_id fk, user_id fk, started_at, ended_at null, duration_sec, note)
reminders        (id, user_id fk, task_id fk null, remind_at, note, done_at null)
recurrence_rules (id, task_id fk uniq, rrule text, next_run_at)
task_templates   (id, workspace_id fk, name, payload_json jsonb)

docs             (id, workspace_id fk, space_id fk null, title, ydoc_state bytea, deleted_at)
doc_task_links   (doc_id fk, task_id fk, uniq pair)
channels         (id, workspace_id fk, name, is_private bool)
channel_members  (channel_id fk, user_id fk, uniq pair)
messages         (id, channel_id fk, author_id fk, parent_message_id fk null,
                  body_json jsonb, deleted_at)
annotations      (id, image_version_id fk, comment_id fk, x pct, y pct, w pct null, h pct null)

forms            (id, workspace_id fk, list_id fk, schema_json jsonb, public_token uniq)
automations      (id, workspace_id fk, name, trigger_json, conditions_json, actions_json, enabled)
automation_runs  (id, automation_id fk, status, log_json, created_at)
dashboards       (id, workspace_id fk, name); widgets (id, dashboard_id fk, type, config_json, order_key)
goals            (id, workspace_id fk, name, metric_json, due_date); goal_links(goal_id, task_id)
api_keys         (id, workspace_id fk, hash, name, last_used_at)
webhooks         (id, workspace_id fk, url, events text[], secret)
```

## Indexes that matter from day 1
- `tasks(list_id, status_id, order_key)` — board/list rendering
- `tasks(parent_task_id)`, `comments(task_id)`, `activity(workspace_id, created_at desc)`
- `image_versions(asset_id)`, `brain_messages(conversation_id, created_at)`
- FTS: generated tsvector on `tasks.title + description` (GIN)
- Later: pgvector `embedding` columns on tasks/docs/image_versions for semantic + visual search
```
