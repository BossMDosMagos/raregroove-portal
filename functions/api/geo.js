export async function onRequestGet(context) {
  const country = (context.request.cf && context.request.cf.country) ? String(context.request.cf.country) : null;

  return new Response(
    JSON.stringify({
      country: country || null
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=300'
      }
    }
  );
}

