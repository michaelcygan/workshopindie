import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useSmartBack } from "@/hooks/use-smart-back";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/image-upload";
import { WorkAssetsEditor } from "@/components/work/work-assets-editor";
import { RichBodyEditor } from "@/components/rich-body-editor";
import { WORK_BODY_MAX } from "@/lib/work-body";
import {
  CategoryDetailFields,
  ClassificationNudge,
  FieldCategoryPicker,
  MaterialField,
  PublicationDateField,
  SubjectField,
} from "@/components/work/work-form-fields";
import {
  BookDetailsSection,
  emptyBookDetails,
  type BookDetails,
} from "@/components/book-details-section";
import { isBookWork, type FieldId } from "@/lib/taxonomy";
import { resolveWorkClassification, workCategoryById } from "@/lib/work-categories";
import {
  buildWorkWritePayload,
  emptyWorkForm,
  hydrateWorkForm,
  type WorkDetails,
  type WorkFormValues,
} from "@/lib/work-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/works/$slug_/edit")({
  component: EditWork,
});

const LICENSE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "portfolio_credit_only", label: "Credit only (portfolio)" },
  { value: "cc_by", label: "CC BY" },
  { value: "rights_managed_externally", label: "Rights managed elsewhere" },
  { value: "private", label: "Private / unlisted" },
];

