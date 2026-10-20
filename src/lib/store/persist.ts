// Ask the browser not to evict our storage. Installed PWAs usually get it;
// Safari tabs can otherwise be wiped after 7 days without a visit.
let asked = false

export async function requestPersistence(): Promise<boolean | null> {
  if (asked) return null
  asked = true
  try {
    if (!navigator.storage?.persist) return null
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return null
  }
}
