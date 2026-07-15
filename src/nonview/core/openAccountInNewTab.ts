// Opens or focuses a browser tab when switching to a differnt account.
export function openAccountInNewTab(accountId: string): void {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin);
  url.searchParams.set("account", accountId);
  window.open(url.toString(), `quicksilver-${accountId}`);
}
