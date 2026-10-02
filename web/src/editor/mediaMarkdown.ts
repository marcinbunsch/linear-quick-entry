/** Linear renders `![name](url)` from its own upload storage inline, for videos as well as images. */
export function mediaMarkdown(name: string, assetUrl: string): string {
  // Brackets in a file name would end the alt text early.
  return `![${name.replace(/[[\]]/g, '')}](${assetUrl})`
}
