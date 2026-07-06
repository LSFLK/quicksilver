// React-email template registry.
//
// Each template is a React component built from `@react-email/components`
// (the Resend react-email library) plus a small schema describing the
// variables a user can fill in when composing. The compose flow renders the
// selected template to email-safe HTML (inline styles) with `render()` and a
// plain-text fallback with `render(..., { plainText: true })`.
//
// To add a template: append an entry to TEMPLATES with a unique id, a field
// list, an optional subject() helper, and a Component that reads `values`.

import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Markdown,
  Preview,
  Row,
  Column,
  Section,
  Text,
} from "@react-email/components";

// Quicksilver brand palette (mirrors src/theme.ts).
const BRAND = {
  burgundy: "#8D153A",
  orange: "#EB7400",
  gold: "#FFBE29",
  teal: "#00534E",
  ink: "#1a1a1a",
  muted: "#6b6b6b",
  border: "#e6e6e6",
  bg: "#f4f4f5",
  paper: "#ffffff",
};

export type FieldType =
  | "text"
  | "textarea"
  | "url"
  | "color"
  | "list"
  | "markdown";

export interface TemplateField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  default: string;
  /** For `list` type: help text describing the one-item-per-line format. */
  help?: string;
}

export interface TemplateValues {
  [key: string]: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  /** Emoji shown on the gallery card. */
  icon: string;
  category: string;
  fields: TemplateField[];
  /** Suggested subject line derived from the filled-in values. */
  subject?: (v: TemplateValues) => string;
  Component: React.FC<{ values: TemplateValues }>;
}

// ---------------------------------------------------------------------------
// Shared style objects (inline styles are required for email-client support).
// ---------------------------------------------------------------------------

const main: React.CSSProperties = {
  backgroundColor: BRAND.bg,
  fontFamily:
    '"Encode Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  backgroundColor: BRAND.paper,
  margin: "0 auto",
  maxWidth: "600px",
  width: "100%",
  borderRadius: "12px",
  overflow: "hidden",
  border: `1px solid ${BRAND.border}`,
};

const contentPad: React.CSSProperties = { padding: "32px 40px" };

const h1: React.CSSProperties = {
  color: BRAND.ink,
  fontSize: "26px",
  fontWeight: 700,
  lineHeight: "1.25",
  margin: "0 0 16px",
};

