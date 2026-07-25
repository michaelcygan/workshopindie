import { createFileRoute } from "@tanstack/react-router";
import { adminGetPost } from "@/lib/blog.functions";
import { BlogEditor } from "@/components/blog-editor";

export const Route = createFileRoute("/admin/blog/$id")({
  loader: async ({ params }) => {
    const post = await adminGetPost({ data: { id: params.id } });
    return { post };
  },
  component: EditPage,
});

function EditPage() {
  const { post } = Route.useLoaderData();
  return <BlogEditor initial={post as any} />;
}
