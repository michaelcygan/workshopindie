import { RichBodyEditor, type RichBodyEditorProps } from "@/components/rich-body-editor";

export type BlogBodyEditorProps = Pick<
  RichBodyEditorProps,
  "value" | "onChange" | "readOnly" | "onDirty" | "onRequestEntityInsert" | "onBusyChange"
>;

/**
 * The Blog composer body. A thin wrapper over the shared `RichBodyEditor`,
 * pinned to the Blog's configuration (covers bucket, tall writing surface,
 * word count) so Blog behaviour is unchanged by Works reusing the same core.
 */
export function BlogBodyEditor(props: BlogBodyEditorProps) {
  return <RichBodyEditor {...props} />;
}
