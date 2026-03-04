export interface PicoOrDesign {
  type: "PICO" | "DESIGN";
  P?: string | null;
  I?: string | null;
  C?: string | null;
  O?: string | null;
  design_note?: string | null;
}

export interface KnowledgeGap {
  gap_id: string;
  question: string;
  why_it_matters: string;
  confidence: "low" | "medium" | "high";
  source_anchor?: string | null;
}

export interface StudentQuestion {
  q: string;
  type: "definition" | "ddx" | "mechanism" | "treatment" | "interpretation";
  expected_points: string[];
  red_flags: string[];
}

export interface AttendingQuestion {
  q: string;
  type:
    | "research"
    | "guideline"
    | "clinical_experience"
    | "external_validity"
    | "implementation";
  discussion_angles: string[];
}

export interface PaperSummary {
  paper_id: string;
  linked_session_id: string | null;
  source_pdf: {
    filename: string;
    file_hash: string;
  };
  summary: {
    what: string;
    pico_or_design: PicoOrDesign;
    discussion_keywords: string[];
    knowledge_gaps: KnowledgeGap[];
    question_bank: {
      for_students: StudentQuestion[];
      for_attendings: AttendingQuestion[];
    };
  };
  meta: {
    model: string;
    created_at: string;
  };
}
