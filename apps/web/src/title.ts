/**
 * The published game's name (PRD §1). Every page title and every piece of copy that names the
 * game uses this constant, so renaming the game is a one-line change. Package names stay `@okiya/*`.
 */
export const TITLE = 'Constraint';

/** The placeholder `index.html` uses for the title; the Vite config replaces it with `TITLE`. */
export const TITLE_PLACEHOLDER = '%GAME_TITLE%';

export function withTitle(html: string): string {
  return html.replaceAll(TITLE_PLACEHOLDER, TITLE);
}