const paragraph: React.CSSProperties = {
  color: "#3a3a3a",
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const muted: React.CSSProperties = {
  color: BRAND.muted,
  fontSize: "13px",
  lineHeight: "1.5",
};

const button = (bg: string): React.CSSProperties => ({
  backgroundColor: bg,
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: 600,
  textDecoration: "none",
  textAlign: "center",
  display: "inline-block",
  padding: "13px 28px",
});

const footer: React.CSSProperties = {
  ...contentPad,
  paddingTop: "20px",
  paddingBottom: "28px",
  backgroundColor: "#fafafa",
  borderTop: `1px solid ${BRAND.border}`,
};

/** Split a textarea value into non-empty, trimmed lines. */
const lines = (v?: string): string[] =>
  (v || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

/** Split each paragraph on blank-line boundaries for body copy. */
const paragraphs = (v?: string): string[] =>
  (v || "")
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);

// A tinted brand bar used as a header accent on several templates.
const AccentBar: React.FC<{ color?: string }> = ({ color = BRAND.burgundy }) => (
  <div
    style={{
      height: "6px",
      background: `linear-gradient(90deg, ${color} 0%, ${BRAND.orange} 60%, ${BRAND.gold} 100%)`,
    }}
  />
);

const BrandFooter: React.FC<{ company: string; footerNote?: string }> = ({
  company,
  footerNote,
}) => (
  <Section style={footer}>
    <Text style={{ ...muted, margin: "0 0 4px", fontWeight: 600 }}>{company}</Text>
    {footerNote ? <Text style={{ ...muted, margin: 0 }}>{footerNote}</Text> : null}
    <Text style={{ ...muted, margin: "8px 0 0" }}>
      Sent with Quicksilver · Email 2.0
    </Text>
  </Section>
);

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const SimpleTemplate: React.FC<{ values: TemplateValues }> = ({ values }) => (
  <Html>
    <Head />
    <Preview>{values.preheader || values.heading || "New message"}</Preview>
    <Body style={main}>
      <Container style={{ ...container, marginTop: "24px", marginBottom: "24px" }}>
        <AccentBar />
        <Section style={contentPad}>
          {values.heading ? <Heading style={h1}>{values.heading}</Heading> : null}
          {paragraphs(values.body).map((p, i) => (
            <Text key={i} style={paragraph}>
              {p}
            </Text>
          ))}
          {values.signoff ? (
            <Text style={{ ...paragraph, marginTop: "24px" }}>{values.signoff}</Text>
          ) : null}
        </Section>
      </Container>
    </Body>
  </Html>
);

const CTATemplate: React.FC<{ values: TemplateValues }> = ({ values }) => (
  <Html>
    <Head />
    <Preview>{values.preheader || values.heading}</Preview>
    <Body style={main}>
      <Container style={{ ...container, marginTop: "24px", marginBottom: "24px" }}>
        <AccentBar />
        <Section style={contentPad}>
          {values.eyebrow ? (
            <Text
              style={{
                color: BRAND.burgundy,
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                margin: "0 0 8px",
              }}
            >
              {values.eyebrow}
            </Text>
          ) : null}
          <Heading style={h1}>{values.heading}</Heading>
          {paragraphs(values.body).map((p, i) => (
            <Text key={i} style={paragraph}>
              {p}
            </Text>
          ))}
          {values.buttonText && values.buttonUrl ? (
            <Section style={{ margin: "24px 0 8px" }}>
              <Button style={button(BRAND.burgundy)} href={values.buttonUrl}>
                {values.buttonText}
              </Button>
            </Section>
          ) : null}
          {values.footnote ? (
            <Text style={{ ...muted, marginTop: "16px" }}>{values.footnote}</Text>
          ) : null}
        </Section>
        <BrandFooter company={values.company || "Quicksilver"} footerNote={values.address} />
      </Container>
    </Body>
  </Html>
);

const NewsletterTemplate: React.FC<{ values: TemplateValues }> = ({ values }) => (
  <Html>
    <Head />
    <Preview>{values.preheader || values.title}</Preview>
    <Body style={main}>
      <Container style={{ ...container, marginTop: "24px", marginBottom: "24px" }}>
        <Section
          style={{
            padding: "36px 40px 20px",
            background: `linear-gradient(135deg, ${BRAND.burgundy} 0%, ${BRAND.teal} 100%)`,
          }}
        >
          <Text
            style={{
              color: BRAND.gold,
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              margin: "0 0 6px",
            }}
          >
            {values.issue || "Newsletter"}
          </Text>
          <Heading style={{ ...h1, color: "#ffffff", margin: 0 }}>
            {values.title}
          </Heading>
        </Section>
        <Section style={contentPad}>
          {values.intro ? <Text style={paragraph}>{values.intro}</Text> : null}
          {lines(values.sections).map((line, i) => {
            const [head, ...rest] = line.split("|");
            const bodyText = rest.join("|").trim();
            return (
              <Section key={i} style={{ margin: "0 0 20px" }}>
                <Heading
                  as="h2"
                  style={{
                    color: BRAND.burgundy,
                    fontSize: "18px",
                    fontWeight: 700,
                    margin: "0 0 6px",
                  }}
                >
                  {head.trim()}
                </Heading>
                {bodyText ? <Text style={{ ...paragraph, margin: 0 }}>{bodyText}</Text> : null}
              </Section>
            );
          })}
          {values.buttonText && values.buttonUrl ? (
            <Section style={{ margin: "8px 0" }}>
              <Button style={button(BRAND.orange)} href={values.buttonUrl}>
                {values.buttonText}
              </Button>
            </Section>
          ) : null}
        </Section>
        <BrandFooter company={values.company || "Quicksilver"} footerNote={values.address} />
      </Container>
    </Body>
  </Html>
);

const AnnouncementTemplate: React.FC<{ values: TemplateValues }> = ({ values }) => (
  <Html>
    <Head />
    <Preview>{values.preheader || values.heading}</Preview>
    <Body style={main}>
      <Container style={{ ...container, marginTop: "24px", marginBottom: "24px" }}>
        <AccentBar color={BRAND.teal} />
        <Section style={{ ...contentPad, textAlign: "center" }}>
          <Text
            style={{
              display: "inline-block",
              backgroundColor: "#fff3e0",
              color: BRAND.orange,
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "6px 14px",
              borderRadius: "999px",
              margin: "0 0 16px",
            }}
          >
            {values.badge || "Announcement"}
          </Text>
          <Heading style={{ ...h1, textAlign: "center" }}>{values.heading}</Heading>
          {paragraphs(values.body).map((p, i) => (
            <Text key={i} style={{ ...paragraph, textAlign: "center" }}>
              {p}
            </Text>
          ))}
          {values.buttonText && values.buttonUrl ? (
            <Section style={{ margin: "24px 0 8px" }}>
              <Button style={button(BRAND.teal)} href={values.buttonUrl}>
                {values.buttonText}
              </Button>
            </Section>
          ) : null}
        </Section>
        <BrandFooter company={values.company || "Quicksilver"} footerNote={values.address} />
      </Container>
    </Body>
  </Html>
);

const MeetingTemplate: React.FC<{ values: TemplateValues }> = ({ values }) => {
  const detail = (label: string, value?: string) =>
    value ? (
      <Row style={{ margin: "0 0 10px" }}>
        <Column style={{ width: "90px", verticalAlign: "top" }}>
          <Text style={{ ...muted, margin: 0, fontWeight: 700 }}>{label}</Text>
        </Column>
        <Column>
          <Text style={{ ...paragraph, margin: 0, fontSize: "15px" }}>{value}</Text>
        </Column>
      </Row>
    ) : null;

  return (
    <Html>
      <Head />
      <Preview>{values.preheader || `Invitation: ${values.title}`}</Preview>
      <Body style={main}>
        <Container style={{ ...container, marginTop: "24px", marginBottom: "24px" }}>
          <AccentBar />
          <Section style={contentPad}>
            <Text
              style={{
                color: BRAND.burgundy,
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                margin: "0 0 8px",
              }}
            >
              Meeting invitation
            </Text>
            <Heading style={h1}>{values.title}</Heading>
            {values.description ? <Text style={paragraph}>{values.description}</Text> : null}
            <Section
              style={{
                backgroundColor: BRAND.bg,
                borderRadius: "10px",
                padding: "18px 20px",
                margin: "8px 0 20px",
              }}
            >
              {detail("When", values.date)}
              {detail("Time", values.time)}
              {detail("Where", values.location)}
              {detail("Host", values.host)}
            </Section>
            {values.joinUrl ? (
              <Section style={{ margin: "0 0 8px" }}>
                <Button style={button(BRAND.burgundy)} href={values.joinUrl}>
                  {values.buttonText || "Join meeting"}
                </Button>
              </Section>
            ) : null}
          </Section>
          <BrandFooter company={values.company || "Quicksilver"} footerNote={values.address} />
        </Container>
      </Body>
    </Html>
  );
};

const ReceiptTemplate: React.FC<{ values: TemplateValues }> = ({ values }) => {
  const items = lines(values.items).map((l) => {
    const [name, price] = l.split("|");
    return { name: (name || "").trim(), price: (price || "").trim() };
  });
  return (
    <Html>
      <Head />
      <Preview>{values.preheader || `Receipt ${values.orderId || ""}`}</Preview>
      <Body style={main}>
        <Container style={{ ...container, marginTop: "24px", marginBottom: "24px" }}>
          <AccentBar color={BRAND.teal} />
          <Section style={contentPad}>
            <Heading style={h1}>{values.heading || "Thanks for your order"}</Heading>
            {values.intro ? <Text style={paragraph}>{values.intro}</Text> : null}
            {values.orderId ? (
              <Text style={{ ...muted, margin: "0 0 16px" }}>
                Order {values.orderId}
                {values.orderDate ? ` · ${values.orderDate}` : ""}
              </Text>
            ) : null}
            <Section
              style={{
                border: `1px solid ${BRAND.border}`,
                borderRadius: "10px",
                overflow: "hidden",
              }}
            >
              {items.map((it, i) => (
                <Row
                  key={i}
                  style={{
                    padding: "12px 18px",
                    borderBottom: `1px solid ${BRAND.border}`,
                  }}
                >
                  <Column>
                    <Text style={{ ...paragraph, margin: 0, fontSize: "15px" }}>{it.name}</Text>
                  </Column>
                  <Column style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <Text style={{ ...paragraph, margin: 0, fontSize: "15px", fontWeight: 600 }}>
                      {it.price}
                    </Text>
                  </Column>
                </Row>
              ))}
              {values.total ? (
                <Row style={{ padding: "14px 18px", backgroundColor: BRAND.bg }}>
                  <Column>
                    <Text style={{ ...paragraph, margin: 0, fontWeight: 700 }}>Total</Text>
                  </Column>
                  <Column style={{ textAlign: "right" }}>
                    <Text
                      style={{
                        ...paragraph,
                        margin: 0,
                        fontWeight: 700,
                        color: BRAND.burgundy,
                      }}
                    >
                      {values.total}
                    </Text>
                  </Column>
                </Row>
              ) : null}
            </Section>
            {values.buttonText && values.buttonUrl ? (
              <Section style={{ margin: "20px 0 8px" }}>
                <Button style={button(BRAND.teal)} href={values.buttonUrl}>
                  {values.buttonText}
                </Button>
              </Section>
            ) : null}
          </Section>
          <BrandFooter company={values.company || "Quicksilver"} footerNote={values.address} />
        </Container>
      </Body>
    </Html>
  );
};

// Styling handed to react-email's <Markdown> so rendered markdown inherits the
// Quicksilver look (headings, links, code, quotes) as inline email styles.
const markdownStyles = {
  h1: { ...h1, fontSize: "24px" },
  h2: { color: BRAND.ink, fontSize: "20px", fontWeight: 700, margin: "24px 0 10px" },
  h3: { color: BRAND.ink, fontSize: "17px", fontWeight: 700, margin: "20px 0 8px" },
  p: paragraph,
  link: { color: BRAND.burgundy, textDecoration: "underline" },
  li: { ...paragraph, margin: "0 0 6px" },
  ul: { paddingLeft: "22px", margin: "0 0 16px" },
  ol: { paddingLeft: "22px", margin: "0 0 16px" },
  blockQuote: {
    borderLeft: `4px solid ${BRAND.gold}`,
    margin: "0 0 16px",
    padding: "4px 16px",
    color: BRAND.muted,
    fontStyle: "italic",
  },
  codeInline: {
    backgroundColor: BRAND.bg,
    borderRadius: "4px",
    padding: "2px 6px",
    fontSize: "14px",
    fontFamily: "monospace",
  },
  codeBlock: {
    backgroundColor: "#1a1a1a",
    color: "#f4f4f5",
    borderRadius: "8px",
    padding: "16px",
    fontSize: "14px",
    fontFamily: "monospace",
    overflowX: "auto" as const,
  },
  hr: { border: "none", borderTop: `1px solid ${BRAND.border}`, margin: "24px 0" },
};

const MarkdownTemplate: React.FC<{ values: TemplateValues }> = ({ values }) => (
  <Html>
    <Head />
    <Preview>{values.preheader || values.heading || "New message"}</Preview>
    <Body style={main}>
      <Container style={{ ...container, marginTop: "24px", marginBottom: "24px" }}>
        <AccentBar />
        <Section style={contentPad}>
          {values.heading ? <Heading style={h1}>{values.heading}</Heading> : null}
          <Markdown
            markdownContainerStyles={{ padding: 0 }}
            markdownCustomStyles={markdownStyles}
          >
            {values.markdown || ""}
          </Markdown>
        </Section>
        {values.company ? (
          <BrandFooter company={values.company} footerNote={values.address} />
        ) : null}
      </Container>
    </Body>
  </Html>
);

const OtpTemplate: React.FC<{ values: TemplateValues }> = ({ values }) => (
  <Html>
    <Head />
    <Preview>{values.preheader || "Your verification code"}</Preview>
    <Body style={main}>
      <Container style={{ ...container, marginTop: "24px", marginBottom: "24px" }}>
        <AccentBar color={BRAND.teal} />
        <Section style={{ ...contentPad, textAlign: "center" }}>
          <Heading style={{ ...h1, textAlign: "center" }}>
            {values.heading || "Your verification code"}
          </Heading>
          {values.intro ? (
            <Text style={{ ...paragraph, textAlign: "center" }}>{values.intro}</Text>
          ) : null}
          <Section
            style={{
              backgroundColor: BRAND.bg,
              borderRadius: "12px",
              padding: "22px",
              margin: "12px auto 16px",
            }}
          >
            <Text
              style={{
                color: BRAND.burgundy,
                fontSize: "38px",
                fontWeight: 700,
                letterSpacing: "0.35em",
                fontFamily: "monospace",
                margin: 0,
                textAlign: "center",
              }}
            >
              {values.code || "000000"}
            </Text>
          </Section>
          {values.expiry ? (
            <Text style={{ ...muted, textAlign: "center" }}>{values.expiry}</Text>
          ) : null}
          {values.footnote ? (
            <Text style={{ ...muted, textAlign: "center", marginTop: "8px" }}>
              {values.footnote}
            </Text>
          ) : null}
        </Section>
        <BrandFooter company={values.company || "Quicksilver"} footerNote={values.address} />
      </Container>
    </Body>
  </Html>
);

const PasswordResetTemplate: React.FC<{ values: TemplateValues }> = ({ values }) => (
  <Html>
    <Head />
    <Preview>{values.preheader || values.heading}</Preview>
    <Body style={main}>
      <Container style={{ ...container, marginTop: "24px", marginBottom: "24px" }}>
        <AccentBar color={BRAND.teal} />
        <Section style={contentPad}>
          <Heading style={h1}>{values.heading || "Reset your password"}</Heading>
          {paragraphs(values.body).map((p, i) => (
            <Text key={i} style={paragraph}>
              {p}
            </Text>
          ))}
          {values.buttonText && values.buttonUrl ? (
            <Section style={{ margin: "24px 0 8px" }}>
              <Button style={button(BRAND.burgundy)} href={values.buttonUrl}>
                {values.buttonText}
              </Button>
            </Section>
          ) : null}
          {values.expiry ? (
            <Text style={{ ...muted, marginTop: "8px" }}>{values.expiry}</Text>
          ) : null}
          <Hr style={{ border: "none", borderTop: `1px solid ${BRAND.border}`, margin: "20px 0" }} />
          <Text style={muted}>
            {values.footnote ||
              "If you didn't request this, you can safely ignore this email — your password won't change."}
          </Text>
        </Section>
        <BrandFooter company={values.company || "Quicksilver"} footerNote={values.address} />
      </Container>
    </Body>
  </Html>
);

const FeedbackTemplate: React.FC<{ values: TemplateValues }> = ({ values }) => (
  <Html>
    <Head />
    <Preview>{values.preheader || values.heading}</Preview>
    <Body style={main}>
      <Container style={{ ...container, marginTop: "24px", marginBottom: "24px" }}>
        <AccentBar color={BRAND.orange} />
        <Section style={{ ...contentPad, textAlign: "center" }}>
          <Heading style={{ ...h1, textAlign: "center" }}>
            {values.heading || "How did we do?"}
          </Heading>
          {paragraphs(values.body).map((p, i) => (
            <Text key={i} style={{ ...paragraph, textAlign: "center" }}>
              {p}
            </Text>
          ))}
          <Text style={{ fontSize: "30px", letterSpacing: "0.15em", margin: "8px 0 16px" }}>
            ⭐⭐⭐⭐⭐
          </Text>
          {values.buttonText && values.buttonUrl ? (
            <Section style={{ margin: "0 0 8px" }}>
              <Button style={button(BRAND.orange)} href={values.buttonUrl}>
                {values.buttonText}
              </Button>
            </Section>
          ) : null}
          {values.footnote ? (
            <Text style={{ ...muted, textAlign: "center", marginTop: "12px" }}>
              {values.footnote}
            </Text>
          ) : null}
        </Section>
        <BrandFooter company={values.company || "Quicksilver"} footerNote={values.address} />
      </Container>
    </Body>
  </Html>
);

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const TEMPLATES: EmailTemplate[] = [
  {
    id: "markdown",
    name: "Markdown",
    description: "Write in Markdown — headings, lists, links, quotes and code render automatically.",
    icon: "📝",
    category: "Basic",
    Component: MarkdownTemplate,
    subject: (v) => v.heading || "",
    fields: [
      { key: "heading", label: "Heading (optional)", type: "text", default: "" },
      {
        key: "markdown",
        label: "Markdown",
        type: "markdown",
        default:
          "# Hello there\n\nThanks for reaching out. Here's what I wanted to share:\n\n- **Bold** and _italic_ text work\n- [Links](https://example.com) are styled\n- Lists, quotes and code too\n\n> A short quote to make a point.\n\nInline `code` and blocks:\n\n```\nnpm install quicksilver\n```\n\nBest regards,",
        help: "Standard Markdown: # headings, **bold**, - lists, > quotes, `code`, [links](url).",
      },
      { key: "company", label: "Footer name (optional)", type: "text", default: "" },
      { key: "address", label: "Footer address", type: "text", default: "" },
      { key: "preheader", label: "Preview text", type: "text", default: "" },
    ],
  },
  {
    id: "simple",
    name: "Simple message",
    description: "A clean, branded letter — heading, body paragraphs, and a sign-off.",
    icon: "✉️",
    category: "Basic",
    Component: SimpleTemplate,
    subject: (v) => v.heading || "",
    fields: [
      { key: "heading", label: "Heading", type: "text", default: "Hello there" },
      {
        key: "body",
        label: "Body",
        type: "textarea",
        default:
          "Thanks for reaching out.\n\nI wanted to follow up on our conversation and share a few next steps with you.",
        help: "Separate paragraphs with a blank line.",
      },
      { key: "signoff", label: "Sign-off", type: "text", default: "Best regards," },
      { key: "preheader", label: "Preview text", type: "text", default: "" },
    ],
  },
  {
    id: "welcome",
    name: "Welcome / CTA",
    description: "Onboarding-style email with an eyebrow, message, and a call-to-action button.",
    icon: "👋",
    category: "Marketing",
    Component: CTATemplate,
    subject: (v) => v.heading || "Welcome",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text", default: "Welcome aboard" },
      { key: "heading", label: "Heading", type: "text", default: "Great to have you here" },
      {
        key: "body",
        label: "Body",
        type: "textarea",
        default:
          "We're thrilled you've joined us. Get started by exploring your dashboard and setting up your profile.\n\nIf you have any questions, just reply to this email.",
      },
      { key: "buttonText", label: "Button text", type: "text", default: "Get started" },
      { key: "buttonUrl", label: "Button link", type: "url", default: "https://example.com" },
      { key: "footnote", label: "Footnote", type: "text", default: "" },
      { key: "company", label: "Company name", type: "text", default: "Quicksilver" },
      { key: "address", label: "Footer address", type: "text", default: "" },
      { key: "preheader", label: "Preview text", type: "text", default: "" },
    ],
  },
  {
    id: "newsletter",
    name: "Newsletter",
    description: "Multi-section newsletter with a gradient header and article blocks.",
    icon: "📰",
    category: "Marketing",
    Component: NewsletterTemplate,
    subject: (v) => v.title || "Newsletter",
    fields: [
      { key: "issue", label: "Issue label", type: "text", default: "Issue #1 · This week" },
      { key: "title", label: "Title", type: "text", default: "What's new at Quicksilver" },
      {
        key: "intro",
        label: "Intro",
        type: "textarea",
        default: "Here's a roundup of everything that happened this week.",
      },
      {
        key: "sections",
        label: "Sections",
        type: "list",
        default:
          "New feature launched | We shipped rich HTML composing with react-email.\nCommunity spotlight | See what people built this month.\nUpcoming events | Join our webinar next Thursday.",
        help: "One section per line, in the form: Heading | Body text",
      },
      { key: "buttonText", label: "Button text", type: "text", default: "Read more" },
      { key: "buttonUrl", label: "Button link", type: "url", default: "https://example.com" },
      { key: "company", label: "Company name", type: "text", default: "Quicksilver" },
      { key: "address", label: "Footer address", type: "text", default: "" },
      { key: "preheader", label: "Preview text", type: "text", default: "" },
    ],
  },
  {
    id: "announcement",
    name: "Announcement",
    description: "Centered announcement with a pill badge and optional button.",
    icon: "📣",
    category: "Marketing",
    Component: AnnouncementTemplate,
    subject: (v) => v.heading || "Announcement",
    fields: [
      { key: "badge", label: "Badge", type: "text", default: "New" },
      { key: "heading", label: "Heading", type: "text", default: "We just launched something big" },
      {
        key: "body",
        label: "Body",
        type: "textarea",
        default: "We've been working hard on this and can't wait for you to try it.",
      },
      { key: "buttonText", label: "Button text", type: "text", default: "See what's new" },
      { key: "buttonUrl", label: "Button link", type: "url", default: "https://example.com" },
      { key: "company", label: "Company name", type: "text", default: "Quicksilver" },
      { key: "address", label: "Footer address", type: "text", default: "" },
      { key: "preheader", label: "Preview text", type: "text", default: "" },
    ],
  },
  {
    id: "meeting",
    name: "Meeting invite",
    description: "Invitation with structured date/time/location details and a join button.",
    icon: "📅",
    category: "Productivity",
    Component: MeetingTemplate,
    subject: (v) => (v.title ? `Invitation: ${v.title}` : "Meeting invitation"),
    fields: [
      { key: "title", label: "Meeting title", type: "text", default: "Product sync" },
      {
        key: "description",
        label: "Description",
        type: "textarea",
        default: "Let's align on the roadmap and review open questions.",
      },
      { key: "date", label: "Date", type: "text", default: "Monday, 14 July 2026" },
      { key: "time", label: "Time", type: "text", default: "10:00 – 10:30 (GMT+5:30)" },
      { key: "location", label: "Location", type: "text", default: "Google Meet" },
      { key: "host", label: "Host", type: "text", default: "" },
      { key: "joinUrl", label: "Join link", type: "url", default: "https://meet.example.com/abc" },
      { key: "buttonText", label: "Button text", type: "text", default: "Join meeting" },
      { key: "company", label: "Company name", type: "text", default: "Quicksilver" },
      { key: "preheader", label: "Preview text", type: "text", default: "" },
    ],
  },
  {
    id: "receipt",
    name: "Receipt",
    description: "Order confirmation with a line-item table and total.",
    icon: "🧾",
    category: "Transactional",
    Component: ReceiptTemplate,
    subject: (v) => (v.orderId ? `Receipt for order ${v.orderId}` : "Your receipt"),
    fields: [
      { key: "heading", label: "Heading", type: "text", default: "Thanks for your order" },
      {
        key: "intro",
        label: "Intro",
        type: "textarea",
        default: "Your order is confirmed. Here's a summary of your purchase.",
      },
      { key: "orderId", label: "Order ID", type: "text", default: "QS-10234" },
      { key: "orderDate", label: "Order date", type: "text", default: "6 July 2026" },
      {
        key: "items",
        label: "Line items",
        type: "list",
        default: "Pro subscription (annual) | $120.00\nPriority support | $30.00",
        help: "One item per line, in the form: Item name | Price",
      },
      { key: "total", label: "Total", type: "text", default: "$150.00" },
      { key: "buttonText", label: "Button text", type: "text", default: "View order" },
      { key: "buttonUrl", label: "Button link", type: "url", default: "https://example.com" },
      { key: "company", label: "Company name", type: "text", default: "Quicksilver" },
      { key: "address", label: "Footer address", type: "text", default: "" },
      { key: "preheader", label: "Preview text", type: "text", default: "" },
    ],
  },
  {
    id: "otp",
    name: "Verification code",
    description: "One-time passcode with a large, centered code block.",
    icon: "🔐",
    category: "Transactional",
    Component: OtpTemplate,
    subject: (v) => (v.code ? `Your code: ${v.code}` : "Your verification code"),
    fields: [
      { key: "heading", label: "Heading", type: "text", default: "Your verification code" },
      {
        key: "intro",
        label: "Intro",
        type: "textarea",
        default: "Use the code below to finish signing in. It expires shortly.",
      },
      { key: "code", label: "Code", type: "text", default: "482915" },
      { key: "expiry", label: "Expiry note", type: "text", default: "This code expires in 10 minutes." },
      {
        key: "footnote",
        label: "Footnote",
        type: "text",
        default: "Didn't request this? You can safely ignore this email.",
      },
      { key: "company", label: "Company name", type: "text", default: "Quicksilver" },
      { key: "address", label: "Footer address", type: "text", default: "" },
      { key: "preheader", label: "Preview text", type: "text", default: "" },
    ],
  },
  {
    id: "password-reset",
    name: "Password reset",
    description: "Security email with a reset button, expiry note, and safe-to-ignore line.",
    icon: "🔑",
    category: "Transactional",
    Component: PasswordResetTemplate,
    subject: () => "Reset your password",
    fields: [
      { key: "heading", label: "Heading", type: "text", default: "Reset your password" },
      {
        key: "body",
        label: "Body",
        type: "textarea",
        default:
          "We received a request to reset your password. Click the button below to choose a new one.",
      },
      { key: "buttonText", label: "Button text", type: "text", default: "Reset password" },
      { key: "buttonUrl", label: "Button link", type: "url", default: "https://example.com/reset" },
      { key: "expiry", label: "Expiry note", type: "text", default: "This link expires in 30 minutes." },
      { key: "footnote", label: "Safe-to-ignore note", type: "textarea", default: "" },
      { key: "company", label: "Company name", type: "text", default: "Quicksilver" },
      { key: "address", label: "Footer address", type: "text", default: "" },
      { key: "preheader", label: "Preview text", type: "text", default: "" },
    ],
  },
  {
    id: "feedback",
    name: "Feedback request",
    description: "Centered ask for a review or rating with a star row and button.",
    icon: "⭐",
    category: "Marketing",
    Component: FeedbackTemplate,
    subject: (v) => v.heading || "How did we do?",
    fields: [
      { key: "heading", label: "Heading", type: "text", default: "How did we do?" },
      {
        key: "body",
        label: "Body",
        type: "textarea",
        default: "We'd love to hear about your experience. It only takes a minute.",
      },
      { key: "buttonText", label: "Button text", type: "text", default: "Leave feedback" },
      { key: "buttonUrl", label: "Button link", type: "url", default: "https://example.com/feedback" },
      { key: "footnote", label: "Footnote", type: "text", default: "" },
      { key: "company", label: "Company name", type: "text", default: "Quicksilver" },
      { key: "address", label: "Footer address", type: "text", default: "" },
      { key: "preheader", label: "Preview text", type: "text", default: "" },
    ],
  },
];

export const getTemplate = (id: string): EmailTemplate | undefined =>
  TEMPLATES.find((t) => t.id === id);

/** Build the default values map for a template's fields. */
export const defaultValues = (t: EmailTemplate): TemplateValues =>
  t.fields.reduce<TemplateValues>((acc, f) => {
    acc[f.key] = f.default;
    return acc;
  }, {});
