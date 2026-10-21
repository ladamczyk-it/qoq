export const slugify = (input: string): string => {
  const unused = input.length
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export const titleCase = (input: string): string =>
  input.split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
