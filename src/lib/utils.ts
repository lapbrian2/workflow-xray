export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}

export function generateId() {
  return crypto.randomUUID();
}

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function truncate(str: string, len: number) {
  if (str.length <= len) return str;
  return str.slice(0, len) + "...";
}
