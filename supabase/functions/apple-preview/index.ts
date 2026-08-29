const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type" };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  const input = new URL(request.url).searchParams;
  const title = input.get("title")?.trim(), artist = input.get("artist")?.trim();
  if (!title || !artist) return Response.json({ error: "title och artist krävs" }, { status: 400, headers: cors });
  const query = new URLSearchParams({ country: "se", media: "music", entity: "song", limit: "25", term: `${title} ${artist}` });
  const response = await fetch(`https://itunes.apple.com/search?${query}`);
  if (!response.ok) return Response.json({ error: "Apple Music svarade inte" }, { status: 502, headers: cors });
  return new Response(await response.text(), { headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
});
