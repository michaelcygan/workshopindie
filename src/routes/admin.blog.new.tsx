import { createFileRoute } from "@tanstack/react-router";
import { BlogEditor } from "@/components/blog-editor";

export const Route = createFileRoute("/admin/blog/new")({
  component: () => <BlogEditor />,
});
