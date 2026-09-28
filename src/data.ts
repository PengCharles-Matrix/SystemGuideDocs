import type { Doc } from "./types";

export const initialDocs: Doc[] = [
  {
    id: "platform",
    category: "Getting Started",
    title: "Platform Documentation",
    description: "A clean, centralized reference for architecture, authentication, and content creation.",
    author: "Design & Engineering",
    updated: "Sep 28, 2026",
    readTime: 3,
    sections: [
      {
        id: "architecture",
        title: "System Architecture",
        paragraphs: [
          "Welcome to our streamlined Documentation Management Platform. Built with a clean, flat aesthetic, this workspace provides an uncluttered reading and authoring experience for technical guides and operational documentation."
        ]
      },
      {
        id: "principles",
        title: "Design Principles",
        paragraphs: [],
        bullets: [
          "Flat & Monochromatic Foundation: Neutral canvases, subtle hairline dividers, and high-legibility typography designed for prolonged reading comfort.",
          "Integrated Editor: Seamlessly toggle between reading and editing with typographic controls, special symbols, callouts, and local image uploads.",
          "Client-Side Storage: Zero database requirements. All content is saved locally with instant JSON export and import capabilities."
        ]
      },
      {
        id: "guides",
        title: "Getting Started Guides",
        paragraphs: [
          "Use the sidebar to browse topics by category. Open a page to read its content, edit it locally, or export the workspace as JSON."
        ]
      }
    ]
  },
  {
    id: "register",
    category: "Authentication",
    title: "How to Register a New Account",
    description: "Create an account and establish the initial profile.",
    author: "Product Engineering",
    updated: "Sep 27, 2026",
    readTime: 2,
    sections: [
      { id: "account", title: "Create an Account", paragraphs: ["Open the registration screen and provide the required account details. Use a unique email address and a strong password."] },
      { id: "verify", title: "Verify Your Email", paragraphs: ["Complete the verification step before signing in. A verified account unlocks the protected documentation and management areas."] }
    ]
  },
  {
    id: "login",
    category: "Authentication",
    title: "How to Login with Two-Factor Authentication",
    description: "Sign in securely with a password and second factor.",
    author: "Security Engineering",
    updated: "Sep 26, 2026",
    readTime: 3,
    sections: [
      { id: "signin", title: "Sign In", paragraphs: ["Enter your account credentials and submit the sign-in form."] },
      { id: "twofactor", title: "Complete Two-Factor Authentication", paragraphs: ["Enter the current verification code from your configured authenticator, then continue to the documentation workspace."] }
    ]
  },
  {
    id: "course-create",
    category: "Course Management",
    title: "How to Create and Configure a Course",
    description: "Set up course metadata, content, and publishing options.",
    author: "Learning Platform",
    updated: "Sep 25, 2026",
    readTime: 4,
    sections: [
      { id: "create", title: "Create a Course", paragraphs: ["Start with the course title, summary, category, and owner. Keep the title concise so it remains readable in navigation."] },
      { id: "configure", title: "Configure Course Content", paragraphs: ["Add modules and lessons in the order learners should consume them. Save changes before leaving the editor."] }
    ]
  },
  {
    id: "publish",
    category: "Course Management",
    title: "Publishing Courses & Managing Content",
    description: "Review, publish, and maintain course content.",
    author: "Learning Platform",
    updated: "Sep 24, 2026",
    readTime: 3,
    sections: [
      { id: "review", title: "Review Before Publishing", paragraphs: ["Check navigation, links, images, and lesson ordering. A clean preview should be completed before publishing."] },
      { id: "publish", title: "Publish and Maintain", paragraphs: ["Publish the approved version, then use the same workflow for future revisions and content maintenance."] }
    ]
  },
  {
    id: "api",
    category: "API & Integrations",
    title: "API Keys and Webhooks",
    description: "Connect external services and automate documentation workflows.",
    author: "Platform Engineering",
    updated: "Sep 23, 2026",
    readTime: 5,
    sections: [
      { id: "keys", title: "API Keys", paragraphs: ["Create scoped keys for trusted integrations. Never commit secrets to source control or expose them in browser code."] },
      { id: "webhooks", title: "Webhooks", paragraphs: ["Use webhooks to notify external systems when content changes. Validate incoming requests before processing them."] }
    ]
  }
];

export const categoryOrder = [
  "Getting Started",
  "Authentication",
  "Course Management",
  "API & Integrations"
];
