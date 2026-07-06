// Thin wrapper around react-email's `render()` for turning a selected template
// + its filled-in values into the two payloads the mail API needs:
//   - `html`: email-safe HTML with inlined styles (goes to body_html)
//   - `text`: a plain-text fallback (goes to body_text)
//
// `render` resolves the browser build under Vite, so this runs entirely in the
// client with no server round-trip.

import React from "react";
import { render } from "@react-email/render";
import { getTemplate, type TemplateValues } from "./templates";

export interface RenderedEmail {
  html: string;
  text: string;
}

export async function renderTemplate(
  templateId: string,
  values: TemplateValues,
): Promise<RenderedEmail> {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(`Unknown email template: ${templateId}`);
  }
  const element = React.createElement(template.Component, { values });
  const [html, text] = await Promise.all([
    render(element, { pretty: false }),
    render(element, { plainText: true }),
  ]);
  return { html, text };
}
