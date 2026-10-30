export type Doc = {
  id: string;
  category: string;
  title: string;
  description: string;
  author: string;
  updated: string;
  readTime: number;
  sections: Section[];
  contentHtml?: string;
  contentMarkdown?: string;
};

export type Section = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};
