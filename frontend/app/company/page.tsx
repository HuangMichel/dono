"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PublicShell, DemoTools } from "@/components/public-shell";
import { Button, Card, Field, PageHeading, LinkButton } from "@/components/ui";
import { useDemo } from "@/lib/demo-context";
import { requiredFieldError } from "@/lib/field-validation";
export default function Company() {
  const { state, dispatch } = useDemo(),
    router = useRouter();
  const [name, setName] = useState("Carrefour City Oberkampf"),
    [quantity, setQuantity] = useState("24"),
    [product, setProduct] = useState("Sealed pasta, 500 g"),
    [error, setError] = useState("");
  const [productError, setProductError] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = requiredFieldError(
      "Describe one product type",
      product,
      true,
    );
    setProductError(validationError);
    if (validationError) {
      document.getElementById("product")?.focus();
      return;
    }
    try {
      const id = crypto.randomUUID();
      dispatch({
        type: "create",
        id,
        input: {
          donor_kind: "company",
          company_name: name,
          category: "food",
          quantity,
          unit: "item",
          attributes: { product: product.trim() },
        },
      });
      router.push("/donate?id=" + id);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <PublicShell>
      <main id="main" className="container company-page">
        <div className="company-heading row between">
          <span className="row">
            <span className="company-avatar">CC</span>
            <strong>{name || "Your company"}</strong>
          </span>
          <span className="meta muted">Company</span>
        </div>
        <PageHeading
          title="New offer"
          description="Offer on behalf of a company using your donor account."
        />
        <form onSubmit={submit} className="stack">
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <Field
            id="company-name"
            label="Company name"
            value={name}
            required
            onChange={(e) => setName(e.target.value)}
          />
          <section className="company-form stack">
            <Field
              id="product"
              label="Describe one product type"
              value={product}
              required
              error={productError}
              onChange={(e) => {
                setProduct(e.target.value);
                if (productError)
                  setProductError(
                    requiredFieldError(
                      "Describe one product type",
                      e.target.value,
                      true,
                    ),
                  );
              }}
            />
            <Field
              id="quantity"
              label="Quantity, identical units"
              value={quantity}
              type="number"
              min="1"
              max="999999999"
              step="1"
              required
              onChange={(e) => setQuantity(e.target.value)}
            />
            <p className="meta muted">
              Add item and label photos in the next step.
            </p>
          </section>
          <section className="company-preview">
            <h2>Review the structure before continuing</h2>
            <dl className="facts-list">
              <div>
                <dt>Product</dt>
                <dd>{product.trim() || "Enter one product"}</dd>
              </div>
              <div>
                <dt>Quantity</dt>
                <dd>{quantity || "0"} units</dd>
              </div>
              <div>
                <dt>Food requirements</dt>
                <dd>Non-perishable, room temperature, unopened</dd>
              </div>
            </dl>
            <p className="meta">
              One product type per donation. All units share the same details
              and printed date.
            </p>
          </section>
          <Card className="stack-sm">
            <h2>Continue with photos</h2>
            <p className="meta muted">
              Review the analysis before matching and sending an offer.
            </p>
            {state.role === "donor" ? (
              <Button size="app" className="full">
                Continue to photos and analysis
              </Button>
            ) : (
              <LinkButton href="/login" size="app">
                Choose donor demo role
              </LinkButton>
            )}
          </Card>
          <DemoTools>
            <p className="meta muted">
              Company verification, tax receipts and chilled food are
              unavailable. Entered facts are kept in your local draft.
            </p>
          </DemoTools>
        </form>
      </main>
    </PublicShell>
  );
}
