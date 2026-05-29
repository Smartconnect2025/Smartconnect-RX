"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect, useState } from "react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TextStyle } from "@tiptap/extension-text-style";
import { Underline } from "@tiptap/extension-underline";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { createLowlight } from "lowlight";
import "../style.css";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  Code,
  Quote,
  Undo,
  Redo,
  Plus,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface RichTextEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  toolbarConfig?: {
    showHeadings?: boolean;
    showLists?: boolean;
    showCode?: boolean;
    showQuote?: boolean;
    showLink?: boolean;
    showImage?: boolean;
    showTable?: boolean;
    showUndoRedo?: boolean;
  };
}

export function RichTextEditor({
  value,
  onChange,
  placeholder: _placeholder = "Start writing...",
  className = "",
  toolbarConfig = {
    showHeadings: true,
    showLists: true,
    showCode: true,
    showQuote: true,
    showLink: true,
    showImage: true,
    showTable: true,
    showUndoRedo: true,
  },
}: RichTextEditorProps) {
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [isMounted, setIsMounted] = useState(false);

  // Ensure component is mounted on client side only
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        // Re-enable explicit list styling via HTML attributes
        bulletList: {
          HTMLAttributes: {
            class: "list-disc list-inside",
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: "list-decimal list-inside",
          },
        },
        blockquote: {
          HTMLAttributes: {
            class: "border-l-4 border-gray-300 pl-4 italic",
          },
        },
        codeBlock: false, // Disable default code block to use lowlight version
      }),
      CodeBlockLowlight.configure({
        lowlight: createLowlight(),
        HTMLAttributes: {
          class: "bg-gray-100 rounded p-3 font-mono text-sm",
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 underline cursor-pointer",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "max-w-full h-auto rounded-lg",
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: "border-collapse border border-gray-300 my-4",
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: "border border-gray-300 bg-gray-100 font-semibold p-2",
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: "border border-gray-300 p-2",
        },
      }),
      TextStyle,
      Underline,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        // Restore list utilities alongside prose; globals.css will still enhance rendering
        class:
          "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[200px] p-4 [&_ul]:list-disc [&_ul]:list-inside [&_ol]:list-decimal [&_ol]:list-inside [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-3 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mb-2 [&_h4]:text-lg [&_h4]:font-bold [&_h4]:mb-2 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_pre]:bg-gray-100 [&_pre]:rounded [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm [&_table]:border-collapse [&_table]:border [&_table]:border-gray-300 [&_table]:my-4 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-100 [&_th]:font-semibold [&_th]:p-2 [&_td]:border [&_td]:border-gray-300 [&_td]:p-2",
      },
    },
    immediatelyRender: false,
  });

  const addLink = () => {
    if (linkUrl && editor) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
      setLinkUrl("");
      setIsLinkDialogOpen(false);
    }
  };

  const addImage = () => {
    if (imageUrl && editor) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
      setImageUrl("");
      setIsImageDialogOpen(false);
    }
  };

  const addTable = () => {
    if (editor) {
      editor
        .chain()
        .focus()
        .insertTable({ rows: tableRows, cols: tableCols, withHeaderRow: true })
        .run();
      setIsTableDialogOpen(false);
    }
  };

  // Markdown shortcuts
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!editor) return;

    // Markdown shortcuts
    if (event.key === "Enter" && event.shiftKey) {
      // Shift+Enter for line break
      event.preventDefault();
      editor.chain().focus().setHardBreak().run();
    }

    // Auto-formatting shortcuts
    if (event.key === " " && editor.state.selection.empty) {
      const { $from } = editor.state.selection;
      const textBefore = $from.nodeBefore?.textContent || "";

      // Bold shortcut **text**
      if (textBefore.endsWith("**") && textBefore.length > 2) {
        event.preventDefault();
        editor
          .chain()
          .focus()
          .deleteRange({ from: $from.pos - 2, to: $from.pos })
          .toggleBold()
          .run();
      }

      // Italic shortcut *text*
      if (
        textBefore.endsWith("*") &&
        textBefore.length > 1 &&
        !textBefore.endsWith("**")
      ) {
        event.preventDefault();
        editor
          .chain()
          .focus()
          .deleteRange({ from: $from.pos - 1, to: $from.pos })
          .toggleItalic()
          .run();
      }

      // Heading shortcuts # ## ### ####
      if (textBefore.match(/^#{1,4}$/)) {
        event.preventDefault();
        const level = textBefore.length;
        editor
          .chain()
          .focus()
          .deleteRange({ from: $from.pos - level, to: $from.pos })
          .toggleHeading({ level: level as 1 | 2 | 3 | 4 })
          .run();
      }

      // List shortcuts - * or - for bullet list
      if (textBefore.match(/^[\*\-]$/)) {
        event.preventDefault();
        editor
          .chain()
          .focus()
          .deleteRange({ from: $from.pos - 1, to: $from.pos })
          .toggleBulletList()
          .run();
      }

      // Numbered list shortcut 1.
      if (textBefore.match(/^\d+\.$/)) {
        event.preventDefault();
        editor
          .chain()
          .focus()
          .deleteRange({ from: $from.pos - textBefore.length, to: $from.pos })
          .toggleOrderedList()
          .run();
      }

      // Quote shortcut >
      if (textBefore === ">") {
        event.preventDefault();
        editor
          .chain()
          .focus()
          .deleteRange({ from: $from.pos - 1, to: $from.pos })
          .toggleBlockquote()
          .run();
      }
    }
  };

  // Show loading state until mounted on client side
  if (!isMounted) {
    return (
      <div className={`border border-gray-200 rounded-lg ${className}`}>
        <div className="p-4 text-center text-gray-500">Loading editor...</div>
      </div>
    );
  }

  if (!editor) {
    return (
      <div className={`border border-gray-200 rounded-lg ${className}`}>
        <div className="p-4 text-center text-gray-500">
          Initializing editor...
        </div>
      </div>
    );
  }

  return (
    <div className={`border border-gray-200 rounded-lg ${className}`}>
      {/* Toolbar */}
      <div className="border-b border-gray-200 p-2 flex flex-wrap gap-1">
        {/* Text Formatting */}
        <div className="flex gap-1 border-r border-gray-200 pr-2 mr-2">
          <Button
            type="button"
            variant={editor.isActive("bold") ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              const { from, to } = editor.state.selection;
              if (from !== to) {
                // Text is selected - apply formatting to selection only
                editor.chain().focus().toggleBold().run();
              } else {
                // No selection - toggle for future typing
                editor.chain().focus().toggleBold().run();
              }
            }}
            className="h-8 w-8 p-0"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={editor.isActive("italic") ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              const { from, to } = editor.state.selection;
              if (from !== to) {
                // Text is selected - apply formatting to selection only
                editor.chain().focus().toggleItalic().run();
              } else {
                // No selection - toggle for future typing
                editor.chain().focus().toggleItalic().run();
              }
            }}
            className="h-8 w-8 p-0"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={editor.isActive("underline") ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              const { from, to } = editor.state.selection;
              if (from !== to) {
                // Text is selected - apply formatting to selection only
                editor.chain().focus().toggleUnderline().run();
              } else {
                // No selection - toggle for future typing
                editor.chain().focus().toggleUnderline().run();
              }
            }}
            className="h-8 w-8 p-0"
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* Headings */}
        {toolbarConfig.showHeadings && (
          <div className="flex gap-1 border-r border-gray-200 pr-2 mr-2">
            <Button
              type="button"
              variant={
                editor.isActive("heading", { level: 1 }) ? "default" : "ghost"
              }
              size="sm"
              onClick={() => {
                if (editor.isActive("heading", { level: 1 })) {
                  editor.chain().focus().setParagraph().run();
                } else {
                  editor.chain().focus().toggleHeading({ level: 1 }).run();
                }
              }}
              className="h-8 w-8 p-0"
            >
              <Heading1 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={
                editor.isActive("heading", { level: 2 }) ? "default" : "ghost"
              }
              size="sm"
              onClick={() => {
                if (editor.isActive("heading", { level: 2 })) {
                  editor.chain().focus().setParagraph().run();
                } else {
                  editor.chain().focus().toggleHeading({ level: 2 }).run();
                }
              }}
              className="h-8 w-8 p-0"
            >
              <Heading2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={
                editor.isActive("heading", { level: 3 }) ? "default" : "ghost"
              }
              size="sm"
              onClick={() => {
                if (editor.isActive("heading", { level: 3 })) {
                  editor.chain().focus().setParagraph().run();
                } else {
                  editor.chain().focus().toggleHeading({ level: 3 }).run();
                }
              }}
              className="h-8 w-8 p-0"
            >
              <Heading3 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={
                editor.isActive("heading", { level: 4 }) ? "default" : "ghost"
              }
              size="sm"
              onClick={() => {
                if (editor.isActive("heading", { level: 4 })) {
                  editor.chain().focus().setParagraph().run();
                } else {
                  editor.chain().focus().toggleHeading({ level: 4 }).run();
                }
              }}
              className="h-8 w-8 p-0"
            >
              <Heading4 className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Lists */}
        {toolbarConfig.showLists && (
          <div className="flex gap-1 border-r border-gray-200 pr-2 mr-2">
            <Button
              type="button"
              variant={editor.isActive("bulletList") ? "default" : "ghost"}
              size="sm"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={editor.isActive("orderedList") ? "default" : "ghost"}
              size="sm"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className="h-8 w-8 p-0"
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Code and Quote */}
        {(toolbarConfig.showCode || toolbarConfig.showQuote) && (
          <div className="flex gap-1 border-r border-gray-200 pr-2 mr-2">
            {toolbarConfig.showCode && (
              <Button
                type="button"
                variant={editor.isActive("codeBlock") ? "default" : "ghost"}
                size="sm"
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                className="h-8 w-8 p-0"
              >
                <Code className="h-4 w-4" />
              </Button>
            )}
            {toolbarConfig.showQuote && (
              <Button
                type="button"
                variant={editor.isActive("blockquote") ? "default" : "ghost"}
                size="sm"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className="h-8 w-8 p-0"
              >
                <Quote className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {/* Links and Media */}
        {(toolbarConfig.showLink ||
          toolbarConfig.showImage ||
          toolbarConfig.showTable) && (
          <div className="flex gap-1 border-r border-gray-200 pr-2 mr-2">
            {toolbarConfig.showLink && (
              <Dialog
                open={isLinkDialogOpen}
                onOpenChange={setIsLinkDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant={editor.isActive("link") ? "default" : "ghost"}
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md w-full mx-4">
                  <DialogHeader className="space-y-3">
                    <DialogTitle className="text-lg font-semibold">
                      Add Link
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                      Enter the URL for the link
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="link-url" className="text-sm font-medium">
                        URL
                      </Label>
                      <Input
                        id="link-url"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="https://example.com"
                        className="w-full"
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsLinkDialogOpen(false)}
                        className="px-4"
                      >
                        Cancel
                      </Button>
                      <Button type="button" onClick={addLink} className="px-4">
                        Add Link
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {toolbarConfig.showImage && (
              <Dialog
                open={isImageDialogOpen}
                onOpenChange={setIsImageDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md w-full mx-4">
                  <DialogHeader className="space-y-3">
                    <DialogTitle className="text-lg font-semibold">
                      Add Image
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                      Enter the URL for the image
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="image-url"
                        className="text-sm font-medium"
                      >
                        Image URL
                      </Label>
                      <Input
                        id="image-url"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="https://example.com/image.jpg"
                        className="w-full"
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsImageDialogOpen(false)}
                        className="px-4"
                      >
                        Cancel
                      </Button>
                      <Button type="button" onClick={addImage} className="px-4">
                        Add Image
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {toolbarConfig.showTable && (
              <Dialog
                open={isTableDialogOpen}
                onOpenChange={setIsTableDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <TableIcon className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg w-full mx-4">
                  <DialogHeader className="space-y-3">
                    <DialogTitle className="text-lg font-semibold">
                      Insert Table
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                      Choose the number of rows and columns for your table
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label
                          htmlFor="table-rows"
                          className="text-sm font-medium"
                        >
                          Rows
                        </Label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setTableRows(Math.max(1, tableRows - 1))
                            }
                            className="h-9 w-9 p-0 shrink-0"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            id="table-rows"
                            type="number"
                            min="1"
                            max="20"
                            value={tableRows}
                            onChange={(e) =>
                              setTableRows(
                                Math.max(
                                  1,
                                  Math.min(20, parseInt(e.target.value) || 1),
                                ),
                              )
                            }
                            className="text-center flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setTableRows(Math.min(20, tableRows + 1))
                            }
                            className="h-9 w-9 p-0 shrink-0"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <Label
                          htmlFor="table-cols"
                          className="text-sm font-medium"
                        >
                          Columns
                        </Label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setTableCols(Math.max(1, tableCols - 1))
                            }
                            className="h-9 w-9 p-0 shrink-0"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            id="table-cols"
                            type="number"
                            min="1"
                            max="10"
                            value={tableCols}
                            onChange={(e) =>
                              setTableCols(
                                Math.max(
                                  1,
                                  Math.min(10, parseInt(e.target.value) || 1),
                                ),
                              )
                            }
                            className="text-center flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setTableCols(Math.min(10, tableCols + 1))
                            }
                            className="h-9 w-9 p-0 shrink-0"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsTableDialogOpen(false)}
                        className="px-4"
                      >
                        Cancel
                      </Button>
                      <Button type="button" onClick={addTable} className="px-4">
                        Insert Table ({tableRows}×{tableCols})
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}

        {/* Undo/Redo */}
        {toolbarConfig.showUndoRedo && (
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className="h-8 w-8 p-0"
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className="h-8 w-8 p-0"
            >
              <Redo className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Editor Content */}
      <div className="min-h-[200px]">
        <EditorContent
          editor={editor}
          className="focus:outline-none"
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
}