function EditWork() {
  const { slug } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const goBack = useSmartBack({ to: "/works/$slug", params: { slug } });
  const queryClient = useQueryClient();

  const { data: work, isLoading } = useQuery({
    queryKey: ["work-edit", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("works")
        .select(
          "id,title,slug,category,categories,category_canonical,categories_canonical,category_id,subtype,subcategories,subjects,materials,details,publication_date,excerpt,description,cover_url,primary_url,embed_url,license_type,visibility,created_by,book_author,book_publisher,book_isbn,book_published_on,book_page_count,book_buy_links,book_excerpt_url",
        )
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<FieldId[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [materials, setMaterials] = useState<string[]>([]);
  const [publicationDate, setPublicationDate] = useState("");
  const [details, setDetails] = useState<WorkDetails>({});
  const [needsClassification, setNeedsClassification] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [primaryUrl, setPrimaryUrl] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [licenseType, setLicenseType] = useState("portfolio_credit_only");
  const [book, setBook] = useState<BookDetails>(emptyBookDetails);
  const [submitting, setSubmitting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const categoryLabel = workCategoryById(categoryId)?.label ?? (customCategory.trim() || null);

  useEffect(() => {
    if (!work || hydrated) return;
    setTitle(work.title ?? "");
    setExcerpt(work.excerpt ?? "");
    setDescription(work.description ?? "");
    const form = hydrateWorkForm(work);
    setFields(form.fields);
    setCategoryId(form.categoryId);
    setCustomCategory(
      form.customCategory || (!form.categoryId && work.category === "writing_book" ? "Book" : ""),
    );
    setSubjects(form.subjects);
    setMaterials(form.materials);
    setPublicationDate(form.publicationDate);
    setDetails(form.details);
    setNeedsClassification(resolveWorkClassification(work).needsClassification);
    setCoverUrl(work.cover_url ?? null);
    setPrimaryUrl(work.primary_url ?? "");
    setEmbedUrl(work.embed_url ?? "");
    setLicenseType(work.license_type ?? "portfolio_credit_only");
    if (isBookWork(work.category, work.subtype)) {
      setBook({
        author: work.book_author ?? "",
        publisher: work.book_publisher ?? "",
        isbn: work.book_isbn ?? "",
        publishedOn: work.book_published_on ?? "",
        pageCount: work.book_page_count ? String(work.book_page_count) : "",
        buyLinks:
          Array.isArray(work.book_buy_links) && work.book_buy_links.length > 0
            ? (work.book_buy_links as BookDetails["buyLinks"])
            : emptyBookDetails.buyLinks,
        excerptUrl: work.book_excerpt_url ?? "",
      });
    }
    setHydrated(true);
  }, [work, hydrated]);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (work && user && work.created_by !== user.id) {
      toast.error("You can only edit your own Works.");
      navigate({ to: "/works/$slug", params: { slug } });
    }
  }, [work, user, navigate, slug]);

  async function save() {
    if (!work || !user) return;
    if (!title.trim()) return toast.error("Give it a title.");
    if (fields.length === 0) return toast.error("Pick a Field.");
    if (!categoryId && !customCategory.trim()) return toast.error("Pick a Category.");

    const isBook = isBookWork(null, categoryLabel);
    let bookFields: Record<string, unknown> = {};
    if (isBook) {
      const cleanLinks = book.buyLinks
        .map((l) => ({ label: (l.label || "").trim(), url: (l.url || "").trim() }))
        .filter((l) => l.url.length > 0);
      for (const l of cleanLinks) {
        try {
          new URL(l.url);
        } catch {
          return toast.error(`"${l.label || "Buy link"}" isn't a valid URL.`);
        }
      }
      if (book.excerptUrl) {
        try {
          new URL(book.excerptUrl);
        } catch {
          return toast.error("Sample chapter link isn't a valid URL.");
        }
      }
      bookFields = {
        book_author: book.author.trim() || null,
        book_publisher: book.publisher.trim() || null,
        book_isbn: book.isbn.trim() || null,
        book_published_on: book.publishedOn || null,
        book_page_count: book.pageCount ? Number(book.pageCount) || null : null,
        book_buy_links: cleanLinks,
        book_excerpt_url: book.excerptUrl.trim() || null,
      };
    }

    const values: WorkFormValues = {
      ...emptyWorkForm,
      title,
      fields,
      categoryId,
      customCategory,
      excerpt,
      description,
      publicationDate,
      subjects,
      materials,
      details,
      primaryUrl,
      embedUrl,
      coverUrl,
      licenseType,
      visibility: work.visibility === "unlisted" ? "unlisted" : "public",
      ownsRights: true,
    };

    setSubmitting(true);
    const { error } = await supabase
      .from("works")
      .update({
        ...buildWorkWritePayload(values, {
          existingSubcategory:
            (work as { subcategories?: string[] | null }).subcategories?.[0] ?? null,
        }),
        ...bookFields,
      })
      .eq("id", work.id);

    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Changes saved");
    await queryClient.invalidateQueries({ queryKey: ["work", slug] });
    navigate({ to: "/works/$slug", params: { slug } });
  }

  if (isLoading || !hydrated) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center text-ink-muted">
        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
      </main>
    );
  }

  if (!work) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl text-ink">Not found</h1>
        <Link to="/gallery" className="mt-6 inline-block">
          <Button variant="outline" className="rounded-md">
            Back to Gallery
          </Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
      <button
        onClick={goBack}
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <h1 className="mt-4 font-display text-4xl text-ink md:text-5xl">Edit</h1>
      <p className="mt-1 text-sm text-ink-muted">Changes save immediately when you hit Save.</p>

      <div className="mt-8 space-y-6">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Short excerpt</Label>
          <Input
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value.slice(0, 180))}
            placeholder="One-line summary (optional)"
          />
        </div>

        <div className="space-y-2">
          <Label>About this Work</Label>
          <RichBodyEditor
            value={description}
            onChange={(v) => setDescription(v.slice(0, WORK_BODY_MAX))}
            label="About"
            badge={null}
            placeholder="Longer notes, context, credits (optional)"
            uploadBucket="work-covers"
            showWordCount={false}
            soloMinHeight={false}
            stickyOffsetClass="top-0"
            helperText="Add context, process notes, photos or links. Markdown is supported."
          />
        </div>

        <ClassificationNudge show={needsClassification} />

        <FieldCategoryPicker
          fields={fields}
          categoryId={categoryId}
          customCategory={customCategory}
          onFieldsChange={setFields}
          onCategoryChange={setCategoryId}
          onCustomCategoryChange={setCustomCategory}
        />

        <SubjectField values={subjects} onChange={setSubjects} />
        <MaterialField categoryId={categoryId} values={materials} onChange={setMaterials} />
        <PublicationDateField value={publicationDate} onChange={setPublicationDate} />
        <CategoryDetailFields categoryId={categoryId} value={details} onChange={setDetails} />

        <div className="space-y-2">
          <Label>Cover image</Label>
          <ImageUpload value={coverUrl} onChange={setCoverUrl} bucket="work-covers" aspect="wide" />
        </div>

        {work?.id && user?.id && (
          <div className="border-t border-border pt-6">
            <WorkAssetsEditor workId={work.id} userId={user.id} license={licenseType} />
          </div>
        )}

        <div className="space-y-2">
          <Label>Primary link</Label>
          <Input
            value={primaryUrl}
            onChange={(e) => setPrimaryUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>
        <div className="space-y-2">
          <Label>Embed URL</Label>
          <Input
            value={embedUrl}
            onChange={(e) => setEmbedUrl(e.target.value)}
            placeholder="YouTube / Vimeo / SoundCloud URL"
          />
        </div>

        <div className="space-y-2">
          <Label>License</Label>
          <Select value={licenseType} onValueChange={setLicenseType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LICENSE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isBookWork(null, categoryLabel) && <BookDetailsSection value={book} onChange={setBook} />}

        <div className="flex items-center gap-3 border-t border-border pt-6">
          <Button onClick={save} disabled={submitting} className="rounded-md">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
          <Link to="/works/$slug" params={{ slug }}>
            <Button variant="ghost" className="rounded-full">
              Cancel
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
