export type CommentStatus = "open" | "resolved";
/** Claude/"cloud" editor disabled for now. Restore `"claude"` when re-enabling. */
export type EditorChoice = "cursor"; // | "claude"
export type CoverMode = "auto" | "custom";

export interface Prototype {
  id: string;
  name: string;
  slug: string;
  description: string;
  author: string;
  authorEmail: string;
  previewUrl: string;
  folderPath: string;
  editor?: EditorChoice;
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  coverMode?: CoverMode;
  coverImage?: string;
  localPreviewUrl?: string;
  /** Unique Vite dev port for this prototype (e.g. 5173, 5174, …). */
  localPort?: number;
  /** Shared team-registry entry (no local Desktop folder). */
  fromRegistry?: boolean;
  /** Computed at list time. Desktop folder / blueprint-app was deleted. */
  folderMissing?: boolean;
  /**
   * Emails watching this prototype for comment notifications.
   * Author is auto-added on create; commenters auto-watch; anyone can unsubscribe.
   */
  watchers?: string[];
  /**
   * When false, live ux.netapp.com page hides the shared comment overlay.
   * Default is on. Toggle from Proto Hub or the comment inbox.
   */
  commentsEnabled?: boolean;
}

export interface Comment {
  id: string;
  prototypeId: string;
  author: string;
  authorEmail: string;
  body: string;
  route: string;
  x: number;
  y: number;
  status: CommentStatus;
  mentions: string[];
  createdAt: string;
  updatedAt: string;
  parentId?: string;
}

export interface CreatePrototypeInput {
  name: string;
  description?: string;
  author: string;
  authorEmail: string;
  folderPath?: string;
  editor?: EditorChoice;
}

export interface CreateCommentInput {
  body: string;
  author: string;
  authorEmail: string;
  route: string;
  x: number;
  y: number;
  parentId?: string;
}
