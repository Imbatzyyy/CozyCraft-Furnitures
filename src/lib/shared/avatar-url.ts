import type { SupabaseClient } from "@supabase/supabase-js";

const publicAvatarPathMarker = "/storage/v1/object/public/avatars/";

export function avatarObjectPath(value: string | null | undefined) {
  if (!value) return null;
  const markerIndex = value.indexOf(publicAvatarPathMarker);
  if (markerIndex >= 0) {
    return decodeURIComponent(
      value.slice(markerIndex + publicAvatarPathMarker.length).split("?")[0],
    );
  }
  return /^https?:\/\//i.test(value) ? null : value;
}

export async function privateAvatarUrl(
  value: string | null | undefined,
  client: SupabaseClient,
) {
  if (!value) return null;
  const path = avatarObjectPath(value);
  if (!path) return value;
  const { data, error } = await client.storage
    .from("avatars")
    .createSignedUrl(path, 60 * 60);
  return error ? null : data.signedUrl;
}

export async function privateAvatarUrls(
  values: Array<string | null | undefined>,
  client: SupabaseClient,
) {
  const paths = Array.from(
    new Set(values.map(avatarObjectPath).filter((path): path is string => Boolean(path))),
  );
  if (paths.length === 0) return values.map((value) => value ?? null);

  const { data, error } = await client.storage
    .from("avatars")
    .createSignedUrls(paths, 60 * 60);
  if (error || !data) {
    return values.map((value) => (avatarObjectPath(value) ? null : value ?? null));
  }

  const signedByPath = new Map(
    data
      .filter((item) => item.signedUrl)
      .map((item) => [item.path, item.signedUrl] as const),
  );
  return values.map((value) => {
    const path = avatarObjectPath(value);
    return path ? signedByPath.get(path) ?? null : value ?? null;
  });
}
