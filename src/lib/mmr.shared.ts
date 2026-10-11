// Browser-safe MMR constants shared by server rating logic and UI.
export const RATING_MIN = 800;
export const RATING_MAX = 1600;
export const DEFAULT_RATING = 1000;

/** Skills a user can choose to track on the skill web (max MAX_TRACKED at a time). */
export const SKILL_CATALOG = [
  "Communication", "Problem Solving", "Leadership", "Teamwork", "Behavioral",
  "Interviewing", "Software Development", "System Design", "Data Structures & Algorithms",
  "Python", "SQL", "JavaScript", "Data Analysis", "Regression Analysis", "Machine Learning",
  "Generative AI", "Cloud & DevOps", "Product Sense", "Project Management", "Stakeholder Management",
] as const;
export const MAX_TRACKED = 6;
export const DEFAULT_TRACKED = ["Communication", "Problem Solving", "Leadership", "Software Development", "Behavioral"];
