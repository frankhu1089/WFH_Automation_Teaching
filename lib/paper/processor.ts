import OpenAI from "openai";
import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import type { PaperSummary } from "@/types/paper-summary";

const client = new OpenAI();

function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

export async function processPaper(
  pdfBuffer: Buffer,
  filename: string,
  sessionId: string | null = null
): Promise<PaperSummary> {
  const pdfParse = (await import("pdf-parse")).default;
  const pdfData = await pdfParse(pdfBuffer);
  const text = pdfData.text.slice(0, 60000); // limit ~60k chars

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 8096,
    messages: [
      {
        role: "system",
        content:
          "You are a medical educator helping a resident prepare for journal club. Output only valid JSON. Language rule: ALL text you generate must be in English or Traditional Chinese (zh-TW) only. Simplified Chinese (zh-CN) is strictly forbidden — if a source text contains Simplified Chinese characters, convert them to Traditional Chinese equivalents before outputting.",
      },
      {
        role: "user",
        content: `Analyze this paper and produce a structured summary. Language rule: use Traditional Chinese (zh-TW) for all generated text (questions, labels, explanations); keep medical terms and direct paper quotes in their original language (English or Traditional Chinese). Never output Simplified Chinese — if the paper contains Simplified Chinese, convert to Traditional Chinese when quoting.

CRITICAL RULE — No hallucination:
- "expected_points", "red_flags", "discussion_angles", "source_anchor", and "why_it_matters" must ALL be grounded in the paper text.
- Copy short verbatim excerpts from the paper (1–2 sentences max). Do NOT paraphrase or invent content.
- If the paper does not contain enough text to support a point, omit that point rather than fabricating it.

Output ONLY valid JSON matching this exact schema (no other text):

{
  "what": "1-2 sentence summary in Traditional Chinese based strictly on the abstract and conclusion sections",
  "pico_or_design": {
    "type": "PICO" or "DESIGN",
    "P": "copy the exact population description from the Methods section, or null",
    "I": "copy the exact intervention description from the Methods section, or null",
    "C": "copy the exact comparator description from the Methods section, or null",
    "O": "copy the exact primary outcome sentence from the Methods/Results section, or null",
    "design_note": "copy the exact study design sentence from the paper, or null"
  },
  "discussion_keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "knowledge_gaps": [
    {
      "gap_id": "gap_1",
      "question": "Question in Traditional Chinese identifying what the paper leaves unclear or assumes readers know",
      "why_it_matters": "VERBATIM excerpt from the paper (1–2 sentences) that reveals this gap",
      "confidence": "low" | "medium" | "high",
      "source_anchor": "Exact quoted sentence from the paper that contains the gap, with section label e.g. (Discussion)"
    }
  ],
  "question_bank": {
    "for_students": [
      {
        "q": "Question in Traditional Chinese that a student can answer using the paper",
        "type": "definition" | "ddx" | "mechanism" | "treatment" | "interpretation",
        "expected_points": [
          "VERBATIM excerpt from the paper (≤2 sentences) that constitutes the correct answer"
        ],
        "red_flags": [
          "VERBATIM excerpt from the paper that contradicts a common misconception, or a direct quote showing the nuance students often miss"
        ]
      }
    ],
    "for_attendings": [
      {
        "q": "Deeper question in Traditional Chinese about research quality, generalizability, or clinical application",
        "type": "research" | "guideline" | "clinical_experience" | "external_validity" | "implementation",
        "discussion_angles": [
          "VERBATIM excerpt from the paper (≤2 sentences) that anchors this discussion angle"
        ]
      }
    ]
  }
}

Requirements:
- knowledge_gaps: 3-5 items; source_anchor must never be null
- question_bank.for_students: exactly 3 questions; each expected_points entry is a direct quote
- question_bank.for_attendings: exactly 2 questions; each discussion_angles entry is a direct quote

Paper text:
${text}`,
      },
    ],
  });

  const responseText = response.choices[0]?.message?.content ?? "";

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("OpenAI did not return valid JSON for paper summary");
  }

  const summaryData = JSON.parse(jsonMatch[0]);

  return {
    paper_id: uuidv4(),
    linked_session_id: sessionId,
    source_pdf: {
      filename,
      file_hash: hashBuffer(pdfBuffer),
    },
    summary: summaryData,
    meta: {
      model: "gpt-4o",
      created_at: new Date().toISOString(),
    },
  };
}

export function hashPdfBuffer(buffer: Buffer): string {
  return hashBuffer(buffer);
}
